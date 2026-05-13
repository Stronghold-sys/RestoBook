import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendReceiptEmail } from '@/lib/sendReceiptEmail';

export const runtime = 'edge';

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

      if (updateError) {
        // Coba lagi tanpa filter .single() jika gagal
        const { data: retryData, error: retryError } = await supabaseAdmin
          .from('orders')
          .update({ payment_status: 'paid', payment_method: 'duitku' })
          .eq('id', dbOrderId)
          .select();
          
        if (retryError) {
          console.error("Database Update Failed After Retry:", retryError);
          return new NextResponse('Error Update', { status: 500 });
        }
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
