export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, action, paymentStatus, status, reason, orderData, itemsData } = body;

    if (action === 'create_walkin') {
      const { data: newOrder, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert(orderData)
        .select()
        .single();
        
      if (orderError) throw orderError;
      
      const itemsToInsert = itemsData.map((item: any) => ({
        ...item,
        order_id: newOrder.id
      }));
      
      const { error: itemsError } = await supabaseAdmin
        .from('order_items')
        .insert(itemsToInsert);
        
      if (itemsError) throw itemsError;
      
      return NextResponse.json({ success: true, order: newOrder });
    }

    if (action === 'create_wallet_order') {
      const { orderData, itemsData } = body;
      if (!orderData || !itemsData) {
        return NextResponse.json({ error: 'Order data and items data are required' }, { status: 400 });
      }

      // Get customer profile
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('id, wallet_balance, is_wallet_blocked, wallet_block_reason, wallet_pin, wrong_pin_count')
        .eq('id', orderData.customer_id)
        .single();

      if (profileErr || !profile) {
        return NextResponse.json({ error: 'Profil pelanggan tidak ditemukan' }, { status: 404 });
      }

      if (profile.is_wallet_blocked) {
        const reason = profile.wallet_block_reason || 'Dompetku Anda diblokir. Hubungi admin atau ajukan banding di halaman Dompetku.';
        return NextResponse.json({ error: reason, code: 'WALLET_BLOCKED' }, { status: 400 });
      }

      // Verifikasi PIN jika sudah diset
      const { pin } = body;
      if (!profile.wallet_pin) {
        return NextResponse.json({ error: 'Anda belum membuat PIN Dompetku. Silakan buat PIN terlebih dahulu di halaman Dompetku.', code: 'NO_PIN' }, { status: 400 });
      }
      if (!pin) {
        return NextResponse.json({ error: 'Masukkan PIN Dompetku untuk melanjutkan pembayaran', code: 'PIN_REQUIRED' }, { status: 400 });
      }

      // Hash PIN dan cocokkan
      const encoder = new TextEncoder();
      const pinBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(String(pin)));
      const hashedPin = Array.from(new Uint8Array(pinBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (hashedPin !== profile.wallet_pin) {
        const newCount = (profile.wrong_pin_count || 0) + 1;
        if (newCount >= 3) {
          // Blokir dompet
          await supabaseAdmin.from('profiles').update({
            wrong_pin_count: newCount,
            is_wallet_blocked: true,
            wallet_block_reason: 'Dompetku Anda diblokir secara otomatis karena PIN salah dimasukkan 3 kali berturut-turut. Ajukan banding di halaman Dompetku untuk membuka blokir.'
          }).eq('id', profile.id);
          await supabaseAdmin.from('notifications').insert({
            user_id: profile.id,
            title: 'Dompetku Diblokir Otomatis',
            message: 'PIN Dompetku Anda salah 3 kali berturut-turut. Dompetku Anda telah diblokir untuk keamanan. Ajukan banding di halaman Dompetku.',
            type: 'wallet_blocked',
          });
          return NextResponse.json({ error: 'PIN salah 3 kali berturut-turut. Dompetku Anda telah diblokir otomatis. Buka halaman Dompetku untuk mengajukan banding.', code: 'WALLET_BLOCKED_NOW' }, { status: 400 });
        }
        await supabaseAdmin.from('profiles').update({ wrong_pin_count: newCount }).eq('id', profile.id);
        return NextResponse.json({ error: `PIN salah. Sisa percobaan: ${3 - newCount} kali lagi.`, code: 'WRONG_PIN', remaining: 3 - newCount }, { status: 400 });
      }

      // PIN benar — reset hitungan
      await supabaseAdmin.from('profiles').update({ wrong_pin_count: 0 }).eq('id', profile.id);

      const balance = Number(profile.wallet_balance || 0);
      const total = Number(orderData.total_amount);

      if (balance < total) {
        return NextResponse.json({ error: 'Saldo dompet tidak mencukupi untuk melakukan pembayaran' }, { status: 400 });
      }

      // Deduct balance
      const { error: deductErr } = await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: balance - total })
        .eq('id', profile.id);

      if (deductErr) throw deductErr;

      // Create order
      const { data: newOrder, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert({
          ...orderData,
          payment_method: 'wallet',
          payment_status: 'paid',
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) {
        // Rollback balance
        await supabaseAdmin.from('profiles').update({ wallet_balance: balance }).eq('id', profile.id);
        throw orderError;
      }

      // Insert items
      const itemsToInsert = itemsData.map((item: any) => ({
        ...item,
        order_id: newOrder.id
      }));

      const { error: itemsError } = await supabaseAdmin
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) {
        // Rollback order and balance
        await supabaseAdmin.from('orders').delete().eq('id', newOrder.id);
        await supabaseAdmin.from('profiles').update({ wallet_balance: balance }).eq('id', profile.id);
        throw itemsError;
      }

      // Log wallet transaction
      await supabaseAdmin.from('wallet_transactions').insert({
        customer_id: profile.id,
        amount: total,
        type: 'payment',
        status: 'success',
        description: `Pembayaran pesanan #${newOrder.id.substring(0, 8).toUpperCase()}`
      });

      // Update table if dine_in
      if (newOrder.table_id) {
        await supabaseAdmin.from("tables").update({ status: "occupied", occupied_at: new Date().toISOString() }).eq("id", newOrder.table_id);
      }

      // Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: newOrder.customer_id,
        title: 'Pembayaran Saldo Dompet Berhasil',
        message: `Pembayaran sebesar Rp ${total.toLocaleString("id-ID")} untuk No. Pesanan #${newOrder.id.split('-')[0]} telah didebet dari Saldo Dompet Anda.`,
        type: 'order',
        status_badge: 'Berhasil'
      });

      return NextResponse.json({ success: true, order: newOrder });
    }

    if (action === 'pay_order_via_wallet') {
      if (!orderId) {
        return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
      }

      // Fetch order
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (orderErr || !order) {
        return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
      }

      if (order.payment_status === 'paid') {
        return NextResponse.json({ error: 'Pesanan ini sudah lunas' }, { status: 400 });
      }

      if (order.status === 'cancelled') {
        return NextResponse.json({ error: 'Pesanan ini sudah dibatalkan' }, { status: 400 });
      }

      // Fetch profile
      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('id, wallet_balance, is_wallet_blocked, wallet_block_reason, wallet_pin, wrong_pin_count')
        .eq('id', order.customer_id)
        .single();

      if (profileErr || !profile) {
        return NextResponse.json({ error: 'Profil pelanggan tidak ditemukan' }, { status: 404 });
      }

      if (profile.is_wallet_blocked) {
        const reason = profile.wallet_block_reason || 'Dompetku Anda diblokir. Hubungi admin atau ajukan banding di halaman Dompetku.';
        return NextResponse.json({ error: reason, code: 'WALLET_BLOCKED' }, { status: 400 });
      }

      // Verifikasi PIN jika sudah diset
      const { pin: payPin } = body;
      if (!profile.wallet_pin) {
        return NextResponse.json({ error: 'Anda belum membuat PIN Dompetku. Silakan buat PIN terlebih dahulu di halaman Dompetku.', code: 'NO_PIN' }, { status: 400 });
      }
      if (!payPin) {
        return NextResponse.json({ error: 'Masukkan PIN Dompetku untuk melanjutkan pembayaran', code: 'PIN_REQUIRED' }, { status: 400 });
      }

      // Hash PIN dan cocokkan
      const payEncoder = new TextEncoder();
      const payPinBuffer = await crypto.subtle.digest('SHA-256', payEncoder.encode(String(payPin)));
      const hashedPayPin = Array.from(new Uint8Array(payPinBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

      if (hashedPayPin !== profile.wallet_pin) {
        const newPayCount = (profile.wrong_pin_count || 0) + 1;
        if (newPayCount >= 3) {
          await supabaseAdmin.from('profiles').update({
            wrong_pin_count: newPayCount,
            is_wallet_blocked: true,
            wallet_block_reason: 'Dompetku Anda diblokir secara otomatis karena PIN salah dimasukkan 3 kali berturut-turut. Ajukan banding di halaman Dompetku untuk membuka blokir.'
          }).eq('id', profile.id);
          await supabaseAdmin.from('notifications').insert({
            user_id: profile.id,
            title: 'Dompetku Diblokir Otomatis',
            message: 'PIN Dompetku Anda salah 3 kali berturut-turut. Dompetku Anda telah diblokir untuk keamanan. Ajukan banding di halaman Dompetku.',
            type: 'wallet_blocked',
          });
          return NextResponse.json({ error: 'PIN salah 3 kali berturut-turut. Dompetku Anda telah diblokir otomatis. Buka halaman Dompetku untuk mengajukan banding.', code: 'WALLET_BLOCKED_NOW' }, { status: 400 });
        }
        await supabaseAdmin.from('profiles').update({ wrong_pin_count: newPayCount }).eq('id', profile.id);
        return NextResponse.json({ error: `PIN salah. Sisa percobaan: ${3 - newPayCount} kali lagi.`, code: 'WRONG_PIN', remaining: 3 - newPayCount }, { status: 400 });
      }

      // PIN benar — reset hitungan
      await supabaseAdmin.from('profiles').update({ wrong_pin_count: 0 }).eq('id', profile.id);

      const balance = Number(profile.wallet_balance || 0);
      const total = Number(order.total_amount);

      if (balance < total) {
        return NextResponse.json({ error: 'Saldo dompet tidak mencukupi untuk melakukan pembayaran' }, { status: 400 });
      }

      // Deduct balance
      const { error: deductErr } = await supabaseAdmin
        .from('profiles')
        .update({ wallet_balance: balance - total })
        .eq('id', profile.id);

      if (deductErr) throw deductErr;

      // Update order
      const { error: updateErr } = await supabaseAdmin
        .from('orders')
        .update({
          payment_method: 'wallet',
          payment_status: 'paid'
        })
        .eq('id', orderId);

      if (updateErr) {
        // Rollback balance
        await supabaseAdmin.from('profiles').update({ wallet_balance: balance }).eq('id', profile.id);
        throw updateErr;
      }

      // Log wallet transaction
      await supabaseAdmin.from('wallet_transactions').insert({
        customer_id: profile.id,
        amount: total,
        type: 'payment',
        status: 'success',
        description: `Pembayaran pesanan #${orderId.substring(0, 8).toUpperCase()}`
      });

      // Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: order.customer_id,
        title: 'Pembayaran Saldo Dompet Berhasil',
        message: `Pembayaran sebesar Rp ${total.toLocaleString("id-ID")} untuk No. Pesanan #${orderId.substring(0, 8).toUpperCase()} telah berhasil didebet dari Saldo Dompet Anda.`,
        type: 'order',
        status_badge: 'Berhasil'
      });

      return NextResponse.json({ success: true, message: 'Pembayaran berhasil menggunakan Saldo Dompet' });
    }



    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    // Get current order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    if (action === 'cancel') {
      // Only allow cancel if status is pending (customer)
      if (order.status !== 'pending') {
        return NextResponse.json({ error: 'Pesanan sudah dikonfirmasi dan tidak dapat dibatalkan' }, { status: 400 });
      }

      const cancelReason = reason || 'Dibatalkan oleh pelanggan';
      const { error } = await supabaseAdmin
        .from('orders')
        .update({ status: 'cancelled', cancel_reason: cancelReason })
        .eq('id', orderId);

      if (error) throw error;

      // Add Notification
      if (order.customer_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: order.customer_id,
          title: 'Pesanan Dibatalkan',
          message: `No. Pesanan #${orderId.split('-')[0].toUpperCase()} telah dibatalkan. Alasan: ${cancelReason}`,
          type: 'order',
          order_id: orderId,
          status_badge: 'dibatalkan'
        });
      }

      if (order.table_id) {
        await supabaseAdmin.from('tables').update({ status: 'available', occupied_at: null }).eq('id', order.table_id);
      }

      return NextResponse.json({ success: true, message: 'Pesanan berhasil dibatalkan' });
    }

    if (action === 'update_status') {
      if (!status) return NextResponse.json({ error: 'Status is required' }, { status: 400 });

      const updateData: any = { status };
      if (status === 'cancelled' && reason) {
        updateData.cancel_reason = reason;
      }

      const { error } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      // Add Notification
      if (order.customer_id) {
        let notifTitle = 'Update Pesanan';
        let notifMsg = `Status No. Pesanan #${orderId.split('-')[0].toUpperCase()} diperbarui ke: ${status}`;
        let statusBadge = status;
        
        if (status === 'confirmed') {
          notifTitle = 'Pesanan Dikonfirmasi';
          notifMsg = `No. Pesanan #${orderId.split('-')[0].toUpperCase()} telah dikonfirmasi oleh kasir.`;
          statusBadge = 'dikonfirmasi';
        } else if (status === 'processing') {
          notifTitle = 'Pesanan Dimasak';
          notifMsg = `Chef sedang menyiapkan hidangan Anda. Mohon tunggu sebentar!`;
          statusBadge = 'proses';
        } else if (status === 'ready') {
          notifTitle = 'Pesanan Siap';
          notifMsg = `Pesanan Anda sudah siap disajikan!`;
          statusBadge = 'siap';
        } else if (status === 'completed') {
          notifTitle = 'Pesanan Selesai';
          notifMsg = `Terima kasih telah berkunjung! Berikan ulasan terbaik Anda.`;
          statusBadge = 'selesai';
        } else if (status === 'cancelled') {
          notifTitle = 'Pesanan Dibatalkan';
          notifMsg = `Pesanan Anda dibatalkan oleh kasir. Alasan: ${reason || 'Tidak disebutkan'}`;
          statusBadge = 'dibatalkan';
        }

        await supabaseAdmin.from('notifications').insert({
          user_id: order.customer_id,
          title: notifTitle,
          message: notifMsg,
          type: 'order',
          order_id: orderId,
          status_badge: statusBadge
        });
      }

      if ((status === 'cancelled' || status === 'completed') && order.table_id) {
        await supabaseAdmin.from('tables').update({ status: 'available', occupied_at: null }).eq('id', order.table_id);
      }

      return NextResponse.json({ success: true, message: `Status pesanan diperbarui ke ${status}` });
    }

    if (action === 'process_pos_payment') {
      const pStatus = paymentStatus || 'paid';
      const oStatus = status || 'completed';
      const pMethod = body.paymentMethod || 'cash';
      
      const updateData: any = { 
        payment_status: pStatus,
        status: oStatus,
        cashier_id: body.cashierId || null,
        total_amount: body.totalAmount,
        notes: body.notes,
        payment_method: pMethod
      };

      if (body.voucherId !== undefined) {
        updateData.voucher_id = body.voucherId;
      }
      if (body.discount !== undefined) {
        updateData.discount = body.discount;
      }

      const { error } = await supabaseAdmin
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;

      if (pStatus === 'paid') {
        await supabaseAdmin.from('notifications').insert({
          user_id: order.customer_id,
          title: 'Pembayaran Berhasil',
          message: `Pembayaran untuk No. Pesanan #${orderId.split('-')[0]} telah dikonfirmasi Lunas via Kasir.`,
          type: 'order'
        });

        if (body.tableId) {
          await supabaseAdmin.from('tables').update({ status: 'occupied', occupied_at: new Date().toISOString() }).eq('id', body.tableId);
        }
      }

      return NextResponse.json({ success: true, message: 'Payment processed' });
    }

    if (action === 'update_payment') {
      const pStatus = paymentStatus || 'paid';
      const cashierId = body.cashierId;

      const { error } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: pStatus,
          cashier_id: cashierId || null 
        })
        .eq('id', orderId);

      if (error) throw error;

      if (pStatus === 'paid') {
        await supabaseAdmin.from('notifications').insert({
          user_id: order.customer_id,
          title: 'Pembayaran Berhasil',
          message: `Pembayaran untuk No. Pesanan #${orderId.split('-')[0]} telah dikonfirmasi Lunas.`,
          type: 'order'
        });
      }

      return NextResponse.json({ success: true, message: 'Status pembayaran diperbarui' });
    }

    if (action === 'submit_refund') {
      const { refundDetails } = body;
      if (!refundDetails) return NextResponse.json({ error: 'Refund details are required' }, { status: 400 });

      const { error } = await supabaseAdmin
        .from('orders')
        .update({ 
          status: 'cancelled',
          cancel_reason: JSON.stringify(refundDetails) 
        })
        .eq('id', orderId);

      if (error) throw error;

      const isWallet = refundDetails.refundMethod === 'wallet';
      const destText = isWallet ? 'Saldo Dompet Anda' : `rekening bank/e-wallet ${refundDetails.bankName}`;

      // Add Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: order.customer_id,
        title: 'Pengajuan Refund Dikirim',
        message: `Permohonan refund untuk pesanan #${orderId.split('-')[0]} sedang diajukan. Dana diajukan untuk dikembalikan ke ${destText}.`,
        type: 'order',
        status_badge: 'Pending'
      });

      return NextResponse.json({ success: true, message: 'Refund request submitted' });
    }

    if (action === 'process_refund') {
      const { refundDetails } = body;
      if (!refundDetails) return NextResponse.json({ error: 'Refund details are required' }, { status: 400 });

      const { error } = await supabaseAdmin
        .from('orders')
        .update({ cancel_reason: JSON.stringify(refundDetails) })
        .eq('id', orderId);

      if (error) throw error;

      const isApproved = refundDetails.refundStatus === 'approved';
      const isWallet = refundDetails.refundMethod === 'wallet';
      const isOnlineOrWalletPayment = order.payment_method === 'duitku' || order.payment_method === 'non_cash' || order.payment_method === 'wallet';

      if (isApproved) {
        // 1. Restore voucher if applicable (decrement usage counts so customer can reuse it)
        if (order.voucher_id) {
          const { data: vData } = await supabaseAdmin
            .from('vouchers')
            .select('code, used_count')
            .eq('id', order.voucher_id)
            .single();
          if (vData) {
            await supabaseAdmin
              .from('vouchers')
              .update({ used_count: Math.max(0, Number(vData.used_count || 0) - 1) })
              .eq('id', order.voucher_id);

            // Cari dan kembalikan reward_redemptions terkait agar muncul di Reward Saya
            const { data: rrData } = await supabaseAdmin
              .from('reward_redemptions')
              .select('id, rewards(title)')
              .eq('customer_id', order.customer_id)
              .eq('code', vData.code)
              .eq('status', 'used')
              .maybeSingle();

            if (rrData) {
              await supabaseAdmin
                .from('reward_redemptions')
                .update({
                  status: 'success',
                  refunded_at: new Date().toISOString(),
                  used_at: null
                })
                .eq('id', rrData.id);

              const rewardTitle = (rrData.rewards as any)?.title || 'Reward';

              // Tambahkan log point_transactions bertipe 'refunded' agar muncul badge "Dikembalikan"
              await supabaseAdmin
                .from('point_transactions')
                .insert({
                  customer_id: order.customer_id,
                  points: 0,
                  status: 'refunded',
                  description: `Voucher dikembalikan: ${rewardTitle} (${vData.code})`
                });
            }
          }

          const { data: cvData } = await supabaseAdmin
            .from('customer_vouchers')
            .select('used_count')
            .eq('customer_id', order.customer_id)
            .eq('voucher_id', order.voucher_id)
            .single();
          if (cvData) {
            await supabaseAdmin
              .from('customer_vouchers')
              .update({ used_count: Math.max(0, Number(cvData.used_count || 0) - 1) })
              .eq('customer_id', order.customer_id)
              .eq('voucher_id', order.voucher_id);
          }
        }

        // 2. Refund cash amount to e-wallet balance if chosen wallet or paid online/wallet
        const refundToWallet = isWallet || isOnlineOrWalletPayment;
        const refundAmount = Number(order.total_amount);

        if (refundToWallet && refundAmount > 0) {
          const { data: profile, error: profErr } = await supabaseAdmin
            .from('profiles')
            .select('wallet_balance')
            .eq('id', order.customer_id)
            .single();
          if (profErr || !profile) throw new Error('Profil pelanggan tidak ditemukan untuk pencairan saldo');
          
          const newBalance = Number(profile.wallet_balance || 0) + refundAmount;
          const { error: balErr } = await supabaseAdmin
            .from('profiles')
            .update({ wallet_balance: newBalance })
            .eq('id', order.customer_id);
          if (balErr) throw balErr;

          // Log wallet transaction
          await supabaseAdmin.from('wallet_transactions').insert({
            customer_id: order.customer_id,
            amount: refundAmount,
            type: 'refund',
            status: 'success',
            description: `Refund pesanan #${order.id.substring(0, 8).toUpperCase()}`
          });
        }
      }

      let notifMessage = '';
      if (isApproved) {
        const refundToWallet = isWallet || isOnlineOrWalletPayment;
        const refundAmount = Number(order.total_amount);
        const hasVoucher = !!order.voucher_id;

        if (refundToWallet && refundAmount > 0) {
          if (hasVoucher) {
            notifMessage = `Refund disetujui untuk pesanan #${orderId.split('-')[0]}. Dana cash sebesar Rp ${refundAmount.toLocaleString("id-ID")} telah dikreditkan ke Saldo Dompet Anda, dan voucher belanja Anda telah dikembalikan agar dapat digunakan kembali.`;
          } else {
            notifMessage = `Refund disetujui untuk pesanan #${orderId.split('-')[0]}. Dana sebesar Rp ${refundAmount.toLocaleString("id-ID")} telah dicairkan ke Saldo Dompet Anda.`;
          }
        } else if (hasVoucher && refundAmount === 0) {
          notifMessage = `Refund disetujui untuk pesanan gratis #${orderId.split('-')[0]}. Voucher belanja Anda telah dikembalikan dan dapat Anda gunakan kembali.`;
        } else {
          notifMessage = `Refund disetujui untuk pesanan #${orderId.split('-')[0]}. Dana sebesar Rp ${refundAmount.toLocaleString("id-ID")} telah berhasil ditransfer ke rekening bank/e-wallet pilihan Anda.`;
        }
      } else {
        notifMessage = `Refund ditolak untuk pesanan #${orderId.split('-')[0]}. Alasan: ${refundDetails.adminNotes || 'Tidak ada catatan'}.`;
      }

      // Add Notification for customer
      await supabaseAdmin.from('notifications').insert({
        user_id: order.customer_id,
        title: isApproved ? 'Refund Disetujui' : 'Refund Ditolak',
        message: notifMessage,
        type: 'order',
        status_badge: isApproved ? 'Berhasil' : 'Gagal'
      });

      return NextResponse.json({ success: true, message: 'Refund request processed' });
    }

    // New action: notification for order created
    if (action === 'notify_created') {
      await supabaseAdmin.from('notifications').insert({
        user_id: order.customer_id,
        title: 'Pesanan Dibuat',
        message: `No. Pesanan #${orderId.split('-')[0]} berhasil dibuat. Menunggu konfirmasi dari kasir.`,
        type: 'order'
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Order update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
