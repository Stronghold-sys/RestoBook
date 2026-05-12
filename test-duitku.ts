import { md5 } from './src/lib/md5';

async function testDuitku() {
  const DUITKU_MERCHANT_CODE = 'DS30558';
  const DUITKU_API_KEY = 'd1654f16f0139301e10e1b2bb7f575ac';

  const paymentAmount = 65000;
  const merchantOrderId = 'test-' + Date.now();

  const signatureString = `${DUITKU_MERCHANT_CODE}${merchantOrderId}${paymentAmount}${DUITKU_API_KEY}`;
  const signature = md5(signatureString);

  const payload = {
    merchantCode: DUITKU_MERCHANT_CODE,
    paymentAmount: paymentAmount,
    merchantOrderId: merchantOrderId,
    productDetails: `Pembayaran Pesanan #${merchantOrderId.substring(0, 8)}`,
    email: 'test@example.com',
    customerVaName: 'Test Customer',
    phoneNumber: '081234567890',
    itemDetails: [{
      name: `Pesanan RestoBook #${merchantOrderId.substring(0, 8)}`,
      price: paymentAmount,
      quantity: 1
    }],
    customerDetail: {
      firstName: 'Test Customer',
      lastName: '',
      email: 'test@example.com',
      phoneNumber: '081234567890'
    },
    callbackUrl: `http://localhost:3000/api/payment/callback`,
    returnUrl: `http://localhost:3000/customer/orders/${merchantOrderId}`,
    signature: signature,
    expiryPeriod: 60
  };

  const duitkuUrl = 'https://api-sandbox.duitku.com/webapi/api/merchant/v2/inquiry';
  
  console.log('Sending payload to Duitku:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(duitkuUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('Duitku Response:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testDuitku();
