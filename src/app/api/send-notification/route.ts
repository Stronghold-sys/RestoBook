import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";

export async function POST(req: Request) {
  try {
    const { email, phone, name, type } = await req.json();

    let subject = '';
    let emailHtml = '';
    let waMessage = '';

    if (type === 'welcome') {
      subject = 'Selamat Bergabung di RestoBook!';
      emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff8f0; border-radius: 12px;">
          <h1 style="color: #e85d04; text-align: center;">Selamat Datang!</h1>
          <p>Halo <strong>${name}</strong>,</p>
          <p>Terima kasih telah bergabung dengan <strong>RestoBook</strong>. Akun Anda telah berhasil diverifikasi dan siap digunakan.</p>
          <p>Silakan login untuk mulai mengelola operasional restoran Anda dengan lebih mudah.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666; text-align: center;">(C) 2024 RestoBook Management System</p>
        </div>
      `;
      waMessage = `*SELAMAT BERGABUNG!*\n\nHalo *${name}*,\n\nAkun RestoBook Anda telah berhasil diverifikasi. Selamat datang di keluarga besar RestoBook! Sekarang Anda bisa mulai menggunakan semua fitur kami.\n\nSelamat bekerja!\n\n*Tim RestoBook*`;
    } 
    
    else if (type === 'reset_success') {
      subject = 'Keamanan Akun: Password Berhasil Diperbarui';
      emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
          <h2 style="color: #2d3436;">Password Berhasil Diubah</h2>
          <p>Halo <strong>${name}</strong>,</p>
          <p>Pemberitahuan ini mengonfirmasi bahwa password akun RestoBook Anda baru saja berhasil diperbarui.</p>
          <p>Jika Anda tidak merasa melakukan perubahan ini, segera hubungi Admin kami.</p>
          <p>Terima kasih telah menjaga keamanan akun Anda.</p>
        </div>
      `;
      waMessage = `*PASSWORD BERHASIL DIUBAH*\n\nHalo *${name}*,\n\nPassword akun RestoBook Anda baru saja berhasil diperbarui. Silakan gunakan password baru Anda untuk login.\n\nJika ini bukan Anda, segera hubungi Admin.\n\nTerima kasih,\n*Tim Keamanan RestoBook*`;
    }

    else if (type === 'change_password_success') {
        subject = 'Notifikasi Perubahan Password Profil';
        emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px;">
            <h2 style="color: #2d3436;">Perubahan Password Berhasil</h2>
            <p>Halo <strong>${name}</strong>,</p>
            <p>Password profil Anda telah berhasil diubah melalui pengaturan akun.</p>
            <p>Terima kasih.</p>
          </div>
        `;
        waMessage = `*UBAH PASSWORD BERHASIL*\n\nHalo *${name}*,\n\nPerubahan password pada profil Anda telah berhasil dilakukan. Pastikan Anda menyimpan password baru Anda dengan aman.\n\nTerima kasih,\n*Manajemen RestoBook*`;
      }

    // 1. Kirim via WhatsApp (Jika ada nomor)
    if (phone) {
      try {
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('8') ? '62' + cleanPhone : cleanPhone);

        await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: { 'Authorization': FONNTE_TOKEN },
          body: new URLSearchParams({
            'target': formattedPhone,
            'message': waMessage,
            'countryCode': '62'
          })
        });
      } catch (e) { console.error('WA Notification Error:', e); }
    }

    // 2. Kirim via Email (Jika ada email)
    if (email) {
      try {
        await resend.emails.send({
          from: 'RestoBook <onboarding@resend.dev>',
          to: email,
          subject: subject,
          html: emailHtml,
        });
      } catch (e) { console.error('Email Notification Error:', e); }
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
