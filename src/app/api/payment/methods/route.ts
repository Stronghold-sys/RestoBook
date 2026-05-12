import { NextResponse } from 'next/server';
import { md5 } from '@/lib/md5';

export const runtime = 'edge';

function getFormattedDate() {
  const now = new Date();
  const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${wibTime.getUTCFullYear()}-${pad(wibTime.getUTCMonth() + 1)}-${pad(wibTime.getUTCDate())} ${pad(wibTime.getUTCHours())}:${pad(wibTime.getUTCMinutes())}:${pad(wibTime.getUTCSeconds())}`;
}

const STATIC_FALLBACK = [
  { paymentMethod: "NQ", paymentName: "QRIS", paymentImage: "https://upload.wikimedia.org/wikipedia/commons/a/a2/Logo_QRIS.svg", totalFee: "0" },
  { paymentMethod: "VA", paymentName: "Virtual Account (All Banks)", paymentImage: "https://duitku.com/wp-content/uploads/2021/04/virtual-account.png", totalFee: "4000" },
  { paymentMethod: "OV", paymentName: "OVO", paymentImage: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Logo_ovo_purple.svg", totalFee: "1.5%" },
  { paymentMethod: "DA", paymentName: "DANA", paymentImage: "https://upload.wikimedia.org/wikipedia/commons/7/72/Logo_dana_blue.svg", totalFee: "1.5%" }
];

export async function POST(req: Request) {
  try {
    const { amount } = await req.json();
    const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || '';
    const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '';

    if (!DUITKU_MERCHANT_CODE || !DUITKU_API_KEY) {
      return NextResponse.json({ methods: STATIC_FALLBACK, warning: 'Kredensial belum diatur' });
    }

    const datetime = getFormattedDate();
    const paymentAmount = String(amount || 10000);
    
    // MD5(merchantCode + paymentAmount + datetime + merchantKey)
    const signature = await md5(`${DUITKU_MERCHANT_CODE}${paymentAmount}${datetime}${DUITKU_API_KEY}`);

    const isSandbox = DUITKU_MERCHANT_CODE.startsWith('DS');
    const url = isSandbox 
      ? 'https://sandbox.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod'
      : 'https://api.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantcode: DUITKU_MERCHANT_CODE,
          amount: paymentAmount,
          datetime: datetime,
          signature: signature
        })
      });

      const data = await response.json();
      
      if (data.paymentFee && data.paymentFee.length > 0) {
        return NextResponse.json({ methods: data.paymentFee });
      } else {
        console.warn('Duitku methods error, using fallback:', data);
        return NextResponse.json({ methods: STATIC_FALLBACK, warning: 'Duitku API error', details: data });
      }
    } catch (e) {
      console.error('Fetch error, using fallback:', e);
      return NextResponse.json({ methods: STATIC_FALLBACK, warning: 'Network Error' });
    }

  } catch (error: any) {
    return NextResponse.json({ methods: STATIC_FALLBACK, error: error.message });
  }
}
