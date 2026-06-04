export const runtime = 'edge';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID diperlukan' }, { status: 400 });
    }

    // 1. Fetch current profile data (for audit_logs and deleting auth user)
    const { data: profile, error: getError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (getError || !profile) {
      return NextResponse.json({ error: 'Karyawan tidak ditemukan' }, { status: 404 });
    }

    // Get current admin user details (operator)
    const clientSupabase = createServerSupabaseClient();
    const { data: { user: operatorUser } } = await clientSupabase.auth.getUser();
    
    let operatorProfile = null;
    if (operatorUser) {
      const { data: opData } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name')
        .eq('user_id', operatorUser.id)
        .single();
      operatorProfile = opData;
    }

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

    // 3. Save Audit Log BEFORE deletion
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown Browser';
    
    let device = 'Desktop';
    if (/mobile/i.test(userAgent)) device = 'Mobile';
    else if (/tablet/i.test(userAgent)) device = 'Tablet';

    await supabaseAdmin.from('audit_logs').insert({
      action: 'delete',
      operator_id: operatorProfile?.id || null,
      operator_name: operatorProfile?.full_name || 'Admin RestoBook',
      target_id: profile.id,
      target_name: profile.full_name,
      data_before: profile,
      data_after: null,
      ip_address: ip,
      browser: userAgent,
      device: device
    });

    // 4. Hapus dari Supabase Auth (Akun Login)
    if (profile.user_id) {
      try {
        await supabaseAdmin.auth.admin.deleteUser(profile.user_id);
      } catch (authError) {
        console.error("Auth user deletion skipped or failed:", authError);
      }
    }

    // 5. Hapus dari tabel Profiles
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
