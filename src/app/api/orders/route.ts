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
      
      const { error } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: pStatus,
          status: oStatus,
          cashier_id: body.cashierId || null,
          total_amount: body.totalAmount,
          notes: body.notes,
          payment_method: pMethod
        })
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

      // Add Notification
      await supabaseAdmin.from('notifications').insert({
        user_id: order.customer_id,
        title: 'Pengajuan Refund Dikirim',
        message: `Pengajuan refund untuk No. Pesanan #${orderId.split('-')[0]} telah diterima dan sedang diproses.`,
        type: 'order'
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

      // Add Notification for customer
      await supabaseAdmin.from('notifications').insert({
        user_id: order.customer_id,
        title: refundDetails.refundStatus === 'approved' ? 'Refund Disetujui' : 'Refund Ditolak',
        message: refundDetails.refundStatus === 'approved'
          ? `Pengajuan refund No. Pesanan #${orderId.split('-')[0]} Anda disetujui sebesar Rp ${Number(order.total_amount).toLocaleString("id-ID")}.`
          : `Pengajuan refund No. Pesanan #${orderId.split('-')[0]} Anda ditolak. Alasan: ${refundDetails.adminNotes || 'Tidak ada catatan'}`,
        type: 'order'
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
