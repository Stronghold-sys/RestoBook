export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const { data: vouchers, error } = await supabaseAdmin
      .from('vouchers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, vouchers });
  } catch (error: any) {
    console.error('Fetch vouchers error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, discount_percent, usage_limit, max_usage_per_user, expires_at, is_active } = body;

    if (!code || !discount_percent || !expires_at) {
      return NextResponse.json({ error: 'Kode, persen diskon, dan tanggal kedaluwarsa harus diisi' }, { status: 400 });
    }

    const { data: voucher, error } = await supabaseAdmin
      .from('vouchers')
      .insert({
        code: code.toUpperCase().trim(),
        discount_percent: Number(discount_percent),
        usage_limit: usage_limit ? Number(usage_limit) : 100,
        max_usage_per_user: max_usage_per_user ? Number(max_usage_per_user) : 1,
        expires_at,
        is_active: is_active !== undefined ? is_active : true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Kode voucher sudah terdaftar' }, { status: 400 });
      }
      throw error;
    }

    // Auto-distribute if the voucher is created active
    if (voucher.is_active) {
      try {
        const { data: customers, error: customersError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('role', 'customer');

        if (!customersError && customers && customers.length > 0) {
          const inserts = customers.map((c: any) => ({
            customer_id: c.id,
            voucher_id: voucher.id,
            used_count: 0
          }));

          await supabaseAdmin
            .from('customer_vouchers')
            .upsert(inserts, { onConflict: 'customer_id,voucher_id' });

          const notifications = customers.map((c: any) => ({
            user_id: c.id,
            title: 'Voucher Baru Dikirim!',
            message: `Voucher diskon ${voucher.code} sebesar ${voucher.discount_percent}% telah dikirim ke akun Anda. Gunakan saat checkout!`,
            type: 'voucher',
            reference_id: voucher.id
          }));

          await supabaseAdmin.from('notifications').insert(notifications);
        }
      } catch (distError) {
        console.error('Auto-distribution error:', distError);
        // Do not fail the whole voucher creation if distribution notifications fail
      }
    }

    return NextResponse.json({ success: true, voucher });
  } catch (error: any) {
    console.error('Create voucher error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { voucherId, action, is_active } = body;

    if (!voucherId) {
      return NextResponse.json({ error: 'ID Voucher diperlukan' }, { status: 400 });
    }

    if (action === 'toggle_active') {
      const { data: voucher, error } = await supabaseAdmin
        .from('vouchers')
        .update({ is_active })
        .eq('id', voucherId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, voucher });
    }

    if (action === 'distribute') {
      // 1. Get all customer profiles
      const { data: customers, error: customersError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'customer');

      if (customersError) throw customersError;

      if (!customers || customers.length === 0) {
        return NextResponse.json({ success: true, message: 'Tidak ada pelanggan terdaftar' });
      }

      // 2. Insert/Upsert relationship to customer_vouchers
      const inserts = customers.map((c: any) => ({
        customer_id: c.id,
        voucher_id: voucherId,
        used_count: 0
      }));

      const { error: upsertError } = await supabaseAdmin
        .from('customer_vouchers')
        .upsert(inserts, { onConflict: 'customer_id,voucher_id' });

      if (upsertError) throw upsertError;

      // 3. Add notification to each customer
      // Fetch voucher info first
      const { data: voucherInfo } = await supabaseAdmin
        .from('vouchers')
        .select('code, discount_percent')
        .eq('id', voucherId)
        .single();

      const notifCode = voucherInfo?.code || 'Baru';
      const notifPercent = voucherInfo?.discount_percent || 0;

      const notifications = customers.map((c: any) => ({
        user_id: c.id,
        title: 'Voucher Baru Dikirim!',
        message: `Voucher diskon ${notifCode} sebesar ${notifPercent}% telah dikirim ke akun Anda. Gunakan saat checkout!`,
        type: 'voucher',
        reference_id: voucherId
      }));

      // Insert notifications
      await supabaseAdmin.from('notifications').insert(notifications);

      return NextResponse.json({ success: true, message: 'Voucher berhasil dikirim ke seluruh pelanggan' });
    }

    return NextResponse.json({ error: 'Aksi tidak valid' }, { status: 400 });
  } catch (error: any) {
    console.error('Update voucher error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const voucherId = searchParams.get('id');

    if (!voucherId) {
      return NextResponse.json({ error: 'ID Voucher diperlukan' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('vouchers')
      .delete()
      .eq('id', voucherId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Voucher berhasil dihapus' });
  } catch (error: any) {
    console.error('Delete voucher error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
