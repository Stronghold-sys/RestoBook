export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

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

    // Default Customer Detail Shell (Remove placeholder email)
    let customerDetail = {
      firstName: 'Pelanggan',
      lastName: '',
      email: '',
      phoneNumber: ''
    };

    // 1. Prioritas Profil (Robust handle for array/object response structure)
    const rawProfile = order.profiles;
    const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
    
    if (profile) {
      if (profile.full_name) {
        const names = profile.full_name.trim().split(/\s+/);
        customerDetail.firstName = names[0];
        customerDetail.lastName = names.slice(1).join(' ') || '';
      }
      if (profile.email) customerDetail.email = profile.email;
      if (profile.phone) customerDetail.phoneNumber = profile.phone;
    } 
    
    // 2. Parser Fallback Data dari Notes (Untuk Walk-in POS)
    if (order.notes) {
      const nameMatch = order.notes.match(/\[NAMA:\s*(.*?)\]/i);
      if (nameMatch && nameMatch[1] && nameMatch[1].trim().toLowerCase() !== 'guest') {
         const cleanName = nameMatch[1].trim();
         const names = cleanName.split(/\s+/);
         customerDetail.firstName = names[0];
         customerDetail.lastName = names.slice(1).join(' ') || '';
      } else if (nameMatch && nameMatch[1].trim().toLowerCase() === 'guest') {
         customerDetail.firstName = 'Guest';
         customerDetail.lastName = ''; // Supaya tidak jadi "Guest Guest"
      }

      const emailMatch = order.notes.match(/\[EMAIL:\s*(.*?)\]/i);
      if (emailMatch && emailMatch[1]) customerDetail.email = emailMatch[1].trim();

      const telpMatch = order.notes.match(/\[TELP:\s*(.*?)\]/i);
      if (telpMatch && telpMatch[1]) customerDetail.phoneNumber = telpMatch[1].trim();
    }

    // === ITEM DETAILS MAPPING RIGOROUSLY ===
    const itemDetails: any[] = [];
    let itemsSum = 0;
    const itemNames: string[] = [];

    const rawItems = order.order_items;
    const orderItems = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);

    if (orderItems.length > 0) {
      orderItems.forEach((item: any) => {
        if (!item) return;
        const rawMenu = item.menu_items;
        const menuItem = Array.isArray(rawMenu) ? rawMenu[0] : rawMenu;
        
        const name = menuItem?.name || 'Item Menu';
        const price = Math.floor(item.price);
        const qty = Number(item.quantity) || 1;
        
        itemDetails.push({
          name: name,
          price: price,
          quantity: qty
        });
        
        itemsSum += (price * qty);
        itemNames.push(`${name} x${qty}`);
      });
    }

    // Sinkronisasi diskon/biaya lain (Discrepancy checker)
    const discrepancy = paymentAmount - itemsSum;
    if (discrepancy !== 0) {
      itemDetails.push({
        name: discrepancy > 0 ? 'Biaya Tambahan / Layanan' : 'Potongan Diskon',
        price: discrepancy,
        quantity: 1
      });
    }

    // === DUITKU API ITEM DETAILS VALIDATOR ===
    // Duitku Pop API does not allow items with negative or zero prices (e.g. discounts).
    // If any item has price <= 0, we must fallback to a single consolidated item matching the final payment amount.
    const hasInvalidPrice = itemDetails.length === 0 || itemDetails.some((item: any) => item.price <= 0);
    const finalItemDetails = hasInvalidPrice 
      ? [{
          name: `Pesanan #${merchantOrderId.substring(0, 8).toUpperCase()}`,
          price: paymentAmount,
          quantity: 1
        }]
      : itemDetails;

    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    // Ekstrak Catatan Pelanggan Murni (Buang semua tag sistem seperti [METODE: ...])
    const userNotesRaw = order.notes || "";
    const cleanNotes = userNotesRaw
      .replace(/\[[^\]]+\]/g, '') // Hapus semua [TAG]
      .replace(/Kasir:\s*[^\s,]+/gi, '') // Hapus tag Kasir
      .replace(/\s+/g, ' ') // Normalisasi spasi
      .trim();

    // Susun deskripsi produk yang menampung ringkasan barang DAN pesan pelanggan
    const summaryString = itemNames.length > 0 ? itemNames.join(', ') : `No. Pesanan #${merchantOrderId.substring(0, 8)}`;
    
    // Gabungkan ke visual productDetails
    const productDetails = cleanNotes 
      ? `Pesanan: ${summaryString} | Catatan: ${cleanNotes}`.substring(0, 255) 
      : `Pesanan: ${summaryString}`.substring(0, 255);

    // === DUITKU POP BASE PAYLOAD ===
    const isSandbox = DUITKU_MERCHANT_CODE.startsWith('DS');
    const timestampForUnique = String(Date.now());
    const finalOrderId = isSandbox ? `${merchantOrderId}-${timestampForUnique.substring(8)}` : merchantOrderId;

    const payload: any = {
      paymentAmount: paymentAmount,
      merchantOrderId: finalOrderId,
      productDetails: productDetails,
      email: customerDetail.email,
      paymentMethod: paymentMethod || "",
      phoneNumber: customerDetail.phoneNumber,
      itemDetails: finalItemDetails,
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
        error: 'Gagal menghubungi gerbang pembayaran',
        details: responseText.substring(0, 120)
      }, { status: 400 });
    }

    // Standard validation: Capture token and payment URL issued by gateway
    if (data.reference && data.paymentUrl) {
      // KIRIM EMAIL INSTRUKSI PEMBAYARAN (NON-BLOCKING)
      try {
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey && customerDetail.email && customerDetail.email.includes('@')) {
          const resend = new Resend(resendKey);
          const restoName = (order.restaurant_settings as any)?.name || 'RestoBook';
          await resend.emails.send({
            from: 'RestoBook <noreply@restobookid.my.id>',
            to: customerDetail.email,
            subject: `No. Pesanan #${merchantOrderId.substring(0, 8).toUpperCase()} - Tagihan Pembayaran ${restoName}`,
            html: `
              <div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #f0f0f0; border-radius:15px;">
                <h2 style="color:#f97316;">Menunggu Pembayaran</h2>
                <p>Halo ${customerDetail.firstName},</p>
                <p>Pesanan Anda telah kami terima. Silakan selesaikan pembayaran menggunakan tautan di bawah ini:</p>
                <div style="text-align:center; margin:30px 0;">
                  <a href="${data.paymentUrl}" style="background:#f97316; color:white; padding:15px 25px; text-decoration:none; border-radius:10px; font-weight:bold;">Selesaikan Pembayaran Sekarang</a>
                </div>
                <div style="background:#fff7ed; padding:15px; border-radius:10px; border:1px solid #ffedd5;">
                  <p style="margin:0; font-weight:bold; color:#9a3412;"> Petunjuk Pembayaran Virtual Account & Retail:</p>
                  <ul style="color:#9a3412; font-size:14px; margin-top:10px;">
                    <li>Buka aplikasi Bank atau m-Banking Anda.</li>
                    <li>Pilih menu Transfer / Virtual Account.</li>
                    <li>Masukkan nomor Virtual Account yang tertera di halaman pembayaran.</li>
                    <li>Pastikan nominal sesuai dengan total pesanan Anda.</li>
                    <li>Simpan bukti pembayaran Anda.</li>
                  </ul>
                </div>
                <p style="font-size:12px; color:#888; margin-top:20px;">Pesanan akan diproses otomatis setelah pembayaran Anda terverifikasi oleh sistem kami.</p>
              </div>
            `
          });
          console.log('Instruction email sent to:', customerDetail.email);
        }
      } catch (mailErr) {
        console.error('Failed to send instruction email:', mailErr);
      }

      return NextResponse.json({
        reference: data.reference,
        paymentUrl: data.paymentUrl,
        merchantOrderId: finalOrderId
      });
    } else {
      console.error("Duitku Invoice Creation Rejected:", JSON.stringify(data));
      const errorMsg = data.message || data.Message || data.statusMessage || "Unknown API Error";
      return NextResponse.json({ 
        error: `Gagal memproses transaksi: ${errorMsg}`,
        details: data
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Payment API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
