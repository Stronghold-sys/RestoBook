export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { orderId, splitItems } = await req.json();

    if (!orderId || !splitItems || splitItems.length === 0) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Fetch original order
    const { data: originalOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !originalOrder) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    // 2. Fetch original order items
    const { data: originalItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemsError || !originalItems) {
      throw itemsError;
    }

    // 3. Create new order
    const { data: newOrder, error: newOrderError } = await supabaseAdmin
      .from('orders')
      .insert({
        customer_id: originalOrder.customer_id,
        table_id: originalOrder.table_id,
        order_type: originalOrder.order_type,
        status: originalOrder.status,
        payment_status: 'unpaid',
        payment_method: null,
        total_amount: 0,
        notes: `[SPLIT DARI #${orderId.split('-')[0]}] ${originalOrder.notes || ''}`
      })
      .select()
      .single();

    if (newOrderError) throw newOrderError;

    let newOrderTotal = 0;
    let originalOrderTotal = originalOrder.total_amount;

    // 4. Process split items
    for (const splitItem of splitItems) {
      const origItem = originalItems.find((i: any) => i.id === splitItem.id);
      if (!origItem) continue;

      const splitQty = Math.min(splitItem.quantity, origItem.quantity);
      if (splitQty <= 0) continue;

      const itemPrice = Number(origItem.price);
      const splitSubtotal = splitQty * itemPrice;

      // Add to new order
      await supabaseAdmin.from('order_items').insert({
        order_id: newOrder.id,
        menu_item_id: origItem.menu_item_id,
        quantity: splitQty,
        price: itemPrice,
        subtotal: splitSubtotal,
        notes: origItem.notes
      });

      newOrderTotal += splitSubtotal;
      originalOrderTotal -= splitSubtotal;

      // Update or delete from original order
      const remainingQty = origItem.quantity - splitQty;
      if (remainingQty > 0) {
        await supabaseAdmin.from('order_items').update({
          quantity: remainingQty,
          subtotal: remainingQty * itemPrice
        }).eq('id', origItem.id);
      } else {
        await supabaseAdmin.from('order_items').delete().eq('id', origItem.id);
      }
    }

    // 5. Update totals
    await supabaseAdmin.from('orders').update({ total_amount: newOrderTotal }).eq('id', newOrder.id);
    await supabaseAdmin.from('orders').update({ total_amount: originalOrderTotal }).eq('id', originalOrder.id);

    return NextResponse.json({ success: true, newOrderId: newOrder.id });

  } catch (error: any) {
    console.error('Split Bill Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
