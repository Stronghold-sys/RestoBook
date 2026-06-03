/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Melakukan query langsung ke tabel vouchers...");
  const { data, error } = await supabase.from('vouchers').select('*').limit(5);
  if (error) {
    console.error("ERROR SELECT VOUCHERS:", error.message);
  } else {
    console.log("VOUCHERS DATA SAMPLES:", data);
  }
}
run();
