export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { jsPDF } from 'jspdf';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId } = body;
    
    if (!orderId) {
      console.error("Missing orderId in request");
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    console.log(`Processing receipt for Order: ${orderId}`);

    // 1. Fetch Order Details with Items and Profile
    // We use a broader select first to ensure we get the data
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*, menu_items(name, price))')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error("Order fetch error:", orderError);
      throw new Error('Order not found');
    }

    // 2. Get Profile explicitly to avoid join issues
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name, user_id')
      .eq('user_id', order.customer_id)
      .single();
    
    const targetEmail = profile?.email;
    if (!targetEmail) {
      console.warn(`No email found for customer: ${order.customer_id}`);
      return NextResponse.json({ success: true, message: 'No email found for this customer' });
    }

    // 3. Fetch Restaurant Settings
    const { data: settings } = await supabaseAdmin.from('restaurant_settings').select('*').single();

    // 4. Generate PDF Receipt using jsPDF
    const doc = new jsPDF({
      unit: 'mm',
      format: [80, 150] // Thermal paper size
    });

    const primaryColor = '#ff5722';
    doc.setFont('courier', 'bold');
    
    // Header
    doc.setTextColor(primaryColor);
    doc.setFontSize(14);
    doc.text(settings?.name || 'RestoBook', 40, 10, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7);
    doc.text(settings?.address || 'Restaurant Address', 40, 15, { align: 'center' });
    doc.text(`Tel: ${settings?.phone || '-'}`, 40, 18, { align: 'center' });
    
    doc.line(5, 22, 75, 22);

    // Info
    doc.setFontSize(8);
    doc.text(`ID: #${order.id.substring(0, 8).toUpperCase()}`, 5, 28);
    doc.text(`Tgl: ${new Date(order.created_at).toLocaleString('id-ID')}`, 5, 32);
    doc.text(`Nama: ${profile?.full_name || 'Pelanggan'}`, 5, 36);
    doc.text(`Tipe: ${order.order_type.toUpperCase()}`, 5, 40);

    doc.line(5, 44, 75, 44);

    // Items
    let y = 50;
    doc.setFontSize(7);
    order.order_items.forEach((item: any) => {
      const name = item.menu_items?.name || 'Item';
      const qty = item.quantity;
      const price = Number(item.price || item.menu_items?.price || 0);
      const subtotal = Number(item.subtotal);

      doc.text(`${name.substring(0, 20)}`, 5, y);
      doc.text(`Rp ${subtotal.toLocaleString('id-ID')}`, 75, y, { align: 'right' });
      doc.text(`${qty}x @ Rp ${price.toLocaleString('id-ID')}`, 5, y + 4);
      y += 10;
    });

    doc.line(5, y, 75, y);
    y += 6;

    // Totals
    doc.setFontSize(9);
    doc.text('TOTAL:', 5, y);
    doc.text(`Rp ${Number(order.total_amount).toLocaleString('id-ID')}`, 75, y, { align: 'right' });
    y += 10;

    doc.setFontSize(10);
    doc.setTextColor(34, 197, 94); // Emerald color
    doc.text('LUNAS', 40, y, { align: 'center' });
    
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(6);
    doc.text('Terima kasih telah berkunjung!', 40, y + 10, { align: 'center' });

    const pdfBase64 = doc.output('datauristring').split(',')[1];

    // 5. Send Email via Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: 'RestoBook <noreply@restobookid.my.id>',
      to: targetEmail,
      subject: `Kwitansi Pesanan #${order.id.substring(0, 8).toUpperCase()} - ${settings?.name || 'RestoBook'}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 12px; background-color: #fdfdfd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #ff5722; margin-bottom: 5px;">${settings?.name || 'RestoBook'}</h1>
            <p style="color: #666; font-size: 14px;">${settings?.address || ''}</p>
          </div>
          
          <div style="background-color: #fff; padding: 20px; border-radius: 8px; border: 1px solid #f0f0f0;">
            <h2 style="color: #333; border-bottom: 2px solid #ff5722; padding-bottom: 10px;">Kwitansi Pembayaran Lunas</h2>
            <p>Halo <strong>${profile?.full_name || 'Pelanggan'}</strong>,</p>
            <p>Terima kasih telah melakukan pemesanan di <strong>${settings?.name || 'RestoBook'}</strong>. Pembayaran Anda telah kami terima dengan detail sebagai berikut:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr style="background-color: #f9f9f9;">
                <td style="padding: 10px; font-weight: bold;">No. Pesanan</td>
                <td style="padding: 10px;">#${order.id.substring(0, 8).toUpperCase()}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold;">Waktu Transaksi</td>
                <td style="padding: 10px;">${new Date(order.created_at).toLocaleString('id-ID')}</td>
              </tr>
              <tr style="background-color: #f9f9f9;">
                <td style="padding: 10px; font-weight: bold;">Tipe Pesanan</td>
                <td style="padding: 10px; text-transform: capitalize;">${order.order_type}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold;">Metode Pembayaran</td>
                <td style="padding: 10px; text-transform: uppercase;">${order.payment_method}</td>
              </tr>
              <tr style="background-color: #fff5f2;">
                <td style="padding: 10px; font-weight: bold; color: #ff5722; font-size: 18px;">TOTAL</td>
                <td style="padding: 10px; font-weight: bold; color: #ff5722; font-size: 18px;">Rp ${Number(order.total_amount).toLocaleString('id-ID')}</td>
              </tr>
            </table>

            <p style="background-color: #e6fffa; color: #234e52; padding: 10px; border-radius: 6px; text-align: center; font-weight: bold;">
              Status: PEMBAYARAN BERHASIL (LUNAS)
            </p>

            <p style="margin-top: 20px; font-size: 13px; color: #666;">
              Kami telah melampirkan file PDF kwitansi resmi untuk arsip Anda. Silakan hubungi kami jika ada pertanyaan mengenai pesanan Anda.
            </p>
          </div>

          <div style="text-align: center; margin-top: 30px; border-top: 1px solid #eee; pt: 20px;">
            <p style="font-size: 12px; color: #999;">
              RestoBook POS System &copy; ${new Date().getFullYear()} - ${settings?.name || 'RestoBook'}
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `Kwitansi_${order.id.substring(0, 8).toUpperCase()}.pdf`,
          content: pdfBase64,
        },
      ],
    });

    if (emailError) {
      console.error("Resend Email Error:", emailError);
      throw emailError;
    }

    console.log(`Receipt email sent successfully to ${targetEmail}`);
    return NextResponse.json({ success: true, message: 'Receipt email sent', resendId: emailData?.id });

  } catch (error: any) {
    console.error('Email Receipt Fatal Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
