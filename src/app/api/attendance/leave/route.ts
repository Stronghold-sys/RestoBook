import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { userId, profileId, type, notes, attachmentUrl } = await req.json();

    if (!userId || !type || !notes) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('attendance')
      .insert({
        user_id: userId,
        profile_id: profileId,
        type: type,
        notes: notes,
        attachment_url: attachmentUrl,
        status: 'pending'
      });

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Pengajuan izin berhasil terkirim' });
  } catch (error: any) {
    console.error('Leave request error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
