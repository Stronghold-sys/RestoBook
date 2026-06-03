const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials in env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  const sqlPath = path.join(__dirname, '..', 'migrations', 'add_profile_email_approval_flow.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log("Running migration statements from:", sqlPath);
  
  // We can execute the whole SQL script, but sometimes it is better to split it.
  // In PostgreSQL, executing multiple DDL statements separated by semicolons in a single string is fully supported.
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
    if (error) {
      console.error("Migration failed:", error.message);
      process.exit(1);
    } else {
      console.log("Migration executed successfully!");
    }
  } catch (e) {
    console.error("Exception during migration:", e);
    process.exit(1);
  }
}

run();
