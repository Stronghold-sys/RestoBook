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
      .select('min_topup, max_topup, is_duitku_enabled, wallet_admin_fee')
      .single();

    // Fetch all successful transaction logs for the customer
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false });

    if (txError) throw txError;

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
        adminFee: Number(settings?.wallet_admin_fee || 0)
      },
      transactions: activeTx
    });

  } catch (error: any) {
    console.error('Wallet GET API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
