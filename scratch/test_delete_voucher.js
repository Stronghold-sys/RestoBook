/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("1. Creating a dummy voucher...");
  const { data: voucher, error: createError } = await supabase
    .from('vouchers')
    .insert({
      code: 'DUMMYTEST123',
      discount_percent: 10,
      usage_limit: 10,
      max_usage_per_user: 1,
      expires_at: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
      is_active: true,
      voucher_type: 'general',
      discount_type: 'percent',
      discount_value: 0,
      min_transaction: 0
    })
    .select()
    .single();

  if (createError) {
    console.error("Failed to create dummy voucher:", createError);
    return;
  }
  console.log("Dummy voucher created successfully:", voucher.id, voucher.code);

  // Now, let's distribute it to see if customer_vouchers entries are created
  console.log("2. Distributing the voucher...");
  const { data: customers, error: customersError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'customer');

  if (customersError) {
    console.error("Failed to fetch customers:", customersError);
  } else if (customers && customers.length > 0) {
    const inserts = customers.map(c => ({
      customer_id: c.id,
      voucher_id: voucher.id,
      used_count: 0
    }));

    const { error: upsertError } = await supabase
      .from('customer_vouchers')
      .upsert(inserts, { onConflict: 'customer_id,voucher_id' });

    if (upsertError) {
      console.error("Failed to insert into customer_vouchers:", upsertError);
    } else {
      console.log(`Associated voucher with ${inserts.length} customers in customer_vouchers table.`);
    }
  }

  // 3. Try to delete the voucher directly to see if Cascade deletes or if it throws FK error
  console.log("3. Trying to delete the voucher directly...");
  const { error: deleteError } = await supabase
    .from('vouchers')
    .delete()
    .eq('id', voucher.id);

  if (deleteError) {
    console.error("DELETE FAILED:", deleteError);
    console.log("This means there's a foreign key constraint without ON DELETE CASCADE.");
  } else {
    console.log("DELETE SUCCEEDED! This means the foreign key constraint has ON DELETE CASCADE or there are no relations preventing deletion.");
  }
}
run();
