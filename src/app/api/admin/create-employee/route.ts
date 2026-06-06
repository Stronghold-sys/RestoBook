export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { Resend } from 'resend';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const generateTempPassword = () => {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  
  let password = "";
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  const allChars = upper + lower + numbers + symbols;
  for (let i = 0; i < 6; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  return password.split('').sort(() => 0.5 - Math.random()).join('');
};

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const {
      fullName,
      email,
      phone,
      role,
      nickname,
      gender,
      birthPlace,
      birthDate,
      religion,
      maritalStatus,
      nik,
      noKk,
      whatsapp,
      address,
      rt,
      rw,
      village,
      district,
      city,
      province,
      postalCode,
      jobTitle,
      division,
      department,
      workShift,
      placementLocation,
      directManager,
      basicSalary,
      allowances,
      workStatus,
      username,
      accessRights,
      accountStatus,
      emergencyName,
      emergencyRelation,
      emergencyPhone,
      emergencyAddress,
      lastEducation,
      schoolName,
      major,
      graduationYear,
      certifications,
      skills,
      additionalNotes,
      avatarUrl
    } = payload;

    const resend = new Resend(process.env.RESEND_API_KEY);

    // Get current admin user details (operator)
    const clientSupabase = createServerSupabaseClient();
    const { data: { user: operatorUser } } = await clientSupabase.auth.getUser();
    
    let operatorProfile = null;
    if (operatorUser) {
      const { data: opData } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, role')
        .eq('user_id', operatorUser.id)
        .single();
      operatorProfile = opData;
    }

    // 1. Check if User already exists in Auth
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find((u: any) => u.email === email);

    // 2. Generate unique Employee ID from PostgreSQL sequence
    const { data: seqData, error: seqError } = await supabaseAdmin.rpc('exec_sql', {
      sql_string: "SELECT nextval('public.employee_id_seq') as val;"
    });
    if (seqError) throw seqError;
    const seqVal = seqData?.[0]?.val || Math.floor(100000 + Math.random() * 900000);
    const employeeId = `KRY-${String(seqVal).padStart(6, '0')}`;

    // 3. Generate Username and secure Temp Password
    let finalUsername = username;
    if (!finalUsername) {
      finalUsername = fullName.toLowerCase().replace(/[^a-z0-9]/g, '.');
      const { data: existingUserByUsername } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', finalUsername)
        .maybeSingle();
      if (existingUserByUsername) {
        finalUsername += Math.floor(10 + Math.random() * 90);
      }
    }

    const tempPassword = generateTempPassword();

    let userId: string;
    let isNewUser = false;

    if (existingUser) {
      // UPGRADE EXISTING USER
      userId = existingUser.id;
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword,
        user_metadata: { full_name: fullName, role: role, employee_id: employeeId, avatar_url: avatarUrl || null }
      });
      if (updateError) throw updateError;
    } else {
      // CREATE NEW USER
      isNewUser = true;
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: role, employee_id: employeeId, avatar_url: avatarUrl || null }
      });
      if (authError) throw authError;
      userId = authUser.user.id;
    }

    // 4. Update Profile (Upsert)
    const isBlocked = accountStatus === 'nonaktif' || workStatus === 'dipecat';

    const { data: newProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: userId,
        full_name: fullName,
        email: email,
        phone: phone,
        role: role,
        employee_id: employeeId,
        temp_password: tempPassword,
        status_karyawan: workStatus || 'aktif',
        avatar_url: avatarUrl || null,
        nickname,
        gender,
        birth_place: birthPlace,
        birth_date: birthDate ? new Date(birthDate) : null,
        religion,
        marital_status: maritalStatus,
        nik,
        no_kk: noKk,
        whatsapp,
        address,
        rt,
        rw,
        village,
        district,
        city,
        province,
        postal_code: postalCode,
        job_title: jobTitle,
        division,
        department,
        work_shift: workShift,
        placement_location: placementLocation,
        direct_manager: directManager,
        basic_salary: basicSalary ? Number(basicSalary) : 0,
        allowances: allowances ? Number(allowances) : 0,
        work_status: workStatus || 'aktif',
        username: finalUsername,
        access_rights: accessRights || [],
        account_status: accountStatus || 'aktif',
        is_blocked: isBlocked,
        emergency_name: emergencyName,
        emergency_relation: emergencyRelation,
        emergency_phone: emergencyPhone,
        emergency_address: emergencyAddress,
        last_education: lastEducation,
        school_name: schoolName,
        major,
        graduation_year: graduationYear,
        certifications,
        skills,
        additional_notes: additionalNotes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (profileError) throw profileError;
 
    // 5. Send Email via Resend with Credentials
    if (process.env.RESEND_API_KEY) {
      try {
        await resend.emails.send({
          from: 'RestoBook <noreply@restobookid.my.id>',
          to: email,
          subject: 'Selamat Bergabung di RestoBook!',
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid #eee; border-radius: 12px;">
              <h2 style="color: #e85d04; margin-top: 0;">Selamat Bergabung, ${fullName}!</h2>
              <p>Akun karyawan Anda telah berhasil dibuat sebagai <strong>${role.toUpperCase()}</strong>.</p>
              <p>Berikut adalah kredensial login Anda untuk mengakses sistem RestoBook:</p>
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>No. ID Karyawan:</strong> ${employeeId}</p>
                <p style="margin: 5px 0;"><strong>Username:</strong> ${finalUsername}</p>
                <p style="margin: 5px 0;"><strong>Email Login:</strong> ${email}</p>
                <p style="margin: 5px 0;"><strong>Password Sementara:</strong> <span style="color: #e85d04; font-weight: bold;">${tempPassword}</span></p>
                <p style="margin: 5px 0;"><strong>Jabatan:</strong> ${jobTitle || role}</p>
              </div>
              <p style="font-size: 12px; color: #666; font-style: italic;">*Password di atas bersifat sementara. Anda wajib segera mengubahnya melalui menu Profil demi keamanan akun Anda.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 12px; color: #999;">(C) 2026 RestoBook Management System</p>
            </div>
          `
        });
      } catch (emailErr) {
        console.error("Email sending failed:", emailErr);
      }
    }
 
    // 6. Send WhatsApp Notification via Fonnte
    if (phone) {
      try {
        const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "CpJ7L8M8TfwCVy2k2m6C";
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('8') ? '62' + cleanPhone : cleanPhone);
 
        const waMessage = `*SELAMAT BERGABUNG DI RESTOBOOK!*\n\nHalo *${fullName}*,\n\nSelamat bergabung di keluarga besar RestoBook! Akun karyawan Anda telah berhasil dibuat sebagai *${role.toUpperCase()}*.\n\nBerikut adalah data login Anda:\n\n*No. ID:* ${employeeId}\n*Username:* ${finalUsername}\n*Email:* ${email}\n*Password Sementara:* ${tempPassword}\n\n*PENTING:* Password di atas bersifat sementara. Anda *WAJIB* segera mengubahnya melalui menu Profil setelah berhasil login demi keamanan akun Anda.\n\nSelamat bekerja!\n\n*Manajemen RestoBook*`;
 
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
 
    // 7. Save Audit Log
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown Browser';
    
    let device = 'Desktop';
    if (/mobile/i.test(userAgent)) device = 'Mobile';
    else if (/tablet/i.test(userAgent)) device = 'Tablet';
 
    await supabaseAdmin.from('audit_logs').insert({
      action: 'create',
      operator_id: operatorProfile?.id || null,
      operator_name: operatorProfile?.full_name || 'Admin RestoBook',
      target_id: newProfile.id,
      target_name: fullName,
      data_before: null,
      data_after: newProfile,
      ip_address: ip,
      browser: userAgent,
      device: device
    });
 
    return NextResponse.json({ 
      success: true, 
      employee: { 
        id: userId, 
        password: tempPassword, 
        employee_id: employeeId,
        username: finalUsername,
        full_name: fullName,
        email: email,
        pdfBase64: null // PDF generated client-side now or skipped
      } 
    });
 
  } catch (error: any) {
    console.error('Admin create employee error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
