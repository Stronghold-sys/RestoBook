/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    -- 1. Alter profiles table
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points INT DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pending_points INT DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points_used INT DEFAULT 0;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_redeem_blocked BOOLEAN DEFAULT false;

    -- 2. Alter restaurant_settings table
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS min_random_points INT DEFAULT 10;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS max_random_points INT DEFAULT 100;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS is_points_enabled BOOLEAN DEFAULT true;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS points_expiry_days INT DEFAULT 365;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS max_points_per_transaction INT DEFAULT 1000;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS bonus_new_customer INT DEFAULT 25;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS bonus_birthday INT DEFAULT 50;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS multiplier INT DEFAULT 1;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS bonus_event_name TEXT DEFAULT '';
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS bonus_event_points INT DEFAULT 0;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS bonus_day_of_week INT DEFAULT -1; -- -1 disabled, 0-6 for Sunday-Saturday
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS bonus_day_multiplier INT DEFAULT 1;

    -- 3. Create point_transactions table
    CREATE TABLE IF NOT EXISTS point_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
      order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
      points INT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'earned', 'redeemed', 'cancelled', 'expired', 'manual_earned', 'manual_redeemed')),
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    -- 4. Create rewards table
    CREATE TABLE IF NOT EXISTS rewards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL CHECK (category IN ('voucher', 'food', 'cashback', 'product', 'custom')),
      min_points INT NOT NULL DEFAULT 0,
      stock INT,
      image_url TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- 5. Create reward_redemptions table
    CREATE TABLE IF NOT EXISTS reward_redemptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
      reward_id UUID REFERENCES rewards(id) ON DELETE CASCADE,
      points_spent INT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'used', 'expired', 'cancelled')) DEFAULT 'pending',
      code TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
    ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

    -- Enable Realtime
    -- Note: We check if tables are already in publication first or just add them
    -- We can safely run ADD TABLE since we handle it. But to be safe on duplicate, drop or ignore error.
    -- Better yet, run it in a try catch or do it table by table.
  `;

  console.log("Running main SQL migration block...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("Migration failed:", error);
    return;
  }
  console.log("Migration tables & columns created successfully!");

  // Enable policies
  const rlsSql = `
    DROP POLICY IF EXISTS "Customer view own point transactions" ON point_transactions;
    CREATE POLICY "Customer view own point transactions" ON point_transactions FOR SELECT
      USING (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

    DROP POLICY IF EXISTS "Admin full access point transactions" ON point_transactions;
    CREATE POLICY "Admin full access point transactions" ON point_transactions FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Anyone can view active rewards" ON rewards;
    CREATE POLICY "Anyone can view active rewards" ON rewards FOR SELECT
      USING (is_active = true);

    DROP POLICY IF EXISTS "Admin full access rewards" ON rewards;
    CREATE POLICY "Admin full access rewards" ON rewards FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

    DROP POLICY IF EXISTS "Customer view own redemptions" ON reward_redemptions;
    CREATE POLICY "Customer view own redemptions" ON reward_redemptions FOR SELECT
      USING (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

    DROP POLICY IF EXISTS "Customer create own redemptions" ON reward_redemptions;
    CREATE POLICY "Customer create own redemptions" ON reward_redemptions FOR INSERT
      WITH CHECK (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

    DROP POLICY IF EXISTS "Admin full access redemptions" ON reward_redemptions;
    CREATE POLICY "Admin full access redemptions" ON reward_redemptions FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));
  `;

  console.log("Applying RLS policies...");
  const { error: rlsErr } = await supabase.rpc('exec_sql', { sql_string: rlsSql });
  if (rlsErr) {
    console.error("RLS policy application failed:", rlsErr);
  } else {
    console.log("RLS policies applied successfully!");
  }

  // Register realtime publication tables
  console.log("Registering realtime publications...");
  // Let's add them to the pub
  try {
    await supabase.rpc('exec_sql', { sql_string: "ALTER PUBLICATION supabase_realtime ADD TABLE point_transactions;" });
  } catch (e) {}
  try {
    await supabase.rpc('exec_sql', { sql_string: "ALTER PUBLICATION supabase_realtime ADD TABLE rewards;" });
  } catch (e) {}
  try {
    await supabase.rpc('exec_sql', { sql_string: "ALTER PUBLICATION supabase_realtime ADD TABLE reward_redemptions;" });
  } catch (e) {}
  console.log("Realtime publication registrations done.");
}

run();
