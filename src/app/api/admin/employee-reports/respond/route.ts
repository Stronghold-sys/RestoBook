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

    // Verify Admin authentication
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: adminProfile, error: adminErr } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (adminErr || adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya Administrator yang diizinkan memproses laporan' }, { status: 403 });
    }

    const body = await request.json();
    const { report_id, action, admin_comment } = body;

    if (!report_id || !action) {
      return NextResponse.json({ error: 'Report ID dan action wajib diisi' }, { status: 400 });
    }

    // Get the report detail
    const { data: report, error: reportErr } = await supabaseAdmin
      .from('employee_data_reports')
      .select('*')
      .eq('id', report_id)
      .single();

    if (reportErr || !report) {
      return NextResponse.json({ error: 'Laporan tidak ditemukan' }, { status: 404 });
    }

    if (action === 'approve') {
      // 1. Update profiles table with proposed values dynamically
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update({
          ...report.proposed_values,
          data_verified: true,
          verification_status: 'verified'
        })
        .eq('id', report.profile_id);

      if (profileErr) throw profileErr;

      // 2. Update employee_data_reports status
      const { error: updateReportErr } = await supabaseAdmin
        .from('employee_data_reports')
        .update({
          status: 'completed',
          admin_comment: admin_comment || 'Laporan disetujui, data profil karyawan telah diperbarui secara otomatis oleh sistem.',
          updated_at: new Date().toISOString()
        })
        .eq('id', report_id);

      if (updateReportErr) throw updateReportErr;

      // 3. Log Audit
      await createAuditLog('EMPLOYEE_REPORT_APPROVED', {
        report_id,
        profile_id: report.profile_id,
        approved_fields: report.reported_fields
      });

      return NextResponse.json({ success: true, message: 'Laporan berhasil disetujui dan data karyawan diperbarui' });
    }

    if (action === 'reject') {
      if (!admin_comment || admin_comment.trim() === '') {
        return NextResponse.json({ error: 'Alasan penolakan (komentar admin) wajib diisi' }, { status: 400 });
      }

      // 1. Update employee_data_reports status
      const { error: updateReportErr } = await supabaseAdmin
        .from('employee_data_reports')
        .update({
          status: 'rejected',
          admin_comment,
          updated_at: new Date().toISOString()
        })
        .eq('id', report_id);

      if (updateReportErr) throw updateReportErr;

      // 2. Update profiles verification status
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update({
          verification_status: 'report_rejected'
        })
        .eq('id', report.profile_id);

      if (profileErr) throw profileErr;

      // 3. Log Audit
      await createAuditLog('EMPLOYEE_REPORT_REJECTED', {
        report_id,
        profile_id: report.profile_id,
        comment: admin_comment
      });

      return NextResponse.json({ success: true, message: 'Laporan berhasil ditolak' });
    }

    if (action === 'process') {
      // 1. Update employee_data_reports status
      const { error: updateReportErr } = await supabaseAdmin
        .from('employee_data_reports')
        .update({
          status: 'processing',
          admin_comment: admin_comment || 'Laporan sedang ditinjau oleh tim administrator.',
          updated_at: new Date().toISOString()
        })
        .eq('id', report_id);

      if (updateReportErr) throw updateReportErr;

      // 2. Update profiles verification status
      const { error: profileErr } = await supabaseAdmin
        .from('profiles')
        .update({
          verification_status: 'report_in_review'
        })
        .eq('id', report.profile_id);

      if (profileErr) throw profileErr;

      // 3. Log Audit
      await createAuditLog('EMPLOYEE_REPORT_PROCESSING', {
        report_id,
        profile_id: report.profile_id
      });

      return NextResponse.json({ success: true, message: 'Status laporan diubah menjadi sedang diproses' });
    }

    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('Respond report error:', error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
