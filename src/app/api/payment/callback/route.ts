export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendReceiptEmail } from '@/lib/sendReceiptEmail';
import { getPaidNotification } from '@/utils/notificationHelper';

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};

    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const textData = await req.text();
      const params = new URLSearchParams(textData);
      body = Object.fromEntries(params.entries());
    }

    const { merchantOrderId, resultCode, reference, amount } = body;
    console.log("Duitku Callback Received:", { merchantOrderId, resultCode, reference });

    if (!merchantOrderId) return new NextResponse('OK', { status: 200 });

    // Cek keberhasilan (00 atau 0)
    if (resultCode === '00' || resultCode === '0') {
      
      // LOGIKA EKSTRAKSI ID: 
      // 1. Coba ambil UUID dari string (Jika ada suffix timestamp dari sandbox)
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = merchantOrderId.match(uuidRegex);
      const dbOrderId = match ? match[0] : merchantOrderId.split('-')[0]; // Fallback ke bagian pertama sebelum tanda hubung

      if (String(merchantOrderId).startsWith('WLT-')) {
        console.log("Wallet Callback Received for Tx ID:", dbOrderId);
        // Fetch transaction
        const { data: tx } = await supabaseAdmin
          .from('wallet_transactions')
          .select('*')
          .eq('id', dbOrderId)
          .single();

        if (tx && tx.status === 'pending') {
          // 1. Update wallet_transactions to success
          const { error: txErr } = await supabaseAdmin
            .from('wallet_transactions')
            .update({ status: 'success', payment_reference: reference })
            .eq('id', dbOrderId);

          if (!txErr) {
            // 2. Increment user wallet_balance
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('wallet_balance')
              .eq('id', tx.customer_id)
              .single();

            const currentBalance = Number(profile?.wallet_balance || 0);
            const topupAmount = Number(tx.amount);
            const newBalance = currentBalance + topupAmount;

            await supabaseAdmin
              .from('profiles')
              .update({ wallet_balance: newBalance })
              .eq('id', tx.customer_id);

            // 3. Create wallet notification for the customer
            await supabaseAdmin.from('notifications').insert({
              user_id: tx.customer_id,
              title: 'Top Up Berhasil',
              message: `Top up sebesar Rp ${topupAmount.toLocaleString('id-ID')} berhasil masuk ke Dompetku.`,
              type: 'point',
              reference_id: dbOrderId,
              status_badge: 'Sukses'
            });

            console.log(`Wallet Balance updated for customer ${tx.customer_id}: Rp ${newBalance}`);
          }
        }
        return new NextResponse('OK', { status: 200 });
      }

      console.log("Attempting to update Order ID:", dbOrderId);

      // 1. UPDATE DATABASE
      const { data: order, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid', 
          payment_method: 'duitku',
          notes: `[CALLBACK LUNAS: ${reference || 'Duitku'} - Rp ${amount || '?'}]`
        })
        .eq('id', dbOrderId)
        .select('*, profiles(email, full_name), order_items(*, menu_items(name))')
        .single();

      let finalOrder = order;
      if (updateError) {
        // Coba lagi tanpa filter .single() jika gagal
        const { data: retryData, error: retryError } = await supabaseAdmin
          .from('orders')
          .update({ payment_status: 'paid', payment_method: 'duitku' })
          .eq('id', dbOrderId)
          .select()
          .single();
          
        if (retryError) {
          console.error("Database Update Failed After Retry:", retryError);
          return new NextResponse('Error Update', { status: 500 });
        }
        if (retryData) finalOrder = retryData;
      }

      if (finalOrder && finalOrder.customer_id) {
        const paidNotif = getPaidNotification(finalOrder, 'Pembayaran Online');
        await supabaseAdmin.from('notifications').insert({
          user_id: finalOrder.customer_id,
          title: paidNotif.title,
          message: paidNotif.message,
          type: 'order',
          order_id: dbOrderId,
          status_badge: paidNotif.status_badge
        });
      }

      console.log("Order successfully marked as PAID:", dbOrderId);

      // 2. Send Receipt Email directly
      try {
        await sendReceiptEmail(dbOrderId);
      } catch (e) { console.error('Receipt email error:', e); }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error("FATAL ERROR CALLBACK:", err);
    return new NextResponse('OK', { status: 200 });
  }
}
