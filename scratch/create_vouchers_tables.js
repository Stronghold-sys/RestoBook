/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dazsblmccvxtewtmaljf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhenNibG1jY3Z4dGV3dG1hbGpmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTY0MDAzMiwiZXhwIjoyMDc3MjE2MDMyfQ.BJGL1qaJqpsnqr28NT3--sQD_WEJ__SU0sKkJhHwyOQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("MEMULAI MIGRASI STRUKTUR TABEL VOUCHER...");
  
  const sql = `
    -- Create vouchers table
    CREATE TABLE IF NOT EXISTS public.vouchers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT UNIQUE NOT NULL,
      discount_percent INT NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
      usage_limit INT NOT NULL DEFAULT 100,
      max_usage_per_user INT NOT NULL DEFAULT 1,
      used_count INT NOT NULL DEFAULT 0,
      expires_at TIMESTAMPTZ NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Create customer_vouchers table
    CREATE TABLE IF NOT EXISTS public.customer_vouchers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
      voucher_id UUID REFERENCES public.vouchers(id) ON DELETE CASCADE NOT NULL,
      used_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(customer_id, voucher_id)
    );

    -- Add columns to orders table if they don't exist
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS voucher_id UUID REFERENCES public.vouchers(id) ON DELETE SET NULL;
    ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount DECIMAL(12,2) DEFAULT 0;

    -- Enable RLS
    ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.customer_vouchers ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Admin full access vouchers" ON public.vouchers;
    DROP POLICY IF EXISTS "Anyone can view active vouchers" ON public.vouchers;
    DROP POLICY IF EXISTS "Admin full access customer_vouchers" ON public.customer_vouchers;
    DROP POLICY IF EXISTS "Customer view own vouchers" ON public.customer_vouchers;
    DROP POLICY IF EXISTS "Service role full access vouchers" ON public.vouchers;
    DROP POLICY IF EXISTS "Service role full access customer_vouchers" ON public.customer_vouchers;

    -- Create policies
    -- Vouchers policies
    CREATE POLICY "Admin full access vouchers" ON public.vouchers 
      FOR ALL 
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

    CREATE POLICY "Anyone can view active vouchers" ON public.vouchers
      FOR SELECT
      USING (is_active = true);

    -- Customer vouchers policies
    CREATE POLICY "Admin full access customer_vouchers" ON public.customer_vouchers
      FOR ALL
      USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'))
      WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

    CREATE POLICY "Customer view own vouchers" ON public.customer_vouchers
      FOR SELECT
      USING (customer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

    -- Service role full access
    CREATE POLICY "Service role full access vouchers" ON public.vouchers USING (auth.role() = 'service_role');
    CREATE POLICY "Service role full access customer_vouchers" ON public.customer_vouchers USING (auth.role() = 'service_role');

    -- Enable Realtime
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'vouchers') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE vouchers;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'customer_vouchers') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE customer_vouchers;
      END IF;
    END $$;

    -- Trigger update updated_at
    DROP TRIGGER IF EXISTS update_vouchers_updated_at ON public.vouchers;
    CREATE TRIGGER update_vouchers_updated_at BEFORE UPDATE ON public.vouchers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
        console.log("MIGRASI SUKSES MELALUI JALUR ALTERNATIF!");
     }
  } else {
     console.log("MIGRASI SUKSES MELALUI RPC UTAMA!");
  }
  
  process.exit(0);
}

run();
