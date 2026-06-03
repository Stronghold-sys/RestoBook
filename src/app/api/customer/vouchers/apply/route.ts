export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, customerId, subtotal, orderType } = body;

    if (!code) {
      return NextResponse.json({ error: 'Kode voucher tidak boleh kosong' }, { status: 400 });
    }

    // 1. Cari voucher berdasarkan kode (case-insensitive)
    const uppercaseCode = code.toUpperCase().trim();
    const { data: voucher, error: voucherError } = await supabaseAdmin
      .from('vouchers')
      .select('*')
      .eq('code', uppercaseCode)
      .maybeSingle();

    if (voucherError) throw voucherError;

    if (!voucher) {
      return NextResponse.json({ error: 'Voucher tidak ditemukan!' }, { status: 404 });
    }

    // 2. Periksa status keaktifan
    if (!voucher.is_active) {
      return NextResponse.json({ error: 'Voucher tidak aktif!' }, { status: 400 });
    }

    // 3. Periksa kedaluwarsa
    const now = new Date();
    const expiresAt = new Date(voucher.expires_at);
    if (expiresAt <= now) {
      return NextResponse.json({ error: 'Voucher sudah kadaluarsa!' }, { status: 400 });
    }

    // 4. Periksa limit penggunaan global (total_limit)
    if (voucher.used_count >= voucher.usage_limit) {
      return NextResponse.json({ error: 'Batas penggunaan voucher telah habis!' }, { status: 400 });
    }

    // 5. Tentukan Customer ID jika ada
    let resolvedCustomerId = customerId || null;

    if (!resolvedCustomerId) {
      // Coba dapatkan dari login session jika customerId tidak diberikan
      const supabase = createServerSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
        if (profile) {
          resolvedCustomerId = profile.id;
        }
      }
    }

    // 6. Periksa limit penggunaan khusus user terkait
    if (resolvedCustomerId) {
      const { data: cv, error: cvError } = await supabaseAdmin
        .from('customer_vouchers')
        .select('used_count')
        .eq('customer_id', resolvedCustomerId)
        .eq('voucher_id', voucher.id)
        .maybeSingle();

      if (cvError) throw cvError;

      if (cv && cv.used_count >= voucher.max_usage_per_user) {
        return NextResponse.json({ error: 'Anda telah mencapai batas maksimal penggunaan voucher ini!' }, { status: 400 });
      }
    }

    // 6.5 Periksa tipe pesanan berdasarkan tipe voucher
    if (voucher.voucher_type === 'shipping') {
      if (orderType !== 'delivery') {
        return NextResponse.json({ error: 'Voucher ongkir hanya dapat digunakan untuk tipe pesanan Delivery!' }, { status: 400 });
      }
    } else if (voucher.voucher_type === 'general' || !voucher.voucher_type) {
      if (orderType && !['dine_in', 'takeaway', 'delivery'].includes(orderType)) {
        return NextResponse.json({ error: 'Voucher umum hanya dapat digunakan untuk tipe pesanan Dine In, Takeaway, dan Delivery!' }, { status: 400 });
      }
    }

    // 7. Periksa minimal transaksi
    if (voucher.min_transaction && subtotal !== undefined && Number(subtotal) < Number(voucher.min_transaction)) {
      return NextResponse.json({ 
        error: `Minimal transaksi untuk menggunakan voucher ini adalah Rp ${Number(voucher.min_transaction).toLocaleString('id-ID')}` 
      }, { status: 400 });
    }

    // Jika semua lolos validasi, kembalikan detail voucher dan diskon
    return NextResponse.json({
      success: true,
      voucher: {
        id: voucher.id,
        code: voucher.code,
        discount_percent: voucher.discount_percent,
        usage_limit: voucher.usage_limit,
        max_usage_per_user: voucher.max_usage_per_user,
        used_count: voucher.used_count,
        voucher_type: voucher.voucher_type || 'general',
        discount_type: voucher.discount_type || 'percent',
        discount_value: Number(voucher.discount_value || 0),
        min_transaction: Number(voucher.min_transaction || 0)
      },
      message: 'Voucher berhasil digunakan!'
    });

  } catch (error: any) {
    console.error('Apply voucher error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
