import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { md5 } from '@/lib/md5';

export const runtime = 'edge';

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

    // Ambil detail order
    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*, menu_items(name)), profiles(full_name, email, phone)')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Jika sudah lunas, tidak perlu buat invoice
    if (order.payment_status === 'paid') {
      return NextResponse.json({ error: 'Order is already paid' }, { status: 400 });
    }

    const paymentAmount = Math.floor(order.total_amount);
    const merchantOrderId = order.id;

    // Signature: MD5(merchantCode + merchantOrderId + paymentAmount + apiKey)
    const signatureString = `${DUITKU_MERCHANT_CODE}${merchantOrderId}${paymentAmount}${DUITKU_API_KEY}`;
    const signature = md5(signatureString);

    const customerDetail = {
      firstName: order.profiles?.full_name || 'Customer',
      lastName: '',
      email: order.profiles?.email || 'customer@restobook.com',
      phoneNumber: order.profiles?.phone || '081234567890'
    };

    const itemDetails = (order.order_items || []).map((item: any) => ({
      name: item.menu_items?.name || 'Menu Item',
      price: Math.floor(item.price_at_time),
      quantity: item.quantity
    }));

    const payload = {
      merchantCode: DUITKU_MERCHANT_CODE,
      paymentAmount: paymentAmount,
      merchantOrderId: merchantOrderId,
      productDetails: `Pembayaran Pesanan #${merchantOrderId.substring(0, 8)}`,
      email: customerDetail.email,
      customerVaName: customerDetail.firstName,
      phoneNumber: customerDetail.phoneNumber,
      itemDetails: itemDetails,
      customerDetail: customerDetail,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payment/callback`,
      returnUrl: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/customer/orders/${merchantOrderId}`,
      signature: signature,
      expiryPeriod: 60 // 60 menit
    };

    // Panggil API Duitku (Sandbox / Production)
    // Gunakan passport.duitku.com untuk Production, api-sandbox.duitku.com untuk Sandbox
    // Kita asumsikan Production sesuai permintaan user
    const duitkuUrl = 'https://passport.duitku.com/webapi/api/merchant/v2/inquiry';
    
    const response = await fetch(duitkuUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.statusCode === '00' && result.paymentUrl) {
      return NextResponse.json({ 
        paymentUrl: result.paymentUrl,
        reference: result.reference
      });
    } else {
      console.error('Duitku Error:', result);
      return NextResponse.json({ error: result.statusMessage || 'Gagal membuat tagihan Duitku' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Create Invoice Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
