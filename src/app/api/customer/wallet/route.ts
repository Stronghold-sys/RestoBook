import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
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

    // Get limit settings
    const { data: settings } = await supabaseAdmin
      .from('restaurant_settings')
      .select('min_topup, max_topup, is_duitku_enabled, wallet_admin_fee, topup_expiry_minutes, payment_expiry_minutes')
      .single();

    const topupExpiryMinutes = Number(settings?.topup_expiry_minutes || 15);
    const orderExpiryMinutes = Number(settings?.payment_expiry_minutes || 60);

    // 1. Auto-expire expired pending topup transactions
    const topupExpiryThreshold = new Date(Date.now() - topupExpiryMinutes * 60 * 1000).toISOString();
    await supabaseAdmin
      .from('wallet_transactions')
      .update({ status: 'cancelled', description: 'Batas waktu pembayaran top up habis' })
      .eq('customer_id', profile.id)
      .eq('type', 'topup')
      .eq('status', 'pending')
      .lt('created_at', topupExpiryThreshold);

    // 2. Auto-expire unpaid non-cash orders
    const orderExpiryThreshold = new Date(Date.now() - orderExpiryMinutes * 60 * 1000).toISOString();
    const { data: expiredOrders } = await supabaseAdmin
      .from('orders')
      .select('id, table_id')
      .eq('customer_id', profile.id)
      .eq('payment_method', 'non_cash')
      .eq('payment_status', 'unpaid')
      .neq('status', 'cancelled')
      .lt('created_at', orderExpiryThreshold);

    if (expiredOrders && expiredOrders.length > 0) {
      const expiredIds = expiredOrders.map((o: any) => o.id);
      const tableIdsToRelease = expiredOrders.filter((o: any) => o.table_id).map((o: any) => o.table_id);

      await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled', cancel_reason: 'Batas waktu pembayaran habis (Batal Otomatis)' })
        .in('id', expiredIds);

      if (tableIdsToRelease.length > 0) {
        await supabaseAdmin
          .from('tables')
          .update({ status: 'available' })
          .in('id', tableIdsToRelease);
      }
    }

    // Fetch all transaction logs for the customer (now updated with cancelled statuses)
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false });

    if (txError) throw txError;

    // Fetch unpaid active transactions for the "Bayar Sekarang" modal
    const { data: pendingTopups } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id, amount, created_at, payment_reference, description')
      .eq('customer_id', profile.id)
      .eq('type', 'topup')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    const { data: unpaidOrders } = await supabaseAdmin
      .from('orders')
      .select('id, total_amount, created_at')
      .eq('customer_id', profile.id)
      .eq('payment_method', 'non_cash')
      .eq('payment_status', 'unpaid')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    // Combine unpaid transactions into a single clean structure
    const unpaidTransactions: any[] = [];

    if (pendingTopups) {
      pendingTopups.forEach((tx: any) => {
        unpaidTransactions.push({
          id: tx.id,
          type: 'topup',
          amount: Number(tx.amount),
          created_at: tx.created_at,
          payment_reference: tx.payment_reference,
          description: tx.description || 'Top Up Saldo Dompetku'
        });
      });
    }

    if (unpaidOrders) {
      unpaidOrders.forEach((order: any) => {
        unpaidTransactions.push({
          id: order.id,
          type: 'order',
          amount: Number(order.total_amount),
          created_at: order.created_at,
          payment_reference: null, // Orders will generate reference dynamically or from call
          description: `Pesanan Makanan #${order.id.substring(0, 8).toUpperCase()}`
        });
      });
    }

    // Sort combined unpaid transactions by created_at descending
    unpaidTransactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Calculate monthly stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const activeTx = transactions || [];

    const monthlyTopup = activeTx
      .filter((tx: any) => tx.type === 'topup' && tx.status === 'success' && new Date(tx.created_at) >= startOfMonth)
      .reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

    const monthlySpending = activeTx
      .filter((tx: any) => tx.type === 'payment' && tx.status === 'success' && new Date(tx.created_at) >= startOfMonth)
      .reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);

    const monthlyTxCount = activeTx
      .filter((tx: any) => tx.status === 'success' && new Date(tx.created_at) >= startOfMonth)
      .length;

    return NextResponse.json({
      success: true,
      wallet: {
        balance: Number(profile.wallet_balance || 0),
        monthlyTopup,
        monthlySpending,
        monthlyTxCount
      },
      settings: {
        minTopup: Number(settings?.min_topup || 10000),
        maxTopup: Number(settings?.max_topup || 2000000),
        isDuitkuEnabled: settings?.is_duitku_enabled !== false,
        adminFee: Number(settings?.wallet_admin_fee || 0),
        topupExpiryMinutes,
        paymentExpiryMinutes: orderExpiryMinutes
      },
      transactions: activeTx,
      unpaidTransactions
    });

  } catch (error: any) {
    console.error('Wallet GET API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
