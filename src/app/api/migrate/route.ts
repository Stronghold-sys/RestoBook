export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const results: string[] = [];

  try {
    // 1. Tambah kolom is_published jika belum ada
    const { error: alterErr } = await supabaseAdmin.rpc('exec_sql', {
      sql: "ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;"
    });

    if (alterErr) {
      // Jika RPC tidak tersedia, coba cara lain
      // Cek apakah kolom sudah ada dengan melakukan select
      const { data: testData, error: testErr } = await supabaseAdmin
        .from('reviews')
        .select('is_published')
        .limit(1);

      if (testErr && testErr.message.includes('is_published')) {
        results.push("KOLOM is_published BELUM ADA. Silakan jalankan SQL berikut di Supabase SQL Editor:");
        results.push("ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;");
        
        // Coba update semua reviews tanpa is_published - ini akan gagal tapi kita beri info
        return NextResponse.json({ 
          success: false, 
          column_exists: false,
          instructions: "Jalankan di Supabase SQL Editor: ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;",
          results 
        });
      } else {
        results.push("Kolom is_published SUDAH ADA di database.");
        
        // Set semua review yang belum di-publish menjadi published
        const { data: allReviews } = await supabaseAdmin.from('reviews').select('id, is_published, comment');
        results.push(`Total reviews di database: ${allReviews?.length || 0}`);
        
        if (allReviews) {
          for (const rev of allReviews) {
            results.push(`Review ID ${rev.id}: "${rev.comment}" -> is_published: ${rev.is_published}`);
          }
        }
        
        return NextResponse.json({ success: true, column_exists: true, reviews: allReviews, results });
      }
    } else {
      results.push("ALTER TABLE berhasil dijalankan via RPC.");
      return NextResponse.json({ success: true, results });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message, results }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
