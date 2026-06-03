"use client";

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import toast from "react-hot-toast";
import {
  LifeBuoy, Search, Filter, Play, CheckCircle, XCircle, Info, Send,
  FileText, Clock, Volume2, VolumeX, ShieldAlert, Sparkles, User,
  Mail, Calendar, Download, RefreshCw, Settings, ChevronRight,
  Paperclip, Camera, Trash2
} from "lucide-react";
import CameraCaptureModal from "@/components/CameraCaptureModal";

interface Ticket {
  id: string;
  ticket_number: string;
  customer_id: string;
  title: string;
  category: string;
  subcategory?: string;
  description: string;
  attachment_url?: string;
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  contact_info?: string;
  status: 'pending' | 'processing' | 'waiting_info' | 'completed' | 'closed' | 'expired' | 'approved' | 'rejected';
  sla_deadline?: string;
  source: 'manual' | 'ai';
  created_at: string;
  updated_at: string;
  chat_started_at?: string;
  chat_closed_at?: string;
  chat_history_deleted_at?: string;
  profiles?: {
    full_name: string;
    email: string;
  };
  is_order_chat?: boolean;
}

interface Message {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  attachment_url?: string;
  is_read: boolean;
  created_at: string;
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tickets' | 'settings'>('tickets');
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [ticketViewTab, setTicketViewTab] = useState<'aktif' | 'riwayat' | 'bantuan_admin'>('aktif');
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  // States for visual indicator counts
  const [pendingCount, setPendingCount] = useState(0);
  const [escalatedCount, setEscalatedCount] = useState(0);
  const adminProfileRef = useRef<any>(null);
  const activeTicketRef = useRef<Ticket | null>(null);

  useEffect(() => {
    adminProfileRef.current = adminProfile;
  }, [adminProfile]);

  useEffect(() => {
    activeTicketRef.current = activeTicket;
  }, [activeTicket]);

