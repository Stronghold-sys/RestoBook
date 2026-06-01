/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    SELECT pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    WHERE p.proname = 'exec_sql';
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  console.log("Def:", data, error);
}
run();
