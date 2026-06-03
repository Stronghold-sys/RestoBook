export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  return handleCron();
}

export async function POST(req: NextRequest) {
  return handleCron();
}

async function handleCron() {
  try {
    const supabase = getSupabaseAdmin();
    const nowStr = new Date().toISOString();

    // 1. Find all tickets that are due for chat history deletion and have not been marked as 'expired'
    const { data: expiredTickets, error: fetchError } = await supabase
      .from('support_tickets')
      .select('id, ticket_number, customer_id')
      .not('status', 'eq', 'expired')
      .not('chat_history_deleted_at', 'is', null)
      .lte('chat_history_deleted_at', nowStr);

    if (fetchError) throw fetchError;

    if (!expiredTickets || expiredTickets.length === 0) {
      return NextResponse.json({ success: true, message: 'Tidak ada riwayat chat kedaluwarsa yang perlu dihapus.' });
    }

    const ticketIds = expiredTickets.map(t => t.id);

    // 2. Delete messages in ticket_messages
    const { error: deleteMsgError } = await supabase
      .from('ticket_messages')
      .delete()
      .in('ticket_id', ticketIds);

    if (deleteMsgError) throw deleteMsgError;

    // 3. Mark the tickets themselves as 'expired'
    const { error: updateTicketError } = await supabase
      .from('support_tickets')
      .update({ status: 'expired' })
      .in('id', ticketIds);

    if (updateTicketError) throw updateTicketError;

    // 4. Send notifications to customers
    const notifs = expiredTickets.map(t => ({
      user_id: t.customer_id,
      title: 'Riwayat Chat Dihapus',
      message: `Riwayat percakapan untuk tiket ${t.ticket_number} telah dihapus otomatis sesuai pengaturan waktu sistem.`,
      type: 'support_status',
      reference_id: t.id
    }));
    await supabase.from('notifications').insert(notifs);

    return NextResponse.json({
      success: true,
      message: `Berhasil menghapus riwayat chat untuk ${expiredTickets.length} tiket.`,
      deleted_ticket_numbers: expiredTickets.map(t => t.ticket_number)
    });
  } catch (error: any) {
    console.error('Support cron cleanup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
