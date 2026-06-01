export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { sourceOrderId, targetOrderId } = await req.json();

    if (!sourceOrderId || !targetOrderId || sourceOrderId === targetOrderId) {
      return NextResponse.json({ error: 'Parameter pesanan tidak valid' }, { status: 400 });
    }

    // 1. Fetch both orders
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .in('id', [sourceOrderId, targetOrderId]);

    if (ordersError || !orders || orders.length !== 2) {
      return NextResponse.json({ error: 'Salah satu atau kedua pesanan tidak ditemukan' }, { status: 404 });
    }

    const sourceOrder = orders.find((o: any) => o.id === sourceOrderId);
    const targetOrder = orders.find((o: any) => o.id === targetOrderId);

    // 2. Fetch order items for source
    const { data: sourceItems, error: itemsError } = await supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', sourceOrderId);

    if (itemsError || !sourceItems) throw itemsError;

    // 3. Move items to target
    for (const item of sourceItems) {
      // Check if item already exists in target
      const { data: targetItems } = await supabaseAdmin
        .from('order_items')
        .select('*')
        .eq('order_id', targetOrderId)
        .eq('menu_item_id', item.menu_item_id);

      if (targetItems && targetItems.length > 0) {
        // Update existing item
        const existingItem = targetItems[0];
        await supabaseAdmin.from('order_items').update({
          quantity: existingItem.quantity + item.quantity,
          subtotal: Number(existingItem.subtotal) + Number(item.subtotal)
        }).eq('id', existingItem.id);
      } else {
        // Insert new item
        await supabaseAdmin.from('order_items').insert({
          order_id: targetOrderId,
          menu_item_id: item.menu_item_id,
          quantity: item.quantity,
          price: item.price,
          subtotal: item.subtotal,
          notes: item.notes
        });
      }
    }

    // 4. Update target total amount
    const newTotal = Number(targetOrder.total_amount) + Number(sourceOrder.total_amount);
    
    // Create new merged notes
    const newNotes = targetOrder.notes 
      ? `${targetOrder.notes} | [GABUNGAN DARI #${sourceOrderId.split('-')[0]}]`
      : `[GABUNGAN DARI #${sourceOrderId.split('-')[0]}]`;

    await supabaseAdmin.from('orders').update({ 
      total_amount: newTotal,
      notes: newNotes
    }).eq('id', targetOrderId);

    // 5. Delete source order
    // Because of foreign keys, we might need to delete items first, but since we didn't delete sourceItems yet:
    await supabaseAdmin.from('order_items').delete().eq('order_id', sourceOrderId);
    await supabaseAdmin.from('orders').delete().eq('id', sourceOrderId);

    // If source had a table_id different from target, we might want to free it, but usually merge implies they merged tables.
    if (sourceOrder.table_id && sourceOrder.table_id !== targetOrder.table_id) {
      await supabaseAdmin.from('tables').update({ status: 'available' }).eq('id', sourceOrder.table_id);
    }

    return NextResponse.json({ success: true, targetOrderId: targetOrderId });

  } catch (error: any) {
    console.error('Merge Orders Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
