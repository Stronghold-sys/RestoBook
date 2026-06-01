/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(12,2) DEFAULT 0;
  `;
  console.log("Running wallet_balance migration...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("Migration failed:", error);
    return;
  }
  console.log("wallet_balance column added successfully!");
}

run();
