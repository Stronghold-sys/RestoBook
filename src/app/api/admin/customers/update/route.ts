export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { id, full_name, phone } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ full_name, phone })
      .eq('id', id)
      .eq('role', 'customer');

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Data pelanggan berhasil diperbarui' });
  } catch (error: any) {
    console.error('Update customer error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
