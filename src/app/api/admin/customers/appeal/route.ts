export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { data: appeal, error } = await supabaseAdmin
      .from('appeals')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ success: true, appeal });
  } catch (error: any) {
    console.error('Fetch appeal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user_id, reason } = await req.json();

    if (!user_id || !reason) {
      return NextResponse.json({ error: 'User ID and reason are required' }, { status: 400 });
    }

    // 1. Get profile details to include in email
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name, phone, role, is_blocked, is_active, suspend_reason, suspend_message, suspend_type, suspend_until')
      .eq('id', user_id)
      .single();

    if (profileErr) {
      console.error('Failed to fetch profile for appeal email:', profileErr);
    }

    // 2. Insert appeal
    const { data: appeal, error } = await supabaseAdmin
      .from('appeals')
      .insert({
        user_id,
        reason,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // 3. Send email confirmation to user (and cc admin)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && profile?.email) {
      try {
        const resend = new Resend(resendKey);
        
        // Get admin email from settings to CC
        const { data: settings } = await supabaseAdmin
          .from('restaurant_settings')
          .select('email')
          .maybeSingle();

        const ccEmail = settings?.email || 'admin@restobook.com';

        await resend.emails.send({
          from: 'RestoBook <noreply@restobookid.my.id>',
          to: [profile.email],
          cc: ccEmail ? [ccEmail] : undefined,
          subject: 'Tanda Terima Pengajuan Banding Akun RestoBook',
          html: `
            <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #ea580c; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Tanda Terima Pengajuan Banding</p>
              </div>
              <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
              
              <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Halo, ${profile.full_name || 'Pelanggan'}!</h2>
              <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                Kami mengonfirmasi bahwa pengajuan banding Anda untuk pemulihan akun RestoBook telah berhasil kami terima. Permohonan Anda sedang dalam antrean peninjauan oleh tim manajemen kami.
              </p>
              
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 12px; margin: 24px 0;">
                <h3 style="margin-top: 0; margin-bottom: 15px; color: #111827; font-size: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">Detail Akun & Pembatasan</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.5;">
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280; width: 40%;">Nama Lengkap</td>
                    <td style="padding: 6px 0; color: #111827; font-weight: bold;">${profile.full_name || '-'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Email Terdaftar</td>
                    <td style="padding: 6px 0; color: #111827; font-weight: bold;">${profile.email || '-'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Nomor Telepon</td>
                    <td style="padding: 6px 0; color: #111827; font-weight: bold;">${profile.phone || '-'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Tipe Pembatasan</td>
                    <td style="padding: 6px 0; color: #111827; font-weight: bold;">${profile.suspend_type === 'permanent' || profile.is_blocked ? 'Blokir Permanen (Banned)' : 'Penangguhan Sementara (Suspended)'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Alasan Pelanggaran</td>
                    <td style="padding: 6px 0; color: #dc2626; font-weight: bold;">${profile.suspend_reason || 'Pelanggaran Ketentuan Layanan'}</td>
                  </tr>
                  ${profile.suspend_until ? `
                  <tr>
                    <td style="padding: 6px 0; color: #6b7280;">Masa Penangguhan</td>
                    <td style="padding: 6px 0; color: #111827; font-weight: bold;">Hingga ${new Date(profile.suspend_until).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} WIB</td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 16px; border-radius: 8px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #7c2d12;">
                <strong style="color: #c2410c;">Alasan Banding yang Anda Ajukan:</strong><br/>
                <p style="margin: 8px 0 0 0; font-style: italic;">"${reason}"</p>
              </div>

              <p style="line-height: 1.6; color: #4b5563; font-size: 14px;">
                Proses peninjauan banding memerlukan waktu maksimal <strong>1x24 jam</strong>. Keputusan resmi (apakah banding disetujui atau ditolak) akan otomatis dikirimkan ke alamat email ini setelah proses peninjauan selesai.
              </p>
              
              <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                Email ini dikirim secara otomatis oleh sistem RestoBook Keamanan. Harap jangan membalas langsung ke email ini.
              </p>
            </div>
          `
        });
      } catch (err) {
        console.error('Failed to send appeal confirmation email:', err);
      }
    }

    return NextResponse.json({ success: true, message: 'Banding berhasil diajukan', appeal });
  } catch (error: any) {
    console.error('Submit appeal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { appeal_id, status, admin_message, admin_id } = await req.json();

    if (!appeal_id || !status) {
      return NextResponse.json({ error: 'Appeal ID and status are required' }, { status: 400 });
    }

    // Fetch the appeal to get user details
    const { data: appeal, error: fetchErr } = await supabaseAdmin
      .from('appeals')
      .select('*, profiles(email, full_name)')
      .eq('id', appeal_id)
      .single();

    if (fetchErr || !appeal) {
      return NextResponse.json({ error: 'Appeal not found' }, { status: 404 });
    }

    const { error: updateAppealErr } = await supabaseAdmin
      .from('appeals')
      .update({
        status,
        admin_message,
        updated_at: new Date().toISOString()
      })
      .eq('id', appeal_id);

    if (updateAppealErr) throw updateAppealErr;

    const resendKey = process.env.RESEND_API_KEY;
    const name = appeal.profiles?.full_name || 'Pelanggan';
    const emailToSend = appeal.profiles?.email;

    if (status === 'approved') {
      // Restore user account
      const { error: restoreErr } = await supabaseAdmin
        .from('profiles')
        .update({
          status: 'active',
          suspend_reason: null,
          suspend_message: null,
          suspended_at: null,
          suspend_until: null,
          suspend_type: null,
          just_restored: true,
          is_active: true
        })
        .eq('id', appeal.user_id);

      if (restoreErr) throw restoreErr;

      // Add to suspend_logs
      await supabaseAdmin.from('suspend_logs').insert({
        user_id: appeal.user_id,
        action: 'restored',
        reason: 'Banding disetujui oleh administrator.',
        message: admin_message || 'Banding Anda telah disetujui. Akun Anda telah diaktifkan kembali.',
        duration: null,
        suspend_until: null,
        acted_by: admin_id || null
      });

      // Send email
      if (resendKey && emailToSend) {
        try {
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: 'RestoBook <noreply@restobookid.my.id>',
            to: emailToSend,
            subject: 'Hasil Banding Akun RestoBook: Banding Disetujui',
            html: `
              <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #ea580c; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Pemberitahuan Banding Sukses</p>
                </div>
                <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
                <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Halo, ${name}!</h2>
                <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                  Kami dengan senang hati memberitahukan bahwa permohonan banding Anda telah <strong>disetujui</strong> oleh administrator kami. Akun Anda telah dipulihkan secara penuh.
                </p>
                <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 16px; border-radius: 8px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #166534;">
                  <strong>Pesan Administrator:</strong><br/>
                  ${admin_message || 'Akun Anda telah diaktifkan kembali. Selamat menikmati layanan kami.'}
                </div>
                <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
                <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                  Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
                </p>
              </div>
            `
          });
        } catch (err) {
          console.error('Failed to send appeal approval email:', err);
        }
      }
    } else if (status === 'rejected') {
      // Send email
      if (resendKey && emailToSend) {
        try {
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: 'RestoBook <noreply@restobookid.my.id>',
            to: emailToSend,
            subject: 'Hasil Banding Akun RestoBook: Banding Ditolak',
            html: `
              <div style="font-family: sans-serif; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <h1 style="color: #dc2626; margin: 0; font-size: 28px; font-weight: 800;">RestoBook</h1>
                  <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Pemberitahuan Banding Ditolak</p>
                </div>
                <hr style="border: none; border-top: 1px solid #f3f4f6; margin-bottom: 24px;" />
                <h2 style="color: #111827; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Halo, ${name}!</h2>
                <p style="line-height: 1.6; color: #4b5563; font-size: 15px;">
                  Kami menyesal memberitahukan bahwa permohonan banding untuk pemulihan akun Anda telah <strong>ditolak</strong> setelah ditinjau ulang oleh administrator kami.
                </p>
                <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin: 24px 0; font-size: 14px; line-height: 1.6; color: #991b1b;">
                  <strong>Pesan Administrator:</strong><br/>
                  ${admin_message || 'Banding ditolak karena alasan keamanan atau pelanggaran berat.'}
                </div>
                <p style="line-height: 1.6; color: #4b5563; font-size: 14px;">
                  Status penangguhan atau pemblokiran akun Anda tetap berlaku sebagaimana keputusan awal manajemen.
                </p>
                <hr style="border: none; border-top: 1px solid #f3f4f6; margin: 30px 0 20px 0;" />
                <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                  Email ini dikirim secara otomatis oleh sistem RestoBook. Harap jangan membalas email ini.
                </p>
              </div>
            `
          });
        } catch (err) {
          console.error('Failed to send appeal rejection email:', err);
        }
      }
    }

    return NextResponse.json({ success: true, message: `Status banding diperbarui menjadi ${status}` });
  } catch (error: any) {
    console.error('Process appeal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
