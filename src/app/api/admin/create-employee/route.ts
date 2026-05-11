export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export async function POST(req: Request) {
  try {
    const { fullName, email, phone, role, employeeId, password, pdfBase64 } = await req.json();

    const resend = new Resend(process.env.RESEND_API_KEY);

    // 1. Check if User already exists in Auth
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find((u: any) => u.email === email);

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      // UPGRADE EXISTING USER
      userId = existingUser.id;
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password, // Reset to temp password as requested
        user_metadata: { full_name: fullName, role: role, employee_id: employeeId, avatar_url: null }
      });
      if (updateError) throw updateError;
    } else {
      // CREATE NEW USER
      isNewUser = true;
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: role, employee_id: employeeId, avatar_url: null }
      });
      if (authError) throw authError;
      userId = authUser.user.id;
    }

    // 2. Update Profile (Upsert)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: userId,
        full_name: fullName,
        email: email,
        phone: phone,
        role: role,
        employee_id: employeeId,
        temp_password: password, // Store for admin visibility
        status_karyawan: 'aktif', // Explicitly set to ACTIVE status
        avatar_url: null // Reset avatar to ensure a clean profile state
      }, { onConflict: 'user_id' });

    if (profileError) throw profileError;

    // 3. Send Email via Resend
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'RestoBook <noreply@restobookid.my.id>',
          to: email,
          subject: 'Selamat Bergabung di RestoBook!',
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #e85d04;">Selamat Bergabung, ${fullName}!</h2>
              <p>Akun Anda telah berhasil dibuat sebagai <strong>${role.toUpperCase()}</strong>.</p>
              <p>Detail login Anda terlampir pada file <strong>PDF</strong> di email ini.</p>
              <p>Silakan gunakan informasi tersebut untuk masuk ke sistem.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 12px;">(C) 2024 RestoBook Management System</p>
            </div>
          `,
          attachments: pdfBase64 ? [{
            filename: `Kredensial_${employeeId}.pdf`,
            content: pdfBase64
          }] : []
        });
      } catch (emailErr) {
        console.error("Email sending failed:", emailErr);
      }
    }

    // 4. Kirim Notifikasi via WhatsApp (Otomatis kirim No. ID & Password)
    if (phone) {
      try {
        const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('8') ? '62' + cleanPhone : cleanPhone);

        const waMessage = `*SELAMAT BERGABUNG DI RESTOBOOK!*\n\nHalo *${fullName}*,\n\nSelamat bergabung di keluarga besar RestoBook! Akun karyawan Anda telah berhasil dibuat sebagai *${role.toUpperCase()}*.\n\nBerikut adalah data login Anda:\n\n*No. ID:* ${employeeId}\n*Email:* ${email}\n*Password Sementara:* ${password}\n\n*PENTING:* Password di atas bersifat sementara. Anda *WAJIB* segera mengubahnya melalui menu Profil setelah berhasil login demi keamanan akun Anda.\n\nSelamat bekerja!\n\n*Manajemen RestoBook*`;

        await fetch('https://api.fonnte.com/send', {
          method: 'POST',
          headers: { 'Authorization': FONNTE_TOKEN },
          body: new URLSearchParams({
            'target': formattedPhone,
            'message': waMessage,
            'countryCode': '62'
          })
        });
      } catch (waErr) {
        console.error("WhatsApp sending failed:", waErr);
      }
    }

    return NextResponse.json({ 
      success: true, 
      employee: { 
        id: userId, 
        password, 
        employee_id: employeeId,
        full_name: fullName,
        email: email
      } 
    });

  } catch (error: any) {
    console.error('Admin create employee error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
