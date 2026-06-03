export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { email, otp, newPassword, userId, isAdminBypass } = await req.json();

    if (!email || !newPassword || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (isAdminBypass) {
      // Security Check: Verify that the user actually has the admin role in database
      const { data: prof, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('user_id', userId)
        .single();
        
      if (profErr || prof?.role !== 'admin') {
        return NextResponse.json({ error: 'Akses ditolak. Hanya admin yang dapat melewati verifikasi OTP.' }, { status: 403 });
      }
    } else {
      if (!otp) {
        return NextResponse.json({ error: 'Kode OTP wajib diisi' }, { status: 400 });
      }

      // 0. Verify OTP from Database (accept both change_password and forgot_password)
      const { data: otpData, error: otpError } = await supabaseAdmin
        .from('otp_codes')
        .select('*')
        .eq('email', email)
        .eq('code', otp)
        .in('type', ['change_password', 'forgot_password'])
        .eq('is_used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (otpError || !otpData) {
        return NextResponse.json({ error: 'Kode OTP tidak valid atau sudah kadaluwarsa' }, { status: 400 });
      }

      // Mark OTP as used
      await supabaseAdmin.from('otp_codes').update({ is_used: true }).eq('id', otpData.id);
    }

    // 1. Update Password in Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (authError) throw authError;

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
