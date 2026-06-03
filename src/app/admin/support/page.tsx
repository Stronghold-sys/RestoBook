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
  Mail, Calendar, Download, RefreshCw, Settings, ChevronRight
} from "lucide-react";

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
  status: 'pending' | 'processing' | 'waiting_info' | 'completed' | 'closed' | 'expired';
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
  const [chatExpiryHours, setChatExpiryHours] = useState(0);
  const [chatExpiryMinutes, setChatExpiryMinutes] = useState(30);
  const [chatExpirySeconds, setChatExpirySeconds] = useState(0);
  const [slaHoursLow, setSlaHoursLow] = useState(48);
  const [slaHoursMedium, setSlaHoursMedium] = useState(24);
  const [slaHoursHigh, setSlaHoursHigh] = useState(12);
  const [slaHoursUrgent, setSlaHoursUrgent] = useState(4);

  // Countdown timer for completed/closed tickets
  const [countdownText, setCountdownText] = useState('');

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
      .subscribe();

    return () => {
      supabase.removeChannel(ticketChannel);
    };
  }, [filterStatus, filterUrgency, filterCategory, searchTerm]);

  // Subscribe to messages when activeTicket changes
  useEffect(() => {
    if (!activeTicket) {
      setMessages([]);
      return;
    }

    fetchMessages(activeTicket.id);

    const messageChannel = supabase
      .channel(`admin-ticket-messages-${activeTicket.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_messages',
        filter: `ticket_id=eq.${activeTicket.id}`
      }, (payload: any) => {
        const newMsg = payload.new as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;

          // Sound trigger for customer message (different from admin sender_id)
          if (adminProfile && newMsg.sender_id !== adminProfile.id) {
            playAdminSound('customer_chat');
          }
          return [...prev, newMsg];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [activeTicket?.id, adminProfile?.id]);

  // Countdown timer for completed/closed tickets
  useEffect(() => {
    if (!activeTicket || !activeTicket.chat_history_deleted_at) {
      setCountdownText('');
      return;
    }

    const interval = setInterval(() => {
      const deletionTime = new Date(activeTicket.chat_history_deleted_at!).getTime();
      const diff = deletionTime - Date.now();

      if (diff <= 0) {
        setCountdownText('00:00:00');
        clearInterval(interval);
        fetchAdminAndTickets();
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const pad = (num: number) => num.toString().padStart(2, '0');
        setCountdownText(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTicket?.chat_history_deleted_at]);

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
        setTickets(data || []);
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

  const fetchSupportSettings = async () => {
    try {
      const res = await fetch('/api/admin/support/settings');
      if (res.ok) {
        const data = await res.json();
        setSettingsId(data.id);
        setChatExpiryHours(data.chat_expiry_hours ?? 0);
        setChatExpiryMinutes(data.chat_expiry_minutes ?? 30);
        setChatExpirySeconds(data.chat_expiry_seconds ?? 0);
        setSlaHoursLow(data.sla_hours_low ?? 48);
        setSlaHoursMedium(data.sla_hours_medium ?? 24);
        setSlaHoursHigh(data.sla_hours_high ?? 12);
        setSlaHoursUrgent(data.sla_hours_urgent ?? 4);
      }
    } catch (e) {}
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    try {
      const res = await fetch('/api/admin/support/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_expiry_hours: chatExpiryHours,
          chat_expiry_minutes: chatExpiryMinutes,
          chat_expiry_seconds: chatExpirySeconds,
          sla_hours_low: slaHoursLow,
          sla_hours_medium: slaHoursMedium,
          sla_hours_high: slaHoursHigh,
          sla_hours_urgent: slaHoursUrgent
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeTicket) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
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
              <h3 className="text-sm font-bold text-text-light dark:text-text-dark">Waktu Penghapusan Riwayat Chat (Setelah Tiket Selesai)</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase">Jam</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={chatExpiryHours}
                    onChange={(e) => setChatExpiryHours(Number(e.target.value))}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase">Menit</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={chatExpiryMinutes}
                    onChange={(e) => setChatExpiryMinutes(Number(e.target.value))}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase">Detik</label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={chatExpirySeconds}
                    onChange={(e) => setChatExpirySeconds(Number(e.target.value))}
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
                  <label className="text-xs font-bold text-muted uppercase">Urgent</label>
                  <input
                    type="number"
                    min="1"
                    value={slaHoursUrgent}
                    onChange={(e) => setSlaHoursUrgent(Number(e.target.value))}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase">High</label>
                  <input
                    type="number"
                    min="1"
                    value={slaHoursHigh}
                    onChange={(e) => setSlaHoursHigh(Number(e.target.value))}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase">Medium</label>
                  <input
                    type="number"
                    min="1"
                    value={slaHoursMedium}
                    onChange={(e) => setSlaHoursMedium(Number(e.target.value))}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted uppercase">Low</label>
                  <input
                    type="number"
                    min="1"
                    value={slaHoursLow}
                    onChange={(e) => setSlaHoursLow(Number(e.target.value))}
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
                  placeholder="Cari tiket atau pelanggan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-transparent border-none text-xs outline-none text-text-light dark:text-text-dark placeholder-gray-400 dark:placeholder-gray-500 flex-1"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <select
                  value={filterStatus}
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
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-background-light dark:bg-background-dark/85 border border-border-light dark:border-border-dark rounded-xl px-2 py-1.5 text-[11px] text-text-light dark:text-text-dark font-bold focus:outline-none"
                >
                  <option value="">Semua Kategori</option>
                  <option value="Pembayaran">Pembayaran</option>
                  <option value="Makanan">Makanan</option>
                  <option value="Reservasi">Reservasi</option>
                  <option value="Pelayanan">Pelayanan</option>
                  <option value="Teknis">Teknis</option>
                  <option value="Akun">Akun</option>
                </select>
              </div>
            </div>

            {/* Queue List */}
            {loading ? (
              <div className="text-center py-10 text-muted">Memuat antrian tiket...</div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-16 text-muted space-y-2">
                <Info className="w-8 h-8 text-primary mx-auto opacity-40" />
                <p className="font-bold text-sm">Tidak Ada Tiket Terkait</p>
                <p className="text-xs">Ubah filter pencarian Anda di atas.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                {tickets.map((t) => (
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
                        <span>{format(new Date(t.created_at), "dd MMM HH:mm", { locale: localeId })}</span>
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
                    {activeTicket.status !== 'completed' && activeTicket.status !== 'closed' && (
                      <>
                        <button
                          onClick={() => handleUpdateTicketStatus(activeTicket.id, 'completed')}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Tandai Selesai
                        </button>
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
                      {activeTicket.sla_deadline ? format(new Date(activeTicket.sla_deadline), "dd MMM yyyy, HH:mm", { locale: localeId }) : '-'}
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
                            <p className="whitespace-pre-wrap">{msg.message}</p>
                          </div>
                          <span className="text-[9px] text-muted mt-1 self-end px-1">
                            {format(new Date(msg.created_at), "HH:mm", { locale: localeId })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Expiry / Lock Status */}
                {(activeTicket.status === 'completed' || activeTicket.status === 'closed' || activeTicket.status === 'expired') && (
                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border-t border-b border-amber-100 dark:border-amber-900/30 text-center text-xs">
                    <span className="font-bold text-amber-700 dark:text-amber-400">Tiket Selesai / Ditutup. Percakapan Terkunci.</span>
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
                {activeTicket.chat_started_at && activeTicket.status !== 'completed' && activeTicket.status !== 'closed' && activeTicket.status !== 'expired' && (
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
                {activeTicket.chat_started_at && activeTicket.status !== 'completed' && activeTicket.status !== 'closed' && activeTicket.status !== 'expired' && (
                  <form onSubmit={handleSendMessage} className="p-3 border-t border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark flex items-center gap-3">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Tulis pesan tanggapan admin..."
                      className="flex-1 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary text-text-light dark:text-text-dark"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="bg-primary hover:bg-primary-hover disabled:bg-gray-250 dark:disabled:bg-gray-800 text-white p-2.5 rounded-xl transition-all"
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
