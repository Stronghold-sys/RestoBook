export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logSecurity, parseUserAgent } from '@/lib/security';

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
  const endpoint = '/api/reset-password';

  try {
    const { email, password, code } = await req.json();

    if (!email || !password || !code) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // 1. Enforce Password Reset Rate Limiting
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60000).toISOString();

    // Limit 1: 3 request per jam
    const { count: count1h, error: err1h } = await supabaseAdmin
      .from('security_logs')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ipAddress)
      .in('activity', ['PASSWORD_RESET', 'PASSWORD_RESET_FAILED'])
      .gt('created_at', oneHourAgo);

    if (!err1h && count1h && count1h >= 3) {
      await logSecurity({
        ipAddress, browser, device, userAgent,
        activity: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED_1H', endpoint, status: 'blocked'
      });
      return NextResponse.json({ error: 'Permintaan reset password terlalu sering dari IP Anda. Silakan coba beberapa saat lagi.' }, { status: 429 });
    }

    // Limit 2: 10 request per 24 jam
    const { count: count24h, error: err24h } = await supabaseAdmin
      .from('security_logs')
      .select('*', { count: 'exact', head: true })
      .eq('ip_address', ipAddress)
      .in('activity', ['PASSWORD_RESET', 'PASSWORD_RESET_FAILED'])
      .gt('created_at', twentyFourHoursAgo);

    if (!err24h && count24h && count24h >= 10) {
      await logSecurity({
        ipAddress, browser, device, userAgent,
        activity: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED_24H', endpoint, status: 'blocked'
      });
      return NextResponse.json({ error: 'Permintaan reset password harian terlampaui. Silakan coba lagi besok.' }, { status: 429 });
    }

    // Double check OTP
    const { data: otpData } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('type', 'forgot_password')
      .eq('is_used', true)
      .single();

    if (!otpData) {
      await logSecurity({
        ipAddress, browser, device, userAgent,
        activity: 'PASSWORD_RESET_FAILED', endpoint, status: 'failed'
      });
      return NextResponse.json({ error: 'OTP belum diverifikasi' }, { status: 400 });
    }

    // Get user id by email
    const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) throw userError;

    const user = users.find((u: any) => u.email === email);

    if (!user) {
      await logSecurity({
        ipAddress, browser, device, userAgent,
        activity: 'PASSWORD_RESET_FAILED', endpoint, status: 'failed'
      });
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password }
    );

    if (updateError) {
      await logSecurity({
        ipAddress, browser, device, userAgent,
        activity: 'PASSWORD_RESET_FAILED', endpoint, status: 'failed'
      });
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Get profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone')
      .eq('email', email)
      .single();

    // Log Password Reset Success
    await logSecurity({
      userId: profile?.id,
      fullName: profile?.full_name,
      ipAddress, browser, device, userAgent,
      activity: 'PASSWORD_RESET', endpoint, status: 'success'
    });

    // 4. Kirim Notifikasi Sukses
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      await fetch(`${appUrl}/api/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          phone: profile?.phone,
          name: profile?.full_name || 'User',
          type: 'reset_success'
        })
      });
    } catch (e) {
      console.error('Notification failed:', e);
    }

    return NextResponse.json({ success: true, message: 'Password berhasil diubah' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
