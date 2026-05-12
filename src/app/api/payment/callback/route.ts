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
    // Duitku bisa kirim callback sebagai JSON atau form-urlencoded
    const contentType = req.headers.get('content-type') || '';
    let merchantCode = '';
    let amount = '';
    let merchantOrderId = '';
    let signature = '';
    let resultCode = '';
    let reference = '';

    if (contentType.includes('application/json')) {
      // JSON format
      const json = await req.json();
      merchantCode = json.merchantCode || '';
      amount = String(json.amount || '');
      merchantOrderId = json.merchantOrderId || '';
      signature = json.signature || '';
      resultCode = json.resultCode || '';
      reference = json.reference || '';
      console.log('Duitku Callback (JSON):', JSON.stringify(json));
    } else {
      // Form-urlencoded format
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

    // Environment variables
    const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '';
    const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || '';

    if (!merchantOrderId || !amount) {
      console.error('Callback: Missing merchantOrderId or amount');
      return new NextResponse('OK', { status: 200 });
    }

    // Verify signature: MD5(merchantCode + amount + merchantOrderId + apiKey)
    const useCode = merchantCode || DUITKU_MERCHANT_CODE;
    const signatureString = `${useCode}${amount}${merchantOrderId}${DUITKU_API_KEY}`;
    const calculatedSignature = await md5(signatureString);

    console.log('Callback Signature Check:', { 
      received: signature, 
      calculated: calculatedSignature, 
      match: signature === calculatedSignature,
      resultCode 
    });

    // Verify signature (tapi jangan block jika tidak ada signature - beberapa callback mungkin berbeda)
    if (signature && signature !== calculatedSignature) {
      console.error('Duitku signature mismatch!', { signature, calculatedSignature, signatureString });
    }

    // If payment is successful (resultCode "00" = success)
    if (resultCode === '00' || resultCode === '0') {
      console.log('Payment SUCCESS for order:', merchantOrderId);
      
      // Strip suffix from Sandbox orderId if present to find original DB UUID
      const dbOrderId = merchantOrderId.includes('-') && merchantOrderId.length > 36 
        ? merchantOrderId.substring(0, merchantOrderId.lastIndexOf('-'))
        : merchantOrderId;
      
      console.log('Updating DB Order ID:', dbOrderId);

      // 1. Update order payment status AND fetch joined details for email
      const { data: order, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid',
          status: 'confirmed'
        })
        .eq('id', dbOrderId)
        .select('*, profiles!customer_id(email, full_name), order_items(*, menu_items(name))')
        .single();

      if (updateError) {
        console.error('Error updating order in callback:', updateError);
      } 
      
              // 3. Generate PDF Invoice for Attachment
              let pdfUint8Array: Uint8Array | null = null;
              try {
                const doc = new jsPDF();
                
                // Set Header
                doc.setFillColor(234, 88, 12); // Orange primary
                doc.rect(0, 0, 210, 40, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(28);
                doc.text("RestoBook", 105, 25, { align: 'center' });
                
                // Invoice Title
                doc.setTextColor(31, 41, 55); // Gray 800
                doc.setFontSize(18);
                doc.text("KWITANSI PEMBAYARAN DIGITAL", 105, 55, { align: 'center' });
                
                // Horizontal Line
                doc.setDrawColor(229, 231, 235);
                doc.line(20, 65, 190, 65);
                
                // Info Section
                doc.setFontSize(10);
                doc.setFont("helvetica", "normal");
                doc.text(`Nomor Pesanan: #${shortId}`, 20, 75);
                doc.text(`Tanggal: ${new Date().toLocaleString('id-ID')}`, 20, 82);
                doc.text(`Nama Pelanggan: ${customerName}`, 20, 89);
                doc.text(`Metode: DUITKU GATEWAY`, 20, 96);
                
                doc.text(`Status:`, 140, 75);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(22, 163, 74); // Green
                doc.text(`LUNAS / PAID`, 155, 75);
                doc.setTextColor(31, 41, 55);
                doc.setFont("helvetica", "normal");

                // Table Header
                doc.setFillColor(249, 250, 251);
                doc.rect(20, 105, 170, 10, 'F');
                doc.setFont("helvetica", "bold");
                doc.text("Item Pesanan", 25, 111);
                doc.text("Qty", 140, 111);
                doc.text("Subtotal", 165, 111);
                
                // Table Body
                doc.setFont("helvetica", "normal");
                let yPos = 122;
                if (Array.isArray(order.order_items)) {
                  order.order_items.forEach((item: any) => {
                    const rawMenu = item.menu_items;
                    const menuItem = Array.isArray(rawMenu) ? rawMenu[0] : rawMenu;
                    const name = menuItem?.name || 'Item Menu';
                    
                    doc.text(name, 25, yPos);
                    doc.text(`${item.quantity}x`, 140, yPos);
                    doc.text(`Rp ${Number(item.subtotal).toLocaleString('id-ID')}`, 165, yPos);
                    
                    yPos += 8;
                    // Add new page if too long
                    if (yPos > 270) {
                      doc.addPage();
                      yPos = 20;
                    }
                  });
                }
                
                // Footer Total
                doc.line(20, yPos + 5, 190, yPos + 5);
                doc.setFontSize(14);
                doc.setFont("helvetica", "bold");
                doc.text("TOTAL PEMBAYARAN", 25, yPos + 15);
                doc.setTextColor(234, 88, 12);
                doc.text(`Rp ${Number(order.total_amount).toLocaleString('id-ID')}`, 165, yPos + 15);
                
                // Footnote
                doc.setTextColor(156, 163, 175);
                doc.setFontSize(8);
                doc.setFont("helvetica", "normal");
                doc.text("Terima kasih telah berkunjung ke RestoBook!", 105, 280, { align: 'center' });
                doc.text("Ini adalah dokumen sah yang diterbitkan secara elektronik.", 105, 285, { align: 'center' });

                const pdfArrayBuffer = doc.output('arraybuffer');
                pdfUint8Array = new Uint8Array(pdfArrayBuffer);
                console.log('PDF Invoice generated successfully');
              } catch (pdfError) {
                console.error('Error generating PDF during callback:', pdfError);
              }

              const { error: emailErr } = await resend.emails.send({
                from: 'RestoBook <noreply@restobookid.my.id>',
                to: customerEmail,
                subject: `🧾 Resi Digital Lunas - Pesanan #${shortId} Anda Dikonfirmasi`,
                html: invoiceHtml,
                attachments: pdfUint8Array ? [
                  {
                    filename: `Invoice-RestoBook-${shortId}.pdf`,
                    content: pdfUint8Array,
                  }
                ] : []
              });
              
              if (emailErr) {
                console.error('Resend dispatch error on callback:', emailErr.message);
              } else {
                console.log(`Invoice automation with PDF dispatched flawlessly to ${customerEmail}`);
              }
            } else {
              console.log('Skipping invoice dispatch: No associated customer email found in record/notes for order:', dbOrderId);
            }
          }
        } catch (resendFailure) {
          console.error('Resend instance crash during execution:', resendFailure);
        }
      }
    } else {
      console.log('Callback received with resultCode:', resultCode, 'for order:', merchantOrderId);
    }

    // Duitku expects HTTP 200 with text "OK"
    return new NextResponse('OK', { status: 200 });

  } catch (error: any) {
    console.error('Duitku Callback Error:', error.message || error);
    // Always return 200 to Duitku to prevent retries
    return new NextResponse('OK', { status: 200 });
  }
}
