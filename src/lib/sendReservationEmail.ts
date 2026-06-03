import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function sendReservationEmail(
  reservationId: string,
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[sendReservationEmail] Start for reservation: ${reservationId}, status: ${status}`);

    // 1. Fetch Reservation Detail
    const { data: resData, error: resError } = await supabaseAdmin
      .from('reservations')
      .select('*, profiles!reservations_customer_id_fkey(full_name, email, phone), tables(table_number, capacity)')
      .eq('id', reservationId)
      .single();

    if (resError || !resData) {
      console.error('[sendReservationEmail] Reservation fetch failed:', resError);
      return { success: false, error: 'Reservation not found' };
    }

    // 2. Resolve Customer Email & Name
    let targetEmail = '';
    let targetName = 'Pelanggan';

    if (resData.customer_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, user_id, email, full_name')
        .eq('id', resData.customer_id)
        .maybeSingle();

      const resolvedUserId = profile?.user_id || resData.customer_id;
      
      if (profile) {
        if (profile.full_name) targetName = profile.full_name;
        if (profile.email) targetEmail = profile.email;
      }

      if (resolvedUserId) {
        try {
          const { data: authData } = await supabaseAdmin.auth.admin.getUserById(resolvedUserId);
          if (authData?.user?.email) {
            targetEmail = authData.user.email;
          }
        } catch (e) {
          console.warn('[sendReservationEmail] Auth email fetch failed:', e);
        }
      }
    }

    // Parse notes metadata if available
    let atasNama = targetName;
    let telepon = '';
    let catatan = '';
    let catatanBatal = '';
    let catatanTolak = '';
    let dibatalkanOleh = '';
    let mejaNumbers = resData.tables?.table_number?.toString() || '';

    try {
      const parsedNotes = JSON.parse(resData.notes);
      if (parsedNotes && typeof parsedNotes === 'object') {
        if (parsedNotes.atas_nama) atasNama = parsedNotes.atas_nama;
        if (parsedNotes.telepon) telepon = parsedNotes.telepon;
        if (parsedNotes.catatan) catatan = parsedNotes.catatan;
        if (parsedNotes.catatan_batal) catatanBatal = parsedNotes.catatan_batal;
        if (parsedNotes.catatan_tolak) catatanTolak = parsedNotes.catatan_tolak;
        if (parsedNotes.dibatalkan_oleh) dibatalkanOleh = parsedNotes.dibatalkan_oleh;
        if (parsedNotes.meja_tambahan && Array.isArray(parsedNotes.meja_tambahan)) {
          mejaNumbers = parsedNotes.meja_tambahan.join(', ');
        }
      }
    } catch (e) {
      catatan = resData.notes || '';
    }

    // If reservation is walk-in without a customer email
    if (!targetEmail) {
      console.warn(`[sendReservationEmail] No email address found for reservation ${reservationId} (Walk-in or unregistered)`);
      return { success: true }; // Skip silently with success
    }

    // 3. Restaurant settings
    const { data: settings } = await supabaseAdmin
      .from('restaurant_settings')
      .select('*')
      .single();

    const restoName = settings?.name || 'RestoBook';
    const restoAddr = settings?.address || '';
    const restoPhone = settings?.phone || '';

    // 4. Build Email Content based on Status
    let subject = '';
    let titleHeader = '';
    let headerBg = 'linear-gradient(135deg, #f59e0b, #d97706)'; // Yellow/orange for pending
    let statusPillText = 'MENUNGGU KONFIRMASI';
    let statusPillBg = '#fef3c7';
    let statusPillColor = '#d97706';
    let statusDesc = '';

    const formattedDate = new Date(resData.reservation_date).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = resData.reservation_time?.substring(0, 5) + ' WIB';

    if (status === 'pending') {
      subject = `Pengajuan Reservasi Meja Baru - ${restoName} - #${reservationId.substring(0, 8).toUpperCase()}`;
      titleHeader = 'Pengajuan Reservasi';
      statusPillText = 'MENUNGGU KONFIRMASI';
      statusPillBg = '#fef3c7';
      statusPillColor = '#d97706';
      statusDesc = 'Reservasi Anda telah berhasil diajukan dan sedang menunggu konfirmasi/persetujuan dari kasir kami. Mohon tunggu email konfirmasi berikutnya.';
    } else if (status === 'confirmed') {
      subject = `Reservasi Meja Anda Telah DIKONFIRMASI - ${restoName} - #${reservationId.substring(0, 8).toUpperCase()}`;
      titleHeader = 'Reservasi Dikonfirmasi!';
      headerBg = 'linear-gradient(135deg, #10b981, #059669)'; // Green
      statusPillText = 'DIKONFIRMASI / AKTIF';
      statusPillBg = '#d1fae5';
      statusPillColor = '#059669';
      statusDesc = 'Kabar baik! Reservasi meja Anda telah <strong>dikonfirmasi dan disetujui</strong> oleh kasir. Meja Anda telah kami kunci dan siapkan.';
    } else if (status === 'completed') {
      subject = `Reservasi Meja Selesai - Terima Kasih - ${restoName}`;
      titleHeader = 'Terima Kasih Atas Kunjungan Anda!';
      headerBg = 'linear-gradient(135deg, #3b82f6, #2563eb)'; // Blue
      statusPillText = 'SELESAI';
      statusPillBg = '#dbeafe';
      statusPillColor = '#2563eb';
      statusDesc = 'Reservasi meja Anda telah ditandai <strong>selesai</strong>. Terima kasih banyak telah berkunjung ke restoran kami. Semoga pelayanan dan hidangan kami memuaskan Anda!';
    } else if (status === 'cancelled') {
      subject = `Reservasi Meja DIBATALKAN - ${restoName} - #${reservationId.substring(0, 8).toUpperCase()}`;
      titleHeader = 'Reservasi Dibatalkan';
      headerBg = 'linear-gradient(135deg, #ef4444, #dc2626)'; // Red
      statusPillText = 'DIBATALKAN';
      statusPillBg = '#fee2e2';
      statusPillColor = '#dc2626';
      
      let cancelReason = catatanBatal || catatanTolak || 'Alasan tidak disebutkan';
      let entityName = 'Kasir';
      if (dibatalkanOleh === 'pelanggan') {
        entityName = 'Anda (Pelanggan)';
      } else if (dibatalkanOleh === 'admin') {
        entityName = 'Admin';
      } else if (catatanTolak) {
        entityName = 'Kasir';
      } else if (catatanBatal) {
        entityName = 'Anda (Pelanggan)';
      }
      
      statusDesc = `Reservasi meja Anda telah <strong>dibatalkan oleh ${entityName}</strong>.<br/><br/><strong>Alasan Pembatalan/Penolakan:</strong> <span style="color:#ef4444;">${cancelReason}</span>`;
    }

    const emailPayload = {
      from: 'RestoBook <noreply@restobookid.my.id>',
      to: targetEmail,
      subject: subject,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width:600px; margin:0 auto; background:#ffffff;">
          <div style="background: ${headerBg}; padding:30px 20px; text-align:center; border-radius:12px 12px 0 0;">
            <h1 style="color:#fff; margin:0; font-size:24px;">${restoName}</h1>
            <p style="color:rgba(255,255,255,0.85); margin:5px 0 0; font-size:13px;">${titleHeader}</p>
          </div>
          <div style="padding:25px 20px; border:1px solid #f0f0f0; border-top:none;">
            <div style="background:${statusPillBg}; border:1px solid ${statusPillColor}30; border-radius:8px; padding:12px; text-align:center; margin-bottom:20px;">
              <p style="margin:0; color:${statusPillColor}; font-weight:bold; font-size:15px; letter-spacing:1px;">${statusPillText}</p>
            </div>
            <p style="color:#333; font-size:14px;">Halo <strong>${atasNama}</strong>,</p>
            <p style="color:#555; font-size:13.5px; line-height:1.6; margin-bottom:20px;">
              ${statusDesc}
            </p>
            
            <div style="background:#f9f9f9; padding:18px; border-radius:10px; border:1px solid #f0f0f0; margin-bottom:20px;">
              <p style="margin:0 0 10px 0; font-weight:bold; color:#ff5722; font-size:13px; letter-spacing:0.5px; text-transform:uppercase;">Rincian Reservasi</p>
              <table style="width:100%; font-size:13px; color:#444; border-collapse:collapse;">
                <tr>
                  <td style="padding:6px 0; font-weight:bold; width:35%;">ID Reservasi</td>
                  <td style="padding:6px 0;">#${reservationId.substring(0, 8).toUpperCase()}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0; font-weight:bold;">Nama Pemesan</td>
                  <td style="padding:6px 0;">${atasNama}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0; font-weight:bold;">Nomor Telepon</td>
                  <td style="padding:6px 0;">${telepon || resData.profiles?.phone || '-'}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0; font-weight:bold;">Tanggal Reservasi</td>
                  <td style="padding:6px 0;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0; font-weight:bold;">Waktu Kedatangan</td>
                  <td style="padding:6px 0;">${formattedTime}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0; font-weight:bold;">Jumlah Tamu</td>
                  <td style="padding:6px 0;">${resData.guest_count} Orang</td>
                </tr>
                <tr>
                  <td style="padding:6px 0; font-weight:bold;">Nomor Meja</td>
                  <td style="padding:6px 0; font-weight:bold; color:#ff5722;">Meja ${mejaNumbers}</td>
                </tr>
                ${catatan ? `
                <tr>
                  <td style="padding:6px 0; font-weight:bold; vertical-align:top;">Catatan Tambahan</td>
                  <td style="padding:6px 0; line-height:1.4; color:#666;">${catatan}</td>
                </tr>` : ''}
              </table>
            </div>

            <p style="font-size:12px; color:#888; margin-top:25px; line-height:1.5; text-align:center;">
              Restoran Alamat: ${restoAddr} ${restoPhone ? `· Hub: ${restoPhone}` : ''}
            </p>
          </div>
          <div style="background:#fafafa; padding:15px 20px; text-align:center; border-radius:0 0 12px 12px; border:1px solid #f0f0f0; border-top:none;">
            <p style="margin:0; font-size:11px; color:#aaa;">&copy; ${new Date().getFullYear()} ${restoName} &mdash; Powered by RestoBook</p>
          </div>
        </div>
      `
    };

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[sendReservationEmail] RESEND_API_KEY is not set');
      return { success: false, error: 'Email service key missing' };
    }

    const resend = new Resend(apiKey);
    const { data: emailResult, error: emailError } = await resend.emails.send(emailPayload);

    if (emailError) {
      console.error('[sendReservationEmail] Resend API error:', JSON.stringify(emailError));
      return { success: false, error: JSON.stringify(emailError) };
    }

    console.log(`[sendReservationEmail] SUCCESS → ${targetEmail} (id: ${emailResult?.id})`);
    return { success: true };

  } catch (err: any) {
    console.error('[sendReservationEmail] FATAL ERROR:', err?.message || err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}
