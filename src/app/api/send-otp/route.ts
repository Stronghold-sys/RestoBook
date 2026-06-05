export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logSecurity, parseUserAgent } from '@/lib/security';
import { getEmergencySettings, logSecurityIncident } from '../../../lib/securityHardening';

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

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1'
  );
}

export async function POST(req: NextRequest) {
  const ipAddress = getClientIP(req);
  const userAgent = req.headers.get('user-agent') || '';
  const { browser, os, device } = parseUserAgent(userAgent);
  const endpoint = '/api/send-otp';

  try {
    const resendKey = process.env.RESEND_API_KEY;

    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let { email, phone, type, method = 'email', name } = body;

    // 1. Check Emergency Mode
    const emergency = await getEmergencySettings();
    if (emergency.emergency_mode && emergency.block_sensitive_endpoints) {
      return NextResponse.json({ error: 'Permintaan tidak dapat diproses.' }, { status: 403 });
    }

    // 1.5 Enforce OTP Rate Limiting
    const tenMinutesAgo = new Date(Date.now() - 10 * 60000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60000).toISOString();

    // Limit 1: 3 kali per 10 menit
    const { count: count10m, error: err10m } = await supabaseAdmin
      .from('security_logs')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ipAddress)
      .eq('activity', 'OTP_REQUEST')
      .gt('created_at', tenMinutesAgo);

    if (!err10m && count10m && count10m >= 3) {
      await logSecurity({
        ipAddress, browser, device, userAgent,
        activity: 'OTP_RATE_LIMIT_EXCEEDED_10M', endpoint, status: 'blocked'
      });
      return NextResponse.json({ error: 'Permintaan OTP terlalu sering. Silakan tunggu.' }, { status: 429 });
    }

    // Limit 2: 10 kali per 24 jam (hari)
    const { count: count24h, error: err24h } = await supabaseAdmin
      .from('security_logs')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ipAddress)
      .eq('activity', 'OTP_REQUEST')
      .gt('created_at', twentyFourHoursAgo);

    if (!err24h && count24h && count24h >= 10) {
      await logSecurity({
        ipAddress, browser, device, userAgent,
        activity: 'OTP_RATE_LIMIT_EXCEEDED_24H', endpoint, status: 'blocked'
      });
      return NextResponse.json({ error: 'Permintaan OTP harian terlampaui. Silakan coba lagi besok.' }, { status: 429 });
    }

    // Limit 3: Mass OTP Request dari ASN yang sama
    const cfAsn = req.headers.get('x-vercel-ip-asn') || req.headers.get('cf-asn') || 'Unknown';
    if (cfAsn !== 'Unknown') {
      const { count: asnIncidentCount } = await supabaseAdmin
        .from('security_incidents')
        .select('*', { count: 'exact', head: true })
        .eq('asn', cfAsn)
        .eq('attack_type', 'MASS_OTP_REQUEST')
        .gt('created_at', tenMinutesAgo);

      if (asnIncidentCount && asnIncidentCount >= 5) {
        return NextResponse.json({ error: 'Permintaan tidak dapat diproses.' }, { status: 429 });
      }
    }

    // Limit 4: IP ini melakukan permintaan OTP untuk email/phone yang berbeda (Mass OTP)
    const { count: diffOtpsFromIp } = await supabaseAdmin
      .from('security_logs')
      .select('endpoint', { count: 'exact', head: true })
      .eq('ip_address', ipAddress)
      .eq('activity', 'OTP_REQUEST')
      .gt('created_at', tenMinutesAgo);

    if (diffOtpsFromIp && diffOtpsFromIp >= 3) {
      await logSecurityIncident({
        ipAddress,
        asn: cfAsn !== 'Unknown' ? cfAsn : undefined,
        endpoint,
        attackType: 'MASS_OTP_REQUEST',
        severity: 'high',
        payload: { email, phone }
      });
      return NextResponse.json({ error: 'Permintaan tidak dapat diproses.' }, { status: 429 });
    }

    // Log the OTP Request attempt
    await logSecurity({
      ipAddress, browser, device, userAgent,
      activity: 'OTP_REQUEST', endpoint, status: 'success'
    });

    const extractNameFromEmail = (mail: string) => {
      if (!mail || !mail.includes('@')) return 'Pelanggan';
      return mail.split('@')[0].replace(/[^a-zA-Z]/g, ' ').trim()
        .replace(/\b\w/g, c => c.toUpperCase()) || 'Pelanggan';
    };

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
      name = profile?.full_name || extractNameFromEmail(email);
    } else {
      name = name || extractNameFromEmail(email);
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

    // 3. Tentukan Judul dan Pesan berdasarkan Tipe
    let subject = 'Kode OTP RestoBook';
    let actionText = 'memverifikasi aktivitas Anda';

    if (type === 'registration') {
      subject = 'Verifikasi Pendaftaran RestoBook';
      actionText = 'memverifikasi pendaftaran akun baru Anda';
    } else if (type === 'forgot_password') {
      subject = 'Reset Password RestoBook';
      actionText = 'mereset password akun Anda';
    } else if (type === 'change_password') {
      subject = 'Ganti Password RestoBook';
      actionText = 'mengganti password akun Anda';
    } else if (type === 'create_pin') {
      subject = 'Verifikasi Pembuatan PIN Dompetku RestoBook';
      actionText = 'membuat PIN keamanan baru pada Dompetku Anda';
    } else if (type === 'change_pin') {
      subject = 'Verifikasi Perubahan PIN Dompetku RestoBook';
      actionText = 'mengonfirmasi perubahan PIN keamanan Dompetku Anda';
    }

    const waMessage = `*KODE OTP RESTOBOOK*\n\nHalo ${name},\n\nGunakan kode OTP berikut untuk ${actionText}:\n\n*${code}*\n\nKode ini bersifat RAHASIA dan hanya berlaku selama 5 menit. Jangan berikan kode ini kepada siapa pun.`;
    
    const emailHtml = `
      <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #ea580c;">Halo ${name},</h2>
        <p>Anda telah meminta kode OTP untuk <strong>${actionText}</strong>.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
           <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #111827;">${code}</span>
        </div>
        <p style="color: #ef4444; font-size: 14px;"><strong>PENTING:</strong> Kode ini bersifat RAHASIA dan hanya berlaku selama 5 menit. Jangan berikan kode ini kepada siapa pun, termasuk staf RestoBook.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280;">Jika Anda tidak merasa melakukan permintaan ini, silakan abaikan email ini atau hubungi kami.</p>
      </div>
    `;

    // 4. Pengiriman WhatsApp (Fonnte)
    if (method === 'whatsapp') {
      const formattedPhone = formatPhone(phone);
      if (!formattedPhone) return NextResponse.json({ error: 'Invalid phone format' }, { status: 400 });

      const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
      
      const response = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { 'Authorization': FONNTE_TOKEN },
        body: new URLSearchParams({ target: formattedPhone, message: waMessage, countryCode: '62' })
      });
      const waResult = await response.json();
      if (!waResult.status) return NextResponse.json({ error: 'WhatsApp delivery failed: ' + (waResult.reason || 'Unknown') }, { status: 500 });
      
      return NextResponse.json({ success: true, message: 'OTP sent via WhatsApp' });
    }

    // 5. Pengiriman Email (Resend)
    if (method === 'email' && email) {
      if (!resendKey) return NextResponse.json({ error: 'Email service key missing' }, { status: 500 });
      
      const resend = new Resend(resendKey);
      const { error: emailErr } = await resend.emails.send({
        from: 'RestoBook <noreply@restobookid.my.id>',
        to: email,
        subject: subject,
        html: emailHtml
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
