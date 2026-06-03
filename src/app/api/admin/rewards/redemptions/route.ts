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
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('reward_redemptions')
      .select(`
        *,
        profiles (
          id,
          full_name,
          email
        ),
        rewards (
          id,
          title,
          category,
          discount_percent,
          cashback_amount
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, redemptions: data || [] });
  } catch (error: any) {
    console.error('Admin redemptions GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
    }

    const body = await req.json();
    const { action, redemptionIds, redemptionId, isBlocked, blockReason } = body;

    if (action === 'free_quota') {
      if (!redemptionIds || !Array.isArray(redemptionIds) || redemptionIds.length === 0) {
        return NextResponse.json({ error: 'Daftar ID Penukaran kosong' }, { status: 400 });
      }

      const isQuotaFreed = body.value !== undefined ? !!body.value : true;

      const { data, error } = await supabaseAdmin
        .from('reward_redemptions')
        .update({
          is_quota_freed: isQuotaFreed,
          updated_at: new Date().toISOString()
        })
        .in('id', redemptionIds)
        .select();

      if (error) throw error;

      // Send notifications for each freed quota
      for (const red of data || []) {
        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: red.customer_id,
            title: 'Kuota Penukaran Disesuaikan',
            message: isQuotaFreed
              ? `Batas kuota penukaran Anda untuk suatu reward telah disesuaikan oleh admin. Anda dapat menukarkannya kembali!`
              : `Batas kuota penukaran Anda untuk suatu reward telah disesuaikan oleh admin.`,
            type: 'point',
            reference_id: red.id,
            status_badge: isQuotaFreed ? 'Kuota Bebas' : 'Kuota Bertambah'
          });
      }

      return NextResponse.json({ success: true, updated: data });
    }

    if (action === 'refund_redemption') {
      if (!redemptionId) {
        return NextResponse.json({ error: 'ID Penukaran harus diisi' }, { status: 400 });
      }

      // Fetch the redemption first
      const { data: redemption, error: fetchErr } = await supabaseAdmin
        .from('reward_redemptions')
        .select('*, rewards(title)')
        .eq('id', redemptionId)
        .single();

      if (fetchErr || !redemption) {
        return NextResponse.json({ error: 'Penukaran reward tidak ditemukan' }, { status: 404 });
      }

      if (redemption.status === 'cancelled') {
        return NextResponse.json({ error: 'Penukaran ini sudah dibatalkan sebelumnya' }, { status: 400 });
      }

      // Fetch profile to update points
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('points, points_used')
        .eq('id', redemption.customer_id)
        .single();

      if (profileErr || !profile) {
        return NextResponse.json({ error: 'Profil pelanggan tidak ditemukan' }, { status: 404 });
      }

      const pointsRefunded = redemption.points_spent || 0;
      const newPoints = (profile.points || 0) + pointsRefunded;
      const newPointsUsed = Math.max(0, (profile.points_used || 0) - pointsRefunded);

      // 1. Update redemption status to 'cancelled'
      const { error: updateRedErr } = await supabaseAdmin
        .from('reward_redemptions')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', redemptionId);

      if (updateRedErr) throw updateRedErr;

      // 2. Update customer points
      const { error: updateProfileErr } = await supabaseAdmin
        .from('profiles')
        .update({
          points: newPoints,
          points_used: newPointsUsed
        })
        .eq('id', redemption.customer_id);

      if (updateProfileErr) throw updateProfileErr;

      // 3. Log point transaction
      const { error: insertTxErr } = await supabaseAdmin
        .from('point_transactions')
        .insert({
          customer_id: redemption.customer_id,
          points: pointsRefunded,
          status: 'returned',
          description: `Pengembalian poin (Refund) reward: ${redemption.rewards?.title || 'Reward'}`
        });

      if (insertTxErr) throw insertTxErr;

      // 4. Send notification
      const rewardTitle = redemption.rewards?.title || 'Reward';
      await supabaseAdmin
        .from('notifications')
        .insert({
          user_id: redemption.customer_id,
          title: 'Reward Dibatalkan & Refund',
          message: `Penukaran reward "${rewardTitle}" Anda telah dibatalkan oleh admin. Poin sebesar ${pointsRefunded} telah dikembalikan ke akun Anda.`,
          type: 'point',
          reference_id: redemptionId,
          status_badge: 'Dikembalikan'
        });

      return NextResponse.json({ success: true, message: 'Reward berhasil dibatalkan dan poin telah dikembalikan.' });
    }

    if (!redemptionId) {
      return NextResponse.json({ error: 'ID Penukaran harus diisi' }, { status: 400 });
    }

    // Fetch the redemption first to get user_id and reward details
    const { data: redemption, error: fetchErr } = await supabaseAdmin
      .from('reward_redemptions')
      .select('*, rewards(title)')
      .eq('id', redemptionId)
      .single();

    if (fetchErr || !redemption) {
      return NextResponse.json({ error: 'Penukaran reward tidak ditemukan' }, { status: 404 });
    }

    const blockMsg = isBlocked ? (blockReason || 'Diblokir oleh admin') : '';

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('reward_redemptions')
      .update({
        is_blocked: !!isBlocked,
        block_reason: blockMsg,
        updated_at: new Date().toISOString()
      })
      .eq('id', redemptionId)
      .single();

    if (updateErr) throw updateErr;

    // Send notification to customer
    const rewardTitle = redemption.rewards?.title || 'Reward';
    const notifMsg = isBlocked 
      ? `Reward "${rewardTitle}" Anda telah diblokir oleh admin. Alasan: ${blockMsg}`
      : `Status blokir pada reward "${rewardTitle}" Anda telah dibuka oleh admin.`;

    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: redemption.customer_id,
        title: isBlocked ? 'Reward Diblokir' : 'Blokir Reward Dibuka',
        message: notifMsg,
        type: 'point',
        reference_id: redemptionId,
        status_badge: isBlocked ? 'Diblokir' : 'Sukses'
      });

    return NextResponse.json({ success: true, redemption: updated });
  } catch (error: any) {
    console.error('Admin redemptions PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const redemptionId = searchParams.get('redemptionId');

    if (!redemptionId) {
      return NextResponse.json({ error: 'ID Penukaran harus diisi' }, { status: 400 });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('reward_redemptions')
      .delete()
      .eq('id', redemptionId);

    if (deleteErr) throw deleteErr;

    return NextResponse.json({ success: true, message: 'Penukaran reward berhasil dihapus' });
  } catch (error: any) {
    console.error('Admin redemptions DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
