/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    CREATE OR REPLACE FUNCTION public.exec_sql_query(sql_string text)
    RETURNS json AS $$
    DECLARE
        result json;
    BEGIN
        EXECUTE 'SELECT coalesce(json_agg(t), ''[]''::json) FROM (' || sql_string || ') t' INTO result;
        RETURN result;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  const { error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("Error creating exec_sql_query function:", error);
  } else {
    console.log("Successfully created exec_sql_query function!");
  }
}
run();
