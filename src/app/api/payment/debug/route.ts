import { NextResponse } from 'next/server';
import { md5 } from '@/lib/md5';

export const runtime = 'edge';

export async function GET() {
  const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || '';
  const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '';

  // Test 1: Verify MD5 implementation
  const md5Test = await md5('test');
  const md5Expected = '098f6bcd4621d373cade4e832627b4f6';
  const md5Works = md5Test === md5Expected;

  // Test 2: Try getPaymentMethod
  const datetime = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const paymentAmount = '10000';
  const sig1 = await md5(`${DUITKU_MERCHANT_CODE}${paymentAmount}${datetime}${DUITKU_API_KEY}`);

  let methodsResult: any = null;
  try {
    const res = await fetch('https://sandbox.duitku.com/webapi/api/merchant/paymentmethod/getpaymentmethod', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantcode: DUITKU_MERCHANT_CODE,
        amount: paymentAmount,
        datetime: datetime,
        signature: sig1
      })
    });
    const text = await res.text();
    try { methodsResult = { status: res.status, body: JSON.parse(text) }; }
    catch { methodsResult = { status: res.status, body: text.substring(0, 200) }; }
  } catch (e: any) {
    methodsResult = { error: e.message };
  }

  // Test 3: Try createInvoice
  const testOrderId = 'TEST-' + Date.now();
  const sig2 = await md5(`${DUITKU_MERCHANT_CODE}${testOrderId}${paymentAmount}${DUITKU_API_KEY}`);

  let inquiryResult: any = null;
  try {
    const res = await fetch('https://sandbox.duitku.com/webapi/api/merchant/v2/inquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantCode: DUITKU_MERCHANT_CODE,
        paymentAmount: parseInt(paymentAmount),
        paymentMethod: 'VC',
        merchantOrderId: testOrderId,
        productDetails: 'Test Debug',
        email: 'test@test.com',
        phoneNumber: '08123456789',
        additionalParam: '',
        merchantUserInfo: '',
        customerVaName: 'Test User',
        callbackUrl: 'https://restobookid.my.id/api/payment/callback',
        returnUrl: 'https://restobookid.my.id',
        expiryPeriod: 10,
        signature: sig2
      })
    });
    const text = await res.text();
    try { inquiryResult = { status: res.status, body: JSON.parse(text) }; }
    catch { inquiryResult = { status: res.status, body: text.substring(0, 200) }; }
  } catch (e: any) {
    inquiryResult = { error: e.message };
  }

  return NextResponse.json({
    md5: { test: md5Test, expected: md5Expected, works: md5Works },
    credentials: {
      merchantCode: DUITKU_MERCHANT_CODE,
      apiKeyLength: DUITKU_API_KEY.length,
      apiKeyFirst4: DUITKU_API_KEY.substring(0, 4),
      isSandbox: DUITKU_MERCHANT_CODE.startsWith('DS')
    },
    getPaymentMethod: {
      signatureInput: `${DUITKU_MERCHANT_CODE}${paymentAmount}${datetime}***`,
      signature: sig1,
      result: methodsResult
    },
    createInvoice: {
      merchantOrderId: testOrderId,
      signatureInput: `${DUITKU_MERCHANT_CODE}${testOrderId}${paymentAmount}***`,
      signature: sig2,
      result: inquiryResult
    }
  });
}
