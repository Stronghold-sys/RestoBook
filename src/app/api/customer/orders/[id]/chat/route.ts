export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const VULGAR_WORDS = [
  'anjing', 'babi', 'bangsat', 'goblok', 'tolol', 'kontol', 'memek', 
  'pantek', 'jancok', 'pepek', 'ngentot', 'perek', 'binal', 'lonte', 
  'kntl', 'ajg', 'gblk', 'bgst'
];

// Kata kunci yang memicu penawaran cepat ke kasir
const URGENT_KEYWORDS = [
  'komplain', 'marah', 'salah', 'belum diterima', 'refund', 'batal',
  'kecewa', 'jelek', 'lama sekali', 'tidak sesuai', 'rambut', 'benda asing',
  'keracunan', 'mual', 'gatal', 'kotor', 'basi', 'tidak enak', 'ancur',
  'ubah', 'ganti'
];

// Kata kunci yang menandakan pelanggan ingin bicara ke kasir
const CASHIER_CONNECT_KEYWORDS = [
  'kasir', 'manusia', 'orang', 'staff', 'hubungi kasir', 'bicara kasir',
  'hubungkan', 'ingin kasir', 'minta kasir', 'terhubung kasir',
  'sambungkan', 'panggil kasir', 'ada staf', 'ada staff'
];

function containsProfanity(text: string): boolean {
  if (!text) return false;
  const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  return VULGAR_WORDS.some(word => cleanText.includes(word));
}

function containsUrgentKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return URGENT_KEYWORDS.some(kw => lower.includes(kw));
}

function containsCashierRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return CASHIER_CONNECT_KEYWORDS.some(kw => lower.includes(kw));
}

const AI_GREETING_MESSAGES = [
  'Halo! Saya RestoBot, asisten otomatis Anda. Jelaskan kebutuhan Anda, atau klik tombol di bawah untuk terhubung langsung dengan kasir.'
];

const CASHIER_OFFER_MESSAGES = [
  'Baik, saya bisa hubungkan Anda ke kasir. Apakah Anda ingin melanjutkan?',
  'Saya akan meneruskan chat ini ke kasir agar dibantu langsung. Lanjutkan?'
];

async function sendAIGreeting(supabase: any, chatId: string) {
  for (const msg of AI_GREETING_MESSAGES) {
    await supabase.from('order_chat_messages').insert({
      chat_id: chatId,
      sender_role: 'ai',
      message: msg,
      is_read: false
    });
  }
  // Update chat status to ai_active
  await supabase.from('order_chats').update({
    ai_chat_status: 'ai_active',
    updated_at: new Date().toISOString()
  }).eq('id', chatId);
}

