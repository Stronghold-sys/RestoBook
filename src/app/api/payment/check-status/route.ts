export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendReceiptEmail } from '@/lib/sendReceiptEmail';
import { md5 } from '@/lib/md5';
import { getPaidNotification } from '@/utils/notificationHelper';


export async function POST(req: Request) {
  try {
    const { orderId, duitkuOrderId, type } = await req.json();

    if (!orderId) return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });

    const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || '';
    const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '';

    // ID yang akan kita tanyakan ke Duitku (Gunakan ID dari Duitku jika ada, atau ID pesanan asli)
    const queryOrderId = (duitkuOrderId || orderId).trim();

    // Signature: md5(merchantCode + merchantOrderId + apiKey)
    const signature = await md5(`${DUITKU_MERCHANT_CODE}${queryOrderId}${DUITKU_API_KEY}`);

    const isSandbox = DUITKU_MERCHANT_CODE.startsWith('DS');
    const checkUrl = isSandbox
      ? 'https://api-sandbox.duitku.com/api/merchant/transactionStatus'
      : 'https://api.duitku.com/api/merchant/transactionStatus';

    console.log(`Checking Duitku for ID: ${queryOrderId}`);

    const response = await fetch(checkUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantCode: DUITKU_MERCHANT_CODE,
        merchantOrderId: queryOrderId,
        signature: signature
      })
    });

    const result = await response.json();
    console.log("Duitku Status Result:", result.statusCode, result.statusMessage);

    if (type === 'reservation') {
      if (result.statusCode === '00') {
        const { data: resObj } = await supabaseAdmin
          .from('reservations')
          .select('*')
          .eq('id', orderId)
          .single();

        if (resObj && resObj.payment_status !== 'paid' && resObj.payment_status !== 'dp_paid') {
          const isDp = resObj.payment_method === 'dp';
          const newStatus = isDp ? 'dp_paid' : 'paid';

          await supabaseAdmin
            .from('reservations')
            .update({ payment_status: newStatus })
            .eq('id', orderId);

          await supabaseAdmin.from('notifications').insert({
            user_id: resObj.customer_id,
            title: isDp ? 'DP Reservasi Berhasil Dibayar' : 'Pembayaran Reservasi Berhasil',
            message: `Pembayaran ${isDp ? 'DP ' : ''}reservasi meja #${orderId.substring(0, 8).toUpperCase()} sebesar Rp ${Number(result.amount || 0).toLocaleString('id-ID')} telah berhasil.`,
            type: 'reservation',
            reference_id: orderId,
            status_badge: 'Sukses'
          });
        }
        return NextResponse.json({ status: 'paid', reference: result.reference });
      }

      // Also check our own DB - maybe callback already updated it
      const { data: dbRes } = await supabaseAdmin
        .from('reservations')
        .select('payment_status')
        .eq('id', orderId)
        .single();

      if (dbRes?.payment_status === 'paid' || dbRes?.payment_status === 'dp_paid') {
        return NextResponse.json({ status: 'paid' });
      }

      return NextResponse.json({ status: result.statusMessage || 'pending', raw: result });
    }

    if (result.statusCode === '00') {
      // Pembayaran LUNAS, update database
      // Gunakan ID asli (orderId) untuk update di database kita
      const { data, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid',
          payment_method: 'duitku',
          notes: `[CHECK-STATUS SUCCESS: ${result.reference || 'Duitku'}]`
        })
        .eq('id', orderId) // orderId adalah UUID asli kita
        .select()
        .single();

      let finalOrder = data;
      if (updateError) {
        // Retry jika ID yang dikirim ternyata mengandung suffix
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const match = orderId.match(uuidRegex);
        const cleanId = match ? match[0] : orderId;
        
        const { data: retryData } = await supabaseAdmin
          .from('orders')
          .update({ payment_status: 'paid', payment_method: 'duitku' })
          .eq('id', cleanId)
          .select()
          .single();
        if (retryData) finalOrder = retryData;
      }

      if (finalOrder && finalOrder.customer_id) {
        const paidNotif = getPaidNotification(finalOrder, 'Pembayaran Online');
        await supabaseAdmin.from('notifications').insert({
          user_id: finalOrder.customer_id,
          title: paidNotif.title,
          message: paidNotif.message,
          type: 'order',
          order_id: finalOrder.id,
          status_badge: paidNotif.status_badge
        });
      }

      // Send receipt email to customer
      const finalOrderId = orderId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0] || orderId;
      try {
        await sendReceiptEmail(finalOrderId);
      } catch (e) { console.error('Receipt email error (check-status):', e); }

      return NextResponse.json({ status: 'paid', reference: result.reference });
    }

    // Also check our own DB - maybe callback already updated it
    const { data: dbOrder } = await supabaseAdmin
      .from('orders')
      .select('payment_status')
      .eq('id', orderId)
      .single();

    if (dbOrder?.payment_status === 'paid') {
      return NextResponse.json({ status: 'paid' });
    }

    return NextResponse.json({ status: result.statusMessage || 'pending', raw: result });

  } catch (error: any) {
    console.error('Check status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
