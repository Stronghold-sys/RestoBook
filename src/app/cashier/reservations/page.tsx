"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Check, X, Loader2, Clock, Users, MapPin, Phone, Eye, MessageSquare, Plus, User, CheckCircle, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import BaseModal from "@/components/BaseModal";

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
}

export default function CashierReservationsPage() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  // Detail Modal State
  const [selectedRes, setSelectedRes] = useState<any>(null);

  // Reject Modal State
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Cashier booking Modal State
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookForm, setBookForm] = useState({
    atasNama: "",
    telepon: "",
    date: "",
    time: "12:00",
    guests: 2,
    notes: ""
  });
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [bookingSubmit, setBookingSubmit] = useState(false);

  const [durationMinutes, setDurationMinutes] = useState<number>(120);
  const [bookedTablesInfo, setBookedTablesInfo] = useState<Record<string, "pending" | "confirmed">>({});

  const isTimeOverlapping = (t1: string, t2: string, duration: number) => {
    const parseToMinutes = (timeStr: string) => {
      const parts = timeStr.split(":");
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      return hours * 60 + minutes;
    };
    const m1 = parseToMinutes(t1);
    const m2 = parseToMinutes(t2);
    return m1 < m2 + duration && m2 < m1 + duration;
  };

  const supabase = createClient();

  useEffect(() => {
    fetchData();

    const channel = supabase.channel("cashier-reservations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    try {
      const { data } = await supabase.from("reservations").select("*, profiles!reservations_customer_id_fkey(full_name, phone), tables(table_number, capacity)").order("reservation_date", { ascending: true });
      setReservations(data || []);

      const { data: tbl } = await supabase.from("tables").select("*").order("table_number");
      setTables(tbl || []);

      // Fetch reservation settings
      const { data: settingsData } = await supabase.from("restaurant_settings").select("reservation_settings").single();
      if (settingsData?.reservation_settings) {
        const resSettings = typeof settingsData.reservation_settings === "string"
          ? JSON.parse(settingsData.reservation_settings)
          : settingsData.reservation_settings;
        if (resSettings?.duration_minutes) {
          setDurationMinutes(Number(resSettings.duration_minutes));
        }
      }
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  // Real-time table availability check based on selected date & time for cashier booking
  useEffect(() => {
    if (!showBookModal || !bookForm.date || !bookForm.time) return;

    const fetchBookedTables = async () => {
      try {
        const { data: resList, error } = await supabase
          .from("reservations")
          .select("id, table_id, notes, status, reservation_time")
          .eq("reservation_date", bookForm.date)
          .in("status", ["pending", "confirmed"]);

        if (error) throw error;

        const bookedInfo: Record<string, "pending" | "confirmed"> = {};
        resList?.forEach(res => {
          if (res.reservation_time && isTimeOverlapping(res.reservation_time, bookForm.time, durationMinutes)) {
            const status = res.status as "pending" | "confirmed";
            if (res.table_id) {
              bookedInfo[res.table_id] = status;
            }
            try {
              const parsedNotes = JSON.parse(res.notes);
              if (parsedNotes && Array.isArray(parsedNotes.meja_ids)) {
                parsedNotes.meja_ids.forEach((id: string) => {
                  bookedInfo[id] = status;
                });
              }
            } catch (e) {}
          }
        });
        setBookedTablesInfo(bookedInfo);
      } catch (err: any) {
        console.error("Gagal memeriksa ketersediaan meja:", err.message);
      }
    };

    fetchBookedTables();

    const channel = supabase.channel("cashier-modal-reservations-realtime-check")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        fetchBookedTables();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookForm.date, bookForm.time, showBookModal, durationMinutes]);

  // Clear selected tables if they become booked/conflicting due to date/time changes
  useEffect(() => {
    if (selectedTableIds.length > 0 && Object.keys(bookedTablesInfo).length > 0) {
      setSelectedTableIds(prev => prev.filter(id => !bookedTablesInfo[id]));
    }
  }, [bookedTablesInfo]);

  const getParsedNotes = (notesStr: string) => {
    try {
      const parsed = JSON.parse(notesStr);
      if (parsed && typeof parsed === "object" && "atas_nama" in parsed) {
        return parsed;
      }
    } catch (e) {}
    return null;
  };

  const handleConfirm = async (res: any) => {
    try {
      const parsedNotes = getParsedNotes(res.notes);
      const tableIds = parsedNotes?.meja_ids || [res.table_id];

      // Update reservation status
      const { error: resError } = await supabase.from("reservations").update({ status: "confirmed" }).eq("id", res.id);
      if (resError) throw resError;

      // Update selected tables status to 'reserved' (locked)
      if (tableIds && tableIds.length > 0) {
        const { error: tableError } = await supabase.from("tables").update({ status: "reserved" }).in("id", tableIds);
        if (tableError) throw tableError;
      }

      // Add Notification
      if (res.customer_id) {
        await supabase.from("notifications").insert({
          user_id: res.customer_id,
          title: "Reservasi Disetujui",
          message: `Reservasi Anda pada tanggal ${format(new Date(res.reservation_date), "dd MMM yyyy", { locale: localeId })} telah dikonfirmasi dan disetujui oleh kasir.`,
          type: "reservation",
          status_badge: "dikonfirmasi"
        });
      }

      // Trigger Email Notification (realtime, async)
      fetch("/api/reservations/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: res.id, status: "confirmed" })
      }).catch(err => console.error("Gagal mengirim email reservasi:", err));

      toast.success("Reservasi berhasil dikonfirmasi! Meja telah ditandai RESERVED.");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId) return;
    if (!rejectReason) return toast.error("Masukkan alasan penolakan");

    try {
      const res = reservations.find(r => r.id === rejectingId);
      const parsedNotes = getParsedNotes(res.notes);
      const tableIds = parsedNotes?.meja_ids || [res.table_id];

      // Update reservation status and notes with reject reason
      const updatedNotes = parsedNotes 
        ? JSON.stringify({ ...parsedNotes, catatan_tolak: rejectReason, dibatalkan_oleh: "kasir" })
        : JSON.stringify({ catatan_tolak: rejectReason, dibatalkan_oleh: "kasir" });

      const { error: resError } = await supabase.from("reservations").update({ status: "cancelled", notes: updatedNotes }).eq("id", rejectingId);
      if (resError) throw resError;

      // Set tables back to 'available' if they were reserved
      if (tableIds && tableIds.length > 0) {
        await supabase.from("tables").update({ status: "available" }).in("id", tableIds);
      }

      // Add Notification
      if (res.customer_id) {
        await supabase.from("notifications").insert({
          user_id: res.customer_id,
          title: "Reservasi Ditolak/Batal",
          message: `Reservasi Anda pada tanggal ${format(new Date(res.reservation_date), "dd MMM yyyy", { locale: localeId })} ditolak oleh kasir dengan alasan: ${rejectReason}`,
          type: "reservation",
          status_badge: "dibatalkan"
        });
      }

      // Trigger Email Notification (realtime, async)
      fetch("/api/reservations/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: rejectingId, status: "cancelled" })
      }).catch(err => console.error("Gagal mengirim email reservasi:", err));

      toast.success("Reservasi telah ditolak.");
      setRejectingId(null);
      setRejectReason("");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleComplete = async (res: any) => {
    try {
      const parsedNotes = getParsedNotes(res.notes);
      const tableIds = parsedNotes?.meja_ids || [res.table_id];

      // Update reservation status
      const { error: resError } = await supabase.from("reservations").update({ status: "completed" }).eq("id", res.id);
      if (resError) throw resError;

      // Update tables back to 'available' automatically, NOT occupied!
      if (tableIds && tableIds.length > 0) {
        const { error: tableError } = await supabase.from("tables").update({ status: "available" }).in("id", tableIds);
        if (tableError) throw tableError;
      }

      // Add Notification
      if (res.customer_id) {
        await supabase.from("notifications").insert({
          user_id: res.customer_id,
          title: "Reservasi Selesai",
          message: `Reservasi Anda pada tanggal ${format(new Date(res.reservation_date), "dd MMM yyyy", { locale: localeId })} telah ditandai selesai. Terima kasih atas kunjungan Anda!`,
          type: "reservation",
          status_badge: "selesai"
        });
      }

      // Trigger Email Notification (realtime, async)
      fetch("/api/reservations/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: res.id, status: "completed" })
      }).catch(err => console.error("Gagal mengirim email reservasi:", err));

      toast.success("Reservasi selesai! Meja kembali READY (Tersedia).");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleCashierBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookForm.date) return toast.error("Pilih tanggal");
    if (selectedTableIds.length === 0) return toast.error("Pilih minimal satu meja");
    if (!bookForm.atasNama) return toast.error("Masukkan nama");

    const selectedTables = tables.filter(t => selectedTableIds.includes(t.id));
    const totalCapacity = selectedTables.reduce((sum, t) => sum + t.capacity, 0);
    if (totalCapacity < bookForm.guests) {
      return toast.error(`Kapasitas meja terpilih (${totalCapacity} orang) tidak mencukupi untuk jumlah tamu (${bookForm.guests} orang). Silakan pilih meja tambahan.`);
    }

    setBookingSubmit(true);
    try {
      // Atomic double-check to avoid race condition/double-booking
      const { data: resList, error: checkError } = await supabase
        .from("reservations")
        .select("id, table_id, notes, status, reservation_time")
        .eq("reservation_date", bookForm.date)
        .in("status", ["pending", "confirmed"]);

      if (checkError) throw checkError;

      const currentlyBookedIds: string[] = [];
      resList?.forEach(res => {
        if (res.reservation_time && isTimeOverlapping(res.reservation_time, bookForm.time, durationMinutes)) {
          if (res.table_id) currentlyBookedIds.push(res.table_id);
          try {
            const parsedNotes = JSON.parse(res.notes);
            if (parsedNotes && Array.isArray(parsedNotes.meja_ids)) {
              parsedNotes.meja_ids.forEach((id: string) => {
                if (!currentlyBookedIds.includes(id)) {
                  currentlyBookedIds.push(id);
                }
              });
            }
          } catch (err) {}
        }
      });

      const hasConflict = selectedTableIds.some(id => currentlyBookedIds.includes(id));
      if (hasConflict) {
        const conflictTables = tables.filter(t => selectedTableIds.includes(t.id) && currentlyBookedIds.includes(t.id));
        const conflictNumbers = conflictTables.map(t => `Meja ${t.table_number}`).join(", ");
        throw new Error(`Maaf, ${conflictNumbers} sudah dibooking pada tanggal dan jam tersebut. Silakan pilih meja lain yang masih tersedia.`);
      }

      const structuredNotes = JSON.stringify({
        atas_nama: bookForm.atasNama,
        telepon: bookForm.telepon,
        meja_tambahan: selectedTables.map(t => t.table_number),
        meja_ids: selectedTableIds,
        catatan: bookForm.notes
      });

      const { error } = await supabase.from("reservations").insert({
        customer_id: null, // Cashier booked walk-in/phone reservasi
        table_id: selectedTableIds[0],
        reservation_date: bookForm.date,
        reservation_time: bookForm.time,
        guest_count: bookForm.guests,
        notes: structuredNotes,
        status: "pending",
      });
      if (error) throw error;

      toast.success("Reservasi berhasil dibuat!");
      setShowBookModal(false);
      setBookForm({ atasNama: "", telepon: "", date: "", time: "12:00", guests: 2, notes: "" });
      setSelectedTableIds([]);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBookingSubmit(false);
    }
  };

  const statusBadge: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  };

  const filtered = reservations.filter(r => filter === "all" || r.status === filter);

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <button onClick={() => window.history.back()} className="flex items-center gap-2 text-sm font-bold text-muted hover:text-primary transition-all">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Sebelumnya
      </button>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Manajemen Reservasi</h1>
          <p className="text-muted mt-1">Kelola dan verifikasi pengajuan observasi meja pelanggan secara realtime</p>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowBookModal(true)} className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/20">
          <Plus className="w-5 h-5" /> Reservasi Baru
        </motion.button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { s: "pending", l: "Menunggu", c: "from-yellow-400 to-amber-500" },
          { s: "confirmed", l: "Sedang Observasi", c: "from-green-500 to-emerald-600" },
          { s: "completed", l: "Selesai", c: "from-blue-500 to-blue-600" },
          { s: "cancelled", l: "Ditolak / Batal", c: "from-red-500 to-rose-600" }
        ].map(item => (
          <motion.div key={item.s} whileHover={{ y: -2 }} onClick={() => setFilter(item.s)} className={`bg-gradient-to-br ${item.c} rounded-2xl p-5 text-white shadow-lg cursor-pointer transition-all flex flex-col items-center justify-center text-center ${filter === item.s ? "ring-4 ring-primary" : ""}`}>
            <p className="text-white/80 text-sm font-semibold leading-tight">{item.l}</p>
            <p className="text-3xl font-black mt-1">{reservations.filter(r => r.status === item.s).length}</p>
          </motion.div>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((res, i) => {
          const parsedNotes = getParsedNotes(res.notes);
          const customerName = parsedNotes ? parsedNotes.atas_nama : (res.profiles?.full_name || "Guest");
          const displayMejaList = parsedNotes?.meja_tambahan ? parsedNotes.meja_tambahan.join(", ") : res.tables?.table_number;

          return (
            <motion.div key={res.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-xl text-center min-w-[65px]">
                    <p className="text-xs text-primary font-medium">{format(new Date(res.reservation_date), "MMM", { locale: localeId })}</p>
                    <p className="text-xl font-black text-primary">{format(new Date(res.reservation_date), "dd")}</p>
                  </div>
                  <div>
                    <p className="font-bold text-text-light dark:text-text-dark text-base">Atas Nama: {customerName}</p>
                    <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted">
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {res.reservation_time?.substring(0, 5)}</span>
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {res.guest_count} Orang</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Meja: {displayMejaList}</span>
                      {(parsedNotes?.telepon || res.profiles?.phone) && (
                        <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {parsedNotes?.telepon || res.profiles?.phone}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs uppercase font-bold px-3 py-1.5 rounded-lg ${statusBadge[res.status]}`}>
                    {res.status === "pending" ? "Menunggu" : res.status === "confirmed" ? "Aktif" : res.status === "cancelled" ? "Batal" : "Selesai"}
                  </span>
                  
                  {/* Detail Button */}
                  <button onClick={() => setSelectedRes(res)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-primary" title="Tampilkan Data Pemesan">
                    <Eye className="w-5 h-5" />
                  </button>

                  {res.status === "pending" && (
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleConfirm(res)} className="p-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg" aria-label="Konfirmasi" title="Konfirmasi / ACC"><Check className="w-5 h-5" /></motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setRejectingId(res.id)} className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg" aria-label="Tolak" title="Tolak dengan Alasan"><X className="w-5 h-5" /></motion.button>
                    </div>
                  )}
                  {res.status === "confirmed" && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleComplete(res)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10">Selesai Observasi</motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <CalendarDays className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
            <p className="text-muted">Tidak ada pengajuan reservasi di kategori ini.</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <BaseModal
        isOpen={!!selectedRes}
        onClose={() => setSelectedRes(null)}
        showCloseButton={false}
        noPadding
        size="md"
      >
        {selectedRes && (() => {
          const parsed = getParsedNotes(selectedRes.notes);
          const clientName = parsed ? parsed.atas_nama : (selectedRes.profiles?.full_name || "Guest");
          const clientPhone = parsed ? parsed.telepon : (selectedRes.profiles?.phone || "-");
          const mejaNumbers = parsed?.meja_tambahan ? parsed.meja_tambahan.join(", ") : selectedRes.tables?.table_number;
          const notesText = parsed ? parsed.catatan : selectedRes.notes;

          return (
            <>
              <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                <h3 className="font-bold text-lg text-text-light dark:text-text-dark">Data Diri Pemesan</h3>
                <button onClick={() => setSelectedRes(null)} title="Tutup" aria-label="Tutup" className="text-muted hover:text-text-light"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <span className="text-xs text-muted uppercase font-bold tracking-wider">Atas Nama</span>
                  <p className="font-black text-lg text-text-light dark:text-text-dark">{clientName}</p>
                </div>
                <div>
                  <span className="text-xs text-muted uppercase font-bold tracking-wider">Nomor Telepon</span>
                  <p className="font-bold text-text-light dark:text-text-dark">{clientPhone}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted uppercase font-bold tracking-wider">Tanggal</span>
                    <p className="font-medium text-text-light dark:text-text-dark">{format(new Date(selectedRes.reservation_date), "dd MMM yyyy", { locale: localeId })}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted uppercase font-bold tracking-wider">Waktu</span>
                    <p className="font-medium text-text-light dark:text-text-dark">{selectedRes.reservation_time?.substring(0, 5)} WIB</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted uppercase font-bold tracking-wider">Meja</span>
                    <p className="font-bold text-primary text-base">Meja {mejaNumbers}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted uppercase font-bold tracking-wider">Tamu</span>
                    <p className="font-medium text-text-light dark:text-text-dark">{selectedRes.guest_count} Orang</p>
                  </div>
                </div>
                {notesText && (
                  <div>
                    <span className="text-xs text-muted uppercase font-bold tracking-wider">Catatan Tambahan</span>
                    <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark mt-1">{notesText}</p>
                  </div>
                )}
                {parsed?.catatan_tolak && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-xl border border-red-200">
                    <span className="text-xs font-bold uppercase block mb-1">Alasan Penolakan</span>
                    <p className="text-sm">{parsed.catatan_tolak}</p>
                  </div>
                )}
                {parsed?.catatan_batal && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-xl border border-red-200">
                    <span className="text-xs font-bold uppercase block mb-1">Alasan Pembatalan (Pelanggan)</span>
                    <p className="text-sm">{parsed.catatan_batal}</p>
                  </div>
                )}
              </div>
            </>
          );
        })()}
      </BaseModal>

      {/* Reject Reason Modal */}
      <BaseModal
        isOpen={!!rejectingId}
        onClose={() => setRejectingId(null)}
        showCloseButton={true}
        size="sm"
      >
        <h3 className="font-bold text-lg text-text-light dark:text-text-dark mb-4 flex items-center gap-2 text-red-600">
          <MessageSquare className="w-5 h-5" /> Tolak Reservasi
        </h3>
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <div>
            <label htmlFor="rejectReasonInput" className="text-xs text-muted font-bold block mb-1 uppercase">Alasan Penolakan</label>
            <textarea
              id="rejectReasonInput"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Contoh: Meja sedang dipakai acara khusus, restoran penuh, dll..."
              className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-text-light dark:text-text-dark"
              rows={3}
              required
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setRejectingId(null)} className="flex-1 py-3 border border-border-light dark:border-border-dark rounded-xl text-sm font-medium">Batal</button>
            <button type="submit" className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-500/10">Kirim Penolakan</button>
          </div>
        </form>
      </BaseModal>

      {/* Cashier Book on behalf modal */}
      <BaseModal
        isOpen={showBookModal}
        onClose={() => setShowBookModal(false)}
        showCloseButton={false}
        noPadding
        size="xl"
      >
        <div className="bg-primary p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Buat Reservasi Baru</h2>
            <p className="text-white/80 text-sm mt-1">Isi data dan pilih beberapa meja jika diperlukan</p>
          </div>
          <button onClick={() => setShowBookModal(false)} title="Tutup" aria-label="Tutup" className="p-1 hover:bg-white/10 rounded-full text-white"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleCashierBook} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cashierAtasNama" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Atas Nama</label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
                <input id="cashierAtasNama" type="text" value={bookForm.atasNama} onChange={e => setBookForm({ ...bookForm, atasNama: e.target.value })} placeholder="Masukkan nama pelanggan..." className="w-full pl-9 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" required />
              </div>
            </div>
            <div>
              <label htmlFor="cashierTelepon" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Nomor Telepon</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
                <input id="cashierTelepon" type="tel" value={bookForm.telepon} onChange={e => setBookForm({ ...bookForm, telepon: e.target.value })} placeholder="Contoh: 081234567" className="w-full pl-9 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" required />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="cashierDate" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Tanggal</label>
              <input id="cashierDate" title="Tanggal Reservasi" type="date" value={bookForm.date} onChange={e => setBookForm({ ...bookForm, date: e.target.value })} min={new Date().toISOString().split("T")[0]} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" required />
            </div>
            <div>
              <label htmlFor="cashierTime" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Waktu</label>
              <input id="cashierTime" title="Waktu Reservasi" type="time" value={bookForm.time} onChange={e => setBookForm({ ...bookForm, time: e.target.value })} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" required />
            </div>
          </div>

          <div>
            <label htmlFor="cashierGuests" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Jumlah Tamu</label>
            <input id="cashierGuests" title="Jumlah Tamu" type="number" value={bookForm.guests} onChange={e => setBookForm({ ...bookForm, guests: parseInt(e.target.value) })} min={1} max={50} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" required />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-text-light dark:text-text-dark">Pilih Meja (Bisa pilih lebih dari satu)</label>
              {bookForm.date && bookForm.time && (
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                  tables.filter(t => selectedTableIds.includes(t.id)).reduce((sum, t) => sum + t.capacity, 0) >= bookForm.guests
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                }`}>
                  Kapasitas Terpilih: {tables.filter(t => selectedTableIds.includes(t.id)).reduce((sum, t) => sum + t.capacity, 0)} / {bookForm.guests} Orang
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {tables.map(t => {
                const bookedStatus = bookedTablesInfo[t.id];
                const isBooked = !!bookedStatus;
                const isSelected = selectedTableIds.includes(t.id);
                
                let borderClass = "border-border-light dark:border-border-dark text-muted hover:border-gray-300";
                let bgClass = "bg-background-light dark:bg-background-dark";
                let statusText = `Cap: ${t.capacity} org`;
                let textClass = "";

                if (isSelected) {
                  borderClass = "border-primary text-primary";
                  bgClass = "bg-primary/10";
                  textClass = "text-primary font-bold";
                } else if (isBooked) {
                  if (bookedStatus === "confirmed") {
                    borderClass = "border-red-500/50 text-red-500 opacity-60 cursor-not-allowed";
                    bgClass = "bg-red-500/5";
                    statusText = "Dibooking";
                    textClass = "text-red-500 font-bold";
                  } else {
                    borderClass = "border-amber-500/50 text-amber-500 opacity-60 cursor-not-allowed";
                    bgClass = "bg-amber-500/5";
                    statusText = "Menunggu";
                    textClass = "text-amber-555 font-bold";
                  }
                }

                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => {
                      if (!isBooked) {
                        setSelectedTableIds(prev =>
                          prev.includes(t.id) ? prev.filter(item => item !== t.id) : [...prev, t.id]
                        );
                      }
                    }}
                    disabled={isBooked}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${bgClass} ${borderClass}`}
                  >
                    <span className={`font-black text-lg ${textClass || "text-text-light dark:text-text-dark"}`}>Meja {t.table_number}</span>
                    <span className={`text-[10px] font-bold mt-1 ${textClass || "text-muted"}`}>{statusText}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="cashierNotes" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Catatan Tambahan (Opsional)</label>
            <textarea id="cashierNotes" title="Catatan" value={bookForm.notes} onChange={e => setBookForm({ ...bookForm, notes: e.target.value })} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" rows={2} placeholder="Keterangan tambahan..." />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
            <button type="button" onClick={() => setShowBookModal(false)} className="flex-1 py-3 border border-border-light dark:border-border-dark rounded-xl font-medium">Batal</button>
            <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={bookingSubmit} className="flex-1 py-3 bg-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
              {bookingSubmit ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Buat Reservasi</>}
            </motion.button>
          </div>
        </form>
      </BaseModal>
    </div>
  );
}
