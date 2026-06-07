export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { parseUserAgent } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {}
        }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the actual profile ID
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Ambil sessionId saat ini dari cookie untuk menandai "current device"
    const authCookie = cookieStore.getAll().find(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
    const currentSessionId = authCookie ? authCookie.value.slice(0, 100) : null;

    const { data: sessions, error } = await supabaseAdmin
      .from('security_user_sessions')
      .select('*')
      .eq('profile_id', profile.id)
      .eq('is_revoked', false)
      .order('last_active_at', { ascending: false });

    if (error) throw error;

    const formattedSessions = (sessions || []).map((s: any) => {
      const uaParsed = parseUserAgent(s.user_agent || '');
      return {
        id: s.id,
        sessionId: s.session_id,
        ipAddress: s.ip_address,
        country: s.country,
        city: s.city,
        timezone: s.timezone,
        lastActiveAt: s.last_active_at,
        isCurrent: s.session_id === currentSessionId,
        isSuspicious: !!s.is_suspicious,
        deviceName: s.device_name || uaParsed.device || 'Perangkat tidak dikenal',
        browser: s.browser || uaParsed.browser || 'Browser tidak dikenal',
        os: s.os || uaParsed.os || 'OS tidak dikenal'
      };
    });

    return NextResponse.json({ success: true, sessions: formattedSessions });
  } catch (error: any) {
    console.error('Devices fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {}
        }
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the actual profile ID
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { action, sessionId, isSuspicious } = await request.json();

    const authCookie = cookieStore.getAll().find(c => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
    const currentSessionId = authCookie ? authCookie.value.slice(0, 100) : null;

    if (action === 'revoke') {
      if (!sessionId) {
        return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('security_user_sessions')
        .update({ is_revoked: true, last_active_at: new Date().toISOString() })
        .eq('profile_id', profile.id)
        .eq('session_id', sessionId);

      if (error) throw error;

      return NextResponse.json({ success: true, message: 'Device session revoked' });
    }

    if (action === 'revoke_all') {
      // Keluar dari semua perangkat kecuali perangkat saat ini jika keepCurrent true
      let query = supabaseAdmin
        .from('security_user_sessions')
        .update({ is_revoked: true, last_active_at: new Date().toISOString() })
        .eq('profile_id', profile.id);

      if (currentSessionId) {
        query = query.neq('session_id', currentSessionId);
      }

      const { error } = await query;
      if (error) throw error;

      // Catat log keamanan
      const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '127.0.0.1';
      const userAgent = request.headers.get('user-agent') || '';
      const { browser, device } = parseUserAgent(userAgent);

      await supabaseAdmin.from('security_logs').insert({
        user_id: user.id,
        ip_address: clientIP,
        browser,
        device,
        user_agent: userAgent,
        activity: 'LOGOUT_ALL_DEVICES',
        endpoint: '/api/profile/devices',
        status: 'success'
      });

      return NextResponse.json({ success: true, message: 'All other devices logged out' });
    }

    if (action === 'suspicious') {
      if (!sessionId) {
        return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
      }

      const { error } = await supabaseAdmin
        .from('security_user_sessions')
        .update({ is_suspicious: isSuspicious ?? true })
        .eq('profile_id', profile.id)
        .eq('session_id', sessionId);

      if (error) throw error;

      // Log suspicious activity
      const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '127.0.0.1';
      const userAgent = request.headers.get('user-agent') || '';
      const { browser, device } = parseUserAgent(userAgent);

      await supabaseAdmin.from('security_logs').insert({
        user_id: user.id,
        ip_address: clientIP,
        browser,
        device,
        user_agent: userAgent,
        activity: 'DEVICE_MARKED_SUSPICIOUS',
        endpoint: '/api/profile/devices',
        status: 'success'
      });

      return NextResponse.json({ success: true, message: 'Device status updated' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Devices POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
