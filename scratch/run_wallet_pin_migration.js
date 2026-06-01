const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const sql = `
    -- 1. Tambah kolom ke profiles untuk PIN Dompetku & pembatasan
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_pin TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wrong_pin_count INT DEFAULT 0;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_pin_reset_required BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_block_reason TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_wallet_blocked BOOLEAN DEFAULT false;

    -- 2. Tambah kolom ke appeals untuk tipe dan bukti lampiran
    ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'suspension';
    ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS attachment_url TEXT;

    -- 3. Hapus check constraint type lama pada tabel otp_codes agar dapat menampung tipe baru
    ALTER TABLE public.otp_codes DROP CONSTRAINT IF EXISTS otp_codes_type_check;
  `;

  console.log("Menjalankan migrasi database PIN Dompetku...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
    console.error("Gagal melalui exec_sql:", error.message);
    console.log("Mencoba jalur alternatif exec_sql_block...");
    const { error: err2 } = await supabase.rpc('exec_sql_block', { sql_string: sql });
    if (err2) {
      console.error("Semua jalur RPC gagal. Silakan jalankan kueri SQL di Dashboard Supabase secara manual.");
      process.exit(1);
    }
  }

  console.log("Migrasi database PIN Dompetku sukses 100%!");
  process.exit(0);
}

run();
