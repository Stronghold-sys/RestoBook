export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Resend } from 'resend';
import { logSecurity, parseUserAgent, isIPBlacklisted } from '@/lib/security';

// ── Helper: Deteksi Geolocation ──────────────────────────────────────
async function getGeoLocation(ip: string, request: NextRequest): Promise<{ country: string; city: string }> {
  // Ambil dari headers jika tersedia (e.g. Cloudflare / Vercel)
  const countryHeader = request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country');
  const cityHeader = request.headers.get('x-vercel-ip-city');

  if (countryHeader) {
    return {
      country: countryHeader,
      city: cityHeader || 'Kota tidak terdeteksi'
    };
  }

  // Fallback untuk localhost / dev
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'Tidak terdeteksi' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: 'Indonesia', city: 'Jakarta (Localhost)' };
  }

  // Panggil GeoIP API gratis secara async dengan timeout 800ms agar tidak lambat
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city`, { signal: AbortSignal.timeout(800) });
    const data = await res.json();
    if (data && data.status === 'success') {
      return { country: data.country || 'Indonesia', city: data.city || 'Jakarta' };
    }
  } catch (e) {
    console.warn('Failed to fetch GeoIP:', e);
  }
  return { country: 'Indonesia', city: 'Jakarta (Fallback)' };
}

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    '127.0.0.1'
  );
}

import { logSecurityIncident } from '../../../../lib/securityHardening';

export async function POST(request: NextRequest) {
  const ipAddress = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || '';
  const { browser, os, device } = parseUserAgent(userAgent);
  const endpoint = '/api/auth/login';

  try {
    // 1. Cek IP Blacklist
    const { blocked, reason } = await isIPBlacklisted(ipAddress);
    if (blocked) {
      await logSecurity({
        ipAddress, browser, device, userAgent,
        activity: 'IP_BLOCKED_ACCESS_ATTEMPT', endpoint, status: 'blocked'
      });
      return NextResponse.json({ error: `Akses ditolak: ${reason}` }, { status: 403 });
    }

    // 1.5. Cek Credential Stuffing dari IP ini (5+ gagal dalam 5 menit)
    const supabaseAdmin = getSupabaseAdmin();
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: diffEmailsCount } = await supabaseAdmin
      .from('security_logs')
      .select('activity', { count: 'exact', head: true })
      .eq('ip_address', ipAddress)
      .eq('activity', 'LOGIN_FAILED')
      .gt('created_at', fiveMinsAgo);

    if (diffEmailsCount && diffEmailsCount >= 5) {
      await logSecurityIncident({
        ipAddress,
        endpoint,
        attackType: 'CREDENTIAL_STUFFING',
        severity: 'high',
        payload: { attemptsCount: diffEmailsCount }
      });
      
      // Blacklist IP selama 1 jam
      const blacklistExpire = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await supabaseAdmin.from('security_ip_rules').upsert({
        ip_address: ipAddress,
        rule_type: 'blacklist',
        reason: 'Terdeteksi pola Credential Stuffing (5+ login gagal dalam 5 menit)',
        expires_at: blacklistExpire
      }, { onConflict: 'ip_address' });

      return NextResponse.json({ error: 'Permintaan tidak dapat diproses.' }, { status: 429 });
    }

    const body = await request.json();
    const { identifier, password, turnstileToken } = body;

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Email/ID Karyawan dan password wajib diisi' }, { status: 400 });
    }

    // 1.8. Verifikasi Turnstile Token
    if (turnstileToken) {
      try {
        const hostHeader = request.headers.get('host') || '';
        const isProduction = hostHeader.includes('restobookid.my.id');
        const secretKey = isProduction 
          ? (process.env.TURNSTILE_SECRET_KEY || "1x00000000000000000000000000000000")
          : "1x000000000000000000000000000000AA";

        const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret: secretKey,
            response: turnstileToken,
            remoteip: ipAddress
          })
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          return NextResponse.json({ error: "Verifikasi keamanan Turnstile gagal. Silakan coba kembali." }, { status: 400 });
        }
      } catch (err) {
        console.error("Gagal memverifikasi Turnstile:", err);
      }
    }


    let emailToLogin = identifier;
    let profile: any = null;

    // 2. Cari profil pengguna (bisa via email atau employee_id)
    let profileQuery = supabaseAdmin.from('profiles').select('*');
    if (identifier.startsWith('KRY-') || identifier.startsWith('RB-')) {
      profileQuery = profileQuery.eq('employee_id', identifier);
    } else {
      profileQuery = profileQuery.eq('email', identifier.trim().toLowerCase());
    }

    const { data: foundProfile, error: profileErr } = await profileQuery.maybeSingle();
    if (profileErr) {
      return NextResponse.json({ error: 'Terjadi kesalahan database' }, { status: 500 });
    }
    profile = foundProfile;

    if (profile) {
      emailToLogin = profile.email || emailToLogin;

      // 3. Cek apakah akun sedang terkunci
      if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
        const remainingMs = new Date(profile.locked_until).getTime() - Date.now();
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        
        await logSecurity({
          userId: profile.id, fullName: profile.full_name, ipAddress, browser, device, userAgent,
          activity: 'LOGIN_BLOCKED_ACCOUNT_LOCKED', endpoint, status: 'blocked'
        });

        return NextResponse.json({ 
          error: `Terlalu banyak percobaan login. Silakan coba kembali dalam ${remainingMinutes} menit.`,
          locked: true,
          lockedUntil: profile.locked_until
        }, { status: 429 });
      }
    }

    // 4. Lakukan otentikasi di Supabase Auth
    const cookieStore = cookies();
    const supabaseClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: emailToLogin,
      password,
    });

    // 5. Penanganan Login Gagal
    if (authError) {
      let errorMessage = 'Permintaan tidak dapat diproses.';
      
      if (profile) {
        const attempts = (profile.failed_login_attempts || 0) + 1;
        let lockedUntil: string | null = null;
        let activity = 'LOGIN_FAILED';

        // Logika Penguncian Akun
        if (attempts >= 20) {
          lockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 Jam
          activity = 'ACCOUNT_LOCKED_24H';
          // Kirim email keamanan
          await sendSecurityAlertEmail(profile.email, profile.full_name, ipAddress, `${browser} di ${os}`);
        } else if (attempts >= 10) {
          lockedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 Jam
          activity = 'ACCOUNT_LOCKED_1H';
        } else if (attempts >= 5) {
          lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 Menit
          activity = 'ACCOUNT_LOCKED_15M';
          // Masuk IP blacklist sementara
          const blacklistExpire = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          await supabaseAdmin.from('security_ip_rules').upsert({
            ip_address: ipAddress,
            rule_type: 'blacklist',
            reason: `Percobaan login gagal berulang kali (5x) pada email: ${profile.email}`,
            expires_at: blacklistExpire
          }, { onConflict: 'ip_address' });
        }

        // Simpan state penguncian di database
        await supabaseAdmin.from('profiles').update({
          failed_login_attempts: attempts,
          locked_until: lockedUntil,
          last_login_attempt_at: new Date().toISOString()
        }).eq('id', profile.id);

        await logSecurity({
          userId: profile.id, fullName: profile.full_name, ipAddress, browser, device, userAgent,
          activity, endpoint, status: 'failed'
        });
      } else {
        // Log login gagal tanpa profil terkait
        await logSecurity({
          ipAddress, browser, device, userAgent,
          activity: 'LOGIN_FAILED_UNKNOWN_ACCOUNT', endpoint, status: 'failed'
        });
      }

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // 6. Penanganan Login Sukses
    if (authData.user && profile) {
      // Cek apakah akun aktif / diblokir
      if (profile.is_active === false || profile.is_blocked === true || (profile.status_karyawan && profile.status_karyawan !== 'aktif') || (profile.status && profile.status !== 'active')) {
        await supabaseClient.auth.signOut();
        await logSecurity({
          userId: profile.id, fullName: profile.full_name, ipAddress, browser, device, userAgent,
          activity: 'LOGIN_FAILED_INACTIVE_ACCOUNT', endpoint, status: 'failed'
        });
        
        const statusType = (profile.status_karyawan && profile.status_karyawan !== 'aktif') 
          ? profile.status_karyawan 
          : (profile.status || 'suspended');
          
        const errorMessage = statusType === 'resign' 
          ? 'LOGIN DITANGGUHKAN: Status akun Anda tidak aktif di RestoBook.'
          : statusType === 'dipecat'
          ? 'LOGIN DITOLAK: Akun dinonaktifkan oleh manajemen.'
          : 'LOGIN DITOLAK: Akun Anda sedang ditangguhkan atau diblokir.';

        return NextResponse.json({ 
          error: errorMessage,
          suspended: true,
          status: statusType,
          pid: profile.id
        }, { status: 400 });
      }

      // Reset counter gagal login
      await supabaseAdmin.from('profiles').update({
        failed_login_attempts: 0,
        locked_until: null,
        last_login_attempt_at: new Date().toISOString()
      }).eq('id', profile.id);

      // Cek Geolocation Security
      const location = await getGeoLocation(ipAddress, request);
      
      const { data: existingLoc } = await supabaseAdmin
        .from('security_login_locations')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('country', location.country)
        .eq('city', location.city)
        .maybeSingle();

      if (!existingLoc) {
        // Geolocation baru terdeteksi!
        await supabaseAdmin.from('security_login_locations').insert({
          profile_id: profile.id,
          country: location.country,
          city: location.city
        });

        // Kirim email peringatan login lokasi baru
        await sendNewLocationEmail(profile.email, profile.full_name, location.country, location.city, ipAddress, `${browser} di ${os}`);

        // Buat notifikasi di dashboard pengguna
        await supabaseAdmin.from('notifications').insert({
          user_id: profile.id,
          title: 'Deteksi Lokasi Login Baru',
          message: `Akun Anda berhasil masuk dari perangkat baru di lokasi baru: ${location.city}, ${location.country}. Jika ini bukan Anda, segera ganti password.`,
          type: 'security'
        });

        await logSecurity({
          userId: profile.id, fullName: profile.full_name, ipAddress, browser, device, userAgent,
          activity: 'LOGIN_NEW_LOCATION_DETECTED', endpoint, status: 'success'
        });
      }

      // Bind session fingerprint ke security_user_sessions
      const authCookie = cookieStore.getAll().find(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
      const sessionId = authCookie ? authCookie.value.slice(0, 100) : null;
      if (sessionId) {
        const cfCountry = request.headers.get('cf-ipcountry') || location.country || 'Unknown';
        const cfTimezone = request.headers.get('x-vercel-ip-timezone') || 'Unknown';
        const cfAsn = request.headers.get('x-vercel-ip-asn') || 'Unknown';
        
        await supabaseAdmin.from('security_user_sessions').upsert({
          profile_id: profile.id,
          session_id: sessionId,
          ip_address: ipAddress,
          user_agent: userAgent,
          country: cfCountry,
          city: location.city || 'Unknown',
          asn: cfAsn,
          timezone: cfTimezone,
          last_active_at: new Date().toISOString()
        }, { onConflict: 'session_id' });
      }

      return NextResponse.json({ success: true, user: authData.user, session: authData.session });
    }

    return NextResponse.json({ error: 'Pengguna tidak memiliki profil terdaftar.' }, { status: 400 });

  } catch (error: any) {
    console.error('Unhandled Login route error:', error);
    return NextResponse.json({ error: 'Terjadi kesalahan sistem internal' }, { status: 500 });
  }
}

// ── Helper: Kirim Email Notifikasi Brute Force ────────────────────────
async function sendSecurityAlertEmail(email: string, fullName: string, ip: string, device: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !email) return;

  try {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: 'RestoBook Security <security@restobookid.my.id>',
      to: email,
      subject: '[PENTING] Akun RestoBook Anda Terkunci Karena Aktivitas Mencurigakan',
      html: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 2px solid #ef4444; border-radius: 12px; background-color: #fef2f2;">
          <h2 style="color: #dc2626; text-align: center; margin-top: 0;">Pemberitahuan Keamanan Penting</h2>
          <p>Halo <strong>${fullName}</strong>,</p>
          <p>Sistem keamanan mendeteksi lebih dari <strong>20 percobaan login gagal</strong> berturut-turut pada akun Anda.</p>
          <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; border: 1px solid #fee2e2; margin: 20px 0;">
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="font-weight: bold; width: 140px; color: #dc2626;">Tindakan Keamanan:</td>
                <td><strong>Akun Dikunci Sementara Selama 24 Jam</strong></td>
              </tr>
              <tr>
                <td style="font-weight: bold; color: #dc2626;">Alamat IP Penyerang:</td>
                <td><code style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${ip}</code></td>
              </tr>
              <tr>
                <td style="font-weight: bold; color: #dc2626;">Detail Perangkat:</td>
                <td>${device}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; color: #dc2626;">Waktu Terjadi:</td>
                <td>${new Date().toLocaleString('id-ID')} WIB</td>
              </tr>
            </table>
          </div>
          <p style="color: #4b5563;">Jika Anda merasa tidak melakukan percobaan login ini, kemungkinan seseorang sedang mencoba meretas akun Anda (brute force attack).</p>
          <p style="color: #dc2626; font-weight: bold;">Rekomendasi Keamanan:</p>
          <ul style="color: #4b5563; padding-left: 20px;">
            <li>Jangan panik. Akun Anda saat ini terkunci dengan aman dari percobaan luar.</li>
            <li>Setelah masa penguncian selesai, segera ubah kata sandi akun Anda ke kombinasi yang lebih kuat.</li>
            <li>Gunakan otentikasi Google jika memungkinkan untuk keamanan ekstra.</li>
          </ul>
          <hr style="border: none; border-top: 1px solid #fca5a5; margin: 25px 0 15px 0;" />
          <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">Email otomatis sistem keamanan RestoBook. Harap tidak membalas.</p>
        </div>
      `
    });
  } catch (err) {
    console.error('Error sending brute force security email:', err);
  }
}

