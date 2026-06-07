export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { parseUserAgent } from '@/lib/security';

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

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {}
        }
      }
    );

    // 1. Authenticate user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Check Role (Must be cashier or admin)
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role, full_name')
      .eq('user_id', user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    if (profile.role !== 'cashier' && profile.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Hanya Kasir atau Admin yang diizinkan.' }, { status: 403 });
    }

    const body = await request.json();
    const { qrToken, action, tableId, status: newStatus } = body;

    const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || '';
    const { browser, device } = parseUserAgent(userAgent);

    if (!qrToken) {
      return NextResponse.json({ error: 'QR Token wajib diisi' }, { status: 400 });
    }

    // 3. Find reservation (either by qr_token or fallback to id if UUID is provided)
    let query = supabaseAdmin
      .from('reservations')
      .select('*, profiles:customer_id(*), tables(*)');

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(qrToken)) {
      query = query.eq('id', qrToken);
    } else {
      query = query.eq('qr_token', qrToken);
    }

    const { data: reservation, error: resError } = await query.maybeSingle();

    if (resError) {
      console.error('Scan QR DB error:', resError);
      return NextResponse.json({ error: 'Terjadi kesalahan sistem' }, { status: 500 });
    }

    // If reservation not found
    if (!reservation) {
      // Record failed scan log in history
      await supabaseAdmin.from('qr_scan_history').insert({
        cashier_id: profile.id,
        status: 'failed',
        ip_address: clientIP,
        user_agent: userAgent,
        failure_reason: 'Token tidak terdaftar'
      });

      return NextResponse.json({ error: 'Kode booking QR tidak valid atau tidak terdaftar' }, { status: 404 });
    }

    // 4. Validate reservation status for 'verify' or 'check_in'
    let isValid = true;
    let failureReason = '';
    const parsedNotes = getParsedNotes(reservation.notes);
    const isCancelled = reservation.status === 'cancelled';
    const isAutoCancelled = isCancelled && (parsedNotes.dibatalkan_oleh === 'sistem' || (parsedNotes.catatan_batal && parsedNotes.catatan_batal.includes('hangus')));
    
    // Support override parameter
    const override = body.override === true;

    if (isCancelled) {
      if (profile.role === 'admin' && (isAutoCancelled || isCancelled)) {
        if (override) {
          isValid = true;
        } else {
          isValid = false;
          failureReason = 'Reservasi ini telah dibatalkan/hangus. Silakan gunakan Override (Khusus Admin) untuk check-in.';
        }
      } else {
        isValid = false;
        failureReason = 'Reservasi sudah dibatalkan';
      }
    } else if (reservation.status === 'rejected') {
      isValid = false;
      failureReason = 'Reservasi sudah ditolak';
    } else if (reservation.status === 'completed') {
      isValid = false;
      failureReason = 'Reservasi sudah selesai digunakan';
    } else if (reservation.status === 'arrived' || reservation.status === 'seated') {
      isValid = false;
      failureReason = 'Kode/QR Booking ini sudah melakukan check-in sebelumnya!';
    }

    if (!isValid) {
      const canOverride = profile.role === 'admin' && isCancelled;

      await supabaseAdmin.from('qr_scan_history').insert({
        reservation_id: reservation.id,
        cashier_id: profile.id,
        status: 'failed',
        ip_address: clientIP,
        user_agent: userAgent,
        failure_reason: failureReason
      });

      return NextResponse.json({ 
        error: failureReason,
        canOverride: canOverride,
        reservation: {
          id: reservation.id,
          guest_count: reservation.guest_count,
          reservation_date: reservation.reservation_date,
          reservation_time: reservation.reservation_time,
          status: reservation.status,
          customer_name: parsedNotes.atas_nama || reservation.profiles?.full_name || 'Pelanggan',
          phone: parsedNotes.telepon || reservation.profiles?.phone
        }
      }, { status: 400 });
    }

    // If action is verify, record successful scan and return details
    if (action === 'verify' || !action) {
      // Record scan log
      await supabaseAdmin.from('qr_scan_history').insert({
        reservation_id: reservation.id,
        cashier_id: profile.id,
        status: 'success',
        ip_address: clientIP,
        user_agent: userAgent
      });

      // Get customer's booking history
      const { data: history } = await supabaseAdmin
        .from('reservations')
        .select('*, tables(table_number)')
        .eq('customer_id', reservation.customer_id)
        .neq('id', reservation.id)
        .order('reservation_date', { ascending: false })
        .limit(5);

      return NextResponse.json({
        success: true,
        message: 'QR Code valid',
        reservation: {
          id: reservation.id,
          customer_id: reservation.customer_id,
          customer_name: reservation.profiles?.full_name || 'Pelanggan',
          phone: reservation.profiles?.phone || '-',
          guest_count: reservation.guest_count,
          reservation_date: reservation.reservation_date,
          reservation_time: reservation.reservation_time,
          status: reservation.status,
          notes: reservation.notes,
          qr_token: reservation.qr_token,
          table_id: reservation.table_id,
          table_number: reservation.tables?.table_number,
          checked_in_at: reservation.checked_in_at,
          seated_at: reservation.seated_at
        },
        bookingHistory: (history || []).map((h: any) => ({
          id: h.id,
          date: h.reservation_date,
          time: h.reservation_time,
          guests: h.guest_count,
          status: h.status,
          tableNumber: h.tables?.table_number
        }))
      });
    }

    // If action is check_in / update status
    if (action === 'check_in') {
      const updateFields: any = {
        updated_at: new Date().toISOString()
      };

      if (newStatus) {
        updateFields.status = newStatus;
        if (newStatus === 'arrived') {
          updateFields.checked_in_at = new Date().toISOString();
          updateFields.checked_in_by = profile.id;
        } else if (newStatus === 'seated') {
          updateFields.seated_at = new Date().toISOString();
          updateFields.seated_by = profile.id;
        } else if (newStatus === 'completed') {
          updateFields.completed_at = new Date().toISOString();
        }
      }

      if (tableId) {
        updateFields.table_id = tableId;
      }

      if (override) {
        // Hapus catatan batal/dibatalkan_oleh, set override info
        const updatedNotes = JSON.stringify({
          ...parsedNotes,
          catatan_batal: null,
          dibatalkan_oleh: null,
          override_by_admin: profile.full_name,
          override_at: new Date().toISOString()
        });
        updateFields.notes = updatedNotes;
        
        // Kunci meja kembali
        const tableIds = parsedNotes.meja_ids.length > 0 ? parsedNotes.meja_ids : [reservation.table_id].filter(Boolean);
        if (tableIds.length > 0) {
          await supabaseAdmin
            .from('tables')
            .update({ status: 'reserved' })
            .in('id', tableIds);
        }

        // Catat Audit Log
        await supabaseAdmin.from('audit_logs').insert({
          action: 'admin_override_check_in',
          operator_id: profile.id,
          operator_name: profile.full_name,
          target_id: reservation.id,
          target_name: 'reservations',
          data_before: { status: reservation.status },
          data_after: { status: newStatus || 'arrived', override: true, notes: updatedNotes },
          browser,
          device
        });
      }

      const { error: updateErr } = await supabaseAdmin
        .from('reservations')
        .update(updateFields)
        .eq('id', reservation.id);

      if (updateErr) throw updateErr;

      // Log Security/Activity log
      await supabaseAdmin.from('security_logs').insert({
        user_id: user.id,
        ip_address: clientIP,
        browser,
        device,
        user_agent: userAgent,
        activity: `CASHIER_CHECKIN_RESERVATION_${(newStatus || 'UPDATED').toUpperCase()}`,
        endpoint: '/api/cashier/scan-qr',
        status: 'success'
      });

      // Send realtime notification to customer
      const friendlyStatus: Record<string, string> = {
        arrived: 'Telah Tiba di Restoran',
        seated: 'Telah Menempati Meja',
        completed: 'Selesai',
        cancelled: 'Dibatalkan'
      };

      await supabaseAdmin.from('notifications').insert({
        user_id: reservation.customer_id,
        title: 'Status Reservasi Diperbarui',
        message: `Status reservasi Anda pada ${reservation.reservation_date} telah diubah menjadi: ${friendlyStatus[newStatus] || newStatus} oleh kasir ${profile.full_name}.`,
        type: 'reservation',
        status_badge: newStatus
      });

      return NextResponse.json({
        success: true,
        message: `Check-in berhasil. Status diperbarui menjadi ${newStatus || 'terupdate'}`
      });
    }

    return NextResponse.json({ error: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('Scan QR POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
