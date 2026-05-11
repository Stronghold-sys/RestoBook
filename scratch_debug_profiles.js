
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) console.error("ERROR:", error);
  else console.log("PROFILES DATA:", JSON.stringify(data, null, 2));
}
run();
