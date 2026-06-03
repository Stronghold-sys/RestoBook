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
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['cashier', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    // 1. Ambil data ruang chat beserta pesanan & profil pelanggan
    const { data: chats, error: chatsErr } = await supabase
      .from('order_chats')
      .select(`
        *,
        order:orders(
          id, 
          order_type, 
          status, 
          total_amount, 
          payment_method, 
          payment_status, 
          notes,
          created_at,
          tables(table_number)
        ),
        customer:profiles!order_chats_customer_id_fkey(
          id,
          full_name,
          email,
          phone,
          avatar_url
        ),
        cashier:profiles!order_chats_cashier_id_fkey(
          full_name
        )
      `)
      .order('updated_at', { ascending: false });

    if (chatsErr) throw chatsErr;

    // 2. Tambah metadata pesan terakhir & unread badge
    const chatsWithMetadata = await Promise.all((chats || []).map(async (chat) => {
      // Ambil pesan terbaru
      const { data: lastMsg } = await supabase
        .from('order_chat_messages')
        .select('*')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Hitung jumlah pesan belum dibaca dari pelanggan
      const { count } = await supabase
        .from('order_chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('chat_id', chat.id)
        .eq('is_read', false)
        .eq('sender_role', 'customer');

      return {
        ...chat,
        last_message: lastMsg || null,
        unread_count: count || 0
      };
    }));

    return NextResponse.json(chatsWithMetadata);
  } catch (error: any) {
    console.error('GET cashier chats error:', error);
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
      .select('id, role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['cashier', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    const body = await req.json();
    const { chatId, message, attachment_url, action } = body;

    if (!chatId) {
      return NextResponse.json({ error: 'chatId wajib diisi' }, { status: 400 });
    }

    // 1. Ambil detail ruang chat
    const { data: chat, error: chatErr } = await supabase
      .from('order_chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (chatErr || !chat) {
      return NextResponse.json({ error: 'Ruang obrolan tidak ditemukan' }, { status: 404 });
    }

    // 2. Jika ada aksi perubahan status / blokir chat
    if (action) {
      const updateData: any = { updated_at: new Date().toISOString() };
      
      if (action === 'mark_completed') {
        updateData.status = 'completed';
        // Kirim pesan sistem otomatis
        await supabase.from('order_chat_messages').insert({
          chat_id: chatId,
          sender_role: 'ai',
          message: 'Percakapan ini telah diselesaikan oleh kasir. Jika Anda masih memerlukan bantuan, silakan hubungi kami melalui menu Pengaduan & Bantuan di aplikasi.',
          is_read: false
        });
      } else if (action === 'need_admin') {
        updateData.status = 'need_admin';
      } else if (action === 'waiting_customer') {
        updateData.status = 'waiting_customer';
      } else if (action === 'reactivate') {
        updateData.status = 'active';
      } else if (action === 'block') {
        updateData.is_blocked = true;
      } else if (action === 'unblock') {
        updateData.is_blocked = false;
      }

      const { data: updatedChat, error: updateErr } = await supabase
        .from('order_chats')
        .update(updateData)
        .eq('id', chatId)
        .select()
        .single();

      if (updateErr) throw updateErr;
      return NextResponse.json({ success: true, chat: updatedChat });
    }

    if (!message && !attachment_url) {
      return NextResponse.json({ error: 'Pesan atau lampiran wajib diisi' }, { status: 400 });
    }

    // 3. Simpan pesan kasir ke DB
    const { data: newMsg, error: insertError } = await supabase
      .from('order_chat_messages')
      .insert({
        chat_id: chatId,
        sender_id: profile.id,
        sender_role: 'cashier',
        message: message || null,
        attachment_url: attachment_url || null,
        is_read: false
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 4. Update status ruang chat: is_replied_manually = true, cashier_id = kasir aktif, dan status = active
    const { error: updateChatErr } = await supabase
      .from('order_chats')
      .update({
        is_replied_manually: true,
        cashier_id: profile.id,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', chatId);

    if (updateChatErr) throw updateChatErr;

    // 5. Tandai seluruh pesan belum dibaca dari pelanggan di ruang ini sebagai DIBACA
    await supabase
      .from('order_chat_messages')
      .update({ is_read: true })
      .eq('chat_id', chatId)
      .eq('sender_role', 'customer');

    return NextResponse.json({ success: true, message: newMsg });
  } catch (error: any) {
    console.error('POST cashier chat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
