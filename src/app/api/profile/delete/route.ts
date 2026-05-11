export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // 1. Dapatkan profile ID untuk pembersihan data berelasi
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      // Jika profil tidak ditemukan, langsung bersihkan akun Auth
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ success: true, message: 'Akun berhasil dihapus' });
    }

    const profileId = profile.id;

    // 2. Hapus ulasan dari pelanggan ini
    await supabaseAdmin.from('reviews').delete().eq('customer_id', profileId);

    // 3. Dapatkan daftar pesanan pelanggan untuk menghapus detail pesanan (order_items) terlebih dahulu
    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id')
      .eq('customer_id', profileId);

    if (orders && orders.length > 0) {
      const orderIds = orders.map((o: any) => o.id);
      await supabaseAdmin.from('order_items').delete().in('order_id', orderIds);
    }

    // 4. Hapus pesanan pelanggan
    await supabaseAdmin.from('orders').delete().eq('customer_id', profileId);

    // 5. Hapus reservasi meja pelanggan
    await supabaseAdmin.from('reservations').delete().eq('customer_id', profileId);

    // 6. Hapus menu favorit pelanggan
    await supabaseAdmin.from('favorites').delete().eq('customer_id', profileId);

    // 7. Hapus notifikasi pelanggan
    await supabaseAdmin.from('notifications').delete().eq('user_id', profileId);

    // 8. Hapus Akun Auth Utama di Supabase (Hal ini otomatis memicu cascade delete di tabel profiles)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw authError;

    return NextResponse.json({ success: true, message: 'Seluruh data akun berhasil dihapus sepenuhnya tanpa sisa' });
  } catch (error: any) {
    console.error('Delete account API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
