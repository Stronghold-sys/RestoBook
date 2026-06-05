export const runtime = 'edge';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) return NextResponse.json({ success: false, error: "Missing user ID" });

    const supabase = supabaseAdmin; // Menggunakan admin client yang sudah aman

    //  SHADOW MIGRATOR: Upgrade Database secara instan di latar belakang (Hanya sekali running)
    try {
       await supabase.rpc('exec_sql', { 
         sql_string: `
           ALTER TABLE IF EXISTS restaurant_settings ADD COLUMN IF NOT EXISTS is_auto_close_shift_enabled BOOLEAN DEFAULT TRUE;
           ALTER TABLE IF EXISTS work_shift_assignments ADD COLUMN IF NOT EXISTS substitute_date DATE;
           ALTER TABLE IF EXISTS work_shift_assignments ADD COLUMN IF NOT EXISTS is_substitute BOOLEAN DEFAULT FALSE;
           ALTER TABLE IF EXISTS work_shift_assignments ADD COLUMN IF NOT EXISTS substitute_for_profile_id UUID REFERENCES profiles(id);
         ` 
       });
    } catch (migrateErr) { /* Gagal tidak apa-apa, berarti sudah ada atau server rest */ }

    // 1. Ambil Profil Karyawan untuk mendapatkan Profile ID-nya
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, created_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json({ success: false, error: "Profile not found" });
    }

    // 2. Jika Admin, tidak perlu shift jadwal kerja
    if (profile.role === 'admin') {
      return NextResponse.json({ success: true, isAdmin: true });
    }

    // 3. Tarik semua penugasan shift untuk profil ini, bypass RLS via Service Role
    // Sertakan field substitute dan relation user yang digantikan
    const { data: assignments, error: fetchError } = await supabase
      .from('work_shift_assignments')
      .select('*, work_shifts(*), substitute_for:substitute_for_profile_id(full_name)')
      .eq('profile_id', profile.id);

    if (fetchError) throw fetchError;

    // 4. Ambil daftar absensi milik user ini HARI INI yang membuat shift dianggap selesai/tidak bisa check-in:
    // Yaitu check_out, alpha, izin, sakit
    // Menggunakan timezone Asia/Jakarta (WIB)
    const nowWIB = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
    const todayISOStr = nowWIB.getFullYear() + '-' +
      String(nowWIB.getMonth() + 1).padStart(2, '0') + '-' +
      String(nowWIB.getDate()).padStart(2, '0');
    const todayStartWIB = `${todayISOStr}T00:00:00+07:00`;
    
    const { data: completedAttendances } = await supabase
      .from('attendance')
      .select('work_shift_id')
      .eq('user_id', userId)
      .in('type', ['check_out', 'alpha', 'izin', 'sakit'])
      .gte('created_at', todayStartWIB);
      
    const completedShiftIds = (completedAttendances || []).map((c: any) => c.work_shift_id).filter(Boolean);

    // 5. Hitung deteksi hari INI secara akurat untuk shift reguler (berbasis WIB)
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const todayIndoName = dayNames[nowWIB.getDay()];

    // FILTER CERDAS: Cari semua kandidat shift HARI INI (Reguler ATAU Pengganti)
    const activeCandidates = (assignments || []).filter((a: any) => {
       // Kasus A: Ini adalah jadwal pengganti yang dikunci pada tanggal hari ini
       if (a.substitute_date === todayISOStr) {
          return true;
       }
       // Kasus B: Jadwal reguler (tidak punya substitute_date, atau substitute_date kosong)
       if (!a.substitute_date && a.work_shifts?.days) {
          return a.work_shifts.days.includes(todayIndoName) || a.work_shifts.days.includes(todayIndoName.slice(0,3));
       }
       return false;
    });

    // ELIMINASI: Dari kandidat hari ini, buang shift yang SUDAH SELESAI!
    let nextActiveCandidate = activeCandidates.find((a: any) => 
       !completedShiftIds.includes(a.work_shift_id)
    );

    // REAL-TIME AUTO-ALPHA DETECTOR:
    // Jika ada jadwal hari ini, tapi jam selesai shift telah terlampaui dan belum absen masuk,
    // maka sistem secara otomatis memasukkan status ALPHA ke tabel attendance.
    if (nextActiveCandidate?.work_shifts) {
      const [endH, endM] = nextActiveCandidate.work_shifts.end_time.split(':').map(Number);
      const endTimeWIB = new Date(nowWIB);
      endTimeWIB.setHours(endH, endM, 0, 0);

      // Proteksi real-time: Jangan tandai ALPHA jika shift berakhir sebelum akun dibuat atau shift ditugaskan
      const profileCreatedTime = new Date(profile.created_at);
      const assignmentCreatedTime = new Date(nextActiveCandidate.created_at);
      const earliestValidTime = assignmentCreatedTime > profileCreatedTime ? assignmentCreatedTime : profileCreatedTime;
      const earliestValidWIB = new Date(earliestValidTime.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));

      // Jika sekarang sudah lewat jam selesai shift hari ini, dan shift selesai setelah waktu bergabung/ditugaskan
      if (endTimeWIB.getTime() >= earliestValidWIB.getTime() && nowWIB.getTime() > endTimeWIB.getTime()) {
        const { data: attendanceRecs } = await supabase
          .from('attendance')
          .select('id, type')
          .eq('profile_id', profile.id)
          .eq('work_shift_id', nextActiveCandidate.work_shift_id)
          .gte('created_at', todayStartWIB);

        if (!attendanceRecs || attendanceRecs.length === 0) {
          // Masukkan status ALPHA otomatis
          const alphaCreatedAt = `${todayISOStr}T23:59:59+07:00`; // WIB
          
          await supabase.from('attendance').insert({
            user_id: userId,
            profile_id: profile.id,
            type: 'alpha',
            status: 'approved',
            notes: 'Sistem otomatis: Shift berakhir tanpa absensi masuk (Pemicu Real-Time)',
            location: 'Restoran (Cabang Utama)',
            created_at: alphaCreatedAt,
            late_minutes: 0,
            work_shift_id: nextActiveCandidate.work_shift_id
          });

          // Masukkan log ke audit_logs
          const auditLogData = {
            employee_id: profile.employee_id || '-',
            employee_name: profile.full_name,
            work_date: todayISOStr,
            start_time: nextActiveCandidate.work_shifts.start_time,
            end_time: nextActiveCandidate.work_shifts.end_time,
            system_updated_at: new Date().toISOString(),
            old_status: 'BELUM DIPROSES',
            new_status: 'ALPHA',
            reason: 'Shift berakhir tanpa absensi masuk (Pemicu Real-Time Kasir)'
          };

          await supabase.from('audit_logs').insert({
            action: 'auto_alpha',
            operator_id: null,
            operator_name: 'System Automated Scheduler',
            target_id: profile.id,
            target_name: profile.full_name,
            data_before: null,
            data_after: auditLogData,
            ip_address: '127.0.0.1',
            browser: 'System Real-Time trigger',
            device: 'Server'
          });

          // Tambahkan ke completedShiftIds agar shift ini dilewati
          completedShiftIds.push(nextActiveCandidate.work_shift_id);
          
          // Re-evaluasi nextActiveCandidate
          nextActiveCandidate = activeCandidates.find((a: any) => 
             !completedShiftIds.includes(a.work_shift_id)
          );
        }
      }
    }

    let chosenCandidate = nextActiveCandidate;
    let shiftDate = todayISOStr;
    const isHolidayToday = !chosenCandidate;

    // Jika hari ini tidak ada shift aktif lagi, cari shift di hari-hari berikutnya (maksimal 7 hari ke depan)
    if (!chosenCandidate) {
      for (let dayOffset = 1; dayOffset <= 7; dayOffset++) {
         const nextDate = new Date(nowWIB);
         nextDate.setDate(nextDate.getDate() + dayOffset);
         
         const nextISOStr = nextDate.getFullYear() + '-' +
           String(nextDate.getMonth() + 1).padStart(2, '0') + '-' +
           String(nextDate.getDate()).padStart(2, '0');
         const nextDayIndoName = dayNames[nextDate.getDay()];
         
         const match = (assignments || []).find((a: any) => {
            // Kasus A: Jadwal pengganti pada tanggal ini
            if (a.substitute_date === nextISOStr) {
               return true;
            }
            // Kasus B: Jadwal reguler
            if (!a.substitute_date && a.work_shifts?.days) {
               return a.work_shifts.days.includes(nextDayIndoName) || a.work_shifts.days.includes(nextDayIndoName.slice(0,3));
            }
            return false;
         });
         
         if (match) {
            chosenCandidate = match;
            shiftDate = nextISOStr;
            break; // Temukan shift terdekat lalu hentikan loop
         }
      }
    }

    let assignedEmployees: any[] = [];
    if (chosenCandidate?.work_shift_id) {
      // Tarik semua kolega di shift yang sama
      const { data: colleagues } = await supabase
        .from('work_shift_assignments')
        .select('id, profiles!work_shift_assignments_profile_id_fkey(full_name, avatar_url)')
        .eq('work_shift_id', chosenCandidate.work_shift_id);
      
      assignedEmployees = colleagues || [];
    }

    return NextResponse.json({
      success: true,
      isHolidayToday: isHolidayToday,
      todayShift: chosenCandidate?.work_shifts ? {
        ...chosenCandidate.work_shifts,
        shiftDate: shiftDate
      } : null,
      assignmentDetails: {
         isSubstitute: !!chosenCandidate?.is_substitute,
         substituteFor: chosenCandidate?.substitute_for?.full_name || null
      },
      today: todayIndoName,
      assignedEmployees: assignedEmployees.map((c: any) => c.profiles).filter(Boolean)
    });

  } catch (err: any) {
    console.error("Fetch Shift API Error:", err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
