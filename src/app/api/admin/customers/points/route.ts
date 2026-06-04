export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('user_id', user.id)
    .single();
  return profile?.role === 'admin' ? profile.id : null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const adminProfileId = await checkAdmin(supabase);
    if (!adminProfileId) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');
    const allTx = searchParams.get('allTransactions');

    if (allTx === 'true') {
      const { data: transactions, error: txErr } = await supabaseAdmin
        .from('point_transactions')
        .select(`
          *,
          customer:profiles!point_transactions_customer_id_fkey (
            full_name,
            email,
            phone
          ),
          acted_profile:profiles!point_transactions_acted_by_fkey (
            full_name
          )
        `)
        .order('created_at', { ascending: false });

      if (txErr) throw txErr;

      return NextResponse.json({
        success: true,
        transactions: transactions || []
      });
    }

    if (customerId) {
      // Get point transactions for specific customer with creator details
      const { data: transactions, error: txErr } = await supabaseAdmin
        .from('point_transactions')
        .select(`
          *,
          acted_profile:acted_by (
            id,
            full_name
          )
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (txErr) throw txErr;

      return NextResponse.json({ 
        success: true, 
        transactions: transactions || []
      });
    }

    // List all customer profiles with complete point summaries
    const { data: customers, error: custErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, phone, points, pending_points, points_used, is_redeem_blocked, points_status, created_at')
      .eq('role', 'customer')
      .order('full_name', { ascending: true });

    if (custErr) throw custErr;

    return NextResponse.json({ success: true, customers: customers || [] });
  } catch (error: any) {
    console.error('Admin customers points fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const adminProfileId = await checkAdmin(supabase);
    if (!adminProfileId) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await req.json();
    const { 
      action, 
      customerId, 
      customerIds, 
      amount, 
      reason, 
      status, 
      transactionId 
    } = body;

    // Validation: Check if reason is provided for modifying actions
    const criticalActions = ['adjust', 'set', 'reset', 'update_status', 'approve_pending', 'reject_pending', 'bulk_adjust', 'bulk_reset', 'bulk_update_status'];
    if (criticalActions.includes(action)) {
      if (!reason || !reason.trim()) {
        return NextResponse.json({ error: 'Alasan penyesuaian wajib diisi' }, { status: 400 });
      }
    }

    // --- BULK ACTIONS ---
    if (action === 'bulk_adjust') {
      if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
        return NextResponse.json({ error: 'Daftar pelanggan kosong' }, { status: 400 });
      }
      const adjAmount = Number(amount);
      if (isNaN(adjAmount) || adjAmount === 0) {
        return NextResponse.json({ error: 'Jumlah poin tidak valid' }, { status: 400 });
      }

      const results = [];
      for (const cid of customerIds) {
        try {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('points')
            .eq('id', cid)
            .single();

          if (!profile) {
            results.push({ customerId: cid, success: false, error: 'Pelanggan tidak ditemukan' });
            continue;
          }

          const curPoints = profile.points || 0;
          const newPoints = curPoints + adjAmount;
          if (newPoints < 0) {
            results.push({ customerId: cid, success: false, error: 'Poin tidak cukup (saldo tidak boleh minus)' });
            continue;
          }

          // Update profiles
          const { error: updErr } = await supabaseAdmin
            .from('profiles')
            .update({ points: newPoints })
            .eq('id', cid);
          if (updErr) throw updErr;

          // Insert point transactions
          await supabaseAdmin.from('point_transactions').insert({
            customer_id: cid,
            points: adjAmount,
            before_points: curPoints,
            after_points: newPoints,
            acted_by: adminProfileId,
            source_type: 'manual',
            status: adjAmount > 0 ? 'aktif' : 'redeemed',
            reason: reason.trim(),
            description: reason.trim()
          });

          // Insert Notification
          await supabaseAdmin.from('notifications').insert({
            user_id: cid,
            title: adjAmount > 0 ? 'Poin Ditambahkan Manual' : 'Poin Dikurangi Manual',
            message: `Poin Anda telah ${adjAmount > 0 ? 'ditambahkan' : 'dikurangi'} sebesar ${Math.abs(adjAmount)} poin secara massal oleh admin. Alasan: ${reason.trim()}`,
            type: 'points_adjustment'
          });

          results.push({ customerId: cid, success: true });
        } catch (err: any) {
          results.push({ customerId: cid, success: false, error: err.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;
      return NextResponse.json({ 
        success: true, 
        message: `Berhasil memproses ${successCount} pelanggan. Gagal ${failCount} pelanggan.`,
        details: results 
      });
    }

    if (action === 'bulk_reset') {
      if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
        return NextResponse.json({ error: 'Daftar pelanggan kosong' }, { status: 400 });
      }

      const results = [];
      for (const cid of customerIds) {
        try {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('points')
            .eq('id', cid)
            .single();

          if (!profile) {
            results.push({ customerId: cid, success: false, error: 'Pelanggan tidak ditemukan' });
            continue;
          }

          const curPoints = profile.points || 0;
          if (curPoints === 0) {
            results.push({ customerId: cid, success: true, message: 'Saldo sudah 0' });
            continue;
          }

          // Update profiles
          const { error: updErr } = await supabaseAdmin
            .from('profiles')
            .update({ points: 0 })
            .eq('id', cid);
          if (updErr) throw updErr;

          // Insert point transactions
          await supabaseAdmin.from('point_transactions').insert({
            customer_id: cid,
            points: -curPoints,
            before_points: curPoints,
            after_points: 0,
            acted_by: adminProfileId,
            source_type: 'manual',
            status: 'reset',
            reason: reason.trim(),
            description: reason.trim()
          });

          // Insert Notification
          await supabaseAdmin.from('notifications').insert({
            user_id: cid,
            title: 'Poin Direset',
            message: `Poin Anda telah direset menjadi 0 secara massal oleh admin. Alasan: ${reason.trim()}`,
            type: 'points_reset'
          });

          results.push({ customerId: cid, success: true });
        } catch (err: any) {
          results.push({ customerId: cid, success: false, error: err.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      return NextResponse.json({ 
        success: true, 
        message: `Berhasil mereset poin ${successCount} pelanggan.`
      });
    }

    if (action === 'bulk_update_status') {
      if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
        return NextResponse.json({ error: 'Daftar pelanggan kosong' }, { status: 400 });
      }
      const allowedStatus = ['aktif', 'pending', 'diblokir', 'dibatasi', 'nonaktif_sementara'];
      if (!allowedStatus.includes(status)) {
        return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 });
      }

      const isBlocked = ['diblokir', 'dibatasi', 'nonaktif_sementara'].includes(status);
      const results = [];

      for (const cid of customerIds) {
        try {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('points, points_status')
            .eq('id', cid)
            .single();

          if (!profile) {
            results.push({ customerId: cid, success: false, error: 'Pelanggan tidak ditemukan' });
            continue;
          }

          // Update profiles status and restriction
          const { error: updErr } = await supabaseAdmin
            .from('profiles')
            .update({ 
              points_status: status, 
              is_redeem_blocked: isBlocked
            })
            .eq('id', cid);
          if (updErr) throw updErr;

          // Insert log
          await supabaseAdmin.from('point_transactions').insert({
            customer_id: cid,
            points: 0,
            before_points: profile.points || 0,
            after_points: profile.points || 0,
            acted_by: adminProfileId,
            source_type: 'manual',
            status: 'koreksi',
            reason: reason.trim(),
            description: `Mengubah status poin secara massal menjadi ${status}`
          });

          // Notification title & msg
          let notifTitle = 'Status Poin Diperbarui';
          let notifMsg = `Status poin Anda telah diubah menjadi ${status} oleh admin.`;
          if (status === 'diblokir') {
            notifTitle = 'Akses Penukaran Poin Diblokir';
            notifMsg = 'Akses penukaran poin Anda telah diblokir sementara oleh admin.';
          }

          await supabaseAdmin.from('notifications').insert({
            user_id: cid,
            title: notifTitle,
            message: notifMsg + ` Catatan: ${reason.trim()}`,
            type: 'points_status_change'
          });

          results.push({ customerId: cid, success: true });
        } catch (err: any) {
          results.push({ customerId: cid, success: false, error: err.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      return NextResponse.json({ 
        success: true, 
        message: `Berhasil memperbarui status ${successCount} pelanggan.`
      });
    }

    // --- SINGLE CUSTOMER ACTIONS ---
    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('points, pending_points, points_status, is_redeem_blocked')
      .eq('id', customerId)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    if (action === 'adjust') {
      const adjAmount = Number(amount);
      if (isNaN(adjAmount) || adjAmount === 0) {
        return NextResponse.json({ error: 'Jumlah poin tidak valid' }, { status: 400 });
      }

      const currentPoints = profile.points || 0;
      const newPoints = currentPoints + adjAmount;

      if (newPoints < 0) {
        return NextResponse.json({ error: 'Saldo poin aktif tidak mencukupi untuk dikurangi. Transaksi dibatalkan.' }, { status: 400 });
      }

      // Update customer points
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ points: newPoints })
        .eq('id', customerId);

      if (updateErr) throw updateErr;

      // Log transaction with audit details
      const statusTx = adjAmount > 0 ? 'aktif' : 'redeemed';
      await supabaseAdmin.from('point_transactions').insert({
        customer_id: customerId,
        points: adjAmount,
        before_points: currentPoints,
        after_points: newPoints,
        acted_by: adminProfileId,
        source_type: 'manual',
        status: statusTx,
        reason: reason.trim(),
        description: reason.trim()
      });

      // Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: adjAmount > 0 ? 'Poin Ditambahkan Manual' : 'Poin Dikurangi Manual',
        message: `Poin Anda ${adjAmount > 0 ? 'bertambah sebesar' : 'dikurangi sebesar'} ${Math.abs(adjAmount)} poin oleh admin. Alasan: ${reason.trim()}`,
        type: 'points_adjustment'
      });

      return NextResponse.json({ success: true, newPoints });
    }

    if (action === 'set') {
      const targetAmount = Number(amount);
      if (isNaN(targetAmount) || targetAmount < 0) {
        return NextResponse.json({ error: 'Nominal poin tidak valid' }, { status: 400 });
      }

      const currentPoints = profile.points || 0;
      const diff = targetAmount - currentPoints;

      // Update customer points
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ points: targetAmount })
        .eq('id', customerId);

      if (updateErr) throw updateErr;

      // Log transaction with audit details
      await supabaseAdmin.from('point_transactions').insert({
        customer_id: customerId,
        points: diff,
        before_points: currentPoints,
        after_points: targetAmount,
        acted_by: adminProfileId,
        source_type: 'manual',
        status: 'koreksi',
        reason: reason.trim(),
        description: reason.trim()
      });

      // Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: 'Saldo Poin Dikoreksi',
        message: `Saldo poin Anda telah disesuaikan menjadi ${targetAmount} poin oleh admin. Alasan: ${reason.trim()}`,
        type: 'points_adjustment'
      });

      return NextResponse.json({ success: true, newPoints: targetAmount });
    }

    if (action === 'reset') {
      const currentPoints = profile.points || 0;
      const pointsToDeduct = -currentPoints;

      // Reset to 0
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ points: 0 })
        .eq('id', customerId);

      if (updateErr) throw updateErr;

      // Log transaction
      await supabaseAdmin.from('point_transactions').insert({
        customer_id: customerId,
        points: pointsToDeduct,
        before_points: currentPoints,
        after_points: 0,
        acted_by: adminProfileId,
        source_type: 'manual',
        status: 'reset',
        reason: reason.trim(),
        description: reason.trim()
      });

      // Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: 'Poin Direset',
        message: `Poin Anda telah direset menjadi 0 oleh admin. Alasan: ${reason.trim()}`,
        type: 'points_reset'
      });

      return NextResponse.json({ success: true, newPoints: 0 });
    }

    if (action === 'update_status') {
      const allowedStatus = ['aktif', 'pending', 'diblokir', 'dibatasi', 'nonaktif_sementara'];
      if (!allowedStatus.includes(status)) {
        return NextResponse.json({ error: 'Status tidak valid' }, { status: 400 });
      }

      const isBlocked = ['diblokir', 'dibatasi', 'nonaktif_sementara'].includes(status);
      const currentPoints = profile.points || 0;

      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ 
          points_status: status,
          is_redeem_blocked: isBlocked
        })
        .eq('id', customerId);

      if (updateErr) throw updateErr;

      // Log status adjustment
      await supabaseAdmin.from('point_transactions').insert({
        customer_id: customerId,
        points: 0,
        before_points: currentPoints,
        after_points: currentPoints,
        acted_by: adminProfileId,
        source_type: 'manual',
        status: 'koreksi',
        reason: reason.trim(),
        description: `Mengubah status poin menjadi ${status}`
      });

      // Notification
      let notifTitle = 'Status Poin Diperbarui';
      let notifMsg = `Status poin Anda telah diubah menjadi ${status} oleh admin.`;
      if (status === 'diblokir') {
        notifTitle = 'Akses Penukaran Poin Diblokir';
        notifMsg = 'Akses penukaran poin Anda telah diblokir sementara oleh admin.';
      } else if (status === 'dibatasi') {
        notifTitle = 'Akses Penukaran Poin Dibatasi';
        notifMsg = 'Akses penukaran poin Anda saat ini dibatasi oleh admin.';
      }

      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: notifTitle,
        message: notifMsg + ` Alasan: ${reason.trim()}`,
        type: 'points_status_change'
      });

      return NextResponse.json({ success: true, pointsStatus: status, isRedeemBlocked: isBlocked });
    }

    if (action === 'approve_pending') {
      if (!transactionId) {
        return NextResponse.json({ error: 'transactionId is required' }, { status: 400 });
      }

      // Get transaction
      const { data: tx, error: txErr } = await supabaseAdmin
        .from('point_transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('status', 'pending')
        .single();

      if (txErr || !tx) {
        return NextResponse.json({ error: 'Transaksi pending tidak ditemukan atau sudah diproses' }, { status: 404 });
      }

      const txPoints = tx.points || 0;
      const currentPoints = profile.points || 0;
      const nextPoints = currentPoints + txPoints;
      const currentPending = profile.pending_points || 0;
      const nextPending = Math.max(0, currentPending - txPoints);

      // Update customer profile points
      const { error: updErr } = await supabaseAdmin
        .from('profiles')
        .update({
          points: nextPoints,
          pending_points: nextPending
        })
        .eq('id', customerId);

      if (updErr) throw updErr;

      // Update point_transactions status
      const { error: txUpdErr } = await supabaseAdmin
        .from('point_transactions')
        .update({
          status: 'earned',
          before_points: currentPoints,
          after_points: nextPoints,
          acted_by: adminProfileId,
          reason: reason.trim(),
          description: `Persetujuan poin pending: ${reason.trim()}`
        })
        .eq('id', transactionId);

      if (txUpdErr) throw txUpdErr;

      // Send notification
      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: 'Poin Pending Disetujui',
        message: `Poin pending sebesar ${txPoints} telah disetujui oleh admin dan masuk ke poin aktif Anda. Alasan: ${reason.trim()}`,
        type: 'point'
      });

      return NextResponse.json({ success: true, newPoints: nextPoints, newPendingPoints: nextPending });
    }

    if (action === 'reject_pending') {
      if (!transactionId) {
        return NextResponse.json({ error: 'transactionId is required' }, { status: 400 });
      }

      // Get transaction
      const { data: tx, error: txErr } = await supabaseAdmin
        .from('point_transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('status', 'pending')
        .single();

      if (txErr || !tx) {
        return NextResponse.json({ error: 'Transaksi pending tidak ditemukan atau sudah diproses' }, { status: 404 });
      }

      const txPoints = tx.points || 0;
      const currentPoints = profile.points || 0;
      const currentPending = profile.pending_points || 0;
      const nextPending = Math.max(0, currentPending - txPoints);

      // Update pending points only
      const { error: updErr } = await supabaseAdmin
        .from('profiles')
        .update({
          pending_points: nextPending
        })
        .eq('id', customerId);

      if (updErr) throw updErr;

      // Update transaction status to cancelled
      const { error: txUpdErr } = await supabaseAdmin
        .from('point_transactions')
        .update({
          status: 'cancelled',
          before_points: currentPoints,
          after_points: currentPoints,
          acted_by: adminProfileId,
          reason: reason.trim(),
          description: `Poin pending ditolak oleh admin: ${reason.trim()}`
        })
        .eq('id', transactionId);

      if (txUpdErr) throw txUpdErr;

      // Send notification
      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: 'Poin Pending Ditolak',
        message: `Poin pending sebesar ${txPoints} telah ditolak/dibatalkan oleh admin. Alasan: ${reason.trim()}`,
        type: 'point'
      });

      return NextResponse.json({ success: true, newPendingPoints: nextPending });
    }

    // Toggle block (legacy support/backward compatibility)
    if (action === 'toggle_block') {
      const nextStatus = !profile.is_redeem_blocked;
      const pointsStatus = nextStatus ? 'diblokir' : 'aktif';

      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ 
          is_redeem_blocked: nextStatus,
          points_status: pointsStatus
        })
        .eq('id', customerId);

      if (updateErr) throw updateErr;

      // Log transaction
      await supabaseAdmin.from('point_transactions').insert({
        customer_id: customerId,
        points: 0,
        before_points: profile.points || 0,
        after_points: profile.points || 0,
        acted_by: adminProfileId,
        source_type: 'manual',
        status: 'koreksi',
        reason: nextStatus ? 'Akses penukaran diblokir' : 'Akses penukaran dibuka kembali',
        description: nextStatus ? 'Akses penukaran diblokir' : 'Akses penukaran dibuka kembali'
      });

      // Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: nextStatus ? 'Akses Penukaran Diblokir' : 'Akses Penukaran Dibuka',
        message: nextStatus 
          ? 'Penukaran reward poin Anda telah diblokir sementara oleh admin.'
          : 'Akses penukaran reward poin Anda telah dibuka kembali. Anda sekarang dapat menukarkan poin.',
        type: 'points_block_toggle'
      });

      return NextResponse.json({ success: true, isRedeemBlocked: nextStatus, pointsStatus });
    }

    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('Admin customers points post error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
