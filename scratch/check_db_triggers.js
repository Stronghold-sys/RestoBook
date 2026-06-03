/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Checking database triggers...");
  
  // Query to select all triggers in the database
  const query = `
    SELECT 
        trigger_name, 
        event_manipulation, 
        event_object_table, 
        action_statement, 
        action_timing
    FROM 
        information_schema.triggers;
  `;

  // We can also check functions related to auth or profile
  const query2 = `
    SELECT routine_name, routine_definition
    FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_definition LIKE '%profiles%';
  `;

  const { data, error } = await supabase.rpc('execute_sql_query', { sql: query });
  if (error) {
    // If execute_sql_query doesn't exist, we will execute direct select if we have RPC or we will handle it
    console.log("RPC execute_sql_query error:", error.message);
  } else {
    console.log("Database triggers:", data);
  }
}
run();
