export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  try {
    const { action, customer_ids, admin_id, reason, message, duration } = await req.json();

    if (!action || !customer_ids || !Array.isArray(customer_ids) || customer_ids.length === 0) {
      return NextResponse.json({ error: 'Action and an array of Customer IDs are required' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const now = new Date();

    // 1. Fetch all profiles upfront
    const { data: customers, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name, user_id, id')
      .in('id', customer_ids);

    if (fetchErr) throw fetchErr;
    if (!customers || customers.length === 0) {
      return NextResponse.json({ error: 'No customers found' }, { status: 404 });
    }

    const profileIds = customers.map((c: any) => c.id);

    // 2. Perform actions in batch
    if (action === 'delete') {
      // Delete related records in bulk (exactly 1 subrequest per table)
      await supabaseAdmin.from('reward_redemptions').delete().in('customer_id', profileIds);
      await supabaseAdmin.from('point_transactions').delete().in('customer_id', profileIds);
      await supabaseAdmin.from('customer_vouchers').delete().in('customer_id', profileIds);
      await supabaseAdmin.from('wallet_activation_logs').delete().in('profile_id', profileIds);
      await supabaseAdmin.from('wallet_activations').delete().in('profile_id', profileIds);
      await supabaseAdmin.from('wallet_audit_logs').delete().in('customer_id', profileIds);

      // Support tickets & ticket messages
      const { data: tickets } = await supabaseAdmin
        .from('support_tickets')
        .select('id')
        .in('customer_id', profileIds);
      
      if (tickets && tickets.length > 0) {
        const ticketIds = tickets.map((t: any) => t.id);
        await supabaseAdmin.from('ticket_messages').delete().in('ticket_id', ticketIds);
      }
      await supabaseAdmin.from('ticket_messages').delete().in('sender_id', profileIds);
      await supabaseAdmin.from('support_tickets').delete().in('customer_id', profileIds);

      // Orders & chats
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('id')
        .in('customer_id', profileIds);

      if (orders && orders.length > 0) {
        const orderIds = orders.map((o: any) => o.id);
        
        const { data: orderChats } = await supabaseAdmin
          .from('order_chats')
          .select('id')
          .in('order_id', orderIds);

        if (orderChats && orderChats.length > 0) {
          const chatIds = orderChats.map((c: any) => c.id);
          await supabaseAdmin.from('order_chat_messages').delete().in('chat_id', chatIds);
        }
        
        await supabaseAdmin.from('order_chat_messages').delete().in('sender_id', profileIds);
        await supabaseAdmin.from('order_chats').delete().in('order_id', orderIds);
        await supabaseAdmin.from('order_items').delete().in('order_id', orderIds);
      }
      
      await supabaseAdmin.from('order_chats').delete().in('customer_id', profileIds);
      await supabaseAdmin.from('orders').delete().in('customer_id', profileIds);

      // Other tables
      await supabaseAdmin.from('reviews').delete().in('customer_id', profileIds);
      await supabaseAdmin.from('wallet_transactions').delete().in('customer_id', profileIds);
      await supabaseAdmin.from('suspend_logs').delete().in('user_id', profileIds);
      await supabaseAdmin.from('appeals').delete().in('user_id', profileIds);
      await supabaseAdmin.from('security_user_sessions').delete().in('profile_id', profileIds);
      await supabaseAdmin.from('reservations').delete().in('customer_id', profileIds);
      await supabaseAdmin.from('favorites').delete().in('customer_id', profileIds);
      await supabaseAdmin.from('notifications').delete().in('user_id', profileIds);

      // Update cashier_id on orders
      await supabaseAdmin.from('orders').update({ cashier_id: null }).in('cashier_id', profileIds);

      // 3. Send farewell emails in parallel
      if (resendKey) {
        const resend = new Resend(resendKey);
        const deletionTime = new Date().toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta',
          dateStyle: 'full',
          timeStyle: 'short'
        });

        await Promise.all(
          customers.map(async (customer: any) => {
            if (!customer.email) return;
            try {
              const name = customer.full_name || 'Pelanggan';
              await resend.emails.send({
                from: 'RestoBook <noreply@restobookid.my.id>',
                to: customer.email,
                subject: 'Akun Anda Telah Dihapus — Sampai Jumpa Lagi 😭',
                html: `
                  <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
                    <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-bottom: 12px;">Sampai Jumpa, ${name}!</h2>
                    <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                      Akun RestoBook Anda telah dihapus secara permanen dari sistem kami oleh administrator.
                    </p>
                    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin: 24px 0; font-size: 14px;">
                      <strong>Detail Penghapusan:</strong><br/>
                      Email: ${customer.email}<br/>
                      Waktu: ${deletionTime} WIB
                    </div>
                    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
                    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                      Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
                    </p>
                  </div>
                `
              });
            } catch (emailErr) {
              console.error('Farewell email error in bulk:', emailErr);
            }
          })
        );
      }

      // 4. Delete Auth users
      const results = await Promise.all(
        customers.map(async (c: any) => {
          try {
            if (c.user_id) {
              const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(c.user_id);
              if (authError) throw authError;
            }
            return { id: c.id, success: true };
          } catch (err: any) {
            console.error(`Auth deletion error for user ${c.id}:`, err);
            return { id: c.id, success: false, error: err.message || 'Unknown error' };
          }
        })
      );

      const failures = results.filter(r => !r.success);
      if (failures.length > 0) {
        const errorMsg = failures.map(f => `${f.id}: ${f.error}`).join(', ');
        return NextResponse.json({
          success: false,
          error: `Gagal menghapus beberapa pelanggan: ${errorMsg}`,
          results
        }, { status: 400 });
      }

      return NextResponse.json({ success: true, results });
    }

    if (action === 'suspend') {
      const suspendUntil = new Date(now.getTime());
      const { years, months, weeks, days, hours, minutes, seconds } = duration || {};
      let durationParts: string[] = [];

      if (years) { suspendUntil.setFullYear(suspendUntil.getFullYear() + Number(years)); durationParts.push(`${years} tahun`); }
      if (months) { suspendUntil.setMonth(suspendUntil.getMonth() + Number(months)); durationParts.push(`${months} bulan`); }
      if (weeks) { suspendUntil.setDate(suspendUntil.getDate() + Number(weeks) * 7); durationParts.push(`${weeks} minggu`); }
      if (days) { suspendUntil.setDate(suspendUntil.getDate() + Number(days)); durationParts.push(`${days} hari`); }
      if (hours) { suspendUntil.setHours(suspendUntil.getHours() + Number(hours)); durationParts.push(`${hours} jam`); }
      if (minutes) { suspendUntil.setMinutes(suspendUntil.getMinutes() + Number(minutes)); durationParts.push(`${minutes} menit`); }
      if (seconds) { suspendUntil.setSeconds(suspendUntil.getSeconds() + Number(seconds)); durationParts.push(`${seconds} detik`); }

      const durationStr = durationParts.join(' ') || '1 jam';

      // Update profiles in bulk
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
        .in('id', profileIds);

      if (updateErr) throw updateErr;

      // Insert suspend logs in bulk
      const logs = profileIds.map((id: string) => ({
        user_id: id,
        action: 'suspended',
        reason,
        message,
        duration: durationStr,
        suspend_until: suspendUntil.toISOString(),
        acted_by: admin_id || null
      }));

      const { error: logErr } = await supabaseAdmin.from('suspend_logs').insert(logs);
      if (logErr) throw logErr;

      // Send Email in parallel
      if (resendKey) {
        const resend = new Resend(resendKey);
        const formattedEnd = suspendUntil.toLocaleString('id-ID', {
          timeZone: 'Asia/Jakarta',
          dateStyle: 'medium',
          timeStyle: 'short'
        });

        await Promise.all(
          customers.map(async (customer: any) => {
            if (!customer.email) return;
            try {
              const name = customer.full_name || 'Pelanggan';
              await resend.emails.send({
                from: 'RestoBook <noreply@restobookid.my.id>',
                to: customer.email,
                subject: 'Pemberitahuan Penangguhan Akun RestoBook',
                html: `
                  <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 24px;">
                      <h1 style="color: #ea580c; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                      <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Penangguhan Akun Sementara (Aksi Massal)</p>
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
                    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
                    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                      Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
                    </p>
                  </div>
                `
              });
            } catch (e) {
              console.error('Failed to send suspension email in bulk:', e);
            }
          })
        );
      }

      return NextResponse.json({ success: true, results: profileIds.map((id: string) => ({ id, success: true })) });
    }

    if (action === 'ban') {
      // Update profiles in bulk
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({
          status: 'banned',
          suspend_reason: reason,
          suspend_message: message,
          suspended_at: now.toISOString(),
          suspend_until: null,
          suspend_type: 'permanent',
          is_active: false
        })
        .in('id', profileIds);

      if (updateErr) throw updateErr;

      // Insert suspend logs in bulk
      const logs = profileIds.map((id: string) => ({
        user_id: id,
        action: 'banned',
        reason,
        message,
        duration: 'Permanen',
        suspend_until: null,
        acted_by: admin_id || null
      }));

      const { error: logErr } = await supabaseAdmin.from('suspend_logs').insert(logs);
      if (logErr) throw logErr;

      // Send Email in parallel
      if (resendKey) {
        const resend = new Resend(resendKey);
        await Promise.all(
          customers.map(async (customer: any) => {
            if (!customer.email) return;
            try {
              const name = customer.full_name || 'Pelanggan';
              await resend.emails.send({
                from: 'RestoBook <noreply@restobookid.my.id>',
                to: customer.email,
                subject: 'Pemberitahuan Pemblokiran Akun RestoBook (Permanen)',
                html: `
                  <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 24px;">
                      <h1 style="color: #dc2626; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                      <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Pemblokiran Akun Permanen (Aksi Massal)</p>
                    </div>
                    <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
                    <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Halo, ${name}!</h2>
                    <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                      Akun RestoBook Anda telah diblokir secara permanen dari sistem kami.
                    </p>
                    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin: 24px 0;">
                      <h3 style="color: #991b1b; margin: 0 0 8px 0; font-size: 14px; font-weight: 700; text-transform: uppercase;">Detail Pemblokiran</h3>
                      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr>
                          <td style="padding: 6px 0; color: #991b1b; font-weight: 600; width: 150px;">Alasan:</td>
                          <td style="padding: 6px 0; color: #4b5563;">${reason}</td>
                        </tr>
                      </table>
                    </div>
                    <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #4b5563;">
                      <strong>Pesan Manajemen:</strong><br/>
                      ${message}
                    </div>
                    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
                    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                      Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
                    </p>
                  </div>
                `
              });
            } catch (e) {
              console.error('Failed to send ban email in bulk:', e);
            }
          })
        );
      }

      return NextResponse.json({ success: true, results: profileIds.map((id: string) => ({ id, success: true })) });
    }

    if (action === 'restore') {
      // Update profiles in bulk
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({
          status: 'active',
          suspend_reason: null,
          suspend_message: null,
          suspended_at: null,
          suspend_until: null,
          suspend_type: null,
          just_restored: true,
          is_active: true
        })
        .in('id', profileIds);

      if (updateErr) throw updateErr;

      // Insert suspend logs in bulk
      const logs = profileIds.map((id: string) => ({
        user_id: id,
        action: 'restored',
        reason: 'Pemulihan akun massal oleh administrator.',
        message: 'Akun Anda sudah diaktifkan kembali.',
        duration: null,
        suspend_until: null,
        acted_by: admin_id || null
      }));

      const { error: logErr } = await supabaseAdmin.from('suspend_logs').insert(logs);
      if (logErr) throw logErr;

      // Send Email in parallel
      if (resendKey) {
        const resend = new Resend(resendKey);
        await Promise.all(
          customers.map(async (customer: any) => {
            if (!customer.email) return;
            try {
              const name = customer.full_name || 'Pelanggan';
              await resend.emails.send({
                from: 'RestoBook <noreply@restobookid.my.id>',
                to: customer.email,
                subject: 'Akun RestoBook Anda Telah Dipulihkan',
                html: `
                  <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 24px;">
                      <h1 style="color: #ea580c; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                      <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Pemulihan Akun Sukses (Aksi Massal)</p>
                    </div>
                    <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
                    <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Selamat, ${name}!</h2>
                    <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                      Akun RestoBook Anda telah resmi dipulihkan oleh administrator. Anda sekarang sudah dapat mengakses kembali seluruh fitur kami secara normal.
                    </p>
                    <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
                    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                      Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
                    </p>
                  </div>
                `
              });
            } catch (e) {
              console.error('Failed to send restoration email in bulk:', e);
            }
          })
        );
      }

      return NextResponse.json({ success: true, results: profileIds.map((id: string) => ({ id, success: true })) });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Bulk action customer error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
