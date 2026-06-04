/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    SELECT id, status FROM public.point_transactions WHERE status NOT IN (
      'aktif', 'pending', 'dibatalkan', 'diproses', 'koreksi', 'reset', 'ditolak', 'selesai',
      'earned', 'redeemed', 'expired', 'manual_earned', 'manual_redeemed', 'refunded', 'returned'
    )
  `;
  const { data, error } = await supabase.rpc('exec_sql_query', { sql_string: sql });
  if (error) {
    console.error("Error executing query:", error);
  } else {
    console.log("POINT TRANSACTIONS CONSTRAINTS:", JSON.stringify(data, null, 2));
  }
}
run();
