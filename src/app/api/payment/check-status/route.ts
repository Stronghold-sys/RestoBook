import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'edge';

// SHA256 menggunakan Web Crypto API (Edge-compatible)
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: Request) {
  try {
    const { orderId, duitkuOrderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Use the actual Duitku-issued transaction order ID for checking status
    // Falls back to original orderId if not passed by client
    const queryOrderId = duitkuOrderId || orderId;

    const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || '';
    const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '';

    if (!DUITKU_MERCHANT_CODE || !DUITKU_API_KEY) {
      return NextResponse.json({ error: 'Duitku credentials not configured' }, { status: 500 });
    }

    // Duitku Pop API - Check Transaction Status
    const timestamp = String(Date.now());
    const signature = await sha256(`${DUITKU_MERCHANT_CODE}${queryOrderId}${timestamp}${DUITKU_API_KEY}`);

    const isSandbox = DUITKU_MERCHANT_CODE.startsWith('DS');
    const checkUrl = isSandbox
      ? 'https://api-sandbox.duitku.com/api/merchant/transactionStatus'
      : 'https://api.duitku.com/api/merchant/transactionStatus';

    console.log('Querying Duitku for ID:', queryOrderId);

    const response = await fetch(checkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-duitku-signature': signature,
        'x-duitku-timestamp': timestamp,
        'x-duitku-merchantcode': DUITKU_MERCHANT_CODE
      },
      body: JSON.stringify({
        merchantCode: DUITKU_MERCHANT_CODE,
        merchantOrderId: queryOrderId
      })
    });

    const result = await response.json();
    console.log('Check transaction status:', JSON.stringify(result));

    // statusCode "00" = paid, "01" = pending, "02" = canceled/expired
    if (result.statusCode === '00') {
      // Update database
      await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid',
          status: 'confirmed'
        })
        .eq('id', orderId);

      return NextResponse.json({ status: 'paid', duitkuStatus: result });
    } else if (result.statusCode === '01') {
      return NextResponse.json({ status: 'pending', duitkuStatus: result });
    } else {
      return NextResponse.json({ status: 'failed', duitkuStatus: result });
    }

  } catch (error: any) {
    console.error('Check status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
