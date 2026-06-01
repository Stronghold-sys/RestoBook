const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing env vars", { url, key });
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  const orderId = 'f44e722c-2382-4f9c-8a7e-232f0055254c';
  console.log("Checking order:", orderId);
  
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('*, profiles!orders_customer_id_fkey(full_name)')
    .eq('id', orderId)
    .maybeSingle();

  if (orderErr) {
    console.error("Error fetching order:", orderErr);
  } else {
    console.log("Order found:", order);
  }
}

check();
