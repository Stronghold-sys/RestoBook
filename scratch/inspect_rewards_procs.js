const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    SELECT proname, prosrc 
    FROM pg_proc 
    JOIN pg_namespace n ON n.oid = pronamespace 
    WHERE n.nspname = 'public' AND proname LIKE '%reward%'
  `;
  const { data, error } = await supabase.rpc('exec_sql_query', { sql_string: sql });
  if (error) {
    console.error("Error executing query:", error);
  } else {
    console.log("REWARDS PROCS:", JSON.stringify(data, null, 2));
  }
}
run();
