/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dazsblmccvxtewtmaljf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("MEMULAI MIGRASI DATABASE UNTUK DELIVERY...");
  
  const sql = `
    -- 1. Drop check constraint lama untuk order_type dan buat yang baru
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
    ALTER TABLE public.orders ADD CONSTRAINT orders_order_type_check CHECK (order_type IN ('dine_in', 'takeaway', 'delivery'));

    -- 2. Drop check constraint lama untuk status dan buat yang baru dengan 'shipping'
    ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
    ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'confirmed', 'processing', 'ready', 'shipping', 'completed', 'cancelled'));

    -- 3. Tambahkan kolom detail pengiriman ke tabel orders jika belum ada
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_recipient_name TEXT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_phone TEXT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_province TEXT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_regency TEXT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_district TEXT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_village TEXT;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_postal_code TEXT;

    NOTIFY pgrst, 'reload schema';
  `;

  console.log("Mengirim perintah SQL migrasi...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
     console.error("GAGAL RPC UTAMA:", error.message);
     console.log("Mencoba Jalur Alternatif (exec_sql_block)...");
     const { error: err2 } = await supabase.rpc('exec_sql_block', { sql_string: sql });
     if (err2) {
        console.error("Semuanya Gagal:", err2.message);
     } else {
        console.log("MIGRASI DELIVERY SUKSES MELALUI JALUR ALTERNATIF!");
     }
  } else {
     console.log("MIGRASI DELIVERY SUKSES MELALUI RPC UTAMA!");
  }
  
  process.exit(0);
}

run();
