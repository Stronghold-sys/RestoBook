const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    -- 1. Create wallet_transactions table if not exists
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
      amount DECIMAL(12,2) NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('topup', 'payment', 'refund', 'cashback', 'adjust', 'cancel')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
      payment_method TEXT,
      payment_reference TEXT,
      duitku_tx_id TEXT,
      fee DECIMAL(12,2) DEFAULT 0,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- 2. Create settings for wallet top up limits inside restaurant_settings
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS min_topup DECIMAL(12,2) DEFAULT 10000;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS max_topup DECIMAL(12,2) DEFAULT 2000000;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS is_duitku_enabled BOOLEAN DEFAULT true;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS is_cashback_enabled BOOLEAN DEFAULT true;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS wallet_admin_fee DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS is_auto_refund_enabled BOOLEAN DEFAULT true;

    -- 3. Enable RLS on wallet_transactions
    ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

    -- 4. RLS Policies
    DROP POLICY IF EXISTS "Customer view own wallet transactions" ON wallet_transactions;
    CREATE POLICY "Customer view own wallet transactions" ON wallet_transactions FOR SELECT
      USING (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

    DROP POLICY IF EXISTS "Admin full access wallet transactions" ON wallet_transactions;
    CREATE POLICY "Admin full access wallet transactions" ON wallet_transactions FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

    -- 5. Add wallet_transactions to publication
  `;

  console.log("Running wallet_transactions migration...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("Migration failed:", error);
    return;
  }
  console.log("wallet_transactions table and settings columns created successfully!");

  try {
    await supabase.rpc('exec_sql', { sql_string: "ALTER PUBLICATION supabase_realtime ADD TABLE wallet_transactions;" });
    console.log("Added wallet_transactions to realtime publication.");
  } catch (e) {
    console.log("wallet_transactions already in realtime publication or publication not configured.");
  }
}

run();
