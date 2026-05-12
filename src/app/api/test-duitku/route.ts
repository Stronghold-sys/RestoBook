import { NextResponse } from 'next/server';
import { md5 } from '@/lib/md5';

export const runtime = 'edge';

export async function GET() {
  const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || '';
  const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '';

  const merchantOrderId = `TEST-${Date.now()}`;
  const paymentAmount = 10000;

  const signature = md5(`${DUITKU_MERCHANT_CODE}${merchantOrderId}${paymentAmount}${DUITKU_API_KEY}`);

  const payload = {
    merchantCode: DUITKU_MERCHANT_CODE,
    paymentAmount: paymentAmount,
    merchantOrderId: merchantOrderId,
    productDetails: "Test Payment",
    additionalParam: "",
    merchantUserInfo: "",
    email: "test@test.com",
    customerVaName: "Test Customer",
    phoneNumber: "081234567890",
    itemDetails: [{ name: "Test Item", price: 10000, quantity: 1 }],
    paymentMethod: "",
    creditCardDetail: { saveCardToken: 0 },
    callbackUrl: "https://example.com/callback",
    returnUrl: "https://example.com/return",
    signature: signature,
    expiryPeriod: 10
  };

  // Test ALL possible Duitku endpoints
  const urls = [
    'https://api-sandbox.duitku.com/webapi/api/merchant/v2/inquiry',
    'https://api-sandbox.duitku.com/webapi/api/merchant/createInvoice',
    'https://api-sandbox.duitku.com/api/merchant/createInvoice',
    'https://api-sandbox.duitku.com/api/merchant/v2/inquiry',
    'https://api-sandbox.duitku.com/api/merchant/createinvoice',
    'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry',
    'https://sandbox.duitku.com/webapi/api/merchant/createInvoice',
  ];

  const results: any[] = [];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      results.push({
        url,
        status: res.status,
        statusText: res.statusText,
        body: text.substring(0, 300),
        isJSON: (() => { try { JSON.parse(text); return true; } catch { return false; } })()
      });
    } catch (err: any) {
      results.push({
        url,
        status: 'ERROR',
        error: err.message
      });
    }
  }

  return NextResponse.json({
    merchantCode: DUITKU_MERCHANT_CODE,
    apiKeyPresent: !!DUITKU_API_KEY,
    signatureInput: `${DUITKU_MERCHANT_CODE}${merchantOrderId}${paymentAmount}${DUITKU_API_KEY}`,
    signature,
    payload,
    results
  }, { status: 200 });
}
