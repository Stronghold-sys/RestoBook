const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.from('restaurant_settings').select('*').single();
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Restaurant Settings data:");
    console.log("ID:", data.id);
    console.log("Restaurant Name:", data.name);
    console.log("Logo URL:", data.logo_url);
    if (data.logo_url) {
      console.log("Logo URL starts with:", data.logo_url.substring(0, 100));
      console.log("Logo URL length:", data.logo_url.length);
    }
  }
}

check();
