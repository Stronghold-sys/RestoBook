import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';
import { jsPDF } from 'jspdf';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({ message: 'Duitku Callback Endpoint is Active.' }, { status: 200 });
}

export async function POST(req: Request) {
  console.log('--- DUITKU CALLBACK START ---');
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

    console.log('Callback Body:', JSON.stringify(body));

    const { merchantOrderId, resultCode } = body;

    if (!merchantOrderId) {
      console.error('CRITICAL: merchantOrderId is missing');
      return new NextResponse('OK', { status: 200 });
    }

    if (resultCode === '00' || resultCode === '0') {
      console.log(`Payment SUCCESS for Order: ${merchantOrderId}`);
      
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = merchantOrderId.match(uuidRegex);
      const dbOrderId = match ? match[0] : merchantOrderId;
      
      // 1. UPDATE DB
      const { data: order, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'paid', status: 'pending', payment_method: 'duitku' })
        .eq('id', dbOrderId)
        .select('*, profiles(email, full_name), order_items(*, menu_items(name))')
        .single();

      if (updateError) console.error('SUPABASE UPDATE ERROR:', updateError.message);

      if (order) {
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey) {
          const resend = new Resend(resendKey);
          
          let customerEmail = order.profiles?.email;
          if (!customerEmail && order.notes?.includes('[EMAIL:')) {
            customerEmail = order.notes.split('[EMAIL:')[1]?.split(']')[0]?.trim();
          }

          let customerName = order.profiles?.full_name || 'Pelanggan';
          if (!customerName || customerName === 'Pelanggan') {
            if (order.notes?.includes('[NAMA:')) {
              customerName = order.notes.split('[NAMA:')[1]?.split(']')[0]?.trim();
            }
          }

          if (customerEmail) {
            const shortId = dbOrderId.substring(0, 8).toUpperCase();
            
            // GENERATE PDF
            let pdfBase64 = null;
            try {
              const doc = new jsPDF();
              doc.setFontSize(20);
              doc.text("RestoBook Digital Receipt", 105, 20, { align: 'center' });
              doc.setFontSize(10);
              doc.text(`No. Pesanan: #${shortId}`, 20, 40);
              doc.text(`Nama: ${customerName}`, 20, 47);
              doc.text(`Status: LUNAS (Duitku)`, 20, 54);
              doc.text(`Total: Rp ${Number(order.total_amount).toLocaleString('id-ID')}`, 20, 61);
              
              const dataUri = doc.output('datauristring');
              pdfBase64 = dataUri.split(',')[1];
            } catch (pdfErr) {
              console.error('PDF GEN ERROR:', pdfErr);
            }

            console.log(`Sending Success Email to ${customerEmail}...`);
            const { data: mData, error: mErr } = await resend.emails.send({
              from: 'RestoBook <noreply@restobookid.my.id>',
              to: customerEmail,
              subject: `✅ Pembayaran Berhasil - Pesanan #${shortId}`,
              html: `
                <div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #f0f0f0; border-radius:15px;">
                  <div style="text-align:center; padding-bottom:20px; border-bottom:2px solid #f97316; margin-bottom:20px;">
                    <h1 style="color:#f97316; margin:0;">RestoBook</h1>
                  </div>
                  <h2 style="color:#111827;">Halo ${customerName}, Pembayaran Diterima!</h2>
                  <p>Kami telah menerima pembayaran Anda untuk pesanan <b>#${shortId}</b>.</p>
                  <p><b>Apa langkah selanjutnya?</b> Mohon tunggu, Kasir kami akan segera mengonfirmasi pesanan Anda agar bisa langsung diproses oleh tim dapur.</p>
                  
                  <div style="text-align:center; margin:30px 0;">
                    <a href="https://restobookid.my.id/customer/orders/${dbOrderId}" style="background:#f97316; color:white; padding:15px 25px; text-decoration:none; border-radius:10px; font-weight:bold;">Lihat Status Pesanan</a>
                  </div>
                  
                  <div style="background:#f8fafc; padding:15px; border-radius:10px; font-size:13px; color:#64748b;">
                    <p style="margin:0;">💡 <b>Info:</b> Kwitansi pembayaran digital telah kami lampirkan dalam email ini sebagai bukti transaksi Anda.</p>
                  </div>
                </div>
              `,
              attachments: pdfBase64 ? [{ filename: `Receipt-RestoBook-${shortId}.pdf`, content: pdfBase64 }] : []
            });

            if (mErr) console.error('RESEND ERROR:', mErr);
            else console.log('Email sent! ID:', mData?.id);
          }
        }
      }
    }

    console.log('--- DUITKU CALLBACK END ---');
    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error('GLOBAL ERROR:', err.message);
    return new NextResponse('OK', { status: 200 });
  }
}
