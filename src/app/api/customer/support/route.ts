export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('customer_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(tickets);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    const body = await req.json();
    const { title, category, subcategory, description, attachment_url, urgency, contact_info } = body;

    if (!title || !category || !description) {
      return NextResponse.json({ error: 'Judul, kategori, dan deskripsi wajib diisi' }, { status: 400 });
    }

    const ticketUrgency = urgency || 'medium';

    // 1. Get Support Settings to compute SLA
    const { data: settings } = await supabase
      .from('support_settings')
      .select('*')
      .eq('id', '77777777-7777-7777-7777-777777777777')
      .single();

    let slaHours = 24;
    if (settings) {
      if (ticketUrgency === 'low') slaHours = settings.sla_hours_low ?? 48;
      else if (ticketUrgency === 'medium') slaHours = settings.sla_hours_medium ?? 24;
      else if (ticketUrgency === 'high') slaHours = settings.sla_hours_high ?? 12;
      else if (ticketUrgency === 'urgent') slaHours = settings.sla_hours_urgent ?? 4;
    }

    const now = new Date();
    const slaDeadline = new Date(now.getTime() + slaHours * 60 * 60 * 1000).toISOString();

    // 2. Generate unique Ticket Number (numeric code like TKT-YYYYMMDD-XXXX)
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randCode = Math.floor(1000 + Math.random() * 9000);
    const ticketNumber = `TKT-${dateStr}-${randCode}`;

    // 3. Save to database
    const { data: ticket, error: insertError } = await supabase
      .from('support_tickets')
      .insert({
        ticket_number: ticketNumber,
        customer_id: profile.id,
        title,
        category,
        subcategory: subcategory || null,
        description,
        attachment_url: attachment_url || null,
        urgency: ticketUrgency,
        contact_info: contact_info || null,
        status: 'pending',
        sla_deadline: slaDeadline,
        source: 'manual'
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 4. Create internal System Notification for admins about the new ticket
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      const notifs = admins.map((adm) => ({
        user_id: adm.id,
        title: 'Pengaduan Baru Masuk',
        message: `Pengaduan manual ${ticketNumber} baru saja dibuat oleh ${profile.full_name}. Kategori: ${category}.`,
        type: 'admin_support',
        reference_id: ticket.id,
        status_badge: 'Baru'
      }));
      await supabase.from('notifications').insert(notifs);
    }

    return NextResponse.json({
      success: true,
      message: `Pengaduan Anda telah diterima. Nomor tiket Anda adalah: ${ticketNumber}. Tim kami akan meninjau dan membalas secepatnya.`,
      ticket
    });
  } catch (error: any) {
    console.error('Create support ticket error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
