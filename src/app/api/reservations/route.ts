export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

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
        userAgent = 'Unknown'
      } = body;

      if (!customerId || !tableIds || tableIds.length === 0 || !reservationDate || !reservationTime || !guestCount || !paymentMethod) {
        return NextResponse.json({ error: 'Data reservasi tidak lengkap' }, { status: 400 });
      }

      // Fetch settings
      const { data: settings, error: settingsErr } = await supabaseAdmin
        .from('restaurant_settings')
        .select('minimal_dp, charge_cancel')
        .single();
      
      if (settingsErr) {
        return NextResponse.json({ error: 'Gagal mengambil pengaturan restoran' }, { status: 500 });
      }

      const minimalDp = Number(settings?.minimal_dp || 30);
      const chargeCancel = Number(settings?.charge_cancel || 20);

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
          cancellation_charge_percent: chargeCancel
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

      return NextResponse.json({ success: true, reservation: newRes });
    }

    if (action === 'cancel') {
      const {
        reservationId,
        reason,
        refundMethod,
        refundBankAccount,
        refundReason,
        refundProof
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

        // Update reservation
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
            refund_proof: refundProof || null
          })
          .eq('id', res.id);

        // Release tables
        await supabaseAdmin
          .from('tables')
          .update({ status: 'available' })
          .in('id', tableIdsToRelease);

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
            refund_proof: refundProof || null
          })
          .eq('id', res.id);

        // Release tables
        await supabaseAdmin
          .from('tables')
          .update({ status: 'available' })
          .in('id', tableIdsToRelease);

        return NextResponse.json({
          success: true,
          message: totalPaid > 0
            ? `Reservasi dibatalkan. Pengajuan refund sebesar Rp ${refundAmount.toLocaleString('id-ID')} (setelah dipotong denda Rp ${chargeAmount.toLocaleString('id-ID')}) sedang menunggu review admin.`
            : 'Reservasi berhasil dibatalkan.',
          refundStatus: totalPaid > 0 ? 'waiting_review' : null
        });
      }
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
          refund_status: refundStatus,
          refund_proof: proofUrl || res.refund_proof || null,
          notes: updatedNotes
        })
        .eq('id', res.id);

      if (updateErr) throw updateErr;

      return NextResponse.json({ success: true, message: 'Status refund reservasi berhasil diperbarui' });
    }

    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('Reservations API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
