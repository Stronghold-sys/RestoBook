export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

function getParsedNotes(notesStr: string) {
  if (!notesStr) return { atas_nama: "", telepon: "", catatan: "", meja_tambahan: [], meja_ids: [] };
  try {
    const parsed = JSON.parse(notesStr);
    if (parsed && typeof parsed === "object") {
      return {
        ...parsed,
        atas_nama: parsed.atas_nama || "",
        telepon: parsed.telepon || "",
        meja_tambahan: parsed.meja_tambahan || [],
        meja_ids: parsed.meja_ids || [],
        catatan: parsed.catatan || ""
      };
    }
  } catch (e) {}
  return { atas_nama: "", telepon: "", catatan: notesStr, meja_tambahan: [], meja_ids: [] };
}

export async function GET(req: Request) {
  return handleCheckExpiry(req);
}

export async function POST(req: Request) {
  return handleCheckExpiry(req);
}

async function handleCheckExpiry(req: Request) {
  try {
    const origin = new URL(req.url).origin;
    const nowStr = new Date().toISOString();

    // 1. Ambil semua reservasi confirmed yang melewati deadline check-in
    const { data: expiredReservations, error: fetchError } = await supabaseAdmin
      .from('reservations')
      .select('id, table_id, notes, customer_id, reservation_date, reservation_time, guest_count')
      .eq('status', 'confirmed')
      .lt('check_in_deadline', nowStr);

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
    }

    if (!expiredReservations || expiredReservations.length === 0) {
      return NextResponse.json({ success: true, message: 'Tidak ada reservasi yang melewati batas toleransi saat ini.', processedCount: 0 });
    }

    const processedList = [];

    // 2. Batalkan setiap reservasi yang hangus
    for (const res of expiredReservations) {
      const parsedNotes = getParsedNotes(res.notes);
      const tableIds = parsedNotes.meja_ids.length > 0 ? parsedNotes.meja_ids : [res.table_id].filter(Boolean);

      // A. Update status reservasi ke cancelled dan catat alasannya
      const updatedNotes = JSON.stringify({
        ...parsedNotes,
        catatan_batal: "Reservasi hangus karena melebihi batas toleransi check-in. Meja telah dibuka kembali untuk pelanggan lain.",
        dibatalkan_oleh: "sistem"
      });

      const { error: updateResError } = await supabaseAdmin
        .from('reservations')
        .update({
          status: 'cancelled',
          notes: updatedNotes
        })
        .eq('id', res.id);

      if (updateResError) {
        console.error(`Gagal membatalkan reservasi ${res.id}:`, updateResError.message);
        continue;
      }

      // B. Bebaskan status meja-meja ke available
      if (tableIds.length > 0) {
        const { error: tableError } = await supabaseAdmin
          .from('tables')
          .update({ status: 'available' })
          .in('id', tableIds);
        if (tableError) {
          console.error(`Gagal membebaskan meja untuk reservasi ${res.id}:`, tableError.message);
        }
      }

      // C. Kirim Notifikasi Database Real-time
      if (res.customer_id) {
        const customerName = parsedNotes.atas_nama || "Pelanggan";
        await supabaseAdmin.from('notifications').insert({
          user_id: res.customer_id,
          title: "Reservasi Hangus",
          message: `Reservasi atas nama ${customerName} pada tanggal ${res.reservation_date} telah hangus karena melebihi batas toleransi check-in. Meja dibuka kembali.`,
          type: "reservation",
          status_badge: "dibatalkan"
        });
      }

      // D. Catat Audit Log
      await supabaseAdmin.from('audit_logs').insert({
        action: 'reservation_auto_cancelled',
        operator_id: null,
        operator_name: 'Sistem Reservasi (Otomatis)',
        target_id: res.id,
        target_name: 'reservations',
        data_before: { status: 'confirmed' },
        data_after: {
          status: 'cancelled',
          reason: 'Melebihi batas toleransi check-in',
          released_tables: tableIds
        },
        browser: 'System Backend',
        device: 'Edge Runtime API'
      });

      // E. Trigger Sinkronisasi Google Calendar untuk menghapus event
      fetch(`${origin}/api/reservations/sync-calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: res.id, action: 'delete' })
      }).catch(err => {
        console.error(`Gagal memicu sinkronisasi kalender untuk pembatalan ${res.id}:`, err);
      });

      processedList.push(res.id);
    }

    return NextResponse.json({
      success: true,
      message: `${processedList.length} reservasi berhasil dibatalkan secara otomatis karena melewati batas toleransi check-in.`,
      processedCount: processedList.length,
      cancelledIds: processedList
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
