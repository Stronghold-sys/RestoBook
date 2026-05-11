import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, requestId, profileId, notes, employeeId, decision, suspensionTime } = body;



    if (action === 'notify_submission') {
      const { phone, fullName, employeeId } = notes || {};
      if (phone) {
        try {
          const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
          const cleanPhone = phone.replace(/[^0-9]/g, '');
          const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('8') ? '62' + cleanPhone : cleanPhone);

          const waMessage = `Halo *${fullName}* (ID: ${employeeId || '-'}),\n\nPengajuan pengunduran diri (resign) Anda telah berhasil terkirim dan terdaftar di dalam sistem *RestoBook*.\n\nMohon untuk bersedia menunggu proses peninjauan dan keputusan selanjutnya dari pihak manajemen RestoBook. Selama masa tunggu ini, Anda dapat memantau status pengajuan Anda secara berkala melalui menu *Profil Akun -> Cek Status Resign* di aplikasi RestoBook.\n\nTerima kasih banyak atas segala dedikasi, kerja keras, dan kontribusi berharga yang telah Anda berikan selama bekerja bersama kami.\n\nHormat kami,\n*Manajemen RestoBook*`;

          await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: { 'Authorization': FONNTE_TOKEN },
            body: new URLSearchParams({
              'target': formattedPhone,
              'message': waMessage,
              'countryCode': '62'
            })
          });
        } catch (waErr) {
          console.error("WhatsApp sending failed:", waErr);
        }
      }
      return NextResponse.json({ success: true, message: 'Notifikasi pengajuan berhasil terkirim' });
    }

    if (action === 'approve') {
      const { error } = await supabaseAdmin
        .from('resign_requests')
        .update({ 
          status: 'Disetujui', 
          admin_notes: notes || 'Pengajuan disetujui oleh admin',
          suspension_time: suspensionTime || null
        })
        .eq('id', requestId);
      if (error) throw error;

      return NextResponse.json({ success: true, message: 'Pengajuan disetujui' });
    }

    if (action === 'resume_resign') {
      // 1. Update Resign Status to Disetujui again and set new timer
      const { error } = await supabaseAdmin
        .from('resign_requests')
        .update({ 
          status: 'Disetujui', 
          admin_notes: 'Manajemen memutuskan untuk melanjutkan kembali proses pengunduran diri yang sempat ditangguhkan.',
          suspension_time: suspensionTime || null,
          employee_decision: null, // Reset previous decision if any
          is_finalized: false
        })
        .eq('id', requestId);
      if (error) throw error;

      // 2. Fetch details to send WhatsApp
      const { data: reqData } = await supabaseAdmin
        .from('resign_requests')
        .select('*, profiles(phone)')
        .eq('id', requestId)
        .single();

      if (reqData && reqData.profiles?.phone) {
        try {
          const cleanPhone = reqData.profiles.phone.replace(/[^0-9]/g, '');
          const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('8') ? '62' + cleanPhone : cleanPhone);
          
          const deadDate = new Date(suspensionTime).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          const deadTime = new Date(suspensionTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

          const waMessage = `Halo *${reqData.full_name}*,\n\nKami menginformasikan bahwa proses pengunduran diri Anda yang sebelumnya sempat ditangguhkan/dibatalkan, kini *RESMI DILANJUTKAN KEMBALI* oleh manajemen.\n\nBerdasarkan keputusan terbaru, akses sistem Anda dijadwalkan berakhir pada:\nTanggal: *${deadDate}*\nPukul: *${deadTime} WIB*\n\nTerima kasih atas pengertiannya.\n\nSalam,\n*Manajemen RestoBook*`;

          await fetch("https://api.fonnte.com/send", {
            method: "POST",
            headers: { "Authorization": process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C" },
            body: new URLSearchParams({ target: formattedPhone, message: waMessage })
          });
        } catch (waErr) { console.error("Resume Resign WA Failed:", waErr); }
      }

      return NextResponse.json({ success: true, message: 'Proses keluar berhasil dilanjutkan kembali' });
    }

    if (action === 'employee_decision') {
      // 1. Simpan Pilihan Karyawan di Resign Requests
      const { error: updError } = await supabaseAdmin
        .from('resign_requests')
        .update({
          employee_decision: decision,
          decision_recorded_at: new Date().toISOString(),
          is_finalized: true
        })
        .eq('id', requestId);
      if (updError) throw updError;

      // Fetch Request Info to get Profile ID & User Detail
      const { data: reqData, error: getErr } = await supabaseAdmin
        .from('resign_requests')
        .select('*, profiles(*)')
        .eq('id', requestId)
        .single();
      
      if (getErr) throw getErr;

      // 2. Jika pilih LANJUT BEKERJA
      if (decision === 'lanjut_bekerja') {
        // Batalkan Resign
        await supabaseAdmin
          .from('resign_requests')
          .update({ status: 'Dibatalkan', suspension_time: null })
          .eq('id', requestId);

        // Pastikan status karyawan kembali AKTIF
        if (reqData.profile_id) {
          await supabaseAdmin
            .from('profiles')
            .update({ status_karyawan: 'aktif' })
            .eq('id', reqData.profile_id);
        }

        // Kirim WhatsApp Bahagia (Batal Resign)
        const phone = reqData.profiles?.phone;
        const fullName = reqData.full_name;
        if (phone) {
          try {
            const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('8') ? '62' + cleanPhone : cleanPhone);

            const waMessage = `Halo *${fullName}*,\n\nKami sangat senang mengetahui bahwa Anda memutuskan untuk tetap melanjutkan perjalanan karier bersama kami di *RestoBook*.\n\nKeputusan Anda telah kami catat secara resmi dan akun Anda akan kembali aktif penuh seperti semula. Selamat melanjutkan tugas dan karya terbaik Anda!\n\nSampai jumpa di tempat kerja,\n*Tim RestoBook*`;

            await fetch('https://api.fonnte.com/send', {
              method: 'POST',
              headers: { 'Authorization': FONNTE_TOKEN },
              body: new URLSearchParams({
                'target': formattedPhone,
                'message': waMessage,
                'countryCode': '62'
              })
            });
          } catch (waErr) {
            console.error("Happy WA failed:", waErr);
          }
        }
      } else if (decision === 'lanjut_keluar') {
        // Kirim WhatsApp Konfirmasi Keluar
        const phone = reqData.profiles?.phone;
        const fullName = reqData.full_name;
        if (phone) {
          try {
            const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('8') ? '62' + cleanPhone : cleanPhone);

            const deadDate = new Date(reqData.suspension_time).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const deadTime = new Date(reqData.suspension_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

            const waMessage = `Halo *${fullName}*,\n\nKami menginformasikan bahwa Anda telah *MENGONFIRMASI* pilihan Anda untuk tetap melanjutkan proses pengunduran diri (resign).\n\nKeputusan ini telah tersimpan secara permanen di sistem. Sesuai jadwal, akses akun Anda akan berakhir secara otomatis pada:\nTanggal: *${deadDate}*\nPukul: *${deadTime} WIB*\n\nTerima kasih banyak atas seluruh kerja sama baik Anda selama ini. Sukses selalu untuk langkah Anda berikutnya!\n\nSalam,\n*Tim RestoBook*`;

            await fetch('https://api.fonnte.com/send', {
              method: 'POST',
              headers: { 'Authorization': FONNTE_TOKEN },
              body: new URLSearchParams({
                'target': formattedPhone,
                'message': waMessage,
                'countryCode': '62'
              })
            });
          } catch (waErr) {
            console.error("Final exit WA failed:", waErr);
          }
        }
      }

      return NextResponse.json({ success: true, message: 'Keputusan berhasil disimpan dan diproses' });
    }

    if (action === 'reject') {
      const { error } = await supabaseAdmin
        .from('resign_requests')
        .update({ status: 'Ditolak', admin_notes: notes || 'Pengajuan ditolak oleh admin' })
        .eq('id', requestId);
      if (error) throw error;

      return NextResponse.json({ success: true, message: 'Pengajuan ditolak' });
    }

    if (action === 'mark_out') {
      const { data: profile, error: getError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();
      if (getError) throw getError;

      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ status_karyawan: 'resign' })
        .eq('id', profileId);
      if (error) throw error;

      const fullName = profile.full_name;
      const phone = profile.phone;

      // Kirim WhatsApp via Fonnte
      if (phone) {
        try {
          const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
          const cleanPhone = phone.replace(/[^0-9]/g, '');
          const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('8') ? '62' + cleanPhone : cleanPhone);

          const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
          const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
          const now = new Date();
          const localDay = days[now.getDay()];
          const localDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
          const localTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

          const waMessage = `Halo *${fullName}*,\n\nKami mengucapkan terima kasih atas dedikasi dan kontribusi Anda selama bekerja bersama kami di *RestoBook*.\n\nAkun Anda telah resmi dinonaktifkan pada:\n${localDay}, ${localDate} | ${localTime}\n\nSemoga perjalanan karier Anda ke depan penuh dengan kesuksesan dan pencapaian yang membanggakan.\n\nSalam hangat,\n*Tim RestoBook*`;

          await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: { 'Authorization': FONNTE_TOKEN },
            body: new URLSearchParams({
              'target': formattedPhone,
              'message': waMessage,
              'countryCode': '62'
            })
          });
        } catch (waErr) {
          console.error("WhatsApp sending failed:", waErr);
        }
      }

      return NextResponse.json({ success: true, message: 'Karyawan berhasil ditandai sudah keluar' });
    }

    if (action === 'reactivate') {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ status_karyawan: 'aktif' })
        .eq('id', profileId);
      if (error) throw error;

      // CRITICAL FIX: Remove any lingering suspension timers for this profile to prevent immediate re-suspension
      const { error: updReqErr } = await supabaseAdmin
        .from('resign_requests')
        .update({ suspension_time: null, status: 'Dibatalkan', is_finalized: true })
        .eq('profile_id', profileId)
        .neq('status', 'Ditolak'); // Don't accidentally alter explicitly rejected ones
      if (updReqErr) throw updReqErr;

      // --- TAMBAHAN: KIRIM NOTIFIKASI WHATSAPP OTOMATIS ---
      const { data: profData } = await supabaseAdmin.from('profiles').select('full_name, phone').eq('id', profileId).single();
      if (profData?.phone) {
        try {
          const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
          const cleanPhone = profData.phone.replace(/[^0-9]/g, '');
          const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('8') ? '62' + cleanPhone : cleanPhone);

          const waMessage = `Halo *${profData.full_name}*,\n\nKami menginformasikan bahwa akun Anda telah resmi *DIAKTIFKAN KEMBALI* oleh pihak manajemen RestoBook.\n\nSeluruh akses Anda ke dalam sistem telah dipulihkan sepenuhnya. Anda dapat kembali melakukan login dan beraktivitas seperti sedia kala.\n\nTerima kasih atas pengertiannya.\n\nSalam,\n*Manajemen RestoBook*`;

          await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: { 'Authorization': FONNTE_TOKEN },
            body: new URLSearchParams({ 'target': formattedPhone, 'message': waMessage, 'countryCode': '62' })
          });
        } catch (waErr) { console.error("Reactivate WA notification failed:", waErr); }
      }

      return NextResponse.json({ success: true, message: 'Karyawan berhasil diaktifkan kembali secara penuh' });
    }

    if (action === 'terminate') {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ status_karyawan: 'dipecat' })
        .eq('id', profileId);
      if (error) throw error;

      // Simpan riwayat pemecatan ke resign_requests agar tercatat
      await supabaseAdmin.from('resign_requests').insert({
        profile_id: profileId,
        employee_id: employeeId,
        full_name: notes?.fullName || 'Karyawan',
        role: notes?.role || 'cashier',
        effective_date: new Date().toISOString().split('T')[0],
        reason: notes?.reason || 'Pemecatan oleh manajemen',
        status: 'Disetujui',
        admin_notes: 'Diberhentikan oleh manajemen'
      });

      return NextResponse.json({ success: true, message: 'Karyawan berhasil dipecat' });
    }

    if (action === 'cancel_resign') {
      // 1. Fetch Current Req to get Profile Details
      const { data: reqData, error: getErr } = await supabaseAdmin
        .from('resign_requests')
        .select('*, profiles(*)')
        .eq('id', requestId)
        .single();
      
      if (getErr) throw getErr;

      // 2. Revert statuses
      const { error: updMainErr } = await supabaseAdmin.from('resign_requests').update({ 
        status: 'Dibatalkan', 
        suspension_time: null,
        is_finalized: true,
        admin_notes: typeof notes === 'string' ? notes : 'Dibatalkan oleh Admin'
      }).eq('id', requestId);
      if (updMainErr) throw updMainErr;

      if (reqData.profile_id) {
        const { error: updProfErr } = await supabaseAdmin.from('profiles').update({ status_karyawan: 'aktif' }).eq('id', reqData.profile_id);
        if (updProfErr) throw updProfErr;
      }

      // 3. Send WA Notification
      const phone = reqData.profiles?.phone;
      if (phone) {
        try {
          const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
          const cleanPhone = phone.replace(/[^0-9]/g, '');
          const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('8') ? '62' + cleanPhone : cleanPhone);
          const waMessage = `Halo *${reqData.full_name}*,\n\nAdmin telah membatalkan proses pengunduran diri Anda secara sistem.\n\nAkun Anda telah diaktifkan kembali penuh dan Anda dapat beraktivitas seperti biasa di *RestoBook*.\n\nTerima kasih,\n*Tim RestoBook*`;
          
          await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: { 'Authorization': FONNTE_TOKEN },
            body: new URLSearchParams({ 'target': formattedPhone, 'message': waMessage, 'countryCode': '62' })
          });
        } catch (waE) {}
      }

      return NextResponse.json({ success: true, message: 'Proses resign berhasil dibatalkan secara sepihak oleh Admin' });
    }

    if (action === 'delete_permanently') {
      const { data: profile, error: getError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (getError) throw getError;

      const fullName = profile.full_name;
      const phone = profile.phone;
      const type = notes?.type || 'resign';

      // Tangani foreign keys
      await supabaseAdmin
        .from('orders')
        .update({ cashier_id: null })
        .eq('cashier_id', profile.id);

      await supabaseAdmin
        .from('attendance')
        .delete()
        .eq('profile_id', profile.id);

      if (profile.user_id) {
        await supabaseAdmin.auth.admin.deleteUser(profile.user_id);
      }

      await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', profileId);

      await supabaseAdmin
        .from('resign_requests')
        .delete()
        .eq('profile_id', profileId);

      return NextResponse.json({ success: true, message: 'Akun berhasil dihapus permanen' });
    }

    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('Admin Resign Action Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
