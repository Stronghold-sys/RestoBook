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

    const body = await request.json();
    const { reported_fields, current_values, proposed_values, description, attachment_url } = body;

    if (!reported_fields || !Array.isArray(reported_fields) || reported_fields.length === 0) {
      return NextResponse.json({ error: 'Data yang salah wajib dipilih' }, { status: 400 });
    }
    if (!description || description.trim() === '') {
      return NextResponse.json({ error: 'Deskripsi penjelasan kesalahan wajib diisi' }, { status: 400 });
    }

    // Insert new report
    const { data: report, error: reportErr } = await supabaseAdmin
      .from('employee_data_reports')
      .insert({
        profile_id: profile.id,
        reported_fields,
        current_values: current_values || {},
        proposed_values: proposed_values || {},
        description,
        attachment_url: attachment_url || null,
        status: 'pending'
      })
      .select()
      .single();

    if (reportErr) throw reportErr;

    // Update profile verification status
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        data_verified: false,
        verification_status: 'report_submitted'
      })
      .eq('id', profile.id);

    if (updateErr) throw updateErr;

    // Log this action
    await createAuditLog('EMPLOYEE_REPORTED_DATA_ERROR', {
      profile_id: profile.id,
      employee_id: profile.employee_id,
      report_id: report.id,
      fields: reported_fields
    });

    return NextResponse.json({ success: true, message: 'Laporan kesalahan data berhasil dikirim', report });
  } catch (error: any) {
    console.error('Report verification error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
