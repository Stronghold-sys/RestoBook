-- 1. Tabel Pengaturan Keamanan (security_settings)
CREATE TABLE IF NOT EXISTS public.security_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    emergency_mode BOOLEAN DEFAULT false NOT NULL,
    global_captcha_required BOOLEAN DEFAULT false NOT NULL,
    block_new_registrations BOOLEAN DEFAULT false NOT NULL,
    block_sensitive_endpoints BOOLEAN DEFAULT false NOT NULL,
    tightened_rate_limits BOOLEAN DEFAULT false NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default row if empty
INSERT INTO public.security_settings (emergency_mode, global_captcha_required, block_new_registrations, block_sensitive_endpoints, tightened_rate_limits)
SELECT false, false, false, false, false
WHERE NOT EXISTS (SELECT 1 FROM public.security_settings);

-- 2. Tabel Nonces Pencegahan Replay Attack (security_nonces)
CREATE TABLE IF NOT EXISTS public.security_nonces (
    nonce TEXT PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_nonces_expires ON public.security_nonces(expires_at);

-- 3. Tabel Sesi Keamanan Pengguna (security_user_sessions)
CREATE TABLE IF NOT EXISTS public.security_user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id TEXT UNIQUE NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    browser_fingerprint TEXT,
    country TEXT,
    city TEXT,
    asn TEXT,
    timezone TEXT,
    last_active_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_user_sessions_profile ON public.security_user_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_security_user_sessions_sid ON public.security_user_sessions(session_id);

-- 4. Tabel Detail Insiden Keamanan (security_incidents)
CREATE TABLE IF NOT EXISTS public.security_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    fingerprint TEXT,
    asn TEXT,
    country TEXT,
    city TEXT,
    endpoint TEXT,
    payload TEXT,
    attack_type TEXT NOT NULL, -- e.g., 'SQLI', 'XSS', 'SSRF', 'TRAVERSAL', 'REPLAY', 'VPN', 'SESSION_HIJACK', 'ROTATING_IP', 'CREDENTIAL_STUFFING', 'WEBHOOK_ABUSE', 'HEADLESS_BROWSER'
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_incidents_created ON public.security_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_incidents_ip ON public.security_incidents(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON public.security_incidents(attack_type);

-- Enable RLS
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admin view and modify security_settings" ON public.security_settings;
DROP POLICY IF EXISTS "Anyone read security_settings" ON public.security_settings;
DROP POLICY IF EXISTS "Service role full access security_settings" ON public.security_settings;

DROP POLICY IF EXISTS "Service role access nonces" ON public.security_nonces;

DROP POLICY IF EXISTS "Admin view all security_user_sessions" ON public.security_user_sessions;
DROP POLICY IF EXISTS "User view own security_user_sessions" ON public.security_user_sessions;
DROP POLICY IF EXISTS "Service role full access security_user_sessions" ON public.security_user_sessions;

DROP POLICY IF EXISTS "Admin view security_incidents" ON public.security_incidents;
DROP POLICY IF EXISTS "Service role full access security_incidents" ON public.security_incidents;

-- Create Policies

-- security_settings
CREATE POLICY "Anyone read security_settings" ON public.security_settings 
    FOR SELECT USING (true);
CREATE POLICY "Admin view and modify security_settings" ON public.security_settings 
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Service role full access security_settings" ON public.security_settings 
    USING (auth.role() = 'service_role');

-- security_nonces
CREATE POLICY "Service role access nonces" ON public.security_nonces 
    USING (auth.role() = 'service_role');

-- security_user_sessions
CREATE POLICY "Admin view all security_user_sessions" ON public.security_user_sessions 
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "User view own security_user_sessions" ON public.security_user_sessions 
    FOR SELECT USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access security_user_sessions" ON public.security_user_sessions 
    USING (auth.role() = 'service_role');

-- security_incidents
CREATE POLICY "Admin view security_incidents" ON public.security_incidents 
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Service role full access security_incidents" ON public.security_incidents 
    USING (auth.role() = 'service_role');

-- Register to Supabase Realtime
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'security_settings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE security_settings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'security_incidents') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE security_incidents;
  END IF;
END $$;
