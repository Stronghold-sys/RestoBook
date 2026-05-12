import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function debugOrder() {
  // Grab the last order that has multiple items
  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, total_amount, order_items(*, menu_items(name))')
    .order('created_at', { ascending: false })
    .limit(10);

  const multiOrder = orders?.find(o => o.order_items && o.order_items.length > 1);
  
  if (multiOrder) {
    console.log("FOUND MULTI-ITEM ORDER:");
    console.log(JSON.stringify(multiOrder, null, 2));
  } else {
    console.log("No multi-item orders found in recent history. Fetching latest order instead:");
    console.log(JSON.stringify(orders?.[0], null, 2));
  }
}

debugOrder();
