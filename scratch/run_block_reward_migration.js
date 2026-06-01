/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Starting DB migration to add is_blocked and block_reason to reward_redemptions...");
  const sql = `
    ALTER TABLE public.reward_redemptions ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
    ALTER TABLE public.reward_redemptions ADD COLUMN IF NOT EXISTS block_reason TEXT DEFAULT '';
    
    NOTIFY pgrst, 'reload schema';
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
     console.error("RPC exec_sql failed:", error.message);
     console.log("Trying alternative exec_sql_block...");
     const { error: err2 } = await supabase.rpc('exec_sql_block', { sql_string: sql });
     if (err2) {
        console.error("Migration failed:", err2.message);
     } else {
        console.log("Migration succeeded via exec_sql_block!");
     }
  } else {
     console.log("Migration succeeded via exec_sql!");
  }
  process.exit(0);
}

run();
