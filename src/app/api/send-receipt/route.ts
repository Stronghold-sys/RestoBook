export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      console.error('[send-receipt] Missing orderId');
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    console.log(`[send-receipt] Processing order: ${orderId}`);

    // 1. Fetch Order + Items
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*, menu_items(name, price))')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('[send-receipt] Order fetch failed:', orderError);
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    console.log(`[send-receipt] Order found. customer_id=${order.customer_id}, payment_status=${order.payment_status}`);

    // 2. Get customer email from profiles
    let targetEmail = '';
    let targetName = 'Pelanggan';

    if (order.customer_id) {
      // Try by id first (PK)
      const { data: p1 } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', order.customer_id)
        .maybeSingle();

      if (p1?.email) {
        targetEmail = p1.email;
        targetName = p1.full_name || targetName;
        console.log(`[send-receipt] Found profile by id: ${targetEmail}`);
      } else {
        // Try by user_id (auth UUID)
        const { data: p2 } = await supabaseAdmin
          .from('profiles')
          .select('email, full_name')
          .eq('user_id', order.customer_id)
          .maybeSingle();

        if (p2?.email) {
          targetEmail = p2.email;
          targetName = p2.full_name || targetName;
          console.log(`[send-receipt] Found profile by user_id: ${targetEmail}`);
        }
      }
    }

    // Fallback: parse from order notes
    if (!targetEmail && order.notes) {
      const m = order.notes.match(/\[EMAIL:\s*(.*?)\]/i);
      if (m?.[1]) targetEmail = m[1].trim();
      const n = order.notes.match(/\[NAMA:\s*(.*?)\]/i);
      if (n?.[1]) targetName = n[1].trim();
    }

    if (!targetEmail || !targetEmail.includes('@') || targetEmail === 'customer@restobook.com') {
      console.warn(`[send-receipt] No valid email for order ${orderId}. Skipping.`);
      return NextResponse.json({ success: true, message: 'No valid email' });
    }

    console.log(`[send-receipt] Target: ${targetEmail} (${targetName})`);

    // 3. Restaurant settings
    const { data: settings } = await supabaseAdmin
      .from('restaurant_settings')
      .select('*')
      .single();

    const restoName = settings?.name || 'RestoBook';
    const restoAddr = settings?.address || '';
    const restoPhone = settings?.phone || '';

    // 4. Build items HTML
    const items = order.order_items || [];
    let itemsHtml = '';
    items.forEach((item: any) => {
      const name = item.menu_items?.name || 'Item';
      const qty = item.quantity;
      const price = Number(item.price || item.menu_items?.price || 0);
      const subtotal = Number(item.subtotal || price * qty);
      itemsHtml += `
        <tr>
          <td style="padding:8px 10px; border-bottom:1px solid #f0f0f0;">${name}</td>
          <td style="padding:8px 10px; border-bottom:1px solid #f0f0f0; text-align:center;">${qty}</td>
          <td style="padding:8px 10px; border-bottom:1px solid #f0f0f0; text-align:right;">Rp ${price.toLocaleString('id-ID')}</td>
          <td style="padding:8px 10px; border-bottom:1px solid #f0f0f0; text-align:right; font-weight:bold;">Rp ${subtotal.toLocaleString('id-ID')}</td>
        </tr>`;
    });

    const totalAmount = Number(order.total_amount);
    const orderId8 = order.id.substring(0, 8).toUpperCase();
    const orderDate = new Date(order.created_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });

    // 5. Send email via Resend (NO PDF - just rich HTML receipt)
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[send-receipt] RESEND_API_KEY is not set!');
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const resend = new Resend(apiKey);

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: `${restoName} <noreply@restobookid.my.id>`,
      to: targetEmail,
      subject: `Kwitansi Pembayaran Lunas - ${restoName} - #${orderId8}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width:600px; margin:0 auto; background:#ffffff;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #ff5722, #e64a19); padding:30px 20px; text-align:center; border-radius:12px 12px 0 0;">
            <h1 style="color:#fff; margin:0; font-size:24px;">${restoName}</h1>
            <p style="color:rgba(255,255,255,0.85); margin:5px 0 0; font-size:13px;">${restoAddr}</p>
            ${restoPhone ? `<p style="color:rgba(255,255,255,0.85); margin:3px 0 0; font-size:12px;">Tel: ${restoPhone}</p>` : ''}
          </div>

          <!-- Body -->
          <div style="padding:25px 20px; border:1px solid #f0f0f0; border-top:none;">
            <div style="background:#e8f5e9; border:1px solid #c8e6c9; border-radius:8px; padding:12px; text-align:center; margin-bottom:20px;">
              <p style="margin:0; color:#2e7d32; font-weight:bold; font-size:16px;">✅ PEMBAYARAN LUNAS</p>
            </div>

            <p style="color:#333; font-size:14px;">Halo <strong>${targetName}</strong>,</p>
            <p style="color:#555; font-size:13px; line-height:1.6;">
              Terima kasih atas pesanan Anda di <strong>${restoName}</strong>. Berikut adalah kwitansi resmi Anda:
            </p>

            <!-- Order Info -->
            <table style="width:100%; margin:15px 0; font-size:13px; color:#444;">
              <tr>
                <td style="padding:6px 0; font-weight:bold; width:45%;">No. Pesanan</td>
                <td style="padding:6px 0;">#${orderId8}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; font-weight:bold;">Tanggal</td>
                <td style="padding:6px 0;">${orderDate}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; font-weight:bold;">Tipe</td>
                <td style="padding:6px 0; text-transform:capitalize;">${order.order_type?.replace('_', ' ') || '-'}</td>
              </tr>
              <tr>
                <td style="padding:6px 0; font-weight:bold;">Pembayaran</td>
                <td style="padding:6px 0; text-transform:uppercase;">${order.payment_method || '-'}</td>
              </tr>
            </table>

            <!-- Items Table -->
            <table style="width:100%; border-collapse:collapse; margin:15px 0; font-size:13px;">
              <thead>
                <tr style="background:#f5f5f5;">
                  <th style="padding:10px; text-align:left; border-bottom:2px solid #ff5722;">Item</th>
                  <th style="padding:10px; text-align:center; border-bottom:2px solid #ff5722;">Qty</th>
                  <th style="padding:10px; text-align:right; border-bottom:2px solid #ff5722;">Harga</th>
                  <th style="padding:10px; text-align:right; border-bottom:2px solid #ff5722;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <!-- Total -->
            <div style="background:#fff5f2; border:2px solid #ff5722; border-radius:8px; padding:15px; text-align:right; margin:15px 0;">
              <span style="font-size:14px; color:#333;">TOTAL: </span>
              <span style="font-size:22px; font-weight:bold; color:#ff5722;">Rp ${totalAmount.toLocaleString('id-ID')}</span>
            </div>

            <p style="font-size:12px; color:#888; margin-top:20px; line-height:1.5;">
              Kwitansi ini dikirim secara otomatis oleh sistem setelah pembayaran Anda dikonfirmasi. 
              Simpan email ini sebagai bukti pembayaran resmi Anda.
            </p>
          </div>

          <!-- Footer -->
          <div style="background:#fafafa; padding:15px 20px; text-align:center; border-radius:0 0 12px 12px; border:1px solid #f0f0f0; border-top:none;">
            <p style="margin:0; font-size:11px; color:#aaa;">
              &copy; ${new Date().getFullYear()} ${restoName} &mdash; Powered by RestoBook
            </p>
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error('[send-receipt] Resend error:', JSON.stringify(emailError));
      return NextResponse.json({ error: 'Failed to send email', details: emailError }, { status: 500 });
    }

    console.log(`[send-receipt] SUCCESS! Email sent to ${targetEmail}, resendId=${emailResult?.id}`);
    return NextResponse.json({ success: true, resendId: emailResult?.id });

  } catch (error: any) {
    console.error('[send-receipt] FATAL:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
}
