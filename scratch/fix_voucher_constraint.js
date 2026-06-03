/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("MEMULAI PERBAIKAN CONSTRAINT DISKON VOUCHER...");
  const sql = `
    -- 1. Drop existing constraint
    ALTER TABLE public.vouchers DROP CONSTRAINT IF EXISTS vouchers_discount_percent_check;

    -- 2. Add modified constraint allowing 0 percent (for nominal discount types)
    ALTER TABLE public.vouchers ADD CONSTRAINT vouchers_discount_percent_check CHECK (discount_percent >= 0 AND discount_percent <= 100);

    NOTIFY pgrst, 'reload schema';
  `;

  console.log("Mengirim SQL ke database...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
    console.error("Gagal melalui RPC utama:", error.message);
    const { error: err2 } = await supabase.rpc('exec_sql_block', { sql_string: sql });
    if (err2) {
      console.error("Gagal juga di exec_sql_block:", err2.message);
      process.exit(1);
    } else {
      console.log("Berhasil mengubah constraint melalui exec_sql_block!");
    }
  } else {
    console.log("Berhasil mengubah constraint tabel vouchers!");
  }
  process.exit(0);
}
run();
