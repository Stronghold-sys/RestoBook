export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('customer_id')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    // Security check: only ticket owner or admin can read messages
    if (profile.role !== 'admin' && ticket.customer_id !== profile.id) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    // Fetch messages
    const { data: messages, error } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Optional: mark messages as read if the recipient is viewing them
    if (messages && messages.length > 0) {
      const unreadFromOthers = messages.filter(
        (m: any) => m.sender_id !== profile.id && !m.is_read
      );
      if (unreadFromOthers.length > 0) {
        const ids = unreadFromOthers.map((m: any) => m.id);
        await supabase
          .from('ticket_messages')
          .update({ is_read: true })
          .in('id', ids);
      }
    }

    return NextResponse.json(messages || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
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
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    const isAdmin = profile.role === 'admin';
    const isOwner = ticket.customer_id === profile.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await req.json();
    const { message, attachment_url } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: 'Pesan tidak boleh kosong' }, { status: 400 });
    }

    // Check status constraints
    if (ticket.status === 'completed' || ticket.status === 'closed' || ticket.status === 'expired') {
      return NextResponse.json(
        { error: 'Percakapan telah berakhir. Anda tidak dapat mengirim pesan lagi.' },
        { status: 400 }
      );
    }

    // Check customer-specific constraints (admin must start chat first)
    if (!isAdmin && !ticket.chat_started_at) {
      return NextResponse.json(
        { error: 'Chat belum dimulai oleh admin. Silakan tunggu tim kami memulai percakapan.' },
        { status: 400 }
      );
    }

    let updatedTicket = ticket;

    // Admin starts the chat automatically upon sending first message
    if (isAdmin && !ticket.chat_started_at) {
      const nowStr = new Date().toISOString();
      const { data: ut, error: updateErr } = await supabase
        .from('support_tickets')
        .update({
          chat_started_at: nowStr,
          status: 'processing',
          updated_at: nowStr
        })
        .eq('id', ticketId)
        .select()
        .single();
      
      if (updateErr) throw updateErr;
      updatedTicket = ut;

      // Notify customer that admin started the chat
      await supabase.from('notifications').insert({
        user_id: ticket.customer_id,
        title: 'Percakapan Dimulai oleh Admin',
        message: `Admin ${profile.full_name} telah membuka saluran live chat untuk tiket ${ticket.ticket_number}.`,
        type: 'support_chat',
        reference_id: ticketId,
        status_badge: 'Diproses'
      });
    } else {
      // Regular message update timestamp
      await supabase
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', ticketId);
    }

    // Insert message
    const { data: newMsg, error: msgError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticketId,
        sender_id: profile.id,
        message: message.trim(),
        attachment_url: attachment_url || null,
        is_read: false
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Send notifications for new messages
    if (isAdmin) {
      // Notify customer
      await supabase.from('notifications').insert({
        user_id: ticket.customer_id,
        title: 'Pesan Baru dari Admin',
        message: `${profile.full_name} membalas tiket Anda: "${message.substring(0, 40)}${message.length > 40 ? '...' : ''}"`,
        type: 'support_message',
        reference_id: ticketId
      });
    } else {
      // Notify assigned admin or all admins if unassigned
      const adminTarget = ticket.assigned_to;
      if (adminTarget) {
        await supabase.from('notifications').insert({
          user_id: adminTarget,
          title: 'Pesan Baru dari Pelanggan',
          message: `${profile.full_name} membalas tiket ${ticket.ticket_number}: "${message.substring(0, 40)}${message.length > 40 ? '...' : ''}"`,
          type: 'support_message',
          reference_id: ticketId
        });
      } else {
        const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
        if (admins && admins.length > 0) {
          const notifs = admins.map((adm) => ({
            user_id: adm.id,
            title: 'Pesan Baru (Tiket Belum Ditugaskan)',
            message: `${profile.full_name} membalas tiket ${ticket.ticket_number}: "${message.substring(0, 40)}${message.length > 40 ? '...' : ''}"`,
            type: 'support_message',
            reference_id: ticketId
          }));
          await supabase.from('notifications').insert(notifs);
        }
      }
    }

    return NextResponse.json({ success: true, message: newMsg, ticket: updatedTicket });
  } catch (error: any) {
    console.error('Send ticket message error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/support/ticket/[id]/chat -> Starts the chat explicitly by admin
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

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
    }

    const ticketId = params.id;
    const nowStr = new Date().toISOString();

    const { data: ticket, error: fetchErr } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (fetchErr || !ticket) {
      return NextResponse.json({ error: 'Tiket tidak ditemukan' }, { status: 404 });
    }

    if (ticket.chat_started_at) {
      return NextResponse.json({ success: true, message: 'Chat sudah aktif', ticket });
    }

    const { data: updatedTicket, error: updateErr } = await supabase
      .from('support_tickets')
      .update({
        chat_started_at: nowStr,
        status: 'processing',
        updated_at: nowStr
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Notify customer
    await supabase.from('notifications').insert({
      user_id: ticket.customer_id,
      title: 'Percakapan Dimulai oleh Admin',
      message: `Admin ${profile.full_name} telah membuka saluran live chat untuk tiket ${ticket.ticket_number}.`,
      type: 'support_chat',
      reference_id: ticketId,
      status_badge: 'Diproses'
    });

    // Add a system log message
    await supabase.from('ticket_messages').insert({
      ticket_id: ticketId,
      sender_id: profile.id,
      message: `[SISTEM] Percakapan live chat dimulai oleh Admin ${profile.full_name}.`
    });

    return NextResponse.json({ success: true, ticket: updatedTicket });
  } catch (error: any) {
    console.error('Start support chat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
