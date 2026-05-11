import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  try {
    // Coba lakukan update is_published ke true untuk ulasan yang ada
    const { data: testUpdate, error: updateError } = await supabaseAdmin
      .from('reviews')
      .update({ is_published: true })
      .eq('comment', 'tidak enak')
      .select();

    const { data: reviews } = await supabaseAdmin
      .from('reviews')
      .select('*');

    return NextResponse.json({
      testUpdate,
      updateError: updateError?.message,
      updateErrorDetails: updateError,
      reviews
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
