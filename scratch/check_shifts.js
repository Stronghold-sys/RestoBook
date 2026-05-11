/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('shifts').select('*').limit(1);
  if (error) {
     console.log("Error:", error);
  } else {
     console.log("Shift Keys:", Object.keys(data[0] || {}));
  }
  process.exit(0);
}
main();
