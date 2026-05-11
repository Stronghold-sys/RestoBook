import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { email, name, month, pdfBase64 } = await req.json();

    if (!email || !pdfBase64) {
      return NextResponse.json(
        { error: 'Email and PDF data are required' },
        { status: 400 }
      );
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json(
        { error: 'Resend API Key is not configured' },
        { status: 500 }
      );
    }

    const resend = new Resend(resendKey);
    const attachmentContent = pdfBase64.includes('base64,') 
      ? pdfBase64.split('base64,')[1] 
      : pdfBase64;

    await resend.emails.send({
      from: 'RestoBook <noreply@restobookid.my.id>',
      to: email,
      subject: `Slip Gaji Periode ${month} - ${name}`,
      html: `
        <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
          <h2 style="color: #ea580c;">Halo ${name},</h2>
          <p>Bersama email ini, kami lampirkan Slip Gaji Anda untuk periode <strong>${month}</strong>.</p>
          <p>Gaji Anda telah berhasil ditransfer. Silakan periksa file PDF terlampir untuk rincian lengkap mengenai pendapatan dan potongan Anda bulan ini.</p>
          <p>Jika ada pertanyaan terkait perhitungan gaji, silakan hubungi tim Admin atau HR.</p>
          <br/>
          <p>Terima kasih atas dedikasi dan kerja keras Anda.</p>
          <p>Salam hangat,<br/><strong>Tim Manajemen RestoBook</strong></p>
        </div>
      `,
      attachments: [
        {
          filename: `Slip_Gaji_${name.replace(/\s+/g, '_')}_${month}.pdf`,
          content: attachmentContent,
        },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error sending payslip:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
