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
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    // Ambil semua voucher dari database
    const { data: allVouchers, error: vouchersError } = await supabaseAdmin
      .from('vouchers')
      .select('*')
      .order('created_at', { ascending: false });

    if (vouchersError) throw vouchersError;

    // Ambil riwayat pemakaian khusus pelanggan saat ini
    const { data: customerVouchers, error: cvError } = await supabaseAdmin
      .from('customer_vouchers')
      .select('voucher_id, used_count')
      .eq('customer_id', profile.id);

    if (cvError) throw cvError;

    // Buat map pencocokan ID Voucher ke jumlah pemakaian user
    const usageMap = new Map<string, number>();
    for (const cv of customerVouchers || []) {
      usageMap.set(cv.voucher_id, cv.used_count);
    }

    const now = new Date();
    const active: any[] = [];
    const history: any[] = [];

    for (const v of allVouchers || []) {
      const userUsedCount = usageMap.get(v.id) || 0;

      const isExpired = new Date(v.expires_at) <= now;
      const isUserLimitReached = userUsedCount >= v.max_usage_per_user;
      const isGlobalLimitReached = v.used_count >= v.usage_limit;
      const isActive = v.is_active;

      if (!isActive || isExpired || isUserLimitReached || isGlobalLimitReached) {
        let status = 'expired';
        if (isUserLimitReached) {
          status = 'used';
        } else if (isGlobalLimitReached) {
          status = 'exhausted';
        } else if (!isActive) {
          status = 'inactive';
        }

        history.push({
          id: v.id,
          voucher_id: v.id,
          code: v.code,
          discount_percent: v.discount_percent,
          expires_at: v.expires_at,
          used_count: userUsedCount,
          max_usage_per_user: v.max_usage_per_user,
          status, // 'used', 'expired', 'exhausted', 'inactive'
          created_at: v.created_at
        });
      } else {
        active.push({
          id: v.id,
          voucher_id: v.id,
          code: v.code,
          discount_percent: v.discount_percent,
          expires_at: v.expires_at,
          used_count: userUsedCount,
          max_usage_per_user: v.max_usage_per_user,
          global_used: v.used_count,
          global_limit: v.usage_limit
        });
      }
    }

    return NextResponse.json({ success: true, active, history });
  } catch (error: any) {
    console.error('Customer fetch vouchers error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
