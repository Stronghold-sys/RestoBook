/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dazsblmccvxtewtmaljf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("MEMULAI MIGRASI ESTIMASI WAKTU PESANAN...");
  const sql = `
    -- 1. Create order_estimation_settings table
    CREATE TABLE IF NOT EXISTS public.order_estimation_settings (
      id UUID PRIMARY KEY DEFAULT '88888888-8888-8888-8888-888888888888'::uuid,
      dine_in_default_minutes INT NOT NULL DEFAULT 15,
      takeaway_default_minutes INT NOT NULL DEFAULT 20,
      delivery_default_minutes INT NOT NULL DEFAULT 30,
      pickup_default_minutes INT NOT NULL DEFAULT 20,
      min_minutes INT NOT NULL DEFAULT 5,
      max_minutes INT NOT NULL DEFAULT 120,
      busy_multiplier_minutes INT NOT NULL DEFAULT 10,
      per_item_addition_minutes INT NOT NULL DEFAULT 2,
      delivery_per_km_minutes INT NOT NULL DEFAULT 5,
      is_busy_active BOOLEAN NOT NULL DEFAULT false,
      is_auto_estimation_active BOOLEAN NOT NULL DEFAULT true,
      is_warning_active BOOLEAN NOT NULL DEFAULT true,
      is_auto_late_active BOOLEAN NOT NULL DEFAULT true,
      is_distance_estimation_active BOOLEAN NOT NULL DEFAULT true,
      is_item_addition_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- 2. Insert default row if not exists
    INSERT INTO public.order_estimation_settings (id)
    VALUES ('88888888-8888-8888-8888-888888888888'::uuid)
    ON CONFLICT (id) DO NOTHING;

    -- 3. Add columns to orders table
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_duration_minutes INT DEFAULT NULL;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_delivery_duration_minutes INT DEFAULT NULL;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimation_status TEXT DEFAULT NULL CHECK (estimation_status IN ('tepat_waktu', 'terlambat'));
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS actual_duration_minutes INT DEFAULT NULL;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimation_started_at TIMESTAMPTZ DEFAULT NULL;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimation_completed_at TIMESTAMPTZ DEFAULT NULL;

    -- 4. Enable RLS on order_estimation_settings
    ALTER TABLE public.order_estimation_settings ENABLE ROW LEVEL SECURITY;

    -- 5. Drop policies if exist and create them
    DROP POLICY IF EXISTS "Anyone can view order estimation settings" ON public.order_estimation_settings;
    CREATE POLICY "Anyone can view order estimation settings" ON public.order_estimation_settings
      FOR SELECT USING (true);

    DROP POLICY IF EXISTS "Admin can manage order estimation settings" ON public.order_estimation_settings;
    CREATE POLICY "Admin can manage order estimation settings" ON public.order_estimation_settings
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE user_id = auth.uid() AND role = 'admin'
        )
      );

    -- 6. Add order_estimation_settings to publication for realtime sync
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'order_estimation_settings') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE order_estimation_settings;
      END IF;
    END $$;

    NOTIFY pgrst, 'reload schema';
  `;
  
  console.log("Mengirim query migrasi ke database...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
    console.error("Gagal melalui RPC utama:", error.message);
    const { error: err2 } = await supabase.rpc('exec_sql_block', { sql_string: sql });
    if (err2) {
      console.error("Gagal juga di exec_sql_block:", err2.message);
      process.exit(1);
    } else {
      console.log("Berhasil melalui jalur alternatif exec_sql_block!");
    }
  } else {
    console.log("Migrasi sukses 100%!");
  }
  process.exit(0);
}
run();
