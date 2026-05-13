import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function sendReceiptEmail(orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[sendReceiptEmail] Start for order: ${orderId}`);

    // 1. Fetch Order + Items
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*, order_items(*, menu_items(name, price))')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('[sendReceiptEmail] Order fetch failed:', orderError);
      return { success: false, error: 'Order not found' };
    }

    // 2. Get customer email from profiles
    let targetEmail = '';
    let targetName = 'Pelanggan';

    if (order.customer_id) {
      // Step 1: Resolve the profile using customer_id (which is actually profile.id)
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, user_id, email, full_name')
        .eq('id', order.customer_id)
        .maybeSingle();

      // If we couldn't find it by id, maybe customer_id IS the user_id (fallback for old orders)
      const resolvedUserId = profile?.user_id || order.customer_id;
      
      if (profile) {
        if (profile.full_name) targetName = profile.full_name;
        // Fallback email from profile if auth fails later
        if (profile.email) targetEmail = profile.email;
      }

      // Step 2: Always try to get the FRESH email from Supabase Auth!
      if (resolvedUserId) {
        const { data: authData } = await supabaseAdmin.auth.admin.getUserById(resolvedUserId);
        if (authData?.user?.email) {
          targetEmail = authData.user.email;
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
      console.warn(`[sendReceiptEmail] No valid email for order ${orderId}`);
      return { success: false, error: 'No valid email' };
    }

    console.log(`[sendReceiptEmail] Target: ${targetEmail} (${targetName})`);

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

    // 5. Generate PDF (DISABLED - Causes silent isolate crash on Cloudflare Edge)
    let pdfBase64 = '';
    
    // 6. Send via Resend
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[sendReceiptEmail] RESEND_API_KEY not set');
      return { success: false, error: 'Email service not configured' };
    }

    const resend = new Resend(apiKey);

    // Format payment method text
    let displayPayment = 'NON TUNAI';
    if (order.payment_method?.toLowerCase() === 'cash') {
      displayPayment = 'TUNAI';
    }

    const emailPayload: any = {
      from: 'RestoBook <noreply@restobookid.my.id>',
      to: targetEmail,
      subject: `Kwitansi Pembayaran Lunas - ${restoName} - #${orderId8}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width:600px; margin:0 auto; background:#ffffff;">
          <div style="background: linear-gradient(135deg, #ff5722, #e64a19); padding:30px 20px; text-align:center; border-radius:12px 12px 0 0;">
            <h1 style="color:#fff; margin:0; font-size:24px;">${restoName}</h1>
            <p style="color:rgba(255,255,255,0.85); margin:5px 0 0; font-size:13px;">${restoAddr}</p>
            ${restoPhone ? `<p style="color:rgba(255,255,255,0.85); margin:3px 0 0; font-size:12px;">Tel: ${restoPhone}</p>` : ''}
          </div>
          <div style="padding:25px 20px; border:1px solid #f0f0f0; border-top:none;">
            <div style="background:#e8f5e9; border:1px solid #c8e6c9; border-radius:8px; padding:12px; text-align:center; margin-bottom:20px;">
              <p style="margin:0; color:#2e7d32; font-weight:bold; font-size:16px;">PEMBAYARAN LUNAS</p>
            </div>
            <p style="color:#333; font-size:14px;">Halo <strong>${targetName}</strong>,</p>
            <p style="color:#555; font-size:13px; line-height:1.6;">
              Terima kasih atas pesanan Anda di <strong>${restoName}</strong>. Berikut adalah kwitansi resmi Anda:
            </p>
            <table style="width:100%; margin:15px 0; font-size:13px; color:#444;">
              <tr><td style="padding:6px 0; font-weight:bold; width:45%;">No. Pesanan</td><td style="padding:6px 0;">#${orderId8}</td></tr>
              <tr><td style="padding:6px 0; font-weight:bold;">Tanggal</td><td style="padding:6px 0;">${orderDate}</td></tr>
              <tr><td style="padding:6px 0; font-weight:bold;">Tipe</td><td style="padding:6px 0; text-transform:capitalize;">${order.order_type?.replace('_', ' ') || '-'}</td></tr>
              <tr><td style="padding:6px 0; font-weight:bold;">Pembayaran</td><td style="padding:6px 0; font-weight:bold;">${displayPayment}</td></tr>
            </table>

            <table style="width:100%; border-collapse:collapse; margin:15px 0; font-size:13px;">
              <thead>
                <tr style="background:#f5f5f5;">
                  <th style="padding:10px; text-align:left; border-bottom:2px solid #ff5722;">Item</th>
                  <th style="padding:10px; text-align:center; border-bottom:2px solid #ff5722;">Qty</th>
                  <th style="padding:10px; text-align:right; border-bottom:2px solid #ff5722;">Harga</th>
                  <th style="padding:10px; text-align:right; border-bottom:2px solid #ff5722;">Subtotal</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>

            <div style="background:#fff5f2; border:2px solid #ff5722; border-radius:8px; padding:15px; text-align:right; margin:15px 0;">
              <span style="font-size:14px; color:#333;">TOTAL: </span>
              <span style="font-size:22px; font-weight:bold; color:#ff5722;">Rp ${totalAmount.toLocaleString('id-ID')}</span>
            </div>
            <p style="font-size:12px; color:#888; margin-top:20px; line-height:1.5;">
              Kwitansi ini dikirim secara otomatis setelah pembayaran dikonfirmasi. Simpan email ini sebagai bukti pembayaran resmi Anda.
            </p>
          </div>
          <div style="background:#fafafa; padding:15px 20px; text-align:center; border-radius:0 0 12px 12px; border:1px solid #f0f0f0; border-top:none;">
            <p style="margin:0; font-size:11px; color:#aaa;">&copy; ${new Date().getFullYear()} ${restoName} &mdash; Powered by RestoBook</p>
          </div>
        </div>
      `
    };

    const { data: emailResult, error: emailError } = await resend.emails.send(emailPayload);

    if (emailError) {
      console.error('[sendReceiptEmail] Resend error:', JSON.stringify(emailError));
      return { success: false, error: JSON.stringify(emailError) };
    }

    console.log(`[sendReceiptEmail] SUCCESS → ${targetEmail} (id: ${emailResult?.id})`);
    return { success: true };

  } catch (err: any) {
    console.error('[sendReceiptEmail] FATAL:', err?.message || err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}
