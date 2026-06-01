export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export async function POST(req: Request) {
  try {
    const { email, password, fullName, phone, code } = await req.json();
    console.log('[Register] Starting registration for:', email);

    if (!email || !password || !fullName || !code) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Double check OTP
    const { data: otpData, error: otpError } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('type', 'registration')
      .eq('is_used', true)
      .single();

    console.log('[Register] OTP check:', otpData ? 'found' : 'not found', otpError?.message || '');

    if (!otpData) {
      return NextResponse.json({ error: 'OTP belum diverifikasi' }, { status: 400 });
    }

    // Try signUp instead of admin.createUser
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || '',
        },
      },
    });

    console.log('[Register] SignUp result:', JSON.stringify({ 
      userId: signUpData?.user?.id, 
      error: signUpError?.message 
    }));

    let userId: string;

    if (signUpError) {
      // If user already exists, try to find them
      if (signUpError.message.includes('already') || signUpError.message.includes('exists') || signUpError.message.includes('duplicate')) {
        console.log('[Register] User might already exist, trying to find...');
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = listData?.users?.find((u: any) => u.email === email);
        
        if (existingUser) {
          console.log('[Register] Found existing user:', existingUser.id);
          // Update password
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            password,
            email_confirm: true,
          });
          userId = existingUser.id;
        } else {
          console.error('[Register] Cannot find existing user either');
          return NextResponse.json({ error: signUpError.message }, { status: 400 });
        }
      } else {
        console.error('[Register] SignUp error:', signUpError.message);
        return NextResponse.json({ error: signUpError.message }, { status: 400 });
      }
    } else {
      userId = signUpData.user!.id;
      
      // Auto-confirm email via admin
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });
      console.log('[Register] User created and confirmed:', userId);
    }

    // Upsert profile (insert or update if exists)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: userId,
        full_name: fullName,
        phone: phone || null,
        role: 'customer',
      }, {
        onConflict: 'user_id',
      });

    if (profileError) {
      console.error('[Register] Profile error:', profileError.message);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    // Send Welcome Gift notification and email notice
    try {
      const { data: settings } = await supabaseAdmin
        .from('restaurant_settings')
        .select('welcome_gift_enabled, welcome_gift_points')
        .single();

      if (settings && settings.welcome_gift_enabled) {
        const points = settings.welcome_gift_points || 1000;
        
        // Fetch created profile id
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('user_id', userId)
          .single();
          
        if (profile) {
          await supabaseAdmin.from('notifications').insert({
            user_id: profile.id,
            title: 'Hadiah Selamat Datang Menanti!',
            message: `Selamat bergabung! Anda mendapatkan Hadiah Selamat Datang sebesar ${points.toLocaleString('id-ID')} Poin Reward yang siap diklaim di halaman dashboard utama Anda.`,
            type: 'point',
            points: points,
            status_badge: 'Pending'
          });

          // Send welcome notice email
          const resendKey = process.env.RESEND_API_KEY;
          if (email && resendKey) {
            const resend = new Resend(resendKey);
            await resend.emails.send({
              from: 'RestoBook <noreply@restobookid.my.id>',
              to: email,
              subject: 'Selamat Bergabung di RestoBook! Ada Hadiah Poin Untukmu',
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #fff8f0; border-radius: 16px; border: 1px solid #e85d04;">
                  <h2 style="color: #e85d04; text-align: center; margin-bottom: 20px;">Selamat Bergabung di RestoBook!</h2>
                  <p>Halo <strong>${fullName}</strong>,</p>
                  <p>Terima kasih telah melakukan pendaftaran di RestoBook. Akun Anda telah berhasil diverifikasi dan siap digunakan.</p>
                  <p>Sebagai ucapan terima kasih kami, kami telah menyiapkan <strong>Hadiah Selamat Datang sebesar ${points.toLocaleString('id-ID')} Poin Reward</strong> secara gratis untuk Anda!</p>
                  <p>Hadiah ini belum dimasukkan ke saldo Anda. Silakan login ke akun Anda dan masuk ke halaman Dashboard utama untuk mengklaim poin reward Anda.</p>
                  <p>Selamat mencoba dan selamat memesan!</p>
                  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                  <p style="font-size: 11px; color: #888; text-align: center;">(C) 2026 RestoBook Management System. Semua hak dilindungi.</p>
                </div>
              `
            });
          }
        }
      }
    } catch (err: any) {
      console.error('[Register] Welcome gift notification error:', err.message);
    }

    console.log('[Register] Registration complete for:', email);
    return NextResponse.json({ success: true, message: 'Pendaftaran berhasil' });
  } catch (error: any) {
    console.error('[Register] Unexpected error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
