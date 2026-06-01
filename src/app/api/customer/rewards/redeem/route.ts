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

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Silakan login kembali' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    const body = await req.json();
    const { rewardId } = body;

    if (!rewardId) {
      return NextResponse.json({ error: 'ID Reward harus diisi' }, { status: 400 });
    }

    // Call the postgres transaction function
    const { data: resultData, error: rpcError } = await supabaseAdmin.rpc('redeem_reward_transaction', {
      p_customer_id: profile.id,
      p_reward_id: rewardId
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    // Parse result
    const result = typeof resultData === 'string' ? JSON.parse(resultData) : resultData;

    if (result && result.success === false) {
      return NextResponse.json({ error: result.error || 'Gagal menukarkan reward' }, { status: 400 });
    }

    // Jika reward yang ditukar memiliki batas waktu, perbarui deskripsi notifikasi agar memuat informasi kadaluarsa WIB
    try {
      if (result.redemption_id) {
        const { data: redemption } = await supabaseAdmin
          .from('reward_redemptions')
          .select('*, rewards(title)')
          .eq('id', result.redemption_id)
          .single();

        if (redemption && redemption.expires_at) {
          const formattedExpiry = getWibExpiryString(redemption.expires_at);
          const activeMessage = `Kamu berhasil menukar ${redemption.points_spent} point untuk ${redemption.rewards?.title || 'Reward'}. Reward ini AKTIF dan berlaku sampai dengan ${formattedExpiry}. Silakan gunakan sebelum batas waktu berakhir!`;

          await supabaseAdmin
            .from('notifications')
            .update({ message: activeMessage })
            .eq('reference_id', redemption.id)
            .eq('type', 'point');
        }
      }
    } catch (notifErr) {
      console.error("Gagal memperbarui pesan notifikasi aktif:", notifErr);
    }

    return NextResponse.json({
      success: true,
      message: 'Reward berhasil ditukarkan!',
      code: result.code,
      newPoints: result.new_points,
      redemptionId: result.redemption_id
    });
  } catch (error: any) {
    console.error('Redeem reward error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
