export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    // 1. Get current date & time in WIB (Asia/Jakarta)
    const now = new Date();
    // Offset for WIB (UTC+7)
    const wibOffset = 7 * 60 * 60 * 1000;
    const wibTime = new Date(now.getTime() + wibOffset);
    
    const year = wibTime.getUTCFullYear();
    const month = String(wibTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(wibTime.getUTCDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const hours = wibTime.getUTCHours();
    const minutes = wibTime.getUTCMinutes();
    const minutesNow = hours * 60 + minutes;
    
    // 2. Fetch reservations for today
    const { data: reservations, error } = await supabaseAdmin
      .from('reservations')
      .select('*, profiles(full_name)')
      .eq('reservation_date', dateStr)
      .eq('status', 'confirmed');
      
    if (error) throw error;
    
    const processed: any[] = [];
    
    for (const res of (reservations || [])) {
      if (!res.reservation_time) continue;
      
      // Parse reservation time "HH:MM:SS"
      const parts = res.reservation_time.split(':');
      const resHours = parseInt(parts[0]) || 0;
      const resMinutes = parseInt(parts[1]) || 0;
      const resMinutesTotal = resHours * 60 + resMinutes;
      
      // Check if starting within 30 minutes
      const diff = resMinutesTotal - minutesNow;
      
      // Parse notes
      let parsedNotes: any = {};
      try {
        parsedNotes = JSON.parse(res.notes || '{}');
      } catch (e) {}
      
      const isAlreadyPrepared = parsedNotes.kitchen_prepared === true;
      
      // If starts in <= 30 minutes, and has pre-order menu items, and not already prepared
      if (diff >= 0 && diff <= 30 && res.menu_items && Array.isArray(res.menu_items) && res.menu_items.length > 0 && !isAlreadyPrepared) {
        // Mark as prepared in notes
        const updatedNotes = JSON.stringify({
          ...parsedNotes,
          kitchen_prepared: true,
          kitchen_prepared_at: new Date().toISOString()
        });
        
        // Update reservation
        await supabaseAdmin
          .from('reservations')
          .update({ notes: updatedNotes })
          .eq('id', res.id);
          
        // Create a notification for cashier/kitchen (broad notification)
        const clientName = parsedNotes.atas_nama || res.profiles?.full_name || 'Pelanggan';
        const displayMeja = parsedNotes.meja_tambahan && parsedNotes.meja_tambahan.length > 0 
          ? parsedNotes.meja_tambahan.join(', ') 
          : 'Meja Terpilih';
          
        await supabaseAdmin.from('notifications').insert({
          title: 'Siapkan Pre-Order Menu!',
          message: `Reservasi atas nama ${clientName} (Meja: ${displayMeja}) akan dimulai dalam ${diff} menit (${res.reservation_time.substring(0, 5)} WIB). Dapur dapat mulai menyiapkan makanan.`,
          type: 'kitchen_prepare',
          status_badge: 'pending',
          user_id: res.customer_id // notify customer that preparation is starting!
        });
        
        processed.push({
          id: res.id,
          customer: clientName,
          time: res.reservation_time,
          minutesLeft: diff
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Berhasil memproses timer dapur. ${processed.length} reservasi ditandai untuk disiapkan.`,
      processed
    });
  } catch (error: any) {
    console.error('Kitchen timer error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
