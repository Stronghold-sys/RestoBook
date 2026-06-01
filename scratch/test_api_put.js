const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // Let's get the Cashback reward id
  const { data: rewards } = await supabase.from('rewards').select('id').eq('title', 'Casback');
  if (!rewards || rewards.length === 0) {
    console.log("No Cashback reward found");
    return;
  }
  const id = rewards[0].id;

  // Let's run the exact API PUT payload update
  const payload = {
    title: 'Casback',
    description: 'casback untukmu',
    category: 'cashback',
    min_points: 1000, // minPoints
    stock: 3,
    image_url: '',
    discount_percent: 10,
    cashback_amount: 25000,
    is_auto_cashback: false,
    expiry_days: null,
    is_active: true,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('rewards')
    .update(payload)
    .eq('id', id)
    .select();

  if (error) {
    console.error("Error updating:", error);
  } else {
    console.log("Updated data successfully:", data);
  }
}
run();
