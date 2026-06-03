export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  return profile?.role === 'admin' ? user : null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: settings, error } = await supabase
      .from('support_settings')
      .select('*')
      .eq('id', '77777777-7777-7777-7777-777777777777')
      .single();

    if (error || !settings) {
      // In case seeding didn't run or deleted, fallback/upsert default values
      const defaultSettings = {
        id: '77777777-7777-7777-7777-777777777777',
        chat_expiry_hours: 0,
        chat_expiry_minutes: 30,
        chat_expiry_seconds: 0,
        sla_hours_low: 48,
        sla_hours_medium: 24,
        sla_hours_high: 12,
        sla_hours_urgent: 4
      };
      return NextResponse.json(defaultSettings);
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
    }

    const body = await req.json();
    const {
      chat_expiry_hours,
      chat_expiry_minutes,
      chat_expiry_seconds,
      sla_hours_low,
      sla_hours_medium,
      sla_hours_high,
      sla_hours_urgent
    } = body;

    const { data: updatedSettings, error } = await supabase
      .from('support_settings')
      .update({
        chat_expiry_hours: Number(chat_expiry_hours ?? 0),
        chat_expiry_minutes: Number(chat_expiry_minutes ?? 30),
        chat_expiry_seconds: Number(chat_expiry_seconds ?? 0),
        sla_hours_low: Number(sla_hours_low ?? 48),
        sla_hours_medium: Number(sla_hours_medium ?? 24),
        sla_hours_high: Number(sla_hours_high ?? 12),
        sla_hours_urgent: Number(sla_hours_urgent ?? 4),
        updated_at: new Date().toISOString()
      })
      .eq('id', '77777777-7777-7777-7777-777777777777')
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error: any) {
    console.error('Support settings update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
