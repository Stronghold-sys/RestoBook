export const runtime = 'edge';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const supabase = supabaseAdmin;

    // 1. Dapatkan data Profile ID dulu
    const { data: profile } = await supabase.from('profiles').select('id, full_name').eq('user_id', userId).maybeSingle();
    
    // Skip check

    // 2. Lakukan query persis seperti di Dashboard tapi dengan Service Role (Bypass RLS)
    let query = supabase.from('work_shift_assignments').select('*, work_shifts(*)');
    
    if (profile) {
      query = query.eq('profile_id', profile.id);
    }

    const { data: assigns, error } = await query;

    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const todayIndoName = dayNames[new Date().getDay()];

    return NextResponse.json({
      success: true,
      profile: profile || "Listing ALL data",
      today: todayIndoName,
      assignments_count: assigns?.length || 0,
      assignments: assigns,
      query_error: error,
      note: "Jika ini mengembalikan data, tapi Dashboard kosong, berarti RLS (Izin) memblokir Browser Kasir!"
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
