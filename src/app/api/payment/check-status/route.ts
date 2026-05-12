import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'edge';

// Fungsi MD5 sederhana untuk Edge Runtime (Tanpa library eksternal)
async function md5(message: string) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('MD5' as any, msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();

    if (!orderId) return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });

    const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || '';
    const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '';

    if (!DUITKU_MERCHANT_CODE || !DUITKU_API_KEY) {
      return NextResponse.json({ error: 'Duitku credentials not configured' }, { status: 500 });
    }

    // Pembersihan ID Pesanan (Penting!)
    const cleanOrderId = orderId.trim();

    // Signature Cek Status Duitku: md5(merchantCode + merchantOrderId + apiKey)
    const signature = await md5(`${DUITKU_MERCHANT_CODE}${cleanOrderId}${DUITKU_API_KEY}`);

    const isSandbox = DUITKU_MERCHANT_CODE.startsWith('DS');
    const checkUrl = isSandbox
      ? 'https://api-sandbox.duitku.com/api/merchant/transactionStatus'
      : 'https://api.duitku.com/api/merchant/transactionStatus';

    const response = await fetch(checkUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantCode: DUITKU_MERCHANT_CODE,
        merchantOrderId: cleanOrderId,
        signature: signature
      })
    });

    const result = await response.json();

    // statusCode "00" = LUNAS
    if (result.statusCode === '00') {
      const { data, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid',
          payment_method: 'duitku',
          notes: `[VERIFIED SUCCESS: ${result.reference || 'Duitku'}]`
        })
        .eq('id', cleanOrderId)
        .select()
        .single();

      if (updateError) throw updateError;
      return NextResponse.json({ status: 'paid', order: data });
    }

    return NextResponse.json({ 
      status: result.statusMessage || 'pending',
      raw: result 
    });

  } catch (error: any) {
    console.error('Check status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
