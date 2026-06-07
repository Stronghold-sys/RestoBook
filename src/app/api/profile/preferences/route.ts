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

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        theme, notif_booking, notif_payment, notif_promo, notif_security, notif_reminder,
        email_promo, email_booking, email_transaction, email_security,
        favorite_branch, favorite_payment_method,
        booking_default_guests, booking_favorite_area, booking_smoking, booking_indoor, booking_notes,
        booking_calendar_view, privacy_profile_visibility, privacy_data_consent,
        address, birthdate
      `)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, preferences: profile });
  } catch (error: any) {
    console.error('Preferences GET error:', error);
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

    const body = await request.json();

    // Whitelist columns to prevent arbitrary SQL injection
    const allowedKeys = [
      'theme', 'notif_booking', 'notif_payment', 'notif_promo', 'notif_security', 'notif_reminder',
      'email_promo', 'email_booking', 'email_transaction', 'email_security',
      'favorite_branch', 'favorite_payment_method',
      'booking_default_guests', 'booking_favorite_area', 'booking_smoking', 'booking_indoor', 'booking_notes',
      'booking_calendar_view', 'privacy_profile_visibility', 'privacy_data_consent',
      'address', 'birthdate'
    ];

    const updateData: any = {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }

    updateData.updated_at = new Date().toISOString();

    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('user_id', user.id);

    if (error) throw error;

    // Tambahkan log aktivitas
    const clientIP = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = request.headers.get('user-agent') || '';
    const { browser, device } = parseUserAgent(userAgent);

    await supabaseAdmin.from('security_logs').insert({
      user_id: user.id,
      ip_address: clientIP,
      browser,
      device,
      user_agent: userAgent,
      activity: 'UPDATE_PREFERENCES',
      endpoint: '/api/profile/preferences',
      status: 'success'
    });

    return NextResponse.json({ success: true, message: 'Preferences updated successfully' });
  } catch (error: any) {
    console.error('Preferences POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
