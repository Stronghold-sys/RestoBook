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

// Kategori yang berkaitan dengan perubahan data akun (memerlukan approval admin)
const ACCOUNT_CHANGE_CATEGORIES = [
  'perubahan email',
  'perubahan nama',
  'perubahan nomor telepon',
  'perubahan alamat',
  'koreksi data profil',
  'verifikasi ulang',
  'bantuan login',
];

function isAccountChangeCategory(category: string): boolean {
  return ACCOUNT_CHANGE_CATEGORIES.some(c => c.toLowerCase() === category.toLowerCase());
}

function getCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    'perubahan email': 'Perubahan Email',
    'perubahan nama': 'Perubahan Nama',
    'perubahan nomor telepon': 'Perubahan Nomor Telepon',
    'perubahan alamat': 'Perubahan Alamat',
    'koreksi data profil': 'Koreksi Data Profil',
    'verifikasi ulang': 'Verifikasi Ulang Akun',
    'bantuan login': 'Bantuan Login',
    'pembayaran': 'Masalah Pembayaran',
    'pesanan': 'Masalah Pesanan',
    'reward': 'Masalah Reward / Poin',
    'lainnya': 'Pertanyaan / Laporan Lainnya',
  };
  return map[category.toLowerCase()] || category;
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

    const isAccChange = isAccountChangeCategory(category);
    const categoryLabel = getCategoryLabel(category);

    let subject = '';
    let statusLabel = '';
    let messageHtml = '';
    let alertColor = '#ff5722'; // default primary brand color

    switch (status) {
      case 'pending':
        subject = `[RestoBook] Tiket Pengaduan Diterima - ${ticketNumber}`;
        statusLabel = 'Menunggu Ditinjau';
        alertColor = '#f59e0b'; // amber
        if (isAccChange) {
          messageHtml = `
            <p>Terima kasih, <strong>${name}</strong>. Permintaan <strong>${categoryLabel}</strong> Anda telah kami terima dan sedang dalam antrian peninjauan oleh admin.</p>
            <p>Tim dukungan kami akan segera meninjau permohonan Anda dan memperbarui status tiket secara berkala. Anda juga dapat memantau perkembangan tiket ini melalui menu <strong>Bantuan</strong> di aplikasi RestoBook.</p>
            <div style="background: #fff8e7; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #f59e0b;">
              <p style="margin: 0; font-size: 13px; color: #92400e;">⏳ Harap menunggu, proses persetujuan data akun biasanya memerlukan waktu <strong>1×24 jam kerja</strong>.</p>
            </div>
          `;
        } else {
          messageHtml = `
            <p>Halo <strong>${name}</strong>, laporan atau pertanyaan Anda untuk kategori <strong>${categoryLabel}</strong> telah berhasil kami terima.</p>
            <p>Tim dukungan RestoBook akan segera menindaklanjuti dan menghubungi Anda melalui live chat di aplikasi atau melalui email ini. Harap pantau pembaruan tiket Anda secara berkala.</p>
            <div style="background: #fffbeb; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #fbbf24;">
              <p style="margin: 0; font-size: 13px; color: #78350f;">💬 Anda dapat membalas atau menambahkan informasi melalui fitur Live Chat di halaman Bantuan aplikasi RestoBook.</p>
            </div>
          `;
        }
        break;

      case 'processing':
        subject = `[RestoBook] Tiket Anda Sedang Diproses - ${ticketNumber}`;
        statusLabel = 'Sedang Diproses';
        alertColor = '#8b5cf6'; // purple
        if (isAccChange) {
          messageHtml = `
            <p>Permintaan <strong>${categoryLabel}</strong> Anda sedang dalam proses peninjauan aktif oleh admin kami.</p>
            <p>Mohon menunggu proses ini selesai. Admin kami dapat menghubungi Anda melalui fitur live chat di dalam aplikasi apabila memerlukan informasi tambahan.</p>
          `;
        } else {
          messageHtml = `
            <p>Tim dukungan RestoBook sedang menangani laporan Anda mengenai <strong>${categoryLabel}</strong>.</p>
            <p>Mohon bersabar, tim kami akan memberikan respons secepatnya. Silakan pantau status tiket di menu Bantuan pada aplikasi RestoBook.</p>
          `;
        }
        break;

      case 'waiting_info':
        subject = `[RestoBook] Diperlukan Informasi Tambahan - ${ticketNumber}`;
        statusLabel = 'Menunggu Informasi';
        alertColor = '#f97316'; // orange
        messageHtml = `
          <p>Halo <strong>${name}</strong>, tim dukungan RestoBook memerlukan informasi atau klarifikasi tambahan terkait tiket Anda mengenai <strong>${categoryLabel}</strong>.</p>
          <p>Silakan buka aplikasi RestoBook, kunjungi menu <strong>Bantuan</strong>, pilih tiket ini, dan balas melalui fitur live chat dengan memberikan informasi yang dibutuhkan.</p>
          <div style="background: #fff7ed; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #f97316;">
            <p style="margin: 0; font-size: 13px; color: #9a3412;">⚠️ Tiket akan otomatis kedaluwarsa jika tidak ada respons dalam batas waktu SLA yang telah ditentukan. Segera balas untuk menghindari penutupan tiket otomatis.</p>
          </div>
          ${reason ? `<div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #6b7280;"><strong>Catatan dari Admin:</strong> ${reason}</div>` : ''}
        `;
        break;

      case 'approved':
        subject = `[RestoBook] Permintaan ${categoryLabel} Disetujui - ${ticketNumber}`;
        statusLabel = 'Disetujui';
        alertColor = '#10b981'; // emerald green
        messageHtml = `
          <p>Kabar baik, <strong>${name}</strong>! Permintaan <strong>${categoryLabel}</strong> Anda telah <strong style="color: #10b981;">disetujui</strong> oleh admin RestoBook.</p>
          <p style="font-weight: bold; color: #ff5722;">Beberapa kolom yang terkait telah dibuka sementara di profil Anda. Silakan segera login dan lakukan perubahan data yang diinginkan.</p>
          <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #10b981;">
            <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: bold; color: #065f46;">📋 Langkah Selanjutnya:</p>
            <ol style="margin: 0; padding-left: 18px; font-size: 13px; color: #047857; line-height: 1.8;">
              <li>Login ke aplikasi RestoBook</li>
              <li>Kunjungi menu <strong>Profil Saya</strong></li>
              <li>Lakukan perubahan data sesuai persetujuan</li>
              <li>Klik tombol <strong>Simpan Perubahan</strong></li>
            </ol>
          </div>
          ${reason ? `<div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #10b981;"><strong>Catatan Admin:</strong> ${reason}</div>` : ''}
        `;
        break;

      case 'rejected':
        subject = `[RestoBook] Permintaan ${categoryLabel} Belum Dapat Diproses - ${ticketNumber}`;
        statusLabel = 'Tidak Disetujui';
        alertColor = '#ef4444'; // red
        messageHtml = `
          <p>Mohon maaf, <strong>${name}</strong>. Permintaan <strong>${categoryLabel}</strong> Anda belum dapat disetujui pada saat ini.</p>
          ${reason ? `<div style="background: #fef2f2; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #ef4444; color: #b91c1c;"><strong>Alasan Penolakan:</strong> ${reason}</div>` : ''}
          <p style="margin-top: 20px;">Apabila Anda masih memerlukan bantuan atau ingin mengajukan klarifikasi lebih lanjut, silakan buat tiket pengaduan baru melalui menu <strong>Bantuan</strong> di aplikasi RestoBook dan sertakan informasi yang lebih lengkap.</p>
        `;
        break;

      case 'completed':
        if (isAccChange) {
          subject = `[RestoBook] Permintaan ${categoryLabel} Berhasil Diselesaikan - ${ticketNumber}`;
          statusLabel = 'Selesai';
          alertColor = '#10b981'; // emerald green
          messageHtml = `
            <p>Tiket bantuan Anda mengenai <strong>${categoryLabel}</strong> telah <strong style="color: #10b981;">diselesaikan</strong>. Terima kasih atas kesabaran Anda.</p>
            <p>Jika perubahan data telah dilakukan, kolom pengeditan pada profil Anda kini telah otomatis dikunci kembali demi menjaga keamanan akun Anda.</p>
            ${oldEmail || newEmail ? `
            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 15px; border: 1px solid #e5e7eb;">
              <table style="width: 100%; font-size: 13px; color: #4b5563;">
                ${oldEmail ? `<tr><td style="padding: 4px 0; font-weight: bold; width: 40%;">Data Sebelumnya</td><td style="padding: 4px 0;">${oldEmail}</td></tr>` : ''}
                ${newEmail ? `<tr><td style="padding: 4px 0; font-weight: bold;">Data Baru</td><td style="padding: 4px 0; color: #10b981; font-weight: bold;">${newEmail}</td></tr>` : ''}
              </table>
            </div>` : ''}
            <p style="margin-top: 20px; color: #4b5563; font-size: 13px;">Jika Anda mengalami masalah atau memiliki pertanyaan lebih lanjut, jangan ragu untuk membuat tiket baru.</p>
          `;
        } else {
          subject = `[RestoBook] Tiket Bantuan Anda Telah Diselesaikan - ${ticketNumber}`;
          statusLabel = 'Selesai';
          alertColor = '#10b981';
          messageHtml = `
            <p>Tiket bantuan Anda mengenai <strong>${categoryLabel}</strong> telah berhasil diselesaikan oleh tim dukungan RestoBook. Terima kasih atas kesabaran Anda.</p>
            <p>Kami berharap permasalahan Anda telah teratasi dengan baik. Jika masih ada kendala atau pertanyaan, Anda dapat membuat tiket pengaduan baru kapan saja melalui menu <strong>Bantuan</strong> di aplikasi.</p>
            <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #10b981;">
              <p style="margin: 0; font-size: 13px; color: #065f46;">⭐ Terima kasih telah menggunakan layanan RestoBook. Kami senang dapat membantu Anda!</p>
            </div>
          `;
        }
        break;

      case 'closed':
        subject = `[RestoBook] Tiket Bantuan Ditutup - ${ticketNumber}`;
        statusLabel = 'Ditutup';
        alertColor = '#6b7280'; // gray
        messageHtml = `
          <p>Tiket bantuan Anda dengan nomor <strong>${ticketNumber}</strong> telah ditutup.</p>
          ${reason ? `<div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 15px; border-left: 4px solid #6b7280;"><strong>Keterangan:</strong> ${reason}</div>` : ''}
          <p style="margin-top: 20px; color: #4b5563; font-size: 13px;">Jika Anda merasa tiket ini ditutup sebelum permasalahan terselesaikan, silakan buat tiket baru melalui menu <strong>Bantuan</strong> dan cantumkan nomor tiket sebelumnya.</p>
        `;
        break;

      default:
        subject = `[RestoBook] Pembaruan Tiket Bantuan - ${ticketNumber}`;
        statusLabel = status;
        messageHtml = `<p>Tiket bantuan Anda telah diperbarui ke status: <strong>${status}</strong></p>`;
    }

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: linear-gradient(135deg, #ff5722 0%, #e64a19 100%); padding: 32px 28px; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">RestoBook</h1>
          <p style="color: rgba(255, 255, 255, 0.80); margin: 6px 0 0; font-size: 13px; font-weight: 500;">Layanan Bantuan & Pengaduan Pelanggan</p>
        </div>
        
        <div style="padding: 28px 28px 0;">
          <div style="background: ${alertColor}12; border: 1.5px solid ${alertColor}35; border-radius: 10px; padding: 13px 16px; text-align: center; margin-bottom: 22px;">
            <p style="margin: 0; color: ${alertColor}; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">STATUS TIKET: ${statusLabel}</p>
          </div>
          
          <p style="color: #374151; font-size: 15px; margin: 0 0 16px;">Halo <strong>${name}</strong>,</p>
          <div style="color: #4b5563; font-size: 13px; line-height: 1.7;">
            ${messageHtml}
          </div>
          
          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 24px 0;" />
          
          <div style="background: #f9fafb; border-radius: 10px; padding: 16px; font-size: 13px; color: #4b5563;">
            <p style="margin: 0 0 10px; font-weight: 700; color: #111827; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Detail Tiket</p>
            <table style="width: 100%;">
              <tr><td style="padding: 4px 0; font-weight: 600; width: 40%; color: #6b7280;">Nomor Tiket</td><td style="padding: 4px 0; font-family: monospace; font-weight: 700; color: #ff5722;">${ticketNumber}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600; color: #6b7280;">Kategori</td><td style="padding: 4px 0; font-weight: 600;">${categoryLabel}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600; color: #6b7280;">Judul</td><td style="padding: 4px 0;">${title}</td></tr>
              <tr><td style="padding: 4px 0; font-weight: 600; color: #6b7280;">Waktu Update</td><td style="padding: 4px 0;">${new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta' })} WIB</td></tr>
            </table>
          </div>
          
          <p style="font-size: 11px; color: #9ca3af; margin: 20px 0; line-height: 1.6; text-align: center;">
            Email ini dikirimkan secara otomatis dari sistem RestoBook. Harap tidak membalas email ini secara langsung. Gunakan fitur live chat di aplikasi untuk berkomunikasi dengan admin.
          </p>
        </div>
        
        <div style="background: #f9fafb; padding: 16px 28px; text-align: center; border-top: 1px solid #f0f0f0;">
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
