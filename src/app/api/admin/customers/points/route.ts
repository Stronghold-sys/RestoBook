export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  return profile?.role === 'admin' ? user : null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');

    if (customerId) {
      // Get point transactions for specific customer
      const { data: transactions, error: txErr } = await supabaseAdmin
        .from('point_transactions')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (txErr) throw txErr;

      // Get wallet transactions for specific customer
      const { data: walletTransactions } = await supabaseAdmin
        .from('wallet_transactions')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      return NextResponse.json({ 
        success: true, 
        transactions: transactions || [],
        walletTransactions: walletTransactions || []
      });
    }

    // List all customer profiles with point summaries
    const { data: customers, error: custErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, points, pending_points, points_used, is_redeem_blocked, wallet_balance, is_wallet_blocked, created_at')
      .eq('role', 'customer')
      .order('full_name', { ascending: true });

    if (custErr) throw custErr;

    return NextResponse.json({ success: true, customers: customers || [] });
  } catch (error: any) {
    console.error('Admin customers points fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await req.json();
    const { customerId, action, amount, reason } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    // Get customer profile
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('points, points_used, is_redeem_blocked, wallet_balance, is_wallet_blocked')
      .eq('id', customerId)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    if (action === 'adjust') {
      const adjAmount = Number(amount);
      if (isNaN(adjAmount) || adjAmount === 0) {
        return NextResponse.json({ error: 'Jumlah poin tidak valid' }, { status: 400 });
      }

      const status = adjAmount > 0 ? 'manual_earned' : 'manual_redeemed';
      const description = reason || (adjAmount > 0 ? 'Penambahan poin manual oleh admin' : 'Pengurangan poin manual oleh admin');

      // Update customer points
      const newPoints = Math.max(0, (profile.points || 0) + adjAmount);
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ points: newPoints })
        .eq('id', customerId);

      if (updateErr) throw updateErr;

      // Log transaction
      await supabaseAdmin.from('point_transactions').insert({
        customer_id: customerId,
        points: adjAmount,
        status,
        description
      });

      // Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: adjAmount > 0 ? 'Poin Ditambahkan Manual' : 'Poin Dikurangi Manual',
        message: `${Math.abs(adjAmount)} poin telah ${adjAmount > 0 ? 'ditambahkan' : 'dikurangi'} oleh admin. Alasan: ${description}`,
        type: 'points_adjustment'
      });

      return NextResponse.json({ success: true, newPoints });
    }

    if (action === 'reset') {
      const pointsToDeduct = -(profile.points || 0);

      // Reset to 0
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ points: 0 })
        .eq('id', customerId);

      if (updateErr) throw updateErr;

      if (pointsToDeduct !== 0) {
        // Log transaction
        await supabaseAdmin.from('point_transactions').insert({
          customer_id: customerId,
          points: pointsToDeduct,
          status: 'manual_redeemed',
          description: reason || 'Reset poin oleh admin'
        });
      }

      // Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: 'Poin Direset',
        message: `Poin Anda telah direset menjadi 0 oleh admin.`,
        type: 'points_reset'
      });

      return NextResponse.json({ success: true, newPoints: 0 });
    }

    if (action === 'toggle_block') {
      const nextStatus = !profile.is_redeem_blocked;
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ is_redeem_blocked: nextStatus })
        .eq('id', customerId);

      if (updateErr) throw updateErr;

      // Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: nextStatus ? 'Akses Penukaran Diblokir' : 'Akses Penukaran Dibuka',
        message: nextStatus 
          ? 'Penukaran reward poin Anda telah diblokir sementara oleh admin. Hubungi admin untuk detail.'
          : 'Akses penukaran reward poin Anda telah dibuka kembali. Anda sekarang dapat menukarkan poin.',
        type: 'points_block_toggle'
      });

      return NextResponse.json({ success: true, isRedeemBlocked: nextStatus });
    }

    if (action === 'adjust_wallet') {
      const adjAmount = Number(amount);
      if (isNaN(adjAmount) || adjAmount === 0) {
        return NextResponse.json({ error: 'Jumlah saldo tidak valid' }, { status: 400 });
      }

      const description = reason || (adjAmount > 0 ? 'Penambahan saldo manual oleh admin' : 'Pengurangan saldo manual oleh admin');

      // Update customer wallet balance
      const newBalance = Math.max(0, Number(profile.wallet_balance || 0) + adjAmount);
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', customerId);

      if (updateErr) throw updateErr;

      // Log transaction
      await supabaseAdmin.from('wallet_transactions').insert({
        customer_id: customerId,
        amount: adjAmount,
        type: 'adjust',
        status: 'success',
        description
      });

      // Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: adjAmount > 0 ? 'Saldo Dompet Ditambahkan' : 'Saldo Dompet Dikurangi',
        message: `Saldo sebesar Rp ${Math.abs(adjAmount).toLocaleString('id-ID')} telah ${adjAmount > 0 ? 'ditambahkan' : 'dikurangi'} oleh admin. Alasan: ${description}`,
        type: 'point'
      });

      return NextResponse.json({ success: true, newBalance });
    }

    if (action === 'reset_wallet') {
      const balanceToDeduct = -Number(profile.wallet_balance || 0);

      // Reset to 0
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: 0 })
        .eq('id', customerId);

      if (updateErr) throw updateErr;

      if (balanceToDeduct !== 0) {
        // Log transaction
        await supabaseAdmin.from('wallet_transactions').insert({
          customer_id: customerId,
          amount: balanceToDeduct,
          type: 'adjust',
          status: 'success',
          description: reason || 'Reset saldo oleh admin'
        });
      }

      // Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: 'Saldo Dompet Direset',
        message: `Saldo Dompetku Anda telah direset menjadi Rp 0 oleh admin.`,
        type: 'point'
      });

      return NextResponse.json({ success: true, newBalance: 0 });
    }

    if (action === 'toggle_wallet_block') {
      const nextStatus = !profile.is_wallet_blocked;
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ 
          is_wallet_blocked: nextStatus,
          wallet_block_reason: nextStatus ? (reason || 'Diblokir oleh administrator') : null,
          wrong_pin_count: nextStatus ? undefined : 0 // reset pin attempts on manual unblock
        })
        .eq('id', customerId);

      if (updateErr) throw updateErr;

      // Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: nextStatus ? 'Akses Dompet Diblokir' : 'Akses Dompet Dibuka',
        message: nextStatus 
          ? `Penggunaan e-wallet Dompetku Anda telah diblokir sementara oleh admin. Alasan: ${reason || 'Kebijakan Keamanan'}`
          : 'Akses e-wallet Dompetku Anda telah dibuka kembali. Anda sekarang dapat bertransaksi kembali.',
        type: 'point'
      });

      return NextResponse.json({ success: true, isWalletBlocked: nextStatus });
    }

    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('Admin customers points post error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
