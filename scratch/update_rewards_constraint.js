const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    ALTER TABLE rewards DROP CONSTRAINT IF EXISTS rewards_category_check;
    ALTER TABLE rewards ADD CONSTRAINT rewards_category_check CHECK (category = ANY (ARRAY['voucher'::text, 'food'::text, 'cashback'::text, 'product'::text, 'custom'::text, 'shipping'::text]));
    NOTIFY pgrst, 'reload schema';
  `;
  
  // Try exec_sql_query
  console.log("Trying exec_sql_query...");
  const { data, error } = await supabase.rpc('exec_sql_query', { sql_string: sql });
  if (error) {
    console.error("exec_sql_query failed:", error.message);
    console.log("Trying exec_sql...");
    const { data: data2, error: error2 } = await supabase.rpc('exec_sql', { sql_string: sql });
    if (error2) {
      console.error("exec_sql failed:", error2.message);
    } else {
      console.log("Success with exec_sql!");
    }
  } else {
    console.log("Success with exec_sql_query!");
  }
}
run();
