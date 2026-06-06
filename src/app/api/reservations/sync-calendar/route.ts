export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createGoogleEvent, updateGoogleEvent, deleteGoogleEvent } from '@/lib/googleCalendar';

export async function POST(req: Request) {
  try {
    const { reservationId, action, googleEventId } = await req.json();

    if (!reservationId && !googleEventId) {
      return NextResponse.json({ success: false, error: 'reservationId atau googleEventId wajib disediakan.' }, { status: 400 });
    }

    if (!['create', 'update', 'delete'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Aksi tidak valid (hanya create, update, delete).' }, { status: 400 });
    }

    // 1. Dapatkan detail reservasi jika dibutuhkan
    let reservation: any = null;
    if (reservationId) {
      const { data, error } = await supabaseAdmin
        .from('reservations')
        .select('*, profiles(full_name, phone)')
        .eq('id', reservationId)
        .maybeSingle();

      if (error) {
        return NextResponse.json({ success: false, error: `Gagal membaca reservasi: ${error.message}` }, { status: 500 });
      }
      reservation = data;
    }

    // Jika statusnya 'delete' dan tidak ada record di DB, pastikan googleEventId disediakan
    const targetEventId = googleEventId || reservation?.google_event_id;

    if (action === 'delete') {
      if (!targetEventId) {
        return NextResponse.json({ success: true, message: 'Tidak ada Google Event ID yang terasosiasi untuk dihapus.' });
      }

      try {
        await deleteGoogleEvent(targetEventId);
        if (reservationId) {
          await supabaseAdmin
            .from('reservations')
            .update({
              sync_status: 'cancelled',
              sync_error: null
            })
            .eq('id', reservationId);
        }
        return NextResponse.json({ success: true, message: 'Event berhasil dihapus dari Google Calendar.' });
      } catch (err: any) {
        if (reservationId) {
          await supabaseAdmin
            .from('reservations')
            .update({
              sync_status: 'failed',
              sync_error: `Delete failed: ${err.message}`
            })
            .eq('id', reservationId);
        }
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    // Untuk 'create' dan 'update', reservasi wajib ada
    if (!reservation) {
      return NextResponse.json({ success: false, error: 'Reservasi tidak ditemukan di database.' }, { status: 404 });
    }

    // Parse JSON dari notes jika ada
    let parsedNotes: any = null;
    if (reservation.notes) {
      try {
        parsedNotes = JSON.parse(reservation.notes);
      } catch (e) {
        // Jika bukan JSON valid, biarkan null
      }
    }

    // Tentukan catatan bersih agar tidak mengirimkan JSON mentah ke Google Calendar
    let displayNotes = '-';
    if (parsedNotes) {
      if (typeof parsedNotes.catatan === 'string') {
        displayNotes = parsedNotes.catatan.trim() || '-';
      } else if (typeof parsedNotes.notes === 'string') {
        displayNotes = parsedNotes.notes.trim() || '-';
      }
    } else if (reservation.notes && !reservation.notes.trim().startsWith('{')) {
      displayNotes = reservation.notes.trim();
    }

    const eventData = {
      atas_nama: parsedNotes?.atas_nama || reservation.profiles?.full_name || 'Guest',
      telepon: parsedNotes?.telepon || reservation.profiles?.phone || '-',
      reservation_date: reservation.reservation_date,
      reservation_time: reservation.reservation_time,
      guest_count: reservation.guest_count,
      notes: displayNotes
    };

    if (action === 'create') {
      try {
        const newEventId = await createGoogleEvent(eventData);
        await supabaseAdmin
          .from('reservations')
          .update({
            google_event_id: newEventId,
            sync_status: 'synced',
            sync_error: null
          })
          .eq('id', reservationId);

        return NextResponse.json({ success: true, googleEventId: newEventId });
      } catch (err: any) {
        await supabaseAdmin
          .from('reservations')
          .update({
            sync_status: 'failed',
            sync_error: `Create failed: ${err.message}`
          })
          .eq('id', reservationId);

        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    if (action === 'update') {
      try {
        let finalEventId = targetEventId;
        if (finalEventId) {
          await updateGoogleEvent(finalEventId, eventData);
        } else {
          // Jika sebelumnya gagal sync / belum punya event ID, buat baru
          finalEventId = await createGoogleEvent(eventData);
        }

        await supabaseAdmin
          .from('reservations')
          .update({
            google_event_id: finalEventId,
            sync_status: 'synced',
            sync_error: null
          })
          .eq('id', reservationId);

        return NextResponse.json({ success: true, googleEventId: finalEventId });
      } catch (err: any) {
        await supabaseAdmin
          .from('reservations')
          .update({
            sync_status: 'failed',
            sync_error: `Update failed: ${err.message}`
          })
          .eq('id', reservationId);

        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: false, error: 'Aksi tidak dikenal.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
