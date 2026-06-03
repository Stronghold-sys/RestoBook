/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Checking foreign key constraints referring to vouchers...");
  
  // Query to inspect foreign keys on the vouchers table
  const query = `
    SELECT
        tc.table_schema, 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
          ON rc.constraint_name = tc.constraint_name
          AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND ccu.table_name = 'vouchers';
  `;

  const { data, error } = await supabase.rpc('execute_sql_query', { sql: query });
  if (error) {
    // If execute_sql_query RPC doesn't exist, we will use a raw query or select metadata
    console.log("RPC execute_sql_query error, trying direct queries or we can check the error when deleting.");
    console.error(error.message);
  } else {
    console.log("Foreign Key constraints referencing 'vouchers':", data);
  }
}
run();
