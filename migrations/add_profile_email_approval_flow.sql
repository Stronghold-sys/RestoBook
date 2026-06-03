-- 1. Drop check constraint support_tickets_status_check
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_status_check;

-- 2. Re-create support_tickets_status_check with approved and rejected
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_status_check 
CHECK (status IN ('pending', 'processing', 'waiting_info', 'approved', 'rejected', 'completed', 'closed', 'expired'));

-- 3. Add email_unlocked column to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_unlocked BOOLEAN DEFAULT false;

-- 4. Create profile_audit_logs table
CREATE TABLE IF NOT EXISTS profile_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,
    ticket_number TEXT,
    category TEXT,
    customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    old_email TEXT,
    new_email TEXT,
    status_before TEXT,
    status_after TEXT,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enable RLS for profile_audit_logs
ALTER TABLE profile_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. Policy: Admins can do everything
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profile_audit_logs' AND policyname='Admins can view all audit logs') THEN
    CREATE POLICY "Admins can view all audit logs" ON profile_audit_logs FOR ALL
      USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

-- 7. Policy: Customers can view their own audit logs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profile_audit_logs' AND policyname='Customers can view own audit logs') THEN
    CREATE POLICY "Customers can view own audit logs" ON profile_audit_logs FOR SELECT
      USING (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
  END IF;
END $$;

-- 8. Policy: Service role full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='profile_audit_logs' AND policyname='Service role full access audit logs') THEN
    CREATE POLICY "Service role full access audit logs" ON profile_audit_logs FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 9. Add profile_audit_logs to supabase_realtime publication
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profile_audit_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profile_audit_logs;
  END IF;
END $$;
