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

const LOCALIZED_TEXTS: Record<string, Record<string, string>> = {
  id: {
    greeting: "Halo! Saya RestoBot, asisten otomatis Anda. Jelaskan kebutuhan Anda, atau klik tombol di bawah untuk terhubung langsung dengan kasir.",
    offer_cashier: "Baik, saya bisa hubungkan Anda ke kasir untuk mendapatkan bantuan langsung dari staf kami. Apakah Anda ingin dihubungkan ke kasir sekarang?",
    offer_cashier_urgent: "Jika Anda memerlukan penanganan lebih lanjut, saya dapat menghubungkan Anda langsung ke kasir kami. Apakah Anda ingin dihubungkan?",
    transferring: "Baik, Anda akan dihubungkan ke kasir. Mohon tunggu sebentar.",
    transferred: "Pesan Anda sudah diteruskan. Silakan menunggu balasan kasir.",
    cancel_transfer: "Baik, saya tetap di sini membantu Anda. Silakan sampaikan pertanyaan atau keluhan Anda kepada saya.",
    session_completed: "Sesi obrolan ini telah dinyatakan selesai oleh pelanggan. Sesi obrolan ditutup secara resmi, dan seluruh riwayat pesan akan dihapus otomatis secara permanen dalam {time}. Terima kasih!",
    profanity: "Pesan Anda mengandung kata-kata tidak sopan. Harap gunakan bahasa yang baik.",
    spam_warning: "Mohon bersabar dan tidak mengirimkan pesan secara berulang. Saya atau kasir kami akan membantu Anda secepatnya.",
    reminder_1: "Mohon tunggu sebentar, kasir sedang memproses pesan Anda.",
    reminder_2: "Pesan Anda sudah diterima, silakan menunggu balasan kasir.",
    reminder_3: "Kami sedang menghubungkan Anda ke kasir, harap bersabar.",
    reminder_4: "Kasir akan membalas secepatnya, terima kasih atas pengertiannya."
  },
  en: {
    greeting: "Hello! I am RestoBot, your automated assistant. Please describe your needs, or click the button below to connect directly with the cashier.",
    offer_cashier: "Sure, I can connect you to the cashier for direct assistance from our staff. Would you like to connect to the cashier now?",
    offer_cashier_urgent: "If you need further assistance, I can connect you directly to our cashier. Would you like to be connected?",
    transferring: "Alright, you will be connected to the cashier. Please wait a moment.",
    transferred: "Your message has been forwarded. Please wait for the cashier's response.",
    cancel_transfer: "Alright, I'll stay here to assist you. Please let me know if you have any questions or complaints.",
    session_completed: "This chat session has been marked as completed by the customer. The session is officially closed, and all message history will be permanently deleted in {time}. Thank you!",
    profanity: "Your message contains inappropriate words. Please use polite language.",
    spam_warning: "Please be patient and avoid sending repetitive messages. I or our cashier will help you as soon as possible.",
    reminder_1: "Please wait a moment, the cashier is processing your message.",
    reminder_2: "Your message has been received, please wait for the cashier's reply.",
    reminder_3: "We are connecting you to the cashier, please be patient.",
    reminder_4: "The cashier will reply as soon as possible, thank you for your understanding."
  },
  ja: {
    greeting: "こんにちは！私は自動アシスタントのRestoBotです。ご用件をお知らせいただくか、下のボタンをクリックしてレジ係（キャッシャー）に直接おつなぎください。",
    offer_cashier: "スタッフから直接サポートを受けられるよう、レジ係におつなぎできます。今すぐレジ係におつなぎしますか？",
    offer_cashier_urgent: "さらにサポートが必要な場合は、レジ係（キャッシャー）に直接おつなぎできます。接続しますか？",
    transferring: "レジ係におつなぎします。少々お待ちください。",
    transferred: "メッセージが転送されました。レジ係からの返信をお待ちください。",
    cancel_transfer: "かしこまりました。このまま私がサポートいたします。ご質問やご不明な点がございましたらお知らせください。",
    session_completed: "このチャットセッションは、お客様によって完了とされました。セッションは公式に終了し、すべてのメッセージ履歴は{time}以内に永久に削除されます。ありがとうございました！",
    profanity: "メッセージに不適切な言葉が含まれています。丁寧な言葉遣いをお願いいたします。",
    spam_warning: "しばらくお待ちいただき、メッセージを繰り返し送信しないようお願いいたします。私またはレジ係がすぐにサポートいたします。",
    reminder_1: "少々お待ちください。レジ係がメッセージを処理しています。",
    reminder_2: "メッセージは受信されました。レジ係からの返信をお待ちください。",
    reminder_3: "レジ係におつなぎしています。しばらくお待ちください。",
    reminder_4: "レジ係ができるだけ早く返信いたします。ご理解いただきありがとうございます。"
  },
  ko: {
    greeting: "안녕하세요! 자동 어시스턴트 RestoBot입니다. 필요하신 사항을 말씀해 주시거나, 아래 버튼을 클릭하여 캐셔와 직접 연결해 주세요.",
    offer_cashier: "직원의 직접적인 도움을 받으실 수 있도록 캐셔와 연결해 드릴 수 있습니다. 지금 캐셔와 연결하시겠습니까?",
    offer_cashier_urgent: "추가 도움이 필요하신 경우 캐셔와 직접 연결해 드릴 수 있습니다. 연결하시겠습니까?",
    transferring: "캐셔와 연결해 드리겠습니다. 잠시만 기다려 주세요.",
    transferred: "메시지가 전달되었습니다. 캐셔의 답변을 기다려 주세요.",
    cancel_transfer: "알겠습니다. 제가 계속해서 도와드리겠습니다. 질문이나 불편 사항이 있으시면 말씀해 주세요.",
    session_completed: "이 채팅 세션은 고객님에 의해 완료된 것으로 표시되었습니다. 세션이 공식적으로 종료되며, 모든 메시지 내역은 {time} 이내에 영구적으로 삭제됩니다. 감사합니다!",
    profanity: "메시지에 부적절한 단어가 포함되어 있습니다. 정중한 언어를 사용해 주세요.",
    spam_warning: "잠시 기다려 주시고 메시지를 반복해서 보내지 말아 주세요. 저나 저희 캐셔가 최대한 빨리 도와드리겠습니다.",
    reminder_1: "잠시만 기다려 주세요. 캐셔가 메시지를 처리 중입니다.",
    reminder_2: "메시지가 접수되었습니다. 캐셔의 답변을 기다려 주세요.",
    reminder_3: "캐셔와 연결 중입니다. 잠시만 기다려 주세요.",
    reminder_4: "캐셔가 최대한 빨리 답변해 드릴 예정입니다. 양해해 주셔서 감사합니다."
  },
  zh: {
    greeting: "您好！我是您的智能助手 RestoBot。请描述您的需求，或点击下方按钮直接联系收银员。",
    offer_cashier: "好的，我可以帮您联系收银员以获得人工服务。您现在需要接入收银员吗？",
    offer_cashier_urgent: "如果您需要进一步的帮助，我可以为您直接联系收银员。需要连接吗？",
    transferring: "好的，正在为您接入收银员，请稍候。",
    transferred: "您的消息已转发，请等待收银员回复。",
    cancel_transfer: "好的，我将继续为您提供帮助。如有任何问题或投诉，请随时告诉我。",
    session_completed: "此聊天会话已被客户标记为已完成。会话已正式关闭，所有聊天记录将在 {time} 内被永久删除。谢谢！",
    profanity: "您的消息中包含不当言辞。请使用文明语言。",
    spam_warning: "请耐心等待，避免重复发送消息。我或我们的收银员会尽快为您提供帮助。",
    reminder_1: "请稍候，收银员正在处理您的消息。",
    reminder_2: "您的消息已收到，请等待收银员回复。",
    reminder_3: "正在为您联系收银员，请稍候。",
    reminder_4: "收银员会尽快回复您，感谢您的理解。"
  },
  ar: {
    greeting: "مرحباً! أنا ريستو بوت، مساعدك الآلي. يرجى وصف احتياجاتك، أو النقر على الزر أدناه للاتصال مباشرة بالصراف.",
    offer_cashier: "بالتأكيد، يمكنني توصيلك بالصراف للحصول على مساعدة مباشرة من موظفينا. هل ترغب في الاتصال بالصراف الآن؟",
    offer_cashier_urgent: "إذا كنت بحاجة إلى مزيد من المساعدة، يمكنني توصيلك مباشرة بالصراف لدينا. هل ترغب في الاتصال؟",
    transferring: "حسناً، سيتم توصيلك بالصراف. يرجى الانتظار لحظة.",
    transferred: "تم توجيه رسالتك. يرجى انتظار رد الصراف.",
    cancel_transfer: "حسناً، سأبقى هنا لمساعدتك. يرجى إعلامي إذا كان لديك أي أسئلة أو شكاوى.",
    session_completed: "تم تحديد جلسة المحادثة هذه كمكتملة من قبل العميل. تم إغلاق الجلسة رسمياً، وسيتم حذف جميع سجلات الرسائل نهائياً خلال {time}. شكراً لك!",
    profanity: "تحتوي رسالتك على كلمات غير لائقة. يرجى استخدام لغة مهذبة.",
    spam_warning: "يرجى التحلي بالصبر وتجنب إرسال رسائل متكررة. سأقوم أنا أو الصراف بمساعدتك في أقرب وقت ممكن.",
    reminder_1: "يرجى الانتظار لحظة، يقوم الصراف بمعالجة رسالتك.",
    reminder_2: "تم استلام رسالتك، يرجى انتظار رد الصراف.",
    reminder_3: "نقوم بالاتصال بالصراف، يرجى الانتظار.",
    reminder_4: "سيرد الصراف في أقرب وقت ممكن، نشكرك على تفهمك."
  },
  fr: {
    greeting: "Bonjour! Je suis RestoBot, votre assistant automatique. Veuillez décrire vos besoins, ou cliquez sur le bouton ci-dessous pour contacter le caissier.",
    offer_cashier: "Bien sûr, je peux vous mettre en relation avec le caissier pour une assistance directe. Souhaitez-vous contacter le caissier maintenant?",
    offer_cashier_urgent: "Si vous avez besoin d'une assistance supplémentaire, je peux vous mettre en relation directe avec notre caissier. Souhaitez-vous être connecté?",
    transferring: "Très bien, vous allez être mis en relation avec le caissier. Veuillez patienter un instant.",
    transferred: "Votre message a été transmis. Veuillez attendre la réponse du caissier.",
    cancel_transfer: "D'accord, je reste là pour vous aider. N'hésitez pas à me faire part de vos questions ou réclamations.",
    session_completed: "Cette session de chat a été marquée comme terminée par le client. La session est officiellement fermée et tout l'historique des messages sera définitivement supprimé dans {time}. Merci!",
    profanity: "Votre message contient des mots inappropriés. Veuillez utiliser un langage poli.",
    spam_warning: "Veuillez patienter et éviter d'envoyer des messages répétitifs. Le caissier ou moi-même allons vous aider dès que possible.",
    reminder_1: "Veuillez patienter un instant, le caissier traite votre message.",
    reminder_2: "Votre message a été reçu, veuillez attendre la réponse du caissier.",
    reminder_3: "Nous vous mettons en relation avec le caissier, veuillez patienter.",
    reminder_4: "Le caissier vous répondra dès que possible, merci de votre compréhension."
  },
  de: {
    greeting: "Hallo! Ich bin RestoBot, Ihr automatischer Assistent. Bitte beschreiben Sie Ihr Anliegen oder klicken Sie unten auf die Schaltfläche, um direkt mit der Kasse verbunden zu werden.",
    offer_cashier: "Gerne kann ich Sie für eine direkte Unterstützung durch unsere Mitarbeiter mit der Kasse verbinden. Möchten Sie jetzt verbunden werden?",
    offer_cashier_urgent: "Wenn Sie weitere Hilfe benötigen, kann ich Sie direkt mit unserer Kasse verbinden. Möchten Sie verbunden werden?",
    transferring: "Alles klar, Sie werden mit der Kasse verbunden. Bitte warten Sie einen Moment.",
    transferred: "Ihre Nachricht wurde weitergeleitet. Bitte warten Sie auf die Antwort der Kasse.",
    cancel_transfer: "In Ordnung, ich bleibe hier, um Ihnen zu helfen. Bitte lassen Sie mich wissen, wenn Sie Fragen oder Beschwerden haben.",
    session_completed: "Diese Chat-Sitzung wurde vom Kunden als abgeschlossen markiert. Die Sitzung ist offiziell geschlossen und der gesamte Nachrichtenverlauf wird in {time} unwiderruflich gelöscht. Vielen Dank!",
    profanity: "Ihre Nachricht enthält unangemessene Ausdrücke. Bitte verwenden Sie eine höfliche Sprache.",
    spam_warning: "Bitte haben Sie Geduld und vermeiden Sie es, Nachrichten wiederholt zu senden. Ich oder unsere Kasse werden Ihnen so schnell wie möglich helfen.",
    reminder_1: "Bitte warten Sie einen Moment, die Kasse bearbeitet Ihre Nachricht.",
    reminder_2: "Ihre Nachricht wurde empfangen, bitte warten Sie auf die Antwort der Kasse.",
    reminder_3: "Wir verbinden Sie mit der Kasse, bitte haben Sie Geduld.",
    reminder_4: "Die Kasse wird so schnell wie möglich antworten, vielen Dank für Ihr Verständnis."
  }
};

