import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sendPinEmail(email: string, name: string, type: 'created' | 'changed' | 'reset') {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !email) return;

  const resend = new Resend(resendKey);

  const subjects: Record<string, string> = {
    created: 'PIN Dompetku Berhasil Dibuat – RestoBook',
    changed: 'PIN Dompetku Berhasil Diubah – RestoBook',
    reset:   'PIN Dompetku Telah Direset – RestoBook',
  };

  const messages: Record<string, string> = {
    created: `PIN keamanan transaksi Dompetku Anda telah berhasil dibuat. Mulai sekarang, setiap pembayaran menggunakan Dompetku akan memerlukan PIN 6 digit Anda.`,
    changed: `PIN keamanan transaksi Dompetku Anda telah berhasil diperbarui. Gunakan PIN baru Anda untuk bertransaksi.`,
    reset:   `PIN keamanan Dompetku Anda telah direset oleh sistem setelah persetujuan banding. Silakan buat PIN baru di halaman Dompetku untuk mulai bertransaksi kembali.`,
  };

  const warnings: Record<string, string> = {
    created: 'Simpan PIN Anda dengan aman. Jangan berikan PIN kepada siapa pun.',
    changed: 'Jika Anda tidak merasa melakukan perubahan ini, segera hubungi Admin RestoBook.',
    reset:   'Segera buat PIN baru untuk mengamankan akun Dompetku Anda.',
  };

  await resend.emails.send({
    from: 'RestoBook Security <security@restobookid.my.id>',
    to: email,
    subject: subjects[type],
    html: `
      <div style="font-family:sans-serif;color:#1f2937;max-width:600px;margin:0 auto;padding:30px;border:1px solid #e5e7eb;border-radius:16px;background:#fff">
        <div style="text-align:center;margin-bottom:24px">
          <h1 style="color:#ea580c;margin:0;font-size:28px;font-weight:800">RestoBook</h1>
          <p style="color:#6b7280;font-size:14px;margin-top:4px">Keamanan Dompetku</p>
        </div>
        <hr style="border:none;border-top:1px solid #f3f4f6;margin-bottom:24px"/>
        <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 12px">Halo, ${name}!</h2>
        <p style="line-height:1.6;color:#4b5563;font-size:15px">${messages[type]}</p>
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:16px;border-radius:8px;margin:24px 0;font-size:14px;color:#92400e">
          <strong>Peringatan Keamanan:</strong><br/>${warnings[type]}
        </div>
        <hr style="border:none;border-top:1px solid #f3f4f6;margin:30px 0 20px"/>
        <p style="font-size:12px;color:#9ca3af;text-align:center;margin:0">
          Email ini dikirim otomatis oleh sistem keamanan RestoBook. Jangan balas email ini.
        </p>
      </div>
    `
  }).catch(err => console.error('PIN email send failed:', err));
}

// POST: Buat PIN baru (dengan verifikasi OTP)
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Silakan login kembali' }, { status: 401 });

    const { pin, otp } = await req.json();

    if (!pin || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: 'PIN harus terdiri dari 6 digit angka' }, { status: 400 });
    }
    if (!otp) {
      return NextResponse.json({ error: 'Kode OTP wajib diisi' }, { status: 400 });
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name')
      .eq('user_id', user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    // Verifikasi kode OTP
    const { data: otpData, error: otpErr } = await supabaseAdmin
      .from('otp_codes')
      .select('id')
      .eq('email', profile.email)
      .eq('code', otp)
      .eq('type', 'create_pin')
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (otpErr || !otpData) {
      return NextResponse.json({ error: 'Kode OTP tidak valid atau sudah kedaluwarsa' }, { status: 400 });
    }

    // Hash PIN dan simpan ke database
    const hashedPin = await hashPin(pin);

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({
        wallet_pin: hashedPin,
        wrong_pin_count: 0,
        wallet_pin_reset_required: false,
        is_wallet_blocked: false,
        wallet_block_reason: null,
      })
      .eq('id', profile.id);

    if (updateErr) throw updateErr;

    // Tandai OTP sebagai sudah digunakan
    await supabaseAdmin.from('otp_codes').update({ is_used: true }).eq('id', otpData.id);

    // Kirim notifikasi ke database
    await supabaseAdmin.from('notifications').insert({
      user_id: profile.id,
      title: 'PIN Dompetku Berhasil Dibuat',
      message: 'PIN keamanan transaksi 6 digit Anda telah berhasil dibuat. Setiap pembayaran via Dompetku kini dilindungi PIN.',
      type: 'wallet_pin_created',
    });

    // Kirim email notifikasi
    await sendPinEmail(profile.email, profile.full_name || 'Pelanggan', 'created');

    return NextResponse.json({ success: true, message: 'PIN berhasil dibuat' });
  } catch (error: any) {
    console.error('Create PIN error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// PUT: Ubah PIN (dengan verifikasi PIN lama + OTP)
export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Silakan login kembali' }, { status: 401 });

    const { oldPin, newPin, otp } = await req.json();

    if (!oldPin || !/^\d{6}$/.test(oldPin)) {
      return NextResponse.json({ error: 'PIN lama tidak valid' }, { status: 400 });
    }
    if (!newPin || !/^\d{6}$/.test(newPin)) {
      return NextResponse.json({ error: 'PIN baru harus terdiri dari 6 digit angka' }, { status: 400 });
    }
    if (!otp) {
      return NextResponse.json({ error: 'Kode OTP wajib diisi' }, { status: 400 });
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, wallet_pin')
      .eq('user_id', user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    if (!profile.wallet_pin) {
      return NextResponse.json({ error: 'Anda belum memiliki PIN. Silakan buat PIN terlebih dahulu.' }, { status: 400 });
    }

    // Verifikasi PIN lama
    const hashedOldPin = await hashPin(oldPin);
    if (hashedOldPin !== profile.wallet_pin) {
      return NextResponse.json({ error: 'PIN lama yang Anda masukkan salah' }, { status: 400 });
    }

    // Verifikasi kode OTP
    const { data: otpData, error: otpErr } = await supabaseAdmin
      .from('otp_codes')
      .select('id')
      .eq('email', profile.email)
      .eq('code', otp)
      .eq('type', 'change_pin')
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (otpErr || !otpData) {
      return NextResponse.json({ error: 'Kode OTP tidak valid atau sudah kedaluwarsa' }, { status: 400 });
    }

    // Hash PIN baru dan simpan
    const hashedNewPin = await hashPin(newPin);

    const { error: updateErr } = await supabaseAdmin
      .from('profiles')
      .update({ wallet_pin: hashedNewPin, wrong_pin_count: 0 })
      .eq('id', profile.id);

    if (updateErr) throw updateErr;

    // Tandai OTP sebagai sudah digunakan
    await supabaseAdmin.from('otp_codes').update({ is_used: true }).eq('id', otpData.id);

    // Kirim notifikasi ke database
    await supabaseAdmin.from('notifications').insert({
      user_id: profile.id,
      title: 'PIN Dompetku Berhasil Diubah',
      message: 'PIN keamanan Dompetku Anda telah berhasil diperbarui. Gunakan PIN baru Anda untuk bertransaksi.',
      type: 'wallet_pin_changed',
    });

    // Kirim email notifikasi
    await sendPinEmail(profile.email, profile.full_name || 'Pelanggan', 'changed');

    return NextResponse.json({ success: true, message: 'PIN berhasil diubah' });
  } catch (error: any) {
    console.error('Change PIN error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
