export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();
  return profile?.role === 'admin' ? user : null;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient();
    const isAdmin = await checkAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Akses ditolak. Khusus Admin.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const urgency = searchParams.get('urgency');
    const category = searchParams.get('category');
    const search = searchParams.get('search'); // ticket number or customer name

    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (urgency) {
      query = query.eq('urgency', urgency);
    }
    if (category) {
      query = query.eq('category', category);
    }

    const { data: tickets, error } = await query;
    if (error) throw error;

    // Fetch profiles separately to ensure all tickets are retrieved
    const customerIds = tickets
      .map((t: any) => t.customer_id)
      .filter((value: any, index: number, self: any[]) => self.indexOf(value) === index);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', customerIds);

    const profileMap = (profiles || []).reduce((acc: any, p: any) => {
      acc[p.id] = p;
      return acc;
    }, {});

    let filteredTickets = tickets.map((ticket: any) => ({
      ...ticket,
      profiles: profileMap[ticket.customer_id] || null
    }));

    // Client-side filtering if search term is provided (covers customer name or ticket number)
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTickets = filteredTickets.filter((ticket: any) => {
        const tNum = ticket.ticket_number?.toLowerCase() || '';
        const cName = ticket.profiles?.full_name?.toLowerCase() || '';
        const cEmail = ticket.profiles?.email?.toLowerCase() || '';
        return tNum.includes(searchLower) || cName.includes(searchLower) || cEmail.includes(searchLower);
      });
    }

    return NextResponse.json(filteredTickets);
  } catch (error: any) {
    console.error('Admin support tickets list error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
