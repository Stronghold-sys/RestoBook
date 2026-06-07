export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { parseUserAgent } from '@/lib/security';
import { Resend } from 'resend';

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

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {}
        }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, password, code } = await request.json();

    const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || '';
    const { browser, device } = parseUserAgent(userAgent);

    // Get current profile
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    if (action === 'send_otp') {
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      // Simpan OTP
      const { error: dbError } = await supabaseAdmin.from('otp_codes').insert({
        email: profile.email || null,
        phone: profile.phone || null,
        code: otp,
        type: 'account_delete',
        expires_at: expiresAt,
        is_used: false
      });

      if (dbError) throw dbError;

      // Kirim OTP via Email
      if (profile.email) {
        const resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) throw new Error('Email service key missing');
        const resend = new Resend(resendKey);

        const { error: emailErr } = await resend.emails.send({
          from: 'RestoBook Security <noreply@restobookid.my.id>',
          to: profile.email,
          subject: 'Konfirmasi Penghapusan / Penonaktifan Akun RestoBook',
          html: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h2 style="color: #ef4444;">Verifikasi Tindakan Akun Sensitif</h2>
              <p>Halo ${profile.full_name},</p>
              <p>Anda telah meminta kode verifikasi untuk menonaktifkan atau menghapus akun RestoBook Anda.</p>
              <p>Gunakan kode OTP berikut untuk melanjutkan proses:</p>
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #ef4444;">${otp}</span>
              </div>
              <p style="color: #ef4444; font-size: 14px;"><strong>PERINGATAN:</strong> Tindakan ini akan memutus semua sesi aktif Anda. Kode ini berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun.</p>
            </div>
          `
        });

        if (emailErr) throw emailErr;
      } else if (profile.phone) {
        // WhatsApp Fonnte fallback
        const formattedPhone = formatPhone(profile.phone);
        const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
        const message = `*KODE VERIFIKASI AKUN RESTOBOOK*\n\nHalo ${profile.full_name},\n\nGunakan kode OTP berikut untuk memverifikasi tindakan penonaktifan/penghapusan akun Anda:\n\n*${otp}*\n\nKode ini berlaku selama 5 menit. Jangan bagikan kepada siapa pun.`;

        const response = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: { 'Authorization': FONNTE_TOKEN },
          body: new URLSearchParams({ target: formattedPhone, message, countryCode: '62' })
        });
        const waResult = await response.json();
        if (!waResult.status) {
          throw new Error('WhatsApp delivery failed: ' + (waResult.reason || 'Unknown'));
        }
      } else {
        return NextResponse.json({ error: 'Tidak ada email atau nomor HP yang terdaftar untuk verifikasi OTP' }, { status: 400 });
      }

      await supabaseAdmin.from('security_logs').insert({
        user_id: user.id,
        ip_address: clientIP,
        browser,
        device,
        user_agent: userAgent,
        activity: 'SEND_DEACTIVATE_OTP',
        endpoint: '/api/profile/deactivate',
        status: 'success'
      });

      return NextResponse.json({ success: true, message: 'OTP berhasil dikirim' });
    }

    if (action === 'deactivate' || action === 'delete') {
      if (!password || !code) {
        return NextResponse.json({ error: 'Password dan kode OTP wajib diisi' }, { status: 400 });
      }

      // 1. Verifikasi Password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: password
      });

      if (signInError) {
        await supabaseAdmin.from('security_logs').insert({
          user_id: user.id,
          ip_address: clientIP,
          browser,
          device,
          user_agent: userAgent,
          activity: `${action.toUpperCase()}_FAILED_INVALID_PASSWORD`,
          endpoint: '/api/profile/deactivate',
          status: 'failed'
        });
        return NextResponse.json({ error: 'Password tidak sesuai' }, { status: 400 });
      }

      // 2. Verifikasi OTP
      let query = supabaseAdmin
        .from('otp_codes')
        .select('*')
        .eq('code', code)
        .eq('type', 'account_delete')
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString());

      if (profile.email) {
        query = query.eq('email', profile.email);
      } else {
        query = query.eq('phone', profile.phone);
      }

      const { data: otpData, error: otpError } = await query.maybeSingle();

      if (otpError || !otpData) {
        return NextResponse.json({ error: 'Kode OTP tidak valid atau sudah kedaluwarsa' }, { status: 400 });
      }

      // Mark OTP as used
      await supabaseAdmin
        .from('otp_codes')
        .update({ is_used: true })
        .eq('id', otpData.id);

      if (action === 'deactivate') {
        // Nonaktifkan Akun Sementara
        const { error: updateErr } = await supabaseAdmin
          .from('profiles')
          .update({
            deactivated_at: new Date().toISOString(),
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (updateErr) throw updateErr;

        // Revoke all sessions (forces sign out)
        await supabaseAdmin
          .from('security_user_sessions')
          .update({ is_revoked: true, last_active_at: new Date().toISOString() })
          .eq('profile_id', user.id);

        // Log Keamanan
        await supabaseAdmin.from('security_logs').insert({
          user_id: user.id,
          ip_address: clientIP,
          browser,
          device,
          user_agent: userAgent,
          activity: 'ACCOUNT_DEACTIVATED',
          endpoint: '/api/profile/deactivate',
          status: 'success'
        });

        return NextResponse.json({ success: true, message: 'Akun berhasil dinonaktifkan sementara' });
      } else if (action === 'delete') {
        // Hapus Akun Permanen (Soft delete / anonymize to preserve database schema integrity)
        const deletedEmail = `deleted_${user.id}@restobookid.my.id`;
        const { error: updateErr } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name: 'Mantan Pelanggan',
            email: deletedEmail,
            phone: null,
            avatar_url: null,
            address: null,
            birthdate: null,
            deactivated_at: new Date().toISOString(),
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (updateErr) throw updateErr;

        // Revoke all sessions
        await supabaseAdmin
          .from('security_user_sessions')
          .update({ is_revoked: true, last_active_at: new Date().toISOString() })
          .eq('profile_id', user.id);

        // Update auth user to prevent any logins
        const newPassword = crypto.randomUUID();
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          {
            email: deletedEmail,
            password: newPassword,
            email_confirm: false,
            phone_confirm: false
          }
        );
        if (authError) throw authError;

        // Log Keamanan
        await supabaseAdmin.from('security_logs').insert({
          user_id: user.id,
          ip_address: clientIP,
          browser,
          device,
          user_agent: userAgent,
          activity: 'ACCOUNT_DELETED',
          endpoint: '/api/profile/deactivate',
          status: 'success'
        });

        return NextResponse.json({ success: true, message: 'Akun berhasil dihapus permanen' });
      }
    }

    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('Deactivate/Delete endpoint error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
