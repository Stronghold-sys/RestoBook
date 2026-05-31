export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

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

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
    }

    const body = await req.json();
    const { 
      minRandomPoints, 
      maxRandomPoints, 
      isPointsEnabled, 
      pointsExpiryDays, 
      maxPointsPerTransaction,
      bonusNewCustomer,
      bonusBirthday,
      multiplier,
      bonusEventName,
      bonusEventPoints,
      bonusDayOfWeek,
      bonusDayMultiplier
    } = body;

    // Get the first setting row ID
    const { data: settings } = await supabaseAdmin.from('restaurant_settings').select('id').single();
    if (!settings) {
      return NextResponse.json({ error: 'Pengaturan restoran belum diinisialisasi' }, { status: 404 });
    }

    const { data: updatedSettings, error: updateError } = await supabaseAdmin
      .from('restaurant_settings')
      .update({
        min_random_points: Number(minRandomPoints),
        max_random_points: Number(maxRandomPoints),
        is_points_enabled: !!isPointsEnabled,
        points_expiry_days: Number(pointsExpiryDays),
        max_points_per_transaction: Number(maxPointsPerTransaction),
        bonus_new_customer: Number(bonusNewCustomer),
        bonus_birthday: Number(bonusBirthday),
        multiplier: Number(multiplier),
        bonus_event_name: bonusEventName || '',
        bonus_event_points: Number(bonusEventPoints),
        bonus_day_of_week: Number(bonusDayOfWeek),
        bonus_day_multiplier: Number(bonusDayMultiplier),
        updated_at: new Date().toISOString()
      })
      .eq('id', settings.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, settings: updatedSettings });
  } catch (error: any) {
    console.error('Admin update points settings error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
