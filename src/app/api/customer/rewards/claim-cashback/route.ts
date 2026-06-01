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

    if (redemption.rewards?.category !== 'cashback') {
      return NextResponse.json({ error: 'Reward ini bukan jenis cashback' }, { status: 400 });
    }

    if (redemption.status === 'used' || redemption.used_at !== null) {
      return NextResponse.json({ error: 'Dana cashback ini sudah pernah diklaim' }, { status: 400 });
    }

    const cashbackAmount = Number(redemption.cashback_amount || redemption.rewards?.cashback_amount || 0);

    if (cashbackAmount <= 0) {
      return NextResponse.json({ error: 'Jumlah nominal cashback tidak valid' }, { status: 400 });
    }

    const currentBalance = Number(profile.wallet_balance || 0);
    const newBalance = currentBalance + cashbackAmount;

    // 2. Update wallet_balance pelanggan
    const { error: balErr } = await supabaseAdmin
      .from('profiles')
      .update({ wallet_balance: newBalance })
      .eq('id', profile.id);

    if (balErr) throw balErr;

    // 3. Log transaksi saldo dompet
    const { error: txErr } = await supabaseAdmin
      .from('wallet_transactions')
      .insert({
        customer_id: profile.id,
        amount: cashbackAmount,
        type: 'cashback',
        status: 'success',
        description: `Dana Cashback Reward: ${redemption.rewards?.title || 'Casback'}`
      });

    if (txErr) console.error("Error logging wallet transaction for cashback:", txErr);

    // 4. Update status reward_redemptions menjadi used
    const { error: rrErr } = await supabaseAdmin
      .from('reward_redemptions')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', redemptionId);

    if (rrErr) throw rrErr;

    // 5. Buat notifikasi real-time untuk pelanggan
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

  } catch (error: any) {
    console.error('Claim cashback error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
