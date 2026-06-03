import { Resend } from 'resend';

interface SendTicketEmailOptions {
  email: string;
  name: string;
  ticketNumber: string;
  category: string;
  title: string;
  status: 'pending' | 'processing' | 'waiting_info' | 'approved' | 'rejected' | 'completed' | 'closed';
  reason?: string;
  oldEmail?: string;
  newEmail?: string;
}

export async function sendTicketEmail(options: SendTicketEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[sendTicketEmail] RESEND_API_KEY is not set');
      return { success: false, error: 'Email service is not configured' };
    }

    const resend = new Resend(apiKey);
    const { email, name, ticketNumber, category, title, status, reason, oldEmail, newEmail } = options;

    let subject = '';
    let statusLabel = '';
    let messageHtml = '';
    let alertColor = '#ff5722'; // default primary brand color

    switch (status) {
      case 'pending':
        subject = `Permintaan Perubahan Data Akun Diterima - ${ticketNumber}`;
        statusLabel = 'Menunggu Diproses';
        alertColor = '#f59e0b'; // amber
        messageHtml = `
          <p>Terima kasih, permintaan perubahan data akun Anda telah kami terima dan sedang diproses oleh admin.</p>
          <p>Tim dukungan kami akan segera meninjau tiket bantuan Anda dan memperbarui statusnya secara berkala.</p>
        `;
        break;
      case 'processing':
        subject = `Permintaan Perubahan Data Akun Sedang Ditinjau - ${ticketNumber}`;
        statusLabel = 'Sedang Ditinjau';
        alertColor = '#8b5cf6'; // purple
        messageHtml = `
          <p>Permintaan perubahan data akun Anda sedang ditinjau oleh admin.</p>
          <p>Mohon menunggu proses peninjauan ini selesai. Anda dapat terus memantau pembaruan tiket ini secara realtime di aplikasi.</p>
        `;
        break;
      case 'approved':
        subject = `Permintaan Perubahan Data Akun Disetujui - ${ticketNumber}`;
        statusLabel = 'Disetujui';
        alertColor = '#10b981'; // emerald green
        messageHtml = `
          <p>Permintaan perubahan data akun Anda telah disetujui. Silakan periksa kembali profil Anda untuk melanjutkan pembaruan data yang diizinkan.</p>
          <p style="font-weight: bold; color: #ff5722;">Beberapa kolom yang terkait telah dibuka sementara agar Anda dapat melanjutkan proses pembaruan sesuai persetujuan admin.</p>
          ${reason ? `<div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #10b981;"><strong>Catatan Admin:</strong> ${reason}</div>` : ''}
          <p style="margin-top: 20px;">Silakan login ke aplikasi, kunjungi menu <strong>Profil Saya</strong>, lakukan pengeditan alamat email Anda, dan klik tombol <strong>Simpan Perubahan</strong>.</p>
        `;
        break;
      case 'rejected':
        subject = `Permintaan Perubahan Data Akun Belum Disetujui - ${ticketNumber}`;
        statusLabel = 'Ditolak';
        alertColor = '#ef4444'; // red
        messageHtml = `
          <p>Mohon maaf, permintaan perubahan data akun Anda belum dapat disetujui saat ini.</p>
          ${reason ? `<div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #ef4444; color: #b91c1c;"><strong>Alasan Penolakan:</strong> ${reason}</div>` : ''}
          <p style="margin-top: 20px;">Apabila Anda masih memerlukan bantuan atau ingin mengajukan klarifikasi, silakan buat tiket pengaduan baru melalui menu Bantuan.</p>
        `;
        break;
      case 'completed':
        subject = `Data Akun Anda Berhasil Diperbarui - ${ticketNumber}`;
        statusLabel = 'Selesai';
        alertColor = '#10b981'; // emerald green
        messageHtml = `
          <p>Data akun Anda telah berhasil diperbarui dan disimpan. Terima kasih.</p>
          <p>Kolom pengeditan email pada profil Anda kini telah otomatis dikunci kembali demi menjaga keamanan akun Anda.</p>
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 15px; border: 1px solid #e5e7eb;">
            <table style="width: 100%; font-size: 13px; color: #4b5563;">
              ${oldEmail ? `<tr><td style="padding: 4px 0; font-weight: bold; width: 35%;">Email Lama</td><td style="padding: 4px 0;">${oldEmail}</td></tr>` : ''}
              ${newEmail ? `<tr><td style="padding: 4px 0; font-weight: bold;">Email Baru</td><td style="padding: 4px 0; color: #10b981; font-weight: bold;">${newEmail}</td></tr>` : ''}
            </table>
          </div>
          <p style="margin-top: 20px; font-weight: bold; color: #4b5563;">Penting: Password Anda tetap sama dan tidak mengalami perubahan. Anda dapat masuk kembali ke akun Anda menggunakan alamat email baru tersebut dan password lama Anda.</p>
        `;
        break;
      case 'closed':
        subject = `Tiket Bantuan Ditutup - ${ticketNumber}`;
        statusLabel = 'Ditutup';
        alertColor = '#6b7280'; // gray
        messageHtml = `
          <p>Tiket bantuan Anda dengan nomor <strong>${ticketNumber}</strong> telah ditutup.</p>
          ${reason ? `<div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #6b7280;"><strong>Keterangan:</strong> ${reason}</div>` : ''}
        `;
        break;
      default:
        subject = `Update Tiket Bantuan - ${ticketNumber}`;
        statusLabel = status;
        messageHtml = `<p>Tiket bantuan Anda telah diperbarui ke status: <strong>${status}</strong></p>`;
    }

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #ff5722, #e64a19); padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">RestoBook Support</h1>
          <p style="color: rgba(255, 255, 255, 0.85); margin: 5px 0 0; font-size: 13px;">Layanan Bantuan & Pengaduan Akun</p>
        </div>
        
        <div style="padding: 25px 20px; border: 1px solid #f0f0f0; border-top: none;">
          <div style="background: ${alertColor}15; border: 1px solid ${alertColor}30; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 20px;">
            <p style="margin: 0; color: ${alertColor}; font-weight: bold; font-size: 15px; text-transform: uppercase;">STATUS: ${statusLabel}</p>
          </div>
          
          <p style="color: #333; font-size: 14px;">Halo <strong>${name}</strong>,</p>
          <div style="color: #555; font-size: 13px; line-height: 1.6;">
            ${messageHtml}
          </div>
          
          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 25px 0;" />
          
          <table style="width: 100%; font-size: 13px; color: #4b5563;">
            <tr><td style="padding: 4px 0; font-weight: bold; width: 35%;">Nomor Tiket</td><td style="padding: 4px 0; font-family: monospace;">${ticketNumber}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Kategori</td><td style="padding: 4px 0; text-transform: capitalize;">${category}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Judul Tiket</td><td style="padding: 4px 0;">${title}</td></tr>
            <tr><td style="padding: 4px 0; font-weight: bold;">Waktu Update</td><td style="padding: 4px 0;">${new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' })} WIB</td></tr>
          </table>
          
          <p style="font-size: 11px; color: #9ca3af; margin-top: 25px; line-height: 1.5;">
            Email ini dikirimkan secara otomatis dari sistem bantuan RestoBook. Harap tidak membalas email ini secara langsung karena alamat pengirim tidak dipantau.
          </p>
        </div>
        
        <div style="background: #fafafa; padding: 15px 20px; text-align: center; border-radius: 0 0 12px 12px; border: 1px solid #f0f0f0; border-top: none;">
          <p style="margin: 0; font-size: 11px; color: #9ca3af;">&copy; ${new Date().getFullYear()} RestoBook &mdash; Layanan Pelanggan Digital</p>
        </div>
      </div>
    `;

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'RestoBook Support <support@restobookid.my.id>',
      to: email,
      subject: subject,
      html: htmlContent
    });

    if (emailError) {
      console.error('[sendTicketEmail] Resend error:', JSON.stringify(emailError));
      return { success: false, error: JSON.stringify(emailError) };
    }

    console.log(`[sendTicketEmail] SUCCESS → ${email} (id: ${emailResult?.id})`);
    return { success: true };
  } catch (err: any) {
    console.error('[sendTicketEmail] FATAL:', err?.message || err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}
