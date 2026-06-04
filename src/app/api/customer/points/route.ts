export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Silakan login kembali' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, points, pending_points, points_used, is_redeem_blocked, wallet_balance, points_status')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    const { data: transactions, error: txError } = await supabaseAdmin
      .from('point_transactions')
      .select('*')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false });

    if (txError) throw txError;

    return NextResponse.json({
      success: true,
      profile: {
        points: profile.points || 0,
        pending_points: profile.pending_points || 0,
        points_used: profile.points_used || 0,
        is_redeem_blocked: !!profile.is_redeem_blocked,
        wallet_balance: Number(profile.wallet_balance || 0),
        points_status: profile.points_status || 'aktif'
      },
      transactions: transactions || []
    });
  } catch (error: any) {
    console.error('Customer points fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
