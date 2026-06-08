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

    const { action, oldPassword, newPassword, type, value, code } = await request.json();

    const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || '';
    const { browser, device } = parseUserAgent(userAgent);

    if (action === 'change_password') {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('auth_status')
        .eq('user_id', user.id)
        .single();
      const isGoogleOnly = profile?.auth_status === 'google_only';

      if (isGoogleOnly) {
        if (!newPassword) {
          return NextResponse.json({ error: 'Password baru wajib diisi' }, { status: 400 });
        }
      } else {
        if (!oldPassword || !newPassword) {
          return NextResponse.json({ error: 'Password lama dan baru wajib diisi' }, { status: 400 });
        }
      }

      // Validasi password baru
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'Password baru minimal harus 8 karakter' }, { status: 400 });
      }

      if (!isGoogleOnly) {
        // Verifikasi password lama dengan sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: oldPassword
        });

        if (signInError) {
          await supabaseAdmin.from('security_logs').insert({
            user_id: user.id,
            ip_address: clientIP,
            browser,
            device,
            user_agent: userAgent,
            activity: 'CHANGE_PASSWORD_FAILED_INVALID_OLD',
            endpoint: '/api/profile/security',
            status: 'failed'
          });
          return NextResponse.json({ error: 'Password lama tidak sesuai' }, { status: 400 });
        }
      }

      // Update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );

      if (updateError) throw updateError;

      // Update status di database profiles
      const nowStr = new Date().toISOString();
      if (isGoogleOnly) {
        await supabaseAdmin
          .from('profiles')
          .update({
            auth_status: 'password_created',
            password_created_at: nowStr,
            last_password_change_at: nowStr
          })
          .eq('user_id', user.id);
      } else {
        const nextStatus = profile?.auth_status === 'password_created' || profile?.auth_status === 'password_updated'
          ? 'password_updated'
          : 'password_login_enabled';
        await supabaseAdmin
          .from('profiles')
          .update({
            auth_status: nextStatus,
            last_password_change_at: nowStr
          })
          .eq('user_id', user.id);
      }

      // Log audit
      await supabaseAdmin.from('security_logs').insert({
        user_id: user.id,
        ip_address: clientIP,
        browser,
        device,
        user_agent: userAgent,
        activity: 'CHANGE_PASSWORD_SUCCESS',
        endpoint: '/api/profile/security',
        status: 'success'
      });

      // Kirim notifikasi internal
      await supabaseAdmin.from('notifications').insert({
        user_id: user.id,
        title: 'Keamanan Akun: Password Diubah',
        message: 'Password akun Anda telah berhasil diubah. Jika Anda tidak merasa melakukan ini, segera hubungi admin.',
        type: 'security_alert'
      });

      // Kirim notifikasi email
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey && user.email) {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: 'RestoBook Security <noreply@restobookid.my.id>',
          to: user.email,
          subject: 'Keamanan Akun: Password Diubah',
          html: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h2 style="color: #ef4444;">Notifikasi Keamanan</h2>
              <p>Halo,</p>
              <p>Kami ingin memberi tahu Anda bahwa password untuk akun RestoBook Anda telah berhasil diubah.</p>
              <p>Detail Aktivitas:</p>
              <ul>
                <li><strong>Waktu:</strong> ${new Date().toLocaleString('id-ID')}</li>
                <li><strong>IP Address:</strong> ${clientIP}</li>
                <li><strong>Browser:</strong> ${browser}</li>
                <li><strong>Perangkat:</strong> ${device}</li>
              </ul>
              <p style="color: #ef4444; font-weight: bold;">Jika Anda tidak merasa melakukan perubahan ini, silakan segera hubungi Layanan Pelanggan RestoBook.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 12px; color: #6b7280;">Ini adalah email otomatis, harap tidak membalas email ini.</p>
            </div>
          `
        }).catch(err => console.error('Error sending password change email:', err));
      }

      return NextResponse.json({ success: true, message: 'Password berhasil diubah' });
    }

    if (action === 'send_otp') {
      if (!type || !value) {
        return NextResponse.json({ error: 'Tipe verifikasi dan nilai baru wajib diisi' }, { status: 400 });
      }

      if (type === 'email') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 });
        }

        // Pastikan email belum dipakai orang lain
        const { data: existing } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', value)
          .neq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          return NextResponse.json({ error: 'Email sudah digunakan oleh akun lain' }, { status: 400 });
        }
      } else if (type === 'phone') {
        const cleanPhone = formatPhone(value);
        if (cleanPhone.length < 9) {
          return NextResponse.json({ error: 'Format nomor HP tidak valid' }, { status: 400 });
        }

        // Pastikan nomor HP belum dipakai orang lain
        const { data: existing } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('phone', value)
          .neq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          return NextResponse.json({ error: 'Nomor HP sudah digunakan oleh akun lain' }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: 'Tipe verifikasi tidak valid' }, { status: 400 });
      }

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 menit

      // Simpan OTP
      const { error: dbError } = await supabaseAdmin.from('otp_codes').insert({
        email: type === 'email' ? value : null,
        phone: type === 'phone' ? value : null,
        code: otp,
        type: 'profile_update',
        expires_at: expiresAt,
        is_used: false
      });

      if (dbError) throw dbError;

      // Kirim OTP
      if (type === 'email') {
        const resendKey = process.env.RESEND_API_KEY;
        if (!resendKey) throw new Error('Email service key missing');
        const resend = new Resend(resendKey);

        const { error: emailErr } = await resend.emails.send({
          from: 'RestoBook Security <noreply@restobookid.my.id>',
          to: value,
          subject: 'Kode OTP Perubahan Email RestoBook',
          html: `
            <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h2 style="color: #ea580c;">Verifikasi Perubahan Alamat Email</h2>
              <p>Anda sedang melakukan perubahan alamat email pada akun RestoBook Anda.</p>
              <p>Gunakan kode OTP berikut untuk memverifikasi alamat email baru Anda:</p>
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #111827;">${otp}</span>
              </div>
              <p style="color: #ef4444; font-size: 14px;"><strong>PENTING:</strong> Kode ini hanya berlaku selama 5 menit. Jangan bagikan kode ini kepada siapa pun.</p>
            </div>
          `
        });

        if (emailErr) throw emailErr;
      } else {
        // WhatsApp Fonnte
        const formattedPhone = formatPhone(value);
        const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
        const message = `*KODE OTP RESTOBOOK*\n\nGunakan kode OTP berikut untuk memverifikasi perubahan nomor HP Anda:\n\n*${otp}*\n\nKode ini berlaku selama 5 menit. Jangan bagikan kepada siapa pun.`;

        const response = await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: { 'Authorization': FONNTE_TOKEN },
          body: new URLSearchParams({ target: formattedPhone, message, countryCode: '62' })
        });
        const waResult = await response.json();
        if (!waResult.status) {
          throw new Error('WhatsApp delivery failed: ' + (waResult.reason || 'Unknown'));
        }
      }

      // Log request OTP
      await supabaseAdmin.from('security_logs').insert({
        user_id: user.id,
        ip_address: clientIP,
        browser,
        device,
        user_agent: userAgent,
        activity: 'SEND_PROFILE_UPDATE_OTP',
        endpoint: '/api/profile/security',
        status: 'success'
      });

      return NextResponse.json({ success: true, message: 'OTP berhasil dikirim' });
    }

    if (action === 'verify_otp') {
      if (!type || !value || !code) {
        return NextResponse.json({ error: 'Tipe verifikasi, nilai, dan kode OTP wajib diisi' }, { status: 400 });
      }

      // Cek OTP di database
      let query = supabaseAdmin
        .from('otp_codes')
        .select('*')
        .eq('code', code)
        .eq('type', 'profile_update')
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString());

      if (type === 'email') {
        query = query.eq('email', value);
      } else {
        query = query.eq('phone', value);
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

      // Lakukan perubahan data profil
      if (type === 'email') {
        // Update di Supabase Auth
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          { email: value }
        );
        if (authError) throw authError;

        // Update di profiles table
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ email: value, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
        if (profileError) throw profileError;

        // Log audit
        await supabaseAdmin.from('security_logs').insert({
          user_id: user.id,
          ip_address: clientIP,
          browser,
          device,
          user_agent: userAgent,
          activity: 'UPDATE_EMAIL_SUCCESS',
          endpoint: '/api/profile/security',
          status: 'success'
        });

        // Kirim notifikasi keamanan
        await supabaseAdmin.from('notifications').insert({
          user_id: user.id,
          title: 'Notifikasi Keamanan: Email Diubah',
          message: `Email akun Anda telah diubah menjadi ${value}.`,
          type: 'security_alert'
        });

      } else if (type === 'phone') {
        // Update di profiles table
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ phone: value, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);
        if (profileError) throw profileError;

        // Log audit
        await supabaseAdmin.from('security_logs').insert({
          user_id: user.id,
          ip_address: clientIP,
          browser,
          device,
          user_agent: userAgent,
          activity: 'UPDATE_PHONE_SUCCESS',
          endpoint: '/api/profile/security',
          status: 'success'
        });

        // Kirim notifikasi keamanan
        await supabaseAdmin.from('notifications').insert({
          user_id: user.id,
          title: 'Notifikasi Keamanan: Nomor HP Diubah',
          message: `Nomor HP akun Anda telah diubah menjadi ${value}.`,
          type: 'security_alert'
        });
      }

      return NextResponse.json({ success: true, message: 'Data berhasil diperbarui' });
    }

    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('Security endpoint error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
