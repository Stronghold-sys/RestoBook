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

    if (action === 'cancel_redemptions') {
      if (!redemptionIds || !Array.isArray(redemptionIds) || redemptionIds.length === 0) {
        return NextResponse.json({ error: 'Daftar ID Penukaran kosong' }, { status: 400 });
      }

      const { data, error } = await supabaseAdmin
        .from('reward_redemptions')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .in('id', redemptionIds)
        .select();

      if (error) throw error;

      // Send notifications for each cancelled redemption
      for (const red of data || []) {
        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id: red.customer_id,
            title: 'Penukaran Dibatalkan',
            message: `Kuota penukaran Anda telah disesuaikan oleh admin.`,
            type: 'point',
            reference_id: red.id,
            status_badge: 'Batal'
          });
      }

      return NextResponse.json({ success: true, updated: data });
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
      .select()
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
