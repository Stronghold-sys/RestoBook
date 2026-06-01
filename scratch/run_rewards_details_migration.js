/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    ALTER TABLE rewards ADD COLUMN IF NOT EXISTS discount_percent INT DEFAULT 10;
    ALTER TABLE rewards ADD COLUMN IF NOT EXISTS cashback_amount DECIMAL(12,2) DEFAULT 0;
  `;
  console.log("Adding columns to rewards...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("Migration failed:", error);
    return;
  }
  console.log("Columns added successfully!");
}

run();
