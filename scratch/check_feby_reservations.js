/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    SELECT id, user_id, full_name, email FROM profiles WHERE id IN ('ffbfec29-398e-4efd-a8af-4d3023c37070', '228dc8e9-62e6-4cca-b335-64a6b4c6c865')
  `;
  const { data, error } = await supabase.rpc('exec_sql_query', { sql_string: sql });
  console.log("Profiles details:", data, error);
}
run();
