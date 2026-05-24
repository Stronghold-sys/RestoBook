export const runtime = 'edge';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/customer/dashboard';

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
              // This can be ignored if you have middleware refreshing user sessions.
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
          
          // Check if profile exists in database
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role, full_name')
            .eq('user_id', user.id)
            .maybeSingle();

          const userEmail = user.email || '';
          const fullName = user.user_metadata?.full_name || profile?.full_name || user.email?.split('@')[0] || 'User Google';
          const resendKey = process.env.RESEND_API_KEY;

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
              try {
                const resend = new Resend(resendKey);
                await resend.emails.send({
                  from: 'RestoBook <noreply@restobookid.my.id>',
                  to: userEmail,
                  subject: 'Selamat Bergabung di RestoBook! 🎉',
                  html: `
                    <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
                      <div style="text-align: center; margin-bottom: 24px;">
                        <h1 style="color: #ea580c; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                        <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Sistem Pemesanan Restoran Modern</p>
                      </div>
                      <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
                      <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Selamat Bergabung, ${fullName}! 🎉</h2>
                      <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                        Terima kasih telah mendaftar di <strong>RestoBook</strong> menggunakan akun Google Anda. Kami sangat senang bisa menjadi bagian dari pengalaman kuliner Anda.
                      </p>
                      <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 16px; border-radius: 8px; margin: 24px 0;">
                        <h3 style="color: #c2410c; margin: 0 0 8px 0; font-size: 14px; font-weight: 700; text-transform: uppercase;">Detail Akun Anda</h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                          <tr>
                            <td style="padding: 4px 0; color: #9a3412; font-weight: 600; width: 120px;">Nama:</td>
                            <td style="padding: 4px 0; color: #4b5563;">${fullName}</td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; color: #9a3412; font-weight: 600;">Email:</td>
                            <td style="padding: 4px 0; color: #4b5563;">${userEmail}</td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; color: #9a3412; font-weight: 600;">Metode Daftar:</td>
                            <td style="padding: 4px 0; color: #4b5563;">Google OAuth</td>
                          </tr>
                        </table>
                      </div>
                      <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                        Sekarang Anda sudah bisa memesan meja restoran favorit Anda, melihat menu lezat, dan memesan makanan secara instan dan efisien.
                      </p>
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
            
            return NextResponse.redirect(`${origin}/customer/dashboard`);
          } else {
            const role = profile.role || 'customer';

            // Send Login Notification Email
            if (resendKey && userEmail) {
              try {
                const formattedTime = new Date().toLocaleString('id-ID', {
                  timeZone: 'Asia/Jakarta',
                  dateStyle: 'medium',
                  timeStyle: 'short'
                });
                
                const resend = new Resend(resendKey);
                await resend.emails.send({
                  from: 'RestoBook <noreply@restobookid.my.id>',
                  to: userEmail,
                  subject: 'Notifikasi Masuk Akun RestoBook 🔑',
                  html: `
                    <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
                      <div style="text-align: center; margin-bottom: 24px;">
                        <h1 style="color: #ea580c; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                        <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Sistem Pemesanan Restoran Modern</p>
                      </div>
                      <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
                      <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Halo, ${fullName}! 👋</h2>
                      <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                        Kami mendeteksi aktivitas masuk baru pada akun <strong>RestoBook</strong> Anda menggunakan akun Google.
                      </p>
                      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px; margin: 24px 0;">
                        <h3 style="color: #374151; margin: 0 0 8px 0; font-size: 14px; font-weight: 700; text-transform: uppercase;">Informasi Masuk</h3>
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                          <tr>
                            <td style="padding: 4px 0; color: #6b7280; font-weight: 600; width: 120px;">Email:</td>
                            <td style="padding: 4px 0; color: #111827;">${userEmail}</td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">Metode Masuk:</td>
                            <td style="padding: 4px 0; color: #111827;">Google OAuth</td>
                          </tr>
                          <tr>
                            <td style="padding: 4px 0; color: #6b7280; font-weight: 600;">Waktu:</td>
                            <td style="padding: 4px 0; color: #111827;">${formattedTime} WIB</td>
                          </tr>
                        </table>
                      </div>
                      <p style="line-height: 1.6; color: #4b5563; font-size: 14px;">
                        Jika ini adalah aktivitas Anda, Anda bisa mengabaikan email ini. Jika Anda tidak merasa melakukan masuk ini, harap segera hubungi layanan bantuan kami.
                      </p>
                      <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
                      <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                        Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
                      </p>
                    </div>
                  `
                });
              } catch (emailErr) {
                console.error('Login notification email sending error:', emailErr);
              }
            }

            return NextResponse.redirect(`${origin}/${role}/dashboard`);
          }
        }
      }
    } catch (e) {
      console.error('OAuth Callback exchange error:', e);
    }
  }

  // Return the user to an error page or home if something goes wrong
  return NextResponse.redirect(`${origin}/login?error=OAuthCallbackError`);
}
