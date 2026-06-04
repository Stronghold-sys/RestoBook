import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function sendWalletActivationEmail(
  email: string,
  name: string,
  status: 'diajukan' | 'diajukan_ulang' | 'diproses' | 'diterima' | 'ditolak' | 'selesai',
  rejectionReason?: string,
  invalidFields?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[sendWalletActivationEmail] Sending to ${email} with status: ${status}`);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[sendWalletActivationEmail] RESEND_API_KEY not set');
      return { success: false, error: 'Email service not configured' };
    }

    // 1. Fetch Restaurant Settings
    const { data: settings } = await supabaseAdmin
      .from('restaurant_settings')
      .select('*')
      .single();

    const restoName = settings?.name || 'RestoBook';
    const restoAddr = settings?.address || '';
    const restoPhone = settings?.phone || '';

    const resend = new Resend(apiKey);

    // 2. Determine Email Contents Based on Status
    let subject = '';
    let statusHeader = '';
    let statusBgColor = '#ffffff';
    let statusTextColor = '#333333';
    let statusBorderColor = '#dddddd';
    let messageBody = '';

    const fieldLabels: Record<string, string> = {
      full_name: 'Nama lengkap sesuai identitas',
      nik: 'NIK',
      birth_place: 'Tempat lahir',
      birth_date: 'Tanggal lahir',
      gender: 'Jenis kelamin',
      marital_status: 'Status perkawinan',
      nationality: 'Kewarganegaraan',
      religion: 'Agama',
      occupation: 'Pekerjaan',
      mother_name: 'Nama ibu kandung',
      phone: 'Nomor HP aktif',
      email: 'Email aktif',
      address: 'Alamat lengkap',
      rt_rw: 'RT/RW',
      village: 'Kelurahan/Desa',
      district: 'Kecamatan',
      city: 'Kota/Kabupaten',
      province: 'Provinsi',
      postal_code: 'Kode pos',
      ktp_name: 'Nama sesuai KTP',
      ktp_number: 'Nomor KTP',
      ktp_front_url: 'Foto KTP depan',
      ktp_back_url: 'Foto KTP belakang jika diperlukan',
      additional_doc_url: 'Dokumen pendukung',
      purpose: 'Tujuan penggunaan Dompetku',
      source_of_funds: 'Sumber dana utama'
    };

    switch (status) {
      case 'diajukan':
      case 'diajukan_ulang':
        subject = `Pengajuan Aktivasi Dompetku Berhasil Dikirim - ${restoName}`;
        statusHeader = 'PENGAJUAN DIKIRIM';
        statusBgColor = '#e3f2fd';
        statusTextColor = '#0d47a1';
        statusBorderColor = '#bbdefb';
        messageBody = `<p style="margin:0 0 10px 0;">Pengajuan aktivasi Dompetku Anda telah berhasil dikirim dan sedang menunggu verifikasi.</p>
                      <p style="margin:0;">Tim kami akan segera memeriksa kesesuaian dokumen Anda. Proses verifikasi biasanya membutuhkan waktu maksimal 1x24 jam.</p>`;
        break;
      case 'diproses':
        subject = `Pengajuan Aktivasi Dompetku Sedang Diproses - ${restoName}`;
        statusHeader = 'SEDANG DIPROSES';
        statusBgColor = '#fff3e0';
        statusTextColor = '#e65100';
        statusBorderColor = '#ffe0b2';
        messageBody = `<p style="margin:0 0 10px 0;">Tim kami sedang memeriksa pengajuan aktivasi Dompetku Anda. Mohon menunggu hasil verifikasi.</p>
                      <p style="margin:0;">Kami sedang memvalidasi data diri serta kecocokan foto dokumen identitas Anda.</p>`;
        break;
      case 'diterima':
        subject = `Aktivasi Dompetku Disetujui - ${restoName}`;
        statusHeader = 'DISETUJUI';
        statusBgColor = '#e8f5e9';
        statusTextColor = '#1b5e20';
        statusBorderColor = '#c8e6c9';
        messageBody = `<p style="margin:0 0 10px 0;">Selamat, pengajuan aktivasi Dompetku Anda telah disetujui. Fitur Dompetku sekarang aktif dan dapat digunakan.</p>
                      <p style="margin:0;">Anda sudah dapat menggunakan saldo Dompetku untuk melakukan transaksi pesanan makanan maupun reservasi meja di aplikasi kami.</p>`;
        break;
      case 'ditolak':
        subject = `Aktivasi Dompetku Belum Disetujui - ${restoName}`;
        statusHeader = 'DITOLAK / PERLU REVISI';
        statusBgColor = '#ffe5ec';
        statusTextColor = '#c9184a';
        statusBorderColor = '#ffccd5';
        
        let invalidFieldsHtml = '';
        if (invalidFields && invalidFields.length > 0) {
          invalidFieldsHtml = `
            <div style="background:#fff; border:1px solid #ffccd5; border-radius:8px; padding:15px; margin-top:15px;">
              <p style="margin:0 0 8px 0; font-weight:bold; color:#c9184a; font-size:13px;">Daftar Field/Dokumen yang Harus Diperbaiki:</p>
              <ul style="margin:0; padding-left:20px; font-size:12px; color:#555; line-height:1.6;">
                ${invalidFields.map(field => `<li><strong>${fieldLabels[field] || field}</strong></li>`).join('')}
              </ul>
            </div>
          `;
        }

        messageBody = `<p style="margin:0 0 10px 0;">Maaf, pengajuan aktivasi Dompetku Anda belum dapat disetujui. Silakan perbaiki data atau unggah ulang dokumen sesuai catatan admin.</p>
                      <div style="background:#fafafa; border-left:4px solid #c9184a; padding:12px; font-style:italic; font-size:13px; color:#555; margin:15px 0;">
                        <strong>Catatan Admin:</strong> "${rejectionReason || 'Data atau dokumen kurang jelas / tidak valid.'}"
                      </div>
                      ${invalidFieldsHtml}
                      <p style="margin:15px 0 0 0;">Anda dapat memperbaiki data yang tidak valid dengan menekan tombol <strong>Perbaiki dan Ajukan Ulang</strong> pada menu Dompetku di dalam aplikasi.</p>`;
        break;
      case 'selesai':
        subject = `Proses Aktivasi Dompetku Selesai - ${restoName}`;
        statusHeader = 'SELESAI';
        statusBgColor = '#e8f5e9';
        statusTextColor = '#1b5e20';
        statusBorderColor = '#c8e6c9';
        messageBody = `<p style="margin:0 0 10px 0;">Proses aktivasi Dompetku Anda telah selesai. Terima kasih telah melengkapi data dengan benar.</p>
                      <p style="margin:0;">Layanan Dompet digital internal Anda saat ini sudah aktif sepenuhnya dan terverifikasi secara aman.</p>`;
        break;
    }

    const emailPayload: any = {
      from: 'RestoBook <noreply@restobookid.my.id>',
      to: email,
      subject: subject,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width:600px; margin:0 auto; background:#ffffff;">
          <div style="background: linear-gradient(135deg, #ff5722, #e64a19); padding:30px 20px; text-align:center; border-radius:12px 12px 0 0;">
            <h1 style="color:#fff; margin:0; font-size:24px;">${restoName}</h1>
            <p style="color:rgba(255,255,255,0.85); margin:5px 0 0; font-size:13px;">${restoAddr}</p>
            ${restoPhone ? `<p style="color:rgba(255,255,255,0.85); margin:3px 0 0; font-size:12px;">Tel: ${restoPhone}</p>` : ''}
          </div>
          <div style="padding:25px 20px; border:1px solid #f0f0f0; border-top:none;">
            <div style="background:${statusBgColor}; border:1px solid ${statusBorderColor}; border-radius:8px; padding:12px; text-align:center; margin-bottom:20px;">
              <p style="margin:0; color:${statusTextColor}; font-weight:bold; font-size:14px; letter-spacing:1px;">${statusHeader}</p>
            </div>
            <p style="color:#333; font-size:14px;">Halo <strong>${name}</strong>,</p>
            <div style="color:#555; font-size:13px; line-height:1.6;">
              ${messageBody}
            </div>
            
            <p style="font-size:12px; color:#888; margin-top:25px; line-height:1.5; border-top:1px solid #eeeeee; pt-15;">
              Email ini dikirim secara otomatis oleh sistem keamanan RestoBook. Jangan membagikan informasi identitas pribadi Anda kepada pihak lain.
            </p>
          </div>
          <div style="background:#fafafa; padding:15px 20px; text-align:center; border-radius:0 0 12px 12px; border:1px solid #f0f0f0; border-top:none;">
            <p style="margin:0; font-size:11px; color:#aaa;">&copy; ${new Date().getFullYear()} ${restoName} &mdash; Powered by RestoBook</p>
          </div>
        </div>
      `
    };

    const { data: emailResult, error: emailError } = await resend.emails.send(emailPayload);

    if (emailError) {
      console.error('[sendWalletActivationEmail] Resend error:', JSON.stringify(emailError));
      return { success: false, error: JSON.stringify(emailError) };
    }

    console.log(`[sendWalletActivationEmail] SUCCESS → ${email} (id: ${emailResult?.id})`);
    return { success: true };
  } catch (err: any) {
    console.error('[sendWalletActivationEmail] FATAL:', err?.message || err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}
