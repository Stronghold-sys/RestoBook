import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';
import { jsPDF } from 'jspdf';

export const runtime = 'edge';

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

    const { merchantOrderId, resultCode, reference, amount } = body;
    console.log("Duitku Callback Received:", { merchantOrderId, resultCode, reference });

    if (!merchantOrderId) return new NextResponse('OK', { status: 200 });

    // Cek keberhasilan (00 atau 0)
    if (resultCode === '00' || resultCode === '0') {
      
      // LOGIKA EKSTRAKSI ID: 
      // 1. Coba ambil UUID dari string (Jika ada suffix timestamp dari sandbox)
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = merchantOrderId.match(uuidRegex);
      const dbOrderId = match ? match[0] : merchantOrderId.split('-')[0]; // Fallback ke bagian pertama sebelum tanda hubung

      console.log("Attempting to update Order ID:", dbOrderId);

      // 1. UPDATE DATABASE
      const { data: order, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid', 
          payment_method: 'duitku',
          notes: `[CALLBACK LUNAS: ${reference || 'Duitku'} - Rp ${amount || '?'}]`
        })
        .eq('id', dbOrderId)
        .select('*, profiles(email, full_name), order_items(*, menu_items(name))')
        .single();

      if (updateError) {
        // Coba lagi tanpa filter .single() jika gagal
        const { data: retryData, error: retryError } = await supabaseAdmin
          .from('orders')
          .update({ payment_status: 'paid', payment_method: 'duitku' })
          .eq('id', dbOrderId)
          .select();
          
        if (retryError) {
          console.error("Database Update Failed After Retry:", retryError);
          return new NextResponse('Error Update', { status: 500 });
        }
      }

      console.log("Order successfully marked as PAID:", dbOrderId);

      // 2. KIRIM EMAIL (Resend)
      if (order) {
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey) {
          const resend = new Resend(resendKey);
          let customerEmail = order.profiles?.email;
          if (!customerEmail && order.notes?.includes('[EMAIL:')) {
            customerEmail = order.notes.split('[EMAIL:')[1]?.split(']')[0]?.trim();
          }

          if (customerEmail) {
            const shortId = dbOrderId.substring(0, 8).toUpperCase();
            
            // Kwitansi PDF Sederhana
            let pdfBase64 = null;
            try {
              const doc = new jsPDF();
              doc.text(`KWITANSI PESANAN #${shortId}`, 20, 20);
              doc.text(`Total: Rp ${Number(order.total_amount).toLocaleString('id-ID')}`, 20, 30);
              const dataUri = doc.output('datauristring');
              pdfBase64 = dataUri.split(',')[1];
            } catch (e) {}

            await resend.emails.send({
              from: 'RestoBook <noreply@restobookid.my.id>',
              to: customerEmail,
              subject: `✅ Pembayaran Berhasil - #${shortId}`,
              html: `<p>Pembayaran Anda untuk pesanan <b>#${shortId}</b> telah kami terima sebesar <b>Rp ${Number(order.total_amount).toLocaleString('id-ID')}</b>. Status Anda kini LUNAS.</p>`,
              attachments: pdfBase64 ? [{ filename: `Receipt-${shortId}.pdf`, content: pdfBase64 }] : []
            });
          }
        }
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error("FATAL ERROR CALLBACK:", err);
    return new NextResponse('OK', { status: 200 });
  }
}
