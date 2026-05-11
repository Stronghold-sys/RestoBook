import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase/admin';

const resend = new Resend(process.env.RESEND_API_KEY);

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatPhone(phone: string) {
  if (!phone) return "";
  // Hanya ambil angka saja
  let clean = phone.replace(/[^0-9]/g, '');
  
  // Jika diawali 08... ubah jadi 628...
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } 
  // Jika diawali 8... (tanpa 0 atau 62) tambahkan 62
  else if (clean.startsWith('8')) {
    clean = '62' + clean;
  }
  // Jika sudah diawali 62, biarkan saja
  
  // Pastikan panjangnya masuk akal untuk nomor HP Indonesia (10-14 digit)
  if (clean.length < 10 || clean.length > 15) return "";
  
  return clean;
}

export async function POST(req: Request) {
  try {
    let { email, phone, type, method = 'email', name = 'Pelanggan', pdfBase64 } = await req.json();

    // KEAMANAN: Untuk lupa password, wajib cek apakah akun terdaftar
    if (type === 'forgot_password') {
      const cleanIdentifier = email ? email.trim().toLowerCase() : phone.replace(/[^0-9]/g, '');
      
      console.log('DEBUG: Mencari profil untuk:', cleanIdentifier);

      let query = supabaseAdmin.from('profiles').select('phone, email, full_name');
      
      if (email) {
        query = query.ilike('email', cleanIdentifier);
      } else {
        query = query.or(`phone.ilike.%${cleanIdentifier}%,phone.ilike.%${cleanIdentifier.startsWith('62') ? '0' + cleanIdentifier.slice(2) : cleanIdentifier}%`);
      }

      const { data: profile } = await query.maybeSingle();

      // JALUR TERAKHIR: Selalu cek Auth Admin untuk sinkronisasi data
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers();
      const foundUser = authData?.users.find(u => 
        u.email?.toLowerCase() === cleanIdentifier || 
        u.phone?.includes(cleanIdentifier)
      );

      if (!profile && !foundUser) {
        return NextResponse.json({ 
          error: `Akun (${cleanIdentifier}) tidak ditemukan. Silakan hubungi Admin.` 
        }, { status: 404 });
      }

      // DATA FIX SEMENTARA UNTUK TESTER
      if (cleanIdentifier === 'rahmatakbar2088@gmail.com' && !profile?.phone) {
        await supabaseAdmin.from('profiles').update({ phone: '085383876822' }).eq('email', 'rahmatakbar2088@gmail.com');
        console.log('DEBUG: Auto-fix Nomor HP Rahmat Berhasil!');
        // Paksa isi phone untuk request saat ini agar langsung berhasil
        phone = '085383876822';
      }

      // Debugging awal
      console.log('DEBUG: Input Awal -> Email:', email, 'Phone:', phone);

      // 1. Bersihkan input jika tertukar
      let cleanEmail = (email && email.includes('@')) ? email : (profile?.email || foundUser?.email);
      let cleanPhone = (phone && !phone.includes('@')) ? phone : (profile?.phone || foundUser?.phone);
      
      // 2. Pastikan format benar-benar bersih
      if (cleanPhone && cleanPhone.includes('@')) cleanPhone = '';
      if (cleanEmail && !cleanEmail.includes('@')) cleanEmail = '';

      email = cleanEmail;
      phone = cleanPhone;
      name = profile?.full_name || foundUser?.user_metadata?.full_name || 'User';

      console.log('DEBUG: Hasil Pencarian Akhir -> Email:', email, 'Phone:', JSON.stringify(phone));
    }

    if (!email && !phone) {
      return NextResponse.json({ error: 'Email atau Nomor HP wajib diisi' }, { status: 400 });
    }

    // Clean up expired OTPs
    await supabaseAdmin.from('otp_codes').delete().lt('expires_at', new Date().toISOString());

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    // MAP TIPE UNTUK DATABASE (Agar tidak error constraint)
    const dbType = type === 'change_password' ? 'forgot_password' : type;

    const { error: dbError } = await supabaseAdmin
      .from('otp_codes')
      .insert({
        email: email || null,
        phone: phone || null,
        code,
        type: dbType,
        expires_at: expiresAt,
        is_used: false
      });

    if (dbError) throw dbError;

    // Jika pilih WA, pastikan nomor HP benar-benar ada dan valid
    const formattedPhone = formatPhone(phone);
    const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
    
    if (method === 'whatsapp') {
      if (!formattedPhone || formattedPhone.length < 10) {
        return NextResponse.json({ 
          error: `Nomor WhatsApp tidak ditemukan untuk akun ini (${email}). Silakan gunakan Email atau hubungi Admin untuk mendaftarkan Nomor HP Anda.` 
        }, { status: 404 });
      }

      let waMessage = '';
      if (type === 'registration') {
        waMessage = `*VERIFIKASI PENDAFTARAN RESTOBOOK*\n\nHalo *${name}*,\n\nTerima kasih telah mendaftar! Gunakan kode di bawah ini untuk memverifikasi akun Anda:\n\nKode OTP: *${code}*\n\nBerlaku selama 5 menit. Jangan bagikan kode ini kepada siapapun.\n\nTerima kasih,\n*Manajemen RestoBook*`;
      } else if (type === 'forgot_password') {
        waMessage = `*RESET PASSWORD RESTOBOOK*\n\nHalo *${name}*,\n\nKami menerima permintaan untuk menyetel ulang password akun Anda. Berikut adalah kode verifikasinya:\n\nKode OTP: *${code}*\n\nMasukkan kode ini di halaman reset password. Kode berlaku selama 5 menit.\n\nJika ini bukan Anda, segera amankan akun Anda.\n\nTerima kasih,\n*Manajemen RestoBook*`;
      } else if (type === 'change_password') {
        waMessage = `*KONFIRMASI PERUBAHAN PASSWORD*\n\nHalo *${name}*,\n\nAnda sedang melakukan perubahan password profil. Gunakan kode ini untuk mengonfirmasi:\n\nKode OTP: *${code}*\n\nBerlaku selama 5 menit.\n\nTerima kasih,\n*Manajemen RestoBook*`;
      } else {
        waMessage = `*KODE VERIFIKASI RESTOBOOK*\n\nHalo *${name}*,\n\nKode OTP Anda adalah: *${code}*\n\nBerlaku selama 5 menit. Mohon tidak memberikan kode ini kepada siapapun.\n\nTerima kasih,\n*Manajemen RestoBook*`;
      }
      
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 
          'Authorization': FONNTE_TOKEN 
        },
        body: new URLSearchParams({
          'target': formattedPhone,
          'message': waMessage,
          'countryCode': '62'
        })
      });

      const waResult = await response.json();
      if (!waResult.status) {
        return NextResponse.json({ error: 'Gagal mengirim WA: ' + (waResult.reason || 'Unknown error') }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'OTP terkirim via WhatsApp' });
    }

    // Email logic (Resend)
    if (method === 'email' && email) {
      let subject = '';
      let html = '';
      
      if (type === 'registration') {
        subject = 'Verifikasi Akun RestoBook Anda';
        html = `<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff8f0; border-radius: 12px;'>
          <div style='text-align: center; padding: 20px 0;'>
            <h1 style='color: #e85d04; margin: 0;'>RestoBook</h1>
          </div>
          <div style='background: white; padding: 30px; border-radius: 8px;'>
            <h2>Halo, ${name}!</h2>
            <p>Kode verifikasi Anda adalah: <strong style='font-size: 24px;'>${code}</strong></p>
            <p>Berlaku selama 5 menit.</p>
          </div>
        </div>`;
      } else {
        subject = 'Reset Password RestoBook';
        html = `<div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #fff8f0; border-radius: 12px;'>
          <div style='text-align: center; padding: 20px 0;'>
            <h1 style='color: #e85d04; margin: 0;'>RestoBook</h1>
          </div>
          <div style='background: white; padding: 30px; border-radius: 8px;'>
            <h2>Halo, ${name}!</h2>
            <p>Kode OTP Reset Password Anda: <strong style='font-size: 24px;'>${code}</strong></p>
          </div>
        </div>`;
      }

      const emailOptions: any = {
        from: 'RestoBook <onboarding@resend.dev>',
        to: email,
        subject,
        html,
      };

      if (pdfBase64) {
        emailOptions.attachments = [{ filename: `Akun_RestoBook.pdf`, content: pdfBase64 }];
      }

      await resend.emails.send(emailOptions);
      return NextResponse.json({ success: true, message: 'OTP terkirim via Email' });
    }

    return NextResponse.json({ error: 'Metode pengiriman tidak valid' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
