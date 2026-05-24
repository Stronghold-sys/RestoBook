export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  try {
    const { customer_id, warning_message, target_email } = await req.json();

    if (!customer_id || !warning_message) {
      return NextResponse.json({ error: 'Customer ID and warning message are required' }, { status: 400 });
    }

    // Fetch current profile to get warning_count
    const { data: customer, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name, warning_count')
      .eq('id', customer_id)
      .single();

    if (fetchErr || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const currentCount = customer.warning_count || 0;
    const newCount = currentCount + 1;

    // Update warning_count in DB
    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        warning_count: newCount
      })
      .eq('id', customer_id);

    if (updateErr) throw updateErr;

    // Insert notification
    await supabaseAdmin.from('notifications').insert({
      user_id: customer_id,
      title: `Peringatan Akun #${newCount}`,
      message: warning_message,
      type: 'warning'
    });

    const resendKey = process.env.RESEND_API_KEY;
    const emailToSend = target_email || customer.email;
    const name = customer.full_name || 'Pelanggan';

    // Send warning email
    if (resendKey && emailToSend) {
      try {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: 'RestoBook <noreply@restobookid.my.id>',
          to: emailToSend,
          subject: `Peringatan Akun Resmi RestoBook (#${newCount})`,
          html: `
            <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #ea580c; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Peringatan Akun Resmi</p>
              </div>
              <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
              <h2 style="color: #b91c1c; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Halo, ${name}!</h2>
              <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                Kami mengirimkan surat peringatan resmi ke akun Anda. Ini adalah <strong>peringatan ke-${newCount}</strong> yang tercatat dalam sistem kami.
              </p>
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #991b1b;">
                <strong>Pernyataan Peringatan:</strong><br/>
                ${warning_message}
              </div>
              <p style="line-height: 1.6; color: #4b5563; font-size: 14px;">
                Pelanggaran ketentuan layanan lebih lanjut dapat mengakibatkan akun Anda <strong>ditangguhkan sementara</strong> atau <strong>diblokir secara permanen</strong> dari sistem RestoBook. Mohon patuhi aturan penggunaan sistem kami.
              </p>
              <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
              </p>
            </div>
          `
        });
      } catch (err) {
        console.error('Failed to send warning email:', err);
      }
    }

    return NextResponse.json({ success: true, message: `Peringatan #${newCount} berhasil dikirim`, new_count: newCount });
  } catch (error: any) {
    console.error('Send warning error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
