export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendWalletActivationEmail } from '@/lib/sendWalletActivationEmail';

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Silakan login kembali' }, { status: 401 });
    }

    // Check if admin
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Hanya untuk Admin.' }, { status: 403 });
    }

    // Fetch all activations with profile details
    const { data: activations, error } = await supabaseAdmin
      .from('wallet_activations')
      .select('*, profiles:profile_id(full_name, email, phone, avatar_url, wallet_balance, wallet_status)')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Fetch all logs
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('wallet_activation_logs')
      .select('*, admin:admin_id(full_name)')
      .order('created_at', { ascending: false });

    if (logsError) throw logsError;

    return NextResponse.json({ success: true, activations, logs });
  } catch (error: any) {
    console.error('Admin Wallet Activations GET Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Silakan login kembali' }, { status: 401 });
    }

    // Check if admin
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id, role, full_name')
      .eq('user_id', user.id)
      .single();

    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Hanya untuk Admin.' }, { status: 403 });
    }

    const body = await req.json();
    const { activationId, action, rejectionReason, invalidFields } = body;

    if (!activationId || !action) {
      return NextResponse.json({ error: 'ID aktivasi dan aksi wajib disertakan' }, { status: 400 });
    }

    // Fetch target activation record
    const { data: activation, error: fetchErr } = await supabaseAdmin
      .from('wallet_activations')
      .select('*, profiles:profile_id(email, full_name)')
      .eq('id', activationId)
      .single();

    if (fetchErr || !activation) {
      return NextResponse.json({ error: 'Data pengajuan aktivasi tidak ditemukan' }, { status: 404 });
    }

    const customerEmail = activation.profiles?.email || activation.email;
    const customerName = activation.profiles?.full_name || activation.full_name;

    let targetStatus = '';
    let notifTitle = '';
    let notifMessage = '';
    let statusBadge = '';
    let logMessage = '';

    if (action === 'start_review') {
      targetStatus = 'diproses';
      notifTitle = 'Pengajuan Dompetku Diproses';
      notifMessage = 'Tim kami sedang memeriksa pengajuan aktivasi Dompetku Anda. Mohon menunggu hasil verifikasi.';
      statusBadge = 'Diproses';
      logMessage = 'Admin mulai melakukan peninjauan dokumen pengajuan';
    } else if (action === 'approve') {
      targetStatus = 'selesai'; // 'selesai' means approved and ready to use
      notifTitle = 'Aktivasi Dompetku Disetujui';
      notifMessage = 'Selamat, pengajuan aktivasi Dompetku Anda telah disetujui. Fitur Dompetku sekarang aktif dan dapat digunakan.';
      statusBadge = 'Selesai';
      logMessage = 'Admin menyetujui pengajuan aktivasi Dompetku';
    } else if (action === 'reject') {
      if (!rejectionReason) {
        return NextResponse.json({ error: 'Alasan penolakan / catatan revisi wajib diisi' }, { status: 400 });
      }
      targetStatus = 'ditolak';
      notifTitle = 'Aktivasi Dompetku Ditolak';
      notifMessage = `Maaf, pengajuan aktivasi Dompetku Anda belum dapat disetujui. Catatan admin: ${rejectionReason}`;
      statusBadge = 'Ditolak';
      logMessage = `Admin menolak pengajuan aktivasi Dompetku dengan alasan: ${rejectionReason}`;
    } else {
      return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
    }

    // 1. Update wallet_activations record
    const updatePayload: any = {
      status: targetStatus,
      processed_by: adminProfile.id,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (action === 'reject') {
      updatePayload.rejection_reason = rejectionReason;
      updatePayload.invalid_fields = JSON.stringify(invalidFields || []);
    } else if (action === 'approve') {
      updatePayload.rejection_reason = null;
      updatePayload.invalid_fields = [];
    }

    const { error: updateActErr } = await supabaseAdmin
      .from('wallet_activations')
      .update(updatePayload)
      .eq('id', activationId);

    if (updateActErr) throw updateActErr;

    // 2. Update profiles.wallet_status
    const { error: updateProfileErr } = await supabaseAdmin
      .from('profiles')
      .update({ wallet_status: targetStatus })
      .eq('id', activation.profile_id);

    if (updateProfileErr) throw updateProfileErr;

    // 3. Log activation logs
    await supabaseAdmin.from('wallet_activation_logs').insert({
      activation_id: activationId,
      profile_id: activation.profile_id,
      admin_id: adminProfile.id,
      action: action,
      from_status: activation.status,
      to_status: targetStatus,
      notes: logMessage
    });

    // 4. Send customer notification
    await supabaseAdmin.from('notifications').insert({
      user_id: activation.profile_id,
      title: notifTitle,
      message: notifMessage,
      type: 'wallet_activation_update',
      status_badge: statusBadge
    });

    // 5. Send Email automatically
    if (customerEmail) {
      await sendWalletActivationEmail(
        customerEmail,
        customerName,
        targetStatus as any,
        rejectionReason,
        invalidFields
      );
    }

    return NextResponse.json({ success: true, message: `Status berhasil diubah ke ${targetStatus}` });
  } catch (error: any) {
    console.error('Admin Wallet Activations POST Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
