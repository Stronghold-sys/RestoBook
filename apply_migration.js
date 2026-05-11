/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dazsblmccvxtewtmaljf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("MEMULAI OPERASI FORCE-UNLOCK DATABASE...");
  const sql = `
    ALTER TABLE IF EXISTS public.work_shifts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.work_shift_assignments ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "All operations allowed by anyone" ON public.work_shifts;
    CREATE POLICY "All operations allowed by anyone" ON public.work_shifts FOR ALL USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "All operations allowed by anyone" ON public.work_shift_assignments;
    CREATE POLICY "All operations allowed by anyone" ON public.work_shift_assignments FOR ALL USING (true) WITH CHECK (true);

    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'work_shifts') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE work_shifts;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'work_shift_assignments') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE work_shift_assignments;
      END IF;
    END $$;
    
    NOTIFY pgrst, 'reload schema';
  `;
  
  console.log("Mengirim Perintah Paksa ke Core Database...");
  
  // Eksekusi via exec_sql RPC yang dimiliki Service Role
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
     console.error("GAGAL MELALUI RPC UTAMA:", error.message);
     console.log("Mencoba Jalur Alternatif (exec_sql_block)...");
     const { error: err2 } = await supabase.rpc('exec_sql_block', { sql_string: sql });
     if (err2) {
        console.error("Semuanya Gagal. Mohon periksa fungsi RPC di Dashboard Supabase.");
     } else {
        console.log("SUKSES BESAR MELALUI JALUR ALTERNATIF! Gembok Shift Resmi Dihancurkan!");
     }
  } else {
     console.log("SUKSES MUTLAK 100%! Database Resmi Terbuka Lebar untuk Tabel Shift!");
  }
  
  process.exit(0);
}
run();
