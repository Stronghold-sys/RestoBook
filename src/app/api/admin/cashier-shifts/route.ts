export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/admin/cashier-shifts
 * Mengambil seluruh sesi shift kasir beserta data profile karyawan.
 * Menggunakan supabaseAdmin (Service Role Key) untuk bypass RLS.
 */
export async function GET(req: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('shifts')
      .select('*, profiles(full_name, role, employee_id)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cashier shifts:', error);
      throw error;
    }

    return NextResponse.json({ success: true, shifts: data || [] });
  } catch (error: any) {
    console.error('GET /api/admin/cashier-shifts error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
