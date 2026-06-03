const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase credentials in env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function inspect() {
  console.log("Inspecting rewards table...");
  const { data: rewards, error } = await supabase.from('rewards').select('*').limit(5);
  if (error) {
    console.error("Error fetching rewards:", error);
  } else {
    console.log("Rewards rows:", rewards);
    if (rewards && rewards.length > 0) {
      console.log("Columns:", Object.keys(rewards[0]));
    }
  }
}

inspect();
