export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  try {
    const { email, password, fullName, phone, code } = await req.json();
    console.log('[Register] Starting registration for:', email);

    if (!email || !password || !fullName || !code) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Double check OTP
    const { data: otpData, error: otpError } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', email)
      .eq('code', code)
      .eq('type', 'registration')
      .eq('is_used', true)
      .single();

    console.log('[Register] OTP check:', otpData ? 'found' : 'not found', otpError?.message || '');

    if (!otpData) {
      return NextResponse.json({ error: 'OTP belum diverifikasi' }, { status: 400 });
    }

    // Try signUp instead of admin.createUser
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || '',
        },
      },
    });

    console.log('[Register] SignUp result:', JSON.stringify({ 
      userId: signUpData?.user?.id, 
      error: signUpError?.message 
    }));

    let userId: string;

    if (signUpError) {
      // If user already exists, try to find them
      if (signUpError.message.includes('already') || signUpError.message.includes('exists') || signUpError.message.includes('duplicate')) {
        console.log('[Register] User might already exist, trying to find...');
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = listData?.users?.find((u: any) => u.email === email);
        
        if (existingUser) {
          console.log('[Register] Found existing user:', existingUser.id);
          // Update password
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            password,
            email_confirm: true,
          });
          userId = existingUser.id;
        } else {
          console.error('[Register] Cannot find existing user either');
          return NextResponse.json({ error: signUpError.message }, { status: 400 });
        }
      } else {
        console.error('[Register] SignUp error:', signUpError.message);
        return NextResponse.json({ error: signUpError.message }, { status: 400 });
      }
    } else {
      userId = signUpData.user!.id;
      
      // Auto-confirm email via admin
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });
      console.log('[Register] User created and confirmed:', userId);
    }

    // Upsert profile (insert or update if exists)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        user_id: userId,
        full_name: fullName,
        phone: phone || null,
        role: 'customer',
      }, {
        onConflict: 'user_id',
      });

    if (profileError) {
      console.error('[Register] Profile error:', profileError.message);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    console.log('[Register] Registration complete for:', email);
    return NextResponse.json({ success: true, message: 'Pendaftaran berhasil' });
  } catch (error: any) {
    console.error('[Register] Unexpected error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
