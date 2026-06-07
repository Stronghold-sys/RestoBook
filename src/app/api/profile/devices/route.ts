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

    const ipAddress = request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-real-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      '127.0.0.1';
    
    const userAgent = request.headers.get('user-agent') || '';
    const cfCountry = request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country') || 'Indonesia';
    const cfCity = request.headers.get('x-vercel-ip-city') || 'Jakarta';
    const cfTimezone = request.headers.get('x-vercel-ip-timezone') || 'Asia/Jakarta';
    const cfAsn = request.headers.get('x-vercel-ip-asn') || 'Unknown';
    const uaParsed = parseUserAgent(userAgent);

    if (currentSessionId) {
      // Upsert current session so it's always recorded
      await supabaseAdmin.from('security_user_sessions').upsert({
        profile_id: profile.id,
        session_id: currentSessionId,
        ip_address: ipAddress,
        user_agent: userAgent,
        country: cfCountry,
        city: cfCity,
        timezone: cfTimezone,
        asn: cfAsn,
        last_active_at: new Date().toISOString(),
        is_revoked: false,
        device_name: uaParsed.device || 'Perangkat tidak dikenal',
        browser: uaParsed.browser || 'Browser tidak dikenal',
        os: uaParsed.os || 'OS tidak dikenal'
      }, { onConflict: 'session_id' });
    }

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
        isCurrent: currentSessionId ? s.session_id === currentSessionId : true,
        isSuspicious: !!s.is_suspicious,
        deviceName: s.device_name || uaParsed.device || 'Perangkat tidak dikenal',
        browser: s.browser || uaParsed.browser || 'Browser tidak dikenal',
        os: s.os || uaParsed.os || 'OS tidak dikenal'
      };
    });

    // Fallback if no current device session found in query results
    const hasCurrent = formattedSessions.some((s: any) => s.isCurrent);
    if (!hasCurrent || formattedSessions.length === 0) {
      formattedSessions.unshift({
        id: 'current-fallback',
        sessionId: currentSessionId || 'current',
        ipAddress: ipAddress,
        country: cfCountry,
        city: cfCity,
        timezone: cfTimezone,
        lastActiveAt: new Date().toISOString(),
        isCurrent: true,
        isSuspicious: false,
        deviceName: uaParsed.device || 'Perangkat Saat Ini',
        browser: uaParsed.browser || 'Browser Saat Ini',
        os: uaParsed.os || 'OS Saat Ini'
      });
    }

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
