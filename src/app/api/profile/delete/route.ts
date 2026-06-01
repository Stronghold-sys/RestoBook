import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // 1. Dapatkan profile lengkap untuk email perpisahan
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('user_id', userId)
      .single();

    // 2. Dapatkan data auth user untuk mendeteksi metode login (Google / Email)
    let loginMethod = 'Email';
    let userEmail = '';
    let userName = '';

    try {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (authUser?.user) {
        userEmail = authUser.user.email || '';
        userName = authUser.user.user_metadata?.full_name || '';
        
        // Deteksi metode login
        const providers = authUser.user.app_metadata?.providers || [];
        if (providers.includes('google') || authUser.user.app_metadata?.provider === 'google') {
          loginMethod = 'Google OAuth';
        }
      }
    } catch (e) {
      console.error('Error fetching auth user:', e);
    }

    // Gunakan data profile jika auth user tidak memiliki data lengkap
    if (profile) {
      userEmail = userEmail || profile.email || '';
      userName = userName || profile.full_name || '';
    }

    if (profileError && !profile) {
      // Jika profil tidak ditemukan, tetap kirim email jika ada email
      if (userEmail) {
        await sendFarewellEmail(userEmail, userName || 'Pengguna', loginMethod);
      }
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ success: true, message: 'Akun berhasil dihapus' });
    }

    const profileId = profile!.id;

    // 3. Hapus ulasan dari pelanggan ini
    await supabaseAdmin.from('reviews').delete().eq('customer_id', profileId);

    // 4. Dapatkan daftar pesanan pelanggan untuk menghapus detail pesanan (order_items) terlebih dahulu
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('customer_id', profileId);

    if (orders && orders.length > 0) {
      const orderIds = orders.map((o: any) => o.id);
      await supabaseAdmin.from('order_items').delete().in('order_id', orderIds);
    }

    // 5. Hapus pesanan pelanggan
    await supabaseAdmin.from('orders').delete().eq('customer_id', profileId);

    // 6. Hapus reservasi meja pelanggan
    await supabaseAdmin.from('reservations').delete().eq('customer_id', profileId);

    // 7. Hapus menu favorit pelanggan
    await supabaseAdmin.from('favorites').delete().eq('customer_id', profileId);

    // 8. Hapus notifikasi pelanggan
    await supabaseAdmin.from('notifications').delete().eq('user_id', profileId);

    // 9. Kirim email perpisahan SEBELUM menghapus akun auth
    if (userEmail) {
      await sendFarewellEmail(userEmail, userName || 'Pengguna', loginMethod);
    }

    // 10. Hapus Akun Auth Utama di Supabase (Hal ini otomatis memicu cascade delete di tabel profiles)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    return NextResponse.json({ success: true, message: 'Seluruh data akun berhasil dihapus sepenuhnya tanpa sisa' });
  } catch (error: any) {
    console.error('Delete account API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function sendFarewellEmail(email: string, fullName: string, loginMethod: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  try {
    const resend = new Resend(resendKey);
    const deletionTime = new Date().toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      dateStyle: 'full',
      timeStyle: 'short'
    });

    await resend.emails.send({
      from: 'RestoBook <noreply@restobookid.my.id>',
      to: email,
      subject: 'Akun Anda Telah Dihapus — Sampai Jumpa Lagi ',
      html: `
        <div style="font-family: 'Segoe UI', sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 0; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ea580c, #dc2626); padding: 32px 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">RestoBook</h1>
            <p style="color: rgba(255,255,255,0.85); font-size: 13px; margin-top: 4px; font-weight: 500;">Sistem Pemesanan Restoran Modern</p>
          </div>

          <!-- Body -->
          <div style="padding: 32px 28px;">
            <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin: 0 0 16px 0;">Sampai Jumpa, ${fullName}! </h2>
            
            <p style="line-height: 1.7; color: #4b5563; font-size: 15px; margin: 0 0 20px 0;">
              Kami ingin mengkonfirmasi bahwa akun <strong>RestoBook</strong> Anda telah berhasil dihapus secara permanen dari sistem kami sesuai permintaan Anda.
            </p>

            <!-- Detail Akun -->
            <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; border-radius: 8px; margin: 24px 0;">
              <h3 style="color: #991b1b; margin: 0 0 12px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Detail Akun yang Dihapus</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                  <td style="padding: 6px 0; color: #991b1b; font-weight: 600; width: 140px;">Nama Lengkap:</td>
                  <td style="padding: 6px 0; color: #4b5563;">${fullName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #991b1b; font-weight: 600;">Email:</td>
                  <td style="padding: 6px 0; color: #4b5563;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #991b1b; font-weight: 600;">Metode Login:</td>
                  <td style="padding: 6px 0; color: #4b5563;">${loginMethod}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #991b1b; font-weight: 600;">Waktu Penghapusan:</td>
                  <td style="padding: 6px 0; color: #4b5563;">${deletionTime} WIB</td>
                </tr>
              </table>
            </div>

            <!-- Data yang dihapus -->
            <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin: 24px 0;">
              <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Data yang Telah Dihapus</h3>
              <ul style="margin: 0; padding-left: 18px; color: #4b5563; font-size: 14px; line-height: 2;">
                <li>Profil dan informasi pribadi</li>
                <li>Riwayat seluruh pesanan dan transaksi</li>
                <li>Reservasi meja</li>
                <li>Ulasan dan rating</li>
                <li>Daftar menu favorit</li>
                <li>Seluruh notifikasi</li>
                <li>Akun login (${loginMethod})</li>
              </ul>
            </div>

            <p style="line-height: 1.7; color: #4b5563; font-size: 15px; margin: 20px 0;">
              Kami sangat berterima kasih atas waktu yang telah Anda habiskan bersama <strong>RestoBook</strong>. Jika suatu saat Anda ingin kembali, kami akan selalu menyambut Anda dengan tangan terbuka.
            </p>

            <p style="line-height: 1.7; color: #4b5563; font-size: 15px; margin: 20px 0;">
              Jika Anda merasa tidak melakukan penghapusan ini, harap segera hubungi tim support kami karena tindakan ini bersifat <strong>permanen dan tidak dapat dibatalkan</strong>.
            </p>

            <!-- CTA -->
            <div style="text-align: center; margin: 32px 0 16px 0;">
              <p style="color: #6b7280; font-size: 14px; font-style: italic;">"Terima kasih telah menjadi bagian dari keluarga RestoBook. Semoga kita bertemu lagi!"</p>
            </div>
          </div>

          <!-- Footer -->
          <div style="background-color: #f9fafb; padding: 20px 28px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0; line-height: 1.6;">
              Email ini dikirim secara otomatis oleh sistem RestoBook sebagai konfirmasi penghapusan akun. Harap jangan membalas email ini.<br/>
              &copy; ${new Date().getFullYear()} RestoBook. All rights reserved.
            </p>
          </div>
        </div>
      `
    });
  } catch (emailErr) {
    console.error('Farewell email sending error:', emailErr);
  }
}
