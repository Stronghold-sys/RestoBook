-- Add column to profiles to track price tampering attempts
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS price_tampering_attempts INT DEFAULT 0;

-- Create security_price_tampering_logs table
CREATE TABLE IF NOT EXISTS public.security_price_tampering_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    original_price_database NUMERIC(12, 2) NOT NULL,
    manipulated_price NUMERIC(12, 2) NOT NULL,
    endpoint TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_sec_price_tamper_user ON public.security_price_tampering_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sec_price_tamper_created ON public.security_price_tampering_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.security_price_tampering_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Admin view all security_price_tampering_logs" ON public.security_price_tampering_logs;
CREATE POLICY "Admin view all security_price_tampering_logs" ON public.security_price_tampering_logs 
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Service role full access security_price_tampering_logs" ON public.security_price_tampering_logs;
CREATE POLICY "Service role full access security_price_tampering_logs" ON public.security_price_tampering_logs 
    USING (auth.role() = 'service_role');
