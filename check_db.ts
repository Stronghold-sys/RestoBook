import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  try {
    // Check current columns of salary_records
    const { data, error } = await supabase.rpc('check_table_columns', { tablename: 'salary_records' });
    if (error) {
      // Fallback if RPC not available, try to insert a dummy and catch error or just run raw SQL to add column safely
      console.log("RPC failed. Attempting to ADD column directly...");
      const { error: addErr } = await supabase.rpc('exec_sql', { sql: "ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS late_count INTEGER DEFAULT 0;" });
      if (addErr) {
         console.log("Fallback: Executing anonymous pgsql block...");
         // Fallback 2: Use common rest api proxy
         const { data: d2, error: e2 } = await supabase.from('salary_records').select('*').limit(1);
         console.log("Existing Row Keys:", d2?.[0] ? Object.keys(d2[0]) : "No rows found");
      } else {
         console.log("SQL Executed successfully. Column ensured.");
      }
    } else {
       console.log("Table columns:", data);
    }
  } catch (e) { console.error(e); }
}

checkSchema();
