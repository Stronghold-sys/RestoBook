export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

const MISTRAL_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_reservation",
      description: "Membuat reservasi meja makan baru di restoran RestoBook.",
      parameters: {
        type: "object",
        properties: {
          customer_id: { type: "string", description: "ID Profile pelanggan dari DATA USER AKTIF." },
          atas_nama: { type: "string", description: "Nama lengkap atas nama reservasi." },
          telepon: { type: "string", description: "Nomor telepon kontak reservasi." },
          reservation_date: { type: "string", description: "Tanggal reservasi (YYYY-MM-DD)." },
          reservation_time: { type: "string", description: "Waktu/jam reservasi (HH:MM)." },
          guest_count: { type: "integer", description: "Jumlah tamu/orang." },
          notes: { type: "string", description: "Catatan tambahan khusus." },
          target_email: { type: "string", description: "Email target untuk mengirim konfirmasi. Jika kosong, gunakan email user aktif." }
        },
        required: ["customer_id", "atas_nama", "telepon", "reservation_date", "reservation_time", "guest_count"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cancel_reservation",
      description: "Membatalkan reservasi meja makan yang ada di RestoBook.",
      parameters: {
        type: "object",
        properties: {
          reservation_id: { type: "string", description: "UUID Reservasi yang ingin dibatalkan." },
          target_email: { type: "string", description: "Email target untuk notifikasi pembatalan." }
        },
        required: ["reservation_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_reservation",
      description: "Mengedit/mengubah tanggal, waktu, jumlah tamu, atau catatan reservasi meja makan yang sudah diajukan.",
      parameters: {
        type: "object",
        properties: {
          reservation_id: { type: "string", description: "UUID Reservasi yang ingin diubah." },
          reservation_date: { type: "string", description: "Tanggal baru (YYYY-MM-DD)." },
          reservation_time: { type: "string", description: "Waktu/jam baru (HH:MM)." },
          guest_count: { type: "integer", description: "Jumlah tamu/orang baru." },
          notes: { type: "string", description: "Catatan tambahan baru." },
          target_email: { type: "string", description: "Email target untuk notifikasi perubahan." }
        },
        required: ["reservation_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_order_details_email",
      description: "Mengirimkan rincian/detail pesanan makanan aktif/selesai ke email tertentu.",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "UUID order/pesanan." },
          target_email: { type: "string", description: "Alamat email penerima rincian pesanan." }
        },
        required: ["order_id", "target_email"]
      }
    }
  }
];

