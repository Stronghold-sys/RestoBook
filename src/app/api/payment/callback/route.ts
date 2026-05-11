import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { md5 } from '@/lib/md5';

export const runtime = 'edge'; // Changed to Edge runtime for Cloudflare compatibility

export async function GET() {
  return NextResponse.json({ message: 'Duitku Callback Endpoint is Active. Waiting for POST requests.' }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    // Duitku Callback Payload
    // Application/x-www-form-urlencoded
    const textData = await req.text();
    const params = new URLSearchParams(textData);

    const merchantCode = params.get('merchantCode');
    const amount = params.get('amount');
    const merchantOrderId = params.get('merchantOrderId');
    const signature = params.get('signature');
    const reference = params.get('reference');
    const resultCode = params.get('resultCode'); // "00" = success
    
    // Environment variables
    const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || '';
    const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '';

    if (!merchantOrderId || !amount || !signature) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Verify signature: MD5(merchantCode + amount + merchantOrderId + apiKey)
    const signatureString = `${DUITKU_MERCHANT_CODE}${amount}${merchantOrderId}${DUITKU_API_KEY}`;
    const calculatedSignature = md5(signatureString);

    // Always verify signature to prevent fake callbacks
    if (signature !== calculatedSignature) {
      console.error('Duitku signature mismatch!', { signature, calculatedSignature });
      return NextResponse.json({ error: 'Bad signature' }, { status: 403 });
    }

    // If payment is successful
    if (resultCode === '00') {
      // 1. Update order payment status to 'paid'
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid',
          // Optional: You could save the Duitku reference ID into a column if you created one
          // duitku_reference: reference 
        })
        .eq('id', merchantOrderId)
        .eq('payment_status', 'unpaid'); // Only update if currently unpaid

      if (updateError) {
        console.error('Error updating order:', updateError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      // 2. Broadcast realtime update so Kasir/Customer screens refresh automatically
      const supabaseChannel = supabaseAdmin.channel('public:orders');
      await supabaseChannel.send({
        type: 'broadcast',
        event: 'payment_success',
        payload: { order_id: merchantOrderId }
      });
    }

    // Duitku expects HTTP 200 OK
    return new NextResponse('SUCCESS', { status: 200 });

  } catch (error: any) {
    console.error('Duitku Callback Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
