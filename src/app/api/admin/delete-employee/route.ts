import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID diperlukan' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Ambil data profil untuk mendapatkan user_id (UUID Auth)
    const { data: profile, error: getError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, id')
      .eq('id', userId)
      .single();

    if (getError) throw getError;

    // 2. TANGANI FOREIGN KEY (Orders & Attendance)
    // Kosongkan link di orders agar transaksi tidak hilang tapi karyawan bisa dihapus
    await supabaseAdmin
      .from('orders')
      .update({ cashier_id: null })
      .eq('cashier_id', userId);

    // Hapus data absensi lama agar akun benar-benar "fresh" jika daftar lagi
    await supabaseAdmin
      .from('attendance')
      .delete()
      .eq('employee_id', userId);

    // 3. Hapus dari Supabase Auth (Akun Login)
    if (profile?.user_id) {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(profile.user_id);
      // Abaikan jika user tidak ada di auth
    }

    // 4. Hapus dari tabel Profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) throw profileError;

    return NextResponse.json({ message: 'Karyawan dan akun berhasil dihapus permanen' });
  } catch (error: any) {
    console.error('Delete Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
