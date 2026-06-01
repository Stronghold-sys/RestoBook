export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET - Ambil ulasan yang sudah dipublish untuk halaman publik (homepage)
export async function GET() {
  try {
    const { data: reviews, error: revErr } = await supabaseAdmin
      .from('reviews')
      .select('id, customer_id, order_id, rating, comment, is_published, created_at')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (revErr) {
      // Jika kolom is_published belum ada, ambil semua ulasan sebagai fallback
      if (revErr.message?.includes('is_published') || revErr.code === '42703') {
        const { data: allReviews, error: allErr } = await supabaseAdmin
          .from('reviews')
          .select('id, customer_id, order_id, rating, comment, created_at')
          .order('created_at', { ascending: false });

        if (allErr) return NextResponse.json({ error: allErr.message, data: [] }, { status: 500 });

        const result = await buildProfileMap(allReviews || []);
        return NextResponse.json({ data: result });
      }
      return NextResponse.json({ error: revErr.message, data: [] }, { status: 500 });
    }

    const result = await buildProfileMap(reviews || []);
    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("API reviews fetch error:", err);
    return NextResponse.json({ error: err.message, data: [] }, { status: 500 });
  }
}

// Helper: ambil nama pelanggan berdasarkan customer_id (= profiles.id, bukan auth.uid)
async function buildProfileMap(reviews: any[]) {
  const customerIds = reviews.map((r: any) => r.customer_id).filter(Boolean);
  let profileMap: Record<string, any> = {};

  if (customerIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', customerIds);  // profiles.id bukan profiles.user_id

    if (profiles) {
      for (const p of profiles) {
        profileMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
      }
    }
  }

  return reviews.map((r: any) => ({
    ...r,
    profiles: profileMap[r.customer_id] || { full_name: 'Pelanggan', avatar_url: null }
  }));
}

export const dynamic = 'force-dynamic';
