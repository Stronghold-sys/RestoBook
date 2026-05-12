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
    const { orderId, returnUrl } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE;
    const DUITKU_API_KEY = process.env.DUITKU_API_KEY;

    if (!DUITKU_MERCHANT_CODE || !DUITKU_API_KEY) {
      return NextResponse.json({ error: 'Duitku credentials not configured' }, { status: 500 });
    }

    // Ambil detail order tanpa profiles join untuk mencegah error "Order not found" jika relasi bermasalah
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*, menu_items(name))')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      console.error("Create Invoice - Order fetch error:", error, "ID:", orderId);
      return NextResponse.json({ error: error?.message || 'Order not found' }, { status: 404 });
    }

    // Jika sudah lunas, tidak perlu buat invoice
    if (order.payment_status === 'paid') {
      return NextResponse.json({ error: 'Order is already paid' }, { status: 400 });
    }

    const paymentAmount = Math.floor(order.total_amount);
    const merchantOrderId = order.id;

    // Customer detail
    let customerDetail = {
      firstName: 'Customer',
      lastName: '',
      email: 'customer@restobook.com',
      phoneNumber: '081234567890'
    };

    if (order.customer_id) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', order.customer_id).single();
      if (profile) {
        customerDetail.firstName = profile.full_name || 'Customer';
        customerDetail.email = profile.email || 'customer@restobook.com';
        customerDetail.phoneNumber = profile.phone || '081234567890';
      }
    }

    // Gunakan satu item gabungan untuk menghindari error validasi total amount Duitku
    const itemDetails = [{
      name: `Pesanan RestoBook #${merchantOrderId.substring(0, 8)}`,
      price: paymentAmount,
      quantity: 1
    }];

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://restobookid.my.id';

    // === DUITKU POP API ===
    // Signature: SHA256(merchantCode + timestamp + merchantKey)
    const timestamp = String(Date.now());
    const signature = await sha256(`${DUITKU_MERCHANT_CODE}${timestamp}${DUITKU_API_KEY}`);

    const payload = {
      merchantCode: DUITKU_MERCHANT_CODE,
      paymentAmount: paymentAmount,
      merchantOrderId: merchantOrderId,
      productDetails: `Pembayaran Pesanan #${merchantOrderId.substring(0, 8)}`,
      additionalParam: "",
      merchantUserInfo: "",
      email: customerDetail.email,
      customerVaName: customerDetail.firstName,
      phoneNumber: customerDetail.phoneNumber,
      itemDetails: itemDetails,
      callbackUrl: `${baseUrl}/api/payment/callback`,
      returnUrl: returnUrl || `${baseUrl}/customer/orders/${merchantOrderId}`,
      expiryPeriod: 60
    };

    // Auto-detect Sandbox vs Production berdasarkan awalan Merchant Code
    // Merchant Code Sandbox Duitku biasanya berawalan 'DS'
    const isSandbox = DUITKU_MERCHANT_CODE.startsWith('DS');
    const duitkuUrl = isSandbox 
      ? 'https://api-sandbox.duitku.com/api/merchant/createInvoice'
      : 'https://api.duitku.com/api/merchant/createInvoice';
    
    const response = await fetch(duitkuUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-duitku-signature': signature,
        'x-duitku-timestamp': timestamp,
        'x-duitku-merchantcode': DUITKU_MERCHANT_CODE
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    
    // Jika response kosong atau HTTP error
    if (!responseText || responseText.trim() === '') {
      return NextResponse.json({ 
        error: `Duitku mengembalikan respons kosong (HTTP ${response.status}). Pastikan DUITKU_MERCHANT_CODE (${DUITKU_MERCHANT_CODE}) dan DUITKU_API_KEY sudah benar di Cloudflare Environment Variables.` 
      }, { status: 500 });
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      // Respons bukan JSON — kemungkinan HTML error page
      return NextResponse.json({ 
        error: `Duitku Server Error (HTTP ${response.status}): ${responseText.substring(0, 200)}` 
      }, { status: 500 });
    }

    // Duitku Pop API mengembalikan statusCode "00" jika berhasil
    if (result.statusCode === '00' && result.paymentUrl) {
      return NextResponse.json({ 
        paymentUrl: result.paymentUrl,
        reference: result.reference
      });
    } else {
      console.error('Payment Gateway Error:', result);
      // Ambil pesan error spesifik dari Duitku
      const errMessage = result.statusMessage || result.Message || JSON.stringify(result);
      return NextResponse.json({ error: `Duitku Error: ${errMessage}` }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Create Invoice Error:', error.stack || error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
