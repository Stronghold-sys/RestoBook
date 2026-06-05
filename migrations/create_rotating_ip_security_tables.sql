-- 1. Tabel Pelacak IP per Sidik Jari (security_fingerprint_ips)
CREATE TABLE IF NOT EXISTS public.security_fingerprint_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    country TEXT,
    city TEXT,
    asn TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indeks performa pelacakan sidik jari
CREATE INDEX IF NOT EXISTS idx_sec_fp_ips_fp ON public.security_fingerprint_ips(fingerprint);
CREATE INDEX IF NOT EXISTS idx_sec_fp_ips_ip ON public.security_fingerprint_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_sec_fp_ips_created ON public.security_fingerprint_ips(created_at DESC);

-- 2. Tabel Pelacak Subnet yang Diblokir Sementara (security_subnet_blocks)
CREATE TABLE IF NOT EXISTS public.security_subnet_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subnet TEXT NOT NULL UNIQUE, -- e.g., '192.168.1.0/24'
    reason TEXT,
    blocked_until TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sec_subnet_blocks_subnet ON public.security_subnet_blocks(subnet);
CREATE INDEX IF NOT EXISTS idx_sec_subnet_blocks_expiry ON public.security_subnet_blocks(blocked_until);

-- 3. Tabel Pelacak Pola Aktivitas Ringan (security_request_signatures)
CREATE TABLE IF NOT EXISTS public.security_request_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    subnet TEXT NOT NULL,
    asn TEXT,
    endpoint TEXT NOT NULL,
    payload_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sec_req_sig_fp ON public.security_request_signatures(fingerprint);
CREATE INDEX IF NOT EXISTS idx_sec_req_sig_ip ON public.security_request_signatures(ip_address);
CREATE INDEX IF NOT EXISTS idx_sec_req_sig_subnet ON public.security_request_signatures(subnet);
CREATE INDEX IF NOT EXISTS idx_sec_req_sig_asn ON public.security_request_signatures(asn);
CREATE INDEX IF NOT EXISTS idx_sec_req_sig_endpoint ON public.security_request_signatures(endpoint);
CREATE INDEX IF NOT EXISTS idx_sec_req_sig_created ON public.security_request_signatures(created_at DESC);

-- 4. Aktifkan RLS
ALTER TABLE public.security_fingerprint_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_subnet_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_request_signatures ENABLE ROW LEVEL SECURITY;

-- 5. Buat Kebijakan RLS (Row Level Security Policies)
-- security_fingerprint_ips
DROP POLICY IF EXISTS "Admin view security_fingerprint_ips" ON public.security_fingerprint_ips;
CREATE POLICY "Admin view security_fingerprint_ips" ON public.security_fingerprint_ips 
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Service role full access security_fingerprint_ips" ON public.security_fingerprint_ips;
CREATE POLICY "Service role full access security_fingerprint_ips" ON public.security_fingerprint_ips 
    USING (auth.role() = 'service_role');

-- security_subnet_blocks
DROP POLICY IF EXISTS "Anyone read security_subnet_blocks" ON public.security_subnet_blocks;
CREATE POLICY "Anyone read security_subnet_blocks" ON public.security_subnet_blocks 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manage security_subnet_blocks" ON public.security_subnet_blocks;
CREATE POLICY "Admin manage security_subnet_blocks" ON public.security_subnet_blocks 
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Service role full access security_subnet_blocks" ON public.security_subnet_blocks;
CREATE POLICY "Service role full access security_subnet_blocks" ON public.security_subnet_blocks 
    USING (auth.role() = 'service_role');

-- security_request_signatures
DROP POLICY IF EXISTS "Admin view security_request_signatures" ON public.security_request_signatures;
CREATE POLICY "Admin view security_request_signatures" ON public.security_request_signatures 
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Service role full access security_request_signatures" ON public.security_request_signatures;
CREATE POLICY "Service role full access security_request_signatures" ON public.security_request_signatures 
    USING (auth.role() = 'service_role');

-- 6. Registrasikan ke Realtime Publication
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'security_subnet_blocks') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE security_subnet_blocks;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'security_fingerprint_ips') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE security_fingerprint_ips;
  END IF;
END $$;
