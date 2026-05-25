/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dazsblmccvxtewtmaljf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("INSPECTING ORDERS SCHEMA...");
  
  // 1. Column Names
  const sqlColumns = `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'orders' 
    AND table_schema = 'public';
  `;
  const { data: cols, error: colErr } = await supabase.rpc('exec_sql', { sql_string: sqlColumns });
  if (colErr) {
    console.error("Col Error:", colErr);
  } else {
    console.log("Columns:", cols);
  }

  // 2. CHECK Constraints
  const sqlCheck = `
    SELECT conname, pg_get_constraintdef(c.oid) 
    FROM pg_constraint c 
    JOIN pg_namespace n ON n.oid = c.connamespace 
    WHERE c.conrelid = 'public.orders'::regclass 
    AND c.contype = 'c';
  `;
  const { data: checks, error: checkErr } = await supabase.rpc('exec_sql', { sql_string: sqlCheck });
  if (checkErr) {
    console.error("Check Error:", checkErr);
  } else {
    console.log("CHECK Constraints:", checks);
  }

  process.exit(0);
}

run();
