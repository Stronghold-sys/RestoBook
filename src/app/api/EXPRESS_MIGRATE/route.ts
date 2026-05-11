import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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

      -- 3. RELOAD CACHE
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
