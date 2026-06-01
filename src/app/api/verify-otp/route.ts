import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { email, code, type } = await req.json();

    if (!email || !code || !type) {
      return NextResponse.json({ error: 'Email, code, dan type wajib diisi' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('type', type)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Kode OTP tidak valid atau sudah kedaluwarsa' }, { status: 400 });
    }

    // Set is_used = true
    await supabaseAdmin
      .from('otp_codes')
      .update({ is_used: true })
      .eq('id', data.id);

    // Kirim Notifikasi Selamat Datang jika Registrasi
    if (type === 'registration') {
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
            type: 'welcome'
          })
        });
      } catch (e) { console.error('Welcome notification failed:', e); }
    }

    return NextResponse.json({ success: true, message: 'OTP berhasil diverifikasi' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
