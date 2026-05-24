/* eslint-disable */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("MEMULAI MIGRASI SUSPEN DAN BAN...");
  const sql = `
    -- 1. Tambah kolom suspen di tabel profiles
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspend_reason TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspend_message TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspend_until TIMESTAMPTZ;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspend_type TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS just_restored BOOLEAN DEFAULT false;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS scheduled_suspend_at TIMESTAMPTZ;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS warning_count INT DEFAULT 0;

    -- 2. Buat tabel suspend_logs
    CREATE TABLE IF NOT EXISTS public.suspend_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      reason TEXT,
      message TEXT,
      duration TEXT,
      suspend_until TIMESTAMPTZ,
      acted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      acted_at TIMESTAMPTZ DEFAULT now()
    );

    -- RLS untuk suspend_logs
    ALTER TABLE public.suspend_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Admin full access suspend_logs" ON public.suspend_logs;
    CREATE POLICY "Admin full access suspend_logs" ON public.suspend_logs FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));
    DROP POLICY IF EXISTS "Users can view own suspend_logs" ON public.suspend_logs;
    CREATE POLICY "Users can view own suspend_logs" ON public.suspend_logs FOR SELECT USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

    -- 3. Buat tabel appeals (banding)
    CREATE TABLE IF NOT EXISTS public.appeals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      admin_message TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- RLS untuk appeals
    ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Admin full access appeals" ON public.appeals;
    CREATE POLICY "Admin full access appeals" ON public.appeals FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));
    DROP POLICY IF EXISTS "Users can view and create own appeals" ON public.appeals;
    CREATE POLICY "Users can view and create own appeals" ON public.appeals FOR SELECT USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
    DROP POLICY IF EXISTS "Users can insert own appeals" ON public.appeals;
    CREATE POLICY "Users can insert own appeals" ON public.appeals FOR INSERT WITH CHECK (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

    -- 4. Aktifkan Realtime di Supabase
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'appeals') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE appeals;
      END IF;
    END $$;
    
    NOTIFY pgrst, 'reload schema';
  `;
  
  console.log("Mengirim perintah SQL...");
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
     console.error("RPC exec_sql gagal:", error.message);
     console.log("Mencoba exec_sql_block...");
     const { data: data2, error: err2 } = await supabase.rpc('exec_sql_block', { sql_string: sql });
     if (err2) {
        console.error("Semua alternatif gagal:", err2.message);
     } else {
        console.log("Migrasi sukses besar melalui exec_sql_block!");
     }
  } else {
     console.log("Migrasi sukses melalui exec_sql!");
  }
  process.exit(0);
}
run();
