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
  console.log("Starting points schema migration...");
  
  const sql = `
    ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS points_status TEXT DEFAULT 'aktif' CHECK (points_status IN ('aktif', 'pending', 'diblokir', 'dibatasi', 'nonaktif_sementara'));

    ALTER TABLE public.point_transactions
    ADD COLUMN IF NOT EXISTS before_points INTEGER,
    ADD COLUMN IF NOT EXISTS after_points INTEGER,
    ADD COLUMN IF NOT EXISTS acted_by UUID REFERENCES public.profiles(id),
    ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('manual', 'sistem', 'order', 'reward', 'refund', 'pembatalan')),
    ADD COLUMN IF NOT EXISTS reason TEXT;
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
