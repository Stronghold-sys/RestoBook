import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { md5 } from '@/lib/md5';
import { Resend } from 'resend';
import { jsPDF } from 'jspdf';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({ message: 'Duitku Callback Endpoint is Active.' }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};

    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const textData = await req.text();
      const params = new URLSearchParams(textData);
      body = Object.fromEntries(params.entries());
    }

    const {
      merchantCode,
      amount,
      merchantOrderId,
      signature,
      resultCode
    } = body;

    const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '';
    const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || '';

    if (!merchantOrderId) return new NextResponse('OK', { status: 200 });

    if (resultCode === '00' || resultCode === '0') {
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = merchantOrderId.match(uuidRegex);
      const dbOrderId = match ? match[0] : merchantOrderId;
      
      // 1. UPDATE STATUS PEMBAYARAN
      await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'paid', status: 'confirmed', payment_method: 'duitku' })
        .eq('id', dbOrderId);

      // 2. AMBIL DATA PESANAN & PROFIL (UNTUK EMAIL)
      // Kita ambil terpisah agar lebih akurat dan tidak terpengaruh error update
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('*, profiles(email, full_name), order_items(*, menu_items(name))')
        .eq('id', dbOrderId)
        .single();

      if (order) {
        console.log('Fulfillment: Order data retrieved for email routing.');
        
        try {
          const resendKey = process.env.RESEND_API_KEY;
          if (resendKey) {
            // PRIORITAS 1: EMAIL DARI PROFIL (DAFTAR AKUN)
            let customerEmail = order.profiles?.email;
            
            // PRIORITAS 2: EMAIL DARI CATATAN (CHECKOUT GUEST/FALLBACK)
            if (!customerEmail && order.notes?.includes('[EMAIL:')) {
              customerEmail = order.notes.split('[EMAIL:')[1]?.split(']')[0]?.trim();
            }
            
            let customerName = order.profiles?.full_name;
            if (!customerName && order.notes?.includes('[NAMA:')) {
              customerName = order.notes.split('[NAMA:')[1]?.split(']')[0]?.trim();
            }
            customerName = customerName || 'Pelanggan';

            if (customerEmail) {
              const resend = new Resend(resendKey);
              const shortId = dbOrderId.substring(0, 8).toUpperCase();
              
              // PDF Generation (Sederhana untuk stabilitas Edge)
              let pdfBase64 = null;
              try {
                const doc = new jsPDF();
                doc.setFontSize(20);
                doc.text("RestoBook Digital Invoice", 105, 20, { align: 'center' });
                doc.setFontSize(10);
                doc.text(`Kwitansi: #${shortId}`, 20, 40);
                doc.text(`Pelanggan: ${customerName}`, 20, 47);
                doc.text(`Status: LUNAS & DIPROSES`, 20, 54);
                
                const dataUri = doc.output('datauristring');
                pdfBase64 = dataUri.split(',')[1];
              } catch (e) {}

              await resend.emails.send({
                from: 'RestoBook <noreply@restobookid.my.id>',
                to: customerEmail,
                subject: `🧾 Konfirmasi Pembayaran - Pesanan #${shortId}`,
                html: `
                  <div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #f0f0f0; border-radius:15px;">
                    <h1 style="color:#f97316;">Halo, ${customerName}!</h1>
                    <p>Pembayaran Anda untuk pesanan <b>#${shortId}</b> telah kami terima dan diverifikasi otomatis.</p>
                    <p>Saat ini pesanan Anda sedang disiapkan oleh tim dapur kami. Silakan klik tombol di bawah untuk melihat detail pesanan Anda:</p>
                    <div style="text-align:center; margin:30px 0;">
                      <a href="https://restobookid.my.id/customer/orders/${dbOrderId}" style="background:#f97316; color:white; padding:15px 25px; text-decoration:none; border-radius:10px; font-weight:bold;">Lihat Pesanan</a>
                    </div>
                    <p style="font-size:12px; color:#888;">Email ini dikirim otomatis oleh sistem RestoBook. Harap tidak membalas email ini.</p>
                  </div>
                `,
                attachments: pdfBase64 ? [{ filename: `Invoice-RestoBook-${shortId}.pdf`, content: pdfBase64 }] : []
              });
              console.log(`Success: Invoice sent to ${customerEmail} (Source: ${order.profiles?.email ? 'Profile' : 'Checkout Notes'})`);
            }
          }
        } catch (mailError) {
          console.error('Email Dispatch Error:', mailError);
        }
      }
    }

    return new NextResponse('OK', { status: 200 });

  } catch (globalErr: any) {
    console.error('Callback Global Error:', globalErr.message);
    return new NextResponse('OK', { status: 200 });
  }
}
