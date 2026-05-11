import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ hasOpenShift: false, error: 'No User ID' });
    }

    // 0. IMMUNIZATION: Cek Role User, jika Admin maka Buka Kunci Otomatis 100%
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (profile?.role === 'admin') {
      return NextResponse.json({ success: true, hasOpenShift: true });
    }

    // 1. Cek apakah sedang ada data shift fisik yang berstatus 'open' (Sedang bertugas)
    const { data: activeOpenShift } = await supabaseAdmin
      .from('shifts')
      .select('id, work_shift_id')
      .eq('user_id', userId)
      .eq('status', 'open')
      .maybeSingle();

    // Jika ADA shift yang sedang terbuka secara fisik di mesin kasir, MAKA MUTLAK UNLOCKED!
    if (activeOpenShift) {
       let endTime = null;
       if (activeOpenShift.work_shift_id) {
          const { data: ws } = await supabaseAdmin.from('work_shifts').select('end_time').eq('id', activeOpenShift.work_shift_id).maybeSingle();
          endTime = ws?.end_time || null;
       }
       return NextResponse.json({ success: true, hasOpenShift: true, endTime });
    }

    // --- JIKA TIDAK ADA SHIFT OPEN, CEK JADWAL YANG MENANTI (TERMASUK PENGGANTI) ---

    // 2. Tarik SEMUA penugasan hari ini
    const { data: profileRaw } = await supabaseAdmin.from('profiles').select('id').eq('user_id', userId).single();
    if (!profileRaw) {
      return NextResponse.json({ hasOpenShift: false, error: 'Profile not found' });
    }
    const { data: assignments } = await supabaseAdmin
      .from('work_shift_assignments')
      .select('*, work_shifts(*)')
      .eq('profile_id', profileRaw.id);

    // 3. Hitung kandidat shift aktif hari ini
    const todayObj = new Date();
    const todayISOStr = todayObj.toLocaleDateString('sv-SE');
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const todayIndoName = dayNames[todayObj.getDay()];

    const activeCandidates = (assignments || []).filter((a: any) => {
       if (a.substitute_date === todayISOStr) return true;
       if (!a.substitute_date && a.work_shifts?.days) {
          return a.work_shifts.days.includes(todayIndoName) || a.work_shifts.days.includes(todayIndoName.slice(0,3));
       }
       return false;
    });

    // 4. Tarik semua checkout hari ini
    todayObj.setHours(0,0,0,0);
    const { data: checkOuts } = await supabaseAdmin
      .from('attendance')
      .select('work_shift_id')
      .eq('user_id', userId)
      .eq('type', 'check_out')
      .gte('created_at', todayObj.toISOString());

    const completedIds = (checkOuts || []).map(c => c.work_shift_id).filter(Boolean);

    // 5. CARI APAKAH MASIH ADA SHIFT PENDING YANG BELUM DISELESAIKAN HARI INI?
    const pendingAssignment = activeCandidates.find(a => !completedIds.includes(a.work_shift_id));

    // BUKA GEMBOK JIKA DITEMUKAN ADA JADWAL HARI INI YANG BELUM DIKERJAKAN!
    const isUnlocked = !!pendingAssignment;
    let individualShiftEndTime = pendingAssignment?.work_shifts?.end_time || null;

    return NextResponse.json({
      success: true,
      hasOpenShift: isUnlocked,
      endTime: individualShiftEndTime
    });

  } catch (error: any) {
    console.error("Lock Status API Err:", error);
    return NextResponse.json({ hasOpenShift: false }, { status: 500 });
  }
}
