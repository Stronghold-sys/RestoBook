export const runtime = 'edge';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { userId, newPassword } = await req.json();

    if (!userId || !newPassword) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }


    // 1. Update Password in Supabase Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (authError) throw authError;

    // 2. Update temp_password in profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ temp_password: newPassword })
      .eq('user_id', userId);

    if (profileError) throw profileError;

    // 3. Kirim Notifikasi via WhatsApp
    try {
      const { data: profile } = await supabaseAdmin.from('profiles').select('full_name, phone').eq('user_id', userId).single();
      
      if (profile?.phone) {
        const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
        const cleanPhone = profile.phone.replace(/[^0-9]/g, '');
        const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('8') ? '62' + cleanPhone : cleanPhone);

        const waMessage = `*RESET PASSWORD AKUN RESTOBOOK*\n\nHalo *${profile.full_name}*,\n\nAdmin baru saja menyetel ulang password akun Anda. Berikut adalah password baru Anda:\n\n*Password Sementara:* ${newPassword}\n\n*PENTING:* Password ini bersifat sementara. Anda *WAJIB* segera mengubahnya melalui menu Profil setelah login demi keamanan akun Anda.\n\nTerima kasih,\n*Manajemen RestoBook*`;

        await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: { 'Authorization': FONNTE_TOKEN },
          body: new URLSearchParams({
            'target': formattedPhone,
            'message': waMessage,
            'countryCode': '62'
          })
        });
      }
    } catch (waErr) {
      console.error("WhatsApp sending failed during reset:", waErr);
    }

    return NextResponse.json({ message: 'Password berhasil di-reset' });
  } catch (error: any) {
    console.error('Reset Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
