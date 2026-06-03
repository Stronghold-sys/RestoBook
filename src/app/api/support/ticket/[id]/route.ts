export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, id')
    .eq('user_id', user.id)
    .single();
  return profile?.role === 'admin' ? profile : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    const ticketId = params.id;
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .select('*, profiles(full_name, email)')
      .eq('id', ticketId)
      .single();

    if (error || !ticket) {
      return NextResponse.json({ error: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    // Security: Only the ticket owner or admin can read it
    if (profile.role !== 'admin' && ticket.customer_id !== profile.id) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    return NextResponse.json(ticket);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, id, full_name')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    const ticketId = params.id;
    const { data: currentTicket, error: fetchError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (fetchError || !currentTicket) {
      return NextResponse.json({ error: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    // Check permissions: only admin can modify ticket fields for now, or customer can close their own ticket
    const body = await req.json();
    const { status, urgency, assigned_to } = body;

    const isOwner = currentTicket.customer_id === profile.id;
    const isAdmin = profile.role === 'admin';

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    // Non-admin can only update status to 'closed' or 'completed'
    if (!isAdmin && status && status !== 'closed' && status !== 'completed') {
      return NextResponse.json({ error: 'Pelanggan hanya diperbolehkan menutup tiket' }, { status: 403 });
    }

    const updateFields: any = {
      updated_at: new Date().toISOString()
    };

    if (status) updateFields.status = status;
    if (urgency && isAdmin) updateFields.urgency = urgency;
    if (assigned_to !== undefined && isAdmin) updateFields.assigned_to = assigned_to;

    // Handle closing/locking logic
    if (status === 'completed' || status === 'closed') {
      updateFields.chat_closed_at = new Date().toISOString();

      // Read support settings to compute deletion time
      const { data: settings } = await supabase
        .from('support_settings')
        .select('*')
        .eq('id', '77777777-7777-7777-7777-777777777777')
        .single();

      let delayMs = 30 * 60 * 1000; // default 30 mins
      if (settings) {
        const hours = settings.chat_expiry_hours ?? 0;
        const minutes = settings.chat_expiry_minutes ?? 30;
        const seconds = settings.chat_expiry_seconds ?? 0;
        delayMs = ((hours * 3600) + (minutes * 60) + seconds) * 1000;
      }

      updateFields.chat_history_deleted_at = new Date(Date.now() + delayMs).toISOString();

      // Create notification for customer
      await supabase.from('notifications').insert({
        user_id: currentTicket.customer_id,
        title: status === 'completed' ? 'Tiket Telah Selesai' : 'Tiket Telah Ditutup',
        message: status === 'completed' 
          ? `Tiket ${currentTicket.ticket_number} telah diselesaikan oleh ${profile.role === 'admin' ? 'Admin' : 'Anda'}. Percakapan dikunci.`
          : `Tiket ${currentTicket.ticket_number} telah ditutup. Percakapan dikunci.`,
        type: 'support_status',
        reference_id: currentTicket.id,
        status_badge: status === 'completed' ? 'Selesai' : 'Batal'
      });
    } else if (status === 'processing') {
      // If status moved back to processing or set to processing
      if (!currentTicket.chat_started_at) {
        updateFields.chat_started_at = new Date().toISOString();
      }
      
      // Notify customer that ticket is being processed
      await supabase.from('notifications').insert({
        user_id: currentTicket.customer_id,
        title: 'Tiket Sedang Diproses',
        message: `Tiket ${currentTicket.ticket_number} Anda sedang diproses oleh tim bantuan kami.`,
        type: 'support_status',
        reference_id: currentTicket.id,
        status_badge: 'Diproses'
      });
    } else if (status === 'waiting_info') {
      // Notify customer that additional info is needed
      await supabase.from('notifications').insert({
        user_id: currentTicket.customer_id,
        title: 'Menunggu Informasi Tambahan',
        message: `Kami memerlukan informasi tambahan untuk memproses tiket ${currentTicket.ticket_number} Anda.`,
        type: 'support_status',
        reference_id: currentTicket.id,
        status_badge: 'Menunggu Konfirmasi'
      });
    }

    const { data: updatedTicket, error: updateError } = await supabase
      .from('support_tickets')
      .update(updateFields)
      .eq('id', ticketId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log activity of status change if updated
    if (status && status !== currentTicket.status) {
      let systemMsg = '';
      if (status === 'closed') {
        if (!isAdmin && body.cancellation_reason) {
          systemMsg = `[SISTEM] Tiket dibatalkan oleh Pelanggan. Alasan: ${body.cancellation_reason}`;
        } else if (isAdmin) {
          systemMsg = `[SISTEM] Tiket ditutup oleh Admin ${profile.full_name}.`;
        } else {
          systemMsg = `[SISTEM] Tiket ditutup oleh Pelanggan.`;
        }
      } else {
        systemMsg = `[SISTEM] Status tiket diubah menjadi: ${
          status === 'pending' ? 'Menunggu Tanggapan' :
          status === 'processing' ? 'Diproses' :
          status === 'waiting_info' ? 'Menunggu Informasi Tambahan' :
          status === 'completed' ? 'Selesai' : status
        } oleh ${profile.full_name || 'Admin'}.`;
      }
      
      await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_id: profile.id, // System updates logged under updater
        message: systemMsg
      });
    }

    return NextResponse.json({ success: true, ticket: updatedTicket });
  } catch (error: any) {
    console.error('Update support ticket error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
