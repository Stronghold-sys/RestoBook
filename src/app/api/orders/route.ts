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
        .select('id, wallet_balance, is_wallet_blocked')
        .eq('id', orderData.customer_id)
        .single();

      if (profileErr || !profile) {
        return NextResponse.json({ error: 'Profil pelanggan tidak ditemukan' }, { status: 404 });
      }

      if (profile.is_wallet_blocked) {
        return NextResponse.json({ error: 'Akses Dompetku Anda diblokir sementara oleh admin.' }, { status: 400 });
      }

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
        await supabaseAdmin.from("tables").update({ status: "occupied" }).eq("id", newOrder.table_id);
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
        .select('id, wallet_balance, is_wallet_blocked')
        .eq('id', order.customer_id)
        .single();

      if (profileErr || !profile) {
        return NextResponse.json({ error: 'Profil pelanggan tidak ditemukan' }, { status: 404 });
      }

      if (profile.is_wallet_blocked) {
        return NextResponse.json({ error: 'Akses Dompetku Anda diblokir sementara oleh admin.' }, { status: 400 });
      }

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
      await supabaseAdmin.from('notifications').insert({
        user_id: order.customer_id,
        title: 'Pesanan Dibatalkan',
        message: `No. Pesanan #${orderId.split('-')[0]} telah dibatalkan. Alasan: ${cancelReason}`,
        type: 'order'
      });

      if (order.table_id) {
        await supabaseAdmin.from('tables').update({ status: 'available' }).eq('id', order.table_id);
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
      let notifTitle = 'Update Pesanan';
      let notifMsg = `Status No. Pesanan #${orderId.split('-')[0]} diperbarui ke: ${status}`;
      
      if (status === 'confirmed') {
        notifTitle = 'Pesanan Dikonfirmasi';
        notifMsg = `No. Pesanan #${orderId.split('-')[0]} telah dikonfirmasi oleh kasir.`;
      } else if (status === 'processing') {
        notifTitle = 'Pesanan Dimasak';
        notifMsg = `Chef sedang menyiapkan hidangan Anda. Mohon tunggu sebentar!`;
      } else if (status === 'ready') {
        notifTitle = 'Pesanan Siap';
        notifMsg = `Pesanan Anda sudah siap disajikan!`;
      } else if (status === 'completed') {
        notifTitle = 'Pesanan Selesai';
        notifMsg = `Terima kasih telah berkunjung! Berikan ulasan terbaik Anda.`;
      } else if (status === 'cancelled') {
        notifTitle = 'Pesanan Dibatalkan';
        notifMsg = `Pesanan Anda dibatalkan oleh kasir. Alasan: ${reason || 'Tidak disebutkan'}`;
      }

      await supabaseAdmin.from('notifications').insert({
        user_id: order.customer_id,
        title: notifTitle,
        message: notifMsg,
        type: 'order'
      });

      if ((status === 'cancelled' || status === 'completed') && order.table_id) {
        await supabaseAdmin.from('tables').update({ status: 'available' }).eq('id', order.table_id);
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
          await supabaseAdmin.from('tables').update({ status: 'occupied' }).eq('id', body.tableId);
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

      if (isApproved && isWallet) {
        // Fetch current profile wallet_balance
        const { data: profile, error: profErr } = await supabaseAdmin
          .from('profiles')
          .select('wallet_balance')
          .eq('id', order.customer_id)
          .single();
        if (profErr || !profile) throw new Error('Profil pelanggan tidak ditemukan untuk pencairan saldo');
        
        const newBalance = Number(profile.wallet_balance || 0) + Number(order.total_amount);
        const { error: balErr } = await supabaseAdmin
          .from('profiles')
          .update({ wallet_balance: newBalance })
          .eq('id', order.customer_id);
        if (balErr) throw balErr;

        // Log wallet transaction
        await supabaseAdmin.from('wallet_transactions').insert({
          customer_id: order.customer_id,
          amount: Number(order.total_amount),
          type: 'refund',
          status: 'success',
          description: `Refund pesanan #${order.id.substring(0, 8).toUpperCase()}`
        });
      }

      let notifMessage = '';
      if (isApproved) {
        if (isWallet) {
          notifMessage = `Refund disetujui untuk pesanan #${orderId.split('-')[0]}. Dana sebesar Rp ${Number(order.total_amount).toLocaleString("id-ID")} telah berhasil dicairkan ke Saldo Dompet Anda.`;
        } else {
          notifMessage = `Refund disetujui untuk pesanan #${orderId.split('-')[0]}. Dana sebesar Rp ${Number(order.total_amount).toLocaleString("id-ID")} telah berhasil ditransfer ke rekening bank/e-wallet pilihan Anda.`;
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
