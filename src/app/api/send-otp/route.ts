export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase/admin';

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function formatPhone(phone: string) {
  if (!phone) return "";
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  else if (clean.startsWith('8')) clean = '62' + clean;
  return clean;
}

export async function POST(req: Request) {
  try {
    const resendKey = process.env.RESEND_API_KEY;

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let { email, phone, type, method = 'email', name = 'Pelanggan' } = body;

    // 2. Logic khusus forgot_password
    if (type === 'forgot_password') {
      const cleanIdentifier = email ? email.trim().toLowerCase() : (phone ? phone.replace(/[^0-9]/g, '') : '');
      if (!cleanIdentifier) return NextResponse.json({ error: 'Email atau No. HP wajib diisi' }, { status: 400 });

      let query = supabaseAdmin.from('profiles').select('phone, email, full_name');
      if (email) query = query.ilike('email', cleanIdentifier);
      else query = query.or(`phone.ilike.%${cleanIdentifier}%,phone.ilike.%${cleanIdentifier.startsWith('62') ? '0' + cleanIdentifier.slice(2) : cleanIdentifier}%`);

      const { data: profile, error: profileError } = await query.maybeSingle();
      if (profileError) return NextResponse.json({ error: 'Database error or account not found' }, { status: 404 });

      email = email || profile?.email;
      phone = phone || profile?.phone;
      name = profile?.full_name || 'User';
    }

    if (!email && !phone) return NextResponse.json({ error: 'Email atau No. HP tidak ditemukan' }, { status: 400 });

    const code = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const dbType = type === 'change_password' ? 'forgot_password' : type;

    const { error: dbError } = await supabaseAdmin.from('otp_codes').insert({
      email: email || null,
      phone: phone || null,
      code,
      type: dbType,
      expires_at: expiresAt,
      is_used: false
    });

    if (dbError) return NextResponse.json({ error: 'Failed to save OTP' }, { status: 500 });

    // 3. Pengiriman WhatsApp (Fonnte)
    if (method === 'whatsapp') {
      const formattedPhone = formatPhone(phone);
      if (!formattedPhone) return NextResponse.json({ error: 'Invalid phone format' }, { status: 400 });

      const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
      const waMessage = `*KODE OTP RESTOBOOK*\n\nKode OTP Anda: *${code}*\nBerlaku 5 menit.`;
      
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': FONNTE_TOKEN },
        body: new URLSearchParams({ target: formattedPhone, message: waMessage, countryCode: '62' })
      });
      const waResult = await response.json();
      if (!waResult.status) return NextResponse.json({ error: 'WhatsApp delivery failed: ' + (waResult.reason || 'Unknown') }, { status: 500 });
      
      return NextResponse.json({ success: true, message: 'OTP sent via WhatsApp' });
    }

    // 4. Pengiriman Email (Resend)
    if (method === 'email' && email) {
      if (!resendKey) return NextResponse.json({ error: 'Email service key missing' }, { status: 500 });
      
      const resend = new Resend(resendKey);
      const { error: emailErr } = await resend.emails.send({
        from: 'RestoBook <onboarding@resend.dev>',
        to: email,
        subject: 'Reset Password RestoBook',
        html: `Kode OTP Reset Password Anda: <b>${code}</b>. Berlaku 5 menit.`
      });

      if (emailErr) return NextResponse.json({ error: 'Email delivery failed: ' + emailErr.message }, { status: 500 });
      return NextResponse.json({ success: true, message: 'OTP sent via Email' });
    }

    return NextResponse.json({ error: 'Invalid delivery method' }, { status: 400 });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

