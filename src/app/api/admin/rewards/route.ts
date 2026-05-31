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

    // 1. Get all rewards
    const { data: rewards, error: rewardsError } = await supabaseAdmin
      .from('rewards')
      .select('*')
      .order('created_at', { ascending: false });

    if (rewardsError) throw rewardsError;

    // 2. Fetch statistics
    // Total point dibagikan (status = earned, manual_earned)
    const { data: earnedTx } = await supabaseAdmin
      .from('point_transactions')
      .select('points')
      .in('status', ['earned', 'manual_earned']);
    const totalEarned = earnedTx?.reduce((sum: number, tx: any) => sum + tx.points, 0) || 0;

    // Total point pending
    const { data: pendingTx } = await supabaseAdmin
      .from('point_transactions')
      .select('points')
      .eq('status', 'pending');
    const totalPending = pendingTx?.reduce((sum: number, tx: any) => sum + tx.points, 0) || 0;

    // Total point digunakan (status = redeemed)
    const { data: redeemedTx } = await supabaseAdmin
      .from('point_transactions')
      .select('points')
      .eq('status', 'redeemed');
    const totalRedeemed = Math.abs(redeemedTx?.reduce((sum: number, tx: any) => sum + tx.points, 0) || 0);

    // Leaderboard: Pelanggan poin tertinggi
    const { data: leaderboard } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, points, pending_points')
      .eq('role', 'customer')
      .order('points', { ascending: false })
      .limit(5);

    // Chart: Penukaran reward 7 hari terakhir
    const { data: recentRedemptions } = await supabaseAdmin
      .from('reward_redemptions')
      .select('created_at, points_spent');
      
    // Group redemptions by day
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const dailyStats = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      const dateStr = d.toISOString().split('T')[0];
      const count = recentRedemptions?.filter((r: any) => r.created_at.startsWith(dateStr)).length || 0;
      return {
        label: dayNames[d.getDay()],
        count
      };
    });

    return NextResponse.json({
      success: true,
      rewards: rewards || [],
      stats: {
        totalEarned,
        totalPending,
        totalRedeemed,
        leaderboard: leaderboard || [],
        chart: dailyStats
      }
    });
  } catch (error: any) {
    console.error('Admin rewards fetch error:', error);
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
    const { title, description, category, minPoints, stock, imageUrl, discountPercent, cashbackAmount } = body;

    if (!title || !category) {
      return NextResponse.json({ error: 'Judul dan Kategori harus diisi' }, { status: 400 });
    }

    const { data: newReward, error: insertError } = await supabaseAdmin
      .from('rewards')
      .insert({
        title,
        description,
        category,
        min_points: minPoints || 0,
        stock: stock === '' ? null : Number(stock),
        image_url: imageUrl || '',
        discount_percent: discountPercent || 10,
        cashback_amount: cashbackAmount || 0,
        is_active: true
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Send notifications to customers about new reward
    // Get customer profiles
    const { data: customers } = await supabaseAdmin.from('profiles').select('id').eq('role', 'customer');
    if (customers) {
      for (const c of customers) {
        await supabaseAdmin.from('notifications').insert({
          user_id: c.id,
          title: 'Reward Baru Tersedia',
          message: `Reward baru ${title} sekarang tersedia dan bisa ditukar dengan ${minPoints || 0} point.`,
          type: 'point',
          reference_id: newReward.id,
          points: minPoints || 0,
          status_badge: 'Baru'
        });
      }
    }

    return NextResponse.json({ success: true, reward: newReward });
  } catch (error: any) {
    console.error('Admin create reward error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await req.json();
    const { id, title, description, category, minPoints, stock, imageUrl, discountPercent, cashbackAmount, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID Reward tidak disertakan' }, { status: 400 });
    }

    const { data: updatedReward, error: updateError } = await supabaseAdmin
      .from('rewards')
      .update({
        title,
        description,
        category,
        min_points: minPoints,
        stock: stock === '' ? null : Number(stock),
        image_url: imageUrl,
        discount_percent: discountPercent,
        cashback_amount: cashbackAmount,
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, reward: updatedReward });
  } catch (error: any) {
    console.error('Admin update reward error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID Reward tidak disertakan' }, { status: 400 });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('rewards')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true, message: 'Reward berhasil dihapus' });
  } catch (error: any) {
    console.error('Admin delete reward error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
