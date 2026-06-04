"use client";
export const runtime = 'edge';

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle2, Clock, ChefHat, PackageCheck, AlertCircle, AlertTriangle, Printer, Banknote, CreditCard, Receipt as ReceiptIcon, XCircle, ShieldAlert, RotateCcw, Star, MessageSquare, ArrowRight, Globe, X, Lock, Wallet, Camera, Send, Paperclip, FileText, Trash2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import Image from "next/image";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import Receipt from "@/components/Receipt";
import { downloadReceiptPDF } from "@/utils/receiptPdfGenerator";

import CameraCaptureModal from "@/components/CameraCaptureModal";
import OrderCountdown from "@/components/OrderCountdown";
import { useAudioStore } from "@/store/useAudioStore";

declare const google: any;



export default function OrderTrackingPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Refund States
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundMethod, setRefundMethod] = useState<"wallet" | "bank">("wallet");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [accountName, setAccountName] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Review States
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  // Payment Selection States
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [duitkuMethod, setDuitkuMethod] = useState("");
  const [taxPercent, setTaxPercent] = useState<number>(10.00);
  const [restoLat, setRestoLat] = useState<number>(-7.7829);
  const [restoLng, setRestoLng] = useState<number>(110.3323);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [paymentExpiryMinutes, setPaymentExpiryMinutes] = useState<number>(60);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isDuitkuOpen, setIsDuitkuOpen] = useState(false);
  const supabase = createClient();

  const [profileData, setProfileData] = useState<any>(null);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [submittingTopUp, setSubmittingTopUp] = useState(false);
  const [selectedPaymentOption, setSelectedPaymentOption] = useState<"duitku" | "wallet">("duitku");
  const [payingViaWallet, setPayingViaWallet] = useState(false);

  // Wallet PIN payment states
  const [showPinPaymentModal, setShowPinPaymentModal] = useState(false);
  const [paymentPin, setPaymentPin] = useState("");
  const [pinRemainingAttempts, setPinRemainingAttempts] = useState<number | null>(null);

  // Live Chat States
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatTyping, setChatTyping] = useState(false);
  const [chatRoom, setChatRoom] = useState<any>(null);
  const [senderRoles, setSenderRoles] = useState<Record<string, string>>({});
  const [cashiersOnlineCount, setCashiersOnlineCount] = useState(0);
  const [chatCountdownText, setChatCountdownText] = useState("");
  const [chatAttachmentUrl, setChatAttachmentUrl] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [chatActionLoading, setChatActionLoading] = useState(false);
  const [waitingTime, setWaitingTime] = useState(0);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);

  const playPingSound = () => {
    const isGlobalEnabled = useAudioStore.getState().isCustomerSoundEnabled;
    if (!isGlobalEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };

      const now = ctx.currentTime;
      playTone(659.25, now, 0.4); // E5
      playTone(880.00, now + 0.12, 0.5); // A5
    } catch (err) {}
  };

  const fetchChatMessages = async () => {
    setChatLoading(true);
    try {
      const res = await fetch(`/api/customer/orders/${id}/chat`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat obrolan");
      setChatRoom(data.chat);
      setChatMessages(data.messages || []);
      if (data.messages) {
        const roles: Record<string, string> = {};
        data.messages.forEach((msg: any) => {
          if (msg.sender_id && msg.sender?.role) {
            roles[msg.sender_id] = msg.sender.role;
          }
        });
        setSenderRoles(prev => ({ ...prev, ...roles }));
      }
      // Auto-scroll ke bawah setelah pesan dimuat
      setTimeout(() => {
        chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e: any) {
      console.error(e.message);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (showChatDrawer) {
      fetchChatMessages();
    }
  }, [showChatDrawer]);

  const triggerOrderChatCronCleanup = async () => {
    try {
      await fetch('/api/support/ticket/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: chatRoom?.id })
      });
      fetchChatMessages();
    } catch (e) {
      console.error("Gagal menjalankan auto-cleanup obrolan order:", e);
    }
  };

  useEffect(() => {
    if (!chatRoom || !chatRoom.chat_history_deleted_at) {
      setChatCountdownText('');
      return;
    }

    if (chatRoom.status === 'expired') {
      setChatCountdownText('');
      return;
    }

    const deletionTime = new Date(chatRoom.chat_history_deleted_at).getTime();
    const initialDiff = deletionTime - Date.now();

    if (initialDiff <= 0) {
      setChatCountdownText('00:00:00');
      triggerOrderChatCronCleanup();
      return;
    }

    // Set initial text immediately (before first interval tick)
    const computeText = (diff: number) => {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      const pad = (num: number) => num.toString().padStart(2, '0');
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    setChatCountdownText(computeText(initialDiff));

    const interval = setInterval(() => {
      const diff = deletionTime - Date.now();

      if (diff <= 0) {
        setChatCountdownText('00:00:00');
        clearInterval(interval);
        triggerOrderChatCronCleanup();
      } else {
        setChatCountdownText(computeText(diff));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [chatRoom?.chat_history_deleted_at, chatRoom?.status]);

  // Efek untuk membersihkan pesan chat saat chatRoom kedaluwarsa (expired) secara real-time
  useEffect(() => {
    if (chatRoom?.status === 'expired') {
      setChatMessages([]);
    }
  }, [chatRoom?.status]);

  // Efek untuk memperbarui durasi tunggu pelanggan di antrean secara real-time
  useEffect(() => {
    const aiStatus = chatRoom?.ai_chat_status;
    if ((aiStatus === 'waiting_cashier' || aiStatus === 'transfer_requested') && !chatRoom?.is_replied_manually) {
      const interval = setInterval(() => {
        const updatedTime = chatRoom.updated_at ? new Date(chatRoom.updated_at).getTime() : Date.now();
        const elapsed = Math.floor((Date.now() - updatedTime) / 1000);
        setWaitingTime(elapsed);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setWaitingTime(0);
    }
  }, [chatRoom?.ai_chat_status, chatRoom?.updated_at, chatRoom?.is_replied_manually]);

  // Realtime messages subscription
  useEffect(() => {
    if (!showChatDrawer || !chatRoom?.id) return;

    const channel = supabase
      .channel(`chat-messages-${chatRoom.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_chat_messages',
        filter: `chat_id=eq.${chatRoom.id}`
      }, (payload: any) => {
        const newMsg = payload.new;
        setChatMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          if (newMsg.sender_role !== 'customer') {
            playPingSound();
          }
          // Fetch sender role in background if not cached
          const senderId = newMsg.sender_id;
          if (senderId) {
            setSenderRoles(currentRoles => {
              if (!currentRoles[senderId]) {
                supabase
                  .from('profiles')
                  .select('role')
                  .eq('id', senderId)
                  .single()
                  .then(({ data }) => {
                    if (data?.role) {
                      setSenderRoles(prev => ({ ...prev, [senderId]: data.role }));
                    }
                  });
              }
              return currentRoles;
            });
          }
          // Auto-scroll ke bawah saat ada pesan baru
          setTimeout(() => {
            chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 80);
          return [...prev, newMsg];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'order_chats',
        filter: `id=eq.${chatRoom.id}`
      }, (payload: any) => {
        setChatRoom(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showChatDrawer, chatRoom?.id]);

  // Realtime typing broadcast & listener
  useEffect(() => {
    if (!showChatDrawer || !chatRoom?.id) return;

    const channel = supabase.channel(`order-chat-typing-${chatRoom.id}`);
    typingChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        if (payload.payload.sender === 'cashier') {
          setChatTyping(payload.payload.isTyping);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [showChatDrawer, chatRoom?.id]);

  // Track presence for online cashier status
  useEffect(() => {
    const presenceChannel = supabase.channel('online-presence');

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        let count = 0;
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (['cashier', 'admin'].includes(presence.role)) {
              count++;
            }
          });
        });
        setCashiersOnlineCount(count);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString(), role: 'customer' });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, []);

  const sendTypingStatus = (isTyping: boolean) => {
    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { sender: 'customer', isTyping }
      });
    }
  };

  const handleTypingEvent = () => {
    sendTypingStatus(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStatus(false);
    }, 2000);
  };

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
      formData.append('file', file);
      formData.append('bucket', 'profiles');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengunggah file");

      const publicUrl = data.url;

      const resMsg = await fetch(`/api/customer/orders/${id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: isCamera ? "Mengirim foto dari kamera" : `Mengirim file: ${file.name}`,
          attachment_url: publicUrl
        })
      });

      const dataMsg = await resMsg.json();
      if (!resMsg.ok) throw new Error(dataMsg.error || "Gagal mengirim pesan");

      toast.success("File berhasil diunggah dan dikirim!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunggah file", { id: toastId });
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const handleCameraCapture = async (file: File) => {
    setUploadingFile(true);
    const toastId = toast.loading("Mengunggah foto...");
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', 'profiles');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengunggah foto");

      const publicUrl = data.url;

      const resMsg = await fetch(`/api/customer/orders/${id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: "Mengirim foto dari kamera",
          attachment_url: publicUrl
        })
      });

      const dataMsg = await resMsg.json();
      if (!resMsg.ok) throw new Error(dataMsg.error || "Gagal mengirim pesan");

      toast.success("Foto berhasil diambil dan dikirim!", { id: toastId });
      fetchChatMessages();
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunggah foto", { id: toastId });
    } finally {
      setUploadingFile(false);
    }
  };

  const containsProfanity = (text: string) => {
    const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    const vulgarWords = ['anjing', 'babi', 'bangsat', 'goblok', 'tolol', 'kontol', 'memek', 'pantek', 'jancok'];
    return vulgarWords.some(word => cleanText.includes(word));
  };

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() && !chatAttachmentUrl) return;

    if (chatInput && containsProfanity(chatInput)) {
      toast.error("Pesan Anda mengandung kata-kata tidak sopan. Harap gunakan bahasa yang baik.");
      return;
    }

    setChatSending(true);
    const textToSend = chatInput;
    const attachmentToSend = chatAttachmentUrl;
    
    setChatInput("");
    setChatAttachmentUrl("");
    sendTypingStatus(false);

    try {
      const res = await fetch(`/api/customer/orders/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend || null,
          attachment_url: attachmentToSend || null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal mengirim pesan");
        setChatInput(textToSend);
        setChatAttachmentUrl(attachmentToSend);
      } else {
        fetchChatMessages();
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim pesan");
      setChatInput(textToSend);
      setChatAttachmentUrl(attachmentToSend);
    } finally {
      setChatSending(false);
    }
  };

  const handleChatAction = async (action: 'request_cashier' | 'confirm_transfer' | 'cancel_transfer' | 'complete_chat') => {
    if (chatActionLoading) return;
    setChatActionLoading(true);
    try {
      const res = await fetch(`/api/customer/orders/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal melakukan aksi");
      } else {
        fetchChatMessages();
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setChatActionLoading(false);
    }
  };

  const sendQuickReplyMessage = async (text: string) => {
    if (chatSending || chatActionLoading) return;
    if (text === "Hubungi kasir" || text === "Hubungi Kasir") {
      handleChatAction('request_cashier');
      return;
    }
    if (text === "Selesai" || text === "selesai") {
      handleChatAction('complete_chat');
      return;
    }
    
    setChatSending(true);
    try {
      const res = await fetch(`/api/customer/orders/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          attachment_url: null
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal mengirim pesan");
      } else {
        fetchChatMessages();
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim pesan");
    } finally {
      setChatSending(false);
    }
  };



  const fetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase
        .from("profiles")
        .select("id, wallet_balance, is_wallet_blocked, wallet_status")
        .eq("user_id", session.user.id)
        .single();
      if (data) {
        setProfileData(data);
      }
    }
  };

  useEffect(() => {
    fetchProfile();
    const channel = supabase.channel("order_profile_realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        fetchProfile();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(topUpAmount);

    if (isNaN(amount) || amount <= 0) {
      toast.error("Nominal top up tidak valid");
      return;
    }

    if (amount < 10000) {
      toast.error("Minimal top up adalah Rp 10.000");
      return;
    }

    setSubmittingTopUp(true);
    const topupToast = toast.loading("Memproses request top up...");
    try {
      const res = await fetch("/api/customer/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gagal membuat invoice top up");

      toast.dismiss(topupToast);
      setShowTopUpModal(false);
      setTopUpAmount("");

      // Use Duitku Pop if available
      if (data.reference && typeof (window as any).checkout !== 'undefined') {
        (window as any).checkout.process(data.reference, {
          successEvent: function(result: any) {
            console.log("Duitku Wallet Topup Success:", result);
            toast.success("Top Up Berhasil! Saldo akan masuk dalam beberapa saat.");
            fetchProfile();
          },
          pendingEvent: function(result: any) {
            console.log("Duitku Wallet Topup Pending:", result);
            toast("Menunggu pembayaran...", { icon: <Loader2 className="w-4 h-4 animate-spin text-primary" /> });
            fetchProfile();
          },
          errorEvent: function(result: any) {
            console.error("Duitku Wallet Topup Error:", result);
            toast.error("Pembayaran dibatalkan.");
            fetchProfile();
          },
          closeEvent: function() {
            console.log("Duitku Pop Closed.");
            fetchProfile();
          }
        });
      } else if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("Gagal mengunduh tautan pembayaran.");
      }
    } catch (err: any) {
      toast.error(err.message, { id: topupToast });
    } finally {
      setSubmittingTopUp(false);
    }
  };

  const handlePayViaWallet = async (enteredPin?: string) => {
    if (payingViaWallet) return;
    
    if (!enteredPin) {
      setPinRemainingAttempts(null);
      setPaymentPin("");
      setShowPinPaymentModal(true);
      return;
    }

    setPayingViaWallet(true);
    const pToast = toast.loading("Memproses pembayaran via Saldo Dompet...");
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'pay_order_via_wallet',
          orderId: id,
          pin: enteredPin
        })
      });
      const result = await res.json();
      if (!res.ok) {
        if (result.code === 'WALLET_BLOCKED' || result.code === 'WALLET_BLOCKED_NOW') {
          setShowPinPaymentModal(false);
          toast.error(result.error || 'Akses Dompetku diblokir.', { id: pToast });
          router.push('/customer/wallet');
          return;
        }
        if (result.code === 'NO_PIN') {
          setShowPinPaymentModal(false);
          toast.error(result.error || 'Anda belum memiliki PIN.', { id: pToast });
          router.push('/customer/wallet');
          return;
        }
        if (result.code === 'WRONG_PIN') {
          toast.error(result.error || 'PIN salah.', { id: pToast });
          setPinRemainingAttempts(result.remaining);
          setPaymentPin("");
          return;
        }
        throw new Error(result.error || "Gagal memproses pembayaran");
      }

      toast.success("Pembayaran Berhasil via Saldo Dompet!", { id: pToast });
      setShowPinPaymentModal(false);
      fetchOrderDetails();
      fetchProfile();
    } catch (err: any) {
      toast.error(err.message || "Gagal melakukan pembayaran", { id: pToast });
    } finally {
      setPayingViaWallet(false);
    }
  };


  useEffect(() => {
    const initAudio = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        useAudioStore.getState().initAudioSettings(session.user.id);
      }
    };
    initAudio();
  }, []);

  useEffect(() => {
    if (id) fetchOrderDetails();
    const channel = supabase.channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, payload => {
        setOrder((prev: any) => ({ ...prev, ...payload.new }));
        fetchOrderDetails();
        toast.success(`Status pesanan berubah: ${getStatusText(payload.new.status)}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from("restaurant_settings").select("tax_percent, payment_expiry_minutes, resto_latitude, resto_longitude").single();
      if (data) {
        if (data.tax_percent !== null && data.tax_percent !== undefined) {
          setTaxPercent(Number(data.tax_percent));
        }
        if (data.payment_expiry_minutes !== null && data.payment_expiry_minutes !== undefined) {
          setPaymentExpiryMinutes(Number(data.payment_expiry_minutes));
        }
        if (data.resto_latitude !== null && data.resto_latitude !== undefined) {
          setRestoLat(Number(data.resto_latitude));
        }
        if (data.resto_longitude !== null && data.resto_longitude !== undefined) {
          setRestoLng(Number(data.resto_longitude));
        }
        setSettingsLoaded(true);
      }
    };
    fetchSettings();
  }, []);

  const fetchOrderDetails = async () => {
    try {
      const { data: orderData, error } = await supabase
        .from("orders")
        .select("*, tables(table_number), cashier:profiles!orders_cashier_id_fkey(full_name), vouchers(code, voucher_type)")
        .eq("id", id)
        .single();
      if (error) throw error;
      
      setOrder(orderData);

      // Fetch cashier name if this order was processed by a cashier
      if (orderData.cashier?.full_name) {
        setCashierName(orderData.cashier.full_name);
      }

      const { data: itemsData } = await supabase.from("order_items").select("*, menu_items(name, image_url)").eq("order_id", id);
      setOrderItems(itemsData || []);

      if (orderData.customer_id) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", orderData.customer_id).single();
        if (profile) setCustomerName(profile.full_name);
      }

      const { data: revData } = await supabase.from("reviews").select("id").eq("order_id", id).maybeSingle();
      if (revData) setHasReviewed(true);
    } catch (e: any) {
      toast.error("Gagal memuat: " + e.message);
      router.push("/customer/orders");
    } finally { setLoading(false); }
  };

  const handleAutoCancel = async () => {
    try {
      const { error } = await supabase.from("orders").update({
        status: "cancelled",
        cancel_reason: "Batas waktu pembayaran habis (Batal Otomatis)"
      }).eq("id", id);
      if (error) throw error;
      
      if (order?.table_id) {
        await supabase.from("tables").update({ status: "available" }).eq("id", order.table_id);
      }
      
      fetchOrderDetails();
      toast.error("Batas waktu pembayaran habis. Pesanan dibatalkan otomatis.");
    } catch (e: any) {
      console.error("Auto cancel error:", e);
    }
  };

  useEffect(() => {
    if (!order || order.payment_status !== "unpaid" || order.payment_method !== "non_cash" || order.status === "cancelled") {
      setTimeLeft(null);
      return;
    }

    if (isDuitkuOpen) {
      return;
    }

    const calculateTimeLeft = () => {
      const createdAt = new Date(order.created_at).getTime();
      const expiryTime = createdAt + paymentExpiryMinutes * 60 * 1000;
      const now = new Date().getTime();
      return Math.max(0, Math.floor((expiryTime - now) / 1000));
    };

    const initialDiff = calculateTimeLeft();
    setTimeLeft(initialDiff);

    if (initialDiff <= 0) {
      handleAutoCancel();
      return;
    }

    const interval = setInterval(async () => {
      const diff = calculateTimeLeft();
      setTimeLeft(diff);
      if (diff <= 0) {
        clearInterval(interval);
        await handleAutoCancel();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order, paymentExpiryMinutes, isDuitkuOpen]);

  const formatTimeLeft = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const [paying, setPaying] = useState(false);

  const handlePayDuitku = async () => {
    if (paying) return;

    setPaying(true);
    const pToast = toast.loading("Menyiapkan portal pembayaran aman...");
    try {
      const res = await fetch('/api/payment/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: id,
          paymentMethod: "", // Kosongkan untuk pilihan lengkap
          returnUrl: window.location.href
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Gagal menyiapkan tagihan');
      
      if (data.reference && typeof (window as any).checkout !== 'undefined') {
         toast.dismiss(pToast);
         setPaying(false);
         setIsDuitkuOpen(true);
         (window as any).checkout.process(data.reference, {
            successEvent: async function(result: any) {
               console.log("Duitku Success Event:", result);
               setIsDuitkuOpen(false);
               toast.success("Pembayaran Berhasil!");
               await fetch('/api/payment/check-status', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                     orderId: id,
                     duitkuOrderId: result?.merchantOrderId || id 
                  })
               });
               setTimeout(() => fetchOrderDetails(), 500);
            },
            pendingEvent: async function(result: any) {
               console.log("Duitku Pending Event:", result);
               setIsDuitkuOpen(false);
               toast("Menunggu Konfirmasi...", { icon: "" });
               await fetch('/api/payment/check-status', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                     orderId: id,
                     duitkuOrderId: result?.merchantOrderId || id 
                  })
               });
               setTimeout(() => fetchOrderDetails(), 500);
            },
            errorEvent: async function(result: any) {
               setIsDuitkuOpen(false);
               toast.error("Transaksi dibatalkan.");
               // Reset created_at to current timestamp in DB to reset countdown
               await supabase.from("orders").update({ created_at: new Date().toISOString() }).eq("id", id);
               // Kirim notifikasi Duitku ditutup tanpa selesai bayar
               await fetch('/api/orders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: id, action: 'notify_duitku_closed' })
               });
               setTimeout(() => fetchOrderDetails(), 500);
            },
            closeEvent: async function() {
               console.log("Duitku Pop Closed. Syncing status...");
               setIsDuitkuOpen(false);
               // Reset created_at to current timestamp in DB to reset countdown
               await supabase.from("orders").update({ created_at: new Date().toISOString() }).eq("id", id);
               // Proaktif cek status ke Duitku saat popup ditutup
               const res = await fetch('/api/payment/check-status', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: id })
               });
               const checkRes = await res.json();
               if (checkRes.status !== 'paid') {
                  // Kirim notifikasi Duitku ditutup tanpa selesai bayar
                  await fetch('/api/orders', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ orderId: id, action: 'notify_duitku_closed' })
                  });
               }
               setTimeout(() => fetchOrderDetails(), 500);
            }
         });
      } else if (data.paymentUrl) {
        toast.success("Menuju halaman pembayaran...", { id: pToast });
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("Gagal mengunduh tautan pembayaran.");
      }
    } catch (e: any) {
      toast.error(e.message, { id: pToast });
      setPaying(false);
    }
  };

  const handlePrint = () => {
    const el = receiptRef.current;
    if (!el) return;
    const win = window.open("", "_blank", "width=450,height=700");
    if (!win) return;

    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(s => s.outerHTML)
      .join('');

    win.document.write(`
      <html>
        <head>
          <title>Cetak Kwitansi</title>
          ${styles}
        </head>
        <body style="margin:0; padding:0;">
          ${el.outerHTML}
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
                window.onafterprint = function() { window.close(); };
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleDownloadPDF = async () => {
    try {
      const formattedItems = orderItems.map(i => ({
        name: i.menu_items?.name || i.name || "Item",
        price: Number(i.price || i.menu_items?.price || 0),
        quantity: Number(i.quantity),
        subtotal: Number(i.subtotal)
      }));
      
      await downloadReceiptPDF({
        order,
        orderItems: formattedItems,
        customerName: customerName || "Pelanggan",
        cashierName: cashierName || undefined
      });
      toast.success("Kwitansi PDF berhasil diunduh!");
    } catch (error) {
      toast.error("Gagal mengunduh PDF");
    }
  };

  const handleCancelOrder = async () => {
    setCancelling(true);
    try {
      // Jika tunai, langsung batalkan tanpa data refund
      const { error } = await supabase.from("orders").update({ 
        status: "cancelled",
        cancel_reason: "Dibatalkan oleh pelanggan"
      }).eq("id", id);
      if (error) throw error;
      
      if (order.table_id) {
        await supabase.from("tables").update({ status: "available" }).eq("id", order.table_id);
      }
      
      toast.success("Pesanan berhasil dibatalkan");
      fetchOrderDetails();
      setShowCancelConfirm(false);
    } catch (e: any) {
      toast.error("Gagal membatalkan: " + e.message);
    } finally { setCancelling(false); }
  };

  const handleSendReview = async () => {
    setSubmittingReview(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Silakan login kembali");
      
      const { error } = await supabase.from("reviews").insert({
        order_id: id,
        customer_id: order.customer_id,
        rating: reviewRating,
        comment: reviewComment
      });
      if (error) throw error;
      
      toast.success("Terima kasih atas ulasan Anda!");
      setHasReviewed(true);
      setShowReviewModal(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSubmittingReview(false); }
  };

  const handleSubmitRefund = async () => {
    const finalBankName = refundMethod === "wallet" ? "Saldo Dompet" : bankName;
    const finalAccountNo = refundMethod === "wallet" ? "Saldo Dompet" : accountNo;
    const finalAccountName = refundMethod === "wallet" ? "Saldo Dompet" : accountName;

    if (!refundReason || (refundMethod === "bank" && (!bankName || !accountNo || !accountName))) {
      return toast.error("Mohon lengkapi semua data");
    }
    setSubmittingRefund(true);
    try {
      const refundInfo = {
        refundMethod,
        bankName: finalBankName,
        accountNo: finalAccountNo,
        accountName: finalAccountName,
        refundReason,
        refundStatus: "pending",
        requestedAt: new Date().toISOString()
      };
      
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: id,
          action: 'submit_refund',
          refundDetails: refundInfo
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal mengirim pengajuan refund');
      
      toast.success("Pengajuan refund berhasil dikirim!");
      fetchOrderDetails();
      setShowRefundModal(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSubmittingRefund(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted font-medium animate-pulse">Memuat Detail Pesanan...</p>
      </div>
    </div>
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="w-6 h-6" />;
      case "confirmed": return <ChefHat className="w-6 h-6" />;
      case "shipping": return <Globe className="w-6 h-6" />;
      case "completed": return <PackageCheck className="w-6 h-6" />;
      case "cancelled": return <AlertCircle className="w-6 h-6" />;
      default: return <Clock className="w-6 h-6" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending": return "Menunggu";
      case "confirmed":
      case "processing": return "Diproses";
      case "shipping": return "Sedang Dikirim";
      case "completed": return "Selesai";
      case "cancelled": return "Dibatalkan";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500 border-amber-200 dark:border-amber-800";
      case "confirmed":
      case "processing": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-500 border-orange-200 dark:border-orange-800";
      case "shipping": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-500 border-blue-200 dark:border-blue-800";
      case "completed": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500 border-green-200 dark:border-green-800";
      case "cancelled": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-500 border-red-200 dark:border-red-800";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const steps = order?.order_type === 'delivery' ? [
    { id: "pending", label: "Menunggu", icon: Clock },
    { id: "confirmed", label: "Diproses", icon: ChefHat },
    { id: "shipping", label: "Dikirim", icon: Globe },
    { id: "completed", label: "Selesai", icon: PackageCheck },
  ] : [
    { id: "pending", label: "Menunggu", icon: Clock },
    { id: "confirmed", label: "Diproses", icon: ChefHat },
    { id: "completed", label: "Selesai", icon: PackageCheck },
  ];
  const normalizedStatus = order.status === "processing" ? "confirmed" : order.status;
  const currentIdx = steps.findIndex(s => s.id === normalizedStatus);
  const isPaid = order.payment_status === "paid";
  const isCancelled = order.status === "cancelled";
  const canCancel = order.status === "pending";

  const getRefundData = () => {
    if (!order?.cancel_reason) return null;
    try {
      const parsed = JSON.parse(order.cancel_reason);
      if (parsed && typeof parsed === "object" && "refundStatus" in parsed) {
        return parsed;
      }
    } catch (e) {}
    return null;
  };
  const refundData = getRefundData();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 pb-32">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/customer/orders" className="flex items-center gap-2 text-muted hover:text-primary transition-colors font-bold text-sm uppercase tracking-wider">
          <ArrowLeft className="w-5 h-5" /> Kembali ke Riwayat
        </Link>
        <div className={`px-4 py-1.5 rounded-full border-2 font-black text-xs uppercase tracking-widest ${getStatusColor(order.status)}`}>
          {getStatusText(order.status)}
        </div>
      </div>

      <div className="bg-card-light dark:bg-card-dark rounded-3xl p-8 md:p-10 shadow-sm border border-border-light dark:border-border-dark relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-8 border-b border-border-light dark:border-border-dark">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-text-light dark:text-text-dark tracking-tight">No. Pesanan #{id?.substring(0, 8).toUpperCase()}</h1>
            <p className="text-muted mt-2 font-medium">Dipesan pada {format(new Date(order.created_at), "d MMMM yyyy, HH:mm", { locale: localeId })}</p>
          </div>
          <div className="text-left md:text-right">
            <span className="text-xs font-black uppercase text-muted tracking-widest block mb-1">Total Transaksi</span>
            <span className="text-3xl font-black text-primary">Rp {Number(order.total_amount).toLocaleString("id-ID")}</span>
          </div>
        </div>

        {isCancelled ? (
          <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-100 dark:border-red-900 rounded-3xl p-8 flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 text-red-500 rounded-2xl flex items-center justify-center mb-4"><XCircle className="w-8 h-8" /></div>
            <h3 className="text-xl font-black text-red-900 dark:text-red-400 mb-2 uppercase tracking-tight">Pesanan Dibatalkan</h3>
            
            {!refundData ? (
              order.cancel_reason === "Batas waktu pembayaran habis (Batal Otomatis)" ? (
                <p className="text-red-600/80 mt-1 mb-4 font-bold text-center uppercase tracking-wide text-xs leading-relaxed max-w-xs">
                  Batas waktu pembayaran telah habis. Pesanan ini dibatalkan secara otomatis.
                </p>
              ) : (
                <p className="text-red-600/80 mt-1 mb-4 font-medium text-center">{order.cancel_reason || "Dibatalkan oleh sistem/kasir"}</p>
              )
            ) : (
              <div className="mt-6 w-full space-y-6">
                <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl border border-red-200 dark:border-red-900 shadow-sm">
                   <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${refundData.refundStatus === 'approved' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                       {refundData.refundStatus === 'approved' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                     </div>
                     <div>
                       <p className="text-[10px] font-black uppercase text-muted tracking-widest">Status Refund</p>
                       <p className="text-sm font-black text-text-light dark:text-text-dark uppercase">
                         {refundData.refundStatus === "pending" ? "Menunggu Persetujuan" :
                          refundData.refundStatus === "approved" ? "Refund Disetujui" : "Refund Ditolak"}
                       </p>
                     </div>
                   </div>
                   <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${
                     refundData.refundStatus === "pending" ? "bg-yellow-100 text-yellow-700 animate-pulse" :
                     refundData.refundStatus === "approved" ? "bg-green-100 text-green-700" :
                     "bg-red-100 text-red-700"
                   }`}>
                     {refundData.refundStatus === "pending" ? "Proses" :
                      refundData.refundStatus === "approved" ? "Berhasil" : "Gagal"}
                   </span>
                </div>

                 {refundData.refundMethod === "wallet" ? (
                   <div className="grid grid-cols-1 gap-4">
                     <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                       <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Metode Refund</p>
                       <p className="text-lg font-black text-primary flex items-center gap-2">
                         <Wallet className="w-5 h-5" /> Saldo Dompet
                       </p>
                     </div>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                       <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Metode Refund</p>
                       <p className="text-lg font-black text-primary flex items-center gap-2">
                         <CreditCard className="w-5 h-5" /> {refundData.bankName}
                       </p>
                     </div>
                     <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                       <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Nomor Rekening</p>
                       <p className="text-lg font-black text-text-light dark:text-text-dark tracking-tighter">
                         {refundData.accountNo}
                       </p>
                     </div>
                     <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm md:col-span-2">
                       <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Atas Nama Pemilik</p>
                       <p className="text-lg font-black text-text-light dark:text-text-dark uppercase">
                         {refundData.accountName}
                       </p>
                     </div>
                   </div>
                 )}

                <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Alasan Pengaju</p>
                  <p className="text-sm font-medium text-text-light dark:text-text-dark">
                    {refundData.refundReason}
                  </p>
                </div>

                {refundData.adminNotes && (
                  <div className="p-6 bg-orange-50 dark:bg-orange-950/20 rounded-2xl border border-orange-100 dark:border-orange-900 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-orange-600 tracking-widest mb-1">Catatan Admin</p>
                    <p className="text-sm font-semibold text-orange-900 dark:text-orange-400 leading-relaxed">
                      {refundData.adminNotes}
                    </p>
                  </div>
                )}

                {refundData.proofUrl && (
                  <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-3">Bukti Transfer Refund</p>
                    <div className="relative rounded-2xl overflow-hidden border border-border-light dark:border-border-dark group cursor-zoom-in" onClick={() => window.open(refundData.proofUrl)}>
                      <img src={refundData.proofUrl} alt="Bukti Transfer" className="w-full h-auto max-h-[300px] object-contain bg-gray-50 rounded-xl" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <span className="bg-white/90 text-black text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-wider">Perbesar Gambar</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-red-200 dark:border-red-900 flex justify-between items-center">
                   <span className="text-[10px] font-black uppercase text-muted tracking-widest">Total Refund</span>
                   <span className="text-2xl font-black text-primary">Rp {Number(order.total_amount).toLocaleString("id-ID")}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {order.estimated_duration_minutes && (
              <OrderCountdown order={order} />
            )}
            <div className="py-8">
              <div className="relative flex justify-between items-center w-full max-w-2xl mx-auto before:absolute before:inset-0 before:top-1/2 before:-translate-y-1/2 before:h-1 before:bg-gray-200 dark:before:bg-gray-700 before:z-0">
                <motion.div className="absolute top-1/2 -translate-y-1/2 h-1 bg-primary z-0" initial={{ width: "0%" }} animate={{ width: `${Math.max(0, (currentIdx / (steps.length - 1)) * 100)}%` }} transition={{ duration: 0.5 }} />
                {steps.map((step, i) => {
                  const done = i <= currentIdx; const current = i === currentIdx; const Icon = step.icon;
                  return (
                    <div key={step.id} className="relative z-[2] flex flex-col items-center gap-3">
                      <motion.div animate={{ scale: current ? 1.2 : 1, backgroundColor: done ? "#f97316" : "var(--card-color)" }} className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${done ? "border-primary text-white" : "border-gray-300 dark:border-gray-600 text-gray-400 bg-card-light dark:bg-card-dark"}`}>
                        <Icon className="w-6 h-6" />
                      </motion.div>
                      <span className={`text-xs font-black absolute top-14 w-24 text-center uppercase tracking-tighter ${current ? "text-primary" : done ? "text-text-light dark:text-text-dark" : "text-muted"}`}>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {order.order_type === 'delivery' && (
        <div className="bg-card-light dark:bg-card-dark rounded-3xl p-8 md:p-10 shadow-sm border border-border-light dark:border-border-dark mt-8 space-y-4">
          <h2 className="text-xl font-black text-text-light dark:text-text-dark border-b border-border-light dark:border-border-dark pb-4 uppercase tracking-widest flex items-center gap-3">
            <Globe className="w-6 h-6 text-primary" /> Informasi Pengiriman (Delivery)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-left">
            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-border-light/50 dark:border-border-dark/50 space-y-2">
              <div>
                <span className="text-[10px] font-black uppercase text-muted tracking-widest block">Nama Penerima</span>
                <span className="font-bold text-text-light dark:text-text-dark">{order.delivery_recipient_name || '-'}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-muted tracking-widest block">No. HP Penerima</span>
                <span className="font-bold text-text-light dark:text-text-dark">{order.delivery_phone || '-'}</span>
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-border-light/50 dark:border-border-dark/50 space-y-2">
              <div>
                <span className="text-[10px] font-black uppercase text-muted tracking-widest block font-bold mb-1">Alamat Penerima</span>
                <p className="font-medium text-text-light dark:text-text-dark leading-relaxed">
                  {order.delivery_address}
                </p>
                <p className="font-bold text-primary mt-1 text-[11px] uppercase tracking-wide">
                  Kel. {order.delivery_village}, Kec. {order.delivery_district}, {order.delivery_regency}, Prov. {order.delivery_province} ({order.delivery_postal_code})
                </p>
              </div>
            </div>
          </div>


        </div>
      )}

      <div className="bg-card-light dark:bg-card-dark rounded-3xl p-8 md:p-10 shadow-sm border border-border-light dark:border-border-dark mt-8">
        <h2 className="text-xl font-black text-text-light dark:text-text-dark mb-8 border-b border-border-light dark:border-border-dark pb-4 uppercase tracking-widest flex items-center gap-3">
          <ReceiptIcon className="w-6 h-6 text-primary" /> Daftar Item
        </h2>
        <div className="space-y-6">
          {orderItems.map(item => (
            <div key={item.id} className="flex gap-6 items-center p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-border-light dark:border-border-dark">
                <Image src={item.menu_items?.image_url || "https://placehold.co/100"} alt={item.menu_items?.name} fill className="object-cover" />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-lg text-text-light dark:text-text-dark">{item.menu_items?.name}</h4>
                <p className="text-sm font-bold text-muted mt-1">{item.quantity} x Rp {Number(item.price).toLocaleString("id-ID")}</p>
                {item.notes && <p className="text-[11px] text-primary italic font-medium mt-1">Note: {item.notes}</p>}
              </div>
              <div className="font-black text-lg text-text-light dark:text-text-dark text-right">Rp {Number(item.subtotal).toLocaleString("id-ID")}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-border-light dark:border-border-dark">
          <div className="space-y-4 max-w-sm ml-auto">
            <div className="flex justify-between text-muted font-bold">
              <span>Subtotal Hidangan</span>
              <span>Rp {orderItems.reduce((sum: number, item: any) => sum + Number(item.subtotal), 0).toLocaleString("id-ID")}</span>
            </div>
            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                <span>Potongan Voucher</span>
                <span>-Rp {Number(order.discount).toLocaleString("id-ID")}</span>
              </div>
            )}
            {order.order_type === 'delivery' && (
              <>
                <div className="flex justify-between text-muted font-bold">
                  <span>Biaya Pengiriman ({Number(order.distance_km || 0).toFixed(1)} km)</span>
                  <span>Rp {Number(order.shipping_fee || 0).toLocaleString("id-ID")}</span>
                </div>
                {Number(order.shipping_discount || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>Potongan Ongkir</span>
                    <span>-Rp {Number(order.shipping_discount).toLocaleString("id-ID")}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between text-muted font-bold">
              <span>Pajak ({taxPercent}%)</span>
              <span>Rp {Math.round(orderItems.reduce((sum: number, item: any) => sum + Number(item.subtotal), 0) * taxPercent / (100 + taxPercent)).toLocaleString("id-ID")} (Termasuk)</span>
            </div>
            {(Number(order.discount) > 0 || Number(order.shipping_discount) > 0) && (
              <div className="bg-emerald-50 dark:bg-emerald-950/10 rounded-xl p-3 border border-emerald-100/10 text-xs text-emerald-700 dark:text-emerald-300 flex justify-between font-bold">
                <span>Total Anda Hemat</span>
                <span>Rp {(Number(order.discount || 0) + Number(order.shipping_discount || 0)).toLocaleString("id-ID")}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-4 border-t border-border-light dark:border-border-dark">
              <span className="font-black text-text-light dark:text-text-dark uppercase tracking-wider">Total Akhir</span>
              <span className="text-3xl font-black text-primary">Rp {Number(order.total_amount).toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between items-center pt-4">
              <span className="text-xs font-black text-muted uppercase tracking-widest">Status Pembayaran</span>
              <span className={`text-xs font-black px-4 py-1.5 rounded-full uppercase ${
                isPaid ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500" : 
                isCancelled ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" : 
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-500"
              }`}>
                {isPaid ? "Lunas" : isCancelled ? "Dibatalkan" : "Belum Bayar"}
              </span>
            </div>

            {!isPaid && !isCancelled && (
              <div className="mt-6 pt-6 border-t border-border-light dark:border-border-dark space-y-6">
                {order.payment_method === "cash" ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3">
                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-bold leading-relaxed">
                      Silakan lakukan pembayaran secara tunai kepada kurir saat pesanan sudah tiba di alamat pengiriman. Status pesanan akan otomatis terupdate setelah dikonfirmasi oleh kurir/staf.
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-4">
                    {/* Payment Option Selector */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentOption("duitku")}
                        className={`py-3 rounded-2xl flex flex-col items-center gap-1 border-2 transition-all ${
                          selectedPaymentOption === "duitku"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"
                        }`}
                      >
                        <CreditCard className="w-5 h-5" />
                        <span className="font-bold text-[10px] uppercase">Online / Transfer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentOption("wallet")}
                        className={`py-3 rounded-2xl flex flex-col items-center gap-1 border-2 transition-all ${
                          selectedPaymentOption === "wallet"
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"
                        }`}
                      >
                        <Wallet className="w-5 h-5" />
                        <span className="font-bold text-[10px] uppercase">Dompetku</span>
                      </button>
                    </div>

                    {selectedPaymentOption === "duitku" ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        {timeLeft !== null && (
                          <div className="p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/50 rounded-2xl flex flex-col items-center gap-1.5 mb-2">
                            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                              <Clock className="w-4 h-4 animate-pulse" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Sisa Waktu Pembayaran</span>
                            </div>
                            <div className="text-xl font-black font-mono text-orange-700 dark:text-orange-300">
                              {formatTimeLeft(timeLeft)}
                            </div>
                            <p className="text-[10px] text-orange-600 dark:text-orange-400/80 font-bold text-center leading-relaxed mt-1">
                              Segera selesaikan pembayaran Anda sebelum batas waktu habis!
                            </p>
                          </div>
                        )}
                        <button
                          onClick={handlePayDuitku}
                          disabled={paying}
                          className="w-full py-4 bg-primary text-white rounded-2xl font-black text-lg hover:bg-primary-hover shadow-xl shadow-primary/30 transition-all flex items-center justify-center gap-3 uppercase tracking-wider"
                        >
                          {paying ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CreditCard className="w-6 h-6" /> Bayar Sekarang</>}
                        </button>
                        <p className="text-[10px] text-center text-muted font-bold uppercase tracking-widest">
                          Aman & Terverifikasi Otomatis
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        {profileData && !['diterima', 'selesai'].includes(profileData.wallet_status) ? (
                          <div className="p-4 rounded-2xl border bg-red-50/60 border-red-200/60 text-red-800 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400 space-y-3">
                            <div className="flex items-start gap-2.5">
                              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                              <div className="text-left">
                                {['diajukan', 'diajukan_ulang', 'diproses'].includes(profileData.wallet_status) ? (
                                  <>
                                    <p className="text-xs font-bold uppercase tracking-wider">Aktivasi Sedang Ditinjau</p>
                                    <p className="text-xs mt-1 leading-relaxed text-muted">Pengajuan aktivasi Dompetku Anda sedang diproses. Mohon tunggu hasil verifikasi dari admin.</p>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-xs font-bold uppercase tracking-wider">Dompetku Belum Aktif</p>
                                    <p className="text-xs mt-1 leading-relaxed text-muted">Dompetku belum diaktifkan. Silakan lakukan aktivasi terlebih dahulu untuk menggunakan metode pembayaran ini.</p>
                                  </>
                                )}
                              </div>
                            </div>
                            {!['diajukan', 'diajukan_ulang', 'diproses'].includes(profileData.wallet_status) && (
                              <button
                                type="button"
                                onClick={() => router.push("/customer/wallet/activation")}
                                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all uppercase tracking-wider shadow-sm flex items-center justify-center gap-1"
                              >
                                Aktivasi Sekarang
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            {profileData && (
                              <div className={`p-4 rounded-2xl border transition-all ${
                                profileData.wallet_balance >= Number(order.total_amount)
                                  ? "bg-green-50/60 border-green-200/60 text-green-800 dark:bg-green-950/20 dark:border-green-900/40 dark:text-green-400"
                                  : "bg-red-50/60 border-red-200/60 text-red-800 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400"
                              }`}>
                                {/* Balance display and status indicator */}
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <Wallet className="w-5 h-5 shrink-0" />
                                    <div className="text-left min-w-0">
                                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-75 leading-tight">Saldo Dompet Anda</p>
                                      <p className="text-base font-black mt-0.5">Rp {Number(profileData.wallet_balance || 0).toLocaleString("id-ID")}</p>
                                    </div>
                                  </div>
                                  {profileData.wallet_balance >= Number(order.total_amount) ? (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-md shrink-0 whitespace-nowrap">Saldo Cukup</span>
                                  ) : (
                                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-md animate-pulse shrink-0 whitespace-nowrap">Saldo Kurang</span>
                                  )}
                                </div>

                                {/* Insufficient balance warning and top up action button nested inside same container */}
                                {profileData.wallet_balance < Number(order.total_amount) && (
                                  <div className="mt-3 pt-3 border-t border-red-200/50 dark:border-red-900/30 space-y-3">
                                    <p className="text-xs font-semibold text-left leading-relaxed">
                                      Saldo Anda kurang sebesar <span className="font-extrabold text-red-700 dark:text-red-300">Rp {(Number(order.total_amount) - profileData.wallet_balance).toLocaleString("id-ID")}</span>. Isi saldo untuk melanjutkan pembayaran.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setShowTopUpModal(true)}
                                      className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5"
                                    >
                                      Isi Saldo Sekarang
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {profileData && profileData.wallet_balance >= Number(order.total_amount) && (
                              <button
                                onClick={() => handlePayViaWallet()}
                                disabled={payingViaWallet}
                                className="w-full py-4 bg-primary text-white rounded-2xl font-black text-lg hover:bg-primary-hover shadow-xl shadow-primary/30 transition-all flex items-center justify-center gap-3 uppercase tracking-wider"
                              >
                                {payingViaWallet ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Wallet className="w-6 h-6" /> Bayar Menggunakan Dompetku</>}
                              </button>
                            )}
                          </>
                        )}
                        <p className="text-[10px] text-center text-muted font-bold uppercase tracking-widest">
                          Pembayaran aman via e-wallet internal
                        </p>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isPaid && (
          <div className="mt-6 flex justify-center">
            <button 
              onClick={() => setShowReceipt(true)} 
              className="py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-bold shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20 transition-all uppercase tracking-widest text-[10px] sm:text-xs"
            >
              Lihat Kwitansi Digital
            </button>
          </div>
        )}

        {/* FOOTER ACTIONS (CANCEL, REFUND, REVIEW) */}
        <div className="mt-6 flex flex-wrap gap-4 border-t border-border-light dark:border-border-dark pt-6">
          <button 
            onClick={() => setShowChatDrawer(true)}
            className="flex items-center gap-2 text-primary hover:text-white font-bold text-xs uppercase tracking-wider bg-primary/5 hover:bg-primary px-4 py-2.5 rounded-xl border border-primary/20 hover:border-primary transition-all shadow-sm"
          >
            <MessageSquare className="w-4 h-4" /> Chat Kasir
          </button>
          {!isCancelled && (
            <>
              {order.status === "pending" ? (
                order.payment_method !== 'cash' && isPaid ? (
                  <button 
                    onClick={() => setShowRefundModal(true)}
                    className="flex items-center gap-2 text-red-600 hover:text-red-700 font-bold text-xs uppercase tracking-wider bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-xl border border-red-200 transition-all shadow-sm"
                  >
                    <RotateCcw className="w-4 h-4" /> Batalkan & Refund
                  </button>
                ) : (
                  <button 
                    onClick={() => setShowCancelConfirm(true)}
                    className="flex items-center gap-2 text-gray-600 hover:text-red-600 font-bold text-xs uppercase tracking-wider hover:bg-red-50 px-4 py-2.5 rounded-xl transition-all"
                  >
                    <XCircle className="w-4 h-4" /> Batalkan Pesanan
                  </button>
                )
              ) : ["confirmed", "processing"].includes(order.status) ? (
                <button 
                  onClick={() => toast.error("Mohon maaf, pesanan tidak dapat dibatalkan karena Chef kami sudah mulai menyiapkan hidangan Anda di dapur. Silakan hubungi staf jika ada kendala mendesak.", {
                    icon: "‍",
                    duration: 4000
                  })}
                  className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wider bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 rounded-xl border border-amber-200 dark:border-amber-800 transition-all active:scale-95 shadow-sm"
                >
                  <Lock className="w-4 h-4 text-amber-500" /> Sedang Diproses (Tidak Bisa Dibatalkan)
                </button>
              ) : null}
            </>
          )}

          {isCancelled && isPaid && order.payment_method !== 'cash' && !refundData && (
            <button 
              onClick={() => setShowRefundModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-pink-600 text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-2xl shadow-lg shadow-red-500/20 hover:scale-105 transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Ajukan Refund Dana Sekarang
            </button>
          )}
          
          {order.status === "completed" && !hasReviewed && (
            <button 
              onClick={() => setShowReviewModal(true)}
              className="w-full mt-4 py-4 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-orange-500/30 transition-all uppercase tracking-wider transform hover:-translate-y-1"
            >
              <Star className="w-6 h-6 fill-white" /> Beri Ulasan & Penilaian
            </button>
          )}
        </div>
      </div>

      {/* ================== MODALS ZONE ================== */}

      {/* 1. CANCEL CONFIRM MODAL */}
      <AnimatePresence>
        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCancelConfirm(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-card-dark w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-8 text-center border border-gray-100 dark:border-gray-800">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 mx-auto rounded-2xl flex items-center justify-center mb-4 border border-red-100"><ShieldAlert className="w-8 h-8 text-red-500" /></div>
              <h3 className="font-black text-xl text-gray-900 dark:text-white mb-2">Batalkan Pesanan?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">Tindakan ini tidak dapat dibatalkan. Lanjutkan membatalkan pesanan Anda?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowCancelConfirm(false)} className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">Kembali</button>
                <button onClick={handleCancelOrder} disabled={cancelling} className="flex-1 py-3.5 bg-red-500 text-white font-black rounded-2xl shadow-lg shadow-red-500/30 flex items-center justify-center hover:bg-red-600">
                  {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ya, Batalkan"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. REFUND APPLICATION MODAL */}
      <AnimatePresence>
        {showRefundModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRefundModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="relative bg-white dark:bg-card-dark w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-800">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2"><RotateCcw className="w-5 h-5 text-primary" /> Pengajuan Refund</h3>
                <button 
                  onClick={() => setShowRefundModal(false)} 
                  aria-label="Tutup"
                  title="Tutup"
                  className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-all text-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-5">
                <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 font-bold leading-relaxed flex items-start gap-3">
                  <Info className="w-5 h-5 shrink-0" />
                  Dana yang sudah dibayar akan diproses pengembaliannya ke pilihan tujuan di bawah.
                </p>
                <div>
                  <label className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Metode Pengembalian Dana</label>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <button type="button" onClick={() => setRefundMethod("wallet")} className={`py-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${refundMethod === "wallet" ? "border-primary bg-primary/5 text-primary" : "border-gray-200 dark:border-gray-700 text-muted hover:border-primary/50"}`}>
                      <Wallet className="w-5 h-5" /><span className="font-bold text-xs">Saldo Dompet</span>
                    </button>
                    <button type="button" onClick={() => setRefundMethod("bank")} className={`py-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${refundMethod === "bank" ? "border-primary bg-primary/5 text-primary" : "border-gray-200 dark:border-gray-700 text-muted hover:border-primary/50"}`}>
                      <CreditCard className="w-5 h-5" /><span className="font-bold text-xs">Rekening Bank</span>
                    </button>
                  </div>
                </div>

                {refundMethod === "wallet" ? (
                  <p className="text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/20 p-3.5 rounded-xl border border-green-200 dark:border-green-800 font-bold leading-relaxed flex items-start gap-2.5">
                    <Wallet className="w-4 h-4 shrink-0 mt-0.5" />
                    Dana refund akan langsung dikreditkan ke Saldo Dompet Anda secara otomatis setelah pengajuan disetujui admin.
                  </p>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Bank / Platform E-Wallet</label>
                      <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Contoh: BCA / DANA / OVO" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Nomor Rekening / Nomor HP</label>
                      <input type="text" value={accountNo} onChange={e => setAccountNo(e.target.value)} placeholder="Nomor akun/nomor HP yang terdaftar" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Atas Nama Pemilik Akun</label>
                      <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Nama lengkap pemilik rekening" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" />
                    </div>
                  </>
                )}
                <div>
                  <label className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Alasan Pembatalan</label>
                  <textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} rows={3} placeholder="Contoh: Menunggu terlalu lama karena pesanan tidak kunjung diproses atau alasan lainnya..." className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-medium text-text-light dark:text-text-dark" />
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                <button onClick={handleSubmitRefund} disabled={submittingRefund} className="w-full py-4 bg-primary hover:bg-primary-hover text-white font-black rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center gap-2 transition-all uppercase">
                  {submittingRefund ? <Loader2 className="w-5 h-5 animate-spin" /> : "Kirim Pengajuan Refund"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. REVIEW MODAL */}
      <AnimatePresence>
        {showReviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReviewModal(false)} className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }} className="relative bg-white dark:bg-card-dark w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-center border border-gray-200 dark:border-gray-800">
               <div className="p-10 bg-gradient-to-br from-orange-400 via-primary to-red-600 text-white flex flex-col items-center relative overflow-hidden">
                 <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent animate-pulse" />
                 <Star className="w-16 h-16 mb-4 fill-yellow-300 text-yellow-300 drop-shadow-[0_5px_15px_rgba(253,224,71,0.5)] relative z-10" />
                 <h3 className="text-3xl font-black uppercase tracking-tight relative z-10">Berikan Ulasan</h3>
                 <p className="text-white/90 text-sm mt-2 font-bold relative z-10">Kepuasan Anda adalah prioritas utama kami!</p>
               </div>
               <div className="p-8 space-y-6">
                 <div className="flex justify-center gap-3">
                   {[1, 2, 3, 4, 5].map(star => (
                     <button 
                       key={star} 
                       onClick={() => setReviewRating(star)} 
                       aria-label={`Beri Bintang ${star}`}
                       title={`Beri Bintang ${star}`}
                       className="transition-all hover:scale-125 transform active:scale-95"
                     >
                       <Star className={`w-12 h-12 ${reviewRating >= star ? "fill-yellow-400 text-yellow-400 drop-shadow-sm" : "text-gray-200 dark:text-gray-700 fill-gray-50 dark:fill-gray-800"}`} />
                     </button>
                   ))}
                 </div>
                 <div className="text-center">
                    <span className="px-4 py-1 bg-orange-50 dark:bg-orange-900/20 text-primary font-black text-sm rounded-full border border-orange-100 dark:border-orange-800 uppercase tracking-widest">
                        {reviewRating === 5 ? "Luar Biasa! " : reviewRating === 4 ? "Sangat Enak! " : reviewRating === 3 ? "Biasa Saja " : reviewRating === 2 ? "Kurang Memuaskan " : "Sangat Buruk "}
                    </span>
                 </div>
                 <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={3} placeholder="Tulis pengalaman bersantap Anda di sini (Rasa, pelayanan, porsi, dll)..." className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl p-4 text-sm outline-none focus:border-primary text-left font-medium text-text-light dark:text-text-dark" />
                 <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowReviewModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">Nanti</button>
                    <button onClick={handleSendReview} disabled={submittingReview} className="flex-[2] py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 hover:bg-primary-hover transition-all">
                      {submittingReview ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Kirim Ulasan"}
                    </button>
                 </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. RECEIPT OVERLAY MODAL */}
      <AnimatePresence>
        {showReceipt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReceipt(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative bg-white dark:bg-card-dark w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                   <h4 className="font-black text-xs uppercase tracking-widest text-gray-500">Pratinjau Kwitansi</h4>
                   <button 
                      onClick={() => setShowReceipt(false)} 
                      aria-label="Tutup Pratinjau"
                      title="Tutup"
                      className="p-2 text-muted hover:bg-gray-200 rounded-xl"
                    >
                      <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto bg-gray-100 p-4 flex justify-center items-start">
                   <Receipt ref={receiptRef} order={order} orderItems={orderItems.map((i: any) => {
                     const resolvedPrice = Number(i.price || i.menu_items?.price || 0);
                     return {
                       name: i.menu_items?.name || i.name,
                       price: resolvedPrice,
                       quantity: i.quantity,
                       subtotal: i.subtotal || (resolvedPrice * i.quantity)
                     };
                   })} customerName={customerName || "Pelanggan"} cashierName={cashierName || undefined} />
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. TOP UP MODAL */}
      <AnimatePresence>
        {showTopUpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTopUpModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} className="relative bg-white dark:bg-card-dark w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-border-light dark:border-border-dark z-10">
              <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                <h3 className="font-black text-lg text-text-light dark:text-text-dark flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" /> Isi Saldo Dompetku
                </h3>
                <button onClick={() => setShowTopUpModal(false)} title="Tutup" className="p-2 hover:bg-gray-150 rounded-xl transition-all text-muted"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleTopUpSubmit} className="p-6 space-y-5">
                <div>
                  <label htmlFor="orderTopUpAmountInput" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Nominal Isi Saldo (Rp)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted text-sm">Rp</span>
                    <input 
                      id="orderTopUpAmountInput"
                      type="number" 
                      required 
                      min={10000}
                      value={topUpAmount} 
                      onChange={e => setTopUpAmount(e.target.value)} 
                      placeholder="Contoh: 50000" 
                      title="Nominal Isi Saldo (Rp)"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>
                  <span className="text-[9px] text-muted font-medium mt-1 block font-bold">Minimal Rp 10.000</span>
                </div>

                {/* Quick Nominal Selectors */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-muted tracking-widest block font-bold">Pilih Cepat</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[10000, 20000, 50000, 100000, 200000, 500000].map(nom => (
                      <button
                        key={nom}
                        type="button"
                        onClick={() => setTopUpAmount(String(nom))}
                        className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${
                          topUpAmount === String(nom)
                            ? "bg-primary border-primary text-white shadow-md shadow-primary/10"
                            : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-muted hover:border-primary/50"
                        }`}
                      >
                        Rp {nom.toLocaleString('id-ID').replace(',00', '')}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingTopUp}
                  className="w-full py-4 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-50 mt-4 uppercase tracking-wider text-xs"
                >
                  {submittingTopUp ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Lanjut Pembayaran"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. PIN Payment Modal */}
      <AnimatePresence>
        {showPinPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowPinPaymentModal(false)} 
              className="absolute inset-0 bg-black/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, y: 30 }} 
              animate={{ scale: 1, y: 0 }} 
              exit={{ scale: 0.9, y: 30 }} 
              className="relative bg-white dark:bg-card-dark w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-border-light dark:border-border-dark z-10"
            >
              <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                <h3 className="font-black text-lg text-text-light dark:text-text-dark flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" /> PIN Transaksi
                </h3>
                <button onClick={() => setShowPinPaymentModal(false)} title="Tutup" className="p-2 hover:bg-gray-100 rounded-xl transition-all"><X className="w-5 h-5 text-muted" /></button>
              </div>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  handlePayViaWallet(paymentPin);
                }} 
                className="p-6 space-y-4"
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
                    <Wallet className="w-6 h-6" />
                  </div>
                  <h4 className="font-extrabold text-sm text-text-light dark:text-text-dark">Masukkan PIN Dompetku</h4>
                  <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
                    Demi keamanan, silakan masukkan 6 digit PIN transaksi Dompetku Anda untuk menyelesaikan pembayaran sebesar <strong>Rp {Number(order?.total_amount || 0).toLocaleString("id-ID")}</strong>.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <input
                    id="orderPaymentPinInput"
                    type="password"
                    maxLength={6}
                    required
                    autoFocus
                    value={paymentPin}
                    onChange={e => setPaymentPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Masukkan 6 Digit PIN"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-xl px-4 py-3.5 text-lg outline-none focus:ring-2 focus:ring-primary font-mono tracking-widest text-center font-bold text-text-light dark:text-text-dark"
                  />
                  {pinRemainingAttempts !== null && (
                    <span className="text-[10px] text-rose-500 font-extrabold text-center block mt-1">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-500 inline-block mr-1.5 shrink-0 align-text-bottom" /> Sisa percobaan PIN: {pinRemainingAttempts} kali lagi.
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={payingViaWallet || paymentPin.length !== 6}
                  className="w-full py-4 bg-primary hover:bg-primary-hover text-white font-black rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 disabled:opacity-50 mt-4 uppercase tracking-wider text-xs"
                >
                  {payingViaWallet ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verifikasi & Bayar Sekarang"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sliding Chat Drawer Sisi Kanan */}
      <AnimatePresence>
        {showChatDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowChatDrawer(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md h-full bg-card-light dark:bg-card-dark shadow-2xl border-l border-border-light dark:border-border-dark flex flex-col z-10"
            >
              {/* Header - dinamis berdasarkan status AI */}
              <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
                <div className="flex items-center gap-3">
                  {(() => {
                    const aiStatus = chatRoom?.ai_chat_status || 'ai_active';
                    const isCashierMode = chatRoom?.is_replied_manually || aiStatus === 'cashier_active';
                    const isWaitingCashier = aiStatus === 'waiting_cashier' || aiStatus === 'transfer_requested';
                    return (
                      <>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm shrink-0 ${isCashierMode ? 'bg-blue-600' : isWaitingCashier ? 'bg-amber-500' : 'bg-primary'}`}>
                          {isCashierMode ? 'K' : isWaitingCashier ? '' : 'AI'}
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-text-light dark:text-text-dark uppercase tracking-tight">
                            {isCashierMode ? 'Chat Kasir Langsung' : isWaitingCashier ? 'Menunggu Kasir' : 'RestoBot AI'}
                          </h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {isCashierMode ? (
                              <>
                                <span className={`w-2 h-2 rounded-full ${cashiersOnlineCount > 0 ? "bg-green-500" : "bg-gray-400"}`} />
                                <span className="text-[10px] font-bold text-muted uppercase">
                                  {cashiersOnlineCount > 0 ? "Kasir Aktif" : "Offline"}
                                </span>
                              </>
                            ) : isWaitingCashier ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <span className="text-[10px] font-bold text-amber-500 uppercase">Menunggu Respons Kasir</span>
                              </>
                            ) : (
                              <>
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">AI Aktif • Siap Membantu</span>
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <button
                  onClick={() => setShowChatDrawer(false)}
                  className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all text-muted"
                  title="Tutup Chat"
                  aria-label="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatLoading ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                    <p className="text-xs font-bold text-muted uppercase tracking-wider">Memuat Percakapan...</p>
                  </div>
                ) : chatRoom?.status === 'expired' ? (
                  <div className="text-center py-12 text-muted text-xs h-full flex flex-col items-center justify-center">
                    <Trash2 className="w-10 h-10 mx-auto text-red-500 opacity-60 mb-2 animate-bounce" />
                    <p className="font-bold text-sm text-text-light dark:text-text-dark">Riwayat chat telah dihapus permanen.</p>
                    <p className="text-xs text-muted max-w-[300px] mx-auto mt-1">Sesuai dengan kebijakan privasi dan keamanan sistem RestoBook.</p>
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-muted space-y-3 p-6">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-black text-sm text-text-light dark:text-text-dark">Mulai Percakapan</p>
                      <p className="text-[11px] font-medium leading-relaxed max-w-xs mt-1">
                        RestoBot AI siap membantu Anda seputar pesanan, pembayaran, dan pertanyaan lainnya.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((msg: any) => {
                      const isMe = msg.sender_role === 'customer';
                      const isAi = msg.sender_role === 'ai';
                      const isSystem = msg.sender_role === 'system';
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {/* Avatar for non-customer messages */}
                          {!isMe && (
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-xs mr-2 shrink-0 mt-1 ${isAi ? 'bg-primary' : isSystem ? 'bg-gray-400' : 'bg-blue-600'}`}>
                              {isAi ? 'AI' : isSystem ? '!' : 'K'}
                            </div>
                          )}
                          <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                            <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                              isMe ? 'bg-primary text-white rounded-tr-none' : 
                              isAi ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 text-text-light dark:text-text-dark border border-amber-200/60 dark:border-amber-700/30 rounded-tl-none' : 
                              isSystem ? 'bg-gray-100 dark:bg-gray-800/60 text-muted border border-gray-200/80 dark:border-gray-700 rounded-tl-none italic' :
                              'bg-blue-50 dark:bg-blue-950/20 text-text-light dark:text-text-dark border border-blue-200/40 dark:border-blue-700/30 rounded-tl-none'
                            }`}>
                              {/* Sender label */}
                              <div className={`flex items-center gap-1 mb-1 text-[9px] font-black uppercase tracking-wider ${isMe ? 'text-white/70 justify-end' : isAi ? 'text-amber-600 dark:text-amber-400' : isSystem ? 'text-gray-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                {isMe ? 'Anda' : isAi ? ' RestoBot AI' : isSystem ? 'Sistem' : (senderRoles[msg.sender_id] === 'admin' ? ' Admin' : ' Kasir')}
                                <span className="opacity-60 ml-1">• {format(new Date(msg.created_at), "HH:mm")}</span>
                              </div>
                              
                              {msg.attachment_url && (
                                <div className="mb-2">
                                  {(() => {
                                    const url = msg.attachment_url;
                                    const ext = url.split('.').pop()?.toLowerCase();
                                    const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
                                    if (isImg) {
                                      return (
                                        <div className="rounded-xl overflow-hidden border border-border-light dark:border-border-dark max-w-[200px]">
                                          <img src={url} alt="Attachment" className="w-full h-auto max-h-[150px] object-cover cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => window.open(url)} />
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <a href={url} target="_blank" rel="noopener noreferrer" className={`text-xs font-bold underline flex items-center gap-1.5 p-2 rounded-xl border ${isMe ? 'bg-white/10 border-white/20 text-white' : 'bg-gray-50 dark:bg-gray-800 border-border-light dark:border-border-dark text-primary'}`}>
                                          <FileText className="w-4 h-4 shrink-0" />
                                          <span className="truncate max-w-[150px]">Lihat Dokumen</span>
                                        </a>
                                      );
                                    }
                                  })()}
                                </div>
                              )}
                              
                              {msg.message && (
                                <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap">{msg.message}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Typing indicator (hanya kasir) */}
                    {chatTyping && (
                      <div className="flex justify-start">
                        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-xs mr-2 shrink-0 mt-1">K</div>
                        <div className="bg-blue-50 dark:bg-blue-950/20 text-muted rounded-2xl rounded-tl-none px-4 py-2.5 flex items-center gap-1.5 border border-blue-200/40">
                          <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">Kasir sedang mengetik</span>
                          <span className="flex gap-0.5 ml-1">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Tombol konfirmasi transfer ke kasir - muncul saat waiting_customer_choice */}
                    {chatRoom?.ai_chat_status === 'waiting_customer_choice' && !chatRoom?.is_replied_manually && (
                      <div className="flex justify-start">
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white font-black text-sm shrink-0 mt-1">AI</div>
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/60 dark:border-amber-700/30 rounded-2xl rounded-tl-none p-3 max-w-[75%]">
                          <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase mb-2">Pilih Tindakan</p>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => handleChatAction('confirm_transfer')}
                              disabled={chatActionLoading}
                              className="px-4 py-2.5 bg-primary text-white text-xs font-black rounded-xl hover:bg-primary-hover transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-primary/20"
                            >
                              {chatActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                              Ya, hubungkan
                            </button>
                            <button
                              onClick={() => handleChatAction('cancel_transfer')}
                              disabled={chatActionLoading}
                              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 text-muted text-xs font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tombol "Hubungi Kasir" - muncul saat ai_active dan belum dijawab manual */}
                    {(chatRoom?.ai_chat_status === 'ai_active' || !chatRoom?.ai_chat_status) && !chatRoom?.is_replied_manually && chatMessages.length > 0 && (
                      <div className="flex justify-center my-2">
                        <button
                          onClick={() => handleChatAction('request_cashier')}
                          disabled={chatActionLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-700/30 rounded-full text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-all disabled:opacity-50"
                        >
                          {chatActionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                          Hubungi Kasir Langsung
                        </button>
                      </div>
                    )}

                    {/* Auto-scroll anchor */}
                    <div ref={chatMessagesEndRef} />
                  </>
                )}
              </div>

              {/* File Upload Preview */}
              {uploadingFile && (
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-border-light dark:border-border-dark flex items-center justify-between text-xs font-bold text-muted">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" /> Mengunggah gambar...
                  </span>
                </div>
              )}
              {chatAttachmentUrl && (
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-border-light dark:border-border-dark flex items-center gap-3">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-border-light dark:border-border-dark shrink-0">
                    <img src={chatAttachmentUrl} alt="Upload Preview" className="w-full h-full object-cover" />
                    <button onClick={() => setChatAttachmentUrl("")} className="absolute top-0.5 right-0.5 p-0.5 bg-black/60 hover:bg-black/85 rounded-full text-white" title="Hapus gambar">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-[10px] font-bold text-muted uppercase">
                    Gambar siap dikirim
                  </div>
                </div>
              )}

              {/* Footer Input */}
              {chatRoom?.is_blocked ? (
                <div className="p-5 border-t border-border-light dark:border-border-dark bg-red-50 dark:bg-red-950/20 text-center">
                  <p className="text-xs font-bold text-red-600 dark:text-red-400">
                    Obrolan dinonaktifkan oleh Kasir karena indikasi penyalahgunaan.
                  </p>
                </div>
              ) : chatRoom?.status === 'completed' || ['completed', 'cancelled'].includes(order?.status) ? (
                <div className="border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-900/50">
                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-muted">🔒 Percakapan telah selesai.</p>
                      <p className="text-[10px] text-muted/70 mt-0.5">Gunakan menu Pengaduan & Bantuan jika masih butuh bantuan.</p>
                    </div>
                    {chatRoom?.chat_history_deleted_at && chatRoom?.status !== 'expired' && chatCountdownText && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[10px] font-mono font-bold rounded-lg border border-amber-200/60 dark:border-amber-800/30 whitespace-nowrap shrink-0">
                        ⏳ Hapus dalam: {chatCountdownText}
                      </span>
                    )}
                  </div>
                </div>
              ) : chatRoom?.status === 'expired' ? (
                <div className="p-5 border-t border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-900/50 text-center">
                  <p className="text-xs font-bold text-red-500">🗑️ Riwayat obrolan telah dihapus permanen.</p>
                </div>
              ) : (
                <div className="border-t border-border-light dark:border-border-dark">
                  {/* Status bar */}
                  {(chatRoom?.ai_chat_status === 'waiting_cashier' || chatRoom?.ai_chat_status === 'transfer_requested') && !chatRoom?.is_replied_manually && (
                    <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200/40 dark:border-amber-700/20 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin text-amber-500 shrink-0" />
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        {waitingTime > 45 
                          ? "Terima kasih sudah menunggu, pesan Anda masih dalam antrean kasir. Mohon tunggu sebentar." 
                          : "Menunggu kasir bergabung... Anda masih bisa mengirim pesan."}
                      </p>
                    </div>
                  )}

                  {/* Quick replies */}
                  {(chatRoom?.ai_chat_status === 'ai_active' || !chatRoom?.ai_chat_status) && !chatRoom?.is_replied_manually && (
                    <div className="px-4 py-2.5 bg-gray-50/50 dark:bg-gray-900/30 border-b border-border-light dark:border-border-dark flex gap-2 overflow-x-auto scrollbar-hide py-3">
                      {["Status pesanan", "Estimasi selesai", "Hubungi kasir", "Ubah pesanan", "Batalkan pesanan", "Komplain", "Selesai"].map((reply) => (
                        <button
                          key={reply}
                          type="button"
                          onClick={() => sendQuickReplyMessage(reply)}
                          disabled={chatSending}
                          className="px-3.5 py-1.5 bg-white dark:bg-gray-800 hover:bg-primary hover:text-white dark:hover:bg-primary transition-all rounded-full border border-border-light dark:border-border-dark text-[11px] font-bold text-muted hover:border-primary shrink-0 whitespace-nowrap shadow-sm active:scale-95"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}

                  <form onSubmit={sendChatMessage} className="p-3 flex items-center gap-2">
                    <div className="flex items-center gap-1 shrink-0">
                      <label htmlFor="order-chat-file-input" className={`p-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all text-muted cursor-pointer flex items-center justify-center border border-border-light dark:border-border-dark ${uploadingFile ? "opacity-50 cursor-not-allowed" : ""}`} title="Pilih File dari Perangkat">
                        <Paperclip className="w-4 h-4" />
                        <input
                          type="file"
                          id="order-chat-file-input"
                          className="hidden"
                          disabled={uploadingFile}
                          onChange={(e) => handleChatFileUpload(e, false)}
                          title="Pilih File dari Perangkat"
                          aria-label="Pilih File dari Perangkat"
                        />
                      </label>

                      <button
                        type="button"
                        disabled={uploadingFile}
                        onClick={() => {
                          if (typeof navigator.mediaDevices?.getUserMedia === 'function') {
                            setIsCameraModalOpen(true);
                          } else {
                            document.getElementById('order-chat-camera-input')?.click();
                          }
                        }}
                        className={`p-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-all text-muted cursor-pointer flex items-center justify-center border border-border-light dark:border-border-dark ${uploadingFile ? "opacity-50 cursor-not-allowed" : ""}`}
                        title="Ambil Foto dari Kamera"
                        aria-label="Ambil Foto dari Kamera"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      <input
                        type="file"
                        id="order-chat-camera-input"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={uploadingFile}
                        onChange={(e) => handleChatFileUpload(e, true)}
                        title="Ambil Foto dari Kamera"
                        aria-label="Ambil Foto dari Kamera"
                      />
                    </div>
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => {
                        setChatInput(e.target.value);
                        handleTypingEvent();
                      }}
                      placeholder={chatSending ? "Mengirim..." : chatRoom?.is_replied_manually ? "Tulis pesan ke Kasir..." : "Tanya RestoBot AI atau Kasir..."}
                      disabled={chatSending}
                      className="flex-1 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark font-medium"
                    />
                    <button
                      type="submit"
                      disabled={chatSending || (!chatInput.trim() && !chatAttachmentUrl)}
                      title="Kirim Pesan"
                      aria-label="Kirim"
                      className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white p-3 rounded-xl transition-all shrink-0 flex items-center justify-center shadow-md shadow-primary/20"
                    >
                      {chatSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>




      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
      />

    </div>
  );
}

function Info(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}
