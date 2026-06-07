export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'create') {
      const {
        customerId,
        tableIds,
        reservationDate,
        reservationTime,
        guestCount,
        notes,
        paymentMethod,
        dpPercent,
        dpAmount,
        remainingAmount,
        menuItems,
        menuTotal,
        pin,
        dpSource,
        clientIP = '127.0.0.1',
        browser = 'Unknown',
        device = 'Unknown',
        userAgent = 'Unknown',
        rules_approved_at,
        data_checked_at,
        data_checked
      } = body;

      if (!customerId || !tableIds || tableIds.length === 0 || !reservationDate || !reservationTime || !guestCount || !paymentMethod) {
        return NextResponse.json({ error: 'Data reservasi tidak lengkap' }, { status: 400 });
      }

      // Fetch settings
      const { data: settings, error: settingsErr } = await supabaseAdmin
        .from('restaurant_settings')
        .select('minimal_dp, charge_cancel, late_tolerance_minutes, reservation_settings')
        .single();
      
      if (settingsErr) {
        return NextResponse.json({ error: 'Gagal mengambil pengaturan restoran' }, { status: 500 });
      }

      const minimalDp = Number(settings?.minimal_dp || 30);
      const chargeCancel = Number(settings?.charge_cancel || 20);

      let lateTolerance = 15; // default
      if (settings) {
        if (settings.late_tolerance_minutes !== null && settings.late_tolerance_minutes !== undefined) {
          lateTolerance = Number(settings.late_tolerance_minutes);
        } else if (settings.reservation_settings) {
          const resSet = typeof settings.reservation_settings === 'string'
            ? JSON.parse(settings.reservation_settings)
            : settings.reservation_settings;
          if (resSet?.late_tolerance_minutes !== undefined) {
            lateTolerance = Number(resSet.late_tolerance_minutes);
          }
        }
      }

      const bookingDateTime = new Date(`${reservationDate}T${reservationTime}${reservationTime.length === 5 ? ':00' : ''}+07:00`);
      const deadlineTime = new Date(bookingDateTime.getTime() + lateTolerance * 60000);
      const checkInDeadline = deadlineTime.toISOString();

      // Validate DP
      if (paymentMethod === 'dp' && Number(dpPercent) < minimalDp) {
        return NextResponse.json({ error: `Minimal DP yang berlaku saat ini adalah ${minimalDp}% dari total harga.` }, { status: 400 });
      }

      // Get profile
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', customerId)
        .single();

      if (profileErr || !profile) {
        return NextResponse.json({ error: 'Profil pelanggan tidak ditemukan' }, { status: 404 });
      }

      let dbPaymentStatus = 'unpaid';
      const parsedMenuTotal = Number(menuTotal || 0);
      const parsedDpAmount = Number(dpAmount || 0);
      const parsedRemainingAmount = Number(remainingAmount || 0);

      // E-Wallet verification if paid via DompetKu
      const isFullWallet = paymentMethod === 'dompetku';
      const isDpWallet = paymentMethod === 'dp' && dpSource === 'dompetku';

      if (isFullWallet || isDpWallet) {
        const payAmount = isFullWallet ? parsedMenuTotal : parsedDpAmount;

        if (payAmount > 0) {
          // Check active status
          const wStatus = profile.wallet_status || 'belum_aktif';
          if (!['diterima', 'selesai', 'aktif'].includes(wStatus)) {
            return NextResponse.json({ error: 'DompetKu belum aktif. Silakan lakukan aktivasi terlebih dahulu.', code: 'WALLET_INACTIVE' }, { status: 400 });
          }

          if (profile.is_wallet_blocked) {
            return NextResponse.json({ error: profile.wallet_block_reason || 'DompetKu Anda diblokir.', code: 'WALLET_BLOCKED' }, { status: 400 });
          }

          if (!profile.wallet_pin) {
            return NextResponse.json({ error: 'Anda belum membuat PIN DompetKu. Buat PIN terlebih dahulu.', code: 'NO_PIN' }, { status: 400 });
          }

          if (!pin) {
            return NextResponse.json({ error: 'Masukkan PIN DompetKu untuk melanjutkan pembayaran', code: 'PIN_REQUIRED' }, { status: 400 });
          }

          // Hash PIN and verify
          const encoder = new TextEncoder();
          const pinBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(String(pin)));
          const hashedPin = Array.from(new Uint8Array(pinBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

          if (hashedPin !== profile.wallet_pin) {
            const newCount = (profile.wrong_pin_count || 0) + 1;
            if (newCount >= 3) {
              await supabaseAdmin.from('profiles').update({
                wrong_pin_count: newCount,
                is_wallet_blocked: true,
                wallet_block_reason: 'DompetKu Anda diblokir otomatis karena PIN salah 3 kali berturut-turut.'
              }).eq('id', profile.id);

              await supabaseAdmin.from('notifications').insert({
                user_id: profile.id,
                title: 'DompetKu Diblokir',
                message: 'PIN DompetKu Anda salah 3 kali. Akun DompetKu diblokir demi keamanan.',
                type: 'wallet_blocked'
              });

              return NextResponse.json({ error: 'PIN salah 3 kali. DompetKu diblokir.', code: 'WALLET_BLOCKED_NOW' }, { status: 400 });
            }

            await supabaseAdmin.from('profiles').update({ wrong_pin_count: newCount }).eq('id', profile.id);
            return NextResponse.json({ error: `PIN salah. Sisa percobaan: ${3 - newCount} kali lagi.`, code: 'WRONG_PIN', remaining: 3 - newCount }, { status: 400 });
          }

          // PIN Correct, Reset count
          await supabaseAdmin.from('profiles').update({ wrong_pin_count: 0 }).eq('id', profile.id);

          // Check balance
          const balance = Number(profile.wallet_balance || 0);
          if (balance < payAmount) {
            return NextResponse.json({ error: `Saldo DompetKu tidak mencukupi (Saldo: Rp ${balance.toLocaleString('id-ID')})` }, { status: 400 });
          }

          // Deduct balance
          const { error: deductErr } = await supabaseAdmin
            .from('profiles')
            .update({ wallet_balance: balance - payAmount })
            .eq('id', profile.id);

          if (deductErr) throw deductErr;

          // Create transaction log
          await supabaseAdmin.from('wallet_transactions').insert({
            customer_id: profile.id,
            amount: payAmount,
            type: 'payment',
            status: 'success',
            description: `Pembayaran ${isFullWallet ? 'penuh' : 'DP'} reservasi meja`
          });

          dbPaymentStatus = isFullWallet ? 'paid' : 'dp_paid';
        } else {
          // Total amount is 0, so no payment needed
          dbPaymentStatus = 'paid';
        }
      }

      // Save reservation
      const { data: newRes, error: resErr } = await supabaseAdmin
        .from('reservations')
        .insert({
          customer_id: customerId,
          table_id: tableIds[0],
          reservation_date: reservationDate,
          reservation_time: reservationTime,
          guest_count: guestCount,
          notes: notes,
          status: 'pending',
          menu_items: menuItems || [],
          menu_total: parsedMenuTotal,
          payment_method: paymentMethod,
          payment_status: dbPaymentStatus,
          dp_percent: Number(dpPercent || 0),
          dp_amount: parsedDpAmount,
          remaining_amount: parsedRemainingAmount,
          cancellation_charge_percent: chargeCancel,
          rules_approved: true,
          rules_approved_at: rules_approved_at || new Date().toISOString(),
          data_checked: data_checked || false,
          data_checked_at: data_checked_at || null,
          tolerance_minutes: lateTolerance,
          check_in_deadline: checkInDeadline
        })
        .select()
        .single();

      if (resErr) {
        // Rollback wallet balance if deducted
        if (isFullWallet || isDpWallet) {
          const payAmount = isFullWallet ? parsedMenuTotal : parsedDpAmount;
          const currentBal = Number(profile.wallet_balance || 0);
          await supabaseAdmin.from('profiles').update({ wallet_balance: currentBal + payAmount }).eq('id', profile.id);
        }
        throw resErr;
      }

      // Set table status to reserved
      await supabaseAdmin
        .from('tables')
        .update({ status: 'reserved' })
        .in('id', tableIds);

      // Log activity
      await supabaseAdmin.from('security_logs').insert({
        user_id: profile.id,
        ip_address: clientIP,
        browser,
        device,
        user_agent: userAgent,
        activity: 'CUSTOMER_CREATE_RESERVATION',
        endpoint: '/api/reservations',
        status: 'success'
      });

      // Catat Audit Log
      await supabaseAdmin.from('audit_logs').insert({
        action: 'reservation_created',
        operator_id: profile.id,
        operator_name: profile.full_name || 'Pelanggan',
        target_id: newRes.id,
        target_name: 'reservations',
        data_before: null,
        data_after: {
          id: newRes.id,
          customer_id: customerId,
          status: 'pending',
          payment_status: dbPaymentStatus,
          table_id: tableIds[0],
          reservation_date: reservationDate
        },
        browser,
        device
      });

      return NextResponse.json({ success: true, reservation: newRes });
    }

    if (action === 'cancel') {
      const {
        reservationId,
        reason,
        refundMethod,
        refundBankAccount,
        refundReason,
        refundProof,
        cancelledRole,
        cancelledBy,
        operatorId
      } = body;

      if (!reservationId || !reason) {
        return NextResponse.json({ error: 'ID reservasi dan alasan pembatalan diperlukan' }, { status: 400 });
      }

      // Fetch reservation
      const { data: res, error: resErr } = await supabaseAdmin
        .from('reservations')
        .select('*, profiles:customer_id(*)')
        .eq('id', reservationId)
        .single();

      if (resErr || !res) {
        return NextResponse.json({ error: 'Reservasi tidak ditemukan' }, { status: 404 });
      }

      if (res.status === 'cancelled') {
        return NextResponse.json({ error: 'Reservasi ini sudah dibatalkan' }, { status: 400 });
      }

      // Get tables to release
      let tableIdsToRelease = [res.table_id];
      try {
        const parsedNotes = JSON.parse(res.notes);
        if (parsedNotes && Array.isArray(parsedNotes.meja_ids)) {
          tableIdsToRelease = parsedNotes.meja_ids;
        }
      } catch (e) {}

      // If cancelled by Cashier or Admin
      if (cancelledRole === 'cashier' || cancelledRole === 'admin') {
        let updatedNotes = res.notes;
        try {
          const parsed = JSON.parse(res.notes);
          updatedNotes = JSON.stringify({
            ...parsed,
            catatan_batal: reason,
            dibatalkan_oleh: cancelledRole === 'cashier' ? 'kasir' : 'admin'
          });
        } catch (e) {}

        const { error: cancelErr } = await supabaseAdmin
          .from('reservations')
          .update({
            status: 'cancelled',
            notes: updatedNotes,
            cancelled_by: operatorId || null,
            cancelled_role: cancelledRole,
            cancellation_reason: reason,
            cancellation_time: new Date().toISOString(),
            refund_status: null // Customer will apply for refund manually
          })
          .eq('id', res.id);

        if (cancelErr) throw cancelErr;

        // Release tables
        if (tableIdsToRelease.length > 0) {
          await supabaseAdmin
            .from('tables')
            .update({ status: 'available' })
            .in('id', tableIdsToRelease);
        }

        // Add Notification
        if (res.customer_id) {
          await supabaseAdmin.from('notifications').insert({
            user_id: res.customer_id,
            title: "Reservasi Dibatalkan",
            message: `Reservasi Anda pada tanggal ${format(new Date(res.reservation_date), "dd MMM yyyy", { locale: localeId })} telah dibatalkan oleh ${cancelledRole === 'cashier' ? 'kasir' : 'pihak resto'} dengan alasan: ${reason}.`,
            type: "reservation",
            status_badge: "dibatalkan"
          });
        }

        // Catat Audit Log
        await supabaseAdmin.from('audit_logs').insert({
          action: 'reservation_cancelled',
          operator_id: operatorId || null,
          operator_name: cancelledBy || (cancelledRole === 'cashier' ? 'Kasir' : 'Admin'),
          target_id: res.id,
          target_name: 'reservations',
          data_before: { status: res.status },
          data_after: {
            status: 'cancelled',
            cancelled_by: cancelledBy || (cancelledRole === 'cashier' ? 'Kasir' : 'Admin'),
            cancelled_role: cancelledRole,
            cancellation_reason: reason
          }
        });

        return NextResponse.json({
          success: true,
          message: `Reservasi berhasil dibatalkan oleh ${cancelledRole === 'cashier' ? 'kasir' : 'resto'}.`
        });
      }

      // Calculate paid amount
      let totalPaid = 0;
      if (res.payment_status === 'paid') {
        totalPaid = Number(res.menu_total || 0);
      } else if (res.payment_status === 'dp_paid') {
        totalPaid = Number(res.dp_amount || 0);
      }

      const isUnconfirmed = res.status === 'pending';

      if (isUnconfirmed) {
        // Unconfirmed = Auto full refund if paid
        let dbRefundStatus = null;
        if (totalPaid > 0) {
          if (refundMethod === 'dompetku') {
            const customerProfile = res.profiles;
            if (customerProfile) {
              const currentBal = Number(customerProfile.wallet_balance || 0);
              // Refund to wallet
              await supabaseAdmin
                .from('profiles')
                .update({ wallet_balance: currentBal + totalPaid })
                .eq('id', customerProfile.id);

              // Log transaction
              await supabaseAdmin.from('wallet_transactions').insert({
                customer_id: customerProfile.id,
                amount: totalPaid,
                type: 'refund',
                status: 'success',
                description: `Refund otomatis pembatalan reservasi #${res.id.substring(0, 8).toUpperCase()}`
              });

              dbRefundStatus = 'completed';
            }
          } else {
            // bank transfer requires manual review
            dbRefundStatus = 'waiting_review';
          }
        }

        // Parse existing notes to append cancellation details
        let updatedNotes = res.notes;
        try {
          const parsed = JSON.parse(res.notes);
          updatedNotes = JSON.stringify({
            ...parsed,
            catatan_batal: reason,
            dibatalkan_oleh: 'pelanggan'
          });
        } catch (e) {}

        await supabaseAdmin
          .from('reservations')
          .update({
            status: 'cancelled',
            notes: updatedNotes,
            refund_status: dbRefundStatus,
            refund_method: refundMethod || null,
            refund_amount: totalPaid,
            refund_bank_account: refundBankAccount || null,
            refund_reason: refundReason || null,
            refund_proof: refundProof || null,
            cancelled_by: res.customer_id,
            cancelled_role: 'customer',
            cancellation_reason: reason,
            cancellation_time: new Date().toISOString()
          })
          .eq('id', res.id);

        // Release tables
        await supabaseAdmin
          .from('tables')
          .update({ status: 'available' })
          .in('id', tableIdsToRelease);

        // Catat Audit Log
        await supabaseAdmin.from('audit_logs').insert({
          action: 'reservation_cancelled',
          operator_id: res.customer_id,
          operator_name: 'Pelanggan',
          target_id: res.id,
          target_name: 'reservations',
          data_before: {
            status: res.status,
            payment_status: res.payment_status,
            refund_status: res.refund_status
          },
          data_after: {
            status: 'cancelled',
            cancelled_by: 'Pelanggan',
            cancelled_role: 'customer',
            cancellation_reason: reason,
            refund_status: dbRefundStatus,
            refund_method: refundMethod,
            refund_bank_account: refundBankAccount,
            refund_reason: refundReason,
            refund_proof: refundProof,
            refund_amount: totalPaid
          }
        });

        return NextResponse.json({
          success: true,
          message: 'Reservasi belum dikonfirmasi berhasil dibatalkan otomatis dengan full refund.',
          refundStatus: dbRefundStatus
        });
      } else {
        // Confirmed reservation = check charge policy
        // Check if within 30 minutes of booking
        const bookingDateTimeStr = `${res.reservation_date}T${res.reservation_time}`;
        const bookingTime = new Date(bookingDateTimeStr).getTime();
        const curTime = Date.now();
        const minutesDiff = (bookingTime - curTime) / (60 * 1000);

        let chargePercent = 0;
        let chargeAmount = 0;
        let refundAmount = totalPaid;

        // If prepared (less than 30 minutes before booking starts or already after it started)
        if (minutesDiff <= 30) {
          chargePercent = Number(res.cancellation_charge_percent || 20);
          chargeAmount = Number(res.menu_total || 0) * chargePercent / 100;
          refundAmount = Math.max(0, totalPaid - chargeAmount);
        }

        // Parse existing notes to append cancellation details
        let updatedNotes = res.notes;
        try {
          const parsed = JSON.parse(res.notes);
          updatedNotes = JSON.stringify({
            ...parsed,
            catatan_batal: reason,
            dibatalkan_oleh: 'pelanggan',
            charge_applied: chargeAmount,
            charge_percent: chargePercent
          });
        } catch (e) {}

        // Confirmed cancellations always go to manual review
        await supabaseAdmin
          .from('reservations')
          .update({
            status: 'cancelled',
            notes: updatedNotes,
            refund_status: totalPaid > 0 ? 'waiting_review' : null,
            refund_method: refundMethod || null,
            refund_amount: refundAmount,
            refund_bank_account: refundBankAccount || null,
            refund_reason: refundReason || null,
            refund_proof: refundProof || null,
            cancelled_by: res.customer_id,
            cancelled_role: 'customer',
            cancellation_reason: reason,
            cancellation_time: new Date().toISOString()
          })
          .eq('id', res.id);

        // Release tables
        await supabaseAdmin
          .from('tables')
          .update({ status: 'available' })
          .in('id', tableIdsToRelease);

        // Catat Audit Log
        await supabaseAdmin.from('audit_logs').insert({
          action: 'reservation_cancelled',
          operator_id: res.customer_id,
          operator_name: 'Pelanggan',
          target_id: res.id,
          target_name: 'reservations',
          data_before: {
            status: res.status,
            payment_status: res.payment_status,
            refund_status: res.refund_status
          },
          data_after: {
            status: 'cancelled',
            cancelled_by: 'Pelanggan',
            cancelled_role: 'customer',
            cancellation_reason: reason,
            refund_status: totalPaid > 0 ? 'waiting_review' : null,
            refund_method: refundMethod,
            refund_bank_account: refundBankAccount,
            refund_reason: refundReason,
            refund_proof: refundProof,
            refund_amount: refundAmount,
            charge_amount: chargeAmount,
            charge_percent: chargePercent
          }
        });

        return NextResponse.json({
          success: true,
          message: totalPaid > 0
            ? `Reservasi dibatalkan. Pengajuan refund sebesar Rp ${refundAmount.toLocaleString('id-ID')} (setelah dipotong denda Rp ${chargeAmount.toLocaleString('id-ID')}) sedang menunggu review admin.`
            : 'Reservasi berhasil dibatalkan.',
          refundStatus: totalPaid > 0 ? 'waiting_review' : null
        });
      }
    }

    if (action === 'request_refund') {
      const {
        reservationId,
        refundMethod,
        refundBankAccount,
        refundReason,
        refundAmount
      } = body;

      if (!reservationId || !refundMethod || !refundReason) {
        return NextResponse.json({ error: 'Data pengajuan refund tidak lengkap' }, { status: 400 });
      }

      // Fetch reservation
      const { data: res, error: resErr } = await supabaseAdmin
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (resErr || !res) {
        return NextResponse.json({ error: 'Reservasi tidak ditemukan' }, { status: 404 });
      }

      if (res.refund_status) {
        return NextResponse.json({ error: 'Refund untuk reservasi ini sudah diajukan' }, { status: 400 });
      }

      const calculatedAmount = Number(refundAmount || res.dp_amount || res.menu_total || 0);

      // Update refund details
      const { data: updatedRes, error: updateErr } = await supabaseAdmin
        .from('reservations')
        .update({
          refund_status: 'pengajuan_refund', // Status: "Pengajuan Refund" / "Menunggu Peninjauan"
          refund_method: refundMethod,
          refund_amount: calculatedAmount,
          refund_bank_account: refundBankAccount || null,
          refund_reason: refundReason
        })
        .eq('id', reservationId)
        .select()
        .single();

      if (updateErr) throw updateErr;

      // Add Notification
      if (res.customer_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: res.customer_id,
          title: "Pengajuan Refund Terkirim",
          message: `Pengajuan refund Anda sebesar Rp ${calculatedAmount.toLocaleString('id-ID')} untuk reservasi #${res.id.substring(0, 8).toUpperCase()} telah terkirim dan sedang menunggu peninjauan.`,
          type: "refund"
        });
      }

      // Write Audit Log
      await supabaseAdmin.from('audit_logs').insert({
        action: 'refund_requested',
        operator_id: res.customer_id,
        operator_name: 'Pelanggan',
        target_id: res.id,
        target_name: 'reservations',
        data_before: { refund_status: null },
        data_after: {
          refund_status: 'pengajuan_refund',
          refund_method: refundMethod,
          refund_amount: calculatedAmount
        }
      });

      return NextResponse.json({ success: true, reservation: updatedRes });
    }

    if (action === 'process_refund') {
      const { reservationId, refundStatus, proofUrl, adminNotes } = body;
      
      if (!reservationId || !refundStatus) {
        return NextResponse.json({ error: 'ID reservasi dan status refund diperlukan' }, { status: 400 });
      }

      // Fetch reservation
      const { data: res, error: resErr } = await supabaseAdmin
        .from('reservations')
        .select('*, profiles:customer_id(*)')
        .eq('id', reservationId)
        .single();

      if (resErr || !res) {
        return NextResponse.json({ error: 'Reservasi tidak ditemukan' }, { status: 404 });
      }

      let finalRefundStatus = refundStatus;
      if (refundStatus === 'completed') {
        finalRefundStatus = res.refund_method === 'dompetku' ? 'refund_selesai' : 'dana_dikirim';
      } else if (refundStatus === 'rejected') {
        finalRefundStatus = 'rejected';
      }

      // If completed and method is dompetku, credit balance
      if (refundStatus === 'completed' && res.refund_method === 'dompetku') {
        const customerProfile = res.profiles;
        if (customerProfile) {
          const currentBal = Number(customerProfile.wallet_balance || 0);
          const refundAmt = Number(res.refund_amount || 0);

          // Refund to wallet
          const { error: wErr } = await supabaseAdmin
            .from('profiles')
            .update({ wallet_balance: currentBal + refundAmt })
            .eq('id', customerProfile.id);

          if (wErr) throw wErr;

          // Log transaction
          await supabaseAdmin.from('wallet_transactions').insert({
            customer_id: customerProfile.id,
            amount: refundAmt,
            type: 'refund',
            status: 'success',
            description: `Refund manual pembatalan reservasi #${res.id.substring(0, 8).toUpperCase()}`
          });
        }
      }

      // Parse and update notes with adminNotes
      let updatedNotes = res.notes;
      try {
        const parsed = JSON.parse(res.notes);
        updatedNotes = JSON.stringify({
          ...parsed,
          admin_notes: adminNotes || null,
          refund_processed_at: new Date().toISOString()
        });
      } catch (e) {}

      const { error: updateErr } = await supabaseAdmin
        .from('reservations')
        .update({
          refund_status: finalRefundStatus,
          refund_proof: proofUrl || res.refund_proof || null,
          notes: updatedNotes
        })
        .eq('id', res.id);

      if (updateErr) throw updateErr;

      // Add Notification to Customer
      if (res.customer_id) {
        let notifMsg = "";
        if (finalRefundStatus === 'refund_selesai') {
          notifMsg = "Refund Anda telah disetujui. Dana telah dikreditkan ke akun DompetKu Anda. Silakan periksa saldo DompetKu Anda.";
        } else if (finalRefundStatus === 'dana_dikirim') {
          notifMsg = "Refund Anda telah disetujui. Dana telah ditransfer ke rekening yang Anda daftarkan. Silakan periksa rekening Anda.";
        } else if (finalRefundStatus === 'rejected') {
          notifMsg = `Pengajuan refund Anda ditolak oleh pihak resto. Alasan: ${adminNotes || '-'}`;
        }
        
        if (notifMsg) {
          await supabaseAdmin.from('notifications').insert({
            user_id: res.customer_id,
            title: finalRefundStatus === 'rejected' ? "Refund Ditolak" : "Refund Disetujui",
            message: notifMsg,
            type: "refund"
          });
        }
      }

      // Write Audit Log
      await supabaseAdmin.from('audit_logs').insert({
        action: finalRefundStatus === 'refund_selesai' ? 'refund_completed' : finalRefundStatus === 'rejected' ? 'refund_rejected' : 'refund_processed',
        operator_id: null,
        operator_name: 'Admin Restoran',
        target_id: res.id,
        target_name: 'reservations',
        data_before: { refund_status: res.refund_status },
        data_after: {
          refund_status: finalRefundStatus,
          proof_url: proofUrl,
          admin_notes: adminNotes
        }
      });

      return NextResponse.json({ success: true, message: 'Status refund reservasi berhasil diperbarui' });
    }

    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('Reservations API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
