export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { parseUserAgent } from '@/lib/security';

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

    // 3. Find reservation
    const { data: reservation, error: resError } = await supabaseAdmin
      .from('reservations')
      .select('*, profiles:customer_id(*), tables(*)')
      .eq('qr_token', qrToken)
      .maybeSingle();

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

    if (reservation.status === 'cancelled') {
      isValid = false;
      failureReason = 'Reservasi sudah dibatalkan';
    } else if (reservation.status === 'rejected') {
      isValid = false;
      failureReason = 'Reservasi sudah ditolak';
    } else if (reservation.status === 'completed') {
      isValid = false;
      failureReason = 'Reservasi sudah selesai digunakan';
    }

    if (!isValid) {
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
        reservation: {
          id: reservation.id,
          guest_count: reservation.guest_count,
          reservation_date: reservation.reservation_date,
          reservation_time: reservation.reservation_time,
          status: reservation.status,
          customer_name: reservation.profiles?.full_name || 'Pelanggan',
          phone: reservation.profiles?.phone
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
