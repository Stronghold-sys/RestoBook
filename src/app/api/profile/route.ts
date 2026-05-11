export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { userId, fullName, phone, avatarUrl } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ 
        full_name: fullName, 
        phone: phone, 
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      message: 'Profil berhasil diperbarui',
      data: { fullName, phone, avatarUrl }
    });
  } catch (error: any) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
