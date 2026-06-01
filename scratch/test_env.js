/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log("KEY length:", process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 0);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  if (error) {
    console.error("ERROR querying profiles:", error.message);
  } else {
    console.log("PROFILES:", data);
  }
}
run();
