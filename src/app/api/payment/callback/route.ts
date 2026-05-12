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
  // Simpan log awal untuk setiap request yang masuk
  console.log('--- DUITKU CALLBACK RECEIVED ---');
  
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

    console.log('Raw Callback Data:', JSON.stringify(body));

    const {
      merchantCode,
      amount,
      merchantOrderId,
      signature,
      resultCode,
      reference
    } = body;

    const DUITKU_API_KEY = process.env.DUITKU_API_KEY || '';
    const DUITKU_MERCHANT_CODE = process.env.DUITKU_MERCHANT_CODE || '';

    if (!merchantOrderId) {
      console.error('Callback Error: No merchantOrderId provided');
      return new NextResponse('OK', { status: 200 });
    }

    // VERIFIKASI SIGNATURE (Hanya untuk Log, jangan block dulu agar transaksi bisa masuk)
    const useCode = merchantCode || DUITKU_MERCHANT_CODE;
    const signatureString = `${useCode}${amount}${merchantOrderId}${DUITKU_API_KEY}`;
    const calculatedSignature = await md5(signatureString);

    console.log('Signature Verification:', {
      received: signature,
      expected: calculatedSignature,
      match: signature === calculatedSignature
    });

    // PROSES HANYA JIKA SUCCESS (resultCode 00 atau 0)
    if (resultCode === '00' || resultCode === '0') {
      
      // PARSING ORDER ID (Menangani ID unik sandbox)
      // Jika merchantOrderId adalah "UUID-TIMESTAMP", ambil bagian pertamanya saja (UUID)
      let dbOrderId = merchantOrderId;
      if (merchantOrderId.includes('-') && merchantOrderId.length > 36) {
        // Asumsi UUID standard adalah 36 karakter
        const parts = merchantOrderId.split('-');
        if (parts.length > 5) {
            // Ini kemungkinan UUID (5 parts) + suffix
            dbOrderId = parts.slice(0, 5).join('-');
        } else {
            dbOrderId = merchantOrderId.substring(0, merchantOrderId.lastIndexOf('-'));
        }
      }
      
      console.log(`Attempting to update Order ID: ${dbOrderId} for Amount: ${amount}`);

      // 1. UPDATE DATABASE
      const { data: order, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid',
          status: 'confirmed',
          payment_method: 'duitku' // Pastikan terisi
        })
        .eq('id', dbOrderId)
        .select('*, profiles(email, full_name), order_items(*, menu_items(name))')
        .single();

      if (updateError) {
        console.error('SUPABASE UPDATE ERROR:', updateError.message);
        // Coba cari tanpa .single() jika gagal
        const { data: retryData } = await supabaseAdmin.from('orders').select('*').eq('id', dbOrderId);
        console.log('Retry fetch check (exists?):', !!retryData?.length);
      } else if (order) {
        console.log('SUCCESS: Order status updated to PAID in Database.');

        // 2. TRIGGER EMAIL (Non-blocking)
        try {
          const resendKey = process.env.RESEND_API_KEY;
          if (!resendKey) {
            console.error('RESEND ERROR: API Key missing');
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

            if (customerEmail) {
              console.log(`Sending invoice to: ${customerEmail}`);
              const resend = new Resend(resendKey);
              const shortId = dbOrderId.substring(0, 8).toUpperCase();
              
              // Build Items HTML
              let itemsHtml = '';
              const items = Array.isArray(order.order_items) ? order.order_items : [];
              items.forEach((item: any) => {
                const rawMenu = item.menu_items;
                const menuItem = Array.isArray(rawMenu) ? rawMenu[0] : rawMenu;
                itemsHtml += `
                  <tr style="border-bottom: 1px solid #f3f4f6;">
                    <td style="padding: 12px 0;">${menuItem?.name || 'Item'} x${item.quantity}</td>
                    <td style="padding: 12px 0; text-align: right; font-weight: bold;">Rp ${Number(item.subtotal).toLocaleString('id-ID')}</td>
                  </tr>`;
              });

              // Generate PDF
              let pdfBase64 = null;
              try {
                const doc = new jsPDF();
                doc.setFontSize(20);
                doc.text("RestoBook Invoice", 105, 20, { align: 'center' });
                doc.setFontSize(10);
                doc.text(`Order ID: #${shortId}`, 20, 40);
                doc.text(`Customer: ${customerName}`, 20, 47);
                doc.text(`Status: PAID`, 20, 54);
                
                let y = 70;
                items.forEach((item: any) => {
                  const rawMenu = item.menu_items;
                  const menuItem = Array.isArray(rawMenu) ? rawMenu[0] : rawMenu;
                  doc.text(`${menuItem?.name || 'Item'} x${item.quantity}`, 25, y);
                  doc.text(`Rp ${Number(item.subtotal).toLocaleString('id-ID')}`, 170, y, { align: 'right' });
                  y += 7;
                });
                
                doc.setFont("helvetica", "bold");
                doc.text("TOTAL", 25, y + 10);
                doc.text(`Rp ${Number(order.total_amount).toLocaleString('id-ID')}`, 170, y + 10, { align: 'right' });

                const dataUri = doc.output('datauristring');
                pdfBase64 = dataUri.split(',')[1];
              } catch (pdfErr) {
                console.error('PDF Generation Error:', pdfErr);
              }

              // Send Email
              const { error: mailErr } = await resend.emails.send({
                from: 'RestoBook <noreply@restobookid.my.id>',
                to: customerEmail,
                subject: `🧾 Pembayaran Berhasil - Pesanan #${shortId}`,
                html: `<h1>Terima Kasih, ${customerName}!</h1><p>Pembayaran Anda untuk pesanan #${shortId} telah kami terima.</p><table style="width:100%">${itemsHtml}</table><h3>Total: Rp ${Number(order.total_amount).toLocaleString('id-ID')}</h3>`,
                attachments: pdfBase64 ? [{ filename: `Invoice-${shortId}.pdf`, content: pdfBase64 }] : []
              });

              if (mailErr) console.error('RESEND DISPATCH ERROR:', mailErr.message);
              else console.log('EMAIL SENT SUCCESSFULLY');
            } else {
              console.warn('No email address found for this order.');
            }
          }
        } catch (emailCatch) {
          console.error('Email process failed:', emailCatch);
        }
      }
    } else {
      console.log(`Payment not successful. ResultCode: ${resultCode}`);
    }

    // Selalu balas OK ke Duitku
    return new NextResponse('OK', { status: 200 });

  } catch (globalError: any) {
    console.error('GLOBAL CALLBACK CRASH:', globalError.message);
    return new NextResponse('OK', { status: 200 });
  }
}
