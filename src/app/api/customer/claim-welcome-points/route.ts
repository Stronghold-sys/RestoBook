export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Silakan login kembali' }, { status: 401 });
    }

    // 1. Fetch profile details
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, welcome_gift_claimed, email')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    if (profile.welcome_gift_claimed) {
      return NextResponse.json({ error: 'Hadiah selamat datang sudah diklaim sebelumnya.' }, { status: 400 });
    }

    // 2. Fetch welcome settings
    const { data: settings } = await supabaseAdmin
      .from('restaurant_settings')
      .select('welcome_gift_enabled, welcome_gift_points')
      .single();

    if (!settings || !settings.welcome_gift_enabled) {
      return NextResponse.json({ error: 'Program hadiah selamat datang sedang dinonaktifkan oleh restoran.' }, { status: 400 });
    }

    const pointsToAward = settings.welcome_gift_points || 1000;

    // 3. Fetch current points to prevent concurrency issues
    const { data: profilePoints } = await supabaseAdmin
      .from('profiles')
      .select('points')
      .eq('id', profile.id)
      .single();

    const currentPoints = profilePoints?.points || 0;
    const newPoints = currentPoints + pointsToAward;

    // 4. Update profile welcome_gift_claimed and points
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        welcome_gift_claimed: true,
        points: newPoints
      })
      .eq('id', profile.id);

    if (updateError) throw updateError;

    // 5. Create point transaction
    const { error: txError } = await supabaseAdmin
      .from('point_transactions')
      .insert({
        customer_id: profile.id,
        points: pointsToAward,
        status: 'earned',
        description: 'Hadiah Selamat Datang Pelanggan Baru'
      });

    if (txError) console.error("Error creating welcome points transaction:", txError);

    // 6. Create notification
    const { error: notifError } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: profile.id,
        title: 'Klaim Hadiah Selamat Datang Berhasil',
        message: `Selamat! Hadiah selamat datang sebesar ${pointsToAward.toLocaleString('id-ID')} Poin Reward telah berhasil dikreditkan ke akun Anda.`,
        type: 'point',
        points: pointsToAward,
        status_badge: 'Berhasil'
      });

    if (notifError) console.error("Error creating welcome points notification:", notifError);

    // 7. Send Email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (profile.email && resendKey) {
      try {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: 'RestoBook <noreply@restobookid.my.id>',
          to: profile.email,
          subject: 'Hadiah Selamat Datang Berhasil Diklaim!',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #fff8f0; border-radius: 16px; border: 1px solid #e85d04;">
              <h2 style="color: #e85d04; text-align: center; margin-bottom: 20px;">Selamat! Klaim Hadiah Berhasil</h2>
              <p>Halo <strong>${profile.full_name}</strong>,</p>
              <p>Terima kasih telah bergabung di <strong>RestoBook</strong>!</p>
              <p>Kami konfirmasikan bahwa Anda telah berhasil mengklaim <strong>${pointsToAward.toLocaleString('id-ID')} Poin Reward</strong> sebagai Hadiah Selamat Datang spesial dari kami.</p>
              <p>Poin ini sudah dapat Anda gunakan untuk menukarkan berbagai penawaran voucher belanja, cashback saldo, serta makanan gratis yang tersedia pada halaman Reward pelanggan.</p>
              <p>Semoga Anda menikmati pengalaman bersantap yang luar biasa bersama RestoBook!</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="font-size: 11px; color: #888; text-align: center;">(C) 2026 RestoBook Management System. Semua hak dilindungi.</p>
            </div>
          `
        });
      } catch (emailErr) {
        console.error("Error sending welcome points email:", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Hadiah selamat datang berhasil diklaim!',
      points: pointsToAward,
      newPoints
    });

  } catch (error: any) {
    console.error('Claim welcome points error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
