/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    -- 1. Add occupied_at column to tables
    ALTER TABLE tables ADD COLUMN IF NOT EXISTS occupied_at TIMESTAMPTZ;

    -- 2. Add occupied_at trigger function
    CREATE OR REPLACE FUNCTION update_table_occupied_at()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.status = 'occupied' AND (OLD.status IS NULL OR OLD.status != 'occupied') THEN
        NEW.occupied_at := now();
      ELSIF NEW.status != 'occupied' AND OLD.status = 'occupied' THEN
        NEW.occupied_at := NULL;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trigger_update_table_occupied_at ON tables;
    CREATE TRIGGER trigger_update_table_occupied_at
      BEFORE UPDATE ON tables
      FOR EACH ROW
      EXECUTE FUNCTION update_table_occupied_at();

    -- 3. Add auto-empty duration settings to restaurant_settings
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS auto_empty_hours INT DEFAULT 0;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS auto_empty_minutes INT DEFAULT 0;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS auto_empty_seconds INT DEFAULT 0;

    -- 4. Add welcome reward settings to restaurant_settings
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS welcome_gift_enabled BOOLEAN DEFAULT TRUE;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS welcome_gift_points INT DEFAULT 1000;

    -- 5. Add welcome_gift_claimed to profiles
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS welcome_gift_claimed BOOLEAN DEFAULT FALSE;

    -- 6. Mark all existing customer profiles as already claimed so they don't get the welcome gift popup
    UPDATE profiles SET welcome_gift_claimed = TRUE WHERE role = 'customer';

    -- 7. Add delete policy for reservations (for customers)
    DROP POLICY IF EXISTS "Customer delete own reservations" ON reservations;
    CREATE POLICY "Customer delete own reservations" ON reservations FOR DELETE TO authenticated
      USING (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

    -- 8. Add update policy for settings (for both admins and cashiers)
    DROP POLICY IF EXISTS "Admin update settings" ON restaurant_settings;
    DROP POLICY IF EXISTS "Admin and Cashier update settings" ON restaurant_settings;
    CREATE POLICY "Admin and Cashier update settings" ON restaurant_settings FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'cashier')))
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'cashier')));
  `;

  console.log("Running custom Supabase schema migration...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("Migration failed:", error);
    return;
  }
  console.log("Migration executed successfully!");
}

run();
