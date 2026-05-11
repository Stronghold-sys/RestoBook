import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { id, status, type } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ error: 'ID and status are required' }, { status: 400 });
    }

    // Update status menggunakan admin privileges
    const updateData: any = { status };
    if (type) updateData.type = type;

    const { error } = await supabaseAdmin
      .from('attendance')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Update status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
