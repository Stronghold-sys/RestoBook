export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { userId, profileId, type, notes, attachmentUrl } = await req.json();

    if (!userId || !type || !notes) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // =====================================================================
    // VALIDASI JADWAL KERJA HARI INI (sesuai chatboot.md):
    // Sistem tidak boleh memproses izin/sakit jika karyawan tidak punya jadwal.
    // =====================================================================
    if (profileId) {
      // Dapatkan waktu WIB (Asia/Jakarta) untuk hari ini
      const nowWIB = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
      const todayStr = nowWIB.getFullYear() + '-' +
        String(nowWIB.getMonth() + 1).padStart(2, '0') + '-' +
        String(nowWIB.getDate()).padStart(2, '0');
      const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const todayIndoName = dayNames[nowWIB.getDay()];

      // Ambil semua penugasan shift karyawan ini
      const { data: assignments } = await supabaseAdmin
        .from('work_shift_assignments')
        .select('*, work_shifts(*)')
        .eq('profile_id', profileId);

      if (assignments) {
        // Cek penugasan pengganti (substitute) untuk hari ini
        const subAssignment = assignments.find(
          (a: any) => a.substitute_date === todayStr && a.is_substitute === true
        );
        // Cek penugasan reguler (hari cocok dan tidak sedang digantikan)
        const regAssignment = assignments.find(
          (a: any) => a.substitute_date === null && a.work_shifts?.days?.includes(todayIndoName)
        );
        // Cek apakah karyawan ini sedang digantikan orang lain hari ini
        const isReplaced = assignments.some(
          (a: any) => a.substitute_for_profile_id === profileId && a.substitute_date === todayStr
        );

        const hasScheduleToday = !!(subAssignment || (regAssignment && !isReplaced));

        if (!hasScheduleToday) {
          return NextResponse.json({
            error: 'Anda tidak memiliki jadwal kerja hari ini. Pengajuan izin tidak diperlukan — status Anda sudah "TIDAK ADA JADWAL" (Libur).'
          }, { status: 400 });
        }
      }
    }

    const { error } = await supabaseAdmin
      .from('attendance')
      .insert({
        user_id: userId,
        profile_id: profileId,
        type: type,
        notes: notes,
        attachment_url: attachmentUrl,
        status: 'pending'
      });

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Pengajuan izin berhasil terkirim' });
  } catch (error: any) {
    console.error('Leave request error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
