import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const supabase = supabaseAdmin;

  const { data: periods } = await supabase.from('salary_periods').select('*').order('created_at', {ascending:false}).limit(3);
  const { data: records } = await supabase.from('salary_records').select('*').order('updated_at', {ascending:false}).limit(10);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    periods_found: periods?.length || 0,
    periods,
    records_found: records?.length || 0,
    records
  });
}