async function executeTool(name: string, args: any) {
  const supabase = getSupabaseAdmin();
  const resendKey = process.env.RESEND_API_KEY;

  if (name === 'create_reservation') {
    const { customer_id, atas_nama, telepon, reservation_date, reservation_time, guest_count, notes, target_email } = args;

    // 1. Cari meja yang tersedia dengan kapasitas mencukupi
    const { data: tables, error: tableErr } = await supabase
      .from('tables')
      .select('*')
      .eq('status', 'available')
      .gte('capacity', guest_count)
      .order('capacity', { ascending: true })
      .order('table_number', { ascending: true });

    if (tableErr || !tables || tables.length === 0) {
      return { success: false, error: `Tidak ada meja kosong dengan kapasitas yang cukup untuk ${guest_count} orang.` };
    }

    const selectedTable = tables[0];

    // 2. Buat structured notes JSON
    const structuredNotes = JSON.stringify({
      atas_nama: atas_nama,
      telepon: telepon,
      meja_tambahan: [selectedTable.table_number],
      meja_ids: [selectedTable.id],
      catatan: notes || ''
    });

    // 3. Masukkan data reservasi
    const { data: reservation, error: insertErr } = await supabase
      .from('reservations')
      .insert({
        customer_id: customer_id,
        table_id: selectedTable.id,
        reservation_date: reservation_date,
        reservation_time: reservation_time,
        guest_count: guest_count,
        notes: structuredNotes,
        status: 'pending'
      })
      .select()
      .single();

    if (insertErr || !reservation) {
      return { success: false, error: 'Gagal menyimpan reservasi ke database: ' + (insertErr?.message || 'Unknown error') };
    }

    // 4. Tambahkan notifikasi
    await supabase.from('notifications').insert({
      user_id: customer_id,
      title: 'Reservasi Baru Diajukan',
      message: `Reservasi atas nama ${atas_nama} pada tanggal ${reservation_date} pukul ${reservation_time} meja ${selectedTable.table_number} sedang menunggu konfirmasi.`,
      type: 'reservation'
    });

    // 5. Kirim email konfirmasi
    let emailToSend = target_email;
    if (!emailToSend) {
      const { data: prof } = await supabase.from('profiles').select('email').eq('id', customer_id).single();
      emailToSend = prof?.email;
    }

    let emailSent = false;
    if (resendKey && emailToSend) {
      try {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: 'RestoBook <noreply@restobookid.my.id>',
          to: emailToSend,
          subject: 'Reservasi Meja RestoBook Berhasil Diajukan! 📅',
          html: `
            <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #ea580c; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Konfirmasi Pengajuan Reservasi</p>
              </div>
              <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
              <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Halo, ${atas_nama}! 👋</h2>
              <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                Reservasi meja Anda di <strong>RestoBook</strong> berhasil diajukan dan sedang menunggu konfirmasi dari kasir/staf kami.
              </p>
              <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 16px; border-radius: 8px; margin: 24px 0;">
                <h3 style="color: #c2410c; margin: 0 0 8px 0; font-size: 14px; font-weight: 700; text-transform: uppercase;">Detail Reservasi</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #9a3412; font-weight: 600; width: 150px;">Atas Nama:</td>
                    <td style="padding: 6px 0; color: #4b5563;">${atas_nama}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #9a3412; font-weight: 600;">Tanggal:</td>
                    <td style="padding: 6px 0; color: #4b5563;">${reservation_date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #9a3412; font-weight: 600;">Waktu:</td>
                    <td style="padding: 6px 0; color: #4b5563;">${reservation_time} WIB</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #9a3412; font-weight: 600;">Jumlah Tamu:</td>
                    <td style="padding: 6px 0; color: #4b5563;">${guest_count} Orang</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #9a3412; font-weight: 600;">Nomor Meja:</td>
                    <td style="padding: 6px 0; color: #4b5563;">Meja ${selectedTable.table_number}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #9a3412; font-weight: 600;">Status:</td>
                    <td style="padding: 6px 0; color: #4b5563;">
                      <span style="background-color: #fef3c7; color: #d97706; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; text-transform: uppercase;">Menunggu Konfirmasi</span>
                    </td>
                  </tr>
                  ${notes ? `
                  <tr>
                    <td style="padding: 6px 0; color: #9a3412; font-weight: 600;">Catatan:</td>
                    <td style="padding: 6px 0; color: #4b5563;">${notes}</td>
                  </tr>` : ''}
                </table>
              </div>
              <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                Kami akan mengirimkan notifikasi/email tambahan segera setelah reservasi Anda dikonfirmasi oleh tim staf kami.
              </p>
              <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
              </p>
            </div>
          `
        });
        emailSent = true;
      } catch (err) {
        console.error('Failed to send reservation email:', err);
      }
    }

    return {
      success: true,
      message: `Reservasi berhasil diajukan atas nama ${atas_nama} pada ${reservation_date} pukul ${reservation_time} untuk ${guest_count} orang.`,
      reservation_id: reservation.id,
      table_number: selectedTable.table_number,
      email_sent: emailSent,
      email_target: emailToSend
    };
  }

  if (name === 'cancel_reservation') {
    const { reservation_id, target_email } = args;

    // 1. Dapatkan info reservasi terlebih dahulu
    const { data: reservation, error: fetchErr } = await supabase
      .from('reservations')
      .select('*, profiles(email, full_name)')
      .eq('id', reservation_id)
      .maybeSingle();

    if (fetchErr || !reservation) {
      return { success: false, error: 'Reservasi tidak ditemukan.' };
    }

    // 2. Batalkan reservasi di database
    const { error: cancelErr } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservation_id);

    if (cancelErr) {
      return { success: false, error: 'Gagal membatalkan reservasi: ' + cancelErr.message };
    }

    // Parse data atas nama
    let atasNama = 'Pelanggan';
    try {
      const parsedNotes = JSON.parse(reservation.notes);
      if (parsedNotes && parsedNotes.atas_nama) {
        atasNama = parsedNotes.atas_nama;
      }
    } catch (e) {
      atasNama = reservation.profiles?.full_name || 'Pelanggan';
    }

    // 3. Tambahkan notifikasi
    if (reservation.customer_id) {
      await supabase.from('notifications').insert({
        user_id: reservation.customer_id,
        title: 'Reservasi Dibatalkan',
        message: `Reservasi atas nama ${atasNama} pada tanggal ${reservation.reservation_date} telah dibatalkan.`,
        type: 'reservation'
      });
    }

    // 4. Kirim email pembatalan
    let emailToSend = target_email || reservation.profiles?.email;
    let emailSent = false;

    if (resendKey && emailToSend) {
      try {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: 'RestoBook <noreply@restobookid.my.id>',
          to: emailToSend,
          subject: 'Pembatalan Reservasi RestoBook ❌',
          html: `
            <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #dc2626; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Pembatalan Reservasi</p>
              </div>
              <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
              <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Halo, ${atasNama}! 👋</h2>
              <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                Reservasi meja Anda di <strong>RestoBook</strong> telah **dibatalkan**.
              </p>
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin: 24px 0;">
                <h3 style="color: #991b1b; margin: 0 0 8px 0; font-size: 14px; font-weight: 700; text-transform: uppercase;">Detail Reservasi Dibatalkan</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #991b1b; font-weight: 600; width: 150px;">Atas Nama:</td>
                    <td style="padding: 6px 0; color: #4b5563;">${atasNama}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #991b1b; font-weight: 600;">Tanggal:</td>
                    <td style="padding: 6px 0; color: #4b5563;">${reservation.reservation_date}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #991b1b; font-weight: 600;">Waktu:</td>
                    <td style="padding: 6px 0; color: #4b5563;">${reservation.reservation_time} WIB</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #991b1b; font-weight: 600;">Status:</td>
                    <td style="padding: 6px 0; color: #4b5563;">
                      <span style="background-color: #fee2e2; color: #b91c1c; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; text-transform: uppercase;">Dibatalkan</span>
                    </td>
                  </tr>
                </table>
              </div>
              <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                Jika Anda tidak bermaksud membatalkan reservasi ini atau ingin melakukan pemesanan ulang, silakan buat reservasi baru di website kami atau hubungi tim kami.
              </p>
              <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
              </p>
            </div>
          `
        });
        emailSent = true;
      } catch (err) {
        console.error('Failed to send cancellation email:', err);
      }
    }

    return {
      success: true,
      message: 'Reservasi berhasil dibatalkan.',
      email_sent: emailSent,
      email_target: emailToSend
    };
  }

  if (name === 'update_reservation') {
    const { reservation_id, reservation_date, reservation_time, guest_count, notes, target_email } = args;

    // 1. Dapatkan info reservasi saat ini
    const { data: reservation, error: fetchErr } = await supabase
      .from('reservations')
      .select('*, profiles(email, full_name)')
      .eq('id', reservation_id)
      .maybeSingle();

    if (fetchErr || !reservation) {
      return { success: false, error: 'Reservasi tidak ditemukan.' };
    }

    // 2. Parse data lama
    let oldAtasNama = 'Pelanggan';
    let oldTelepon = '';
    let oldCatatan = '';
    try {
      const parsedNotes = JSON.parse(reservation.notes);
      if (parsedNotes) {
        oldAtasNama = parsedNotes.atas_nama || oldAtasNama;
        oldTelepon = parsedNotes.telepon || '';
        oldCatatan = parsedNotes.catatan || '';
      }
    } catch (e) {}

    // 3. Bangun nilai baru
    const newDate = reservation_date || reservation.reservation_date;
    const newTime = reservation_time || reservation.reservation_time;
    const newGuestCount = guest_count !== undefined ? guest_count : reservation.guest_count;
    const newCatatan = notes !== undefined ? notes : oldCatatan;

    const newStructuredNotes = JSON.stringify({
      atas_nama: oldAtasNama,
      telepon: oldTelepon,
      meja_tambahan: reservation.notes ? JSON.parse(reservation.notes).meja_tambahan : [],
      meja_ids: reservation.notes ? JSON.parse(reservation.notes).meja_ids : [reservation.table_id],
      catatan: newCatatan
    });

    // 4. Update data di database
    const { error: updateErr } = await supabase
      .from('reservations')
      .update({
        reservation_date: newDate,
        reservation_time: newTime,
        guest_count: newGuestCount,
        notes: newStructuredNotes,
        status: 'pending' // Kembalikan ke pending untuk dikonfirmasi ulang
      })
      .eq('id', reservation_id);

    if (updateErr) {
      return { success: false, error: 'Gagal memperbarui reservasi: ' + updateErr.message };
    }

    // 5. Tambahkan notifikasi
    if (reservation.customer_id) {
      await supabase.from('notifications').insert({
        user_id: reservation.customer_id,
        title: 'Reservasi Diubah',
        message: `Reservasi atas nama ${oldAtasNama} telah diubah ke tanggal ${newDate} pukul ${newTime}. Menunggu konfirmasi ulang.`,
        type: 'reservation'
      });
    }

    // 6. Kirim email perubahan
    let emailToSend = target_email || reservation.profiles?.email;
    let emailSent = false;

    if (resendKey && emailToSend) {
      try {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: 'RestoBook <noreply@restobookid.my.id>',
          to: emailToSend,
          subject: 'Perubahan Detail Reservasi RestoBook 📝',
          html: `
            <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #ea580c; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Perubahan Reservasi</p>
              </div>
              <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
              <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Halo, ${oldAtasNama}! 👋</h2>
              <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                Reservasi meja Anda di <strong>RestoBook</strong> telah berhasil **diperbarui**.
              </p>
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 16px; border-radius: 8px; margin: 24px 0;">
                <h3 style="color: #374151; margin: 0 0 12px 0; font-size: 13px; font-weight: 700; text-transform: uppercase;">Detail Perubahan Reservasi</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 600; width: 150px;">Atas Nama:</td>
                    <td style="padding: 6px 0; color: #111827;">${oldAtasNama}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Tanggal:</td>
                    <td style="padding: 6px 0; color: #111827;">
                      <span style="text-decoration: line-through; color: #9ca3af; margin-right: 8px;">${reservation.reservation_date}</span>
                      <span style="font-weight: 700; color: #111827;">${newDate}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Waktu:</td>
                    <td style="padding: 6px 0; color: #111827;">
                      <span style="text-decoration: line-through; color: #9ca3af; margin-right: 8px;">${reservation.reservation_time}</span>
                      <span style="font-weight: 700; color: #111827;">${newTime} WIB</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Jumlah Tamu:</td>
                    <td style="padding: 6px 0; color: #111827;">
                      <span style="text-decoration: line-through; color: #9ca3af; margin-right: 8px;">${reservation.guest_count}</span>
                      <span style="font-weight: 700; color: #111827;">${newGuestCount} Orang</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Status:</td>
                    <td style="padding: 6px 0; color: #111827;">
                      <span style="background-color: #fef3c7; color: #d97706; padding: 4px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; text-transform: uppercase;">Menunggu Konfirmasi Ulang</span>
                    </td>
                  </tr>
                  ${notes ? `
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-weight: 600;">Catatan Baru:</td>
                    <td style="padding: 6px 0; color: #111827;">${newCatatan}</td>
                  </tr>` : ''}
                </table>
              </div>
              <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                Staf kami akan segera meninjau dan mengonfirmasi ulang perubahan reservasi Anda.
              </p>
              <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
              </p>
            </div>
          `
        });
        emailSent = true;
      } catch (err) {
        console.error('Failed to send update email:', err);
      }
    }

    return {
      success: true,
      message: 'Reservasi berhasil diperbarui.',
      email_sent: emailSent,
      email_target: emailToSend
    };
  }

  if (name === 'send_order_details_email') {
    const { order_id, target_email } = args;

    // 1. Ambil detail pesanan & item
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, profiles(full_name)')
      .eq('id', order_id)
      .maybeSingle();

    if (orderErr || !order) {
      return { success: false, error: 'Pesanan tidak ditemukan.' };
    }

    const { data: items, error: itemsErr } = await supabase
      .from('order_items')
      .select('*, menu_items(name)')
      .eq('order_id', order_id);

    if (itemsErr || !items) {
      return { success: false, error: 'Rincian menu pesanan tidak ditemukan.' };
    }

    // 2. Bangun HTML untuk item pesanan
    const itemsHtml = items.map(item => {
      const name = item.menu_items?.name || 'Menu Tidak Diketahui';
      const quantity = item.quantity;
      const price = item.price;
      const subtotal = item.subtotal;
      return `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 8px 0; color: #111827;">${name}</td>
          <td style="padding: 8px 0; text-align: center; color: #4b5563;">${quantity}</td>
          <td style="padding: 8px 0; text-align: right; color: #4b5563;">Rp ${Number(price).toLocaleString('id-ID')}</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #111827;">Rp ${Number(subtotal).toLocaleString('id-ID')}</td>
        </tr>
      `;
    }).join('');

    // 3. Kirim email struk/rincian pesanan
    let emailSent = false;
    if (resendKey && target_email) {
      try {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: 'RestoBook <noreply@restobookid.my.id>',
          to: target_email,
          subject: `Detail Rincian Pesanan RestoBook #${order_id.substring(0, 8).toUpperCase()} 🍽️`,
          html: `
            <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #ea580c; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Detail Pesanan Makanan</p>
              </div>
              <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
              <h2 style="color: #111827; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">ID Pesanan: #${order_id.substring(0, 8).toUpperCase()}</h2>
              <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                Berikut adalah rincian pesanan Anda di <strong>RestoBook</strong>:
              </p>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
                <thead>
                  <tr style="border-bottom: 2px solid #e5e7eb;">
                    <th style="text-align: left; padding: 8px 0; color: #4b5563;">Menu</th>
                    <th style="text-align: center; padding: 8px 0; color: #4b5563; width: 60px;">Jumlah</th>
                    <th style="text-align: right; padding: 8px 0; color: #4b5563; width: 100px;">Harga</th>
                    <th style="text-align: right; padding: 8px 0; color: #4b5563; width: 120px;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr style="border-top: 2px solid #e5e7eb; font-weight: bold; font-size: 16px;">
                    <td colspan="2" style="padding: 12px 0;">Total Pembayaran</td>
                    <td colspan="2" style="text-align: right; padding: 12px 0; color: #ea580c;">Rp ${Number(order.total_amount).toLocaleString('id-ID')}</td>
                  </tr>
                </tfoot>
              </table>

              <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 24px 0; font-size: 13px; color: #4b5563;">
                <strong>Informasi Tambahan:</strong><br/>
                - Tipe Pesanan: ${order.order_type === 'dine_in' ? 'Makan di Tempat (Dine In)' : 'Bawa Pulang (Takeaway)'}<br/>
                - Status Pembayaran: ${order.payment_status === 'paid' ? 'Lunas (Paid)' : 'Belum Lunas (Unpaid)'}<br/>
                - Metode Pembayaran: ${order.payment_method === 'cash' ? 'Tunai (Cash)' : 'Non-Tunai (Digital/Duitku)'}
              </div>
              
              <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
              </p>
            </div>
          `
        });
        emailSent = true;
      } catch (err) {
        console.error('Failed to send order email:', err);
      }
    }

    return {
      success: true,
      message: 'Rincian pesanan berhasil dikirim ke email.',
      email_sent: emailSent,
      email_target: target_email
    };
  }

  return { success: false, error: 'Unknown tool.' };
}

