import { supabaseAdmin } from './supabase/admin';

export interface OrderEstimationSettings {
  id: string;
  dine_in_default_minutes: number;
  takeaway_default_minutes: number;
  delivery_default_minutes: number;
  pickup_default_minutes: number;
  min_minutes: number;
  max_minutes: number;
  busy_multiplier_minutes: number;
  per_item_addition_minutes: number;
  delivery_per_km_minutes: number;
  is_busy_active: boolean;
  is_auto_estimation_active: boolean;
  is_warning_active: boolean;
  is_auto_late_active: boolean;
  is_distance_estimation_active: boolean;
  is_item_addition_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function updateOrderEstimation(orderId: string, nextStatus: string, customSupabaseAdmin?: any) {
  try {
    const client = customSupabaseAdmin || supabaseAdmin;

    // 1. Fetch current order details
    const { data: order, error: orderErr } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      console.error('Order not found for estimation update:', orderId, orderErr);
      return;
    }

    // 2. Fetch estimation settings
    const { data: settings, error: settingsErr } = await client
      .from('order_estimation_settings')
      .select('*')
      .eq('id', '88888888-8888-8888-8888-888888888888')
      .single();

    if (settingsErr || !settings) {
      console.error('Estimation settings not found:', settingsErr);
      return;
    }

    // Check if auto estimation is active
    if (!settings.is_auto_estimation_active) {
      return;
    }

    const isPendingOrConfirmed = ['pending', 'confirmed', 'processing'].includes(nextStatus);
    const isCompletedOrCancelled = ['completed', 'cancelled', 'ready'].includes(nextStatus);

    const updateData: any = {};

    // 3. If starting/transitioning to pending/confirmed/processing for the first time
    if (isPendingOrConfirmed && !order.estimated_duration_minutes) {
      // Base minutes based on order type
      let baseMinutes = settings.dine_in_default_minutes;
      if (order.order_type === 'takeaway') {
        baseMinutes = settings.takeaway_default_minutes;
      } else if (order.order_type === 'delivery') {
        baseMinutes = settings.delivery_default_minutes;
      } else if (order.order_type === 'pickup') {
        baseMinutes = settings.pickup_default_minutes;
      }

      // Add extra time per item
      let itemAddition = 0;
      if (settings.is_item_addition_active) {
        const { data: items } = await client
          .from('order_items')
          .select('quantity')
          .eq('order_id', orderId);
        
        if (items && items.length > 0) {
          const totalQty = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
          itemAddition = totalQty * settings.per_item_addition_minutes;
        }
      }

      // Add busy multiplier
      let busyAddition = 0;
      if (settings.is_busy_active) {
        busyAddition = settings.busy_multiplier_minutes;
      }

      // Add delivery distance multiplier
      let deliveryDistanceAddition = 0;
      let travelMinutes = 0;
      if (order.order_type === 'delivery' && settings.is_distance_estimation_active) {
        const distance = Number(order.distance_km || 0);
        deliveryDistanceAddition = Math.round(distance * settings.delivery_per_km_minutes);
        travelMinutes = settings.delivery_default_minutes;
      }

      let totalMinutes = baseMinutes + itemAddition + busyAddition + deliveryDistanceAddition;

      // Clamp between min and max minutes
      if (totalMinutes < settings.min_minutes) totalMinutes = settings.min_minutes;
      if (totalMinutes > settings.max_minutes) totalMinutes = settings.max_minutes;

      updateData.estimated_duration_minutes = totalMinutes;
      updateData.estimated_delivery_duration_minutes = travelMinutes || null;
      updateData.estimation_started_at = order.created_at || new Date().toISOString();
    }

    // 4. If transitioning to completed/cancelled/ready/etc
    if (isCompletedOrCancelled) {
      const startedAt = order.estimation_started_at || order.created_at;
      if (startedAt) {
        const completedAt = new Date().toISOString();
        const elapsedMinutes = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000);
        const estimatedMinutes = order.estimated_duration_minutes || 20;

        updateData.estimation_completed_at = completedAt;
        updateData.actual_duration_minutes = elapsedMinutes;
        updateData.estimation_status = elapsedMinutes <= estimatedMinutes ? 'tepat_waktu' : 'terlambat';
      }
    }

    if (Object.keys(updateData).length > 0) {
      const { error: updateErr } = await client
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (updateErr) {
        console.error('Error updating order estimation fields:', updateErr);
      }
    }
  } catch (err) {
    console.error('Error in updateOrderEstimation utility:', err);
  }
}
