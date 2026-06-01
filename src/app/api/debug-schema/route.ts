import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.rpc('exec_sql', {
      sql_string: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders';"
    });
    
    return NextResponse.json({ success: true, columns: data || [], error });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
