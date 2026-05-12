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

    // Customer detail extraction
    let customerDetail = {
      firstName: 'Pelanggan',
      lastName: '',
      email: 'customer@restobook.com',
      phoneNumber: '081234567890'
    };

    // 1. Check for details in notes (common for Guest orders from POS)
    if (order.notes) {
      // Extract [NAMA: Budi]
      if (order.notes.includes('[NAMA: ')) {
        const extractedName = order.notes.split('[NAMA: ')[1].split(']')[0];
        if (extractedName) customerDetail.firstName = extractedName;
      }
      // Extract [EMAIL: budi@gmail.com] if exists
      if (order.notes.includes('[EMAIL: ')) {
        const extractedEmail = order.notes.split('[EMAIL: ')[1].split(']')[0];
        if (extractedEmail) customerDetail.email = extractedEmail;
      }
      // Extract [TELP: 0812...] if exists
      if (order.notes.includes('[TELP: ')) {
        const extractedTelp = order.notes.split('[TELP: ')[1].split(']')[0];
        if (extractedTelp) customerDetail.phoneNumber = extractedTelp;
      }
    } 
    
    // 2. If it's a registered customer, use profile data (this overrides generic "Pelanggan")
    if (order.customer_id) {
      const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', order.customer_id).single();
      if (profile) {
        if (profile.full_name) customerDetail.firstName = profile.full_name;
        if (profile.email) customerDetail.email = profile.email;
        if (profile.phone) customerDetail.phoneNumber = profile.phone;
      }
    }

    // ITEM DETAILS MAPPING
    // Duitku require that sum(price * quantity) == paymentAmount
    const itemDetails: any[] = [];
    let itemsSum = 0;

    if (order.order_items && order.order_items.length > 0) {
      order.order_items.forEach((item: any) => {
        const price = Math.floor(item.price);
        const qty = item.quantity;
        itemDetails.push({
          name: item.menu_items?.name || 'Item Pesanan',
          price: price,
          quantity: qty
        });
        itemsSum += (price * qty);
      });
    }

    // Handle discrepancies (e.g., due to rounding, taxes, or service fees not listed in items)
    const discrepancy = paymentAmount - itemsSum;
    if (discrepancy !== 0) {
      itemDetails.push({
        name: discrepancy > 0 ? 'Biaya Layanan/Lainnya' : 'Potongan/Diskon',
        price: discrepancy,
        quantity: 1
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://restobookid.my.id';

    // === DUITKU POP API ===
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
      customerVaName: customerDetail.firstName.substring(0, 30), // VaName limited to 30 chars
      phoneNumber: customerDetail.phoneNumber,
      itemDetails: itemDetails,
      customerDetail: {
        firstName: customerDetail.firstName.split(' ')[0] || customerDetail.firstName,
        lastName: customerDetail.firstName.split(' ').slice(1).join(' ') || "",
        email: customerDetail.email,
        phoneNumber: customerDetail.phoneNumber
      },
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
