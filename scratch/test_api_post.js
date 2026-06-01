const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const payload = {
    title: 'Test Reward 1000',
    description: 'test description',
    category: 'cashback',
    min_points: 1000, // minPoints
    stock: 5,
    image_url: '',
    discount_percent: 10,
    cashback_amount: 10000,
    is_auto_cashback: false,
    expiry_days: null,
    is_active: true
  };

  const { data, error } = await supabase
    .from('rewards')
    .insert(payload)
    .select();

  if (error) {
    console.error("Error creating:", error);
  } else {
    console.log("Created data successfully:", data);
    // Cleanup
    if (data && data[0]) {
      await supabase.from('rewards').delete().eq('id', data[0].id);
      console.log("Cleaned up test reward");
    }
  }
}
run();
