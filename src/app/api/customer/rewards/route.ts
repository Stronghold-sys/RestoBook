export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const getWibExpiryString = (expiresAtStr: string) => {
  if (!expiresAtStr) return "";
  const date = new Date(expiresAtStr);
  return format(date, "EEEE, dd MMMM yyyy 'pukul' HH:mm", { locale: id }) + " WIB";
};

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

    // Check and update expired redemptions dynamically in real-time
    const now = new Date().toISOString();
    const { data: expiredRedemptions } = await supabaseAdmin
      .from('reward_redemptions')
      .select('*, rewards(title)')
      .eq('customer_id', profile.id)
      .eq('status', 'success')
      .lt('expires_at', now);

    if (expiredRedemptions && expiredRedemptions.length > 0) {
      for (const redemption of expiredRedemptions) {
        // 1. Update status di database menjadi 'expired'
        await supabaseAdmin
          .from('reward_redemptions')
          .update({
            status: 'expired',
            updated_at: now
          })
          .eq('id', redemption.id);

        // 2. Kirim notifikasi kadaluarsa
        const rewardTitle = redemption.rewards?.title || 'Reward';
        const formattedExpiry = getWibExpiryString(redemption.expires_at);
        const expiredMessage = `Reward "${rewardTitle}" Anda telah kadaluarsa pada ${formattedExpiry} dan tidak dapat digunakan lagi.`;

        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: profile.id,
            title: 'Reward Kadaluarsa',
            message: expiredMessage,
            type: 'point',
            reference_id: redemption.id,
            status_badge: 'Gagal'
          });
      }
    }

    // Get user's redemption logs
    const { data: redemptions, error: redemptionsError } = await supabaseAdmin
      .from('reward_redemptions')
      .select('*, rewards(title, category, cashback_amount, is_auto_cashback)')
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
