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
    // 0. Check Env Vars first to prevent crash
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("CRITICAL: Supabase Env Vars are missing in Runtime!");
      return NextResponse.json({ error: 'Konfigurasi Server tidak lengkap (Env Vars missing)' }, { status: 500 });
    }

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let { email, phone, type, method = 'email', name = 'Pelanggan', pdfBase64 } = body;

    // ... (rest of the logic)
    // KEAMANAN: Untuk lupa password, wajib cek apakah akun terdaftar
    if (type === 'forgot_password') {
      const cleanIdentifier = email ? email.trim().toLowerCase() : (phone ? phone.replace(/[^0-9]/g, '') : '');
      
      if (!cleanIdentifier) {
        return NextResponse.json({ error: 'Email atau No. HP wajib diisi' }, { status: 400 });
      }

      console.log('DEBUG: Mencari profil untuk:', cleanIdentifier);

      let query = supabaseAdmin.from('profiles').select('phone, email, full_name');
      
      if (email) {
        query = query.ilike('email', cleanIdentifier);
      } else {
        query = query.or(`phone.ilike.%${cleanIdentifier}%,phone.ilike.%${cleanIdentifier.startsWith('62') ? '0' + cleanIdentifier.slice(2) : cleanIdentifier}%`);
      }

      const { data: profile, error: profileError } = await query.maybeSingle();

      if (profileError) {
        console.error('Database Error:', profileError);
        return NextResponse.json({ error: 'Gagal mengakses database' }, { status: 500 });
      }

      // DATA FIX SEMENTARA UNTUK TESTER
      if (cleanIdentifier === 'rahmatakbar2088@gmail.com' && !profile?.phone) {
        await supabaseAdmin.from('profiles').update({ phone: '085383876822' }).eq('email', 'rahmatakbar2088@gmail.com');
        phone = '085383876822';
      }

      let cleanEmail = (email && email.includes('@')) ? email : profile?.email;
      let cleanPhone = (phone && !phone.includes('@')) ? phone : profile?.phone;
      
      email = cleanEmail;
      phone = cleanPhone;
      name = profile?.full_name || 'User';
    }

    if (!email && !phone) {
      return NextResponse.json({ error: 'Email atau Nomor HP tidak ditemukan' }, { status: 400 });
    }

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
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

    if (dbError) {
      console.error('OTP Insert Error:', dbError);
      return NextResponse.json({ error: 'Gagal menyimpan kode OTP' }, { status: 500 });
    }

    if (method === 'whatsapp') {
      const formattedPhone = formatPhone(phone);
      if (!formattedPhone) {
        return NextResponse.json({ error: 'Format nomor WhatsApp tidak valid' }, { status: 400 });
      }

      const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
      const waMessage = `*KODE OTP RESTOBOOK*\n\nKode OTP Anda: *${code}*\nBerlaku 5 menit.`;
      
      try {
        const response = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: { 'Authorization': FONNTE_TOKEN },
          body: new URLSearchParams({ target: formattedPhone, message: waMessage, countryCode: '62' })
        });
        const waResult = await response.json();
        if (!waResult.status) throw new Error(waResult.reason || 'Unknown WA error');
      } catch (waErr: any) {
        return NextResponse.json({ error: 'Gagal kirim WA: ' + waErr.message }, { status: 500 });
      }
      
      return NextResponse.json({ success: true, message: 'OTP terkirim via WhatsApp' });
    }

    if (method === 'email' && email) {
      if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ error: 'Konfigurasi Email (Resend) tidak ditemukan' }, { status: 500 });
      }
      
      const resend = new Resend(process.env.RESEND_API_KEY);
      try {
        await resend.emails.send({
          from: 'RestoBook <onboarding@resend.dev>',
          to: email,
          subject: 'Reset Password RestoBook',
          html: `Kode OTP Anda: <b>${code}</b>`
        });
      } catch (emailErr: any) {
        return NextResponse.json({ error: 'Gagal kirim Email: ' + emailErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, message: 'OTP terkirim via Email' });
    }

    return NextResponse.json({ error: 'Metode tidak didukung' }, { status: 400 });

  } catch (error: any) {
    console.error('GLOBAL API ERROR:', error);
    return NextResponse.json({ error: 'Server Error: ' + (error.message || 'Unknown') }, { status: 500 });
  }
}
