const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    SELECT column_name, data_type, numeric_precision, numeric_scale 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'rewards'
  `;
  const { data, error } = await supabase.rpc('exec_sql_query', { sql_string: sql });
  if (error) {
    console.error("Error executing query:", error);
  } else {
    console.log("REWARDS COLUMNS:", JSON.stringify(data, null, 2));
  }
}
run();
