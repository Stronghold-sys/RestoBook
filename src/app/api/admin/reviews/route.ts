export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET - Ambil SEMUA ulasan untuk admin (termasuk yang belum dipublish)
export async function GET() {
  try {
    const { data: reviews, error: revErr } = await supabaseAdmin
      .from('reviews')
      .select('id, customer_id, order_id, rating, comment, is_published, created_at')
      .order('created_at', { ascending: false });

    if (revErr) {
      console.error("Admin reviews fetch error:", revErr);
      return NextResponse.json({ error: revErr.message, data: [] }, { status: 500 });
    }

    // Ambil profiles terpisah lalu gabungkan manual berdasarkan customer_id → profiles.id
    const customerIds = (reviews || []).map((r: any) => r.customer_id).filter(Boolean);
    let profileMap: Record<string, any> = {};

    if (customerIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', customerIds);

      if (profiles) {
        for (const p of profiles) {
          profileMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        }
      }
    }

    // Gabungkan manual
    const result = (reviews || []).map((r: any) => ({
      ...r,
      is_published: r.is_published ?? false,
      profiles: profileMap[r.customer_id] || { full_name: 'Pelanggan', avatar_url: null }
    }));

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("API admin reviews fetch error:", err);
    return NextResponse.json({ error: err.message, data: [] }, { status: 500 });
  }
}

// POST - Toggle publish status ulasan
export async function POST(req: Request) {
  try {
    const { id, is_published } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Review ID is required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('reviews')
      .update({ is_published: is_published ?? false })
      .eq('id', id)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("API admin reviews publish error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
