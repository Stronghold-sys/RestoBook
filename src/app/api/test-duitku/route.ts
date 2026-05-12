import { NextResponse } from 'next/server';
import { md5 } from '@/lib/md5';

export const runtime = 'edge';

export async function GET() {
  const MC = process.env.DUITKU_MERCHANT_CODE || '';
  const AK = process.env.DUITKU_API_KEY || '';

  const merchantOrderId = `TEST-${Date.now()}`;
  const paymentAmount = 10000;
  const datetime = new Date().toISOString().replace('T', ' ').substring(0, 19); // yyyy-MM-dd HH:mm:ss

  // Test multiple signature formulas
  const signatureFormulas: Record<string, string> = {
    'MC+OrderId+Amount+AK': md5(`${MC}${merchantOrderId}${paymentAmount}${AK}`),
    'MC+Amount+OrderId+AK': md5(`${MC}${paymentAmount}${merchantOrderId}${AK}`),
    'MC+Amount+Datetime+AK': md5(`${MC}${paymentAmount}${datetime}${AK}`),
    'MC+OrderId+Amount+AK (amount string)': md5(`${MC}${merchantOrderId}${String(paymentAmount)}${AK}`),
    'MC+Amount+AK': md5(`${MC}${paymentAmount}${AK}`),
  };

  const url = 'https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry';
  const results: any[] = [];

  for (const [formula, signature] of Object.entries(signatureFormulas)) {
    const payload: any = {
      merchantCode: MC,
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

    // Add timestamp for formulas that use it
    if (formula.includes('Datetime')) {
      payload.datetime = datetime;
      payload.timestamp = datetime;
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await res.text();
      results.push({
        formula,
        signatureInput: formula === 'MC+OrderId+Amount+AK' ? `${MC}${merchantOrderId}${paymentAmount}${AK}` :
                         formula === 'MC+Amount+OrderId+AK' ? `${MC}${paymentAmount}${merchantOrderId}${AK}` :
                         formula.includes('Datetime') ? `${MC}${paymentAmount}${datetime}${AK}` :
                         formula === 'MC+Amount+AK' ? `${MC}${paymentAmount}${AK}` :
                         `${MC}${merchantOrderId}${String(paymentAmount)}${AK}`,
        signature,
        status: res.status,
        body: text.substring(0, 300)
      });
    } catch (err: any) {
      results.push({ formula, signature, error: err.message });
    }
  }

  return NextResponse.json({
    merchantCode: MC,
    merchantOrderId,
    paymentAmount,
    datetime,
    url,
    results
  });
}
