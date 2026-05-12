import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';
import { jsPDF } from 'jspdf';

export const runtime = 'edge';

// Endpoint untuk menerima notifikasi dari Duitku
export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};

    // Duitku bisa mengirim data dalam format JSON atau Form-URL-Encoded
    if (contentType.includes('application/json')) {
      body = await req.json();
    } else {
      const textData = await req.text();
      const params = new URLSearchParams(textData);
      body = Object.fromEntries(params.entries());
    }

    // Ambil data penting dari Duitku
    const { merchantOrderId, resultCode, amount, reference } = body;

    // Jika tidak ada ID pesanan, abaikan
    if (!merchantOrderId) return new NextResponse('OK', { status: 200 });

    // Cek apakah pembayaran berhasil (resultCode '00' atau '0')
    if (resultCode === '00' || resultCode === '0') {
      
      // Bersihkan ID Pesanan (Hanya ambil UUID-nya saja jika ada teks tambahan)
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = merchantOrderId.match(uuidRegex);
      const dbOrderId = match ? match[0] : merchantOrderId.trim();

      // 1. UPDATE DATABASE (Gunakan Admin agar tidak terhalang RLS)
      // Kita set payment_status jadi 'paid' dan status pesanan tetap 'pending' (Menunggu konfirmasi Kasir)
      const { data: order, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid', 
          payment_method: 'duitku',
          notes: `[LUNAS DUITKU: ${reference || 'Online'}]` 
        })
        .eq('id', dbOrderId)
        .select('*, profiles(email, full_name), order_items(*, menu_items(name))')
        .single();

      if (updateError) {
        console.error("Gagal Update Database:", updateError);
        return new NextResponse('Error Update', { status: 500 });
      }

      // 2. KIRIM EMAIL KONFIRMASI & KWITANSI
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
            
            // Generate PDF Kwitansi
            let pdfBase64 = null;
            try {
              const doc = new jsPDF();
              doc.setFontSize(22);
              doc.text("KWITANSI RESTOBOOK", 105, 20, { align: 'center' });
              doc.setFontSize(10);
              doc.text(`ID Pesanan: #${shortId}`, 20, 40);
              doc.text(`Pelanggan: ${customerName}`, 20, 47);
              doc.text(`Status: LUNAS (DUITKU)`, 20, 54);
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

            // Kirim Email Detail
            await resend.emails.send({
              from: 'RestoBook <noreply@restobookid.my.id>',
              to: customerEmail,
              subject: `✅ Pembayaran Berhasil - Pesanan #${shortId}`,
              html: `
                <div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #f0f0f0; border-radius:15px;">
                  <h2 style="color:#111827;">Pembayaran Diterima!</h2>
                  <p>Halo <b>${customerName}</b>, pembayaran Anda untuk pesanan <b>#${shortId}</b> telah kami terima.</p>
                  <p>Status pesanan Anda kini <b>LUNAS</b>. Mohon tunggu konfirmasi dari kasir kami.</p>
                  <div style="background:#f8fafc; padding:20px; border-radius:15px; margin:20px 0;">
                    <table style="width:100%; border-collapse:collapse; font-size:14px;">
                      ${order.order_items?.map((item: any) => `
                        <tr><td style="padding:5px 0;">${item.quantity}x ${item.menu_items?.name}</td><td style="text-align:right;">Rp ${Number(item.subtotal).toLocaleString('id-ID')}</td></tr>
                      `).join('')}
                      <tr><td style="padding-top:10px; font-weight:bold;">Total</td><td style="padding-top:10px; text-align:right; font-weight:bold; color:#f97316;">Rp ${Number(order.total_amount).toLocaleString('id-ID')}</td></tr>
                    </table>
                  </div>
                  <p style="font-size:12px; color:#999; text-align:center;">Kwitansi resmi (PDF) telah kami lampirkan.</p>
                </div>
              `,
              attachments: pdfBase64 ? [{ filename: `Kwitansi-${shortId}.pdf`, content: pdfBase64 }] : []
            });
          }
        }
      }
    }

    // WAJIB Balas 'OK' ke Duitku agar Duitku berhenti mengirim notifikasi ulang
    return new NextResponse('OK', { status: 200 });
  } catch (err: any) {
    console.error("FATAL ERROR CALLBACK:", err);
    return new NextResponse('OK', { status: 200 });
  }
}
