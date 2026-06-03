const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dazsblmccvxtewtmaljf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("RUNNING MAINTENANCE SCHEMAS MIGRATION...");
  const sql = `
    -- Maintenance columns on restaurant_settings
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS is_maintenance_active BOOLEAN DEFAULT FALSE;
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS maintenance_start_time TIMESTAMP WITH TIME ZONE;
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS maintenance_end_time TIMESTAMP WITH TIME ZONE;
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS maintenance_message TEXT DEFAULT 'Sistem sedang dalam perbaikan untuk meningkatkan layanan. Sementara ini, proses transaksi dan pembayaran belum dapat digunakan. Silakan coba kembali nanti.';
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS maintenance_estimated_hours TEXT DEFAULT '2 Jam';

    -- Create Maintenance Logs Table if not exists
    CREATE TABLE IF NOT EXISTS maintenance_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action TEXT NOT NULL, -- 'activate', 'deactivate'
      acted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
      acted_by_name TEXT,
      message TEXT,
      scheduled_start TIMESTAMP WITH TIME ZONE,
      scheduled_end TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    ALTER TABLE IF EXISTS maintenance_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "auth_maintenance_logs_all" ON maintenance_logs;
    CREATE POLICY "auth_maintenance_logs_all" ON maintenance_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Enable Realtime
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'maintenance_logs') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE maintenance_logs;
      END IF;
    END $$;

    NOTIFY pgrst, 'reload schema';
  `;
  
  console.log("Sending query to database...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
     console.error("RPC UTAMA FAILED:", error.message);
     console.log("Attempting fallback...");
     const { error: err2 } = await supabase.rpc('exec_sql_block', { sql_string: sql });
     if (err2) {
        console.error("All channels failed:", err2.message);
     } else {
        console.log("SUCCESS via fallback!");
     }
  } else {
     console.log("SUCCESS via RPC exec_sql!");
  }
  
  process.exit(0);
}
run();
