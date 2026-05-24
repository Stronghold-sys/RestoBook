export const runtime = 'edge';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/customer/dashboard';

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The setAll method was called from a Server Component.
              // This can be ignored if you have middleware refreshing user sessions.
            }
          },
        },
      }
    );

    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const supabaseAdmin = getSupabaseAdmin();
          
          // Check if profile exists in database
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!profile) {
            // Auto-provision customer profile for new OAuth signup
            await supabaseAdmin.from('profiles').insert({
              user_id: user.id,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User Google',
              email: user.email,
              avatar_url: user.user_metadata?.avatar_url || '',
              role: 'customer',
            });
            
            return NextResponse.redirect(`${origin}/customer/dashboard`);
          } else {
            const role = profile.role || 'customer';
            return NextResponse.redirect(`${origin}/${role}/dashboard`);
          }
        }
      }
    } catch (e) {
      console.error('OAuth Callback exchange error:', e);
    }
  }

  // Return the user to an error page or home if something goes wrong
  return NextResponse.redirect(`${origin}/login?error=OAuthCallbackError`);
}
