export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shiftId, adminEmail, adminPassword } = body;

    if (!shiftId) {
      return NextResponse.json({ success: false, error: 'Shift ID wajib disertakan.' }, { status: 400 });
    }

    let authorizedAdminId: string | null = null;
    let authorizedAdminName = 'Sistem/Admin';

    // Jika adminEmail dan adminPassword dikirimkan (dari panel kasir, otorisasi supervisor)
    if (adminEmail && adminPassword) {
      const authClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          }
        }
      );

      const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword
      });

      if (authError || !authData?.user) {
        return NextResponse.json({ success: false, error: 'Email atau password Administrator salah.' }, { status: 401 });
      }

      // Pastikan role-nya adalah admin
      const { data: profile, error: profError } = await supabaseAdmin
        .from('profiles')
        .select('id, role, full_name')
        .eq('user_id', authData.user.id)
        .single();

      if (profError || profile?.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Otorisasi ditolak. Akun Anda tidak memiliki hak akses Administrator.' }, { status: 403 });
      }

      authorizedAdminId = profile.id;
      authorizedAdminName = profile.full_name || 'Admin';
    } else {
      // Jika dipanggil dari dashboard Admin, cek session cookies
      const { createServerClient } = await import('@supabase/ssr');
      const requestCookies = req.cookies;
      
      const client = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return requestCookies.getAll().map(c => ({ name: c.name, value: c.value }));
            },
            setAll(cookiesToSet) {
              // Readonly di Route Handler
            },
          },
        }
      );

      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError || !user) {
        return NextResponse.json({ success: false, error: 'Sesi kedaluwarsa. Silakan masuk kembali.' }, { status: 401 });
      }

      // Pastikan role-nya adalah admin
      const { data: profile, error: profError } = await supabaseAdmin
        .from('profiles')
        .select('id, role, full_name')
        .eq('user_id', user.id)
        .single();

      if (profError || profile?.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Otorisasi ditolak. Anda bukan Administrator.' }, { status: 403 });
      }

      authorizedAdminId = profile.id;
      authorizedAdminName = profile.full_name || 'Admin';
    }

    // 1. Dapatkan info shift sebelum dibuka kembali
    const { data: shift, error: shiftError } = await supabaseAdmin
      .from('shifts')
      .select('*')
      .eq('id', shiftId)
      .single();

    if (shiftError || !shift) {
      return NextResponse.json({ success: false, error: 'Shift tidak ditemukan.' }, { status: 404 });
    }

    if (shift.status !== 'closed') {
      return NextResponse.json({ success: false, error: 'Shift ini tidak dalam status ditutup.' }, { status: 400 });
    }

    // 2. Buka kembali shift: status = 'open', hapus data rekap penutupan
    const { error: updateError } = await supabaseAdmin
      .from('shifts')
      .update({
        status: 'open',
        end_time: null,
        final_cash_system: 0,
        final_cash_actual: null,
        difference: 0,
        total_transactions: 0,
        total_revenue: 0,
        total_cash: 0,
        total_non_cash: 0,
        total_refund: 0,
        total_discount: 0,
        note: null,
        closed_by: null
      })
      .eq('id', shiftId);

    if (updateError) {
      throw updateError;
    }

    // 3. Hapus absensi checkout hari ini untuk user tersebut agar gembok absen masuk/keluar terlepas
    const startOfDayStr = new Date();
    startOfDayStr.setHours(0,0,0,0);

    const { error: deleteError } = await supabaseAdmin
      .from('attendance')
      .delete()
      .eq('user_id', shift.user_id)
      .eq('type', 'check_out')
      .gte('created_at', startOfDayStr.toISOString());

    if (deleteError) {
      console.error('[ReopenShift] Gagal menghapus data absensi keluar:', deleteError.message);
    }

    // 4. Catat Log Audit Reopen Shift
    await createAuditLog('reopen_shift', {
      shiftId: shift.id,
      cashierId: shift.profile_id,
      authorizedBy: authorizedAdminId,
      adminName: authorizedAdminName,
      previousClosedAt: shift.end_time,
      previousDifference: shift.difference
    });

    return NextResponse.json({
      success: true,
      message: `Shift kasir untuk ${shift.cashier_name || 'Kasir'} berhasil dibuka kembali oleh ${authorizedAdminName}.`
    });

  } catch (err: any) {
    console.error('[ReopenShift] Error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Terjadi kesalahan internal.' }, { status: 500 });
  }
}
