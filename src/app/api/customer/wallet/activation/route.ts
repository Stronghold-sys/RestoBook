export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendWalletActivationEmail } from '@/lib/sendWalletActivationEmail';

// Helper: Hitung umur berdasarkan tanggal lahir
function getAge(birthDateString: string): number {
  const today = new Date();
  const birthDate = new Date(birthDateString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Silakan login kembali' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    const { data: activation } = await supabaseAdmin
      .from('wallet_activations')
      .select('*')
      .eq('profile_id', profile.id)
      .maybeSingle();

    return NextResponse.json({ success: true, activation });
  } catch (error: any) {
    console.error('Wallet Activation GET Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Silakan login kembali' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name, wallet_status')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    const body = await req.json();
    const {
      full_name, nik, birth_place, birth_date, gender, marital_status,
      nationality, religion, occupation, mother_name,
      phone, email, address, rt_rw, village, district, city, province, postal_code,
      ktp_name, ktp_number, ktp_front_url, ktp_back_url, additional_doc_url,
      purpose, source_of_funds, statement_true, terms_accepted, privacy_accepted, verify_accepted
    } = body;

    // 1. Server-side Validation
    if (!full_name || !nik || !birth_place || !birth_date || !gender || !marital_status ||
        !nationality || !religion || !occupation || !mother_name || !phone || !email ||
        !address || !rt_rw || !village || !district || !city || !province || !postal_code ||
        !ktp_name || !ktp_number || !ktp_front_url || !purpose || !source_of_funds) {
      return NextResponse.json({ error: 'Semua field wajib diisi kecuali yang bertanda opsional' }, { status: 400 });
    }

    if (!statement_true || !terms_accepted || !privacy_accepted || !verify_accepted) {
      return NextResponse.json({ error: 'Anda harus menyetujui seluruh pernyataan dan syarat ketentuan' }, { status: 400 });
    }

    // NIK dan KTP 16 digit numerik
    if (!/^\d{16}$/.test(nik)) {
      return NextResponse.json({ error: 'NIK harus terdiri dari 16 digit angka' }, { status: 400 });
    }
    if (!/^\d{16}$/.test(ktp_number)) {
      return NextResponse.json({ error: 'Nomor KTP harus terdiri dari 16 digit angka' }, { status: 400 });
    }

    // Format Email & Phone
    if (!/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: 'Format email tidak valid' }, { status: 400 });
    }
    if (!/^[0-9+]{8,15}$/.test(phone)) {
      return NextResponse.json({ error: 'Format nomor HP tidak valid' }, { status: 400 });
    }

    // Umur minimal 17 tahun
    const age = getAge(birth_date);
    if (age < 17) {
      return NextResponse.json({ error: 'Usia minimal untuk aktivasi Dompetku adalah 17 tahun' }, { status: 400 });
    }

    // Check existing activation record
    const { data: existingActivation } = await supabaseAdmin
      .from('wallet_activations')
      .select('id, status')
      .eq('profile_id', profile.id)
      .maybeSingle();

    if (existingActivation) {
      // Jika statusnya diterima/selesai, tidak boleh diubah
      if (['diterima', 'selesai'].includes(existingActivation.status)) {
        return NextResponse.json({ error: 'Dompetku Anda sudah aktif' }, { status: 400 });
      }
      // Jika diproses/diajukan, tunggu admin
      if (['diajukan', 'diajukan_ulang', 'diproses'].includes(existingActivation.status)) {
        return NextResponse.json({ error: 'Pengajuan Anda sedang ditinjau oleh admin' }, { status: 400 });
      }
    }

    // Cek duplikasi NIK di pengajuan lain yang aktif / disetujui
    const { data: duplicateNik } = await supabaseAdmin
      .from('wallet_activations')
      .select('id')
      .eq('nik', nik)
      .neq('profile_id', profile.id)
      .in('status', ['diajukan', 'diajukan_ulang', 'diproses', 'diterima', 'selesai'])
      .maybeSingle();

    if (duplicateNik) {
      return NextResponse.json({ error: 'NIK ini sudah pernah didaftarkan untuk pengajuan aktivasi Dompetku lain' }, { status: 400 });
    }

    const isResubmit = existingActivation && existingActivation.status === 'ditolak';
    const nextStatus = isResubmit ? 'diajukan_ulang' : 'diajukan';

    const payload = {
      profile_id: profile.id,
      status: nextStatus,
      full_name,
      nik,
      birth_place,
      birth_date,
      gender,
      marital_status,
      nationality,
      religion,
      occupation,
      mother_name,
      phone,
      email,
      address,
      rt_rw,
      village,
      district,
      city,
      province,
      postal_code,
      ktp_name,
      ktp_number,
      ktp_front_url,
      ktp_back_url: ktp_back_url || null,
      additional_doc_url: additional_doc_url || null,
      purpose,
      source_of_funds,
      statement_true,
      terms_accepted,
      privacy_accepted,
      verify_accepted,
      rejection_reason: null, // Reset rejection reason on submit
      invalid_fields: [], // Reset invalid fields
      updated_at: new Date().toISOString()
    };

    let activationId = '';

    if (existingActivation) {
      // Update
      const { data: updatedAct, error: updateError } = await supabaseAdmin
        .from('wallet_activations')
        .update(payload)
        .eq('id', existingActivation.id)
        .select()
        .single();

      if (updateError) throw updateError;
      activationId = updatedAct.id;
    } else {
      // Insert
      const { data: insertedAct, error: insertError } = await supabaseAdmin
        .from('wallet_activations')
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;
      activationId = insertedAct.id;
    }

    // 2. Update status in profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ wallet_status: nextStatus })
      .eq('id', profile.id);

    if (profileError) throw profileError;

    // 3. Log the action
    await supabaseAdmin.from('wallet_activation_logs').insert({
      activation_id: activationId,
      profile_id: profile.id,
      action: isResubmit ? 'resubmit' : 'submit',
      from_status: existingActivation?.status || 'belum_aktif',
      to_status: nextStatus,
      notes: isResubmit ? 'Pelanggan mengajukan kembali berkas revisi' : 'Pelanggan mengajukan aktivasi Dompetku baru'
    });

    // 4. Insert notification
    const notifMsg = isResubmit 
      ? 'Perbaikan pengajuan aktivasi Dompetku berhasil dikirim. Tim kami akan meninjau data Anda kembali.'
      : 'Pengajuan aktivasi Dompetku berhasil dikirim. Tim kami akan meninjau data Anda.';

    await supabaseAdmin.from('notifications').insert({
      user_id: profile.id,
      title: 'Aktivasi Dompetku Dikirim',
      message: notifMsg,
      type: 'wallet_activation',
      status_badge: 'Diajukan'
    });

    // 5. Send Email
    const targetEmail = email || profile.email || user.email || '';
    if (targetEmail) {
      await sendWalletActivationEmail(targetEmail, full_name, nextStatus);
    }

    return NextResponse.json({ success: true, message: notifMsg });

  } catch (error: any) {
    console.error('Wallet Activation POST Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
