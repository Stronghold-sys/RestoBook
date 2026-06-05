-- 1. Tabel Log Keamanan (security_logs)
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    full_name TEXT,
    ip_address TEXT NOT NULL,
    browser TEXT,
    device TEXT,
    user_agent TEXT,
    activity TEXT NOT NULL, -- e.g., 'LOGIN_FAILED', 'LOGIN_SUCCESS', 'ACCOUNT_LOCKED', 'RATE_LIMIT_EXCEEDED', 'SUSPICIOUS_ACTIVITY', 'OTP_REQUEST', 'PASSWORD_RESET', 'DDOS_ATTEMPT'
    endpoint TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    status TEXT NOT NULL -- 'success', 'failed', 'blocked'
);

-- Indeks performa log
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON public.security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_activity ON public.security_logs(activity);
CREATE INDEX IF NOT EXISTS idx_security_logs_ip ON public.security_logs(ip_address);

-- 2. Tabel Reputasi IP (security_ip_rules)
CREATE TABLE IF NOT EXISTS public.security_ip_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL UNIQUE,
    rule_type TEXT CHECK (rule_type IN ('blacklist', 'whitelist')) NOT NULL,
    reason TEXT,
    expires_at TIMESTAMPTZ, -- NULL berarti permanen
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indeks reputasi IP
CREATE INDEX IF NOT EXISTS idx_security_ip_rules_ip ON public.security_ip_rules(ip_address);

-- 3. Tabel Detail Aturan Pemblokiran (security_block_rules)
CREATE TABLE IF NOT EXISTS public.security_block_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_type TEXT CHECK (field_type IN ('email', 'browser', 'device')) NOT NULL,
    value TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (field_type, value)
);

-- Indeks aturan pemblokiran
CREATE INDEX IF NOT EXISTS idx_security_block_rules_val ON public.security_block_rules(field_type, value);

-- 4. Tabel Histori Geolokasi Login (security_login_locations)
CREATE TABLE IF NOT EXISTS public.security_login_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    country TEXT NOT NULL,
    city TEXT NOT NULL,
    first_detected_at TIMESTAMPTZ DEFAULT now(),
    last_detected_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (profile_id, country, city)
);

-- 5. Tambahkan Kolom Keamanan di Tabel Profiles (jika belum ada)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_attempt_at TIMESTAMPTZ DEFAULT NULL;

-- 6. Aktifkan RLS pada tabel-tabel baru
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_ip_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_block_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_login_locations ENABLE ROW LEVEL SECURITY;

-- 7. Kebijakan RLS (Row Level Security Policies)
-- security_logs
DROP POLICY IF EXISTS "Admin view all security_logs" ON public.security_logs;
CREATE POLICY "Admin view all security_logs" ON public.security_logs 
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Service role full access security_logs" ON public.security_logs;
CREATE POLICY "Service role full access security_logs" ON public.security_logs 
    USING (auth.role() = 'service_role');

-- security_ip_rules
DROP POLICY IF EXISTS "Admin manage security_ip_rules" ON public.security_ip_rules;
CREATE POLICY "Admin manage security_ip_rules" ON public.security_ip_rules 
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Anyone read white_blacklist" ON public.security_ip_rules;
CREATE POLICY "Anyone read white_blacklist" ON public.security_ip_rules
    FOR SELECT USING (true); -- Izinkan middleware membaca reputasi IP

DROP POLICY IF EXISTS "Service role full access security_ip_rules" ON public.security_ip_rules;
CREATE POLICY "Service role full access security_ip_rules" ON public.security_ip_rules 
    USING (auth.role() = 'service_role');

-- security_block_rules
DROP POLICY IF EXISTS "Admin manage security_block_rules" ON public.security_block_rules;
CREATE POLICY "Admin manage security_block_rules" ON public.security_block_rules 
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Anyone read block_rules" ON public.security_block_rules;
CREATE POLICY "Anyone read block_rules" ON public.security_block_rules
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role full access security_block_rules" ON public.security_block_rules;
CREATE POLICY "Service role full access security_block_rules" ON public.security_block_rules 
    USING (auth.role() = 'service_role');

-- security_login_locations
DROP POLICY IF EXISTS "Admin view all security_login_locations" ON public.security_login_locations;
CREATE POLICY "Admin view all security_login_locations" ON public.security_login_locations 
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "User view own login_locations" ON public.security_login_locations;
CREATE POLICY "User view own login_locations" ON public.security_login_locations 
    FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service role full access security_login_locations" ON public.security_login_locations;
CREATE POLICY "Service role full access security_login_locations" ON public.security_login_locations 
    USING (auth.role() = 'service_role');

-- 8. Registrasikan ke Realtime Publication
-- Cek apakah tabel sudah dipublikasikan ke realtime, jika belum tambahkan.
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'security_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE security_logs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'security_ip_rules') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE security_ip_rules;
  END IF;
END $$;
