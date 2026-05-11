/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://dazsblmccvxtewtmaljf.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ";

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const sqlBlock = `
    -- Phase 1.1: profiles table additions (banking & salary components)
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS daily_salary DECIMAL(12,2) DEFAULT 75000;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS overtime_pay_per_hour DECIMAL(12,2) DEFAULT 10000;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS fixed_allowance DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS payment_method_preference TEXT DEFAULT 'tunai';
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS bank_name TEXT;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS bank_branch TEXT;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS e_wallet_name TEXT;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS e_wallet_number TEXT;

    -- Phase 1.2: resign_requests table additions
    ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS suspension_time TIMESTAMPTZ;
    ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS employee_decision TEXT DEFAULT 'menunggu';
    ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS decision_recorded_at TIMESTAMPTZ;
    ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT FALSE;
    ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS wa_suspended_sent BOOLEAN DEFAULT FALSE;

    -- Create salary_components table (Transactions like bon and denda)
    CREATE TABLE IF NOT EXISTS salary_components (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
      type TEXT CHECK (type IN ('bon', 'denda', 'bonus', 'tunjangan')) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      notes TEXT,
      status TEXT CHECK (status IN ('active', 'processed')) DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    ALTER TABLE IF EXISTS salary_components ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "auth_salary_components_all" ON salary_components;
    CREATE POLICY "auth_salary_components_all" ON salary_components FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Create salary_history table (Finalized monthly slips)
    CREATE TABLE IF NOT EXISTS salary_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
      month INT NOT NULL,
      year INT NOT NULL,
      total_days_worked INT DEFAULT 0,
      total_days_leave INT DEFAULT 0,
      total_days_alpha INT DEFAULT 0,
      total_hours_overtime DECIMAL(12,2) DEFAULT 0,
      daily_salary_rate DECIMAL(12,2) DEFAULT 75000,
      base_salary DECIMAL(12,2) DEFAULT 0,
      total_bon DECIMAL(12,2) DEFAULT 0,
      total_denda DECIMAL(12,2) DEFAULT 0,
      total_bonus DECIMAL(12,2) DEFAULT 0,
      total_allowance DECIMAL(12,2) DEFAULT 0,
      net_salary DECIMAL(12,2) DEFAULT 0,
      is_transferred BOOLEAN DEFAULT FALSE,
      transfer_date TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    ALTER TABLE IF EXISTS salary_history ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "auth_salary_history_all" ON salary_history;
    CREATE POLICY "auth_salary_history_all" ON salary_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Ensure realtime is enabled on new tables
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'salary_components') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE salary_components;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'salary_history') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE salary_history;
      END IF;
    END $$;

    NOTIFY pgrst, 'reload schema';
`;

async function run() {
  console.log("🚀 Executing Enterprise Schema Upgrade Migration...");
  try {
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_string: sqlBlock });
    if (error) {
      console.error("❌ RPC Failed:", error.message);
    } else {
      console.log("✅ SQL Block executed successfully!");
      console.log("📊 Verifying profiles columns...");
      const { data: cols } = await supabaseAdmin.rpc('exec_sql', {
        sql_string: "SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'daily_salary';"
      });
      if (cols && cols.length > 0) {
        console.log("🎉 SUCCESS! Schema modification detected and applied.");
      } else {
        console.log("⚠️ Executed successfully but could not verify new columns.");
      }
    }
  } catch (e) {
    console.error("🔥 CATCH ERROR:", e.message);
  }
}

run();
