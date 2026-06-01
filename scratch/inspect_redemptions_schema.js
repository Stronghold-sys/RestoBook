const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_string: `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reward_redemptions';
    `
  });
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Columns of reward_redemptions:", data);
}

run();
