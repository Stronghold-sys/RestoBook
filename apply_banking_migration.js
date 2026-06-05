/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://dazsblmccvxtewtmaljf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Membaca file SQL migrasi perbankan...");
  const sqlPath = path.join(__dirname, 'migrations', 'create_banking_grade_tables.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log("Mengirim skema keamanan tingkat lanjut ke Database Supabase...");
  
  // Eksekusi via exec_sql RPC
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
     console.error("GAGAL MELALUI RPC UTAMA:", error.message);
     console.log("Mencoba Jalur Alternatif (exec_sql_block)...");
     const { error: err2 } = await supabase.rpc('exec_sql_block', { sql_string: sql });
     if (err2) {
        console.error("Semuanya Gagal. Mohon periksa fungsi RPC di Dashboard Supabase atau jalankan SQL secara manual.");
        process.exit(1);
     } else {
        console.log("SUKSES BESAR MELALUI JALUR ALTERNATIF! Migrasi Keamanan Selesai.");
     }
  } else {
     console.log("SUKSES MUTLAK! Tabel-tabel keamanan tingkat lanjut berhasil dibuat.");
  }
  
  process.exit(0);
}
run();
