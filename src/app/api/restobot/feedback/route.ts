export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { rating, feedbackText, history } = await req.json();

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, error: 'Rating wajib diisi antara nilai 1 sampai 5.' }, { status: 400 });
    }

    // Ambil auth token dari headers/cookie jika ada untuk mengaitkan ke profil
    // Karena rute ini dipanggil oleh client, kita coba deteksi user_id
    // Namun untuk fleksibilitas (bisa guest chat), user_id diperbolehkan null
    let profileId: string | null = null;
    
    // Kita coba sinkronkan session jika user login
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        const { data: prof } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
        if (prof) {
          profileId = prof.id;
        }
      }
    }

    // Insert ke tabel restobot_feedback
    const { error } = await supabaseAdmin
      .from('restobot_feedback')
      .insert({
        user_id: profileId,
        rating,
        feedback_text: feedbackText || null,
        conversation_history: history || null
      });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Feedback Anda berhasil disimpan. Terima kasih!' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
