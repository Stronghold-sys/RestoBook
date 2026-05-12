import { NextResponse } from 'next/server';

export const runtime = 'edge';

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: Request) {
  try {
    const { amount } = await req.json();
    
    const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || '';
    const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '';

    if (!DUITKU_MERCHANT_CODE || !DUITKU_API_KEY) {
      return NextResponse.json({ error: 'Kredensial Duitku belum diatur' }, { status: 500 });
    }

    const timestamp = String(Date.now());
    const signature = await sha256(`${DUITKU_MERCHANT_CODE}${timestamp}${DUITKU_API_KEY}`);

    const isSandbox = DUITKU_MERCHANT_CODE.startsWith('DS');
    const url = isSandbox 
      ? 'https://api-sandbox.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod'
      : 'https://api.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-duitku-signature': signature,
        'x-duitku-timestamp': timestamp,
        'x-duitku-merchantcode': DUITKU_MERCHANT_CODE
      },
      body: JSON.stringify({
        merchantCode: DUITKU_MERCHANT_CODE,
        datetime: timestamp,
        paymentAmount: amount || 10000 // Opsional: Duitku bisa filter bank berdasarkan limit nominal
      })
    });

    const data = await response.json();
    
    if (data.paymentFee) {
      return NextResponse.json({ methods: data.paymentFee });
    } else {
      return NextResponse.json({ error: 'Gagal mengambil metode pembayaran', details: data }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Fetch Payment Methods Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
