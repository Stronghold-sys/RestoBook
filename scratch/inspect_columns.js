/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles';
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("ERROR via exec_sql:", error.message);
    const { data: data2, error: error2 } = await supabase.rpc('exec_sql_block', { sql_string: sql });
    if (error2) console.error("ERROR via exec_sql_block:", error2.message);
    else console.log("COLUMNS:", data2);
  } else {
    console.log("COLUMNS:", data);
  }
}
run();
