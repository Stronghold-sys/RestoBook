"use client";
export const runtime = 'edge';

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Send, X, Loader2, MessageSquare, Package,
  CheckCheck, Check, Shield, AlertCircle, RefreshCw,
  Printer, FileText, Utensils, Truck, Coffee,
  ArrowLeft, Ban, Camera, RotateCcw, Paperclip
} from "lucide-react";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import { format, formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";

type OrderType = "all" | "dine_in" | "takeaway" | "delivery";
type ChatStatus = "all" | "active" | "completed" | "waiting_customer" | "need_admin";

interface ChatRoom {
  id: string;
  order_id: string;
  customer_id: string;
  cashier_id: string | null;
  status: string;
  is_replied_manually: boolean;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
  order: {
    id: string;
    order_type: string;
    status: string;
    total_amount: number;
    payment_method: string;
    payment_status: string;
    notes: string | null;
    created_at: string;
    tables: { table_number: string } | null;
    distance_km: number | null;
    shipping_fee: number;
    shipping_discount: number;
    discount: number;
  };
  customer: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
  };
  cashier: { full_name: string } | null;
  last_message: ChatMessage | null;
  unread_count: number;
}

interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string | null;
  sender_role: "customer" | "cashier" | "ai";
  message: string | null;
  attachment_url: string | null;
  is_read: boolean;
  created_at: string;
}

const QUICK_REPLIES = [
  "Halo! Terima kasih telah menghubungi kami. Ada yang bisa kami bantu?",
  "Pesanan Anda sedang kami siapkan di dapur. Mohon ditunggu sebentar ya.",
  "Pesanan Anda sudah siap dan sedang dalam perjalanan ke meja Anda.",
  "Mohon maaf atas ketidaknyamanannya. Kami akan segera menangani hal ini.",
  "Untuk pertanyaan lebih lanjut, silakan hubungi staf kami di tempat.",
  "Pembayaran Anda telah kami terima. Terima kasih!",
  "Kurir kami sedang dalam perjalanan menuju lokasi Anda.",
  "Pesanan Anda telah selesai diproses. Selamat menikmati!",
];

