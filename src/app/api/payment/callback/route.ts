import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

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

    const { merchantOrderId, resultCode } = body;

    // Hanya proses jika pembayaran Sukses (00 atau 0)
    if (resultCode === '00' || resultCode === '0') {
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = merchantOrderId.match(uuidRegex);
      const dbOrderId = match ? match[0] : merchantOrderId;

      // 1. Update Status
      const { data: order } = await supabaseAdmin
        .from('orders')
        .update({ payment_status: 'paid', status: 'pending', payment_method: 'duitku' })
        .eq('id', dbOrderId)
        .select('*, profiles(email, full_name)')
        .single();

      // 2. Kirim Email (Pastikan API Key & Domain Aktif di Resend.com)
      if (order) {
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey) {
          const resend = new Resend(resendKey);
          
          let customerEmail = order.profiles?.email;
          if (!customerEmail && order.notes?.includes('[EMAIL:')) {
            customerEmail = order.notes.split('[EMAIL:')[1]?.split(']')[0]?.trim();
          }

          if (customerEmail) {
            await resend.emails.send({
              from: 'RestoBook <noreply@restobookid.my.id>',
              to: customerEmail,
              subject: `✅ Pembayaran Berhasil - #${dbOrderId.substring(0, 8).toUpperCase()}`,
              html: `
                <div style="font-family:sans-serif; padding:20px;">
                  <h2 style="color:#f97316;">Pembayaran Berhasil!</h2>
                  <p>Halo, pembayaran Anda untuk pesanan <b>#${dbOrderId.substring(0, 8).toUpperCase()}</b> telah kami terima.</p>
                  <p>Mohon tunggu konfirmasi dari kasir kami untuk memproses pesanan Anda.</p>
                  <br/>
                  <a href="https://restobookid.my.id/customer/orders/${dbOrderId}" style="background:#f97316; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">Lihat Pesanan</a>
                </div>
              `
            });
          }
        }
      }
    }

    return new NextResponse('OK', { status: 200 });
  } catch (err) {
    return new NextResponse('OK', { status: 200 });
  }
}
