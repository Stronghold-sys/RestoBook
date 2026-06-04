export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/admin/employees
 * Mengambil semua profil karyawan (admin + cashier) dengan jadwal kerja.
 * Menggunakan supabaseAdmin (Service Role Key) untuk bypass RLS.
 */
export async function GET(req: NextRequest) {
  try {
    // QUERY 1: Ambil semua profil karyawan aktif beserta jadwal kerja
    const { data: profilesData, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select(`
        *,
        work_shift_assignments!work_shift_assignments_profile_id_fkey(
          *,
          work_shifts(*)
        )
      `)
      .in('role', ['admin', 'cashier'])
      .order('full_name');

    if (profileErr) {
      console.error('Error fetching profiles:', profileErr);
      throw profileErr;
    }

    // QUERY 2: Ambil absensi hari ini menggunakan timezone WIB
    const nowWIB = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const todayStr = nowWIB.getFullYear() + '-' +
      String(nowWIB.getMonth() + 1).padStart(2, '0') + '-' +
      String(nowWIB.getDate()).padStart(2, '0');

    const { data: todayAttendance } = await supabaseAdmin
      .from('attendance')
      .select('id, type, created_at, photo_url, status, profile_id')
      .gte('created_at', `${todayStr}T00:00:00+07:00`)
      .lt('created_at', `${todayStr}T23:59:59+07:00`)
      .order('created_at', { ascending: false });

    // MERGE: Gabungkan data attendance ke dalam profil masing-masing
    const merged = (profilesData || []).map((emp: any) => ({
      ...emp,
      attendance: (todayAttendance || []).filter((a: any) => a.profile_id === emp.id)
    }));

    return NextResponse.json({ success: true, employees: merged });
  } catch (error: any) {
    console.error('GET /api/admin/employees error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
