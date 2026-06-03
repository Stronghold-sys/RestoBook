export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get('chatId') || undefined;
  const ticketId = searchParams.get('ticketId') || undefined;
  return handleCron(chatId, ticketId);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return handleCron(body.chatId, body.ticketId);
  } catch (e) {
    return handleCron();
  }
}

async function handleCron(targetChatId?: string, targetTicketId?: string) {
  try {
    const supabase = getSupabaseAdmin();
    // Allow 15 seconds of leeway for client-server clock drift
    const nowStr = new Date(Date.now() + 15000).toISOString();
    let processedTicketsCount = 0;
    let processedOrderChatsCount = 0;
    const deletedTicketNumbers: string[] = [];

    // 1. Process support tickets
    let ticketQuery = supabase
      .from('support_tickets')
      .select('id, ticket_number, customer_id')
      .not('status', 'eq', 'expired')
      .not('chat_history_deleted_at', 'is', null);

    if (targetTicketId) {
      ticketQuery = ticketQuery.eq('id', targetTicketId).lte('chat_history_deleted_at', nowStr);
    } else {
      ticketQuery = ticketQuery.lte('chat_history_deleted_at', nowStr);
    }

    const { data: expiredTickets, error: fetchError } = await ticketQuery;

    if (fetchError) throw fetchError;

    if (expiredTickets && expiredTickets.length > 0) {
      const ticketIds = expiredTickets.map(t => t.id);

      // Delete messages in ticket_messages
      const { error: deleteMsgError } = await supabase
        .from('ticket_messages')
        .delete()
        .in('ticket_id', ticketIds);

      if (deleteMsgError) throw deleteMsgError;

      // Mark the tickets themselves as 'expired'
      const { error: updateTicketError } = await supabase
        .from('support_tickets')
        .update({ status: 'expired' })
        .in('id', ticketIds);

      if (updateTicketError) throw updateTicketError;

      // Send notifications to customers
      const notifs = expiredTickets.map(t => ({
        user_id: t.customer_id,
        title: 'Riwayat Chat Dihapus',
        message: `Riwayat percakapan untuk tiket ${t.ticket_number} telah dihapus otomatis sesuai pengaturan waktu sistem.`,
        type: 'support_status',
        reference_id: t.id
      }));
      await supabase.from('notifications').insert(notifs);

      processedTicketsCount = expiredTickets.length;
      deletedTicketNumbers.push(...expiredTickets.map(t => t.ticket_number));
    }

    // 2. Process order chats
    let orderChatQuery = supabase
      .from('order_chats')
      .select('id, order_id, customer_id')
      .not('status', 'eq', 'expired')
      .not('chat_history_deleted_at', 'is', null);

    if (targetChatId) {
      orderChatQuery = orderChatQuery.eq('id', targetChatId).lte('chat_history_deleted_at', nowStr);
    } else {
      orderChatQuery = orderChatQuery.lte('chat_history_deleted_at', nowStr);
    }

    const { data: expiredOrderChats, error: fetchOrderError } = await orderChatQuery;

    if (fetchOrderError) throw fetchOrderError;

    if (expiredOrderChats && expiredOrderChats.length > 0) {
      const orderChatIds = expiredOrderChats.map(c => c.id);

      // Delete messages in order_chat_messages
      const { error: deleteOrderMsgError } = await supabase
        .from('order_chat_messages')
        .delete()
        .in('chat_id', orderChatIds);

      if (deleteOrderMsgError) throw deleteOrderMsgError;

      // Update order chats status to 'expired'
      const { error: updateOrderChatError } = await supabase
        .from('order_chats')
        .update({ status: 'expired' })
        .in('id', orderChatIds);

      if (updateOrderChatError) throw updateOrderChatError;

      // Send notifications to customers
      const orderNotifs = expiredOrderChats.map(c => ({
        user_id: c.customer_id,
        title: 'Riwayat Obrolan Pesanan Dihapus',
        message: `Riwayat percakapan untuk pesanan #${c.order_id?.substring(0, 8).toUpperCase()} telah dihapus otomatis sesuai pengaturan waktu sistem.`,
        type: 'support_status',
        reference_id: c.id
      }));
      await supabase.from('notifications').insert(orderNotifs);

      processedOrderChatsCount = expiredOrderChats.length;
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil menghapus riwayat chat untuk ${processedTicketsCount} tiket dan ${processedOrderChatsCount} obrolan pesanan.`,
      deleted_ticket_numbers: deletedTicketNumbers
    });
  } catch (error: any) {
    console.error('Support cron cleanup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
