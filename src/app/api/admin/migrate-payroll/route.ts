export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  try {
    // Using Supabase RPC 'exec_sql' or fallback to create table checks
    // Attempt to add column directly via SQL Execute if available, 
    // otherwise check existence by trying to select it.
    
    // Safe alternative: run SQL to ensure column exists
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: "ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS late_count INTEGER DEFAULT 0;"
    });

    if (error) {
      // If exec_sql fails, we can try an indirect alter using another pattern or check existing
      console.error("Migration Error via RPC:", error);
      return NextResponse.json({ 
        success: false, 
        error: error.message, 
        msg: "ExecSQL RPC might not be present. Attempting static column fetch check..." 
      });
    }

    return NextResponse.json({ 
       success: true, 
       message: "Kolom late_count berhasil dipastikan ada di tabel salary_records!" 
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
