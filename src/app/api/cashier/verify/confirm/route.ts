export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createAuditLog } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    // Get current session user
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get employee profile
    const supabaseAdmin = getSupabaseAdmin();
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, employee_id')
      .eq('user_id', user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profil karyawan tidak ditemukan' }, { status: 404 });
    }

    // Update profile verification status
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        data_verified: true,
        verification_status: 'verified'
      })
      .eq('id', profile.id);

    if (updateErr) throw updateErr;

    // Log the verification confirmation to audit log
    await createAuditLog('EMPLOYEE_DATA_VERIFIED', {
      profile_id: profile.id,
      employee_id: profile.employee_id,
      full_name: profile.full_name
    });

    return NextResponse.json({ success: true, message: 'Verifikasi data karyawan berhasil dikonfirmasi' });
  } catch (error: any) {
    console.error('Confirm verification error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