export async function POST(request: Request) {
  try {
    const { history, systemPrompt, role } = await request.json();

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Mistral API key not configured' }, { status: 500 });
    }

    const mistralMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      }))
    ];

    // 1. Initial call to Mistral with Tools enabled
    let response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-tiny',
        messages: mistralMessages,
        tools: MISTRAL_TOOLS,
        tool_choice: 'auto',
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Mistral API initial error:', errText);
      return NextResponse.json({ error: `API error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;

    let reply = '';

    if (message?.tool_calls && message.tool_calls.length > 0) {
      // 2. Execute the tool calls
      const toolMessages: any[] = [];
      for (const toolCall of message.tool_calls) {
        const name = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        let result;
        try {
          result = await executeTool(name, args);
        } catch (e: any) {
          console.error(`Error executing tool ${name}:`, e);
          result = { success: false, error: e.message || 'Tool execution failed' };
        }

        toolMessages.push({
          role: 'tool',
          name: name,
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      // 3. Request final conversational response from Mistral with the tool outputs
      const secondResponse = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'mistral-tiny',
          messages: [
            ...mistralMessages,
            message,
            ...toolMessages
          ],
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      if (!secondResponse.ok) {
        const errText = await secondResponse.text();
        console.error('Mistral API secondary error:', errText);
        return NextResponse.json({ error: `Secondary API error: ${secondResponse.status}` }, { status: secondResponse.status });
      }

      const secondData = await secondResponse.json();
      reply = secondData.choices?.[0]?.message?.content || 'Maaf, terjadi kesalahan. Silakan coba lagi.';
    } else {
      reply = message?.content || 'Maaf, terjadi kesalahan. Silakan coba lagi.';
    }

    // Server-side sanitizer: strip all markdown formatting from response
    reply = reply
      .replace(/\*{3,}/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      .replace(/#{1,6}\s*/g, '')
      .replace(/^\s*[\*]\s+/gm, '- ')
      .replace(/\*/g, '')
      .trim();

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('RestoBot Proxy Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
