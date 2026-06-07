"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Clock, Users, Plus, Loader2, X, MapPin, CheckCircle, Phone, User, History, Sparkles, AlertCircle, Ban, Trash2, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { SkeletonOrderItem } from "@/components/Skeleton";
import BaseModal from "@/components/BaseModal";

interface Reservation {
  id: string;
  table_id: string;
  reservation_date: string;
  reservation_time: string;
  guest_count: number;
  status: string;
  notes: string;
  tables: { table_number: number; capacity: number } | null;
  created_at: string;
  qr_token?: string;
}

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
}

const ACTIVE_STATUSES = ["pending", "confirmed", "arrived", "seated"];
const HISTORY_STATUSES = ["cancelled", "completed", "rejected"];

export default function CustomerReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [profileId, setProfileId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [form, setForm] = useState({
    date: "",
    time: "12:00",
    guests: 2,
    notes: "",
    atasNama: "",
    telepon: ""
  });
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const [selectedQrRes, setSelectedQrRes] = useState<Reservation | null>(null);
  const supabase = createClient();

  const getTodayStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [durationMinutes, setDurationMinutes] = useState<number>(120);
  const [bookedTablesInfo, setBookedTablesInfo] = useState<Record<string, "pending" | "confirmed">>({});

  useEffect(() => { 
    fetchData(); 

    const channel = supabase.channel("customer-reservations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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

  const fetchData = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;
      const { data: profile } = await supabase.from("profiles").select("id, full_name, phone").eq("user_id", session.session.user.id).single();
      if (!profile) return;
      setProfileId(profile.id);
      setForm(f => ({ ...f, atasNama: profile.full_name || "", telepon: profile.phone || "" }));

      const { data } = await supabase.from("reservations").select("*, tables(table_number, capacity)").eq("customer_id", profile.id).order("reservation_date", { ascending: false });
      setReservations(data || []);

      // Fetch all tables so that tables occupied right now can still be reserved for tomorrow/future dates
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

  // Real-time table availability check based on selected date & time
  useEffect(() => {
    if (!showModal || !form.date || !form.time) return;

    const fetchBookedTables = async () => {
      try {
        const { data: resList, error } = await supabase
          .from("reservations")
          .select("id, table_id, notes, status, reservation_time")
          .eq("reservation_date", form.date)
          .in("status", ["pending", "confirmed"]);

        if (error) throw error;

        const bookedInfo: Record<string, "pending" | "confirmed"> = {};
        resList?.forEach(res => {
          if (res.reservation_time && isTimeOverlapping(res.reservation_time, form.time, durationMinutes)) {
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

    const channel = supabase.channel("modal-reservations-realtime-check")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        fetchBookedTables();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [form.date, form.time, showModal, durationMinutes]);

  // Clear selected tables if they become booked/conflicting due to date/time changes
  useEffect(() => {
    if (selectedTableIds.length > 0 && Object.keys(bookedTablesInfo).length > 0) {
      setSelectedTableIds(prev => prev.filter(id => !bookedTablesInfo[id]));
    }
  }, [bookedTablesInfo]);

  const handleTableToggle = (id: string) => {
    setSelectedTableIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) return toast.error("Pilih tanggal reservasi");
    if (selectedTableIds.length === 0) return toast.error("Pilih setidaknya satu meja");
    if (!form.atasNama) return toast.error("Masukkan nama lengkap atas nama");
    if (!form.telepon) return toast.error("Masukkan nomor telepon");

    // Validate past Date & Time (WIB)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const dateObj = new Date(form.date + "T00:00:00");
    const formattedDate = format(dateObj, "d MMMM yyyy", { locale: localeId });

    if (form.date < todayStr) {
      return toast.error(`Tanggal reservasi yang Anda pilih (${formattedDate}) sudah terlewat. Silakan pilih tanggal hari ini atau tanggal lainnya.`);
    }

    if (form.date === todayStr) {
      const currentHours = today.getHours();
      const currentMinutes = today.getMinutes();
      const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;
      if (form.time < currentTimeStr) {
        return toast.error(`Waktu reservasi yang Anda pilih (${form.time} WIB) untuk tanggal hari ini (${formattedDate}) sudah terlewat. Silakan masukkan jam yang lain atau ganti tanggal.`);
      }
    }

    const selectedTables = tables.filter(t => selectedTableIds.includes(t.id));
    const totalCapacity = selectedTables.reduce((sum, t) => sum + t.capacity, 0);
    if (totalCapacity < form.guests) {
      return toast.error(`Kapasitas meja terpilih (${totalCapacity} orang) tidak mencukupi untuk jumlah tamu (${form.guests} orang). Silakan pilih meja tambahan.`);
    }

    setSubmitting(true);
    try {
      // Atomic double-check to avoid race condition/double-booking
      const { data: resList, error: checkError } = await supabase
        .from("reservations")
        .select("id, table_id, notes, status, reservation_time")
        .eq("reservation_date", form.date)
        .in("status", ["pending", "confirmed"]);

      if (checkError) throw checkError;

      const currentlyBookedIds: string[] = [];
      resList?.forEach(res => {
        if (res.reservation_time && isTimeOverlapping(res.reservation_time, form.time, durationMinutes)) {
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
        atas_nama: form.atasNama,
        telepon: form.telepon,
        meja_tambahan: selectedTables.map(t => t.table_number),
        meja_ids: selectedTableIds,
        catatan: form.notes
      });

      const { data: newRes, error } = await supabase.from("reservations").insert({
        customer_id: profileId,
        table_id: selectedTableIds[0], // primary table
        reservation_date: form.date,
        reservation_time: form.time,
        guest_count: form.guests,
        notes: structuredNotes,
        status: "pending",
      }).select().single();
      if (error) throw error;

      // Add Notification
      await supabase.from("notifications").insert({
        user_id: profileId,
        title: "Reservasi Baru Diajukan",
        message: `Reservasi atas nama ${form.atasNama} pada tanggal ${format(new Date(form.date), "dd MMM yyyy")} meja ${selectedTables.map(t => t.table_number).join(", ")} sedang menunggu konfirmasi kasir.`,
        type: "reservation",
        status_badge: "menunggu konfirmasi"
      });

      // Trigger Email Notification (realtime, async)
      if (newRes?.id) {
        fetch("/api/reservations/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId: newRes.id, status: "pending" })
        }).catch(err => console.error("Gagal mengirim email reservasi:", err));
      }

      toast.success("Reservasi berhasil diajukan! Menunggu konfirmasi kasir.");
      setShowModal(false);
      setForm({ date: "", time: "12:00", guests: 2, notes: "", atasNama: form.atasNama, telepon: form.telepon });
      setSelectedTableIds([]);
      fetchData();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingId) return;
    if (!cancelReason.trim()) return toast.error("Masukkan alasan pembatalan");

    setCancelling(true);
    try {
      const res = reservations.find(r => r.id === cancellingId);
      if (!res) throw new Error("Reservasi tidak ditemukan");

      const parsedNotes = getParsedNotes(res.notes);
      const tableIds = parsedNotes?.meja_ids || [res.table_id];

      // Update reservation status and notes with cancellation reason
      const updatedNotes = parsedNotes
        ? JSON.stringify({ ...parsedNotes, catatan_batal: cancelReason, dibatalkan_oleh: "pelanggan" })
        : JSON.stringify({ catatan_batal: cancelReason, dibatalkan_oleh: "pelanggan" });

      const { error: resError } = await supabase
        .from("reservations")
        .update({ status: "cancelled", notes: updatedNotes })
        .eq("id", cancellingId);
      
      if (resError) throw resError;

      // Set tables back to 'available'
      if (tableIds && tableIds.length > 0) {
        const { error: tableError } = await supabase
          .from("tables")
          .update({ status: "available" })
          .in("id", tableIds);
        if (tableError) console.error("Gagal mengembalikan status meja:", tableError.message);
      }

      // Add Notification
      await supabase.from("notifications").insert({
        user_id: profileId,
        title: "Reservasi Dibatalkan",
        message: `Reservasi atas nama ${parsedNotes?.atas_nama || "Pelanggan"} pada tanggal ${format(new Date(res.reservation_date), "dd MMM yyyy", { locale: localeId })} telah dibatalkan oleh pelanggan. Alasan: ${cancelReason}`,
        type: "reservation",
        status_badge: "dibatalkan"
      });

      // Trigger Email Notification (realtime, awaited)
      try {
        await fetch("/api/reservations/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId: cancellingId, status: "cancelled" })
        });
      } catch (err) {
        console.error("Gagal mengirim email reservasi:", err);
      }

      // Trigger Google Calendar sync (awaited)
      try {
        await fetch("/api/reservations/sync-calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId: cancellingId, action: "delete" })
        });
      } catch (err) {
        console.error("Gagal sinkronisasi pembatalan kalender:", err);
      }

      toast.success("Reservasi berhasil dibatalkan");
      setCancellingId(null);
      setCancelReason("");
      fetchData();
    } catch (err: any) {
      toast.error("Gagal membatalkan: " + err.message);
    } finally {
      setCancelling(false);
    }
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      const { error } = await supabase.from("reservations").delete().eq("id", id);
      if (error) throw error;
      toast.success("Riwayat reservasi berhasil dihapus!");
      fetchData();
    } catch (err: any) {
      toast.error("Gagal menghapus riwayat: " + err.message);
    }
  };

  const getParsedNotes = (notesStr: string) => {
    if (!notesStr) return { atas_nama: "", telepon: "", catatan: "", meja_tambahan: [], meja_ids: [] };
    try {
      const parsed = JSON.parse(notesStr);
      if (parsed && typeof parsed === "object") {
        const note = parsed.catatan || parsed.catatan_batal || "";
        const cleanNote = note.trim();
        const finalNote = (cleanNote === "-" || cleanNote === "_" || cleanNote === "") ? "" : cleanNote;
        return {
          ...parsed,
          atas_nama: parsed.atas_nama || "",
          telepon: parsed.telepon || "",
          meja_tambahan: parsed.meja_tambahan || [],
          meja_ids: parsed.meja_ids || [],
          catatan: finalNote
        };
      }
    } catch (e) {}
    const cleanStr = notesStr.trim();
    const finalStr = (cleanStr === "-" || cleanStr === "_" || cleanStr === "") ? "" : cleanStr;
    return { atas_nama: "", telepon: "", catatan: finalStr, meja_tambahan: [], meja_ids: [] };
  };

  const getStatusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      arrived: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
      seated: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      rejected: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    };
    return map[s] || "bg-gray-100 text-gray-800";
  };

  const getStatusText = (s: string) => {
    const map: Record<string, string> = { 
      pending: "Menunggu", 
      confirmed: "Aktif & Belum Check-In", 
      arrived: "Sudah Check-In & Proses Sedang Berjalan",
      seated: "Sudah Check-In & Proses Sedang Berjalan",
      cancelled: "Dibatalkan", 
      completed: "Selesai",
      rejected: "Ditolak"
    };
    return map[s] || s;
  };

  const getCancelledByLabel = (parsedNotes: any) => {
    let dibatalkanOleh = parsedNotes?.dibatalkan_oleh;
    if (!dibatalkanOleh) {
      if (parsedNotes?.catatan_tolak) {
        dibatalkanOleh = "kasir";
      } else if (parsedNotes?.catatan_batal) {
        dibatalkanOleh = "pelanggan";
      } else {
        return null;
      }
    }
    const byMap: Record<string, { label: string; color: string }> = {
      pelanggan: { label: "Dibatalkan oleh Anda", color: "text-orange-600 dark:text-orange-400" },
      kasir: { label: "Dibatalkan oleh Kasir", color: "text-red-600 dark:text-red-400" },
      admin: { label: "Dibatalkan oleh Admin", color: "text-red-700 dark:text-red-500" },
    };
    return byMap[dibatalkanOleh] || { label: `Dibatalkan oleh ${dibatalkanOleh}`, color: "text-red-600 dark:text-red-400" };
  };

  const activeReservations = reservations.filter(r => ACTIVE_STATUSES.includes(r.status));
  const historyReservations = reservations.filter(r => HISTORY_STATUSES.includes(r.status));
  const displayedReservations = activeTab === "active" ? activeReservations : historyReservations;

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-center mb-8 animate-pulse">
          <div className="space-y-2.5 w-64">
            <div className="h-8 bg-gray-250 dark:bg-gray-750 rounded-xl w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-xl w-1/2" />
          </div>
          <div className="h-11 bg-gray-250 dark:bg-gray-750 rounded-xl w-32" />
        </div>
        <div className="space-y-4">
          <SkeletonOrderItem />
          <SkeletonOrderItem />
          <SkeletonOrderItem />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-light dark:text-text-dark leading-tight">Reservasi Meja</h1>
          <p className="text-muted mt-1 text-sm sm:text-base">Ajukan dan pantau reservasi meja Anda</p>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/20 shrink-0 self-start sm:self-auto">
          <Plus className="w-5 h-5" /> Ajukan Reservasi
        </motion.button>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-gray-100 dark:bg-gray-800/60 p-1.5 rounded-2xl gap-2">
        <button
          onClick={() => setActiveTab("active")}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === "active"
              ? "bg-white dark:bg-gray-700 shadow-md text-primary"
              : "text-muted hover:text-text-light dark:hover:text-text-dark"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Reservasi Aktif
          {activeReservations.length > 0 && (
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${activeTab === "active" ? "bg-primary text-white" : "bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300"}`}>
              {activeReservations.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === "history"
              ? "bg-white dark:bg-gray-700 shadow-md text-text-light dark:text-text-dark"
              : "text-muted hover:text-text-light dark:hover:text-text-dark"
          }`}
        >
          <History className="w-4 h-4" />
          Riwayat
        </button>
      </div>

      {/* Reservation Cards */}
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {displayedReservations.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center py-20">
              {activeTab === "active" ? (
                <>
                  <CalendarDays className="w-16 h-16 text-muted mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-medium text-text-light dark:text-text-dark">Tidak Ada Reservasi Aktif</h3>
                  <p className="text-muted mt-2">Buat reservasi baru untuk memesan meja!</p>
                </>
              ) : (
                <>
                  <History className="w-16 h-16 text-muted mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-medium text-text-light dark:text-text-dark">Belum Ada Riwayat</h3>
                  <p className="text-muted mt-2">Riwayat reservasi Anda akan tampil di sini.</p>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {displayedReservations.map((res, i) => {
                const parsedNotes = getParsedNotes(res.notes);
                const displayNotes = parsedNotes.catatan;
                const displayAtasNama = parsedNotes.atas_nama || null;
                const displayMejaList = parsedNotes.meja_tambahan && parsedNotes.meja_tambahan.length > 0 
                  ? parsedNotes.meja_tambahan.join(", ") 
                  : res.tables?.table_number;
                const cancelledByInfo = getCancelledByLabel(parsedNotes);
                const isHistory = HISTORY_STATUSES.includes(res.status);

                return (
                  <motion.div 
                    key={res.id} 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: i * 0.05 }} 
                    className={`bg-card-light dark:bg-card-dark rounded-2xl border p-5 sm:p-6 shadow-sm ${
                      isHistory 
                        ? "border-border-light dark:border-border-dark opacity-80" 
                        : "border-border-light dark:border-border-dark"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`p-4 rounded-xl text-center min-w-[70px] shrink-0 ${isHistory ? "bg-gray-100 dark:bg-gray-800" : "bg-primary/10"}`}>
                          <p className={`text-xs font-medium uppercase ${isHistory ? "text-muted" : "text-primary"}`}>{format(new Date(res.reservation_date), "MMM", { locale: localeId })}</p>
                          <p className={`text-2xl font-bold ${isHistory ? "text-muted" : "text-primary"}`}>{format(new Date(res.reservation_date), "dd")}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-text-light dark:text-text-dark text-lg truncate">
                            {displayAtasNama ? `Atas Nama: ${displayAtasNama}` : format(new Date(res.reservation_date), "EEEE, dd MMMM yyyy", { locale: localeId })}
                          </p>
                          {displayAtasNama && (
                            <p className="text-sm text-muted mb-1">{format(new Date(res.reservation_date), "EEEE, dd MMMM yyyy", { locale: localeId })}</p>
                          )}
                          <div className="flex flex-wrap gap-3 text-sm text-muted">
                            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {res.reservation_time?.substring(0, 5)}</span>
                            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {res.guest_count} Orang</span>
                            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> Meja: {displayMejaList}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {["confirmed", "arrived", "seated"].includes(res.status) && (
                          <motion.button 
                            whileHover={{ scale: 1.05 }} 
                            whileTap={{ scale: 0.95 }} 
                            onClick={() => setSelectedQrRes(res)} 
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white hover:bg-primary-hover rounded-xl font-bold text-xs shadow-md shadow-primary/10 transition-all"
                            title="Tampilkan QR Code Check-In"
                          >
                            <QrCode className="w-4 h-4" /> Tampilkan QR
                          </motion.button>
                        )}
                        <span className={`text-xs uppercase font-bold px-3 py-1.5 rounded-lg ${getStatusBadge(res.status)}`}>{getStatusText(res.status)}</span>
                        {res.status === "pending" && (
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setCancellingId(res.id); setCancelReason(""); }} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors" aria-label="Batalkan Reservasi" title="Batalkan Reservasi">
                            <X className="w-5 h-5" />
                          </motion.button>
                        )}
                        {isHistory && (
                          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setDeletingHistoryId(res.id)} className="text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 p-2 rounded-lg transition-colors" aria-label="Hapus Riwayat" title="Hapus Riwayat">
                            <Trash2 className="w-5 h-5" />
                          </motion.button>
                        )}
                      </div>
                    </div>
                    
                    {displayNotes && (
                      <p className="mt-3 text-sm text-muted bg-background-light dark:bg-background-dark p-3 rounded-lg">
                        <span className="font-bold">Catatan:</span> {displayNotes}
                      </p>
                    )}
                    
                    {/* Cancelled by info */}
                    {res.status === "cancelled" && cancelledByInfo && (
                      <div className="mt-2 flex items-center gap-2 text-xs font-semibold">
                        <Ban className={`w-3.5 h-3.5 ${cancelledByInfo.color}`} />
                        <span className={cancelledByInfo.color}>{cancelledByInfo.label}</span>
                      </div>
                    )}

                    {parsedNotes?.catatan_batal && (
                      <p className="mt-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                        <span className="font-bold">Alasan Pembatalan:</span> {parsedNotes.catatan_batal}
                      </p>
                    )}
                    {parsedNotes?.catatan_tolak && (
                      <p className="mt-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                        <span className="font-bold">Alasan Penolakan:</span> {parsedNotes.catatan_tolak}
                      </p>
                    )}
                    {parsedNotes?.telepon && <p className="mt-2 text-xs text-muted">No. Telepon: {parsedNotes.telepon}</p>}

                    {/* Status label for history */}
                    {isHistory && (
                      <div className="mt-3 pt-3 border-t border-border-light dark:border-border-dark flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-muted shrink-0" />
                        <p className="text-xs text-muted">
                          {res.status === "completed" && "Reservasi ini telah selesai."}
                          {res.status === "cancelled" && "Reservasi ini telah dibatalkan."}
                          {res.status === "rejected" && "Reservasi ini ditolak oleh kasir."}
                        </p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal Ajukan Reservasi */}
      <BaseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        showCloseButton={false}
        size="lg"
        noPadding
      >
        <div className="bg-primary p-6 text-white flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">Ajukan Reservasi Meja</h2>
            <p className="text-white/80 text-sm mt-1">Lengkapi informasi diri & pilih meja bebas</p>
          </div>
          <button onClick={() => setShowModal(false)} title="Tutup" aria-label="Tutup" className="p-1 hover:bg-white/10 rounded-full text-white"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 pt-0 sm:pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="atasNama" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Atas Nama</label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
                <input id="atasNama" type="text" value={form.atasNama} onChange={e => setForm({ ...form, atasNama: e.target.value })} placeholder="Masukkan nama pemesan..." className="w-full pl-9 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none text-text-light dark:text-text-dark" required />
              </div>
            </div>
            <div>
              <label htmlFor="telepon" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Nomor Telepon</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
                <input id="telepon" type="tel" value={form.telepon} onChange={e => setForm({ ...form, telepon: e.target.value })} placeholder="Contoh: 08123456789" className="w-full pl-9 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none text-text-light dark:text-text-dark" required />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="resDate" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Tanggal</label>
              <input id="resDate" title="Tanggal Reservasi" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} min={getTodayStr()} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none text-text-light dark:text-text-dark" required />
            </div>
            <div>
              <label htmlFor="resTime" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Waktu</label>
              <input id="resTime" title="Waktu Reservasi" type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none text-text-light dark:text-text-dark" required />
            </div>
          </div>

          <div>
            <label htmlFor="resGuests" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Jumlah Tamu</label>
            <input id="resGuests" title="Jumlah Tamu" type="number" value={form.guests} onChange={e => setForm({ ...form, guests: parseInt(e.target.value) })} min={1} max={50} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none text-text-light dark:text-text-dark" required />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-text-light dark:text-text-dark">Pilih Meja (Bisa pilih lebih dari satu)</label>
              {form.date && form.time && (
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                  tables.filter(t => selectedTableIds.includes(t.id)).reduce((sum, t) => sum + t.capacity, 0) >= form.guests
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                }`}>
                  Kapasitas Terpilih: {tables.filter(t => selectedTableIds.includes(t.id)).reduce((sum, t) => sum + t.capacity, 0)} / {form.guests} Orang
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
                    textClass = "text-amber-550 font-bold";
                  }
                }

                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => {
                      if (!isBooked) {
                        handleTableToggle(t.id);
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
            {tables.length === 0 && <p className="text-sm text-red-500">Tidak ada meja tersedia saat ini.</p>}
          </div>

          <div>
            <label htmlFor="resNotes" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Catatan Tambahan (Opsional)</label>
            <textarea id="resNotes" title="Catatan" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none text-text-light dark:text-text-dark" rows={2} placeholder="Contoh: Butuh colokan listrik, AC dingin, dll" />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 border border-border-light dark:border-border-dark rounded-xl font-medium text-text-light dark:text-text-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Batal</button>
            <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={submitting} className="flex-1 py-3 bg-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Ajukan Sekarang</>}
            </motion.button>
          </div>
        </form>
      </BaseModal>

      {/* Modal Pembatalan */}
      <BaseModal
        isOpen={!!cancellingId}
        onClose={() => setCancellingId(null)}
        showCloseButton={false}
        size="md"
        noPadding
      >
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white flex items-center gap-4 mb-6">
          <div className="p-3 bg-white/20 rounded-xl">
            <X className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Batalkan Reservasi</h2>
            <p className="text-white/80 text-sm">Berikan alasan pembatalan Anda</p>
          </div>
        </div>
        <form onSubmit={handleCancelSubmit} className="p-6 sm:p-8 pt-0 sm:pt-0 space-y-4">
          <div>
            <label htmlFor="cancelReason" className="text-sm font-medium text-text-light dark:text-text-dark mb-2 block">Alasan Pembatalan</label>
            <textarea
              id="cancelReason"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Tuliskan alasan Anda..."
              className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-text-light dark:text-text-dark min-h-[100px]"
              required
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setCancellingId(null)} className="flex-1 py-3 rounded-xl font-medium text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors bg-gray-50 dark:bg-gray-800 border border-border-light dark:border-border-dark">Kembali</button>
            <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={cancelling || !cancelReason.trim()} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 disabled:opacity-50">
              {cancelling ? <Loader2 className="w-5 h-5 animate-spin" /> : "Konfirmasi Batal"}
            </motion.button>
          </div>
        </form>
      </BaseModal>

      {/* Modal Konfirmasi Hapus Riwayat */}
      <BaseModal
        isOpen={!!deletingHistoryId}
        onClose={() => setDeletingHistoryId(null)}
        showCloseButton={false}
        size="md"
        noPadding
      >
        <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white flex items-center gap-4 mb-6">
          <div className="p-3 bg-white/20 rounded-xl">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Hapus Riwayat</h2>
            <p className="text-white/80 text-sm">Konfirmasi tindakan</p>
          </div>
        </div>
        <div className="p-6 sm:p-8 pt-0 sm:pt-0 space-y-4">
          <p className="text-sm text-text-light dark:text-text-dark leading-relaxed">
            Apakah Anda yakin ingin menghapus riwayat reservasi ini secara permanen dari akun Anda? Tindakan ini tidak dapat dibatalkan.
          </p>
          <div className="flex gap-3">
            <button 
              type="button" 
              onClick={() => setDeletingHistoryId(null)} 
              className="flex-1 py-3 rounded-xl font-medium text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800"
            >
              Batal
            </button>
            <motion.button 
              whileTap={{ scale: 0.98 }} 
              onClick={async () => {
                const id = deletingHistoryId;
                setDeletingHistoryId(null);
                if (id) {
                  await handleDeleteHistory(id);
                }
              }}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
            >
              Hapus
            </motion.button>
          </div>
        </div>
      </BaseModal>

      {/* Modal QR Code Check-In */}
      <BaseModal
        isOpen={!!selectedQrRes}
        onClose={() => setSelectedQrRes(null)}
        showCloseButton={false}
        size="md"
        noPadding
      >
        {selectedQrRes && (() => {
          const parsed = getParsedNotes(selectedQrRes.notes);
          const clientName = parsed.atas_nama || "Pelanggan";
          const displayMejaList = parsed.meja_tambahan && parsed.meja_tambahan.length > 0 ? parsed.meja_tambahan.join(", ") : selectedQrRes.tables?.table_number;
          const qrData = selectedQrRes.qr_token || selectedQrRes.id;

          return (
            <>
              <div className="bg-primary p-6 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">QR Code Check-In</h2>
                  <p className="text-white/80 text-sm mt-1">Gunakan kode ini untuk check-in meja</p>
                </div>
                <button onClick={() => setSelectedQrRes(null)} title="Tutup" aria-label="Tutup" className="p-1 hover:bg-white/10 rounded-full text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 sm:p-8 space-y-6 text-center text-text-light dark:text-text-dark">
                {/* QR Code Image */}
                <div className="bg-white p-4 rounded-2xl inline-block shadow-md mx-auto">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`}
                    alt="Check-In QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
                
                {/* Token Label */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Kode Booking</p>
                  <p className="font-mono font-black text-primary text-base select-all">{qrData}</p>
                </div>

                {/* Instructions */}
                <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl text-sm border border-primary/20 text-left">
                  <p className="text-primary font-bold text-center leading-relaxed">
                    Tunjukkan QR Code ini kepada kasir saat kedatangan untuk melakukan check-in meja Anda secara instan.
                  </p>
                </div>

                {/* Details */}
                <div className="border-t border-border-light dark:border-border-dark pt-4 space-y-3 text-sm text-left">
                  <h4 className="font-bold text-muted uppercase text-xs tracking-wider mb-2">Detail Reservasi</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted font-medium">Atas Nama</p>
                      <p className="font-bold">{clientName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted font-medium">Tanggal</p>
                      <p className="font-semibold">{format(new Date(selectedQrRes.reservation_date), "dd MMM yyyy", { locale: localeId })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted font-medium">Waktu</p>
                      <p className="font-semibold">{selectedQrRes.reservation_time?.substring(0, 5)} WIB</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted font-medium">Meja / Tamu</p>
                      <p className="font-bold text-primary">Meja {displayMejaList} ({selectedQrRes.guest_count} Tamu)</p>
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setSelectedQrRes(null)}
                  className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-text-light dark:text-text-dark rounded-xl font-medium transition-all"
                >
                  Tutup
                </button>
              </div>
            </>
          );
        })()}
      </BaseModal>
    </div>
  );
}