async function sendAIResponse(supabase: any, chatId: string, orderId: string, message: string, chatStatus: string) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return;

  const { data: orderDetails } = await supabase
    .from('orders')
    .select('*, tables(table_number)')
    .eq('id', orderId)
    .single();

  const { data: orderItems } = await supabase
    .from('order_items')
    .select('*, menu_items(name)')
    .eq('order_id', orderId);

  const itemsStr = (orderItems || []).map((item: any) => {
    return `- ${item.quantity}x ${item.menu_items?.name || 'Item'} (Subtotal: Rp ${Number(item.subtotal).toLocaleString('id-ID')})`;
  }).join('\n');

  const systemPrompt = `Kamu adalah RestoBot AI, asisten bantuan otomatis pelanggan restoran RestoBook.
Tugasmu membantu pelanggan ini secara ramah mengenai pesanan mereka.

INFORMASI PESANAN PELANGGAN:
- Nomor Pesanan: #${orderDetails?.id?.substring(0, 8).toUpperCase()}
- Jenis Order: ${orderDetails?.order_type === 'dine_in' ? 'Dine In (Makan di Tempat)' : orderDetails?.order_type === 'takeaway' ? 'Take Away (Bawa Pulang)' : 'Delivery (Pengantaran)'}
- Meja Makan: ${orderDetails?.tables?.table_number || 'Tidak Ada (Bukan Dine In)'}
- Status Pesanan Saat Ini: ${
    orderDetails?.status === 'pending' ? 'Menunggu Konfirmasi' :
    orderDetails?.status === 'confirmed' ? 'Dikonfirmasi (Mulai Diproses)' :
    orderDetails?.status === 'processing' ? 'Sedang Diproses oleh Koki' :
    orderDetails?.status === 'ready' ? 'Siap Disajikan/Diambil' :
    orderDetails?.status === 'completed' ? 'Selesai' : 'Dibatalkan'
  }
- Status Pembayaran: ${orderDetails?.payment_status === 'paid' ? 'Sudah Lunas' : 'Belum Bayar'}
- Metode Pembayaran: ${orderDetails?.payment_method === 'cash' ? 'Tunai (Bayar di Kasir/Kurir)' : 'Non-Tunai (Digital/Transfer)'}
- Catatan Tambahan Pesanan: ${orderDetails?.notes || 'Tidak ada catatan'}
- Total Transaksi: Rp ${Number(orderDetails?.total_amount).toLocaleString('id-ID')}
- Daftar Menu yang Dipesan:
${itemsStr}

STATUS PERCAKAPAN SAAT INI: ${chatStatus}

ATURAN MENJAWAB (WAJIB DIPATUHI):
1. Jawab secara sopan, sangat singkat, padat, dan jelas menggunakan Bahasa Indonesia. Maksimal 100 kata.
2. Jawab HANYA hal yang berkaitan dengan pesanan mereka, operasional restoran, menu, estimasi, pembayaran, komplain, atau bantuan teknis.
3. DILARANG KERAS menjawab topik umum di luar operasional restoran/pesanan. Jika ditanya hal ini, jawab halus bahwa kamu hanya asisten pemesanan.
4. DILARANG KERAS menggunakan karakter emoji atau ikon emoji apa pun.
5. DILARANG menggunakan tanda bintang (*) atau format markdown (seperti **, _, __). Gunakan HURUF KAPITAL jika ingin menekankan kata penting.
6. Jika pertanyaan memerlukan tindakan manual staf, tawarkan koneksi ke kasir.
7. Jangan mengulangi salam setiap pesan, cukup jawab pertanyaannya saja.
`;

  const { data: historyMsgs } = await supabase
    .from('order_chat_messages')
    .select('sender_role, message')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(12);

  const history = (historyMsgs || []).map((msg: any) => ({
    role: msg.sender_role === 'customer' ? 'user' : 'assistant',
    content: msg.message || ''
  }));

  try {
    const aiRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-tiny',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history
        ],
        max_tokens: 350,
        temperature: 0.5
      })
    });

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      let aiReply = aiData.choices?.[0]?.message?.content || '';
      
      // Bersihkan format markdown dan emoji
      aiReply = aiReply
        .replace(/\*{1,3}/g, '')
        .replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, '')
        .trim();

      if (aiReply) {
        await supabase.from('order_chat_messages').insert({
          chat_id: chatId,
          sender_role: 'ai',
          message: aiReply,
          is_read: false
        });
      }
    }
  } catch (aiErr) {
    console.error('Mistral AI execution failed in order chat:', aiErr);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
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

    // 1. Verifikasi pesanan ada dan milik user ini
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, customer_id, status, order_type, total_amount')
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    if (order.customer_id !== profile.id) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    // 2. Dapatkan atau buat ruang obrolan (order_chats)
    let { data: chat, error: chatErr } = await supabase
      .from('order_chats')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (chatErr) throw chatErr;

    let isNewChat = false;
    if (!chat) {
      const { data: newChat, error: createChatErr } = await supabase
        .from('order_chats')
        .insert({
          order_id: orderId,
          customer_id: profile.id,
          status: 'active',
          ai_chat_status: 'ai_active',
          is_replied_manually: false,
          is_blocked: false
        })
        .select()
        .single();

      if (createChatErr) throw createChatErr;
      chat = newChat;
      isNewChat = true;
    }

    // 3. Jika chat baru atau belum ada pesan AI pembuka, kirim greeting
    if (isNewChat && chat) {
      await sendAIGreeting(supabase, chat.id);
    }

    // 4. Ambil riwayat pesan
    const { data: messages, error: msgErr } = await supabase
      .from('order_chat_messages')
      .select('*, sender:profiles(role, full_name)')
      .eq('chat_id', chat!.id)
      .order('created_at', { ascending: true });

    if (msgErr) throw msgErr;

    // Refresh chat data after potential greeting insert
    const { data: freshChat } = await supabase
      .from('order_chats')
      .select('*')
      .eq('id', chat!.id)
      .single();

    return NextResponse.json({ chat: freshChat || chat, messages });
  } catch (error: any) {
    console.error('GET order chat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = params.id;
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

    // 1. Verifikasi pesanan ada dan milik user ini
    const { data: order } = await supabase
      .from('orders')
      .select('id, customer_id, status, order_type, total_amount')
      .eq('id', orderId)
      .single();

    if (!order || order.customer_id !== profile.id) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 });
    }

    // 2. Ambil detail ruang chat
    const { data: chat } = await supabase
      .from('order_chats')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (!chat) {
      return NextResponse.json({ error: 'Ruang obrolan belum dibuat' }, { status: 404 });
    }

    if (chat.is_blocked) {
      return NextResponse.json({ error: 'Akses chat Anda diblokir oleh kasir karena indikasi penyalahgunaan' }, { status: 403 });
    }

    if (chat.status === 'completed' || chat.status === 'expired' || ['completed', 'cancelled'].includes(order.status)) {
      return NextResponse.json({ error: 'Percakapan ini telah selesai. Jika masih memerlukan bantuan, silakan buat tiket pengaduan.' }, { status: 403 });
    }

    const body = await req.json();
    const { message, attachment_url, action } = body;

    // --- Penanganan aksi khusus ---
    if (action === 'request_cashier') {
      // Pelanggan meminta dihubungkan ke kasir - tampilkan konfirmasi
      await supabase.from('order_chat_messages').insert({
        chat_id: chat.id,
        sender_role: 'ai',
        message: 'Baik, saya bisa hubungkan Anda ke kasir untuk mendapatkan bantuan langsung dari staf kami. Apakah Anda ingin dihubungkan ke kasir sekarang?',
        is_read: false
      });
      
      await supabase.from('order_chats').update({
        ai_chat_status: 'waiting_customer_choice',
        updated_at: new Date().toISOString()
      }).eq('id', chat.id);

      return NextResponse.json({ success: true, action: 'cashier_offer_sent' });
    }

    if (action === 'confirm_transfer') {
      // Pelanggan mengkonfirmasi ingin terhubung ke kasir
      await supabase.from('order_chats').update({
        ai_chat_status: 'transfer_requested',
        updated_at: new Date().toISOString()
      }).eq('id', chat.id);

      // Kirim pesan transisi dari AI sesuai spesifikasi chatboot.md
      await supabase.from('order_chat_messages').insert({
        chat_id: chat.id,
        sender_role: 'ai',
        message: 'Baik, Anda akan dihubungkan ke kasir. Mohon tunggu sebentar.',
        is_read: false
      });
      await supabase.from('order_chat_messages').insert({
        chat_id: chat.id,
        sender_role: 'ai',
        message: 'Pesan Anda sudah diteruskan. Silakan menunggu balasan kasir.',
        is_read: false
      });

      // Ambil detail pesanan untuk notifikasi kasir
      const { data: orderDetails } = await supabase
        .from('orders')
        .select('*, tables(table_number)')
        .eq('id', orderId)
        .single();

      const { data: lastMsg } = await supabase
        .from('order_chat_messages')
        .select('message')
        .eq('chat_id', chat.id)
        .eq('sender_role', 'customer')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Notifikasi realtime ke semua kasir
      const { data: cashiers } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['cashier', 'admin']);

      if (cashiers && cashiers.length > 0) {
        const notifs = cashiers.map((c: any) => ({
          user_id: c.id,
          title: 'Pelanggan Meminta Kasir',
          message: `${profile.full_name || 'Pelanggan'} meminta dihubungkan ke kasir. Pesanan #${orderId.substring(0, 8).toUpperCase()} (${orderDetails?.order_type === 'dine_in' ? 'Dine In' : orderDetails?.order_type === 'takeaway' ? 'Takeaway' : 'Delivery'}). Pesan terakhir: "${lastMsg?.message || '-'}"`,
          type: 'cashier_chat_request',
          reference_id: chat.id
        }));
        await supabase.from('notifications').insert(notifs);
      }

      return NextResponse.json({ success: true, action: 'transfer_confirmed' });
    }

    if (action === 'cancel_transfer') {
      // Pelanggan membatalkan permintaan ke kasir
      await supabase.from('order_chats').update({
        ai_chat_status: 'ai_active',
        updated_at: new Date().toISOString()
      }).eq('id', chat.id);

      await supabase.from('order_chat_messages').insert({
        chat_id: chat.id,
        sender_role: 'ai',
        message: 'Baik, saya tetap di sini membantu Anda. Silakan sampaikan pertanyaan atau keluhan Anda kepada saya.',
        is_read: false
      });

      return NextResponse.json({ success: true, action: 'transfer_cancelled' });
    }

    if (action === 'complete_chat') {
      // Pelanggan menyatakan chat selesai
      const { data: settings } = await supabase
        .from('support_settings')
        .select('*')
        .eq('id', '77777777-7777-7777-7777-777777777777')
        .single();

      const hours = settings?.order_chat_expiry_hours ?? 0;
      const minutes = settings?.order_chat_expiry_minutes ?? 30;
      const seconds = settings?.order_chat_expiry_seconds ?? 0;

      const now = new Date();
      const closedAt = now.toISOString();
      const deletedAt = new Date(now.getTime() + (hours * 3600 + minutes * 60 + seconds) * 1000).toISOString();

      const { data: updatedChat, error: updateErr } = await supabase
        .from('order_chats')
        .update({
          status: 'completed',
          chat_closed_at: closedAt,
          chat_history_deleted_at: deletedAt,
          updated_at: now.toISOString()
        })
        .eq('id', chat.id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      let wordingTime = '';
      if (hours > 0) wordingTime += `${hours} jam `;
      if (minutes > 0) wordingTime += `${minutes} menit `;
      if (seconds > 0) wordingTime += `${seconds} detik`;
      if (!wordingTime) wordingTime = 'beberapa saat';

      // Kirim pesan sistem otomatis
      await supabase.from('order_chat_messages').insert({
        chat_id: chat.id,
        sender_role: 'ai',
        message: `Sesi obrolan ini telah dinyatakan selesai oleh pelanggan. Sesi obrolan ditutup secara resmi, dan seluruh riwayat pesan akan dihapus otomatis secara permanen dalam ${wordingTime.trim()}. Terima kasih!`,
        is_read: false
      });

      return NextResponse.json({ success: true, chat: updatedChat });
    }

    // --- Kirim pesan biasa ---
    if (!message && !attachment_url) {
      return NextResponse.json({ error: 'Pesan atau lampiran wajib diisi' }, { status: 400 });
    }

    // 3. Filter kata kasar (profanity filter)
    if (message && containsProfanity(message)) {
      return NextResponse.json({ error: 'Pesan Anda mengandung kata-kata tidak sopan. Harap gunakan bahasa yang baik.' }, { status: 400 });
    }

    // 4. Cek spam / pesan duplikat berulang
    if (message) {
      const { data: lastMsg } = await supabase
        .from('order_chat_messages')
        .select('*')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastMsg && lastMsg.sender_role === 'customer' && lastMsg.message === message) {
        // Simpan pesan duplikat pelanggan ke database
        const { data: newMsg, error: insertError } = await supabase
          .from('order_chat_messages')
          .insert({
            chat_id: chat.id,
            sender_id: profile.id,
            sender_role: 'customer',
            message: message || null,
            attachment_url: attachment_url || null,
            is_read: false
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Kirim respons penenang dari AI
        await supabase.from('order_chat_messages').insert({
          chat_id: chat.id,
          sender_role: 'ai',
          message: 'Mohon bersabar dan tidak mengirimkan pesan secara berulang. Saya atau kasir kami akan membantu Anda secepatnya.',
          is_read: false
        });

        return NextResponse.json({ success: true, message: newMsg });
      }
    }

    // 5. Simpan pesan pelanggan
    const { data: newMsg, error: insertError } = await supabase
      .from('order_chat_messages')
      .insert({
        chat_id: chat.id,
        sender_id: profile.id,
        sender_role: 'customer',
        message: message || null,
        attachment_url: attachment_url || null,
        is_read: false
      })
      .select()
      .single();

    if (insertError) throw insertError;

    const currentAiStatus = chat.ai_chat_status || 'ai_active';

    // 6. Logika respons berdasarkan status AI chat
    if (currentAiStatus === 'ai_active' && !chat.is_replied_manually) {
      // Cek apakah pelanggan ingin bicara ke kasir
      if (message && containsCashierRequest(message)) {
        // Tawaran ke kasir
        await supabase.from('order_chat_messages').insert({
          chat_id: chat.id,
          sender_role: 'ai',
          message: 'Baik, saya bisa hubungkan Anda ke kasir untuk mendapatkan bantuan langsung dari staf kami. Apakah Anda ingin dihubungkan ke kasir sekarang?',
          is_read: false
        });
        await supabase.from('order_chats').update({
          ai_chat_status: 'waiting_customer_choice',
          updated_at: new Date().toISOString()
        }).eq('id', chat.id);
      } else if (message && containsUrgentKeyword(message)) {
        // Pesan mendesak - jawab AI + langsung tawarkan kasir secara sinkron (edge safety)
        await sendAIResponse(supabase, chat.id, orderId, message, currentAiStatus);
        
        await supabase.from('order_chat_messages').insert({
          chat_id: chat.id,
          sender_role: 'ai',
          message: 'Jika Anda memerlukan penanganan lebih lanjut, saya dapat menghubungkan Anda langsung ke kasir kami. Apakah Anda ingin dihubungkan?',
          is_read: false
        });
        
        await supabase.from('order_chats').update({
          ai_chat_status: 'waiting_customer_choice',
          updated_at: new Date().toISOString()
        }).eq('id', chat.id);
      } else {
        // Jawab normal oleh AI
        await sendAIResponse(supabase, chat.id, orderId, message || '', currentAiStatus);
      }
    } else if (currentAiStatus === 'waiting_cashier' || currentAiStatus === 'transfer_requested') {
      // Sudah dalam antrian kasir - kirim pesan pengingat jika belum ada kasir (dibatasi 30 detik)
      if (!chat.is_replied_manually) {
        const { data: lastAiMsg } = await supabase
          .from('order_chat_messages')
          .select('created_at')
          .eq('chat_id', chat.id)
          .eq('sender_role', 'ai')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastAiTime = lastAiMsg ? new Date(lastAiMsg.created_at).getTime() : 0;
        const timeDiff = Date.now() - lastAiTime;

        if (timeDiff > 30000) {
          const reminderMessages = [
            'Mohon tunggu sebentar, kasir sedang memproses pesan Anda.',
            'Pesan Anda sudah diterima, silakan menunggu balasan kasir.',
            'Kami sedang menghubungkan Anda ke kasir, harap bersabar.',
            'Kasir akan membalas secepatnya, terima kasih atas pengertiannya.'
          ];
          const randomReminder = reminderMessages[Math.floor(Math.random() * reminderMessages.length)];

          await supabase.from('order_chat_messages').insert({
            chat_id: chat.id,
            sender_role: 'ai',
            message: randomReminder,
            is_read: false
          });
        }
      }
    }
    // Jika CASHIER_ACTIVE (is_replied_manually = true), AI tidak ikut campur

    return NextResponse.json({ success: true, message: newMsg });
  } catch (error: any) {
    console.error('POST order chat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
