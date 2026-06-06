export const runtime = 'edge';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {

    const sql = `
      -- 1. FORCE APPLY ALL MISSING COLUMNS (IDEMPOTENT)
      ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS suspension_time TIMESTAMPTZ;
      ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS employee_decision TEXT;
      ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS decision_recorded_at TIMESTAMPTZ;
      ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS is_finalized BOOLEAN DEFAULT FALSE;
      ALTER TABLE IF EXISTS resign_requests ADD COLUMN IF NOT EXISTS wa_suspended_sent BOOLEAN DEFAULT FALSE;
      
      -- 2. REPAIR RESTRICTIVE STATUS CONSTRAINT
      -- First, forcefully drop ANY existing check constraint that limits status
      ALTER TABLE IF EXISTS resign_requests DROP CONSTRAINT IF EXISTS resign_requests_status_check;
      
      -- Then, create the modern, expanded constraint that permits 'Dibatalkan'
      ALTER TABLE IF EXISTS resign_requests 
      ADD CONSTRAINT resign_requests_status_check 
      CHECK (status IN ('Menunggu', 'Disetujui', 'Ditolak', 'Dibatalkan'));

      -- 3. CREATE WALLET AUDIT LOGS TABLE
      CREATE TABLE IF NOT EXISTS wallet_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
        action_type TEXT CHECK (action_type IN ('status_change', 'balance_change', 'internal_note')) NOT NULL,
        before_value TEXT,
        after_value TEXT,
        reason TEXT NOT NULL,
        acted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        internal_note TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );

      -- Enable RLS
      ALTER TABLE wallet_audit_logs ENABLE ROW LEVEL SECURITY;

      -- Enable Realtime (Idempotent: Drop first, then add)
      ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS wallet_audit_logs;
      ALTER PUBLICATION supabase_realtime ADD TABLE wallet_audit_logs;

      -- Policies for RLS
      DROP POLICY IF EXISTS "Users can select own wallet logs" ON wallet_audit_logs;
      DROP POLICY IF EXISTS "Admin full access wallet logs" ON wallet_audit_logs;
      
      CREATE POLICY "Users can select own wallet logs" ON wallet_audit_logs FOR SELECT USING (customer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
      CREATE POLICY "Admin full access wallet logs" ON wallet_audit_logs FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

      -- 4. CREATE GOOGLE CALENDAR CREDENTIALS TABLE
      CREATE TABLE IF NOT EXISTS google_calendar_credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        calendar_id TEXT,
        timezone TEXT DEFAULT 'Asia/Jakarta',
        credentials_json JSONB,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      -- Enable RLS
      ALTER TABLE google_calendar_credentials ENABLE ROW LEVEL SECURITY;

      -- Policies for RLS
      DROP POLICY IF EXISTS "Admin full access calendar credentials" ON google_calendar_credentials;
      CREATE POLICY "Admin full access calendar credentials" ON google_calendar_credentials FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'));

      -- 5. ADD CALENDAR TRACKING COLUMNS TO RESERVATIONS TABLE
      ALTER TABLE reservations ADD COLUMN IF NOT EXISTS google_event_id TEXT;
      ALTER TABLE reservations ADD COLUMN IF NOT EXISTS sync_status TEXT CHECK (sync_status IN ('pending', 'synced', 'failed', 'updated', 'cancelled')) DEFAULT 'pending';
      ALTER TABLE reservations ADD COLUMN IF NOT EXISTS sync_error TEXT;

      -- 6. RELOAD CACHE
      NOTIFY pgrst, 'reload schema';
    `;

    // Execute the custom SQL handler via RPC
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_string: sql });

    if (error) {
      return NextResponse.json({ 
        success: false, 
        message: 'Operasi RPC gagal. Kemungkinan fungsi exec_sql tidak tersedia di database Anda.',
        error: error.message
      }, { status: 500 });
    }

    // Final check: Verify what columns actually exist now!
    const check = await supabaseAdmin.from('resign_requests').select('*').limit(1);
    const finalColumns = check.data?.[0] ? Object.keys(check.data[0]) : "Tidak bisa membaca baris";

    return NextResponse.json({ 
      success: true, 
      message: 'BERHASIL! Kolom baru telah dipaksa masuk ke database!',
      available_columns: finalColumns
    });

  } catch (err: any) {
    return NextResponse.json({ 
      success: false, 
      message: 'Fatal Exception occurred during route execution.',
      error: err.message 
    }, { status: 500 });
  }
}
