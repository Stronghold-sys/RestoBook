import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function checkMaintenanceActive() {
  try {
    // 1. Fetch maintenance status
    const { data: settings } = await supabaseAdmin
      .from('restaurant_settings')
      .select('is_maintenance_active, maintenance_message')
      .single();

    if (settings?.is_maintenance_active) {
      // 2. Try to get the current user session
      try {
        const supabase = createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Fetch user profile to check if they are admin
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single();

          // Admin is exempt from maintenance restrictions (can still operate settings and view history)
          if (profile?.role === 'admin') {
            return null;
          }
        }
      } catch (authError) {
        // If not authenticated or cookies not available (e.g. static/edge calls)
        console.error("Auth check failed in maintenance check:", authError);
      }

      // If active and user is not admin, return 503 Maintenance response
      return NextResponse.json({
        error: settings.maintenance_message || 'Sistem sedang dalam perbaikan untuk meningkatkan layanan. Sementara ini, proses transaksi dan pembayaran belum dapat digunakan. Silakan coba kembali nanti.',
        code: 'MAINTENANCE_ACTIVE'
      }, { status: 503 });
    }
  } catch (error) {
    console.error("Error in checkMaintenanceActive:", error);
  }
  return null;
}
