import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

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

    const {
      merchantOrderId,
      resultCode
    } = body;

    if (!merchantOrderId) {
      console.error('CRITICAL: merchantOrderId is missing from callback body');
      return new NextResponse('OK', { status: 200 });
    }

    // Hanya proses jika sukses (00 atau 0)
    if (resultCode === '00' || resultCode === '0') {
      console.log(`Payment SUCCESS for Order: ${merchantOrderId}`);
      
      const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = merchantOrderId.match(uuidRegex);
      const dbOrderId = match ? match[0] : merchantOrderId;
      
      console.log(`Target DB Order ID: ${dbOrderId}`);

      // 1. UPDATE STATUS DI DATABASE
      const { data: updatedOrder, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid', 
          status: 'pending', // Tetap pending agar dikonfirmasi kasir
          payment_method: 'duitku' 
        })
        .eq('id', dbOrderId)
        .select('*, profiles(email, full_name)')
        .single();

      if (updateError) {
        console.error('SUPABASE UPDATE ERROR:', updateError.message);
      } else {
        console.log('Database updated successfully.');
      }

      const order = updatedOrder;

      if (order) {
        try {
          const resendKey = process.env.RESEND_API_KEY;
          if (!resendKey) {
            console.error('CRITICAL: RESEND_API_KEY is missing from environment variables!');
          } else {
            const resend = new Resend(resendKey);
            
            // PRIORITAS EMAIL
            let customerEmail = order.profiles?.email;
            console.log('Email from Profile:', customerEmail);

            if (!customerEmail && order.notes?.includes('[EMAIL:')) {
              customerEmail = order.notes.split('[EMAIL:')[1]?.split(']')[0]?.trim();
              console.log('Email from Notes Fallback:', customerEmail);
            }

            let customerName = order.profiles?.full_name;
            if (!customerName && order.notes?.includes('[NAMA:')) {
              customerName = order.notes.split('[NAMA:')[1]?.split(']')[0]?.trim();
            }
            customerName = customerName || 'Pelanggan';

            if (customerEmail) {
              const shortId = dbOrderId.substring(0, 8).toUpperCase();
              console.log(`Attempting to send success email to: ${customerEmail}`);

              const { data: mailData, error: mailError } = await resend.emails.send({
                from: 'RestoBook <noreply@restobookid.my.id>',
                to: customerEmail,
                subject: `✅ Pembayaran Berhasil - Pesanan #${shortId} Sedang Diverifikasi`,
                html: `
                  <div style="font-family:sans-serif; max-width:600px; margin:0 auto; padding:20px; border:1px solid #f0f0f0; border-radius:15px;">
                    <div style="text-align:center; padding-bottom:20px; border-bottom:2px solid #f97316; margin-bottom:20px;">
                      <h1 style="color:#f97316; margin:0;">RestoBook</h1>
                    </div>
                    <h2 style="color:#111827;">Pembayaran Anda Berhasil!</h2>
                    <p>Halo <b>${customerName}</b>,</p>
                    <p>Terima kasih! Kami telah menerima pembayaran Anda untuk pesanan <b>#${shortId}</b>.</p>
                    <div style="background-color:#f8fafc; padding:15px; border-radius:10px; margin:20px 0;">
                       <p style="margin:0; font-size:14px; color:#64748b;">Langkah Selanjutnya:</p>
                       <p style="margin:5px 0 0 0; font-weight:bold; color:#1e293b;">Mohon tunggu sebentar, Kasir kami sedang memverifikasi pesanan Anda untuk segera diproses di dapur.</p>
                    </div>
                    <div style="text-align:center; margin:30px 0;">
                      <a href="https://restobookid.my.id/customer/orders/${dbOrderId}" style="background:#f97316; color:white; padding:15px 25px; text-decoration:none; border-radius:10px; font-weight:bold;">Pantau Pesanan Anda</a>
                    </div>
                    <hr style="border:none; border-top:1px solid #eee;" />
                    <p style="font-size:12px; color:#999; text-align:center;">RestoBook ID - Solusi Pemesanan Restoran Modern</p>
                  </div>
                `
              });

              if (mailError) {
                console.error('RESEND MAIL ERROR:', mailError);
              } else {
                console.log('Email sent successfully! ID:', mailData?.id);
              }
            } else {
              console.warn('WARNING: No customer email found. Skipping email dispatch.');
            }
          }
        } catch (mailEx) {
          console.error('RESEND EXCEPTION:', mailEx);
        }
      }
    } else {
      console.log(`Payment Pending/Failed. ResultCode: ${resultCode}`);
    }

    console.log('--- DUITKU CALLBACK END ---');
    return new NextResponse('OK', { status: 200 });

  } catch (globalErr: any) {
    console.error('CALLBACK GLOBAL ERROR:', globalErr.message);
    return new NextResponse('OK', { status: 200 });
  }
}
