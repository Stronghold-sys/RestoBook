const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials in env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  try {
    console.log("Creating temp table...");
    await supabase.rpc('exec_sql', { sql_string: `
      CREATE TABLE IF NOT EXISTS temp_inspect (
        id SERIAL PRIMARY KEY,
        data JSONB,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `});

    console.log("Inserting constraints data...");
    await supabase.rpc('exec_sql', { sql_string: `
      TRUNCATE temp_inspect;
      INSERT INTO temp_inspect (data)
      SELECT json_build_object('conname', conname, 'definition', pg_get_constraintdef(oid))
      FROM pg_constraint
      WHERE conname = 'support_tickets_status_check' OR conname LIKE '%ticket%' OR conname LIKE '%support%';
    `});

    console.log("Fetching data from temp table...");
    const { data, error } = await supabase.from('temp_inspect').select('*');
    if (error) {
      console.error("Fetch failed:", error.message);
    } else {
      console.log("Constraints found:", data);
    }

    console.log("Dropping temp table...");
    await supabase.rpc('exec_sql', { sql_string: `DROP TABLE IF EXISTS temp_inspect` });
  } catch (e) {
    console.error("Exception:", e);
  }
}

run();