export default function CashierChatPage() {
  const supabase = createClient();

  // State: daftar chat & filter
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeOrderType, setActiveOrderType] = useState<OrderType>("all");
  const [activeChatStatus, setActiveChatStatus] = useState<ChatStatus>("all");

  // State: chat yang dipilih
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [sending, setSending] = useState(false);
  const [isCustomerTyping, setIsCustomerTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loadingOrderItems, setLoadingOrderItems] = useState(false);
  const [isMobileListOpen, setIsMobileListOpen] = useState(true);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presenceChannelRef = useRef<any>(null);
  const chatProfile = useRef<{ id: string; role: string } | null>(null);

  // --- Audio Notif ---
  const playPingSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch {}
  }, []);

  // --- Fetch profil kasir ---
  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("id, role").eq("user_id", user.id).single();
      if (data) chatProfile.current = data;
    };
    getProfile();
  }, []);

  // --- Fetch daftar chat ---
  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch("/api/cashier/chat");
      if (!res.ok) return;
      const data = await res.json();
      setChats(data);
    } catch (e) {
      console.error("Gagal memuat daftar chat:", e);
    } finally {
      setLoadingChats(false);
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // --- Realtime: daftar chat (saat ada pesan baru, update badge) ---
  useEffect(() => {
    const channel = supabase
      .channel("cashier-chat-list-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "order_chat_messages" }, () => {
        fetchChats();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_chats" }, () => {
        fetchChats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchChats]);

  // --- Presence tracking (kasir online) ---
  useEffect(() => {
    const setupPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("user_id", user.id).single();
      if (!profile) return;

      const channel = supabase.channel("online-presence");
      presenceChannelRef.current = channel;
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString(), role: profile.role, name: profile.full_name });
        }
      });
    };
    setupPresence();
    return () => {
      if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current);
    };
  }, []);

  // Saat chat berubah, fetch pesan-nya
  useEffect(() => {
    if (!selectedChat) return;
    setMessages([]);
    setMessageInput("");
    setAttachmentUrl("");
    setIsCustomerTyping(false);
    setShowQuickReplies(false);
    setShowOrderDetail(false);

    // Fetch pesan langsung lewat Supabase client (lebih efisien dari sisi kasir)
    const loadMessages = async () => {
      setLoadingMessages(true);
      const { data } = await supabase
        .from("order_chat_messages")
        .select("*")
        .eq("chat_id", selectedChat.id)
        .order("created_at", { ascending: true });
      setMessages(data || []);
      setLoadingMessages(false);

      // Tandai semua pesan pelanggan sebagai dibaca
      await supabase
        .from("order_chat_messages")
        .update({ is_read: true })
        .eq("chat_id", selectedChat.id)
        .eq("sender_role", "customer")
        .eq("is_read", false);
      fetchChats();
    };
    loadMessages();
  }, [selectedChat?.id]);

  // --- Realtime pesan untuk chat yang sedang dibuka ---
  useEffect(() => {
    if (!selectedChat?.id) return;

    const channel = supabase
      .channel(`cashier-messages-${selectedChat.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "order_chat_messages",
        filter: `chat_id=eq.${selectedChat.id}`
      }, (payload: any) => {
        setMessages(prev => {
          if (prev.some(m => m.id === payload.new.id)) return prev;
          if (payload.new.sender_role === "customer") {
            playPingSound();
            // Auto-tandai sebagai dibaca karena sedang dibuka
            supabase.from("order_chat_messages").update({ is_read: true }).eq("id", payload.new.id);
          }
          return [...prev, payload.new];
        });
        fetchChats();
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "order_chats",
        filter: `id=eq.${selectedChat.id}`
      }, (payload: any) => {
        setSelectedChat(prev => prev ? { ...prev, ...payload.new } : prev);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChat?.id, playPingSound]);

  // --- Realtime typing indicator ---
  useEffect(() => {
    if (!selectedChat?.id) return;

    const channel = supabase.channel(`order-chat-typing-${selectedChat.id}`);
    typingChannelRef.current = channel;

    channel
      .on("broadcast", { event: "typing" }, (payload: any) => {
        if (payload.payload.sender === "customer") {
          setIsCustomerTyping(payload.payload.isTyping);
          if (payload.payload.isTyping) {
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => setIsCustomerTyping(false), 3000);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [selectedChat?.id]);

  // --- Auto scroll ke bawah ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isCustomerTyping]);

  // --- Fetch order items untuk panel detail ---
  const fetchOrderItems = useCallback(async () => {
    if (!selectedChat?.order_id) return;
    setLoadingOrderItems(true);
    try {
      const { data } = await supabase
        .from("order_items")
        .select("*, menu_items(name, price)")
        .eq("order_id", selectedChat.order_id);
      setOrderItems(data || []);
    } catch (e) {
      console.error("Gagal memuat item pesanan:", e);
    } finally {
      setLoadingOrderItems(false);
    }
  }, [selectedChat?.order_id]);

  useEffect(() => {
    if (showOrderDetail) fetchOrderItems();
  }, [showOrderDetail, fetchOrderItems]);

  // --- Kirim typing status ---
  const sendTypingStatus = (isTyping: boolean) => {
    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { sender: "cashier", isTyping }
      });
    }
  };

  const handleInputChange = (val: string) => {
    setMessageInput(val);
    sendTypingStatus(val.length > 0);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTypingStatus(false), 2000);
  };

  // --- Kirim pesan kasir ---
  const sendMessage = async (e?: React.FormEvent, overrideText?: string) => {
    e?.preventDefault();
    const text = overrideText ?? messageInput;
    if (!text.trim() && !attachmentUrl) return;
    if (!selectedChat) return;

    setSending(true);
    setMessageInput("");
    setAttachmentUrl("");
    setShowQuickReplies(false);
    sendTypingStatus(false);

    try {
      const res = await fetch("/api/cashier/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: selectedChat.id,
          message: text || null,
          attachment_url: attachmentUrl || null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim pesan");

      // Update selectedChat dengan is_replied_manually = true
      setSelectedChat(prev => prev ? { ...prev, is_replied_manually: true } : prev);
      fetchChats();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim pesan");
      setMessageInput(text);
    } finally {
      setSending(false);
    }
  };

  // --- Upload file/dokumen/kamera ---
  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isCamera = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5MB");
      return;
    }

    setUploadingFile(true);
    const toastId = toast.loading(isCamera ? "Mengunggah foto..." : "Mengunggah file...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "profiles");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal mengunggah file");

      const publicUrl = result.url;

      const resMsg = await fetch("/api/cashier/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: selectedChat!.id,
          message: isCamera ? "Mengirim foto dari kamera" : `Mengirim file: ${file.name}`,
          attachment_url: publicUrl
        })
      });

      const dataMsg = await resMsg.json();
      if (!resMsg.ok) {
        throw new Error(dataMsg.error || "Gagal mengirim pesan");
      }

      toast.success("File berhasil diunggah dan dikirim!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunggah file", { id: toastId });
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  // --- Aksi chat (blokir, selesai, dll) ---
  const performAction = async (action: string, successMsg: string) => {
    if (!selectedChat) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/cashier/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: selectedChat.id, action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal melakukan aksi");
      toast.success(successMsg);
      setSelectedChat(prev => prev ? { ...prev, ...data.chat } : prev);
      fetchChats();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- Filter daftar chat ---
  const filteredChats = chats.filter(chat => {
    if (activeOrderType !== "all" && chat.order?.order_type !== activeOrderType) return false;
    if (activeChatStatus !== "all" && chat.status !== activeChatStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = chat.customer?.full_name?.toLowerCase().includes(q);
      const matchOrder = chat.order_id?.toLowerCase().includes(q);
      const matchMsg = chat.last_message?.message?.toLowerCase().includes(q);
      if (!matchName && !matchOrder && !matchMsg) return false;
    }
    return true;
  });

  // --- Helper: warna & label berdasarkan tipe order ---
  const getOrderTypeStyle = (type: string) => {
    switch (type) {
      case "dine_in": return { bg: "bg-emerald-100 text-emerald-700", icon: Utensils, label: "Dine In" };
      case "takeaway": return { bg: "bg-amber-100 text-amber-700", icon: Coffee, label: "Takeaway" };
      case "delivery": return { bg: "bg-blue-100 text-blue-700", icon: Truck, label: "Delivery" };
      default: return { bg: "bg-gray-100 text-gray-700", icon: Package, label: type };
    }
  };

  const getChatStatusStyle = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-700";
      case "completed": return "bg-gray-100 text-gray-500";
      case "waiting_customer": return "bg-amber-100 text-amber-700";
      case "need_admin": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-500";
    }
  };

  const getChatStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Aktif";
      case "completed": return "Selesai";
      case "waiting_customer": return "Menunggu Pelanggan";
      case "need_admin": return "Perlu Admin";
      default: return status;
    }
  };

  const isChatInputDisabled = !selectedChat ||
    selectedChat.is_blocked ||
    selectedChat.status === "completed";

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col overflow-hidden p-4 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-black text-text-light dark:text-text-dark">Live Chat</h1>
          <p className="text-sm text-muted">Konsol pesan langsung dengan pelanggan</p>
        </div>
        <button
          onClick={() => { fetchChats(); toast.success("Daftar chat diperbarui"); }}
          title="Segarkan daftar chat"
          aria-label="Segarkan daftar chat"
          className="p-2.5 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-muted hover:text-primary transition-all"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">

        {/* ====== PANEL KIRI: Daftar Chat ====== */}
        <div className={`w-full md:w-[340px] flex-shrink-0 flex flex-col gap-3 ${selectedChat ? 'hidden md:flex' : 'flex'}`}>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama, pesanan, atau pesan..."
              className="w-full pl-9 pr-4 py-2.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30 text-text-light dark:text-text-dark"
            />
          </div>

          {/* Filter Tipe Order */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {([
              { id: "all", label: "Semua" },
              { id: "dine_in", label: "Dine In" },
              { id: "takeaway", label: "Takeaway" },
              { id: "delivery", label: "Delivery" },
            ] as { id: OrderType; label: string }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveOrderType(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all ${activeOrderType === tab.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-muted hover:text-primary"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filter Status */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {([
              { id: "all", label: "Semua Status" },
              { id: "active", label: "Aktif" },
              { id: "waiting_customer", label: "Menunggu" },
              { id: "need_admin", label: "Perlu Admin" },
              { id: "completed", label: "Selesai" },
            ] as { id: ChatStatus; label: string }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveChatStatus(tab.id)}
                className={`px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap transition-all ${activeChatStatus === tab.id ? "bg-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-muted hover:text-primary"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Daftar Chat */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-0">
            {loadingChats ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 opacity-50">
                <MessageSquare className="w-12 h-12 text-muted mb-3" />
                <p className="text-sm text-muted font-medium">Tidak ada chat ditemukan</p>
              </div>
            ) : (
              filteredChats.map(chat => {
                const typeStyle = getOrderTypeStyle(chat.order?.order_type);
                const TypeIcon = typeStyle.icon;
                const isSelected = selectedChat?.id === chat.id;
                return (
                  <motion.button
                    key={chat.id}
                    onClick={() => { setSelectedChat(chat); setIsMobileListOpen(false); }}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                        : "bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark hover:border-primary/40 hover:shadow-md"
                    }`}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm uppercase ${isSelected ? "bg-white/20 text-white" : "bg-primary/10 text-primary"}`}>
                        {chat.customer?.avatar_url ? (
                          <img src={chat.customer.avatar_url} alt={chat.customer.full_name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          chat.customer?.full_name?.charAt(0) || "?"
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`font-bold text-sm truncate ${isSelected ? "text-white" : "text-text-light dark:text-text-dark"}`}>
                            {chat.customer?.full_name || "Pelanggan"}
                          </p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {chat.unread_count > 0 && (
                              <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black ${isSelected ? "bg-white text-primary" : "bg-rose-500 text-white"}`}>
                                {chat.unread_count}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase ${isSelected ? "bg-white/20 text-white" : typeStyle.bg}`}>
                            {typeStyle.label}
                          </span>
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase ${isSelected ? "bg-white/20 text-white" : getChatStatusStyle(chat.status)}`}>
                            {getChatStatusLabel(chat.status)}
                          </span>
                          {chat.is_blocked && (
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase ${isSelected ? "bg-white/20 text-white" : "bg-red-100 text-red-700"}`}>
                              Diblokir
                            </span>
                          )}
                        </div>

                        {chat.last_message && (
                          <p className={`text-xs mt-1 truncate ${isSelected ? "text-white/70" : "text-muted"}`}>
                            {chat.last_message.sender_role === "cashier" ? "Anda: " : chat.last_message.sender_role === "ai" ? "Bot: " : ""}
                            {chat.last_message.attachment_url && !chat.last_message.message ? "[Gambar]" : chat.last_message.message || ""}
                          </p>
                        )}

                        <p className={`text-[10px] mt-1 ${isSelected ? "text-white/50" : "text-muted/60"}`}>
                          {chat.updated_at ? formatDistanceToNow(new Date(chat.updated_at), { addSuffix: true, locale: localeId }) : "-"}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                );
              })
            )}
          </div>
        </div>

        {/* ====== PANEL TENGAH: Konsol Chat ====== */}
        <div className={`flex-1 flex flex-col min-w-0 overflow-hidden rounded-2xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
          {!selectedChat ? (
            <div className="flex-1 flex flex-col items-center justify-center opacity-40 p-8 text-center">
              <MessageSquare className="w-16 h-16 text-muted mb-4" />
              <p className="text-lg font-bold text-muted">Pilih percakapan</p>
              <p className="text-sm text-muted mt-1">Klik salah satu chat dari daftar di kiri untuk mulai membalas</p>
            </div>
          ) : (
            <>
              {/* Header Chat */}
              <div className="p-4 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-gray-800/30 flex items-center gap-3">
                <button
                  onClick={() => { setSelectedChat(null); setIsMobileListOpen(true); }}
                  aria-label="Kembali ke daftar chat"
                  title="Kembali"
                  className="p-2 md:hidden text-muted hover:text-primary rounded-xl transition-all"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm uppercase flex-shrink-0">
                  {selectedChat.customer?.avatar_url ? (
                    <img src={selectedChat.customer.avatar_url} alt={selectedChat.customer.full_name} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    selectedChat.customer?.full_name?.charAt(0) || "?"
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-black text-text-light dark:text-text-dark truncate">{selectedChat.customer?.full_name}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase ${getOrderTypeStyle(selectedChat.order?.order_type).bg}`}>
                      {getOrderTypeStyle(selectedChat.order?.order_type).label}
                    </span>
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase ${getChatStatusStyle(selectedChat.status)}`}>
                      {getChatStatusLabel(selectedChat.status)}
                    </span>
                    {!selectedChat.is_replied_manually && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase bg-violet-100 text-violet-700">
                        AI Aktif
                      </span>
                    )}
                    {selectedChat.is_blocked && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase bg-red-100 text-red-700">
                        Diblokir
                      </span>
                    )}
                    <span className="text-[10px] text-muted font-mono">
                      #{selectedChat.order_id?.split("-")[0]}
                    </span>
                  </div>
                </div>

                {/* Aksi Header */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setShowOrderDetail(!showOrderDetail)}
                    title={showOrderDetail ? "Tutup detail pesanan" : "Lihat detail pesanan"}
                    aria-label={showOrderDetail ? "Tutup detail pesanan" : "Lihat detail pesanan"}
                    className={`p-2 rounded-xl transition-all text-sm ${showOrderDetail ? "bg-primary text-white" : "text-muted hover:bg-primary/10 hover:text-primary"}`}
                  >
                    <FileText className="w-4 h-4" />
                  </button>

                  {selectedChat.status !== "completed" && (
                    <button
                      onClick={() => performAction("mark_completed", "Chat ditandai selesai")}
                      title="Tandai selesai"
                      aria-label="Tandai chat selesai"
                      disabled={actionLoading}
                      className="p-2 rounded-xl text-muted hover:bg-green-100 hover:text-green-700 transition-all"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}

                  {selectedChat.status === "completed" && (
                    <button
                      onClick={() => performAction("reactivate", "Chat diaktifkan kembali")}
                      title="Aktifkan kembali"
                      aria-label="Aktifkan kembali chat"
                      disabled={actionLoading}
                      className="p-2 rounded-xl text-muted hover:bg-blue-100 hover:text-blue-700 transition-all"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    onClick={() => performAction("need_admin", "Ditandai perlu bantuan admin")}
                    title="Perlu bantuan admin"
                    aria-label="Eskalasi ke admin"
                    disabled={actionLoading}
                    className="p-2 rounded-xl text-muted hover:bg-amber-100 hover:text-amber-700 transition-all"
                  >
                    <AlertCircle className="w-4 h-4" />
                  </button>

                  {!selectedChat.is_blocked ? (
                    <button
                      onClick={() => setConfirmBlockOpen(true)}
                      title="Blokir pelanggan (spam)"
                      aria-label="Blokir pelanggan"
                      disabled={actionLoading}
                      className="p-2 rounded-xl text-muted hover:bg-red-100 hover:text-red-600 transition-all"
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => performAction("unblock", "Blokir dicabut")}
                      title="Cabut blokir pelanggan"
                      aria-label="Cabut blokir"
                      disabled={actionLoading}
                      className="p-2 rounded-xl text-muted hover:bg-green-100 hover:text-green-700 transition-all"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Area Pesan */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar min-h-0">
                {loadingMessages ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full opacity-40">
                    <MessageSquare className="w-10 h-10 text-muted mb-2" />
                    <p className="text-sm text-muted">Belum ada pesan dalam percakapan ini</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isCashier = msg.sender_role === "cashier";
                    const isAI = msg.sender_role === "ai";

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isCashier ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[75%] ${isCashier ? "items-end" : "items-start"} flex flex-col gap-1`}>
                          {/* Label pengirim */}
                          <span className="text-[10px] font-bold text-muted px-1">
                            {isCashier ? "Anda (Kasir)" : isAI ? "RestoBot (AI)" : selectedChat.customer?.full_name || "Pelanggan"}
                          </span>

                          {/* Bubble */}
                          <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            isCashier
                              ? "bg-primary text-white rounded-br-sm"
                              : isAI
                              ? "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 rounded-bl-sm"
                              : "bg-gray-100 dark:bg-gray-700 text-text-light dark:text-text-dark rounded-bl-sm"
                          }`}>
                            {msg.attachment_url && (
                              <div className="mb-2">
                                {(() => {
                                  const url = msg.attachment_url;
                                  const ext = url.split('.').pop()?.toLowerCase();
                                  const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
                                  if (isImg) {
                                    return (
                                      <a href={url} target="_blank" rel="noopener noreferrer">
                                        <img src={url} alt="Lampiran" className="max-w-[200px] rounded-xl hover:opacity-90 transition-opacity cursor-pointer border border-border-light dark:border-border-dark" />
                                      </a>
                                    );
                                  } else {
                                    return (
                                      <a href={url} target="_blank" rel="noopener noreferrer" className={`text-xs font-bold underline flex items-center gap-1.5 p-2 rounded-xl border ${isCashier ? 'bg-white/10 border-white/20 text-white' : 'bg-gray-50 dark:bg-gray-800 border-border-light dark:border-border-dark text-primary'}`}>
                                        <FileText className="w-4 h-4 shrink-0" />
                                        <span className="truncate max-w-[150px]">Lihat Dokumen</span>
                                      </a>
                                    );
                                  }
                                })()}
                              </div>
                            )}
                            {msg.message && <p className="whitespace-pre-wrap break-words">{msg.message}</p>}
                          </div>

                          {/* Waktu & status baca */}
                          <div className={`flex items-center gap-1 px-1 ${isCashier ? "flex-row-reverse" : ""}`}>
                            <span className="text-[10px] text-muted">
                              {format(new Date(msg.created_at), "HH:mm", { locale: localeId })}
                            </span>
                            {isCashier && (
                              msg.is_read
                                ? <CheckCheck className="w-3 h-3 text-primary" />
                                : <Check className="w-3 h-3 text-muted" />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}

                {/* Typing indicator */}
                <AnimatePresence>
                  {isCustomerTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="flex justify-start"
                    >
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                        <span className="text-xs text-muted font-medium">Pelanggan sedang mengetik</span>
                        <span className="flex gap-0.5">
                          {[0, 1, 2].map(i => (
                            <span key={i} className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* Preview lampiran */}
              <AnimatePresence>
                {attachmentUrl && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 py-2 border-t border-border-light dark:border-border-dark flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50"
                  >
                    <img src={attachmentUrl} alt="Preview lampiran" className="w-14 h-14 object-cover rounded-xl border border-border-light dark:border-border-dark" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-text-light dark:text-text-dark">Gambar siap dikirim</p>
                      <p className="text-xs text-muted">Klik kirim untuk melampirkan gambar ini</p>
                    </div>
                    <button
                      onClick={() => setAttachmentUrl("")}
                      aria-label="Hapus lampiran"
                      title="Hapus lampiran"
                      className="p-1.5 text-muted hover:text-rose-500 rounded-lg transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Quick Replies Dropdown */}
              <AnimatePresence>
                {showQuickReplies && !isChatInputDisabled && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800/50 overflow-hidden"
                  >
                    <div className="p-2 max-h-48 overflow-y-auto custom-scrollbar">
                      <p className="text-[10px] font-black text-muted uppercase tracking-widest px-2 py-1">Template Balasan Cepat</p>
                      {QUICK_REPLIES.map((reply, idx) => (
                        <button
                          key={idx}
                          onClick={() => sendMessage(undefined, reply)}
                          className="w-full text-left px-3 py-2 rounded-xl text-sm text-text-light dark:text-text-dark hover:bg-primary/10 hover:text-primary transition-all leading-snug"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input Area */}
              {selectedChat.is_blocked ? (
                <div className="p-4 border-t border-border-light dark:border-border-dark bg-red-50 dark:bg-red-900/20 flex items-center gap-3">
                  <Ban className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                    Chat ini diblokir. Pelanggan tidak dapat mengirim pesan baru.
                  </p>
                  <button
                    onClick={() => performAction("unblock", "Blokir dicabut")}
                    disabled={actionLoading}
                    className="ml-auto px-4 py-2 bg-red-500 text-white text-xs font-black rounded-xl hover:bg-red-600 transition-all whitespace-nowrap"
                  >
                    Cabut Blokir
                  </button>
                </div>
              ) : selectedChat.status === "completed" ? (
                <div className="p-4 border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800/50 flex items-center gap-3">
                  <CheckCheck className="w-5 h-5 text-muted flex-shrink-0" />
                  <p className="text-sm text-muted font-medium">Percakapan ini telah diselesaikan.</p>
                  <button
                    onClick={() => performAction("reactivate", "Chat diaktifkan kembali")}
                    disabled={actionLoading}
                    className="ml-auto px-4 py-2 bg-gray-200 dark:bg-gray-700 text-text-light dark:text-text-dark text-xs font-black rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-all whitespace-nowrap"
                  >
                    Buka Kembali
                  </button>
                </div>
              ) : (
                <form onSubmit={sendMessage} className="p-3 border-t border-border-light dark:border-border-dark flex items-end gap-2">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <label htmlFor="cashier-chat-file-input" className={`p-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800 text-muted hover:text-primary rounded-xl cursor-pointer transition-all flex items-center justify-center border border-border-light dark:border-border-dark ${uploadingFile ? "opacity-50 cursor-not-allowed" : ""}`} title="Pilih File dari Perangkat">
                      <Paperclip className="w-4 h-4" />
                      <input
                        type="file"
                        id="cashier-chat-file-input"
                        className="hidden"
                        disabled={uploadingFile}
                        onChange={(e) => handleChatFileUpload(e, false)}
                      />
                    </label>

                    <label htmlFor="cashier-chat-camera-input" className={`p-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800 text-muted hover:text-primary rounded-xl cursor-pointer transition-all flex items-center justify-center border border-border-light dark:border-border-dark ${uploadingFile ? "opacity-50 cursor-not-allowed" : ""}`} title="Ambil Foto dari Kamera">
                      <Camera className="w-4 h-4" />
                      <input
                        type="file"
                        id="cashier-chat-camera-input"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={uploadingFile}
                        onChange={(e) => handleChatFileUpload(e, true)}
                      />
                    </label>
                  </div>

                  {/* Tombol quick reply */}
                  <button
                    type="button"
                    onClick={() => setShowQuickReplies(v => !v)}
                    title="Template balasan cepat"
                    aria-label="Buka template balasan cepat"
                    className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${showQuickReplies ? "bg-primary text-white" : "text-muted hover:bg-primary/10 hover:text-primary"}`}
                  >
                    <FileText className="w-5 h-5" />
                  </button>

                  {/* Input teks */}
                  <textarea
                    value={messageInput}
                    onChange={e => handleInputChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Ketik balasan... (Enter untuk kirim)"
                    rows={1}
                    className="flex-1 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 text-text-light dark:text-text-dark resize-none max-h-32 overflow-y-auto custom-scrollbar"
                    style={{ minHeight: "44px" }}
                  />

                  {/* Tombol kirim */}
                  <button
                    type="submit"
                    disabled={sending || (!messageInput.trim() && !attachmentUrl)}
                    title="Kirim pesan"
                    aria-label="Kirim pesan"
                    className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-shrink-0 shadow-lg shadow-primary/20"
                  >
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

        {/* ====== PANEL KANAN: Detail Pesanan ====== */}
        <AnimatePresence>
          {selectedChat && showOrderDetail && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="flex-shrink-0 overflow-hidden"
            >
              <div className="w-[300px] h-full flex flex-col rounded-2xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden">
                {/* Header detail */}
                <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/30">
                  <p className="font-black text-sm text-text-light dark:text-text-dark">Detail Pesanan</p>
                  <button
                    onClick={() => setShowOrderDetail(false)}
                    aria-label="Tutup panel detail"
                    title="Tutup"
                    className="p-1.5 text-muted hover:text-primary rounded-xl transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {/* Info Pelanggan */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Pelanggan</p>
                    <div className="flex items-center gap-3 p-3 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm uppercase flex-shrink-0">
                        {selectedChat.customer?.full_name?.charAt(0) || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-text-light dark:text-text-dark truncate">{selectedChat.customer?.full_name}</p>
                        <p className="text-[10px] text-muted truncate">{selectedChat.customer?.email}</p>
                        {selectedChat.customer?.phone && (
                          <p className="text-[10px] text-muted">{selectedChat.customer.phone}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Info Pesanan */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Info Pesanan</p>
                    <div className="space-y-2 p-3 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted">No. Pesanan</span>
                        <span className="text-xs font-black text-text-light dark:text-text-dark font-mono">#{selectedChat.order_id?.split("-")[0]}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted">Tipe</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg uppercase ${getOrderTypeStyle(selectedChat.order?.order_type).bg}`}>
                          {getOrderTypeStyle(selectedChat.order?.order_type).label}
                        </span>
                      </div>
                      {selectedChat.order?.tables?.table_number && (
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted">Nomor Meja</span>
                          <span className="text-xs font-black text-text-light dark:text-text-dark">Meja {selectedChat.order.tables.table_number}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted">Status Pesanan</span>
                        <span className="text-xs font-black text-text-light dark:text-text-dark uppercase">{selectedChat.order?.status}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted">Pembayaran</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg uppercase ${selectedChat.order?.payment_status === "paid" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {selectedChat.order?.payment_status === "paid" ? "Lunas" : "Belum Bayar"}
                        </span>
                      </div>
                      {selectedChat.order?.notes && (
                        <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase mb-1">Catatan</p>
                          <p className="text-xs text-amber-700 dark:text-amber-300">{selectedChat.order.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Daftar Item */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Daftar Pesanan</p>
                    {loadingOrderItems ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : orderItems.length === 0 ? (
                      <p className="text-xs text-muted text-center py-3">Tidak ada item</p>
                    ) : (
                      <div className="space-y-2">
                        {orderItems.map(item => (
                          <div key={item.id} className="flex justify-between items-start p-3 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-text-light dark:text-text-dark truncate">
                                {item.quantity}x {item.menu_items?.name || "Item"}
                              </p>
                              {item.notes && <p className="text-[10px] text-primary mt-0.5 font-medium">Catatan: {item.notes}</p>}
                            </div>
                            <p className="text-xs font-black text-text-light dark:text-text-dark ml-2 flex-shrink-0">
                              Rp {Number(item.subtotal).toLocaleString("id-ID")}
                            </p>
                          </div>
                        ))}

                        {/* Breakdown */}
                        {(() => {
                          const foodSubtotal = orderItems.reduce((sum, item) => sum + Number(item.subtotal), 0);
                          const foodDiscount = Number(selectedChat.order.discount || 0);
                          const shipFee = Number(selectedChat.order.shipping_fee || 0);
                          const shipDiscount = Number(selectedChat.order.shipping_discount || 0);
                          
                          return (
                            <div className="space-y-1.5 text-[11px] font-bold text-muted border-t border-border-light dark:border-border-dark pt-3 mt-3">
                              <div className="flex justify-between">
                                <span>Subtotal Hidangan:</span>
                                <span className="text-text-light dark:text-text-dark">Rp {foodSubtotal.toLocaleString("id-ID")}</span>
                              </div>
                              {foodDiscount > 0 && (
                                <div className="flex justify-between text-green-600 dark:text-green-400">
                                  <span>Diskon Voucher:</span>
                                  <span>-Rp {foodDiscount.toLocaleString("id-ID")}</span>
                                </div>
                              )}
                              {selectedChat.order.order_type === "delivery" && (
                                <>
                                  <div className="flex justify-between">
                                    <span>Biaya Pengiriman ({Number(selectedChat.order.distance_km || 0).toFixed(1)} km):</span>
                                    <span className="text-text-light dark:text-text-dark">Rp {shipFee.toLocaleString("id-ID")}</span>
                                  </div>
                                  {shipDiscount > 0 && (
                                    <div className="flex justify-between text-green-600 dark:text-green-400">
                                      <span>Diskon Ongkir:</span>
                                      <span>-Rp {shipDiscount.toLocaleString("id-ID")}</span>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })()}

                        {/* Total */}
                        <div className="flex justify-between items-center p-3 bg-primary/10 rounded-xl border border-primary/20 mt-2">
                          <span className="text-xs font-black text-primary uppercase tracking-wider">Total</span>
                          <span className="text-sm font-black text-primary">
                            Rp {Number(selectedChat.order?.total_amount).toLocaleString("id-ID")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tombol Cetak Struk */}
                  {selectedChat.order?.payment_status === "paid" && (
                    <button
                      onClick={() => {
                        toast("Fitur cetak struk tersedia di halaman Pesanan.", { icon: undefined });
                      }}
                      className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-text-light dark:text-text-dark text-xs font-black rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4" />
                      Cetak Struk (via Halaman Pesanan)
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConfirmDialog
        isOpen={confirmBlockOpen}
        title="Blokir Pelanggan"
        message="Apakah Anda yakin ingin memblokir chat pelanggan ini karena indikasi penyalahgunaan? Pelanggan tidak dapat mengirim pesan baru."
        confirmText="Ya, Blokir"
        onConfirm={() => {
          performAction("block", "Pelanggan diblokir");
          setConfirmBlockOpen(false);
        }}
        onClose={() => setConfirmBlockOpen(false)}
        type="danger"
      />
    </div>
  );
}
