"use client";

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  LifeBuoy, Plus, ClipboardList, Send, FileText,
  User, CheckCircle, Clock, AlertTriangle, XCircle, Info, ChevronRight, Volume2,
  Paperclip, Camera
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

export default function CustomerSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'aktif' | 'riwayat'>('aktif');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('perubahan email');
  const [formSubcategory, setFormSubcategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formUrgency, setFormUrgency] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [formContactInfo, setFormContactInfo] = useState('');
  const [formAttachmentUrl, setFormAttachmentUrl] = useState('');

  // Audio settings
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // Real-time deletion countdown
  const [countdownText, setCountdownText] = useState('');

  // Sound generator
  const playNotificationSound = (type: 'chat' | 'general') => {
    if (!isAudioEnabled) return;
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
        gain.gain.linearRampToValueAtTime(0.15, start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };

      const now = ctx.currentTime;
      if (type === 'chat') {
        // Soft double-chime for chat replies
        playTone(523.25, now, 0.2); // C5
        playTone(659.25, now + 0.1, 0.35); // E5
      } else {
        // High single-chime for general ticket status updates
        playTone(880.00, now, 0.3); // A5
      }
    } catch (e) {
      console.warn("AudioContext tone generation blocked or unsupported:", e);
    }
  };

  // Fetch initial profile & tickets
  useEffect(() => {
    fetchProfileAndTickets();

    // Subscribe to support tickets changes
    const ticketChannel = supabase
      .channel('customer-tickets-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'support_tickets'
      }, (payload: any) => {
        fetchTicketsOnly();
        
        // If the ticket changes, update activeTicket reference too
        if (payload.new && payload.new.id) {
          setActiveTicket((current) => {
            if (current && current.id === payload.new.id) {
              // Trigger notification tone on status change
              if (payload.old && payload.old.status !== payload.new.status) {
                playNotificationSound('general');
                toast.success(`Status tiket diperbarui menjadi: ${getStatusLabel(payload.new.status)}`);
              }
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
  }, []);

  // Subscribe to messages when activeTicket changes
  useEffect(() => {
    if (!activeTicket) {
      setMessages([]);
      return;
    }

    fetchMessages(activeTicket.id);

    const messageChannel = supabase
      .channel(`ticket-messages-${activeTicket.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ticket_messages',
        filter: `ticket_id=eq.${activeTicket.id}`
      }, (payload: any) => {
        const newMsg = payload.new as Message;
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m.id === newMsg.id)) return prev;
          
          // Sound chime if message comes from admin (different user than logged-in user)
          if (profile && newMsg.sender_id !== profile.id) {
            playNotificationSound('chat');
          }
          return [...prev, newMsg];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
    };
  }, [activeTicket?.id, profile?.id]);

  // Countdown timer logic
  useEffect(() => {
    if (!activeTicket || !activeTicket.chat_history_deleted_at) {
      setCountdownText('');
      return;
    }

    const interval = setInterval(() => {
      const deletionTime = new Date(activeTicket.chat_history_deleted_at!).getTime();
      const diff = deletionTime - Date.now();

      if (diff <= 0) {
        setCountdownText('00 jam 00 menit 00 detik');
        clearInterval(interval);
        // Refresh active ticket status
        fetchProfileAndTickets();
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        const pad = (num: number) => num.toString().padStart(2, '0');
        setCountdownText(`${pad(hours)} jam ${pad(minutes)} menit ${pad(seconds)} detik`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTicket?.chat_history_deleted_at]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchProfileAndTickets = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.session.user.id)
        .single();
      
      if (prof) {
        setProfile(prof);
        const { data: ticketsData } = await supabase
          .from('support_tickets')
          .select('*')
          .eq('customer_id', prof.id)
          .order('created_at', { ascending: false });
        
        setTickets(ticketsData || []);
      }
    } catch (e: any) {
      toast.error("Gagal memuat data support: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketsOnly = async () => {
    if (!profile) return;
    try {
      const { data: ticketsData } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('customer_id', profile.id)
        .order('created_at', { ascending: false });
      setTickets(ticketsData || []);
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

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDescription.trim()) {
      toast.error("Judul dan Isi Keluhan wajib diisi");
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await fetch('/api/customer/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          category: formCategory,
          subcategory: formSubcategory || null,
          description: formDescription,
          attachment_url: formAttachmentUrl || null,
          urgency: formUrgency,
          contact_info: formContactInfo || null
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Terjadi kesalahan');
      }

      toast.success("Tiket pengaduan berhasil dibuat");
      setShowCreateModal(false);
      
      // Reset form
      setFormTitle('');
      setFormCategory('Pembayaran');
      setFormSubcategory('');
      setFormDescription('');
      setFormUrgency('medium');
      setFormContactInfo('');
      setFormAttachmentUrl('');

      // Auto-trigger confirmation alert message
      toast.success(result.message);

      // Refresh list
      fetchProfileAndTickets();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancelTicket = async () => {
    if (!activeTicket) return;
    if (!cancelReason.trim()) {
      toast.error("Alasan pembatalan wajib diisi");
      return;
    }

    setCancelLoading(true);
    try {
      const res = await fetch(`/api/support/ticket/${activeTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'closed',
          cancellation_reason: cancelReason.trim()
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Gagal membatalkan tiket');
      }

      toast.success("Tiket berhasil dibatalkan");
      setShowCancelModal(false);
      
      // Refresh tickets list and active ticket state
      await fetchProfileAndTickets();
      
      // Update activeTicket state locally to reflect closed status
      setActiveTicket(prev => prev ? { ...prev, status: 'closed' } : null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCancelLoading(false);
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
        // Immediate local append to keep responsiveness
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    } catch (err) {
      toast.error('Gagal mengirim pesan chat');
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
    } catch (err: any) {
      toast.error(err.message || "Gagal mengunggah file", { id: toastId });
    } finally {
      setUploadingFile(false);
      e.target.value = "";
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
      case 'urgent': return 'text-red-500 font-bold';
      case 'high': return 'text-orange-500 font-semibold';
      case 'medium': return 'text-yellow-500';
      default: return 'text-green-500';
    }
  };

  const filteredTickets = tickets.filter(t => {
    const isHistory = ['rejected', 'completed', 'closed', 'expired'].includes(t.status);
    return activeTab === 'riwayat' ? isHistory : !isHistory;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border-light dark:border-border-dark pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-text-light dark:text-text-dark flex items-center gap-2.5">
            <LifeBuoy className="w-8 h-8 text-primary" /> Pengaduan & Bantuan
          </h1>
          <p className="text-muted mt-1">Kelola tiket bantuan dan hubungi staf operasional kami</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAudioEnabled(!isAudioEnabled)}
            className={`p-2.5 rounded-xl border transition-all flex items-center justify-center ${
              isAudioEnabled 
                ? "bg-primary/5 border-primary/20 text-primary" 
                : "bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark text-muted"
            }`}
            title={isAudioEnabled ? "Matikan Suara" : "Aktifkan Suara"}
          >
            <Volume2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl font-bold transition-all shadow-md shadow-primary/20"
          >
            <Plus className="w-5 h-5" /> Buat Pengaduan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Tickets List */}
        <div className="lg:col-span-4 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl p-4 space-y-4">
          <h2 className="text-lg font-bold text-text-light dark:text-text-dark flex items-center gap-2 border-b border-border-light dark:border-border-dark pb-3">
            <ClipboardList className="w-5 h-5 text-muted" /> Daftar Tiket Anda
          </h2>

          {/* Tab Selector */}
          <div className="flex gap-2 p-1 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-border-light dark:border-border-dark">
            <button
              onClick={() => {
                setActiveTab('aktif');
                setActiveTicket(null);
              }}
              className={`flex-1 py-2 text-xs font-black rounded-lg uppercase transition-all ${
                activeTab === 'aktif'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              Aktif
            </button>
            <button
              onClick={() => {
                setActiveTab('riwayat');
                setActiveTicket(null);
              }}
              className={`flex-1 py-2 text-xs font-black rounded-lg uppercase transition-all ${
                activeTab === 'riwayat'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-primary'
              }`}
            >
              Riwayat
            </button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted">Memuat data tiket...</div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-16 text-muted space-y-2">
              <Info className="w-10 h-10 mx-auto opacity-40 text-primary" />
              <p className="font-semibold text-sm">
                {activeTab === 'riwayat' ? 'Tidak Ada Riwayat Tiket' : 'Belum Ada Tiket Bantuan'}
              </p>
              <p className="text-xs max-w-[200px] mx-auto">
                {activeTab === 'riwayat' 
                  ? 'Anda tidak memiliki riwayat tiket bantuan yang sudah selesai atau ditutup.' 
                  : 'Gunakan chatbot RestoBot atau klik tombol di atas untuk membuat tiket pengaduan baru.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredTickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setActiveTicket(t)}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                    activeTicket?.id === t.id
                      ? 'bg-primary/5 border-primary shadow-sm'
                      : 'bg-background-light/40 dark:bg-background-dark/20 border-border-light dark:border-border-dark hover:bg-gray-50 dark:hover:bg-gray-800/40'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-mono text-xs font-bold text-primary">{t.ticket_number}</span>
                    <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded border ${getStatusColor(t.status)}`}>
                      {getStatusLabel(t.status)}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-text-light dark:text-text-dark mt-2 truncate">{t.title}</h3>
                  <div className="flex justify-between items-center text-[10px] text-muted mt-3">
                    <span>{format(new Date(t.created_at), "dd MMMM yyyy", { locale: localeId })}</span>
                    <span className="capitalize">{t.category}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Detail & Live Chat Console */}
        <div className="lg:col-span-8 space-y-6">
          {activeTicket ? (
            <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl overflow-hidden flex flex-col h-[650px] shadow-sm">
              
              {/* Ticket Meta Info */}
              <div className="p-5 border-b border-border-light dark:border-border-dark bg-background-light/20 dark:bg-background-dark/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-primary">{activeTicket.ticket_number}</span>
                    <span className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded border ${getStatusColor(activeTicket.status)}`}>
                      {getStatusLabel(activeTicket.status)}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-text-light dark:text-text-dark mt-1.5">{activeTicket.title}</h2>
                  <p className="text-xs text-muted mt-1">
                    Dibuat pada: {format(new Date(activeTicket.created_at), "dd MMMM yyyy, HH:mm", { locale: localeId })} WIB
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {activeTicket.sla_deadline && !['completed', 'closed', 'expired'].includes(activeTicket.status) && (
                    <div className="flex items-center gap-1.5 text-xs bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-xl border border-amber-200/50 dark:border-amber-900/30">
                      <Clock className="w-4 h-4" />
                      <span>
                        SLA: {format(new Date(activeTicket.sla_deadline), "dd MMMM yyyy, HH:mm", { locale: localeId })} WIB
                      </span>
                    </div>
                  )}
                  {!['completed', 'closed', 'expired'].includes(activeTicket.status) && (
                    <button
                      onClick={() => {
                        setCancelReason('');
                        setShowCancelModal(true);
                      }}
                      className="px-4 py-2 bg-red-650 hover:bg-red-750 text-white rounded-xl text-xs font-bold transition-all shadow-sm bg-red-600 hover:bg-red-700"
                    >
                      Batalkan Tiket
                    </button>
                  )}
                </div>
              </div>

              {/* Detail Description */}
              <div className="p-5 bg-background-light/10 dark:bg-background-dark/10 border-b border-border-light dark:border-border-dark space-y-3">
                <div>
                  <h4 className="text-xs font-bold text-muted uppercase tracking-wider">Isi Keluhan</h4>
                  <p className="text-sm text-text-light dark:text-text-dark mt-1 leading-relaxed whitespace-pre-line">{activeTicket.description}</p>
                </div>
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs">
                  <div>
                    <span className="text-muted">Kategori: </span>
                    <span className="font-semibold text-text-light dark:text-text-dark capitalize">{activeTicket.category} {activeTicket.subcategory ? `/ ${activeTicket.subcategory}` : ''}</span>
                  </div>
                  <div>
                    <span className="text-muted">Urgensi: </span>
                    <span className={`font-semibold ${getUrgencyColor(activeTicket.urgency)} capitalize`}>{activeTicket.urgency}</span>
                  </div>
                  {activeTicket.contact_info && (
                    <div>
                      <span className="text-muted">Kontak yang Dapat Dihubungi: </span>
                      <span className="font-semibold text-text-light dark:text-text-dark">{activeTicket.contact_info}</span>
                    </div>
                  )}
                  {activeTicket.attachment_url && (
                    <div>
                      <span className="text-muted">Lampiran: </span>
                      <a href={activeTicket.attachment_url} target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">
                        Lihat Lampiran Bukti
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Log Window */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-background-light/20 dark:bg-background-dark/10" id="chat-messages-container">
                
                {/* Chat status messages */}
                {!activeTicket.chat_started_at && (
                  <div className="text-center py-10 space-y-2">
                    <Clock className="w-10 h-10 mx-auto text-yellow-500 opacity-60 animate-pulse" />
                    <p className="font-bold text-sm text-text-light dark:text-text-dark">Chat belum dimulai oleh admin.</p>
                    <p className="text-xs text-muted max-w-[300px] mx-auto">Silakan tunggu hingga tim kami meninjau keluhan Anda dan memulai percakapan.</p>
                  </div>
                )}

                {activeTicket.chat_started_at && messages.length === 0 && (
                  <div className="text-center py-12 text-muted text-xs">Belum ada percakapan. Mulai kirim pesan Anda.</div>
                )}

                {messages.map((msg) => {
                  const isMe = profile && msg.sender_id === profile.id;
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
                      <div className="flex flex-col max-w-[70%]">
                        <div className={`p-3.5 rounded-2xl border text-sm ${
                          isMe 
                            ? 'bg-primary text-white border-primary rounded-tr-none'
                            : 'bg-white dark:bg-card-dark text-text-light dark:text-text-dark border-border-light dark:border-border-dark rounded-tl-none'
                        }`}>
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                          {msg.attachment_url && (
                            <div className="mt-2 pt-2 border-t border-white/20">
                              {(() => {
                                const url = msg.attachment_url;
                                const ext = url.split('.').pop()?.toLowerCase();
                                const isImg = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
                                if (isImg) {
                                  return (
                                    <div className="rounded-xl overflow-hidden border border-border-light dark:border-border-dark max-w-[200px] mb-1">
                                      <img src={url} alt="Attachment" className="w-full h-auto max-h-[150px] object-cover cursor-zoom-in hover:opacity-90 transition-opacity" onClick={() => window.open(url)} />
                                    </div>
                                  );
                                } else {
                                  return (
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold underline flex items-center gap-1">
                                      <FileText className="w-3.5 h-3.5" /> Lihat Lampiran
                                    </a>
                                  );
                                }
                              })()}
                            </div>
                          )}
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

              {/* Chat Expiry Warning / Locked Panel */}
              {(activeTicket.status === 'completed' || activeTicket.status === 'closed' || activeTicket.status === 'expired') && (
                <div className="p-4 bg-red-50 dark:bg-red-950/20 border-t border-b border-red-100 dark:border-red-900/30 text-center space-y-1">
                  <p className="text-sm font-bold text-red-600 dark:text-red-400">Percakapan telah berakhir.</p>
                  <p className="text-xs text-red-500/80">Anda tidak dapat mengirim pesan lagi pada tiket ini.</p>
                  {activeTicket.chat_history_deleted_at && activeTicket.status !== 'expired' && (
                    <p className="text-[11px] font-mono text-red-600 dark:text-red-400 mt-1">
                      Riwayat chat akan dihapus otomatis dalam: {countdownText}
                    </p>
                  )}
                  {activeTicket.status === 'expired' && (
                    <p className="text-[11px] font-mono text-red-500 mt-1">
                      Riwayat chat telah dihapus permanen.
                    </p>
                  )}
                </div>
              )}

              {/* Chat Input Area */}
              {activeTicket.chat_started_at && activeTicket.status !== 'completed' && activeTicket.status !== 'closed' && activeTicket.status !== 'expired' && (
                <form onSubmit={handleSendMessage} className="p-4 border-t border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark flex items-center gap-3">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <label htmlFor="chat-file-input" className="p-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800 text-muted hover:text-primary rounded-xl cursor-pointer transition-all flex items-center justify-center border border-border-light dark:border-border-dark" title="Pilih File dari Perangkat">
                      <Paperclip className="w-4 h-4" />
                      <input
                        type="file"
                        id="chat-file-input"
                        className="hidden"
                        disabled={uploadingFile}
                        onChange={(e) => handleChatFileUpload(e, false)}
                        title="Pilih File dari Perangkat"
                        aria-label="Pilih File dari Perangkat"
                      />
                    </label>

                    <label htmlFor="chat-camera-input" className="p-2.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/40 dark:hover:bg-gray-800 text-muted hover:text-primary rounded-xl cursor-pointer transition-all flex items-center justify-center border border-border-light dark:border-border-dark" title="Ambil Foto dari Kamera">
                      <Camera className="w-4 h-4" />
                      <input
                        type="file"
                        id="chat-camera-input"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={uploadingFile}
                        onChange={(e) => handleChatFileUpload(e, true)}
                        title="Ambil Foto dari Kamera"
                        aria-label="Ambil Foto dari Kamera"
                      />
                    </label>
                  </div>

                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Tulis pesan balasan..."
                    className="flex-1 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-text-light dark:text-text-dark"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    title="Kirim pesan"
                    aria-label="Kirim pesan"
                    className="bg-primary hover:bg-primary-hover disabled:bg-gray-250 dark:disabled:bg-gray-800 text-white p-2.5 rounded-xl transition-all flex items-center justify-center"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              )}

            </div>
          ) : (
            <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl p-16 text-center text-muted space-y-4">
              <LifeBuoy className="w-16 h-16 text-primary/40 mx-auto" />
              <h3 className="text-xl font-bold text-text-light dark:text-text-dark">Detail Tiket Bantuan</h3>
              <p className="text-sm max-w-sm mx-auto">Silakan pilih salah satu tiket pengaduan di sebelah kiri untuk melihat rincian serta riwayat live chat.</p>
            </div>
          )}
        </div>

      </div>

      {/* Manual Ticket Creation Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-border-light dark:border-border-dark pb-3">
                <h3 className="text-xl font-bold text-text-light dark:text-text-dark">Formulir Pengaduan Baru</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  title="Tutup formulir"
                  aria-label="Tutup"
                  className="text-muted hover:text-red-500 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted uppercase">Judul Pengaduan</label>
                    <input
                      type="text"
                      required
                      placeholder="Masukkan judul singkat keluhan"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4.5 py-2.5 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="formCategory" className="text-xs font-bold text-muted uppercase">Kategori Keluhan</label>
                    <select
                      id="formCategory"
                      title="Kategori Keluhan"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="perubahan email">Perubahan Email</option>
                      <option value="perubahan nama">Perubahan Nama</option>
                      <option value="perubahan nomor telepon">Perubahan Nomor Telepon</option>
                      <option value="perubahan alamat">Perubahan Alamat</option>
                      <option value="koreksi data profil">Koreksi Data Profil</option>
                      <option value="verifikasi ulang">Verifikasi Ulang</option>
                      <option value="bantuan login">Bantuan Login</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted uppercase">Subkategori (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Contoh: Dompetku, Double Cash"
                      value={formSubcategory}
                      onChange={(e) => setFormSubcategory(e.target.value)}
                      className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4.5 py-2.5 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="formUrgency" className="text-xs font-bold text-muted uppercase">Tingkat Urgensi</label>
                    <select
                      id="formUrgency"
                      title="Tingkat Urgensi"
                      value={formUrgency}
                      onChange={(e: any) => setFormUrgency(e.target.value)}
                      className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="low">Rendah</option>
                      <option value="medium">Sedang</option>
                      <option value="high">Tinggi</option>
                      <option value="urgent">Mendesak</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted uppercase">Isi Keluhan / Keterangan</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Jelaskan kendala Anda secara terperinci agar kami dapat membantu lebih cepat"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted uppercase">Kontak yang Bisa Dihubungi</label>
                    <input
                      type="text"
                      placeholder="Nomor WA / Telepon aktif"
                      value={formContactInfo}
                      onChange={(e) => setFormContactInfo(e.target.value)}
                      className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4.5 py-2.5 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted uppercase">URL Lampiran Bukti (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Masukkan URL foto/dokumen jika ada"
                      value={formAttachmentUrl}
                      onChange={(e) => setFormAttachmentUrl(e.target.value)}
                      className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4.5 py-2.5 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-border-light dark:border-border-dark">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl border border-border-light dark:border-border-dark text-muted font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="bg-primary hover:bg-primary-hover disabled:bg-gray-250 dark:disabled:bg-gray-800 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-md transition-all"
                  >
                    {submitLoading ? "Mengirim..." : "Kirim Pengaduan"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. CANCEL TICKET MODAL */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="flex justify-between items-center border-b border-border-light dark:border-border-dark pb-3">
                <h3 className="text-lg font-bold text-text-light dark:text-text-dark">Batalkan Tiket Pengaduan</h3>
                <button
                  onClick={() => setShowCancelModal(false)}
                  title="Tutup formulir"
                  aria-label="Tutup"
                  className="text-muted hover:text-red-500 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted uppercase">Alasan Pembatalan</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Masukkan alasan Anda membatalkan tiket pengaduan ini..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 text-sm text-text-light dark:text-text-dark focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-border-light dark:border-border-dark">
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(false)}
                    className="px-4 py-2 rounded-xl border border-border-light dark:border-border-dark text-muted font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleCancelTicket}
                    disabled={cancelLoading || !cancelReason.trim()}
                    className="bg-red-650 hover:bg-red-750 disabled:bg-gray-250 dark:disabled:bg-gray-800 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-md transition-all bg-red-600 hover:bg-red-700"
                  >
                    {cancelLoading ? "Memproses..." : "Ya, Batalkan Tiket"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
