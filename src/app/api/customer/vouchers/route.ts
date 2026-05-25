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

    // Ambil semua customer_vouchers beserta info detail voucher
    const { data: customerVouchers, error } = await supabaseAdmin
      .from('customer_vouchers')
      .select(`
        id,
        used_count,
        created_at,
        vouchers (
          id,
          code,
          discount_percent,
          usage_limit,
          max_usage_per_user,
          used_count,
          expires_at,
          is_active
        )
      `)
      .eq('customer_id', profile.id);

    if (error) throw error;

    const now = new Date();
    const active: any[] = [];
    const history: any[] = [];

    for (const item of customerVouchers || []) {
      const v: any = item.vouchers;
      if (!v) continue;

      const isExpired = new Date(v.expires_at) <= now;
      const isUserLimitReached = item.used_count >= v.max_usage_per_user;
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
          id: item.id,
          voucher_id: v.id,
          code: v.code,
          discount_percent: v.discount_percent,
          expires_at: v.expires_at,
          used_count: item.used_count,
          max_usage_per_user: v.max_usage_per_user,
          status, // 'used', 'expired', 'exhausted', 'inactive'
          created_at: item.created_at
        });
      } else {
        active.push({
          id: item.id,
          voucher_id: v.id,
          code: v.code,
          discount_percent: v.discount_percent,
          expires_at: v.expires_at,
          used_count: item.used_count,
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
