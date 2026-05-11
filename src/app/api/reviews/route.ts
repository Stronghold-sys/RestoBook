import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const { data: reviews, error: revErr } = await supabaseAdmin
      .from('reviews')
      .select('id, customer_id, order_id, rating, comment, is_published, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (revErr) {
      console.error("Reviews fetch error:", revErr);
      return NextResponse.json({ error: revErr.message, data: [] }, { status: 500 });
    }

    // Ambil profiles terpisah lalu gabungkan manual
    const customerIds = (reviews || []).map(r => r.customer_id).filter(Boolean);
    let profileMap: Record<string, any> = {};

    if (customerIds.length > 0) {
      const { data: profiles } = await freshClient
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', customerIds);

      if (profiles) {
        for (const p of profiles) {
          profileMap[p.user_id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        }
      }
    }

    // Gabungkan manual
    const result = (reviews || []).map(r => ({
      ...r,
      profiles: profileMap[r.customer_id] || { full_name: 'Anonim', avatar_url: null }
    }));

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("API reviews fetch error:", err);
    return NextResponse.json({ error: err.message, data: [] }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
