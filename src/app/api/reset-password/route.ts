import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { email, password, code } = await req.json();

    if (!email || !password || !code) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Double check OTP
    const { data: otpData } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('type', 'forgot_password')
      .eq('is_used', true)
      .single();

    if (!otpData) {
      return NextResponse.json({ error: 'OTP belum diverifikasi' }, { status: 400 });
    }

    // Get user id by email
    const { data: { users }, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (userError) throw userError;

    const user = users.find(u => u.email === email);

    if (!user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    // Update password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password }
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // 4. Kirim Notifikasi Sukses
    try {
      const { data: profile } = await supabaseAdmin.from('profiles').select('full_name, phone').eq('email', email).single();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      
      await fetch(`${appUrl}/api/send-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email,
          phone: profile?.phone,
          name: profile?.full_name || 'User',
          type: 'reset_success'
        })
      });
    } catch (e) {
      console.error('Notification failed:', e);
    }

    return NextResponse.json({ success: true, message: 'Password berhasil diubah' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
