/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runSql(sqlDesc, sql) {
  console.log(`Running: ${sqlDesc}...`);
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error(`Error running ${sqlDesc}:`, error.message);
    return false;
  }
  console.log(`Success: ${sqlDesc}`);
  return true;
}

async function run() {
  // 1. Column wallet_status in profiles
  await runSql("Add wallet_status to profiles", `
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_status TEXT DEFAULT 'belum_aktif';
  `);

  await runSql("Add constraint to wallet_status in profiles", `
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_wallet_status;
    ALTER TABLE profiles ADD CONSTRAINT chk_wallet_status CHECK (wallet_status IN ('belum_aktif', 'diajukan', 'diajukan_ulang', 'diproses', 'diterima', 'ditolak', 'selesai'));
  `);

  await runSql("Set active status for existing pinned profiles", `
    UPDATE profiles SET wallet_status = 'selesai' WHERE wallet_pin IS NOT NULL AND wallet_status = 'belum_aktif';
  `);

  // 2. Create wallet_activations table
  await runSql("Create wallet_activations table", `
    CREATE TABLE IF NOT EXISTS wallet_activations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
      status TEXT CHECK (status IN ('belum_aktif', 'diajukan', 'diajukan_ulang', 'diproses', 'diterima', 'ditolak', 'selesai')) DEFAULT 'diajukan' NOT NULL,
      
      -- Data Pribadi
      full_name TEXT NOT NULL,
      nik TEXT NOT NULL,
      birth_place TEXT NOT NULL,
      birth_date DATE NOT NULL,
      gender TEXT NOT NULL,
      marital_status TEXT NOT NULL,
      nationality TEXT NOT NULL,
      religion TEXT NOT NULL,
      occupation TEXT NOT NULL,
      mother_name TEXT NOT NULL,
      
      -- Kontak
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      address TEXT NOT NULL,
      rt_rw TEXT NOT NULL,
      village TEXT NOT NULL,
      district TEXT NOT NULL,
      city TEXT NOT NULL,
      province TEXT NOT NULL,
      postal_code TEXT NOT NULL,
      
      -- Tambahan Identitas
      ktp_name TEXT NOT NULL,
      ktp_number TEXT NOT NULL,
      ktp_front_url TEXT NOT NULL,
      ktp_back_url TEXT,
      additional_doc_url TEXT,
      
      -- Data Dompet & Persetujuan
      purpose TEXT NOT NULL,
      source_of_funds TEXT NOT NULL,
      statement_true BOOLEAN DEFAULT false NOT NULL,
      terms_accepted BOOLEAN DEFAULT false NOT NULL,
      privacy_accepted BOOLEAN DEFAULT false NOT NULL,
      verify_accepted BOOLEAN DEFAULT false NOT NULL,
      
      -- Catatan Admin
      rejection_reason TEXT,
      invalid_fields JSONB DEFAULT '[]'::jsonb,
      processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
      processed_at TIMESTAMPTZ,
      
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Trigger for update
  await runSql("Create update trigger for wallet_activations", `
    DROP TRIGGER IF EXISTS update_wallet_activations_updated_at ON wallet_activations;
    CREATE TRIGGER update_wallet_activations_updated_at BEFORE UPDATE ON wallet_activations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `);

  // 3. Create wallet_activation_logs table
  await runSql("Create wallet_activation_logs table", `
    CREATE TABLE IF NOT EXISTS wallet_activation_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      activation_id UUID REFERENCES wallet_activations(id) ON DELETE CASCADE,
      profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
      admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // 4. Enable RLS
  await runSql("Enable RLS on wallet_activations", `
    ALTER TABLE wallet_activations ENABLE ROW LEVEL SECURITY;
  `);
  await runSql("Enable RLS on wallet_activation_logs", `
    ALTER TABLE wallet_activation_logs ENABLE ROW LEVEL SECURITY;
  `);

  // 5. Add Policies
  await runSql("Add select policy on wallet_activations", `
    DROP POLICY IF EXISTS "Customer can view own activation" ON wallet_activations;
    CREATE POLICY "Customer can view own activation" ON wallet_activations 
      FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
  `);

  await runSql("Add insert policy on wallet_activations", `
    DROP POLICY IF EXISTS "Customer can insert own activation" ON wallet_activations;
    CREATE POLICY "Customer can insert own activation" ON wallet_activations 
      FOR INSERT WITH CHECK (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
  `);

  await runSql("Add update policy on wallet_activations", `
    DROP POLICY IF EXISTS "Customer can update own activation" ON wallet_activations;
    CREATE POLICY "Customer can update own activation" ON wallet_activations 
      FOR UPDATE USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
  `);

  await runSql("Add admin policy on wallet_activations", `
    DROP POLICY IF EXISTS "Admin full access activation" ON wallet_activations;
    CREATE POLICY "Admin full access activation" ON wallet_activations 
      USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));
  `);

  await runSql("Add select policy on wallet_activation_logs", `
    DROP POLICY IF EXISTS "Customer can view own logs" ON wallet_activation_logs;
    CREATE POLICY "Customer can view own logs" ON wallet_activation_logs 
      FOR SELECT USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
  `);

  await runSql("Add admin policy on wallet_activation_logs", `
    DROP POLICY IF EXISTS "Admin full access logs" ON wallet_activation_logs;
    CREATE POLICY "Admin full access logs" ON wallet_activation_logs 
      USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));
  `);

  // 6. Enable Realtime
  // Use try catch structure or runSql. If it fails due to already exists, it is fine
  await runSql("Add wallet_activations to publication", `
    ALTER PUBLICATION supabase_realtime ADD TABLE wallet_activations;
  `);
  await runSql("Add wallet_activation_logs to publication", `
    ALTER PUBLICATION supabase_realtime ADD TABLE wallet_activation_logs;
  `);
  await runSql("Add profiles to publication", `
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  `);

  console.log("Migration complete!");
}

run();
