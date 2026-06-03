/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Inspecting columns of rewards table...");
  const { data, error } = await supabase.from('rewards').select('*').limit(1);
  if (error) {
    console.error("Error fetching rewards:", error);
  } else {
    console.log("Sample Reward row keys:", Object.keys(data[0] || {}));
    console.log("Sample Reward row data:", data[0]);
  }
}
run();
