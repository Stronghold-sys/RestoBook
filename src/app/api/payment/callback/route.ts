import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { md5 } from '@/lib/md5';
import { Resend } from 'resend';
import { jsPDF } from 'jspdf';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({ message: 'Duitku Callback Endpoint is Active. Waiting for POST requests.' }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let merchantCode = '';
    let amount = '';
    let merchantOrderId = '';
    let signature = '';
    let resultCode = '';
    let reference = '';

    if (contentType.includes('application/json')) {
      const json = await req.json();
      merchantCode = json.merchantCode || '';
      amount = String(json.amount || '');
      merchantOrderId = json.merchantOrderId || '';
      signature = json.signature || '';
      resultCode = json.resultCode || '';
      reference = json.reference || '';
      console.log('Duitku Callback (JSON):', JSON.stringify(json));
    } else {
      const textData = await req.text();
      const params = new URLSearchParams(textData);
      merchantCode = params.get('merchantCode') || '';
      amount = params.get('amount') || '';
      merchantOrderId = params.get('merchantOrderId') || '';
      signature = params.get('signature') || '';
      resultCode = params.get('resultCode') || '';
      reference = params.get('reference') || '';
      console.log('Duitku Callback (Form):', textData);
    }

    const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '';
    const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || '';

    if (!merchantOrderId || !amount) {
      console.error('Callback: Missing merchantOrderId or amount');
      return new NextResponse('OK', { status: 200 });
    }

    const useCode = merchantCode || DUITKU_MERCHANT_CODE;
    const signatureString = `${useCode}${amount}${merchantOrderId}${DUITKU_API_KEY}`;
    const calculatedSignature = await md5(signatureString);

    if (signature && signature !== calculatedSignature) {
      console.error('Duitku signature mismatch!', { signature, calculatedSignature, signatureString });
    }

    if (resultCode === '00' || resultCode === '0') {
      console.log('Payment SUCCESS for order:', merchantOrderId);
      
      const dbOrderId = merchantOrderId.includes('-') && merchantOrderId.length > 36 
        ? merchantOrderId.substring(0, merchantOrderId.lastIndexOf('-'))
        : merchantOrderId;
      
      console.log('Updating DB Order ID:', dbOrderId);

      const { data: order, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid',
          status: 'confirmed'
        })
        .eq('id', dbOrderId)
        .select('*, profiles(email, full_name), order_items(*, menu_items(name))')
        .single();

      if (updateError) {
        console.error('CRITICAL: DB Update Error in Callback:', updateError);
      } else if (order) {
        console.log('Order marked as PAID. Initiating Email Automation...');
        
        try {
          const resendKey = process.env.RESEND_API_KEY;
          if (!resendKey) {
            console.error('ABORT: RESEND_API_KEY is missing from environment!');
          } else {
            let customerEmail = order.profiles?.email;
            if (!customerEmail && order.notes?.includes('[EMAIL:')) {
              customerEmail = order.notes.split('[EMAIL:')[1]?.split(']')[0]?.trim();
            }
            
            let customerName = order.profiles?.full_name;
            if (!customerName && order.notes?.includes('[NAMA:')) {
              customerName = order.notes.split('[NAMA:')[1]?.split(']')[0]?.trim();
            }
            customerName = customerName || 'Pelanggan';

            if (!customerEmail) {
              console.warn('SKIP: No customer email found for order:', dbOrderId);
            } else {
              const resend = new Resend(resendKey);
              const shortId = dbOrderId.substring(0, 8).toUpperCase();
              
              let itemsHtml = '';
              const items = Array.isArray(order.order_items) ? order.order_items : [];
              items.forEach((item: any) => {
                const rawMenu = item.menu_items;
                const menuItem = Array.isArray(rawMenu) ? rawMenu[0] : rawMenu;
                const name = menuItem?.name || 'Item Menu';
                itemsHtml += `
                  <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 14px 0; color: #1f2937; font-weight: 500;">
                      ${name} <span style="background-color: #f3f4f6; color: #6b7280; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">x${item.quantity}</span>
                    </td>
                    <td style="padding: 14px 0; text-align: right; color: #111827; font-weight: 800;">
                      Rp ${Number(item.subtotal).toLocaleString('id-ID')}
                    </td>
                  </tr>`;
              });

              const invoiceHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; color: #374151; line-height: 1.6;">
                  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 45px 20px; text-align: center; border-radius: 20px 20px 0 0;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 900; letter-spacing: -1px;">RestoBook</h1>
                    <p style="color: #ffedd5; margin: 6px 0 0 0; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Pembayaran Berhasil Diverifikasi</p>
                  </div>
                  <div style="padding: 35px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 20px 20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
                    <h2 style="margin-top: 0; font-size: 22px; font-weight: 800; color: #111827;">Halo ${customerName},</h2>
                    <p style="font-size: 15px; color: #4b5563;">Yess! Pesanan Anda telah dibayar lunas. Pesanan kini otomatis dialihkan ke Dapur kami untuk segera diproses.</p>
                    <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; padding: 20px; border-radius: 16px; margin: 30px 0;">
                      <table style="width: 100%; font-size: 14px;">
                        <tr><td style="color: #64748b;">Kwitansi Ref</td><td style="text-align: right; color: #1e293b; font-weight: 800;">#${shortId}</td></tr>
                        <tr><td style="color: #64748b;">Metode Bayar</td><td style="text-align: right; color: #1e293b; font-weight: 700;">DUITKU GATEWAY</td></tr>
                      </table>
                    </div>
                    <h3 style="font-size: 14px; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; border-bottom: 2px solid #f1f5f9; padding-bottom: 10px;">Daftar Menu</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
                      ${itemsHtml}
                      <tr>
                        <td style="padding: 25px 0 0 0; color: #111827; font-weight: 800; font-size: 16px;">TOTAL PEMBAYARAN</td>
                        <td style="padding: 25px 0 0 0; text-align: right; color: #ea580c; font-weight: 900; font-size: 22px;">Rp ${Number(order.total_amount).toLocaleString('id-ID')}</td>
                      </tr>
                    </table>
                    <div style="text-align: center; margin-top: 45px;">
                      <a href="https://restobookid.my.id/customer/orders/${dbOrderId}" style="display: inline-block; background: linear-gradient(to right, #ea580c, #f97316); color: #ffffff; text-decoration: none; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; padding: 16px 35px; border-radius: 14px;">Lacak Pesanan Anda</a>
                    </div>
                  </div>
                </div>
              `;

              let pdfBase64: string | null = null;
              try {
                const doc = new jsPDF();
                doc.setFillColor(234, 88, 12);
                doc.rect(0, 0, 210, 40, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(28);
                doc.text("RestoBook", 105, 25, { align: 'center' });
                
                doc.setTextColor(31, 41, 55);
                doc.setFontSize(18);
                doc.text("KWITANSI PEMBAYARAN DIGITAL", 105, 55, { align: 'center' });
                doc.line(20, 65, 190, 65);
                
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.text(`Nomor Pesanan: #${shortId}`, 20, 75);
                doc.text(`Nama Pelanggan: ${customerName}`, 20, 82);
                doc.text(`Status: PAID / LUNAS`, 20, 89);

                let yPos = 110;
                items.forEach((item: any) => {
                  const rawMenu = item.menu_items;
                  const menuItem = Array.isArray(rawMenu) ? rawMenu[0] : rawMenu;
                  doc.text(`${menuItem?.name || 'Item'} x${item.quantity}`, 25, yPos);
                  doc.text(`Rp ${Number(item.subtotal).toLocaleString('id-ID')}`, 165, yPos);
                  yPos += 8;
                });
                
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text("TOTAL PEMBAYARAN", 25, yPos + 10);
                doc.text(`Rp ${Number(order.total_amount).toLocaleString('id-ID')}`, 165, yPos + 10);

                const dataUri = doc.output('datauristring');
                pdfBase64 = dataUri.split(',')[1];
              } catch (pdfError) {
                console.error('Error generating PDF:', pdfError);
              }

              const { error: emailErr } = await resend.emails.send({
                from: 'RestoBook <noreply@restobookid.my.id>',
                to: customerEmail,
                subject: `🧾 Resi Digital Lunas - Pesanan #${shortId} Anda Dikonfirmasi`,
                html: invoiceHtml,
                attachments: pdfBase64 ? [{ filename: `Invoice-RestoBook-${shortId}.pdf`, content: pdfBase64 }] : []
              });
              
              if (emailErr) console.error('Resend dispatch error:', emailErr.message);
              else console.log(`Invoice successfully sent to ${customerEmail}`);
            }
          }
        } catch (resendFailure) {
          console.error('Resend process crashed:', resendFailure);
        }
      }
    } else {
      console.log('Callback received with resultCode:', resultCode, 'for order:', merchantOrderId);
    }

    return new NextResponse('OK', { status: 200 });

  } catch (error: any) {
    console.error('Global Callback Error:', error.message || error);
    return new NextResponse('OK', { status: 200 });
  }
}
