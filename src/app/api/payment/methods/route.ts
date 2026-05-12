import { NextResponse } from 'next/server';

export const runtime = 'edge';

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getFormattedDate() {
  const now = new Date();
  const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  const pad = (n: number) => n.toString().padStart(2, '0');
  const y = wibTime.getUTCFullYear();
  const m = pad(wibTime.getUTCMonth() + 1);
  const d = pad(wibTime.getUTCDate());
  const h = pad(wibTime.getUTCHours());
  const min = pad(wibTime.getUTCMinutes());
  const s = pad(wibTime.getUTCSeconds());
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

export async function POST(req: Request) {
  try {
    const { amount } = await req.json();
    
    const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || '';
    const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '';

    if (!DUITKU_MERCHANT_CODE || !DUITKU_API_KEY) {
      return NextResponse.json({ error: 'Kredensial Duitku belum diatur' }, { status: 500 });
    }

    const datetime = getFormattedDate();
    const timestamp = String(Date.now());
    const paymentAmount = String(amount || 10000);
    
    // Header Signature: SHA256(merchantCode + timestamp + merchantKey)
    const headerSignature = await sha256(`${DUITKU_MERCHANT_CODE}${timestamp}${DUITKU_API_KEY}`);
    
    // Body Signature: SHA256(merchantCode + paymentAmount + datetime + merchantKey)
    const bodySignature = await sha256(`${DUITKU_MERCHANT_CODE}${paymentAmount}${datetime}${DUITKU_API_KEY}`);

    const isSandbox = DUITKU_MERCHANT_CODE.startsWith('DS');
    // Gunakan passport.duitku.com untuk integrasi POP API
    const url = isSandbox 
      ? 'https://passport-sandbox.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod'
      : 'https://passport.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-duitku-signature': headerSignature,
        'x-duitku-timestamp': timestamp,
        'x-duitku-merchantcode': DUITKU_MERCHANT_CODE
      },
      body: JSON.stringify({
        merchantCode: DUITKU_MERCHANT_CODE,
        datetime: datetime,
        paymentAmount: parseInt(paymentAmount),
        signature: bodySignature
      })
    });

    const data = await response.json();
    console.log('Duitku Methods Response:', JSON.stringify(data));
    
    if (data.paymentFee) {
      return NextResponse.json({ methods: data.paymentFee });
    } else {
      return NextResponse.json({ 
        error: 'Gagal mengambil metode pembayaran', 
        details: data,
        debug: { datetime, paymentAmount, url } 
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Fetch Payment Methods Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
