export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Silakan login kembali' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, wallet_balance')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    const body = await req.json();
    const { redemptionId } = body;

    if (!redemptionId) {
      return NextResponse.json({ error: 'ID Penukaran harus diisi' }, { status: 400 });
    }

    // 1. Ambil detail penukaran reward
    const { data: redemption, error: redErr } = await supabaseAdmin
      .from('reward_redemptions')
      .select('*, rewards(*)')
      .eq('id', redemptionId)
      .eq('customer_id', profile.id)
      .maybeSingle();

    if (redErr || !redemption) {
      return NextResponse.json({ error: 'Data penukaran reward tidak ditemukan' }, { status: 404 });
    }

    if (redemption.status === 'used' || redemption.used_at !== null) {
      return NextResponse.json({ error: 'Reward ini sudah pernah digunakan atau diaktifkan' }, { status: 400 });
    }

    const category = redemption.rewards?.category || 'custom';

    if (category === 'cashback') {
      // --- LOGIKA CASHBACK ---
      const cashbackAmount = Number(redemption.cashback_amount || redemption.rewards?.cashback_amount || 0);

      if (cashbackAmount <= 0) {
        return NextResponse.json({ error: 'Jumlah nominal cashback tidak valid' }, { status: 400 });
      }

      const currentBalance = Number(profile.wallet_balance || 0);
      const newBalance = currentBalance + cashbackAmount;

      // Update wallet_balance pelanggan
      const { error: balErr } = await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', profile.id);

      if (balErr) throw balErr;

      // Log transaksi saldo dompet
      const { error: txErr } = await supabaseAdmin
        .from('wallet_transactions')
        .insert({
          customer_id: profile.id,
          amount: cashbackAmount,
          type: 'cashback',
          status: 'success',
          description: `Dana Cashback Reward: ${redemption.rewards?.title || 'Cashback'}`
        });

      if (txErr) console.error("Error logging wallet transaction for cashback:", txErr);

      // Update status reward_redemptions menjadi used
      const { error: rrErr } = await supabaseAdmin
        .from('reward_redemptions')
        .update({
          status: 'used',
          used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', redemptionId);

      if (rrErr) throw rrErr;

      // Buat notifikasi real-time untuk pelanggan
      const notifMessage = `Dana cashback sebesar Rp ${cashbackAmount.toLocaleString('id-ID')} telah dikreditkan ke Saldo Dompet Anda.`;
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: profile.id,
          title: 'Cashback Dompetku Dikreditkan',
          message: notifMessage,
          type: 'point',
          reference_id: redemptionId,
          status_badge: 'Cashback'
        });

      return NextResponse.json({
        success: true,
        message: 'Cashback berhasil diklaim!',
        amount: cashbackAmount,
        newBalance
      });

    } else if (category === 'voucher' || category === 'food') {
      // --- LOGIKA VOUCHER / MAKANAN GRATIS ---
      let voucherCode = '';
      let discountPercent = 10;

      if (category === 'food') {
        // Generate FREEFOOD-XXXXXX code (6 random alphanum)
        const randStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        voucherCode = `FREEFOOD-${randStr}`;
        discountPercent = 100; // Makanan gratis diskon 100%
      } else {
        // Generate RWD-XXXXXXXX code (8 random alphanum)
        const randStr = Math.random().toString(36).substring(2, 10).toUpperCase();
        voucherCode = `RWD-${randStr}`;
        discountPercent = Number(redemption.rewards?.discount_percent || 10);
      }

      // 1. Buat data voucher di tabel vouchers
      const { data: voucher, error: vErr } = await supabaseAdmin
        .from('vouchers')
        .insert({
          code: voucherCode,
          discount_percent: discountPercent,
          usage_limit: 99999,
          used_count: 0,
          max_usage_per_user: 1,
          is_active: true,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Berlaku 30 hari
        })
        .select()
        .single();

      if (vErr || !voucher) {
        console.error("Error creating voucher in DB:", vErr);
        throw new Error(vErr?.message || "Gagal membuat kode voucher");
      }

      // 2. Kaitkan voucher ke user di customer_vouchers
      const { error: cvErr } = await supabaseAdmin
        .from('customer_vouchers')
        .insert({
          customer_id: profile.id,
          voucher_id: voucher.id,
          used_count: 0
        });

      if (cvErr) {
        console.error("Error inserting customer_vouchers:", cvErr);
        throw new Error(cvErr.message || "Gagal mengaitkan voucher ke akun Anda");
      }

      // 3. Update status redemption di database dengan kode voucher yang di-generate
      const { error: rrErr } = await supabaseAdmin
        .from('reward_redemptions')
        .update({
          status: 'used',
          code: voucherCode,
          used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', redemptionId);

      if (rrErr) throw rrErr;

      // 4. Buat notifikasi real-time untuk pelanggan
      const notifMessage = `Voucher ${redemption.rewards?.title || 'Reward'} (${voucherCode}) telah berhasil diaktifkan dan tersimpan di menu Voucher Saya Anda.`;
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: profile.id,
          title: 'Voucher Reward Diaktifkan',
          message: notifMessage,
          type: 'point',
          reference_id: redemptionId,
          status_badge: 'Sukses'
        });

      return NextResponse.json({
        success: true,
        message: 'Voucher berhasil diaktifkan!',
        code: voucherCode
      });

    } else {
      // --- LOGIKA UNTUK REWARD TIPE LAIN (PRODUCT / CUSTOM) ---
      const { error: rrErr } = await supabaseAdmin
        .from('reward_redemptions')
        .update({
          status: 'used',
          used_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', redemptionId);

      if (rrErr) throw rrErr;

      // Kirim notifikasi
      const notifMessage = `Reward ${redemption.rewards?.title || 'Reward'} telah berhasil digunakan/diaktifkan.`;
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: profile.id,
          title: 'Reward Diaktifkan',
          message: notifMessage,
          type: 'point',
          reference_id: redemptionId,
          status_badge: 'Sukses'
        });

      return NextResponse.json({
        success: true,
        message: 'Reward berhasil diaktifkan!'
      });
    }

  } catch (error: any) {
    console.error('Activate reward error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
