export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    return await processAutoAlpha();
  } catch (error: any) {
    console.error('Attendance cron GET error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await processAutoAlpha();
  } catch (error: any) {
    console.error('Attendance cron POST error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function processAutoAlpha() {
  // 1. Dapatkan waktu sekarang di Asia/Jakarta (WIB)
  const nowJakarta = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const todayStr = nowJakarta.getFullYear() + '-' + 
    String(nowJakarta.getMonth() + 1).padStart(2, '0') + '-' + 
    String(nowJakarta.getDate()).padStart(2, '0');

  // 1.5. Cek apakah fitur auto-alpha diaktifkan oleh admin
  const { data: settingsData } = await supabaseAdmin
    .from('restaurant_settings')
    .select('auto_alpha_enabled')
    .single();

  if (settingsData && settingsData.auto_alpha_enabled === false) {
    return NextResponse.json({ 
      success: true, 
      message: 'Fitur auto-alpha dinonaktifkan oleh admin. Tidak ada tindakan yang diambil.',
      processed_count: 0,
      marked_alpha: [],
      deleted_orphan_alpha: []
    });
  }

  // 2. Tentukan rentang pengecekan (14 hari ke belakang hingga kemarin)
  const pastDates: { dateStr: string; dayName: string }[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date(nowJakarta);
    d.setDate(d.getDate() - i);
    const dStr = d.getFullYear() + '-' + 
      String(d.getMonth() + 1).padStart(2, '0') + '-' + 
      String(d.getDate()).padStart(2, '0');
    
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    pastDates.push({
      dateStr: dStr,
      dayName: dayNames[d.getDay()]
    });
  }

  // 3. Tarik data profil karyawan aktif (role admin/cashier, work_status aktif)
  const { data: profiles, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .in('role', ['admin', 'cashier'])
    .eq('work_status', 'aktif');

  if (profileErr) throw profileErr;
  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ success: true, message: 'Tidak ada karyawan aktif untuk diperiksa.', marked_alpha: [] });
  }

  // 4. Tarik data penugasan shift kerja (sertakan created_at untuk validasi retroaktif)
  const { data: assignments, error: assignErr } = await supabaseAdmin
    .from('work_shift_assignments')
    .select('*, work_shifts(*), created_at');

  if (assignErr) throw assignErr;

  // 5. Tarik seluruh data absensi 15 hari terakhir
  const startDate = new Date(nowJakarta);
  startDate.setDate(startDate.getDate() - 15);
  const startDateStr = startDate.getFullYear() + '-' + 
    String(startDate.getMonth() + 1).padStart(2, '0') + '-' + 
    String(startDate.getDate()).padStart(2, '0') + 'T00:00:00+07:00';

  const { data: attendances, error: attErr } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .gte('created_at', startDateStr);

  if (attErr) throw attErr;

  // Map absensi untuk pencarian cepat: key = profile_id + '_' + dateStr (dalam Asia/Jakarta)
  const attendanceMap: Record<string, any[]> = {};
  
  const getJakartaDateStr = (createdAtStr: string) => {
    const d = new Date(createdAtStr);
    const local = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    return local.getFullYear() + '-' + 
      String(local.getMonth() + 1).padStart(2, '0') + '-' + 
      String(local.getDate()).padStart(2, '0');
  };

  if (attendances) {
    for (const att of attendances) {
      if (!att.profile_id) continue;
      const dateStr = getJakartaDateStr(att.created_at);
      const key = `${att.profile_id}_${dateStr}`;
      if (!attendanceMap[key]) {
        attendanceMap[key] = [];
      }
      attendanceMap[key].push(att);
    }
  }

  const markedAlphaList: any[] = [];

  // 6. Evaluasi setiap karyawan pada setiap tanggal kerja di masa lalu
  for (const profile of profiles) {
    for (const { dateStr, dayName } of pastDates) {
      // a. Tentukan apakah ada jadwal kerja
      // Cari penugasan pengganti (substitute) khusus tanggal ini
      const subAssignment = assignments?.find(
        (a: any) => a.profile_id === profile.id && 
             a.substitute_date === dateStr && 
             a.is_substitute === true
      );

      // Cari penugasan reguler (substitute_date bernilai null dan hari cocok)
      const regAssignment = assignments?.find(
        (a: any) => a.profile_id === profile.id && 
             a.substitute_date === null && 
             a.work_shifts?.days?.includes(dayName)
      );

      // Cek apakah karyawan ini digantikan oleh orang lain pada tanggal ini
      const isReplaced = assignments?.some(
        (a: any) => a.substitute_for_profile_id === profile.id && 
             a.substitute_date === dateStr
      );

      let scheduledShift = null;
      let activeAssignment = null;
      if (subAssignment) {
        scheduledShift = subAssignment.work_shifts;
        activeAssignment = subAssignment;
      } else if (regAssignment && !isReplaced) {
        scheduledShift = regAssignment.work_shifts;
        activeAssignment = regAssignment;
      }

      // Jika tidak ada jadwal kerja pada tanggal tersebut, lanjut
      if (!scheduledShift || !activeAssignment) continue;

      // PROTEKSI RETROAKTIF: Jangan tandai ALPHA untuk tanggal SEBELUM karyawan/assignment dibuat.
      // Ini mencegah karyawan baru mendapat ALPHA untuk hari-hari sebelum mereka bergabung.
      const assignmentCreatedDate = activeAssignment.created_at
        ? activeAssignment.created_at.split('T')[0]
        : null;
      const profileCreatedDate = profile.created_at
        ? profile.created_at.split('T')[0]
        : null;

      // Ambil tanggal terbaru antara assignment dibuat dan profil dibuat
      const earliestValidDate = assignmentCreatedDate && profileCreatedDate
        ? (assignmentCreatedDate > profileCreatedDate ? assignmentCreatedDate : profileCreatedDate)
        : (assignmentCreatedDate || profileCreatedDate || '2000-01-01');

      if (dateStr < earliestValidDate) continue; // Lewati jika tanggal lebih awal dari bergabung

      // b. Cek rekaman absensi pada tanggal dateStr
      const key = `${profile.id}_${dateStr}`;
      const records = attendanceMap[key] || [];

      // Cek apakah sudah ada status ALPHA
      const isAlreadyAlpha = records.some((r: any) => r.type === 'alpha');
      if (isAlreadyAlpha) continue;

      // Cek absensi masuk/keluar (valid)
      const hasCheckedInOrOut = records.some((r: any) => r.type === 'check_in' || r.type === 'check_out');
      if (hasCheckedInOrOut) continue;

      // Cek apakah memiliki izin atau sakit (pending, approved, atau completed - bukan rejected)
      const hasValidLeaveOrSick = records.some(
        (r: any) => (r.type === 'izin' || r.type === 'sakit') && 
             ['pending', 'approved', 'completed'].includes(r.status)
      );
      if (hasValidLeaveOrSick) continue;

      // c. Jika tidak ada rekaman sama sekali, ubah status otomatis menjadi ALPHA
      const alphaCreatedAt = `${dateStr}T23:59:59+07:00`; // WIB

      // Insert ke tabel attendance
      const { error: insertErr } = await supabaseAdmin
        .from('attendance')
        .insert({
          user_id: profile.user_id,
          profile_id: profile.id,
          type: 'alpha',
          status: 'approved',
          notes: 'Tidak melakukan absensi hingga melewati akhir hari kerja',
          location: 'Restoran (Cabang Utama)',
          created_at: alphaCreatedAt,
          late_minutes: 0,
          work_shift_id: scheduledShift.id
        });

      if (insertErr) {
        console.error(`Gagal membuat rekaman ALPHA untuk ${profile.full_name} pada ${dateStr}:`, insertErr);
        continue;
      }

      // Insert ke tabel audit_logs
      const auditLogData = {
        employee_id: profile.employee_id || '-',
        employee_name: profile.full_name,
        work_date: dateStr,
        start_time: scheduledShift.start_time,
        end_time: scheduledShift.end_time,
        system_updated_at: new Date().toISOString(),
        old_status: 'BELUM DIPROSES',
        new_status: 'ALPHA',
        reason: 'Tidak melakukan absensi hingga melewati akhir hari kerja'
      };

      const { error: auditErr } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          action: 'auto_alpha',
          operator_id: null,
          operator_name: 'System Automated Scheduler',
          target_id: profile.id,
          target_name: profile.full_name,
          data_before: null,
          data_after: auditLogData,
          ip_address: '127.0.0.1',
          browser: 'System Cron Job',
          device: 'Server'
        });

      if (auditErr) {
        console.error(`Gagal membuat audit log ALPHA untuk ${profile.full_name} pada ${dateStr}:`, auditErr);
      }

      markedAlphaList.push({
        employee_id: profile.employee_id,
        employee_name: profile.full_name,
        date: dateStr,
        shift_name: scheduledShift.name
      });
    }
  }

  // =====================================================================
  // 7. PEMBERSIHAN ALPHA ORPHAN (sesuai chatboot.md):
  // Hapus record alpha yang jadwal kerjanya sudah tidak berlaku lagi
  // (misalnya admin menghapus shift, atau karyawan tidak lagi ditugaskan).
  // =====================================================================
  const deletedAlphaList: any[] = [];

  if (attendances) {
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

    // Kumpulkan semua record alpha dari 15 hari terakhir
    const alphaRecords = attendances.filter((att: any) => att.type === 'alpha' && att.profile_id);

    for (const alphaRecord of alphaRecords) {
      // Dapatkan tanggal alpha dalam format WIB (YYYY-MM-DD)
      const alphaDateStr = getJakartaDateStr(alphaRecord.created_at);

      // Dapatkan nama hari dalam Bahasa Indonesia untuk tanggal alpha
      const alphaDateObj = new Date(alphaRecord.created_at);
      const alphaLocalObj = new Date(alphaDateObj.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
      const alphaDayName = dayNames[alphaLocalObj.getDay()];

      // Cari profil karyawan yang bersangkutan (harus aktif dan sudah di-load)
      const alphaProfile = profiles.find((p: any) => p.id === alphaRecord.profile_id);
      if (!alphaProfile) {
        // Profil tidak ditemukan di daftar aktif → alpha ini orphan, hapus
        await supabaseAdmin.from('attendance').delete().eq('id', alphaRecord.id);
        deletedAlphaList.push({ id: alphaRecord.id, reason: 'profile_not_active' });
        continue;
      }

      // Evaluasi ulang apakah karyawan ini memiliki jadwal valid pada tanggal alpha tersebut
      const subAssignmentCheck = assignments?.find(
        (a: any) => a.profile_id === alphaRecord.profile_id &&
             a.substitute_date === alphaDateStr &&
             a.is_substitute === true
      );
      const regAssignmentCheck = assignments?.find(
        (a: any) => a.profile_id === alphaRecord.profile_id &&
             a.substitute_date === null &&
             a.work_shifts?.days?.includes(alphaDayName)
      );
      const isReplacedCheck = assignments?.some(
        (a: any) => a.substitute_for_profile_id === alphaRecord.profile_id &&
             a.substitute_date === alphaDateStr
      );

      let hasValidSchedule = !!(subAssignmentCheck || (regAssignmentCheck && !isReplacedCheck));
      let activeAssignment = null;
      if (subAssignmentCheck) {
        activeAssignment = subAssignmentCheck;
      } else if (regAssignmentCheck && !isReplacedCheck) {
        activeAssignment = regAssignmentCheck;
      }

      let isBeforeEarliestDate = false;
      let earliestDateReason = '';
      if (activeAssignment) {
        const assignmentCreatedDate = activeAssignment.created_at
          ? activeAssignment.created_at.split('T')[0]
          : null;
        const profileCreatedDate = alphaProfile.created_at
          ? alphaProfile.created_at.split('T')[0]
          : null;

        const earliestValidDate = assignmentCreatedDate && profileCreatedDate
          ? (assignmentCreatedDate > profileCreatedDate ? assignmentCreatedDate : profileCreatedDate)
          : (assignmentCreatedDate || profileCreatedDate || '2000-01-01');

        if (alphaDateStr < earliestValidDate) {
          isBeforeEarliestDate = true;
          earliestDateReason = `Tanggal alpha (${alphaDateStr}) sebelum bergabung/mulai penugasan terawal (${earliestValidDate})`;
        }
      }

      // Jika tidak ada jadwal valid pada tanggal itu ATAU tanggal alpha mendahului shift/profil dibuat → alpha ini adalah ORPHAN → hapus!
      if (!hasValidSchedule || isBeforeEarliestDate) {
        const deleteReason = isBeforeEarliestDate 
          ? earliestDateReason 
          : 'Jadwal kerja dihapus oleh admin atau karyawan tidak lagi ditugaskan';

        const { error: delAlphaErr } = await supabaseAdmin
          .from('attendance')
          .delete()
          .eq('id', alphaRecord.id);

        if (!delAlphaErr) {
          // Catat penghapusan ke audit_logs
          await supabaseAdmin.from('audit_logs').insert({
            action: 'delete_orphan_alpha',
            operator_id: null,
            operator_name: 'System Automated Scheduler',
            target_id: alphaRecord.profile_id,
            target_name: alphaProfile.full_name,
            data_before: {
              attendance_id: alphaRecord.id,
              date: alphaDateStr,
              reason: deleteReason
            },
            data_after: null,
            ip_address: '127.0.0.1',
            browser: 'System Cron Job',
            device: 'Server'
          });

          deletedAlphaList.push({
            employee_name: alphaProfile.full_name,
            date: alphaDateStr,
            reason: isBeforeEarliestDate ? 'before_earliest_date' : 'no_valid_schedule'
          });
        } else {
          console.error(`Gagal menghapus alpha orphan ID ${alphaRecord.id}:`, delAlphaErr);
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: `Selesai memproses kehadiran. Berhasil menandai ${markedAlphaList.length} status ALPHA baru. Berhasil membersihkan ${deletedAlphaList.length} alpha tidak valid.`,
    processed_count: markedAlphaList.length,
    marked_alpha: markedAlphaList,
    deleted_orphan_alpha: deletedAlphaList
  });
}
