export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { userId, profileId, type, notes, attachmentUrl, photoUrl, status, location, initialCash, workShiftId } = await req.json();

    if (!userId || !type) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    let finalLateMinutes = 0;
    let targetWorkShiftId = workShiftId || null;

    // HANYA HITUNG KETERLAMBATAN JIKA INI ADALAH CHECK-IN
    if (type === 'check_in' && profileId) {
      try {
        // 1. Tarik Toleransi & Jadwal Kerja Terkait
        const [setRes, assignsRes] = await Promise.all([
          supabaseAdmin.from('restaurant_settings').select('late_tolerance_minutes').single(),
          supabaseAdmin.from('work_shift_assignments').select('*, work_shifts(*), substitute_for:substitute_for_profile_id(full_name)').eq('profile_id', profileId)
        ]);

        const tolerance = setRes.data?.late_tolerance_minutes || 15;
        const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
        
        // Dapatkan jam server sekarang di WIB (Waktu Indonesia Barat) - Menggunakan offset locale
        const now = new Date();
        const todayIndoName = dayNames[now.getDay()];
        const todayISO = now.toLocaleDateString('sv-SE');

        // Temukan shift yang sesuai hari ini (Prioritas: Yang dikirim CLIENT, lalu Cek Tanggal Pengganti, lalu Hari Rutin)
        let matchedShift = null;
        
        if (workShiftId) {
           //  JIKA CLIENT MENGIRIM ID, PAKAI ITU LANGSUNG!
           matchedShift = assignsRes.data?.find((a: any) => a.work_shift_id === workShiftId);
        } else {
           // Fallback cerdas (Mengecek Pengganti hari ini lalu Shift Reguler)
           matchedShift = assignsRes.data?.find((a: any) => a.substitute_date === todayISO) || 
                          assignsRes.data?.find((a: any) => a.work_shifts?.days?.includes(todayIndoName));
        }

        if (matchedShift?.work_shifts) {
          targetWorkShiftId = matchedShift.work_shifts.id;
          const [sh, sm] = matchedShift.work_shifts.start_time.split(':').map(Number);
          
          const targetTime = new Date(now);
          targetTime.setHours(sh, sm, 0, 0);

          //  PENYEMBUH BUG SHIFT MALAM (Midnight Cross Fix):
          // Menjamin data absensi dini hari esok pagi/nanti tidak dianggap terlambat parah.
          if (now.getTime() - targetTime.getTime() > 12 * 60 * 60 * 1000) {
             targetTime.setDate(targetTime.getDate() + 1);
          }

          const diffMs = now.getTime() - targetTime.getTime();
          if (diffMs > 0) {
            const elapsedMins = Math.floor(diffMs / (1000 * 60));
            // Jika lebih dari toleransi, catat sebagai terlambat!
            if (elapsedMins > tolerance) {
              finalLateMinutes = elapsedMins;
            }
          }
        }
      } catch (errCalc) {
        console.error("Gagal menghitung keterlambatan server-side, fallback 0:", errCalc);
      }
    }

    // PEMBUAT CATATAN OTOMATIS KARYAWAN PENGGANTI
    let finalNotes = notes || null;
    const todayObjStr = new Date().toLocaleDateString('sv-SE');
    
    // Cek daftar penugasan untuk mencocokkan dengan targetWorkShiftId jika ada untuk mengecek status substitute-nya!
    if (targetWorkShiftId && profileId) {
       const { data: finalMatch } = await supabaseAdmin
         .from('work_shift_assignments')
         .select('*, substitute_for:substitute_for_profile_id(full_name)')
         .eq('profile_id', profileId)
         .eq('work_shift_id', targetWorkShiftId)
         .maybeSingle();

       if (finalMatch?.is_substitute || finalMatch?.substitute_date === todayObjStr) {
          const replName = finalMatch?.substitute_for?.full_name;
          const subLabel = replName ? `[KARYAWAN PENGGANTI Menggantikan ${replName}]` : `[KARYAWAN PENGGANTI]`;
          finalNotes = finalNotes ? `${subLabel} ${finalNotes}` : subLabel;
       }
    }

    const { error } = await supabaseAdmin
      .from('attendance')
      .insert({
        user_id: userId,
        profile_id: profileId,
        type: type,
        notes: finalNotes,
        attachment_url: attachmentUrl || null,
        photo_url: photoUrl || null,
        status: status || 'pending',
        location: location || 'Restoran (Cabang Utama)',
        late_minutes: finalLateMinutes,
        work_shift_id: targetWorkShiftId
      });

    if (error) throw error;

    // Jika ini adalah check_in, buka juga shift-nya secara otomatis
    if (type === 'check_in') {
      const { data: shift, error: shiftError } = await supabaseAdmin
        .from('shifts')
        .insert({
          user_id: userId,
          profile_id: profileId,
          start_time: new Date().toISOString(),
          initial_cash: parseFloat(initialCash) || 0,
          status: 'open',
          work_shift_id: targetWorkShiftId
        })
        .select()
        .single();
      
      if (shiftError) throw shiftError;

      return NextResponse.json({ 
        success: true, 
        message: 'Absensi & Buka Shift Berhasil', 
        shiftId: shift.id,
        lateMinutes: finalLateMinutes 
      });
    }

    return NextResponse.json({ success: true, message: 'Data absensi berhasil disimpan' });
  } catch (error: any) {
    console.error('Attendance API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
