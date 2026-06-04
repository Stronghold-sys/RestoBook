export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendWalletActivationEmail } from '@/lib/sendWalletActivationEmail';

async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('user_id', user.id)
    .single();
  return profile?.role === 'admin' ? profile : null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const admin = await checkAdmin(supabase);
    if (!admin) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Fetch Stats
    // 1. Customer counts by wallet status
    const { data: statusCounts } = await supabaseAdmin
      .from('profiles')
      .select('wallet_status, is_wallet_blocked')
      .eq('role', 'customer');

    const stats = {
      total: statusCounts?.length || 0,
      active: 0,
      inactive: 0,
      blocked: 0,
      pending: 0,
      processing: 0,
      totalBalance: 0,
      totalBlockedBalance: 0
    };

    // Calculate balances
    const { data: balances } = await supabaseAdmin
      .from('profiles')
      .select('wallet_balance, is_wallet_blocked, wallet_status')
      .eq('role', 'customer');

    if (balances) {
      balances.forEach((b: any) => {
        const bal = Number(b.wallet_balance || 0);
        if (b.is_wallet_blocked) {
          stats.blocked++;
          stats.totalBlockedBalance += bal;
        } else {
          stats.totalBalance += bal;
          if (b.wallet_status === 'aktif' || b.wallet_status === 'selesai' || b.wallet_status === 'diterima') {
            stats.active++;
          } else if (b.wallet_status === 'diajukan' || b.wallet_status === 'diajukan_ulang' || b.wallet_status === 'pending') {
            stats.pending++;
          } else if (b.wallet_status === 'diproses') {
            stats.processing++;
          } else {
            stats.inactive++;
          }
        }
      });
    }

    // 2. Financial sums from transactions
    const { data: txSums } = await supabaseAdmin
      .from('wallet_transactions')
      .select('type, amount, status');

    const finance = {
      totalTopup: 0,
      totalRefund: 0,
      totalSpent: 0,
      totalAdjust: 0
    };

    if (txSums) {
      txSums.forEach((tx: any) => {
        if (tx.status === 'success') {
          const amt = Math.abs(Number(tx.amount || 0));
          if (tx.type === 'topup') finance.totalTopup += amt;
          else if (tx.type === 'refund') finance.totalRefund += amt;
          else if (tx.type === 'payment') finance.totalSpent += amt;
          else if (tx.type === 'adjust') finance.totalAdjust += Number(tx.amount || 0);
        }
      });
    }

    // Query Customers with filters
    let query = supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, phone, wallet_balance, is_wallet_blocked, wallet_status, wallet_block_reason, wallet_pin_reset_required, created_at', { count: 'exact' })
      .eq('role', 'customer');

    if (status) {
      if (status === 'blocked') {
        query = query.eq('is_wallet_blocked', true);
      } else if (status === 'active') {
        query = query.in('wallet_status', ['aktif', 'selesai', 'diterima']).eq('is_wallet_blocked', false);
      } else if (status === 'pending') {
        query = query.in('wallet_status', ['diajukan', 'diajukan_ulang', 'pending']).eq('is_wallet_blocked', false);
      } else if (status === 'processing') {
        query = query.eq('wallet_status', 'diproses').eq('is_wallet_blocked', false);
      } else if (status === 'inactive') {
        query = query.in('wallet_status', ['belum_aktif', 'nonaktif', 'ditolak']).eq('is_wallet_blocked', false);
      }
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: customers, count, error: custError } = await query
      .order('full_name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (custError) throw custError;

    // Fetch Global Audit Logs
    const { data: auditLogs } = await supabaseAdmin
      .from('wallet_audit_logs')
      .select('*, customer:customer_id(full_name, email), actor:acted_by(full_name)')
      .order('created_at', { ascending: false })
      .limit(100);

    return NextResponse.json({
      success: true,
      stats,
      finance,
      customers: customers || [],
      totalCount: count || 0,
      auditLogs: auditLogs || []
    });

  } catch (error: any) {
    console.error('Admin Wallet GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const admin = await checkAdmin(supabase);
    if (!admin) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await req.json();
    const { customerId, action, amount, reason, note } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'customerId wajib disertakan' }, { status: 400 });
    }

    // Get customer profile details
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, phone, wallet_balance, wallet_status, is_wallet_blocked, wallet_block_reason')
      .eq('id', customerId)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    const beforeStatus = profile.is_wallet_blocked ? 'diblokir' : profile.wallet_status || 'belum_aktif';
    const beforeBalance = Number(profile.wallet_balance || 0);

    // ACTION: CHANGE STATUS
    if (action === 'change_status') {
      const { targetStatus, statusReason } = body;
      if (!targetStatus) {
        return NextResponse.json({ error: 'targetStatus wajib disertakan' }, { status: 400 });
      }

      let updatePayload: any = {};
      let logActionType = 'status_change';
      let afterStatusValue = targetStatus;

      if (targetStatus === 'diblokir') {
        if (!statusReason) {
          return NextResponse.json({ error: 'Alasan blokir wajib diisi' }, { status: 400 });
        }
        updatePayload = {
          is_wallet_blocked: true,
          wallet_block_reason: statusReason
        };
      } else if (targetStatus === 'buka_blokir') {
        const { resumeStatus } = body; // status lanjutan setelah blokir dibuka
        const finalStatus = resumeStatus || 'aktif';
        updatePayload = {
          is_wallet_blocked: false,
          wallet_block_reason: null,
          wallet_status: finalStatus,
          wrong_pin_count: 0
        };
        afterStatusValue = finalStatus;
      } else {
        // standard status change: aktif, nonaktif, pending, diproses
        updatePayload = {
          wallet_status: targetStatus,
          is_wallet_blocked: targetStatus === 'diblokir'
        };
        if (targetStatus !== 'diblokir') {
          updatePayload.wallet_block_reason = null;
        }
      }

      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update(updatePayload)
        .eq('id', customerId);

      if (updateErr) throw updateErr;

      // Save Audit Log
      await supabaseAdmin.from('wallet_audit_logs').insert({
        customer_id: customerId,
        action_type: 'status_change',
        before_value: beforeStatus,
        after_value: afterStatusValue,
        reason: statusReason || reason || `Ubah status dompet menjadi ${afterStatusValue}`,
        acted_by: admin.id,
        internal_note: note || null
      });

      // Insert Notification
      let notifTitle = 'Status Dompetku Diperbarui';
      let notifMsg = `Status Dompetku Anda telah diubah oleh administrator menjadi ${afterStatusValue}.`;

      if (targetStatus === 'aktif' || afterStatusValue === 'aktif') {
        notifTitle = 'Aktivasi Dompetku Berhasil';
        notifMsg = 'Dompetku Anda telah diaktifkan dan kini dapat digunakan.';
      } else if (targetStatus === 'nonaktif') {
        notifTitle = 'Dompetku Dinonaktifkan';
        notifMsg = 'Dompetku Anda saat ini dinonaktifkan sementara.';
      } else if (targetStatus === 'diblokir') {
        notifTitle = 'Akses Dompetku Diblokir';
        notifMsg = `Dompetku Anda diblokir dan tidak dapat digunakan untuk saat ini. Alasan: ${statusReason}`;
      } else if (targetStatus === 'pending') {
        notifTitle = 'Pengajuan Dompetku Pending';
        notifMsg = 'Dompetku Anda sedang dalam proses verifikasi.';
      } else if (targetStatus === 'diproses') {
        notifTitle = 'Pengajuan Dompetku Diproses';
        notifMsg = 'Dompetku Anda sedang diperiksa oleh tim admin.';
      }

      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: notifTitle,
        message: notifMsg,
        type: 'wallet_status_change'
      });

      // Send Email automatically if active
      if (profile.email && (targetStatus === 'aktif' || afterStatusValue === 'aktif' || targetStatus === 'nonaktif' || targetStatus === 'diblokir' || targetStatus === 'pending' || targetStatus === 'diproses')) {
        let emailStatusKey = targetStatus;
        if (targetStatus === 'buka_blokir') emailStatusKey = 'aktif';
        // map 'aktif' to 'selesai' for activation email compatibility
        if (emailStatusKey === 'aktif') emailStatusKey = 'selesai';

        await sendWalletActivationEmail(
          profile.email,
          profile.full_name,
          emailStatusKey as any,
          statusReason || reason || undefined
        );
      }

      return NextResponse.json({ success: true, message: `Status berhasil diubah ke ${afterStatusValue}` });
    }

    // ACTION: ADJUST BALANCE (tambah, kurangi, reset, koreksi, refund)
    if (action === 'adjust_balance') {
      const { type, amountValue, adjustReason, refundReference } = body;
      const nominal = Number(amountValue);

      if (isNaN(nominal) && type !== 'reset') {
        return NextResponse.json({ error: 'Jumlah saldo tidak valid' }, { status: 400 });
      }

      if (!adjustReason) {
        return NextResponse.json({ error: 'Alasan penyesuaian saldo wajib diisi' }, { status: 400 });
      }

      let newBalance = beforeBalance;
      let txAmount = nominal;
      let description = adjustReason;

      if (type === 'add') {
        newBalance = beforeBalance + nominal;
        txAmount = nominal;
        description = adjustReason || 'Penambahan saldo oleh admin';
      } else if (type === 'deduct') {
        if (beforeBalance < nominal) {
          return NextResponse.json({ error: 'Saldo pelanggan tidak mencukupi untuk melakukan pemotongan' }, { status: 400 });
        }
        newBalance = Math.max(0, beforeBalance - nominal);
        txAmount = -nominal;
        description = adjustReason || 'Pengurangan saldo oleh admin';
      } else if (type === 'reset') {
        newBalance = 0;
        txAmount = -beforeBalance;
        description = adjustReason || 'Reset saldo oleh admin';
      } else if (type === 'correct') {
        newBalance = nominal;
        txAmount = nominal - beforeBalance;
        description = adjustReason || `Koreksi saldo dari Rp ${beforeBalance.toLocaleString('id-ID')} menjadi Rp ${nominal.toLocaleString('id-ID')}`;
      } else if (type === 'refund') {
        newBalance = beforeBalance + nominal;
        txAmount = nominal;
        description = adjustReason || `Refund dana untuk referensi #${refundReference || ''}`;
      }

      if (txAmount === 0 && type !== 'correct') {
        return NextResponse.json({ error: 'Tidak ada perubahan saldo yang terdeteksi' }, { status: 400 });
      }

      // Update balance
      const { error: balanceErr } = await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: newBalance })
        .eq('id', customerId);

      if (balanceErr) throw balanceErr;

      // Log wallet transaction
      const { error: txErr } = await supabaseAdmin
        .from('wallet_transactions')
        .insert({
          customer_id: customerId,
          amount: txAmount,
          type: type === 'refund' ? 'refund' : 'adjust',
          status: 'success',
          description: description,
          payment_reference: refundReference || null
        });

      if (txErr) throw txErr;

      // Save Audit Log
      await supabaseAdmin.from('wallet_audit_logs').insert({
        customer_id: customerId,
        action_type: 'balance_change',
        before_value: `Rp ${beforeBalance.toLocaleString('id-ID')}`,
        after_value: `Rp ${newBalance.toLocaleString('id-ID')}`,
        reason: description,
        acted_by: admin.id,
        internal_note: note || null
      });

      // Insert Notification
      const balanceDiffStr = `Rp ${Math.abs(txAmount).toLocaleString('id-ID')}`;
      let notifTitle = 'Saldo Dompetku Diperbarui';
      let notifMsg = `Saldo Dompetku Anda telah diperbarui.`;

      if (type === 'add') {
        notifTitle = 'Saldo Dompet Ditambahkan';
        notifMsg = `Saldo sebesar ${balanceDiffStr} telah ditambahkan oleh admin. Alasan: ${description}`;
      } else if (type === 'deduct') {
        notifTitle = 'Saldo Dompet Dikurangi';
        notifMsg = `Saldo sebesar ${balanceDiffStr} telah dikurangi oleh admin. Alasan: ${description}`;
      } else if (type === 'reset') {
        notifTitle = 'Saldo Dompet Direset';
        notifMsg = `Saldo Dompetku Anda telah direset menjadi Rp 0 oleh admin. Alasan: ${description}`;
      } else if (type === 'correct') {
        notifTitle = 'Koreksi Saldo Dompet';
        notifMsg = `Saldo Dompetku Anda dikoreksi menjadi Rp ${newBalance.toLocaleString('id-ID')} oleh admin. Alasan: ${description}`;
      } else if (type === 'refund') {
        notifTitle = 'Refund Dana Berhasil';
        notifMsg = `Refund dana sebesar ${balanceDiffStr} berhasil ditambahkan ke Dompetku Anda.`;
      }

      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: notifTitle,
        message: notifMsg,
        type: 'wallet_balance_adjustment'
      });

      return NextResponse.json({
        success: true,
        newBalance,
        message: `Saldo berhasil diperbarui menjadi Rp ${newBalance.toLocaleString('id-ID')}`
      });
    }

    // ACTION: INTERNAL NOTE ONLY
    if (action === 'internal_note') {
      if (!note) {
        return NextResponse.json({ error: 'Memo internal tidak boleh kosong' }, { status: 400 });
      }

      await supabaseAdmin.from('wallet_audit_logs').insert({
        customer_id: customerId,
        action_type: 'internal_note',
        before_value: null,
        after_value: null,
        reason: 'Pemberian memo internal admin',
        acted_by: admin.id,
        internal_note: note
      });

      return NextResponse.json({ success: true, message: 'Memo internal berhasil disimpan' });
    }

    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });

  } catch (error: any) {
    console.error('Admin Wallet POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const admin = await checkAdmin(supabase);
    if (!admin) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await req.json();
    const { customerIds, targetStatus, statusReason } = body;

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: 'customerIds wajib dilampirkan dalam format array' }, { status: 400 });
    }

    if (!targetStatus) {
      return NextResponse.json({ error: 'targetStatus wajib disertakan' }, { status: 400 });
    }

    let updatePayload: any = {};
    let afterStatusValue = targetStatus;

    if (targetStatus === 'diblokir') {
      if (!statusReason) {
        return NextResponse.json({ error: 'Alasan tindakan massal wajib diisi' }, { status: 400 });
      }
      updatePayload = {
        is_wallet_blocked: true,
        wallet_block_reason: statusReason
      };
    } else if (targetStatus === 'aktif') {
      updatePayload = {
        is_wallet_blocked: false,
        wallet_block_reason: null,
        wallet_status: 'aktif',
        wrong_pin_count: 0
      };
    } else if (targetStatus === 'nonaktif') {
      updatePayload = {
        is_wallet_blocked: false,
        wallet_block_reason: null,
        wallet_status: 'nonaktif'
      };
    } else {
      return NextResponse.json({ error: 'Target status bulk tidak valid' }, { status: 400 });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update(updatePayload)
      .in('id', customerIds);

    if (updateErr) throw updateErr;

    // Fetch details of updated profiles for logging and emails
    const { data: updatedProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, wallet_status')
      .in('id', customerIds);

    // Save Audit Logs & Notifications & Send Emails
    for (const customerId of customerIds) {
      const profile = updatedProfiles?.find((p: any) => p.id === customerId);

      await supabaseAdmin.from('wallet_audit_logs').insert({
        customer_id: customerId,
        action_type: 'status_change',
        before_value: 'bulk_action_before',
        after_value: afterStatusValue,
        reason: statusReason || `Ubah status massal menjadi ${afterStatusValue}`,
        acted_by: admin.id,
      });

      // Notification
      let notifTitle = 'Status Dompetku Diperbarui';
      let notifMsg = `Status Dompetku Anda telah diperbarui secara massal menjadi ${afterStatusValue}.`;

      if (targetStatus === 'aktif') {
        notifTitle = 'Aktivasi Dompetku Berhasil';
        notifMsg = 'Dompetku Anda telah diaktifkan secara massal dan kini dapat digunakan.';
      } else if (targetStatus === 'nonaktif') {
        notifTitle = 'Dompetku Dinonaktifkan';
        notifMsg = 'Dompetku Anda saat ini dinonaktifkan sementara secara massal.';
      } else if (targetStatus === 'diblokir') {
        notifTitle = 'Akses Dompetku Diblokir';
        notifMsg = `Dompetku Anda diblokir secara massal oleh admin. Alasan: ${statusReason}`;
      }

      await supabaseAdmin.from('notifications').insert({
        user_id: customerId,
        title: notifTitle,
        message: notifMsg,
        type: 'wallet_status_change'
      });

      // Send Email
      if (profile && profile.email) {
        let emailStatusKey = targetStatus;
        if (emailStatusKey === 'aktif') emailStatusKey = 'selesai';

        await sendWalletActivationEmail(
          profile.email,
          profile.full_name,
          emailStatusKey as any,
          statusReason || undefined
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil memperbarui status secara massal untuk ${customerIds.length} pelanggan menjadi ${afterStatusValue}`
    });

  } catch (error: any) {
    console.error('Admin Wallet PUT Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
