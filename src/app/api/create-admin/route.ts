import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const email = 'admin@resto.com';
  const password = 'admin123';
  const fullName = 'Super Admin Resto';

  try {
    // 1. Create User in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        // If already exists, just update the profile to admin
        const { data: existingUser } = await supabaseAdmin.from('profiles').select('user_id').eq('full_name', fullName).maybeSingle();
        
        // Find user by email if possible
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const user = users.users.find(u => u.email === email);
        
        if (user) {
          await supabaseAdmin.from('profiles').upsert({
            user_id: user.id,
            full_name: fullName,
            role: 'admin'
          }, { onConflict: 'user_id' });
          
          return NextResponse.json({ success: true, message: 'Akun admin sudah ada dan telah dipastikan memiliki role admin.' });
        }
      }
      throw authError;
    }

    // 2. Create/Update Profile with Admin Role
    if (authUser.user) {
      const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
        user_id: authUser.user.id,
        full_name: fullName,
        role: 'admin'
      }, { onConflict: 'user_id' });

      if (profileError) throw profileError;
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Akun Admin berhasil dibuat!',
      credentials: { email, password }
    });

  } catch (error: any) {
    console.error('Create admin error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
