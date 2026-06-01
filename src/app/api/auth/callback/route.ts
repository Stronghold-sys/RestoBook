export const runtime = 'edge';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

// ── Helper: Extract IP address silently from request headers ──
function getClientIp(request: Request): string {
  const headers = [
    'x-real-ip',
    'x-forwarded-for',
    'cf-connecting-ip',      // Cloudflare
    'x-client-ip',
    'x-cluster-client-ip',
    'forwarded-for',
    'forwarded',
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can be a comma-separated list; take the first (client IP)
      const ip = value.split(',')[0].trim();
      if (ip && ip !== '::1' && ip !== '127.0.0.1') return ip;
    }
  }
  return 'Tidak terdeteksi';
}

// ── Helper: Parse User-Agent to human-readable device info ──
function parseUserAgent(ua: string | null): string {
  if (!ua) return 'Perangkat tidak diketahui';

  let browser = 'Browser tidak diketahui';
  let os = 'OS tidak diketahui';

  // Detect OS
  if (/windows nt/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  // Detect Browser
  if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/opr\//i.test(ua)) browser = 'Opera';
  else if (/chrome/i.test(ua)) browser = 'Google Chrome';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/firefox/i.test(ua)) browser = 'Firefox';

  return `${browser} di ${os}`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const originUrl = host ? `${protocol}://${host}` : origin;
  const code = searchParams.get('code');
  const isIdToken = searchParams.get('idtoken') === 'true';
  const userIdParam = searchParams.get('userId');
  const next = searchParams.get('next') ?? '/customer/dashboard';

  // Silently collect IP & device info
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || null;
  const deviceInfo = parseUserAgent(userAgent);

  // ─── Flow 2: ID Token flow (client-side signInWithIdToken already done) ───
  // Just handle profile provisioning & email
  if (isIdToken && userIdParam) {
    try {
      const supabaseAdmin = getSupabaseAdmin();
      
      // Get user data from Supabase Auth
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(userIdParam);
      if (!authData?.user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const user = authData.user;
      const userEmail = user.email || '';
      const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User Google';
      const resendKey = process.env.RESEND_API_KEY;

      // Check if profile exists
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role, full_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) {
        // Auto-provision customer profile for new OAuth signup
        await supabaseAdmin.from('profiles').insert({
          user_id: user.id,
          full_name: fullName,
          email: userEmail,
          avatar_url: user.user_metadata?.avatar_url || '',
          role: 'customer',
        });

        // Send Welcome Email
        if (resendKey && userEmail) {
          await sendWelcomeEmail(resendKey, userEmail, fullName, ipAddress, deviceInfo);
        }

        return NextResponse.json({ success: true, action: 'registered', role: 'customer' });
      } else {
        // Existing user — send login notification with IP
        if (resendKey && userEmail) {
          await sendLoginNotificationEmail(resendKey, userEmail, profile.full_name || fullName, ipAddress, deviceInfo, 'Google OAuth');
        }

        return NextResponse.json({ success: true, action: 'login', role: profile.role || 'customer' });
      }
    } catch (e) {
      console.error('ID Token callback error:', e);
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  }

  // ─── Flow 1: Standard OAuth code exchange flow (legacy/fallback) ───
  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The setAll method was called from a Server Component.
            }
          },
        },
      }
    );

    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const supabaseAdmin = getSupabaseAdmin();
          
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role, full_name')
            .eq('user_id', user.id)
            .maybeSingle();

          const userEmail = user.email || '';
          const fullName = user.user_metadata?.full_name || profile?.full_name || user.email?.split('@')[0] || 'User Google';
          const resendKey = process.env.RESEND_API_KEY;

          if (!profile) {
            await supabaseAdmin.from('profiles').insert({
              user_id: user.id,
              full_name: fullName,
              email: userEmail,
              avatar_url: user.user_metadata?.avatar_url || '',
              role: 'customer',
            });

            if (resendKey && userEmail) {
              await sendWelcomeEmail(resendKey, userEmail, fullName, ipAddress, deviceInfo);
            }
            
            return NextResponse.redirect(`${originUrl}/customer/dashboard`);
          } else {
            const role = profile.role || 'customer';

            if (resendKey && userEmail) {
              await sendLoginNotificationEmail(resendKey, userEmail, profile.full_name || fullName, ipAddress, deviceInfo, 'Google OAuth');
            }

            return NextResponse.redirect(`${originUrl}/${role}/dashboard`);
          }
        }
      }
    } catch (e) {
      console.error('OAuth Callback exchange error:', e);
    }
  }

  // Return the user to an error page or home if something goes wrong
  return NextResponse.redirect(`${originUrl}/login?error=OAuthCallbackError`);
}

