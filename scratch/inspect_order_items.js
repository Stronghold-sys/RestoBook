/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Checking order_items records...");
  const { data, error } = await supabase
    .from('order_items')
    .select('*, menu_items(name, price)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching order_items:", error);
  } else {
    console.log("SAMPLE ORDER ITEMS:", JSON.stringify(data, null, 2));
  }
}
run();
