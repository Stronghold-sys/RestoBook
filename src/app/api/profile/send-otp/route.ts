import { NextResponse } from 'next/server';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Use a simple in-memory store for demo/development purposes. 
// In production, use Redis or a database table.
const otpStore = new Map<string, { otp: string; expires: number }>();

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(email, { otp, expires });

    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: 'RestoBook Security <security@resend.dev>',
        to: email,
        subject: 'Kode OTP Ganti Password RestoBook',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333; text-align: center;">
            <h2 style="color: #e85d04;">Ganti Password RestoBook</h2>
            <p>Anda telah meminta untuk mengganti password. Gunakan kode OTP di bawah ini:</p>
            <div style="background: #f4f4f4; padding: 20px; border-radius: 12px; margin: 30px auto; display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #e85d04;">
              ${otp}
            </div>
            <p style="font-size: 12px; color: #666;">Kode ini berlaku selama 10 menit. Jangan berikan kode ini kepada siapapun.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px;">(C) 2024 RestoBook Security System</p>
          </div>
        `
      });
    }

    return NextResponse.json({ success: true, message: 'OTP sent' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Export the store getter for the verify route
export const getOTP = (email: string) => otpStore.get(email);
export const deleteOTP = (email: string) => otpStore.delete(email);
