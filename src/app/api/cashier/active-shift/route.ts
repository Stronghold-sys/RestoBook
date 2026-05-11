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
      .select('id, role')
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

    // 4. Ambil daftar check_out milik user ini HARI INI untuk mem-filter shift yang sudah rampung
    const todayObj = new Date();
    const todayISOStr = todayObj.toLocaleDateString('sv-SE'); // Format YYYY-MM-DD handal
    todayObj.setHours(0,0,0,0);
    
    const { data: todayCheckOuts } = await supabase
      .from('attendance')
      .select('work_shift_id')
      .eq('user_id', userId)
      .eq('type', 'check_out')
      .gte('created_at', todayObj.toISOString());
      
    const completedShiftIds = (todayCheckOuts || []).map((c: any) => c.work_shift_id).filter(Boolean);

    // 5. Hitung deteksi hari INI secara akurat untuk shift reguler
    const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const todayIndoName = dayNames[new Date().getDay()];

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

    // ELIMINASI: Dari kandidat hari ini, buang shift yang SUDAH DI CHECK-OUT!
    const nextActiveCandidate = activeCandidates.find((a: any) => 
       !completedShiftIds.includes(a.work_shift_id)
    );

    let assignedEmployees: any[] = [];
    if (nextActiveCandidate?.work_shifts?.id) {
      // Tarik semua kolega di shift yang sama
      const { data: colleagues } = await supabase
        .from('work_shift_assignments')
        .select('id, profiles(full_name, avatar_url)')
        .eq('work_shift_id', nextActiveCandidate.work_shift_id);
      
      assignedEmployees = colleagues || [];
    }

    return NextResponse.json({
      success: true,
      todayShift: nextActiveCandidate?.work_shifts || null,
      assignmentDetails: {
         isSubstitute: !!nextActiveCandidate?.is_substitute,
         substituteFor: nextActiveCandidate?.substitute_for?.full_name || null
      },
      today: todayIndoName,
      assignedEmployees: assignedEmployees.map((c: any) => c.profiles)
    });

  } catch (err: any) {
    console.error("Fetch Shift API Error:", err);
    return NextResponse.json({ success: false, error: err.message });
  }
}