// ── Helper: Kirim Email Notifikasi Lokasi Baru ──────────────────────
async function sendNewLocationEmail(email: string, fullName: string, country: string, city: string, ip: string, device: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !email) return;

  try {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: 'RestoBook Security <security@restobookid.my.id>',
      to: email,
      subject: 'Pemberitahuan Masuk Akun dari Lokasi Baru',
      html: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #ea580c; text-align: center; margin-top: 0;">Deteksi Lokasi Masuk Baru</h2>
          <p>Halo <strong>${fullName}</strong>,</p>
          <p>Sistem kami mendeteksi bahwa akun RestoBook Anda telah berhasil masuk dari <strong>kombinasi negara atau kota baru</strong> yang belum pernah Anda gunakan sebelumnya.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="font-weight: bold; width: 140px; color: #4b5563;">Lokasi Terdeteksi:</td>
                <td><strong>${city}, ${country}</strong></td>
              </tr>
              <tr>
                <td style="font-weight: bold; color: #4b5563;">Alamat IP:</td>
                <td><code style="background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${ip}</code></td>
              </tr>
              <tr>
                <td style="font-weight: bold; color: #4b5563;">Perangkat:</td>
                <td>${device}</td>
              </tr>
              <tr>
                <td style="font-weight: bold; color: #4b5563;">Waktu Masuk:</td>
                <td>${new Date().toLocaleString('id-ID')} WIB</td>
              </tr>
            </table>
          </div>
          <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 6px; font-size: 13px; color: #991b1b; margin-bottom: 20px;">
            <strong>BUKAN AKTIVITAS ANDA?</strong> Jika Anda tidak merasa masuk dari lokasi ini, kemungkinan akun Anda telah disusupi oleh pihak lain. Harap segera login kembali dan ganti kata sandi akun Anda, lalu hubungi layanan bantuan kami.
          </div>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0 15px 0;" />
          <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">Email otomatis sistem keamanan RestoBook. Harap tidak membalas.</p>
        </div>
      `
    });
  } catch (err) {
    console.error('Error sending geo-alert security email:', err);
  }
}
