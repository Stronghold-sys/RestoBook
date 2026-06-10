export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
    }

    // 1. Ambil profil user untuk mendapatkan profile_id dan memvalidasi role
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['cashier', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await req.json();
    const { assignmentId, action, rejectionReason } = body;

    if (!assignmentId || !action) {
      return NextResponse.json({ error: 'Data tidak lengkap (assignmentId & action wajib diisi)' }, { status: 400 });
    }

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
    }

    // 2. Fetch assignment terkait menggunakan admin client (bypass RLS)
    const { data: assignment, error: assignError } = await supabaseAdmin
      .from('work_shift_assignments')
      .select('*, work_shifts(*), substitute_for:profiles!work_shift_assignments_substitute_for_profile_id_fkey(*)')
      .eq('id', assignmentId)
      .maybeSingle();

    if (assignError || !assignment) {
      return NextResponse.json({ error: 'Penugasan shift tidak ditemukan' }, { status: 404 });
    }

    // Pastikan assignment ini benar milik kasir yang sedang merespon
    if (assignment.profile_id !== profile.id) {
      return NextResponse.json({ error: 'Akses ditolak. Penugasan ini bukan ditujukan untuk Anda.' }, { status: 403 });
    }

    // Pastikan ini adalah shift pengganti
    if (!assignment.is_substitute) {
      return NextResponse.json({ error: 'Penugasan ini bukan merupakan shift pengganti.' }, { status: 400 });
    }

    // Pastikan status saat ini masih pending
    if (assignment.status !== 'pending') {
      return NextResponse.json({ error: `Penugasan ini sudah diproses sebelumnya dengan status: ${assignment.status}` }, { status: 400 });
    }

    // 3. Update status & timestamp
    const nowStr = new Date().toISOString();
    const updatePayload: any = {};
    let newStatus = '';

    if (action === 'accept') {
      newStatus = 'accepted';
      updatePayload.status = 'accepted';
      updatePayload.accepted_at = nowStr;
    } else {
      newStatus = 'rejected';
      updatePayload.status = 'rejected';
      updatePayload.rejected_at = nowStr;
      updatePayload.rejection_reason = rejectionReason || 'Tidak ada alasan yang diberikan';
    }

    const { data: updatedAssign, error: updateError } = await supabaseAdmin
      .from('work_shift_assignments')
      .update(updatePayload)
      .eq('id', assignmentId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 4. Catat ke audit_logs
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown Browser';
    let device = 'Desktop';
    if (/mobile/i.test(userAgent)) device = 'Mobile';
    else if (/tablet/i.test(userAgent)) device = 'Tablet';

    await supabaseAdmin.from('audit_logs').insert({
      action: action === 'accept' ? 'accept_substitute_shift' : 'reject_substitute_shift',
      operator_id: profile.id,
      operator_name: profile.full_name,
      target_id: assignment.id,
      target_name: `Shift Pengganti: ${assignment.work_shifts?.name || 'Shift'} (${assignment.substitute_date})`,
      data_before: assignment,
      data_after: updatedAssign,
      ip_address: ip,
      browser: userAgent,
      device: device
    });

    return NextResponse.json({
      success: true,
      message: action === 'accept' ? 'Shift pengganti berhasil disetujui.' : 'Shift pengganti berhasil ditolak.',
      assignment: updatedAssign
    });

  } catch (error: any) {
    console.error('Respond substitution error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
