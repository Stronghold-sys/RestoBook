const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    SELECT conname, pg_get_constraintdef(c.oid) 
    FROM pg_constraint c 
    JOIN pg_namespace n ON n.oid = c.connamespace 
    WHERE conrelid = 'rewards'::regclass
  `;
  const { data, error } = await supabase.rpc('exec_sql_query', { sql_string: sql });
  if (error) {
    console.error("Error executing query:", error);
  } else {
    console.log("REWARDS CONSTRAINTS:", JSON.stringify(data, null, 2));
  }
}
run();
