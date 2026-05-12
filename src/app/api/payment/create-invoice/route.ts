import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { md5 } from '@/lib/md5';

export const runtime = 'edge';

// Database Admin Client (Bypass RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE!;
const DUITKU_API_KEY = process.env.DUITKU_API_KEY!;

async function sha256(message: string) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, paymentMethod, returnUrl } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Ambil detail order dengan join yang lengkap
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*, menu_items(name)), profiles!customer_id(*)')
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

    // Default Customer Detail
    let customerDetail = {
      firstName: 'Pelanggan',
      lastName: '',
      email: 'customer@restobook.com',
      phoneNumber: '081234567890'
    };

    // 1. Prioritaskan data dari Profile (Jika Pelanggan Terdaftar)
    // Kita sudah join di query awal (profiles(*))
    const profile = order.profiles;
    if (profile) {
      if (profile.full_name) {
        const names = profile.full_name.trim().split(' ');
        customerDetail.firstName = names[0];
        customerDetail.lastName = names.slice(1).join(' ') || names[0];
      }
      if (profile.email) customerDetail.email = profile.email;
      if (profile.phone) customerDetail.phoneNumber = profile.phone;
    } 
    // 2. Fallback ke data dari Notes (Untuk Guest/Walk-in dari POS)
    else if (order.notes) {
      if (order.notes.includes('[NAMA: ')) {
        const extractedName = order.notes.split('[NAMA: ')[1].split(']')[0];
        if (extractedName) {
           const names = extractedName.trim().split(' ');
           customerDetail.firstName = names[0];
           customerDetail.lastName = names.slice(1).join(' ') || names[0];
        }
      }
      if (order.notes.includes('[EMAIL: ')) {
        const extractedEmail = order.notes.split('[EMAIL: ')[1].split(']')[0];
        if (extractedEmail) customerDetail.email = extractedEmail;
      }
      if (order.notes.includes('[TELP: ')) {
        const extractedTelp = order.notes.split('[TELP: ')[1].split(']')[0];
        if (extractedTelp) customerDetail.phoneNumber = extractedTelp;
      }
    }

    // ITEM DETAILS MAPPING
    const itemDetails: any[] = [];
    let itemsSum = 0;
    const itemNames: string[] = [];

    if (order.order_items && order.order_items.length > 0) {
      order.order_items.forEach((item: any) => {
        const name = item.menu_items?.name || 'Item Pesanan';
        const price = Math.floor(item.price);
        const qty = item.quantity;
        
        itemDetails.push({
          name: name,
          price: price,
          quantity: qty
        });
        
        itemsSum += (price * qty);
        itemNames.push(`${name} x${qty}`);
      });
    }

    // Handle discrepancy (tax, service charge, or discount)
    const discrepancy = paymentAmount - itemsSum;
    if (discrepancy !== 0) {
      itemDetails.push({
        name: discrepancy > 0 ? 'Biaya Layanan/Lainnya' : 'Potongan/Diskon',
        price: discrepancy,
        quantity: 1
      });
    }

    // Derive host dynamically from the current request to prevent hardcoding errors or incorrect env variables
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    // Construct a more descriptive product detail string
    const productDetails = itemNames.length > 0 
      ? `Pesanan: ${itemNames.join(', ')}`.substring(0, 255) 
      : `Pembayaran Pesanan #${merchantOrderId.substring(0, 8)}`;

    // === DUITKU API ===
    const isSandbox = DUITKU_MERCHANT_CODE.startsWith('DS');
    // Suffix Order ID untuk Sandbox agar tidak duplikat saat testing berulang
    const timestamp = String(Date.now());
    const finalOrderId = isSandbox ? `${merchantOrderId}-${timestamp.substring(8)}` : merchantOrderId;

    const payload: any = {
      paymentAmount: paymentAmount,
      merchantOrderId: finalOrderId,
      productDetails: productDetails,
      email: customerDetail.email,
      paymentMethod: paymentMethod || "",
      phoneNumber: customerDetail.phoneNumber,
      itemDetails: itemDetails,
      customerDetail: {
        firstName: customerDetail.firstName,
        lastName: customerDetail.lastName,
        email: customerDetail.email,
        phoneNumber: customerDetail.phoneNumber
      },
      callbackUrl: `${baseUrl}/api/payment/callback`,
      returnUrl: returnUrl || `${baseUrl}/customer/orders/${merchantOrderId}`,
      expiryPeriod: 1440 // Duitku Pop default in minutes
    };

    // === DUITKU POP AUTHENTICATION ===
    // Signature requires consistent timestamp in headers and payload verification
    const reqTimestamp = String(Date.now());
    
    // Signature Construction: SHA256(merchantCode + timestamp + apiKey)
    const signatureString = `${DUITKU_MERCHANT_CODE}${reqTimestamp}${DUITKU_API_KEY}`;
    const signature = await sha256(signatureString);
    
    // Duitku Pop API Base Endpoints
    const url = isSandbox 
      ? 'https://api-sandbox.duitku.com/api/merchant/createInvoice'
      : 'https://api-prod.duitku.com/api/merchant/createInvoice';

    console.log('Duitku Pop Request:', { url, orderId: finalOrderId, timestamp: reqTimestamp });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-duitku-signature': signature,
        'x-duitku-timestamp': reqTimestamp,
        'x-duitku-merchantcode': DUITKU_MERCHANT_CODE
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Duitku API Invalid Response Format:", responseText);
      return NextResponse.json({ 
        error: `Duitku Gateway Error (${response.status})`,
        details: responseText.substring(0, 120)
      }, { status: 400 });
    }

    // Standard validation: Capture token and payment URL issued by gateway
    if (data.reference && data.paymentUrl) {
      return NextResponse.json({
        reference: data.reference,
        paymentUrl: data.paymentUrl,
        merchantOrderId: finalOrderId
      });
    } else {
      console.error("Duitku Invoice Creation Rejected:", JSON.stringify(data));
      const errorMsg = data.message || data.Message || data.statusMessage || "Unknown API Error";
      return NextResponse.json({ 
        error: `Duitku: ${errorMsg}`,
        details: data
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Payment API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