function getLocalizedText(key: string, lang: string, replacement: Record<string, string> = {}): string {
  const normLang = (lang || 'id').toLowerCase();
  const langSet = LOCALIZED_TEXTS[normLang] || LOCALIZED_TEXTS.id;
  let text = langSet[key] || LOCALIZED_TEXTS.id[key] || '';
  for (const [k, v] of Object.entries(replacement)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

async function sendAIGreeting(supabase: any, chatId: string, lang: string = 'id') {
  const msg = getLocalizedText('greeting', lang);
  await supabase.from('order_chat_messages').insert({
    chat_id: chatId,
    sender_role: 'ai',
    message: msg,
    is_read: false
  });
  // Update chat status to ai_active
  await supabase.from('order_chats').update({
    ai_chat_status: 'ai_active',
    updated_at: new Date().toISOString()
  }).eq('id', chatId);
}

function formatCurrencyBackend(amount: number, lang: string = 'id'): string {
  const num = Number(amount) || 0;
  if (lang === 'id') {
    const formatted = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
    return `Rp ${formatted}`;
  } else {
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
    return `IDR ${formatted}`;
  }
}

async function sendAIResponse(supabase: any, chatId: string, orderId: string, message: string, chatStatus: string, lang: string = 'id') {
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
    return `- ${item.quantity}x ${item.menu_items?.name || 'Item'} (Subtotal: ${formatCurrencyBackend(Number(item.subtotal), lang)})`;
  }).join('\n');

  let systemPrompt = `Kamu adalah RestoBot AI, asisten bantuan otomatis pelanggan restoran RestoBook.
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
- Total Transaksi: ${formatCurrencyBackend(Number(orderDetails?.total_amount), lang)}
- Daftar Menu yang Dipesan:
${itemsStr}

STATUS PERCAKAPAN SAAT INI: ${chatStatus}

ATURAN MENJAWAB (WAJIB DIPATUHI):
1. Jawab secara sopan, sangat singkat, padat, dan jelas menggunakan Bahasa Indonesia. Maksimal 100 kata.
2. Jawab HANYA hal yang berkaitan dengan pesanan mereka, operasional restoran, menu, estimasi, pembayaran, komplain, atau bantuan teknis.
3. DILARANG KERAS menjawab topik umum di luar operasional restoran/pesanan. Jika ditanya hal ini, jawab halus bahwa kamu hanya asisten pemesanan.
4. DILARANG KERAS menggunakan karakter emoji atau ikon emoji apa pun.
5. DILARANG menggunakan tanda bintang (*) atau format markdown (seperti **, _, __). Gunakan HURUF KAPITAL jika ingin menekankan kata penting.
6. EJAAN LAYANAN DOMPET: Selalu gunakan ejaan "Dompetku" atau "DOMPETKU" untuk layanan dompet digital. DILARANG KERAS menuliskan "DOMPEtky", "DOMPEтky", "dompetky", atau variasi typo lainnya.
7. Jika pertanyaan memerlukan tindakan manual staf, tawarkan koneksi ke kasir.
8. Jangan mengulangi salam setiap pesan, cukup jawab pertanyaannya saja.
`;

  const LANG_NAMES: Record<string, string> = {
    id: "Indonesian",
    en: "English",
    ja: "Japanese / 日本語",
    ko: "Korean / 한국어",
    zh: "Chinese / 中文",
    ar: "Arabic / العربية",
    fr: "French / Français",
    de: "German / Deutsch"
  };

  const targetLangName = LANG_NAMES[lang] || "Indonesian";

  if (lang && lang !== 'id') {
    systemPrompt += `\n\nLANGUAGE ENFORCEMENT PROTOCOL:
You MUST output your response ONLY in ${targetLangName}. All greetings, system explanations, answers, and formatting MUST be written in ${targetLangName}. Override any rule stating to use Bahasa Indonesia, and respond in ${targetLangName} instead. Translate any Indonesian system prompts, menu items, table statuses, staff details, or ticket info dynamically on the fly to ${targetLangName} in your final reply.`;
  }
  
  // Dynamic currency formatting rule injection
  systemPrompt += `\n\nCURRENCY FORMATTING PROTOCOL:
If the active language is English ("en"), you MUST format all currencies as "IDR [amount]" using English locale formatting (e.g., IDR 50,000 or IDR 1,000,000). If the active language is Indonesian ("id"), you MUST format all currencies as "Rp [amount]" using Indonesian locale formatting (e.g., Rp 50.000 or Rp 1.000.000). Never mix these format symbols and styles.`;

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
        // Fix spelling/typo in all forms of "dompetky" (including Cyrillic т and Latin t)
        aiReply = aiReply.replace(/dompe[tт]ky/gi, (match: string) => {
          return match === match.toUpperCase() ? 'DOMPETKU' : 'Dompetku';
        });

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
    const url = new URL(req.url);
    const lang = 'id';

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
      await sendAIGreeting(supabase, chat.id, lang);
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
    const lang = 'id';

    // --- Penanganan aksi khusus ---
    if (action === 'request_cashier') {
      // Pelanggan meminta dihubungkan ke kasir - tampilkan konfirmasi
      await supabase.from('order_chat_messages').insert({
        chat_id: chat.id,
        sender_role: 'ai',
        message: getLocalizedText('offer_cashier', lang),
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
        message: getLocalizedText('transferring', lang),
        is_read: false
      });
      await supabase.from('order_chat_messages').insert({
        chat_id: chat.id,
        sender_role: 'ai',
        message: getLocalizedText('transferred', lang),
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
        message: getLocalizedText('cancel_transfer', lang),
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
        message: getLocalizedText('session_completed', lang, { time: wordingTime.trim() }),
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
      return NextResponse.json({ error: getLocalizedText('profanity', lang) }, { status: 400 });
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
          message: getLocalizedText('spam_warning', lang),
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
          message: getLocalizedText('offer_cashier', lang),
          is_read: false
        });
        await supabase.from('order_chats').update({
          ai_chat_status: 'waiting_customer_choice',
          updated_at: new Date().toISOString()
        }).eq('id', chat.id);
      } else if (message && containsUrgentKeyword(message)) {
        // Pesan mendesak - jawab AI + langsung tawarkan kasir secara sinkron (edge safety)
        await sendAIResponse(supabase, chat.id, orderId, message, currentAiStatus, lang);
        
        await supabase.from('order_chat_messages').insert({
          chat_id: chat.id,
          sender_role: 'ai',
          message: getLocalizedText('offer_cashier_urgent', lang),
          is_read: false
        });
        
        await supabase.from('order_chats').update({
          ai_chat_status: 'waiting_customer_choice',
          updated_at: new Date().toISOString()
        }).eq('id', chat.id);
      } else {
        // Jawab normal oleh AI
        await sendAIResponse(supabase, chat.id, orderId, message || '', currentAiStatus, lang);
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
          const reminderKeys = ['reminder_1', 'reminder_2', 'reminder_3', 'reminder_4'];
          const randomKey = reminderKeys[Math.floor(Math.random() * reminderKeys.length)];
          const randomReminder = getLocalizedText(randomKey, lang);

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