  const fetchCounts = async () => {
    try {
      const { count: pendingSupport } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      setPendingCount(pendingSupport || 0);

      const { count: needAdmin } = await supabase
        .from('order_chats')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'need_admin');
      setEscalatedCount(needAdmin || 0);
    } catch (e) {
      console.error("Error fetching counts:", e);
    }
  };

  useEffect(() => {
    fetchCounts();

    const countsChannel = supabase
      .channel('admin-support-counts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        fetchCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_chats' }, () => {
        fetchCounts();
      })
      .subscribe();

    // Global message channel for admin to hear incoming messages on any ticket or order chat
    const globalMsgChannel = supabase
      .channel('admin-global-messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_messages'
      }, (payload: any) => {
        const newMsg = payload.new;
        const profile = adminProfileRef.current;
        if (profile && newMsg.sender_id !== profile.id) {
          playAdminSound('customer_chat');
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'order_chat_messages'
      }, (payload: any) => {
        const newMsg = payload.new;
        const profile = adminProfileRef.current;
        if (profile && newMsg.sender_id !== profile.id) {
          playAdminSound('customer_chat');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(countsChannel);
      supabase.removeChannel(globalMsgChannel);
    };
  }, []);

  // Filter states
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUrgency, setFilterUrgency] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Audio settings states
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.6); // scale 0 to 1

  // Support settings states
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsId, setSettingsId] = useState('77777777-7777-7777-7777-777777777777');
  const [chatExpiryHours, setChatExpiryHours] = useState<string>('0');
  const [chatExpiryMinutes, setChatExpiryMinutes] = useState<string>('30');
  const [chatExpirySeconds, setChatExpirySeconds] = useState<string>('0');
  const [orderChatExpiryHours, setOrderChatExpiryHours] = useState<string>('0');
  const [orderChatExpiryMinutes, setOrderChatExpiryMinutes] = useState<string>('30');
  const [orderChatExpirySeconds, setOrderChatExpirySeconds] = useState<string>('0');
  const [slaHoursLow, setSlaHoursLow] = useState<string>('48');
  const [slaHoursMedium, setSlaHoursMedium] = useState<string>('24');
  const [slaHoursHigh, setSlaHoursHigh] = useState<string>('12');
  const [slaHoursUrgent, setSlaHoursUrgent] = useState<string>('4');

  // Countdown timer for completed/closed tickets
  const [countdownText, setCountdownText] = useState('');

  // States for ticket approval/rejection decision
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalType, setApprovalType] = useState<'approved' | 'rejected'>('approved');
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Web Audio Tone Generator based on settings
  const playAdminSound = (type: 'customer_chat' | 'admin_chat' | 'ai_ticket') => {
    if (isAudioMuted) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(audioVolume, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };

      const now = ctx.currentTime;
      if (type === 'customer_chat') {
        // High double-chirp for incoming customer chat
        playTone(659.25, now, 0.15); // E5
        playTone(783.99, now + 0.1, 0.25); // G5
      } else if (type === 'admin_chat') {
        // Lower triple-chirp for admin outgoing confirmation/preview
        playTone(440.00, now, 0.1); // A4
        playTone(440.00, now + 0.1, 0.1); // A4
        playTone(554.37, now + 0.2, 0.2); // C#5
      } else if (type === 'ai_ticket') {
        // High alert sound for automatic AI ticket creation
        playTone(880.00, now, 0.4); // A5
      }
    } catch (e) {
      console.warn("AudioContext tone generation blocked or unsupported:", e);
    }
  };

  // Quick replies list
  const QUICK_REPLIES = [
    "Terima kasih, kami sedang memeriksa kendala Anda.",
    "Mohon kirimkan informasi tambahan agar kami bisa membantu lebih cepat.",
    "Keluhan Anda sudah kami terima dan sedang kami proses.",
    "Percakapan telah kami tutup setelah masalah dinyatakan selesai."
  ];

  // Fetch initial data
  useEffect(() => {
    if (ticketViewTab === 'bantuan_admin') {
      fetchEscalatedChats();
      // Subscribe to order_chats table changes
      const orderChatChannel = supabase
        .channel('admin-order-chats-realtime')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'order_chats'
        }, (payload: any) => {
          fetchEscalatedChats();
          if (payload.new && activeTicketRef.current && payload.new.id === activeTicketRef.current.id) {
            setActiveTicket((current: any) => {
              if (current && current.id === payload.new.id) {
                return {
                  ...current,
                  status: payload.new.status,
                  chat_closed_at: payload.new.chat_closed_at,
                  chat_history_deleted_at: payload.new.chat_history_deleted_at
                };
              }
              return current;
            });
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(orderChatChannel);
      };
    } else {
      fetchAdminAndTickets();
      fetchSupportSettings();

      // Subscribe to support tickets changes
      const ticketChannel = supabase
        .channel('admin-tickets-realtime')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'support_tickets'
        }, (payload: any) => {
          fetchTicketsOnly();

          // sound trigger for new ticket
          if (payload.eventType === 'INSERT') {
            if (payload.new.source === 'ai') {
              playAdminSound('ai_ticket');
              toast.success(`Tiket Baru dibuat otomatis oleh AI: ${payload.new.ticket_number}`);
            } else {
              playAdminSound('customer_chat');
              toast.success(`Tiket Manual Baru Masuk: ${payload.new.ticket_number}`);
            }
          }

          if (payload.new && payload.new.id) {
            setActiveTicket((current) => {
              if (current && current.id === payload.new.id) {
                return { ...current, ...payload.new };
              }
              return current;
            });
          }
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'order_chats'
        }, (payload: any) => {
          if (ticketViewTab === 'riwayat') {
            fetchTicketsOnly();
          }
          if (payload.new && activeTicketRef.current && payload.new.id === activeTicketRef.current.id) {
            setActiveTicket((current: any) => {
              if (current && current.id === payload.new.id) {
                return {
                  ...current,
                  status: payload.new.status,
                  chat_closed_at: payload.new.chat_closed_at,
                  chat_history_deleted_at: payload.new.chat_history_deleted_at
                };
              }
              return current;
            });
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(ticketChannel);
      };
    }
  }, [ticketViewTab, filterStatus, filterUrgency, filterCategory, searchTerm]);

  // Subscribe to messages when activeTicket changes
  useEffect(() => {
    if (!activeTicket) {
      setMessages([]);
      return;
    }

    if (activeTicket.is_order_chat) {
      fetchOrderChatMessages(activeTicket.id);
    } else {
      fetchMessages(activeTicket.id);
    }

    const channelName = activeTicket.is_order_chat 
      ? `admin-order-chat-messages-${activeTicket.id}` 
      : `admin-ticket-messages-${activeTicket.id}`;

    const messageChannel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: activeTicket.is_order_chat ? 'order_chat_messages' : 'ticket_messages',
        filter: activeTicket.is_order_chat ? `chat_id=eq.${activeTicket.id}` : `ticket_id=eq.${activeTicket.id}`
      }, (payload: any) => {
        const newMsg = payload.new;
        const formattedMsg = activeTicket.is_order_chat ? {
          id: newMsg.id,
          ticket_id: newMsg.chat_id,
          sender_id: newMsg.sender_id || '',
          message: newMsg.message || '',
          attachment_url: newMsg.attachment_url || undefined,
          is_read: newMsg.is_read,
          created_at: newMsg.created_at
        } : newMsg;

        setMessages(prev => {
          if (prev.some(m => m.id === formattedMsg.id)) return prev;

          // Sound trigger for customer message (different from admin sender_id)
          if (adminProfile && formattedMsg.sender_id !== adminProfile.id) {
            playAdminSound('customer_chat');
          }
          return [...prev, formattedMsg];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [activeTicket?.id, adminProfile?.id]);

  // Countdown timer for completed/closed tickets
  const triggerCronCleanup = async () => {
    try {
      const res = await fetch('/api/support/ticket/cron', { method: 'POST' });
      if (res.ok) {
        if (ticketViewTab === 'bantuan_admin') {
          fetchEscalatedChats();
        } else {
          fetchAdminAndTickets();
        }
        if (activeTicket) {
          if (activeTicket.is_order_chat) {
            const { data: updatedChat } = await supabase
              .from('order_chats')
              .select('*')
              .eq('id', activeTicket.id)
              .single();
            if (updatedChat) {
              setActiveTicket((prev: any) => prev ? {
                ...prev,
                status: updatedChat.status,
                chat_closed_at: updatedChat.chat_closed_at,
                chat_history_deleted_at: updatedChat.chat_history_deleted_at
              } : null);
            }
          } else {
            const { data: updatedTicket } = await supabase
              .from('support_tickets')
              .select('*')
              .eq('id', activeTicket.id)
              .single();
            if (updatedTicket) {
              setActiveTicket(updatedTicket);
            }
          }
        }
      }
    } catch (e) {
      console.error("Gagal menjalankan auto-cleanup:", e);
    }
  };

  useEffect(() => {
    if (!activeTicket || !activeTicket.chat_history_deleted_at) {
      setCountdownText('');
      return;
    }

    const deletionTime = new Date(activeTicket.chat_history_deleted_at).getTime();
    const initialDiff = deletionTime - Date.now();

    if (initialDiff <= 0 && activeTicket.status !== 'expired') {
      setCountdownText('00:00:00');
      triggerCronCleanup();
      return;
    }

    const interval = setInterval(() => {
      const diff = deletionTime - Date.now();

      if (diff <= 0) {
        setCountdownText('00:00:00');
        clearInterval(interval);
        triggerCronCleanup();
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const pad = (num: number) => num.toString().padStart(2, '0');
        setCountdownText(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTicket?.chat_history_deleted_at, activeTicket?.status]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchAdminAndTickets = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.session.user.id)
        .single();
      
      if (prof && prof.role === 'admin') {
        setAdminProfile(prof);
        await fetchTicketsOnly();
      } else {
        toast.error("Akses Ditolak. Khusus Admin.");
      }
    } catch (e: any) {
      toast.error("Gagal memuat tiket: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletedExpiredOrderChats = async (): Promise<Ticket[]> => {
    try {
      const { data, error } = await supabase
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
          )
        `)
        .in('status', ['completed', 'expired'])
        .order('updated_at', { ascending: false });

      if (!error && data) {
        const mapped: Ticket[] = data.map(chat => ({
          id: chat.id,
          ticket_number: `ORDER-${chat.order_id?.substring(0, 8).toUpperCase()}`,
          customer_id: chat.customer_id,
          title: `Bantuan Order #${chat.order_id?.substring(0, 8).toUpperCase()}`,
          category: 'Bantuan Kasir',
          subcategory: chat.order?.order_type || undefined,
          description: `Kasir memerlukan bantuan admin untuk menyelesaikan kendala pada pesanan ini. Catatan Pesanan: ${chat.order?.notes || '-'}`,
          status: chat.status,
          urgency: 'high',
          created_at: chat.created_at,
          updated_at: chat.updated_at,
          chat_started_at: chat.created_at,
          chat_closed_at: chat.chat_closed_at,
          chat_history_deleted_at: chat.chat_history_deleted_at,
          profiles: {
            full_name: chat.customer?.full_name || 'Pelanggan',
            email: chat.customer?.email || '-'
          },
          is_order_chat: true
        } as any));
        return mapped;
      }
      return [];
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const fetchTicketsOnly = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filterStatus) queryParams.set('status', filterStatus);
      if (filterUrgency) queryParams.set('urgency', filterUrgency);
      if (filterCategory) queryParams.set('category', filterCategory);
      if (searchTerm) queryParams.set('search', searchTerm);

      const res = await fetch(`/api/admin/support?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (ticketViewTab === 'riwayat') {
          const completedExpiredChats = await fetchCompletedExpiredOrderChats();
          setTickets([...(data || []), ...completedExpiredChats]);
        } else {
          setTickets(data || []);
        }
      }
    } catch (e) {}
  };

  const fetchMessages = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/support/ticket/${ticketId}/chat`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data || []);
      }
    } catch (e) {}
  };

  const fetchEscalatedChats = async () => {
    try {
      const { data, error } = await supabase
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
          )
        `)
        .in('status', ['need_admin', 'completed', 'expired'])
        .order('updated_at', { ascending: false });

      if (!error && data) {
        const mapped: Ticket[] = data.map(chat => ({
          id: chat.id,
          ticket_number: `ORDER-${chat.order_id?.substring(0, 8).toUpperCase()}`,
          customer_id: chat.customer_id,
          title: `Bantuan Order #${chat.order_id?.substring(0, 8).toUpperCase()}`,
          category: 'Bantuan Kasir',
          subcategory: chat.order?.order_type || undefined,
          description: `Kasir memerlukan bantuan admin untuk menyelesaikan kendala pada pesanan ini. Catatan Pesanan: ${chat.order?.notes || '-'}`,
          status: chat.status === 'need_admin' ? 'pending' : chat.status,
          urgency: 'high',
          created_at: chat.created_at,
          updated_at: chat.updated_at,
          chat_started_at: chat.created_at,
          chat_closed_at: chat.chat_closed_at,
          chat_history_deleted_at: chat.chat_history_deleted_at,
          profiles: {
            full_name: chat.customer?.full_name || 'Pelanggan',
            email: chat.customer?.email || '-'
          },
          is_order_chat: true
        } as any));
        setTickets(mapped);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOrderChatMessages = async (chatId: string) => {
    try {
      const { data, error } = await supabase
        .from('order_chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setMessages(data.map(m => ({
          id: m.id,
          ticket_id: m.chat_id,
          sender_id: m.sender_id || '',
          message: m.message || '',
          attachment_url: m.attachment_url || undefined,
          is_read: m.is_read,
          created_at: m.created_at
        })));
      }
    } catch (e) {}
  };

  const fetchSupportSettings = async () => {
    try {
      const res = await fetch('/api/admin/support/settings');
      if (res.ok) {
        const data = await res.json();
        setSettingsId(data.id);
        setChatExpiryHours(String(data.chat_expiry_hours ?? 0));
        setChatExpiryMinutes(String(data.chat_expiry_minutes ?? 30));
        setChatExpirySeconds(String(data.chat_expiry_seconds ?? 0));
        setOrderChatExpiryHours(String(data.order_chat_expiry_hours ?? 0));
        setOrderChatExpiryMinutes(String(data.order_chat_expiry_minutes ?? 30));
        setOrderChatExpirySeconds(String(data.order_chat_expiry_seconds ?? 0));
        setSlaHoursLow(String(data.sla_hours_low ?? 48));
        setSlaHoursMedium(String(data.sla_hours_medium ?? 24));
        setSlaHoursHigh(String(data.sla_hours_high ?? 12));
        setSlaHoursUrgent(String(data.sla_hours_urgent ?? 4));
      }
    } catch (e) {}
  };

  const cleanLeadingZero = (val: string) => {
    if (val === "") return "";
    const num = parseInt(val, 10);
    if (isNaN(num)) return val;
    return String(num);
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/admin/support/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_expiry_hours: Number(chatExpiryHours) || 0,
          chat_expiry_minutes: Number(chatExpiryMinutes) || 0,
          chat_expiry_seconds: Number(chatExpirySeconds) || 0,
          order_chat_expiry_hours: Number(orderChatExpiryHours) || 0,
          order_chat_expiry_minutes: Number(orderChatExpiryMinutes) || 0,
          order_chat_expiry_seconds: Number(orderChatExpirySeconds) || 0,
          sla_hours_low: Number(slaHoursLow) || 48,
          sla_hours_medium: Number(slaHoursMedium) || 24,
          sla_hours_high: Number(slaHoursHigh) || 12,
          sla_hours_urgent: Number(slaHoursUrgent) || 4
        })
      });

      if (res.ok) {
        toast.success("Pengaturan waktu cleanup & SLA berhasil disimpan");
        fetchSupportSettings();
      } else {
        const data = await res.json();
        throw new Error(data.error || "Gagal menyimpan");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleStartChat = async (ticketId: string) => {
    try {
      const res = await fetch(`/api/support/ticket/${ticketId}/chat`, {
        method: 'PUT'
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Live Chat telah dibuka");
        setActiveTicket(data.ticket);
        fetchMessages(ticketId);
        fetchTicketsOnly();
      } else {
        toast.error(data.error || "Gagal memulai chat");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan koneksi");
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, status: string) => {
    try {
      if (activeTicket?.is_order_chat) {
        let action = '';
        if (status === 'completed') action = 'mark_completed';
        else if (status === 'waiting_info') action = 'waiting_customer';
        else if (status === 'active') action = 'reactivate';

        if (!action) {
          toast.error("Aksi status tidak didukung untuk obrolan order");
          return;
        }

        const res = await fetch('/api/cashier/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId: ticketId, action })
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(`Status obrolan berhasil diubah`);
          setActiveTicket((prev: any) => prev ? { ...prev, status } : null);
          fetchOrderChatMessages(ticketId);
          fetchEscalatedChats();
        } else {
          toast.error(data.error || "Gagal memperbarui status obrolan");
        }
      } else {
        const res = await fetch(`/api/support/ticket/${ticketId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(`Status tiket berhasil diubah menjadi: ${getStatusLabel(status)}`);
          setActiveTicket(data.ticket);
          fetchMessages(ticketId);
          fetchTicketsOnly();
        } else {
          toast.error(data.error || "Gagal memperbarui status");
        }
      }
    } catch (e) {
      toast.error("Terjadi kesalahan koneksi");
    }
  };

  const handleEscalateTicket = async (ticketId: string) => {
    if (!adminProfile) return;
    try {
      // Escalation is represented by posting a system log message to indicate it has been escalated to supervisor
      const systemMessage = `[SISTEM] Tiket dieskalasi ke Supervisor oleh Admin ${adminProfile.full_name}.`;
      const res = await fetch(`/api/support/ticket/${ticketId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: systemMessage })
      });

      if (res.ok) {
        toast.success("Tiket berhasil dieskalasi ke supervisor");
        fetchMessages(ticketId);
      } else {
        toast.error("Gagal melakukan eskalasi");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan koneksi");
    }
  };

  const handleOpenDecisionModal = (type: 'approved' | 'rejected') => {
    setApprovalType(type);
    setDecisionReason('');
    setShowApprovalModal(true);
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTicket) return;
    if (!decisionReason.trim()) {
      toast.error("Alasan wajib diisi");
      return;
    }

    setDecisionLoading(true);
    try {
      const res = await fetch(`/api/support/ticket/${activeTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: approvalType,
          reason: decisionReason.trim()
        })
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`Permintaan berhasil ${approvalType === 'approved' ? 'disetujui' : 'ditolak'}`);
        setShowApprovalModal(false);
        setDecisionReason('');
        setActiveTicket(data.ticket);
        fetchMessages(activeTicket.id);
        fetchTicketsOnly();
      } else {
        toast.error(data.error || "Gagal memproses keputusan");
      }
    } catch (error: any) {
      toast.error("Terjadi kesalahan koneksi");
    } finally {
      setDecisionLoading(false);
    }
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
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) throw new Error("Sesi tidak ditemukan");

      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', session.session.user.id);
      formData.append('isProfile', 'false');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal mengunggah file");

      const publicUrl = result.url;

      if (activeTicket?.is_order_chat) {
        const resMsg = await fetch('/api/cashier/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: activeTicket.id,
            message: isCamera ? "Mengirim foto dari kamera" : `Mengirim file: ${file.name}`,
            attachment_url: publicUrl
          })
        });
        const dataMsg = await resMsg.json();
        if (!resMsg.ok) throw new Error(dataMsg.error || "Gagal mengirim pesan");
        
        toast.success("File berhasil diunggah dan dikirim!", { id: toastId });
        fetchOrderChatMessages(activeTicket.id);
      } else {
        const resMsg = await fetch(`/api/support/ticket/${activeTicket!.id}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: isCamera ? "Mengirim foto dari kamera" : `Mengirim file: ${file.name}`,
            attachment_url: publicUrl
          })
        });

        const dataMsg = await resMsg.json();
        if (!resMsg.ok) {
          throw new Error(dataMsg.error || "Gagal mengirim pesan");
        }

        toast.success("File berhasil diunggah dan dikirim!", { id: toastId });
        
        setMessages(prev => {
          if (prev.some(m => m.id === dataMsg.message.id)) return prev;
          return [...prev, dataMsg.message];
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunggah file", { id: toastId });
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  const handleCameraCapture = async (file: File) => {
    if (!activeTicket) return;
    setUploadingFile(true);
    const toastId = toast.loading("Mengunggah foto...");
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) throw new Error("Sesi tidak ditemukan");

      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', session.session.user.id);
      formData.append('isProfile', 'false');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal mengunggah foto");

      const publicUrl = result.url;

      if (activeTicket.is_order_chat) {
        const resMsg = await fetch('/api/cashier/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: activeTicket.id,
            message: "Mengirim foto dari kamera",
            attachment_url: publicUrl
          })
        });
        const dataMsg = await resMsg.json();
        if (!resMsg.ok) throw new Error(dataMsg.error || "Gagal mengirim pesan");
        
        toast.success("Foto berhasil diambil dan dikirim!", { id: toastId });
        fetchOrderChatMessages(activeTicket.id);
      } else {
        const resMsg = await fetch(`/api/support/ticket/${activeTicket.id}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: "Mengirim foto dari kamera",
            attachment_url: publicUrl
          })
        });

        const dataMsg = await resMsg.json();
        if (!resMsg.ok) {
          throw new Error(dataMsg.error || "Gagal mengirim pesan");
        }

        toast.success("Foto berhasil diambil dan dikirim!", { id: toastId });
        
        setMessages(prev => {
          if (prev.some(m => m.id === dataMsg.message.id)) return prev;
          return [...prev, dataMsg.message];
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunggah foto", { id: toastId });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeTicket) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      if (activeTicket.is_order_chat) {
        const res = await fetch('/api/cashier/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: activeTicket.id,
            message: messageText
          })
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Gagal mengirim pesan');
        } else {
          fetchOrderChatMessages(activeTicket.id);
        }
      } else {
        const res = await fetch(`/api/support/ticket/${activeTicket.id}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText })
        });

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Gagal mengirim pesan');
        } else {
          setMessages(prev => {
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      }
    } catch (err) {
      toast.error('Gagal mengirim pesan chat');
    }
  };

  const handleUseQuickReply = (text: string) => {
    setNewMessage(text);
  };

  const handleExportCSV = () => {
    try {
      if (tickets.length === 0) {
        toast.error("Tidak ada tiket untuk diekspor");
        return;
      }

      // Prepare headers
      const headers = ['Nomor Tiket', 'Pelanggan', 'Kategori', 'Urgensi', 'Sumber', 'Status', 'Tanggal Dibuat', 'SLA Deadline'];
      const rows = tickets.map(t => [
        t.ticket_number,
        t.profiles?.full_name || 'Pelanggan',
        t.category,
        t.urgency,
        t.source,
        t.status,
        format(new Date(t.created_at), "yyyy-MM-dd HH:mm"),
        t.sla_deadline ? format(new Date(t.sla_deadline), "yyyy-MM-dd HH:mm") : '-'
      ]);

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `laporan_pengaduan_restobook_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Laporan berhasil diunduh dalam format CSV");
    } catch (e) {
      toast.error("Gagal mengekspor laporan");
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Menunggu Tanggapan Admin';
      case 'processing': return 'Diproses';
      case 'waiting_info': return 'Menunggu Informasi Tambahan';
      case 'approved': return 'Disetujui';
      case 'rejected': return 'Ditolak';
      case 'completed': return 'Selesai';
      case 'closed': return 'Ditutup';
      case 'expired': return 'Kedaluwarsa';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-50 text-yellow-600 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/30';
      case 'processing': return 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30';
      case 'waiting_info': return 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30';
      case 'approved': return 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30';
      case 'rejected': return 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30';
      case 'completed': return 'bg-green-50 text-green-600 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/30';
      case 'closed': return 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30';
      default: return 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700/50';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'urgent': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-green-500/10 text-green-500 border-green-500/20';
    }
  };

  const filteredTickets = tickets.filter(t => {
    const isHistory = ['completed', 'closed', 'expired', 'rejected', 'approved'].includes(t.status);
    if (ticketViewTab === 'bantuan_admin') return !isHistory;
    return ticketViewTab === 'riwayat' ? isHistory : !isHistory;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-light dark:border-border-dark pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-text-light dark:text-text-dark flex items-center gap-2.5">
            <LifeBuoy className="w-8 h-8 text-primary" /> Pengaduan Pelanggan
          </h1>
          <p className="text-muted mt-1">Kelola aduan pelanggan, respon via live chat, dan konfigurasi SLA</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveTab(activeTab === 'tickets' ? 'settings' : 'tickets')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold border transition-all text-sm ${
              activeTab === 'settings'
                ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                : "bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark text-muted hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            <Settings className="w-4 h-4" /> {activeTab === 'settings' ? 'Lihat Tiket' : 'Pengaturan'}
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold transition-all text-sm shadow-md"
          >
            <Download className="w-4 h-4" /> Ekspor CSV
          </button>
        </div>
      </div>

      {activeTab === 'settings' ? (
        /* Settings Tab View */
        <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl p-6 max-w-2xl mx-auto space-y-6">
          <div className="border-b border-border-light dark:border-border-dark pb-4">
            <h2 className="text-xl font-bold text-text-light dark:text-text-dark flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" /> Konfigurasi Sistem Bantuan
            </h2>
            <p className="text-xs text-muted mt-1">Ubah masa aktif riwayat chat setelah ditutup dan threshold SLA penanganan</p>
          </div>

          <form onSubmit={handleUpdateSettings} className="space-y-6">
            
            {/* Countdown Expiry */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-text-light dark:text-text-dark">Waktu Penghapusan Riwayat Chat Support (Setelah Tiket Selesai)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label htmlFor="chatExpiryHours" className="text-xs font-bold text-muted uppercase">Jam</label>
                  <input
                    id="chatExpiryHours"
                    title="Jam"
                    placeholder="0"
                    type="number"
                    min="0"
                    max="23"
                    value={chatExpiryHours}
                    onChange={(e) => setChatExpiryHours(cleanLeadingZero(e.target.value))}
                    onBlur={(e) => { if (e.target.value === "") setChatExpiryHours("0"); }}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="chatExpiryMinutes" className="text-xs font-bold text-muted uppercase">Menit</label>
                  <input
                    id="chatExpiryMinutes"
                    title="Menit"
                    placeholder="30"
                    type="number"
                    min="0"
                    max="59"
                    value={chatExpiryMinutes}
                    onChange={(e) => setChatExpiryMinutes(cleanLeadingZero(e.target.value))}
                    onBlur={(e) => { if (e.target.value === "") setChatExpiryMinutes("0"); }}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="chatExpirySeconds" className="text-xs font-bold text-muted uppercase">Detik</label>
                  <input
                    id="chatExpirySeconds"
                    title="Detik"
                    placeholder="0"
                    type="number"
                    min="0"
                    max="59"
                    value={chatExpirySeconds}
                    onChange={(e) => setChatExpirySeconds(cleanLeadingZero(e.target.value))}
                    onBlur={(e) => { if (e.target.value === "") setChatExpirySeconds("0"); }}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-border-light dark:border-border-dark">
              <h3 className="text-sm font-bold text-text-light dark:text-text-dark">Waktu Penghapusan Chat Pesanan & Bantuan Kasir (Setelah Selesai)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label htmlFor="orderChatExpiryHours" className="text-xs font-bold text-muted uppercase">Jam</label>
                  <input
                    id="orderChatExpiryHours"
                    title="Jam"
                    placeholder="0"
                    type="number"
                    min="0"
                    max="23"
                    value={orderChatExpiryHours}
                    onChange={(e) => setOrderChatExpiryHours(cleanLeadingZero(e.target.value))}
                    onBlur={(e) => { if (e.target.value === "") setOrderChatExpiryHours("0"); }}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="orderChatExpiryMinutes" className="text-xs font-bold text-muted uppercase">Menit</label>
                  <input
                    id="orderChatExpiryMinutes"
                    title="Menit"
                    placeholder="30"
                    type="number"
                    min="0"
                    max="59"
                    value={orderChatExpiryMinutes}
                    onChange={(e) => setOrderChatExpiryMinutes(cleanLeadingZero(e.target.value))}
                    onBlur={(e) => { if (e.target.value === "") setOrderChatExpiryMinutes("0"); }}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="orderChatExpirySeconds" className="text-xs font-bold text-muted uppercase">Detik</label>
                  <input
                    id="orderChatExpirySeconds"
                    title="Detik"
                    placeholder="0"
                    type="number"
                    min="0"
                    max="59"
                    value={orderChatExpirySeconds}
                    onChange={(e) => setOrderChatExpirySeconds(cleanLeadingZero(e.target.value))}
                    onBlur={(e) => { if (e.target.value === "") setOrderChatExpirySeconds("0"); }}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* SLA hours */}
            <div className="space-y-3 pt-4 border-t border-border-light dark:border-border-dark">
              <h3 className="text-sm font-bold text-text-light dark:text-text-dark">Batas Waktu SLA Penanganan (Jam)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label htmlFor="slaHoursUrgent" className="text-xs font-bold text-muted uppercase">Urgent</label>
                  <input
                    id="slaHoursUrgent"
                    title="SLA Urgent"
                    placeholder="4"
                    type="number"
                    min="1"
                    value={slaHoursUrgent}
                    onChange={(e) => setSlaHoursUrgent(cleanLeadingZero(e.target.value))}
                    onBlur={(e) => { if (e.target.value === "") setSlaHoursUrgent("4"); }}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="slaHoursHigh" className="text-xs font-bold text-muted uppercase">High</label>
                  <input
                    id="slaHoursHigh"
                    title="SLA High"
                    placeholder="12"
                    type="number"
                    min="1"
                    value={slaHoursHigh}
                    onChange={(e) => setSlaHoursHigh(cleanLeadingZero(e.target.value))}
                    onBlur={(e) => { if (e.target.value === "") setSlaHoursHigh("12"); }}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="slaHoursMedium" className="text-xs font-bold text-muted uppercase">Medium</label>
                  <input
                    id="slaHoursMedium"
                    title="SLA Medium"
                    placeholder="24"
                    type="number"
                    min="1"
                    value={slaHoursMedium}
                    onChange={(e) => setSlaHoursMedium(cleanLeadingZero(e.target.value))}
                    onBlur={(e) => { if (e.target.value === "") setSlaHoursMedium("24"); }}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="slaHoursLow" className="text-xs font-bold text-muted uppercase">Low</label>
                  <input
                    id="slaHoursLow"
                    title="SLA Low"
                    placeholder="48"
                    type="number"
                    min="1"
                    value={slaHoursLow}
                    onChange={(e) => setSlaHoursLow(cleanLeadingZero(e.target.value))}
                    onBlur={(e) => { if (e.target.value === "") setSlaHoursLow("48"); }}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Audio configuration */}
            <div className="space-y-3 pt-4 border-t border-border-light dark:border-border-dark">
              <h3 className="text-sm font-bold text-text-light dark:text-text-dark">Uji Coba & Volume Suara Notifikasi Admin</h3>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAudioMuted(!isAudioMuted)}
                    className="p-2.5 rounded-xl border border-border-light dark:border-border-dark text-muted hover:text-primary transition-all"
                  >
                    {isAudioMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <input
                    id="audioVolume"
                    title="Volume Suara"
                    placeholder="0.6"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={audioVolume}
                    onChange={(e) => setAudioVolume(Number(e.target.value))}
                    className="w-28 accent-primary cursor-pointer"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => playAdminSound('customer_chat')}
                    className="px-2.5 py-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-lg text-xs font-bold transition-all"
                  >
                    Tes Nada Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => playAdminSound('admin_chat')}
                    className="px-2.5 py-1.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20 rounded-lg text-xs font-bold transition-all"
                  >
                    Tes Nada Balasan
                  </button>
                  <button
                    type="button"
                    onClick={() => playAdminSound('ai_ticket')}
                    className="px-2.5 py-1.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500/20 rounded-lg text-xs font-bold transition-all"
                  >
                    Tes Nada AI
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border-light dark:border-border-dark">
              <button
                type="submit"
                disabled={settingsLoading}
                className="bg-primary hover:bg-primary-hover disabled:bg-gray-250 text-white font-bold px-6 py-2.5 rounded-xl text-sm shadow-md transition-all"
              >
                {settingsLoading ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Main Tickets View */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Side: Ticket Queue & Filters */}
          <div className="lg:col-span-5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl p-4 space-y-4">
            
            {/* Filters */}
            <div className="space-y-3 border-b border-border-light dark:border-border-dark pb-4">
              <div className="flex bg-background-light dark:bg-background-dark/80 rounded-xl px-3.5 py-2 border border-border-light dark:border-border-dark items-center">
                <Search className="w-4 h-4 text-muted mr-2" />
                <input
                  type="text"
                  title="Cari Tiket"
                  placeholder="Cari tiket atau pelanggan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none text-xs outline-none text-text-light dark:text-text-dark placeholder-gray-400 dark:placeholder-gray-500 flex-1"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <select
                  value={filterStatus}
                  title="Filter Status"
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-background-light dark:bg-background-dark/85 border border-border-light dark:border-border-dark rounded-xl px-2 py-1.5 text-[11px] text-text-light dark:text-text-dark font-bold focus:outline-none"
                >
                  <option value="">Semua Status</option>
                  <option value="pending">Menunggu Tanggapan</option>
                  <option value="processing">Diproses</option>
                  <option value="waiting_info">Butuh Info</option>
                  <option value="completed">Selesai</option>
                  <option value="closed">Ditutup</option>
                </select>

                <select
                  value={filterUrgency}
                  title="Filter Urgensi"
                  onChange={(e) => setFilterUrgency(e.target.value)}
                  className="bg-background-light dark:bg-background-dark/85 border border-border-light dark:border-border-dark rounded-xl px-2 py-1.5 text-[11px] text-text-light dark:text-text-dark font-bold focus:outline-none"
                >
                  <option value="">Semua Urgensi</option>
                  <option value="low">Rendah</option>
                  <option value="medium">Sedang</option>
                  <option value="high">Tinggi</option>
                  <option value="urgent">Mendesak</option>
                </select>

                <select
                  value={filterCategory}
                  title="Filter Kategori"
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-background-light dark:bg-background-dark/85 border border-border-light dark:border-border-dark rounded-xl px-2 py-1.5 text-[11px] text-text-light dark:text-text-dark font-bold focus:outline-none"
                >
                  <option value="">Semua Kategori</option>
                  <option value="perubahan email">Perubahan Email</option>
                  <option value="perubahan nama">Perubahan Nama</option>
                  <option value="perubahan nomor telepon">Perubahan Nomor Telepon</option>
                  <option value="perubahan alamat">Perubahan Alamat</option>
                  <option value="koreksi data profil">Koreksi Data Profil</option>
                  <option value="verifikasi ulang">Verifikasi Ulang</option>
                  <option value="bantuan login">Bantuan Login</option>
                  <option value="pembayaran">Masalah Pembayaran</option>
                  <option value="pesanan">Masalah Pesanan</option>
                  <option value="reward">Masalah Reward / Poin</option>
                  <option value="lainnya">Lainnya</option>
                </select>
              </div>
            </div>

            {/* Tab Selector */}
            <div className="flex gap-2 p-1 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-border-light dark:border-border-dark mb-4">
              <button
                onClick={() => {
                  setTicketViewTab('aktif');
                  setActiveTicket(null);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black rounded-lg uppercase transition-all ${
                  ticketViewTab === 'aktif'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <span>Antrean Aktif</span>
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[9px] font-black rounded-full bg-rose-500 text-white animate-pulse">
                    {pendingCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => {
                  setTicketViewTab('riwayat');
                  setActiveTicket(null);
                }}
                className={`flex-1 py-2 text-xs font-black rounded-lg uppercase transition-all ${
                  ticketViewTab === 'riwayat'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                Riwayat
              </button>
              <button
                onClick={() => {
                  setTicketViewTab('bantuan_admin');
                  setActiveTicket(null);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black rounded-lg uppercase transition-all ${
                  ticketViewTab === 'bantuan_admin'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <span>Bantuan Admin</span>
                {escalatedCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[9px] font-black rounded-full bg-rose-500 text-white animate-pulse">
                    {escalatedCount}
                  </span>
                )}
              </button>
            </div>

            {/* Queue List */}
            {loading ? (
              <div className="text-center py-10 text-muted">Memuat antrian tiket...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-16 text-muted space-y-2">
                <Info className="w-8 h-8 text-primary mx-auto opacity-40" />
                <p className="font-bold text-sm">
                  {ticketViewTab === 'riwayat' ? 'Tidak Ada Riwayat Tiket' : 'Tidak Ada Tiket Terkait'}
                </p>
                <p className="text-xs">
                  {ticketViewTab === 'riwayat' ? 'Tidak ada tiket bantuan yang sudah selesai atau ditutup.' : 'Ubah filter pencarian Anda di atas.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredTickets.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setActiveTicket(t)}
                    className={`p-4 rounded-xl border cursor-pointer text-left transition-all ${
                      activeTicket?.id === t.id
                        ? 'bg-primary/5 border-primary shadow-sm'
                        : 'bg-background-light/40 dark:bg-background-dark/20 border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800/40'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-mono text-[10px] font-bold text-primary">{t.ticket_number}</span>
                      <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase rounded border ${getUrgencyColor(t.urgency)}`}>
                        {t.urgency}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-text-light dark:text-text-dark mt-2 truncate">{t.title}</h3>
                    <p className="text-xs text-muted mt-1 truncate">Pelanggan: {t.profiles?.full_name || 'Pelanggan'}</p>
                    
                    <div className="flex justify-between items-center mt-3.5 pt-2 border-t border-gray-100/50 dark:border-gray-800/30 text-[9px] text-muted">
                      <span className={`px-1.5 py-0.5 rounded border font-semibold ${getStatusColor(t.status)}`}>
                        {getStatusLabel(t.status)}
                      </span>
                      <span className="flex items-center gap-1">
                        {t.source === 'ai' ? (
                          <span className="bg-amber-500/10 text-amber-500 px-1 py-0.5 rounded font-black text-[8px] uppercase tracking-wide">RestoBot AI</span>
                        ) : (
                          <span className="bg-blue-500/10 text-blue-500 px-1 py-0.5 rounded font-black text-[8px] uppercase tracking-wide">Manual</span>
                        )}
                        <span>{format(new Date(t.created_at), "dd MMMM yyyy, HH:mm", { locale: localeId })}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Side: Detail & Action Panel */}
          <div className="lg:col-span-7">
            {activeTicket ? (
              <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl overflow-hidden flex flex-col h-[650px] shadow-sm">
                
                {/* Header Action Menu */}
                <div className="p-4 border-b border-border-light dark:border-border-dark bg-background-light/20 dark:bg-background-dark/20 flex flex-wrap justify-between items-center gap-3">
                  <div>
                    <span className="font-mono text-xs font-bold text-primary">{activeTicket.ticket_number}</span>
                    <h2 className="text-base font-bold text-text-light dark:text-text-dark truncate max-w-[250px] mt-0.5">{activeTicket.title}</h2>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Action buttons */}
                    {!activeTicket.chat_started_at && (
                      <button
                        onClick={() => handleStartChat(activeTicket.id)}
                        className="bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                      >
                        <Play className="w-3.5 h-3.5" /> Mulai Chat
                      </button>
                    )}
                    {activeTicket.status !== 'completed' && activeTicket.status !== 'closed' && activeTicket.status !== 'expired' && activeTicket.status !== 'rejected' && (() => {
                      const isProfileCategory = [
                        'perubahan email',
                        'perubahan nama',
                        'perubahan nomor telepon',
                        'perubahan alamat',
                        'koreksi data profil',
                        'verifikasi ulang',
                        'bantuan login'
                      ].includes(activeTicket.category);

                      return (
                        <>
                          {/* For profile change categories: show Approve/Reject or Tandai Selesai if already approved */}
                          {isProfileCategory && activeTicket.status !== 'approved' ? (
                            <>
                              <button
                                onClick={() => handleOpenDecisionModal('approved')}
                                className="bg-emerald-650 hover:bg-emerald-755 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Setujui Permintaan
                              </button>
                              <button
                                onClick={() => handleOpenDecisionModal('rejected')}
                                className="bg-rose-650 hover:bg-rose-755 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 bg-red-600 hover:bg-red-700"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Tolak Permintaan
                              </button>
                            </>
                          ) : (
                            /* For non-profile categories OR approved profile tickets: show Tandai Selesai */
                            <button
                              onClick={() => handleUpdateTicketStatus(activeTicket.id, 'completed')}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Tandai Selesai
                            </button>
                          )}
                          {/* Extra actions only for non-approved statuses */}
                          {activeTicket.status !== 'approved' && !activeTicket.is_order_chat && (
                            <>
                              <button
                                onClick={() => handleUpdateTicketStatus(activeTicket.id, 'waiting_info')}
                                className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                              >
                                <Info className="w-3.5 h-3.5" /> Butuh Info
                              </button>
                              <button
                                onClick={() => handleEscalateTicket(activeTicket.id)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" /> Eskalasi
                              </button>
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Customer Details Box */}
                <div className="p-4 bg-background-light/10 dark:bg-background-dark/10 border-b border-border-light dark:border-border-dark grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-muted">Pelanggan</span>
                    <p className="font-bold text-text-light dark:text-text-dark truncate mt-0.5">{activeTicket.profiles?.full_name || 'Pelanggan'}</p>
                  </div>
                  <div>
                    <span className="text-muted">Email</span>
                    <p className="font-semibold text-text-light dark:text-text-dark truncate mt-0.5">{activeTicket.profiles?.email || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted">SLA Deadline</span>
                    <p className="font-bold text-red-500 mt-0.5">
                      {activeTicket.sla_deadline ? format(new Date(activeTicket.sla_deadline), "dd MMMM yyyy, HH:mm", { locale: localeId }) : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted">Sumber</span>
                    <p className="font-bold text-text-light dark:text-text-dark capitalize mt-0.5">{activeTicket.source}</p>
                  </div>
                </div>

                {/* Description and attachments */}
                <div className="p-4 bg-background-light/5 dark:bg-background-dark/5 border-b border-border-light dark:border-border-dark space-y-2">
                  <div>
                    <span className="text-[10px] font-bold text-muted uppercase">Deskripsi Keluhan</span>
                    <p className="text-xs text-text-light dark:text-text-dark leading-relaxed whitespace-pre-wrap mt-0.5">{activeTicket.description}</p>
                  </div>
                  {activeTicket.contact_info && (
                    <div className="pt-1.5 flex items-center gap-2">
                      <span className="text-xs text-muted font-bold">Kontak yang Dapat Dihubungi:</span>
                      <span className="text-xs font-semibold text-text-light dark:text-text-dark">{activeTicket.contact_info}</span>
                    </div>
                  )}
                  {activeTicket.attachment_url && (
                    <div className="pt-1.5 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      <a href={activeTicket.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-bold hover:underline">
                        Buka Dokumen Bukti Lampiran
                      </a>
                    </div>
                  )}
                </div>

                {/* Messages Screen */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-background-light/20 dark:bg-background-dark/10" id="admin-chat-container">
                  {activeTicket.status === 'expired' ? (
                    <div className="text-center py-12 text-muted text-xs">
                      <Trash2 className="w-10 h-10 mx-auto text-red-500 opacity-60 mb-2" />
                      <p className="font-bold text-sm text-text-light dark:text-text-dark">Riwayat chat telah dihapus permanen.</p>
                      <p className="text-xs text-muted max-w-[300px] mx-auto mt-1">Sesuai dengan kebijakan privasi dan keamanan sistem RestoBook.</p>
                    </div>
                  ) : (
                    <>
                      {!activeTicket.chat_started_at && (
                        <div className="text-center py-12 text-muted text-xs font-semibold">
                          Live Chat belum dimulai. Tekan tombol &quot;Mulai Chat&quot; di atas untuk membuka percakapan dengan pelanggan.
                        </div>
                      )}

                      {activeTicket.chat_started_at && messages.length === 0 && (
                        <div className="text-center py-12 text-muted text-xs">Belum ada percakapan. Ketik tanggapan Anda di bawah.</div>
                      )}

                      {messages.map((msg) => {
                        const isMe = adminProfile && msg.sender_id === adminProfile.id;
                        const isSystem = msg.message.startsWith('[SISTEM]');
                        
                        if (isSystem) {
                          return (
                            <div key={msg.id} className="flex justify-center my-2">
                              <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[10px] px-3 py-1.5 rounded-full font-medium border border-border-light dark:border-border-dark">
                                {msg.message.replace('[SISTEM] ', '')}
                              </span>
                            </div>
                          );
                        }

                        return (
                          <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}>
                            <div className="flex flex-col max-w-[75%]">
                              <div className={`p-3 rounded-2xl border text-xs leading-relaxed ${
                                isMe
                                  ? 'bg-primary text-white border-primary rounded-tr-none shadow-sm'
                                  : 'bg-white dark:bg-card-dark text-text-light dark:text-text-dark border-border-light dark:border-border-dark rounded-tl-none'
                              }`}>
                                {msg.attachment_url && (
                                  <div className="mb-2">
                                    {(() => {
                                      const url = msg.attachment_url;
                                      const ext = url.split('.').pop()?.toLowerCase();
                                      const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
                                      if (isImg) {
                                        return (
                                          <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 max-w-[200px] mb-1">
                                            <img src={url} alt="Lampiran" className="w-full h-auto max-h-[150px] object-cover cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => window.open(url)} />
                                          </div>
                                        );
                                      } else {
                                        return (
                                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold underline flex items-center gap-1.5 text-primary">
                                            <FileText className="w-3.5 h-3.5" /> Lihat Lampiran
                                          </a>
                                        );
                                      }
                                    })()}
                                  </div>
                                )}
                                {msg.message && <p className="whitespace-pre-wrap break-words">{msg.message}</p>}
                              </div>
                              <span className="text-[9px] text-muted mt-1 self-end px-1">
                                {format(new Date(msg.created_at), "HH:mm", { locale: localeId })}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Expiry / Lock Status */}
                {(activeTicket.status === 'completed' || activeTicket.status === 'closed' || activeTicket.status === 'expired' || activeTicket.status === 'rejected' || activeTicket.status === 'approved') && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border-t border-b border-amber-100 dark:border-amber-900/30 text-center text-xs">
                    <span className="font-bold text-amber-700 dark:text-amber-400">
                      {activeTicket.status === 'rejected' ? 'Permintaan Ditolak. Percakapan Terkunci.' : activeTicket.status === 'approved' ? 'Permintaan Disetujui. Percakapan Terkunci.' : 'Tiket Selesai / Ditutup. Percakapan Terkunci.'}
                    </span>
                    {activeTicket.chat_history_deleted_at && activeTicket.status !== 'expired' && (
                      <p className="text-[10px] text-muted mt-1">
                        Riwayat chat akan dibersihkan dalam: <strong className="font-mono text-red-500">{countdownText}</strong>
                      </p>
                    )}
                    {activeTicket.status === 'expired' && (
                      <p className="text-[10px] text-red-500 mt-1">Riwayat pesan telah dibersihkan secara permanen.</p>
                    )}
                  </div>
                )}

                {/* Quick Reply Templates */}
                {activeTicket.chat_started_at && activeTicket.status !== 'completed' && activeTicket.status !== 'closed' && activeTicket.status !== 'expired' && activeTicket.status !== 'approved' && (
                  <div className="px-4 py-2 border-t border-border-light dark:border-border-dark bg-background-light/40 dark:bg-background-dark/20 flex gap-2 overflow-x-auto whitespace-nowrap hide-scrollbar">
                    {QUICK_REPLIES.map((reply, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleUseQuickReply(reply)}
                        className="inline-block px-3 py-1.5 bg-white dark:bg-card-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-[10px] font-semibold rounded-lg hover:border-primary hover:text-primary transition-all flex-shrink-0"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}

                {/* Message Input Box */}
                {activeTicket.chat_started_at && activeTicket.status !== 'completed' && activeTicket.status !== 'closed' && activeTicket.status !== 'expired' && activeTicket.status !== 'rejected' && activeTicket.status !== 'approved' && (
                  <form onSubmit={handleSendMessage} className="p-3 border-t border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark flex items-center gap-3">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <label htmlFor="admin-chat-file-input" className="p-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800 text-muted hover:text-primary rounded-xl cursor-pointer transition-all flex items-center justify-center border border-border-light dark:border-border-dark" title="Pilih File dari Perangkat">
                        <Paperclip className="w-4 h-4" />
                        <input
                          type="file"
                          id="admin-chat-file-input"
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
                            document.getElementById('admin-chat-camera-input')?.click();
                          }
                        }}
                        className="p-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800 text-muted hover:text-primary rounded-xl cursor-pointer transition-all flex items-center justify-center border border-border-light dark:border-border-dark"
                        title="Ambil Foto dari Kamera"
                        aria-label="Ambil Foto dari Kamera"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      <input
                        type="file"
                        id="admin-chat-camera-input"
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
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Tulis pesan tanggapan admin..."
                      title="Pesan tanggapan admin"
                      aria-label="Pesan tanggapan admin"
                      className="flex-1 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-text-light dark:text-text-dark"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      title="Kirim tanggapan"
                      aria-label="Kirim"
                      className="bg-primary hover:bg-primary-hover disabled:bg-gray-250 dark:disabled:bg-gray-800 text-white p-2.5 rounded-xl transition-all flex items-center justify-center"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                )}

              </div>
            ) : (
              <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl p-16 text-center text-muted space-y-4">
                <LifeBuoy className="w-16 h-16 text-primary/40 mx-auto animate-pulse" />
                <h3 className="text-xl font-bold text-text-light dark:text-text-dark">Pilih Tiket Bantuan</h3>
                <p className="text-sm max-w-sm mx-auto">Klik salah satu tiket dari daftar antrian sebelah kiri untuk merespon dan memulai live chat.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Decision (Approve/Reject) Confirmation Modal */}
      <AnimatePresence>
        {showApprovalModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-border-light dark:border-border-dark pb-3">
                <h3 className="text-lg font-bold text-text-light dark:text-text-dark">
                  {approvalType === 'approved' ? 'Setujui Permintaan Perubahan' : 'Tolak Permintaan Perubahan'}
                </h3>
                <button
                  onClick={() => setShowApprovalModal(false)}
                  title="Tutup dialog"
                  aria-label="Tutup"
                  className="text-muted hover:text-red-500 transition-colors"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleDecisionSubmit} className="space-y-4">
                <p className="text-xs text-muted leading-relaxed">
                  {approvalType === 'approved'
                    ? 'Menyetujui permintaan ini akan membuka kolom input data yang bersangkutan pada halaman profil pelanggan secara sementara.'
                    : 'Menolak permintaan ini akan membatalkan proses perubahan data dan kolom input pada profil pelanggan akan tetap terkunci.'}
                </p>

                <div className="space-y-1.5">
                  <label htmlFor="decisionReason" className="text-xs font-bold text-muted uppercase">
                    {approvalType === 'approved' ? 'Alasan Persetujuan' : 'Alasan Penolakan'}
                  </label>
                  <textarea
                    id="decisionReason"
                    required
                    placeholder={
                      approvalType === 'approved'
                        ? 'Masukkan alasan persetujuan (contoh: Dokumen verifikasi valid)'
                        : 'Masukkan alasan penolakan (contoh: Dokumen lampiran tidak sesuai)'
                    }
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    rows={3}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl p-3 text-xs text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-border-light dark:border-border-dark">
                  <button
                    type="button"
                    onClick={() => setShowApprovalModal(false)}
                    className="px-4 py-2 border border-border-light dark:border-border-dark rounded-xl text-xs font-bold text-muted hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={decisionLoading || !decisionReason.trim()}
                    className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                      approvalType === 'approved'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {decisionLoading ? 'Memproses...' : approvalType === 'approved' ? 'Setujui' : 'Tolak'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCameraCapture}
      />

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />

    </div>
  );
}
