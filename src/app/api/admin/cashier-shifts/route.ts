export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/admin/cashier-shifts
 * Mengambil seluruh sesi shift kasir beserta data profile karyawan.
 * Menggunakan supabaseAdmin (Service Role Key) untuk bypass RLS.
 * Join dilakukan secara manual via user_id karena FK ke profiles mungkin belum terdefinisi.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Ambil semua shift
    const { data: shifts, error: shiftError } = await supabaseAdmin
      .from('shifts')
      .select('*')
      .order('created_at', { ascending: false });

    if (shiftError) {
      console.error('Error fetching shifts:', shiftError);
      throw shiftError;
    }

    if (!shifts || shifts.length === 0) {
      return NextResponse.json({ success: true, shifts: [] });
    }

    // 2. Kumpulkan semua user_id dan profile_id yang unik
    const userIds = Array.from(new Set(shifts.map((s: any) => s.user_id).filter(Boolean))) as string[];
    const profileIds = Array.from(new Set(shifts.map((s: any) => s.profile_id).filter(Boolean))) as string[];

    // 3. Ambil profiles berdasarkan user_id (fallback ke profile_id jika ada)
    const profileMap: Record<string, any> = {};

    if (userIds.length > 0) {
      const { data: profilesByUser } = await supabaseAdmin
        .from('profiles')
        .select('id, user_id, full_name, role, employee_id, avatar_url')
        .in('user_id', userIds);

      if (profilesByUser) {
        for (const p of profilesByUser) {
          if (p.user_id) profileMap[p.user_id] = p;
          if (p.id) profileMap[`pid_${p.id}`] = p;
        }
      }
    }

    // Jika profile_id tersedia tapi belum di-map via user_id, coba lookup via id langsung
    if (profileIds.length > 0) {
      const unmappedProfileIds = profileIds.filter((pid: string) => !profileMap[`pid_${pid}`]);
      if (unmappedProfileIds.length > 0) {
        const { data: profilesById } = await supabaseAdmin
          .from('profiles')
          .select('id, user_id, full_name, role, employee_id, avatar_url')
          .in('id', unmappedProfileIds);

        if (profilesById) {
          for (const p of profilesById) {
            if (p.id) profileMap[`pid_${p.id}`] = p;
            if (p.user_id) profileMap[p.user_id] = p;
          }
        }
      }
    }

    // 4. Gabungkan data: cari profile untuk setiap shift
    const enrichedShifts = shifts.map((shift: any) => {
      const profile =
        (shift.user_id && profileMap[shift.user_id]) ||
        (shift.profile_id && profileMap[`pid_${shift.profile_id}`]) ||
        null;

      return {
        ...shift,
        profiles: profile
          ? {
              full_name: profile.full_name,
              role: profile.role,
              employee_id: profile.employee_id,
              avatar_url: profile.avatar_url,
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, shifts: enrichedShifts });
  } catch (error: any) {
    console.error('GET /api/admin/cashier-shifts error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
