export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { userId, profileId, isBlocked } = await req.json();

    if (!userId && !profileId) {
      return NextResponse.json({ error: 'User ID or Profile ID is required' }, { status: 400 });
    }

    // Update is_blocked di tabel profiles
    // Kita coba update berdasarkan id (Profile ID) atau user_id
    const query = supabaseAdmin.from('profiles').update({ is_blocked: isBlocked });
    
    if (profileId) {
      query.eq('id', profileId);
    } else {
      query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Block profile error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
