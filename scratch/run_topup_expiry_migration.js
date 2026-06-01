const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS topup_expiry_minutes INT DEFAULT 15;
  `;

  console.log("Running topup_expiry_minutes migration...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("Migration failed:", error);
    return;
  }
  console.log("topup_expiry_minutes column created successfully!");
}

run();
