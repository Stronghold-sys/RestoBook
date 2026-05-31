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
      .select('id, points, is_redeem_blocked')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    // Get active rewards catalog
    const { data: rewards, error: rewardsError } = await supabaseAdmin
      .from('rewards')
      .select('*')
      .eq('is_active', true)
      .order('min_points', { ascending: true });

    if (rewardsError) throw rewardsError;

    // Get user's redemption logs
    const { data: redemptions, error: redemptionsError } = await supabaseAdmin
      .from('reward_redemptions')
      .select('*, rewards(title, category)')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false });

    if (redemptionsError) throw redemptionsError;

    return NextResponse.json({
      success: true,
      points: profile.points || 0,
      is_redeem_blocked: !!profile.is_redeem_blocked,
      rewards: rewards || [],
      redemptions: redemptions || []
    });
  } catch (error: any) {
    console.error('Customer rewards fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
