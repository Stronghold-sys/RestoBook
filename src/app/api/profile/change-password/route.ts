import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { email, otp, newPassword, userId } = await req.json();

    if (!email || !otp || !newPassword || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 0. Verify OTP from Database
    const { data: otpData, error: otpError } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('code', otp)
      .eq('type', 'forgot_password') // Gunakan tipe yang valid di DB
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (otpError || !otpData) {
      return NextResponse.json({ error: 'Kode OTP tidak valid atau sudah kadaluwarsa' }, { status: 400 });
    }

    // 1. Update Password in Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (authError) throw authError;

    // 2. Mark OTP as used
    await supabaseAdmin.from('otp_codes').update({ is_used: true }).eq('id', otpData.id);

    // 3. Kirim Notifikasi Sukses
    try {
      const { data: profile } = await supabaseAdmin.from('profiles').select('full_name, phone').eq('user_id', userId).single();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      await fetch(`${appUrl}/api/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          phone: profile?.phone,
          name: profile?.full_name || 'User',
          type: 'change_password_success'
        })
      });
    } catch (e) { console.error('Notification failed:', e); }

    return NextResponse.json({ success: true, message: 'Password berhasil diubah' });

  } catch (error: any) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
