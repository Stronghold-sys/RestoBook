const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
const getEnv = (key) => {
  const match = env.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};
const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(url, key);

async function run() {
  console.log("Starting points status constraints migration...");
  
  const sql = `
    -- Drop old status check constraint if it exists
    ALTER TABLE public.point_transactions
    DROP CONSTRAINT IF EXISTS point_transactions_status_check;

    -- Add updated status check constraint supporting old and new statuses
    ALTER TABLE public.point_transactions
    ADD CONSTRAINT point_transactions_status_check
    CHECK (status IN (
      'aktif', 'pending', 'dibatalkan', 'diproses', 'koreksi', 'reset', 'ditolak', 'selesai',
      'earned', 'redeemed', 'expired', 'manual_earned', 'manual_redeemed', 'refunded', 'returned', 'cancelled'
    ));

    -- Make sure points_status exists and is properly constrained
    ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS points_status TEXT DEFAULT 'aktif';

    ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_points_status_check;

    ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_points_status_check
    CHECK (points_status IN ('aktif', 'pending', 'diblokir', 'dibatasi', 'nonaktif_sementara'));
  `;
  
  console.log("Executing SQL...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("Migration failed:", error.message);
  } else {
    console.log("Migration successful!");
  }
}

run().catch(console.error);
