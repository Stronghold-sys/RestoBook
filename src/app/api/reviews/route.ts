import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Buat client baru setiap request untuk menghindari schema cache
    const freshClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: 'public' }
      }
    );

    // Ambil reviews dulu
    const { data: reviews, error: revErr } = await freshClient
      .from('reviews')
      .select('id, customer_id, order_id, rating, comment, is_published, created_at')
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
