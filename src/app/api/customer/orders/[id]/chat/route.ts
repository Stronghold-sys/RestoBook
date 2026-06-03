export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const VULGAR_WORDS = [
  'anjing', 'babi', 'bangsat', 'goblok', 'tolol', 'kontol', 'memek', 
  'pantek', 'jancok', 'pepek', 'ngentot', 'perek', 'binal', 'lonte', 
  'kntl', 'ajg', 'gblk', 'bgst'
];

function containsProfanity(text: string): boolean {
  if (!text) return false;
  const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
  return VULGAR_WORDS.some(word => cleanText.includes(word));
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
      .select('id, customer_id')
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

    if (!chat) {
      const { data: newChat, error: createChatErr } = await supabase
        .from('order_chats')
        .insert({
          order_id: orderId,
          customer_id: profile.id,
          status: 'active',
          is_replied_manually: false,
          is_blocked: false
        })
        .select()
        .single();

      if (createChatErr) throw createChatErr;
      chat = newChat;
    }

    // 3. Ambil riwayat pesan
    const { data: messages, error: msgErr } = await supabase
      .from('order_chat_messages')
      .select('*')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true });

    if (msgErr) throw msgErr;

    return NextResponse.json({ chat, messages });
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
      .select('id, customer_id')
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

    const body = await req.json();
    const { message, attachment_url } = body;

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
        return NextResponse.json({ error: 'Pesan duplikat terdeteksi. Harap tidak mengirim pesan yang sama berulang kali.' }, { status: 400 });
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

    // 6. Integrasi AI (Mistral AI Auto-Responder) jika belum dijawab manual oleh kasir
    if (!chat.is_replied_manually) {
      const apiKey = process.env.MISTRAL_API_KEY;
      if (apiKey) {
        // Ambil detail pesanan & item untuk disuntikkan ke konteks AI
        const { data: orderDetails } = await supabase
          .from('orders')
          .select('*, tables(table_number)')
          .eq('id', orderId)
          .single();

        const { data: orderItems } = await supabase
          .from('order_items')
          .select('*, menu_items(name)')
          .eq('order_id', orderId);

        const itemsStr = (orderItems || []).map(item => {
          return `- ${item.quantity}x ${item.menu_items?.name || 'Item'} (Subtotal: Rp ${Number(item.subtotal).toLocaleString('id-ID')})`;
        }).join('\n');

        const systemPrompt = `Kamu adalah RestoBot AI, asisten bantuan otomatis pelanggan restoran RestoBook.
Tugasmu membantu pelanggan ini secara ramah mengenai pesanan mereka.

INFORMASI PESANAN PELANGGAN:
- Nomor Pesanan: #${orderDetails.id.substring(0, 8).toUpperCase()}
- Jenis Order: ${orderDetails.order_type === 'dine_in' ? 'Dine In (Makan di Tempat)' : orderDetails.order_type === 'takeaway' ? 'Take Away (Bawa Pulang)' : 'Delivery (Pengantaran)'}
- Meja Makan: ${orderDetails.tables?.table_number || 'Tidak Ada (Bukan Dine In)'}
- Status Pesanan Saat Ini: ${
          orderDetails.status === 'pending' ? 'Menunggu Konfirmasi' :
          orderDetails.status === 'confirmed' ? 'Dikonfirmasi (Mulai Diproses)' :
          orderDetails.status === 'processing' ? 'Sedang Diproses oleh Koki' :
          orderDetails.status === 'ready' ? 'Siap Disajikan/Diambil' :
          orderDetails.status === 'completed' ? 'Selesai' : 'Dibatalkan'
        }
- Status Pembayaran: ${orderDetails.payment_status === 'paid' ? 'Sudah Lunas' : 'Belum Bayar'}
- Metode Pembayaran: ${orderDetails.payment_method === 'cash' ? 'Tunai (Bayar di Kasir/Kurir)' : 'Non-Tunai (Digital/Transfer)'}
- Catatan Tambahan Pesanan: ${orderDetails.notes || 'Tidak ada catatan'}
- Total Transaksi: Rp ${Number(orderDetails.total_amount).toLocaleString('id-ID')}
- Daftar Menu yang Dipesan:
${itemsStr}

ATURAN MENJAWAB (WAJIB DIPATUHI):
1. Jawab secara sopan, sangat singkat, padat, dan jelas menggunakan Bahasa Indonesia. Maksimal 120 kata.
2. Jawab HANYA hal yang berkaitan dengan pesanan mereka, operasional restoran, menu, estimasi, pembayaran, komplain, atau bantuan teknis.
3. DILARANG KERAS menjawab topik umum di luar operasional restoran/pesanan (seperti menulis kode pemrograman, membahas berita, politik, dll). Jika ditanya hal ini, jawab halus bahwa kamu hanya asisten pemesanan.
4. DILARANG KERAS menggunakan karakter emoji atau ikon emoji apa pun.
5. DILARANG menggunakan tanda bintang (*) atau format markdown (seperti **, _, __). Gunakan HURUF KAPITAL jika ingin menekankan kata penting.
6. Jika pertanyaan pelanggan memerlukan tindakan manual staf (seperti ubah pesanan, pembatalan sepihak, refund saldo, komplain rasa/rambut di makanan), beri tahu pelanggan bahwa kasir/staf kami akan segera menindaklanjuti secara manual di ruang chat ini.
`;

        // Ambil riwayat chat terakhir untuk memori percakapan
        const { data: historyMsgs } = await supabase
          .from('order_chat_messages')
          .select('sender_role, message')
          .eq('chat_id', chat.id)
          .order('created_at', { ascending: true })
          .limit(10);

        const history = (historyMsgs || []).map(msg => ({
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
              max_tokens: 400,
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
              await supabase
                .from('order_chat_messages')
                .insert({
                  chat_id: chat.id,
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
    }

    return NextResponse.json({ success: true, message: newMsg });
  } catch (error: any) {
    console.error('POST order chat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
