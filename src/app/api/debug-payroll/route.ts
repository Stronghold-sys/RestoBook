import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
