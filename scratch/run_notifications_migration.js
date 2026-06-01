/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    -- Add columns to notifications table for loyalty point system metadata
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS points INT;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS order_id UUID;
    ALTER TABLE notifications ADD COLUMN IF NOT EXISTS status_badge TEXT;
  `;

  console.log("Altering notifications table...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error("Failed to alter notifications table:", error);
    return;
  }
  console.log("notifications table altered successfully!");
}

run();
