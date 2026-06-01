export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;




export async function GET() {
  const results: any[] = [];

  // ==========================================
  // GLOBAL EMOJI ANNIHILATION ROBOT (OFFLINE ON EDGE)
  // ==========================================
  try {
    results.push({ action: 'global_emoji_eradication', status: 'skipped', note: 'Disabled for Cloudflare compatibility' });
  } catch(err: any) {
    results.push({ action: 'global_emoji_eradication', status: 'failed', error: err.message });
  }
  // ==========================================

  // 1. CREATE BUCKET VIA API (FAST)
  try {
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const exists = buckets?.find((b: any) => b.id === 'profiles');

    if (!exists) {
      await supabaseAdmin.storage.createBucket('profiles', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880
      });
      results.push({ action: 'create_bucket', status: 'ok' });
    } else {
      results.push({ action: 'check_bucket_profiles', status: 'exists' });
    }

    const existsLogos = buckets?.find((b: any) => b.id === 'logos');
    if (!existsLogos) {
      await supabaseAdmin.storage.createBucket('logos', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
        fileSizeLimit: 2097152 // 2MB Limit for logos
      });
      results.push({ action: 'create_bucket_logos', status: 'ok' });
    } else {
      results.push({ action: 'check_bucket_logos', status: 'exists' });
    }
  } catch (e: any) {
    results.push({ action: 'create_bucket', status: 'error', note: e.message });
  }

  // 2. COMBINED SQL STATEMENTS (EFFICIENT)
  const sqlBlock = `
    -- Drop payment method constraint to allow new types (QRIS, E-Wallet, etc.)
    ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

    -- Update order_type constraint to allow 'delivery'
    ALTER TABLE IF EXISTS orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
    ALTER TABLE IF EXISTS orders ADD CONSTRAINT orders_order_type_check CHECK (order_type IN ('dine_in', 'takeaway', 'delivery'));

    -- Ensure salary_records has late minutes tracking
    ALTER TABLE IF EXISTS salary_records ADD COLUMN IF NOT EXISTS total_late_minutes INTEGER DEFAULT 0;
    ALTER TABLE IF EXISTS salary_records ADD COLUMN IF NOT EXISTS late_deduction NUMERIC DEFAULT 0;
    ALTER TABLE IF EXISTS salary_records ADD COLUMN IF NOT EXISTS late_count INTEGER DEFAULT 0;

    -- Ensure profiles has essential columns
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'customer';
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS employee_id TEXT;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS status_karyawan TEXT DEFAULT 'aktif';
    UPDATE profiles SET status_karyawan = 'aktif' WHERE status_karyawan IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS profiles_employee_id_key ON profiles(employee_id);
    
    -- SYNC EMAILS from auth.users to profiles for better visibility
    UPDATE profiles p SET email = u.email FROM auth.users u WHERE p.user_id = u.id AND (p.email IS NULL OR p.email = '');

    -- Ensure orders has cashier_id to track who processed the order
    ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS cashier_id UUID REFERENCES profiles(id);
    ALTER TABLE IF EXISTS orders ALTER COLUMN payment_method TYPE TEXT;
    
    -- Add cancel_reason column if not exists
    ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

    -- Ensure restaurant_settings has overrides for operational status
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS is_temporary_closed BOOLEAN DEFAULT FALSE;
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS is_holiday BOOLEAN DEFAULT FALSE;
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS holiday_reopen_date TEXT DEFAULT 'Besok';
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS temporary_closed_reopen_time TEXT DEFAULT '12:00';
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS is_24_hours BOOLEAN DEFAULT FALSE;
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS close_warning_minutes INT DEFAULT 10;
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS customer_warning_minutes INT DEFAULT 15;
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS shift_closing_buffer_minutes INT DEFAULT 30;
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS logo_url TEXT;
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS payday_date INT DEFAULT 28;
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS cutoff_date INT DEFAULT 27;
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS is_auto_close_shift_enabled BOOLEAN DEFAULT TRUE;
    ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS tax_percent NUMERIC DEFAULT 10.00;

    -- Create Notifications Table if not exists
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create Resign Requests Table if not exists
    CREATE TABLE IF NOT EXISTS resign_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
      employee_id TEXT,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      division TEXT DEFAULT 'Operasional',
      effective_date DATE NOT NULL,
      reason TEXT NOT NULL,
      additional_notes TEXT,
      status TEXT CHECK (status IN ('Menunggu Konfirmasi', 'Disetujui', 'Ditolak')) DEFAULT 'Menunggu Konfirmasi',
      admin_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Enable RLS on all tables
    ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS order_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS categories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS menu_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS tables ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS resign_requests ENABLE ROW LEVEL SECURITY;

    -- Drop and recreate essential policies
    DROP POLICY IF EXISTS "auth_orders_all" ON orders;
    CREATE POLICY "auth_orders_all" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "auth_order_items_all" ON order_items;
    CREATE POLICY "auth_order_items_all" ON order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "auth_profiles_select" ON profiles;
    DROP POLICY IF EXISTS "auth_profiles_update" ON profiles;
    DROP POLICY IF EXISTS "auth_profiles_all" ON profiles;
    CREATE POLICY "auth_profiles_all" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "auth_notifications_all" ON notifications;
    CREATE POLICY "auth_notifications_all" ON notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "auth_resign_requests_all" ON resign_requests;
    CREATE POLICY "auth_resign_requests_all" ON resign_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Policy for Customer to update (cancel) their own reservations
    DROP POLICY IF EXISTS "Customer update own reservations" ON reservations;
    CREATE POLICY "Customer update own reservations" ON reservations FOR UPDATE TO authenticated 
      USING (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())) 
      WITH CHECK (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
      
    -- Policy for Admin to manage all reservations
    DROP POLICY IF EXISTS "Admin manage reservations" ON reservations;
    CREATE POLICY "Admin manage reservations" ON reservations FOR ALL TO authenticated 
      USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin')) 
      WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

    -- Drop and recreate menu_items and categories policies
    DROP POLICY IF EXISTS "Anyone can view active menu" ON menu_items;
    DROP POLICY IF EXISTS "Anyone can view all menu" ON menu_items;
    DROP POLICY IF EXISTS "Admin full access menu" ON menu_items;
    DROP POLICY IF EXISTS "Admin and Cashier full access menu" ON menu_items;
    
    CREATE POLICY "Anyone can view all menu" ON menu_items FOR SELECT USING (true);
    CREATE POLICY "Admin and Cashier full access menu" ON menu_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'cashier'))) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'cashier')));

    DROP POLICY IF EXISTS "Anyone can view active categories" ON categories;
    DROP POLICY IF EXISTS "Anyone can view all categories" ON categories;
    DROP POLICY IF EXISTS "Admin full access categories" ON categories;
    DROP POLICY IF EXISTS "Admin and Cashier full access categories" ON categories;

    CREATE POLICY "Anyone can view all categories" ON categories FOR SELECT USING (true);
    CREATE POLICY "Admin and Cashier full access categories" ON categories FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'cashier'))) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'cashier')));    -- Drop and recreate tables policies
    DROP POLICY IF EXISTS "Anyone can view tables" ON tables;
    DROP POLICY IF EXISTS "Admin full access tables" ON tables;
    DROP POLICY IF EXISTS "Cashier can update tables" ON tables;
    DROP POLICY IF EXISTS "auth_tables_all" ON tables;

    CREATE POLICY "auth_tables_all" ON tables FOR ALL TO authenticated USING (true) WITH CHECK (true);
    -- Enable Realtime
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE orders;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'order_items') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reservations') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'favorites') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE favorites;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tables') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE tables;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'menu_items') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE menu_items;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'categories') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE categories;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'restaurant_settings') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_settings;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'resign_requests') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE resign_requests;
      END IF;
    END $$;

    -- Phase 1.1: profiles table additions (banking & salary components)
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS daily_salary DECIMAL(12,2) DEFAULT 75000;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS overtime_pay_per_hour DECIMAL(12,2) DEFAULT 10000;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS fixed_allowance DECIMAL(12,2) DEFAULT 0;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS payment_method_preference TEXT DEFAULT 'tunai';
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS bank_name TEXT;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS bank_account_holder TEXT;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS bank_branch TEXT;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS e_wallet_name TEXT;
    ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS e_wallet_number TEXT;

    -- Phase 1.2: resign_requests table additions
    ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS suspension_time TIMESTAMPTZ;
    ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS employee_decision TEXT DEFAULT 'menunggu';
    ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS decision_recorded_at TIMESTAMPTZ;
    ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT FALSE;
    ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS wa_suspended_sent BOOLEAN DEFAULT FALSE;

    -- Create salary_components table (Transactions like bon and denda)
    CREATE TABLE IF NOT EXISTS salary_components (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
      type TEXT CHECK (type IN ('bon', 'denda', 'bonus', 'tunjangan')) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      notes TEXT,
      status TEXT CHECK (status IN ('active', 'processed')) DEFAULT 'active',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    -- EMERGENCY REPAIR: ADD MISSING COLUMN TO OLD SHIFTS TABLE
    DO $$ 
    BEGIN 
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shifts' AND column_name='work_shift_id') THEN
        ALTER TABLE IF EXISTS public.shifts ADD COLUMN work_shift_id UUID REFERENCES public.work_shifts(id) ON DELETE SET NULL;
      END IF;
    END $$;

    -- FORCE ENABLE RLS AND APPLY UNLIMITED ACCESS POLICIES
    ALTER TABLE IF EXISTS public.salary_periods ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.salary_records ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.employee_kasbon ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.employee_fines ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.work_shifts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.work_shift_assignments ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "All operations allowed by anyone" ON public.salary_periods;
    CREATE POLICY "All operations allowed by anyone" ON public.salary_periods FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "All operations allowed by anyone" ON public.salary_records;
    CREATE POLICY "All operations allowed by anyone" ON public.salary_records FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "All operations allowed by anyone" ON public.employee_kasbon;
    CREATE POLICY "All operations allowed by anyone" ON public.employee_kasbon FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "All operations allowed by anyone" ON public.employee_fines;
    CREATE POLICY "All operations allowed by anyone" ON public.employee_fines FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "All operations allowed by anyone" ON public.work_shifts;
    CREATE POLICY "All operations allowed by anyone" ON public.work_shifts FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "All operations allowed by anyone" ON public.work_shift_assignments;
    CREATE POLICY "All operations allowed by anyone" ON public.work_shift_assignments FOR ALL USING (true) WITH CHECK (true);

    -- Create salary_history table (Finalized monthly slips)
    CREATE TABLE IF NOT EXISTS salary_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
      month INT NOT NULL,
      year INT NOT NULL,
      total_days_worked INT DEFAULT 0,
      total_days_leave INT DEFAULT 0,
      total_days_alpha INT DEFAULT 0,
      total_hours_overtime DECIMAL(12,2) DEFAULT 0,
      daily_salary_rate DECIMAL(12,2) DEFAULT 75000,
      base_salary DECIMAL(12,2) DEFAULT 0,
      total_bon DECIMAL(12,2) DEFAULT 0,
      total_denda DECIMAL(12,2) DEFAULT 0,
      total_bonus DECIMAL(12,2) DEFAULT 0,
      total_allowance DECIMAL(12,2) DEFAULT 0,
      net_salary DECIMAL(12,2) DEFAULT 0,
      is_transferred BOOLEAN DEFAULT FALSE,
      transfer_date TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    ALTER TABLE IF EXISTS salary_history ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "auth_salary_history_all" ON salary_history;
    CREATE POLICY "auth_salary_history_all" ON salary_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

    -- Ensure realtime is enabled on new tables
    DO $$ 
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'salary_components') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE salary_components;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'salary_history') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE salary_history;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'work_shifts') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE work_shifts;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'work_shift_assignments') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE work_shift_assignments;
      END IF;
    END $$;

    -- Force reload schema cache for PostgREST
    NOTIFY pgrst, 'reload schema';
  `;

  try {
    // TRY PRIMARY RPC
    let { error } = await supabaseAdmin.rpc('exec_sql', { sql_string: sqlBlock });

    // EMERGENCY FALLBACK (Detect secondary valid handler)
    if (error) {
      console.log("exec_sql failed, attempting exec_sql_block fallback...");
      const { error: fallbackError } = await supabaseAdmin.rpc('exec_sql_block', { sql_string: sqlBlock });
      error = fallbackError;
    }

    if (error) {
      results.push({ action: 'exec_sql_block', status: 'rpc_failed', note: error.message });
    } else {
      results.push({ action: 'exec_sql_block', status: 'ok' });
    }

    // NEW: SIMULATION RUN OF ADMIN QUERY
    const { data: testShifts, error: testErr } = await supabaseAdmin
      .from('work_shifts')
      .select(`
        *,
        work_shift_assignments(
          id, 
          profile_id, 
          profiles:profiles!work_shift_assignments_profile_id_fkey(full_name, employee_id, avatar_url)
        )
      `)
      .order('created_at', { ascending: false });

    results.push({
       action: 'simulation_run',
       data_count: testShifts?.length || 0,
       sample_data: testShifts?.slice(0, 2),
       error_found: testErr || null
    });
  } catch (e: any) {
    results.push({ action: 'exec_sql_block', status: 'catch_error', note: e.message });
  }

  // 3. VERIFY COLUMNS
  let columns: any[] = [];
  try {
    const { data } = await supabaseAdmin.rpc('exec_sql', {
      sql_string: "SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles';"
    });
    columns = data || [];
  } catch (e) { }

  return NextResponse.json({
    success: true,
    message: 'Extreme database fix attempted.',
    results,
    current_profiles_columns: columns
  });
}
