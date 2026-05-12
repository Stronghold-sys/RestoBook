import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
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

    const { merchantOrderId, resultCode } = body;

    if (!merchantOrderId) return new NextResponse('OK', { status: 200 });

    if (resultCode === '00' || resultCode === '0') {
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = merchantOrderId.match(uuidRegex);
      const dbOrderId = match ? match[0] : merchantOrderId;
      
      const { data: order } = await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'paid', status: 'pending', payment_method: 'duitku' })
        .eq('id', dbOrderId)
        .select('*, profiles(email, full_name), order_items(*, menu_items(name))')
        .single();

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
            
            // 1. Generate Detailed PDF
            let pdfBase64 = null;
            try {
              const doc = new jsPDF();
              doc.setFontSize(22);
              doc.text("KWITANSI RESTOBOOK", 105, 20, { align: 'center' });
              doc.setFontSize(10);
              doc.text(`ID Pesanan: #${shortId}`, 20, 40);
              doc.text(`Pelanggan: ${customerName}`, 20, 47);
              doc.text(`Waktu: ${new Date().toLocaleString('id-ID')}`, 20, 54);
              doc.text("----------------------------------------------------------------", 20, 60);
              
              let y = 70;
              order.order_items?.forEach((item: any) => {
                doc.text(`${item.quantity}x ${item.menu_items?.name || 'Item'}`, 20, y);
                doc.text(`Rp ${Number(item.subtotal).toLocaleString('id-ID')}`, 180, y, { align: 'right' });
                y += 7;
              });
              
              doc.text("----------------------------------------------------------------", 20, y);
              doc.setFontSize(12);
              doc.text(`TOTAL BAYAR: Rp ${Number(order.total_amount).toLocaleString('id-ID')}`, 180, y + 10, { align: 'right' });
              
              const dataUri = doc.output('datauristring');
              pdfBase64 = dataUri.split(',')[1];
            } catch (e) {}

            // 2. Send Detailed Email
            await resend.emails.send({
              from: 'RestoBook <noreply@restobookid.my.id>',
              to: customerEmail,
              subject: `✅ Pembayaran Berhasil - Pesanan #${shortId}`,
              html: `
                <div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #f0f0f0; border-radius:15px;">
                  <div style="text-align:center; padding-bottom:20px; border-bottom:2px solid #f97316; margin-bottom:20px;">
                    <h1 style="color:#f97316; margin:0;">RestoBook</h1>
                  </div>
                  <h2 style="color:#111827;">Pembayaran Diterima!</h2>
                  <p>Halo <b>${customerName}</b>, terima kasih! Pembayaran Anda untuk pesanan <b>#${shortId}</b> telah kami terima.</p>
                  
                  <div style="background:#f8fafc; padding:20px; border-radius:15px; margin:20px 0;">
                    <p style="margin:0 0 10px 0; font-weight:bold; color:#1e293b;">Rincian Pesanan:</p>
                    <table style="width:100%; border-collapse:collapse; font-size:14px;">
                      ${order.order_items?.map((item: any) => `
                        <tr>
                          <td style="padding:5px 0;">${item.quantity}x ${item.menu_items?.name}</td>
                          <td style="text-align:right; padding:5px 0;">Rp ${Number(item.subtotal).toLocaleString('id-ID')}</td>
                        </tr>
                      `).join('')}
                      <tr>
                        <td style="padding:15px 0 5px 0; border-top:1px solid #e2e8f0; font-weight:bold;">Total Bayar</td>
                        <td style="padding:15px 0 5px 0; border-top:1px solid #e2e8f0; text-align:right; font-weight:bold; color:#f97316; font-size:18px;">Rp ${Number(order.total_amount).toLocaleString('id-ID')}</td>
                      </tr>
                    </table>
                  </div>

                  <p><b>Langkah Selanjutnya:</b> Kasir kami akan segera mengonfirmasi pesanan Anda agar bisa segera disiapkan.</p>
                  
                  <div style="text-align:center; margin:30px 0;">
                    <a href="https://restobookid.my.id/customer/orders/${dbOrderId}" style="background:#f97316; color:white; padding:15px 25px; text-decoration:none; border-radius:10px; font-weight:bold;">Pantau Pesanan</a>
                  </div>
                  
                  <p style="font-size:12px; color:#999; text-align:center;">Kwitansi resmi (PDF) telah kami lampirkan dalam email ini.</p>
                </div>
              `,
              attachments: pdfBase64 ? [{ filename: `Kwitansi-${shortId}.pdf`, content: pdfBase64 }] : []
            });
          }
        }
      }
    }
    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    return new NextResponse('OK', { status: 200 });
  }
}
