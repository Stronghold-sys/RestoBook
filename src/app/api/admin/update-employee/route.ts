export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const {
      userId,
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

    if (!userId) {
      return NextResponse.json({ error: 'User ID wajib diisi.' }, { status: 400 });
    }

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

    // 1. Fetch current profile data (for audit_logs data_before)
    const { data: existingProfile, error: fetchErr } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (fetchErr || !existingProfile) {
      return NextResponse.json({ error: 'Karyawan tidak ditemukan.' }, { status: 404 });
    }

    // 2. Update Auth User
    const updateAuthData: any = {
      user_metadata: {
        full_name: fullName,
        role: role,
        avatar_url: avatarUrl || existingProfile.avatar_url
      }
    };
    if (email && email !== existingProfile.email) {
      updateAuthData.email = email;
    }

    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, updateAuthData);
    if (authUpdateError) throw authUpdateError;

    // 3. Update database profiles table
    const isBlocked = accountStatus === 'nonaktif' || workStatus === 'dipecat';
    
    const updateData = {
      full_name: fullName,
      email: email,
      phone: phone,
      role: role,
      avatar_url: avatarUrl || existingProfile.avatar_url,
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
      work_status: workStatus,
      status_karyawan: workStatus, // sync old status field
      username,
      access_rights: accessRights || [],
      account_status: accountStatus,
      is_blocked: isBlocked, // block/unblock access based on status
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
      updated_at: new Date().toISOString()
    };

    const { data: updatedProfile, error: dbError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (dbError) throw dbError;

    // 4. Save Audit Log
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown Browser';
    
    // Simple User Agent Parsing
    let device = 'Desktop';
    if (/mobile/i.test(userAgent)) device = 'Mobile';
    else if (/tablet/i.test(userAgent)) device = 'Tablet';

    await supabaseAdmin.from('audit_logs').insert({
      action: 'update',
      operator_id: operatorProfile?.id || null,
      operator_name: operatorProfile?.full_name || 'Admin RestoBook',
      target_id: existingProfile.id,
      target_name: fullName,
      data_before: existingProfile,
      data_after: updatedProfile,
      ip_address: ip,
      browser: userAgent,
      device: device
    });

    return NextResponse.json({ success: true, profile: updatedProfile });
  } catch (error: any) {
    console.error('Update employee error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
