export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  try {
    const { action, customer_id, admin_id, reason, message, duration, target_email } = await req.json();

    if (!action || !customer_id) {
      return NextResponse.json({ error: 'Action and Customer ID are required' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;

    // Fetch user profile info first to get current data and email
    const { data: customer, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name, status')
      .eq('id', customer_id)
      .single();

    if (fetchErr || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const emailToSend = target_email || customer.email;
    const name = customer.full_name || 'Pelanggan';

    if (action === 'schedule') {
      const { scheduled_at, suspend_type, reason, message, duration } = await req.json();
      if (!scheduled_at || !reason || !message || !suspend_type) {
        return NextResponse.json({ error: 'Scheduled time, type, reason and message are required' }, { status: 400 });
      }

      const schedDate = new Date(scheduled_at);
      let suspendUntil = null;

      if (suspend_type === 'temporary') {
        suspendUntil = new Date(schedDate.getTime());
        const { years, months, weeks, days, hours, minutes, seconds } = duration || {};
        if (years) suspendUntil.setFullYear(suspendUntil.getFullYear() + Number(years));
        if (months) suspendUntil.setMonth(suspendUntil.getMonth() + Number(months));
        if (weeks) suspendUntil.setDate(suspendUntil.getDate() + Number(weeks) * 7);
        if (days) suspendUntil.setDate(suspendUntil.getDate() + Number(days));
        if (hours) suspendUntil.setHours(suspendUntil.getHours() + Number(hours));
        if (minutes) suspendUntil.setMinutes(suspendUntil.getMinutes() + Number(minutes));
        if (seconds) suspendUntil.setSeconds(suspendUntil.getSeconds() + Number(seconds));
      }

      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({
          scheduled_suspend_at: schedDate.toISOString(),
          suspend_reason: reason,
          suspend_message: message,
          suspend_type,
          suspend_until: suspendUntil ? suspendUntil.toISOString() : null
        })
        .eq('id', customer_id);

      if (updateErr) throw updateErr;

      return NextResponse.json({ success: true, message: 'Penangguhan berhasil dijadwalkan' });
    }

    if (action === 'suspend') {
      if (!reason || !message) {
        return NextResponse.json({ error: 'Reason and message are required for suspend' }, { status: 400 });
      }

      // Calculate suspend_until
      const now = new Date();
      const suspendUntil = new Date(now.getTime());

      const { years, months, weeks, days, hours, minutes, seconds } = duration || {};
      let durationParts: string[] = [];

      if (years) {
        suspendUntil.setFullYear(suspendUntil.getFullYear() + Number(years));
        durationParts.push(`${years} tahun`);
      }
      if (months) {
        suspendUntil.setMonth(suspendUntil.getMonth() + Number(months));
        durationParts.push(`${months} bulan`);
      }
      if (weeks) {
        suspendUntil.setDate(suspendUntil.getDate() + Number(weeks) * 7);
        durationParts.push(`${weeks} minggu`);
      }
      if (days) {
        suspendUntil.setDate(suspendUntil.getDate() + Number(days));
        durationParts.push(`${days} hari`);
      }
      if (hours) {
        suspendUntil.setHours(suspendUntil.getHours() + Number(hours));
        durationParts.push(`${hours} jam`);
      }
      if (minutes) {
        suspendUntil.setMinutes(suspendUntil.getMinutes() + Number(minutes));
        durationParts.push(`${minutes} menit`);
      }
      if (seconds) {
        suspendUntil.setSeconds(suspendUntil.getSeconds() + Number(seconds));
        durationParts.push(`${seconds} detik`);
      }

      const durationStr = durationParts.join(' ') || '1 jam';

      // Update profile status in DB
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({
          status: 'suspended',
          suspend_reason: reason,
          suspend_message: message,
          suspended_at: now.toISOString(),
          suspend_until: suspendUntil.toISOString(),
          suspend_type: 'temporary',
          is_active: false
        })
        .eq('id', customer_id);

      if (updateErr) throw updateErr;

      // Add to suspend_logs
      await supabaseAdmin.from('suspend_logs').insert({
        user_id: customer_id,
        action: 'suspended',
        reason,
        message,
        duration: durationStr,
        suspend_until: suspendUntil.toISOString(),
        acted_by: admin_id || null
      });

      // Send email
      if (resendKey && emailToSend) {
        try {
          const resend = new Resend(resendKey);
          const formattedEnd = suspendUntil.toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            dateStyle: 'medium',
            timeStyle: 'short'
          });
          await resend.emails.send({
            from: 'RestoBook <noreply@restobookid.my.id>',
            to: emailToSend,
            subject: 'Pemberitahuan Penangguhan Akun RestoBook',
            html: `
              <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #ea580c; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Penangguhan Akun Sementara</p>
                </div>
                <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
                <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Halo, ${name}!</h2>
                <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                  Akun RestoBook Anda telah ditangguhkan untuk sementara waktu oleh manajemen kami.
                </p>
                <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 16px; border-radius: 8px; margin: 24px 0;">
                  <h3 style="color: #c2410c; margin: 0 0 8px 0; font-size: 14px; font-weight: 700; text-transform: uppercase;">Detail Penangguhan</h3>
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                      <td style="padding: 6px 0; color: #9a3412; font-weight: 600; width: 150px;">Alasan:</td>
                      <td style="padding: 6px 0; color: #4b5563;">${reason}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #9a3412; font-weight: 600;">Durasi:</td>
                      <td style="padding: 6px 0; color: #4b5563;">${durationStr}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #9a3412; font-weight: 600;">Berakhir Pada:</td>
                      <td style="padding: 6px 0; color: #4b5563;">${formattedEnd} WIB</td>
                    </tr>
                  </table>
                </div>
                <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #4b5563;">
                  <strong>Pesan Manajemen:</strong><br/>
                  ${message}
                </div>
                <p style="line-height: 1.6; color: #4b5563; font-size: 14px;">
                  Anda dapat mengajukan banding terhadap keputusan ini dengan masuk ke akun Anda di halaman login RestoBook dan mengisi formulir banding yang disediakan.
                </p>
                <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
                <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                  Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
                </p>
              </div>
            `
          });
        } catch (err) {
          console.error('Failed to send suspension email:', err);
        }
      }

      return NextResponse.json({ success: true, message: `Akun berhasil ditangguhkan selama ${durationStr}` });
    }

    if (action === 'ban') {
      if (!reason || !message) {
        return NextResponse.json({ error: 'Reason and message are required for ban' }, { status: 400 });
      }

      // Update profile status to banned
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({
          status: 'banned',
          suspend_reason: reason,
          suspend_message: message,
          suspended_at: new Date().toISOString(),
          suspend_until: null,
          suspend_type: 'permanent',
          is_active: false
        })
        .eq('id', customer_id);

      if (updateErr) throw updateErr;

      // Add to suspend_logs
      await supabaseAdmin.from('suspend_logs').insert({
        user_id: customer_id,
        action: 'banned',
        reason,
        message,
        duration: 'Permanen',
        suspend_until: null,
        acted_by: admin_id || null
      });

      // Send email
      if (resendKey && emailToSend) {
        try {
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: 'RestoBook <noreply@restobookid.my.id>',
            to: emailToSend,
            subject: 'Pemberitahuan Pemblokiran Akun RestoBook (Permanen)',
            html: `
              <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #dc2626; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Pemblokiran Akun Permanen</p>
                </div>
                <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
                <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Halo, ${name}!</h2>
                <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                  Kami memberitahukan bahwa akun RestoBook Anda telah diblokir secara permanen dari sistem kami.
                </p>
                <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin: 24px 0;">
                  <h3 style="color: #991b1b; margin: 0 0 8px 0; font-size: 14px; font-weight: 700; text-transform: uppercase;">Detail Pemblokiran</h3>
                  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr>
                      <td style="padding: 6px 0; color: #991b1b; font-weight: 600; width: 150px;">Alasan:</td>
                      <td style="padding: 6px 0; color: #4b5563;">${reason}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #991b1b; font-weight: 600;">Status:</td>
                      <td style="padding: 6px 0; color: #4b5563; font-weight: 700; color: #dc2626;">Banned (Permanen)</td>
                    </tr>
                  </table>
                </div>
                <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #4b5563;">
                  <strong>Pesan Manajemen:</strong><br/>
                  ${message}
                </div>
                <p style="line-height: 1.6; color: #4b5563; font-size: 14px;">
                  Keputusan pemblokiran permanen ini diambil karena pelanggaran ketentuan layanan kami. Anda masih dapat mengajukan banding resmi dengan masuk ke halaman login RestoBook dan mengisi formulir banding.
                </p>
                <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
                <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                  Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
                </p>
              </div>
            `
          });
        } catch (err) {
          console.error('Failed to send ban email:', err);
        }
      }

      return NextResponse.json({ success: true, message: 'Akun berhasil dibanned secara permanen' });
    }

    if (action === 'restore') {
      const { restored_message } = await req.json();

      // Reset all suspend/ban fields in DB
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({
          status: 'active',
          suspend_reason: null,
          suspend_message: null,
          suspended_at: null,
          suspend_until: null,
          suspend_type: null,
          just_restored: true, // Flag once for login message
          is_active: true
        })
        .eq('id', customer_id);

      if (updateErr) throw updateErr;

      // Add to suspend_logs
      await supabaseAdmin.from('suspend_logs').insert({
        user_id: customer_id,
        action: 'restored',
        reason: restored_message || 'Pemulihan akun oleh administrator.',
        message: restored_message || 'Selamat, akun Anda sudah dipulihkan.',
        duration: null,
        suspend_until: null,
        acted_by: admin_id || null
      });

      // Send email
      if (resendKey && emailToSend) {
        try {
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: 'RestoBook <noreply@restobookid.my.id>',
            to: emailToSend,
            subject: 'Akun RestoBook Anda Telah Dipulihkan! 🎉',
            html: `
              <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #ea580c; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Pemulihan Akun Sukses</p>
                </div>
                <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
                <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Selamat, ${name}! 🎉</h2>
                <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                  Akun RestoBook Anda telah resmi dipulihkan oleh manajemen kami. Anda sekarang sudah dapat menggunakan seluruh fitur reservasi dan pemesanan kami kembali secara normal.
                </p>
                ${restored_message ? `
                <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; border-radius: 8px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #166534;">
                  <strong>Pesan Manajemen:</strong><br/>
                  ${restored_message}
                </div>` : ''}
                <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
                <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                  Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
                </p>
              </div>
            `
          });
        } catch (err) {
          console.error('Failed to send restoration email:', err);
        }
      }

      return NextResponse.json({ success: true, message: 'Akun berhasil dipulihkan' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Suspend route error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