// ── Helper: Send Welcome Email ──
async function sendWelcomeEmail(resendKey: string, userEmail: string, fullName: string, ipAddress: string, deviceInfo: string) {
  try {
    const resend = new Resend(resendKey);
    const formattedTime = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'long',
      timeStyle: 'short'
    });

    await resend.emails.send({
      from: 'RestoBook <noreply@restobookid.my.id>',
      to: userEmail,
      subject: 'Selamat Bergabung di RestoBook!',
      html: `
        <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #ea580c; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
            <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Sistem Pemesanan Restoran Modern</p>
          </div>
          <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
          <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Selamat Bergabung, ${fullName}!</h2>
          <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
            Terima kasih telah mendaftar di <strong>RestoBook</strong> menggunakan akun Google Anda. Kami sangat senang bisa menjadi bagian dari pengalaman kuliner Anda.
          </p>
          <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 16px; border-radius: 8px; margin: 24px 0;">
            <h3 style="color: #c2410c; margin: 0 0 8px 0; font-size: 14px; font-weight: 700; text-transform: uppercase;">Detail Akun Anda</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #9a3412; font-weight: 600; width: 140px;">Nama:</td>
                <td style="padding: 6px 0; color: #4b5563;">${fullName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #9a3412; font-weight: 600;">Email:</td>
                <td style="padding: 6px 0; color: #4b5563;"><a href="mailto:${userEmail}" style="color: #ea580c;">${userEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #9a3412; font-weight: 600;">Metode Daftar:</td>
                <td style="padding: 6px 0; color: #4b5563;">Google OAuth</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #9a3412; font-weight: 600;">Waktu Daftar:</td>
                <td style="padding: 6px 0; color: #4b5563;">${formattedTime} WIB</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #9a3412; font-weight: 600;">Alamat IP:</td>
                <td style="padding: 6px 0; color: #4b5563; font-family: monospace;">${ipAddress}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #9a3412; font-weight: 600;">Perangkat:</td>
                <td style="padding: 6px 0; color: #4b5563;">${deviceInfo}</td>
              </tr>
            </table>
          </div>
          <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
            Sekarang Anda sudah bisa memesan meja restoran favorit Anda, melihat menu lezat, dan memesan makanan secara instan dan efisien.
          </p>
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 14px; border-radius: 8px; margin: 20px 0; font-size: 13px; color: #991b1b; line-height: 1.6;">
            <strong>Pemberitahuan Keamanan:</strong> Jika Anda tidak merasa mendaftarkan akun ini, segera hubungi tim dukungan kami. IP Address yang tercatat: <code style="background: #fee2e2; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${ipAddress}</code>
          </div>
          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
          <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
            Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
          </p>
        </div>
      `
    });
  } catch (emailErr) {
    console.error('Welcome email sending error:', emailErr);
  }
}

// ── Helper: Send Login Notification Email with IP Address ──
async function sendLoginNotificationEmail(
  resendKey: string,
  userEmail: string,
  fullName: string,
  ipAddress: string,
  deviceInfo: string,
  loginMethod: string = 'Google OAuth'
) {
  try {
    const formattedTime = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'long',
      timeStyle: 'short'
    });
    
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: 'RestoBook <noreply@restobookid.my.id>',
      to: userEmail,
      subject: 'Notifikasi Masuk Akun RestoBook',
      html: `
        <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #ea580c; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
            <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Sistem Pemesanan Restoran Modern</p>
          </div>
          <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
          <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Halo, ${fullName}!</h2>
          <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
            Kami mendeteksi aktivitas masuk baru pada akun <strong>RestoBook</strong> Anda. Berikut adalah informasi lengkap mengenai aktivitas masuk tersebut:
          </p>
          <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 12px; margin: 24px 0;">
            <h3 style="color: #374151; margin: 0 0 14px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Informasi Masuk</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 7px 0; color: #6b7280; font-weight: 600; width: 140px;">Email:</td>
                <td style="padding: 7px 0; color: #111827;"><a href="mailto:${userEmail}" style="color: #ea580c; text-decoration: none;">${userEmail}</a></td>
              </tr>
              <tr>
                <td style="padding: 7px 0; color: #6b7280; font-weight: 600;">Metode Masuk:</td>
                <td style="padding: 7px 0; color: #111827;">${loginMethod}</td>
              </tr>
              <tr>
                <td style="padding: 7px 0; color: #6b7280; font-weight: 600;">Waktu:</td>
                <td style="padding: 7px 0; color: #111827;">${formattedTime} WIB</td>
              </tr>
              <tr>
                <td style="padding: 7px 0; color: #6b7280; font-weight: 600;">Alamat IP:</td>
                <td style="padding: 7px 0; color: #111827; font-family: monospace; background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px;">${ipAddress}</td>
              </tr>
              <tr>
                <td style="padding: 7px 0; color: #6b7280; font-weight: 600;">Perangkat:</td>
                <td style="padding: 7px 0; color: #111827;">${deviceInfo}</td>
              </tr>
            </table>
          </div>
          <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #166534; line-height: 1.6;">
            <strong>Ini aktivitas Anda?</strong> Jika ya, Anda dapat mengabaikan email ini dengan aman.
          </div>
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 14px; border-radius: 8px; margin: 20px 0; font-size: 14px; color: #991b1b; line-height: 1.6;">
            <strong>Bukan aktivitas Anda?</strong> Jika Anda tidak merasa melakukan login ini, kemungkinan akun Anda sedang digunakan oleh pihak lain dari IP <code style="background: #fee2e2; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${ipAddress}</code>. Segera ganti kata sandi Anda dan hubungi layanan bantuan kami.
          </div>
          <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
          <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
            Email ini dikirim secara otomatis oleh sistem keamanan RestoBook. Harap jangan membalas email ini.
          </p>
        </div>
      `
    });
  } catch (emailErr) {
    console.error('Login notification email sending error:', emailErr);
  }
}
