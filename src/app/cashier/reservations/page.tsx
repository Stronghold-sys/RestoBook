"use client";

export const runtime = 'edge';

import { useEffect, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Check, X, Loader2, Clock, Users, MapPin, Phone, Eye, MessageSquare, Plus, User, CheckCircle, ArrowLeft, Ban, AlertCircle, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import BaseModal from "@/components/BaseModal";
import { useSearchParams } from "next/navigation";

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
}

function CashierReservationsContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");

  const [reservations, setReservations] = useState<any[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  // Detail Modal State
  const [selectedRes, setSelectedRes] = useState<any>(null);

  // Confirm Detail Modal State
  const [confirmingRes, setConfirmingRes] = useState<any | null>(null);

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
  const [lateToleranceMinutes, setLateToleranceMinutes] = useState<number>(15);
  const [bookedTablesInfo, setBookedTablesInfo] = useState<Record<string, "pending" | "confirmed">>({});

  const getTodayStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

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

  useEffect(() => {
    if (highlightId && reservations.length > 0) {
      const matched = reservations.find(r => r.id === highlightId);
      if (matched) {
        setSelectedRes(matched);
        if (["arrived", "seated"].includes(matched.status)) {
          setFilter("observing");
        } else {
          setFilter(matched.status);
        }
      }
    }
  }, [highlightId, reservations]);

  useEffect(() => {
    if (selectedRes && reservations.length > 0) {
      const matched = reservations.find(r => r.id === selectedRes.id);
      if (matched) {
        setSelectedRes(matched);
      }
    }
  }, [reservations, selectedRes?.id]);


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
        if (resSettings?.late_tolerance_minutes !== undefined) {
          setLateToleranceMinutes(Number(resSettings.late_tolerance_minutes));
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
      pelanggan: { label: "Dibatalkan oleh Pelanggan", color: "text-orange-600 dark:text-orange-400" },
      kasir: { label: "Dibatalkan oleh Kasir", color: "text-red-600 dark:text-red-400" },
      admin: { label: "Dibatalkan oleh Admin", color: "text-red-700 dark:text-red-500" },
    };
    return byMap[dibatalkanOleh] || { label: `Dibatalkan oleh ${dibatalkanOleh}`, color: "text-red-600 dark:text-red-400" };
  };

  const handleConfirm = async (res: any) => {
    const toastId = toast.loading("Mengonfirmasi reservasi...");
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

      // Trigger Email Notification (realtime, awaited)
      try {
        await fetch("/api/reservations/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId: res.id, status: "confirmed" })
        });
      } catch (err) {
        console.error("Gagal mengirim email reservasi:", err);
      }

      // Trigger Google Calendar sync (awaited)
      try {
        const syncRes = await fetch("/api/reservations/sync-calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId: res.id, action: "create" })
        });
        const syncData = await syncRes.json();
        if (syncRes.ok && syncData.success) {
          toast.success("Reservasi dikonfirmasi & disinkronkan ke kalender!", { id: toastId });
        } else {
          toast.error(`Konfirmasi sukses, tapi sinkronisasi kalender gagal: ${syncData.error || 'Terjadi kesalahan'}`, { id: toastId });
        }
      } catch (err: any) {
        console.error("Gagal sinkronisasi Google Calendar:", err);
        toast.error(`Konfirmasi sukses, tapi sinkronisasi kalender gagal: ${err.message}`, { id: toastId });
      }

      fetchData();
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId) return;
    if (!rejectReason) return toast.error("Masukkan alasan penolakan");

    const toastId = toast.loading("Menolak reservasi...");
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

      // Trigger Email Notification (realtime, awaited)
      try {
        await fetch("/api/reservations/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId: rejectingId, status: "cancelled" })
        });
      } catch (err) {
        console.error("Gagal mengirim email reservasi:", err);
      }

      // Trigger Google Calendar sync (awaited)
      try {
        await fetch("/api/reservations/sync-calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId: rejectingId, action: "delete" })
        });
      } catch (err) {
        console.error("Gagal menghapus event kalender:", err);
      }

      toast.success("Reservasi telah ditolak.", { id: toastId });
      setRejectingId(null);
      setRejectReason("");
      fetchData();
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    }
  };

  const handleComplete = async (res: any) => {
    const toastId = toast.loading("Menyelesaikan reservasi...");
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

      // Trigger Email Notification (realtime, awaited)
      try {
        await fetch("/api/reservations/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId: res.id, status: "completed" })
        });
      } catch (err) {
        console.error("Gagal mengirim email reservasi:", err);
      }

      // Trigger Google Calendar sync to DELETE the event when complete (awaited)
      try {
        await fetch("/api/reservations/sync-calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId: res.id, action: "delete" })
        });
      } catch (err) {
        console.error("Gagal menghapus event kalender:", err);
      }

      toast.success("Reservasi selesai! Meja kembali READY.", { id: toastId });
      fetchData();
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    }
  };

  const handleCashierBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookForm.date) return toast.error("Pilih tanggal");
    if (selectedTableIds.length === 0) return toast.error("Pilih minimal satu meja");
    if (!bookForm.atasNama) return toast.error("Masukkan nama");

    // Validate past Date & Time (WIB)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const dateObj = new Date(bookForm.date + "T00:00:00");
    const formattedDate = format(dateObj, "d MMMM yyyy", { locale: localeId });

    if (bookForm.date < todayStr) {
      return toast.error(`Tanggal reservasi yang Anda pilih (${formattedDate}) sudah terlewat. Silakan pilih tanggal hari ini atau tanggal lainnya.`);
    }

    if (bookForm.date === todayStr) {
      const currentHours = today.getHours();
      const currentMinutes = today.getMinutes();
      const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;
      if (bookForm.time < currentTimeStr) {
        return toast.error(`Waktu reservasi yang Anda pilih (${bookForm.time} WIB) untuk tanggal hari ini (${formattedDate}) sudah terlewat. Silakan masukkan jam yang lain atau ganti tanggal.`);
      }
    }

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

      // Calculate check-in deadline based on local restaurant timezone (WIB, UTC+7)
      const bookingDateTime = new Date(`${bookForm.date}T${bookForm.time}:00+07:00`);
      const deadlineTime = new Date(bookingDateTime.getTime() + lateToleranceMinutes * 60000);
      const checkInDeadline = deadlineTime.toISOString();

      const { error } = await supabase.from("reservations").insert({
        customer_id: null, // Cashier booked walk-in/phone reservasi
        table_id: selectedTableIds[0],
        reservation_date: bookForm.date,
        reservation_time: bookForm.time,
        guest_count: bookForm.guests,
        notes: structuredNotes,
        status: "pending",
        tolerance_minutes: lateToleranceMinutes,
        check_in_deadline: checkInDeadline,
        rules_approved: true
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
    arrived: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    seated: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  };

  const getDynamicStatus = (res: any) => {
    if (res.status !== "confirmed") return null;
    if (!res.check_in_deadline) return null;
    
    const now = new Date();
    const deadline = new Date(res.check_in_deadline);
    
    // Booking time (formatted to WIB UTC+7)
    const bookingDateTime = new Date(`${res.reservation_date}T${res.reservation_time}:00+07:00`);
    
    if (now >= deadline) {
      return {
        text: "Reservasi hangus/terlambat",
        badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      };
    } else if (now >= bookingDateTime) {
      return {
        text: "Waktu check-in dimulai",
        badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
      };
    }
    return null;
  };

  const filtered = reservations.filter(r => {
    if (filter === "confirmed") {
      return r.status === "confirmed";
    }
    if (filter === "observing") {
      return ["arrived", "seated"].includes(r.status);
    }
    return r.status === filter;
  });

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

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {[
          { s: "pending", l: "Menunggu", c: "from-yellow-400 to-amber-500" },
          { s: "confirmed", l: "Belum Check-In", c: "from-orange-500 to-amber-600" },
          { s: "observing", l: "Sedang Observasi", c: "from-green-500 to-emerald-600" },
          { s: "completed", l: "Selesai", c: "from-blue-500 to-blue-600" },
          { s: "cancelled", l: "Ditolak / Batal", c: "from-red-500 to-rose-600" }
        ].map(item => (
          <motion.div key={item.s} whileHover={{ y: -2 }} onClick={() => setFilter(item.s)} className={`bg-gradient-to-br ${item.c} rounded-2xl p-5 text-white shadow-lg cursor-pointer transition-all flex flex-col items-center justify-center text-center ${filter === item.s ? "scale-105 shadow-xl border-2 border-white" : "opacity-75 hover:opacity-100"}`}>
            <p className="text-white/80 text-sm font-semibold leading-tight">{item.l}</p>
            <p className="text-3xl font-black mt-1">
              {item.s === "observing" 
                ? reservations.filter(r => ["arrived", "seated"].includes(r.status)).length 
                : reservations.filter(r => r.status === item.s).length}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((res, i) => {
          const parsedNotes = getParsedNotes(res.notes);
          const customerName = parsedNotes.atas_nama || (res.profiles?.full_name || "Guest");
          const displayMejaList = parsedNotes.meja_tambahan && parsedNotes.meja_tambahan.length > 0 
            ? parsedNotes.meja_tambahan.join(", ") 
            : res.tables?.table_number;
          const cancelledByInfo = getCancelledByLabel(parsedNotes);
          const dynamicStatus = getDynamicStatus(res);

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
                  <span className={`text-xs uppercase font-bold px-3 py-1.5 rounded-lg ${dynamicStatus ? dynamicStatus.badge : statusBadge[res.status]}`}>
                    {dynamicStatus ? dynamicStatus.text 
                      : res.status === "pending" ? "Menunggu" 
                      : res.status === "confirmed" ? "Aktif & Belum Check-In" 
                      : res.status === "arrived" ? "Sudah Check-In & Proses Sedang Berjalan"
                      : res.status === "seated" ? "Sudah Check-In & Proses Sedang Berjalan"
                      : res.status === "cancelled" ? "Batal" 
                      : "Selesai"}
                  </span>
                  
                  {/* Detail Button */}
                  <button onClick={() => setSelectedRes(res)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-primary" title="Tampilkan Data Pemesan">
                    <Eye className="w-5 h-5" />
                  </button>

                  {res.status === "pending" && (
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setConfirmingRes(res)} className="p-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg" aria-label="Konfirmasi" title="Konfirmasi / ACC"><Check className="w-5 h-5" /></motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setRejectingId(res.id)} className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg" aria-label="Tolak" title="Tolak dengan Alasan"><X className="w-5 h-5" /></motion.button>
                    </div>
                  )}
                  {["arrived", "seated"].includes(res.status) && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleComplete(res)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10">Selesai Observasi</motion.button>
                  )}
                </div>
              </div>

              {/* Cancellation info inline on cards */}
              {res.status === "cancelled" && cancelledByInfo && (
                <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
                  <Ban className={`w-3.5 h-3.5 ${cancelledByInfo.color}`} />
                  <span className={cancelledByInfo.color}>{cancelledByInfo.label}</span>
                </div>
              )}
              {res.status === "cancelled" && parsedNotes?.catatan_batal && (
                <p className="mt-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <span className="font-bold">Alasan Pembatalan:</span> {parsedNotes.catatan_batal}
                </p>
              )}
              {res.status === "cancelled" && parsedNotes?.catatan_tolak && (
                <p className="mt-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <span className="font-bold">Alasan Penolakan:</span> {parsedNotes.catatan_tolak}
                </p>
              )}
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
          const clientName = parsed.atas_nama || (selectedRes.profiles?.full_name || "Guest");
          const clientPhone = parsed.telepon || (selectedRes.profiles?.phone || "-");
          const mejaNumbers = parsed.meja_tambahan && parsed.meja_tambahan.length > 0 ? parsed.meja_tambahan.join(", ") : selectedRes.tables?.table_number;
          const notesText = parsed.catatan;

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

                {/* Pre-order menu items */}
                {selectedRes.menu_items && Array.isArray(selectedRes.menu_items) && selectedRes.menu_items.length > 0 && (
                  <div className="border-t border-border-light dark:border-border-dark pt-4 space-y-2">
                    <span className="text-xs text-muted uppercase font-bold tracking-wider block">Pre-Order Menu</span>
                    <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border border-border-light dark:border-border-dark divide-y divide-border-light dark:divide-border-dark">
                      {selectedRes.menu_items.map((item: any, idx: number) => (
                        <div key={idx} className="py-2 flex justify-between text-sm">
                          <div>
                            <span className="font-bold text-text-light dark:text-text-dark">{item.name}</span>
                            <span className="text-xs text-muted block">Rp {item.price.toLocaleString("id-ID")} x {item.quantity}</span>
                            {item.notes && <span className="text-[10px] text-primary block uppercase font-bold">Note: {item.notes}</span>}
                          </div>
                          <span className="font-bold text-text-light dark:text-text-dark">Rp {(item.price * item.quantity).toLocaleString("id-ID")}</span>
                        </div>
                      ))}
                      
                      {/* Kitchen Warning Banner inside Pre-order box */}
                      <div className="pt-3 pb-1 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                        <span>Menu disiapkan dapur 30 menit sebelum booking dimulai.</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment summary */}
                <div className="border-t border-border-light dark:border-border-dark pt-4 space-y-2 text-xs">
                  <span className="text-xs text-muted uppercase font-bold tracking-wider block">Status Pembayaran &amp; DP</span>
                  <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border border-border-light dark:border-border-dark space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Total Tagihan Menu:</span>
                      <span className="font-bold">Rp {(selectedRes.menu_total || 0).toLocaleString("id-ID")}</span>
                    </div>
                    {selectedRes.payment_method === "dp" && (
                      <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                        <span>DP Dibayar ({selectedRes.dp_percent || 0}%):</span>
                        <span>-Rp {(selectedRes.dp_amount || 0).toLocaleString("id-ID")}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm pt-1.5 border-t border-dashed border-border-light dark:border-border-dark">
                      <span className="font-extrabold text-text-light dark:text-text-dark">Sisa Pembayaran:</span>
                      <span className="font-black text-primary text-base">Rp {(selectedRes.remaining_amount || 0).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] pt-1">
                      <span className="text-muted uppercase font-bold">Metode: {selectedRes.payment_method?.toUpperCase()}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                        selectedRes.payment_status === "paid"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : selectedRes.payment_status === "dp_paid"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      }`}>
                        {selectedRes.payment_status === "paid" ? "Lunas" : selectedRes.payment_status === "dp_paid" ? "DP Dibayar" : "Belum Bayar"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bayar Sekarang Button */}
                {selectedRes.payment_status !== "paid" && ["pending", "confirmed"].includes(selectedRes.status) && (
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setSelectedRes(null);
                        window.location.href = `/cashier/pos?reservation_id=${selectedRes.id}`;
                      }}
                      className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-md hover:bg-primary-hover flex items-center justify-center gap-2"
                    >
                      <Receipt className="w-4 h-4" /> Bayar Sekarang (Tutup Tagihan di POS)
                    </button>
                  </div>
                )}
                {(parsed?.catatan_tolak || parsed?.catatan_batal) && (() => {
                  const cancelInfo = getCancelledByLabel(parsed);
                  const alasanText = parsed?.catatan_tolak || parsed?.catatan_batal;
                  const labelAlasan = parsed?.catatan_tolak ? "Alasan Penolakan" : "Alasan Pembatalan";
                  return (
                    <div className="rounded-xl border border-red-200 dark:border-red-800 overflow-hidden">
                      <div className="bg-red-50 dark:bg-red-900/20 px-4 py-3 border-b border-red-200 dark:border-red-800 flex items-center gap-2">
                        <Ban className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <span className="text-sm font-bold text-red-600 dark:text-red-400">
                          {cancelInfo ? cancelInfo.label : "Reservasi Dibatalkan"}
                        </span>
                      </div>
                      <div className="p-4 space-y-2 bg-white dark:bg-gray-900">
                        <span className="text-xs text-muted uppercase font-bold tracking-wider block">{labelAlasan}</span>
                        <p className="text-sm text-red-700 dark:text-red-400">{alasanText}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </>
          );
        })()}
      </BaseModal>

      {/* Pop-up Modal Konfirmasi Detail Reservasi */}
      <BaseModal
        isOpen={!!confirmingRes}
        onClose={() => setConfirmingRes(null)}
        showCloseButton={false}
        noPadding
        size="md"
      >
        {confirmingRes && (() => {
          const parsed = getParsedNotes(confirmingRes.notes);
          const clientName = parsed.atas_nama || (confirmingRes.profiles?.full_name || "Guest");
          const clientPhone = parsed.telepon || (confirmingRes.profiles?.phone || "-");
          const mejaNumbers = parsed.meja_tambahan && parsed.meja_tambahan.length > 0 ? parsed.meja_tambahan.join(", ") : confirmingRes.tables?.table_number;
          const notesText = parsed.catatan;

          return (
            <>
              <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-green-500/10 dark:bg-green-950/20">
                <div>
                  <h3 className="font-bold text-lg text-green-600 dark:text-green-400">Konfirmasi Rincian Reservasi</h3>
                  <p className="text-xs text-muted mt-1">Harap verifikasi detail reservasi sebelum mengonfirmasi</p>
                </div>
                <button onClick={() => setConfirmingRes(null)} title="Tutup" aria-label="Tutup" className="text-muted hover:text-text-light"><X className="w-5 h-5" /></button>
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
                    <p className="font-medium text-text-light dark:text-text-dark">{format(new Date(confirmingRes.reservation_date), "dd MMM yyyy", { locale: localeId })}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted uppercase font-bold tracking-wider">Waktu</span>
                    <p className="font-medium text-text-light dark:text-text-dark">{confirmingRes.reservation_time?.substring(0, 5)} WIB</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-muted uppercase font-bold tracking-wider">Meja</span>
                    <p className="font-bold text-primary text-base">Meja {mejaNumbers}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted uppercase font-bold tracking-wider">Tamu</span>
                    <p className="font-medium text-text-light dark:text-text-dark">{confirmingRes.guest_count} Orang</p>
                  </div>
                </div>
                {notesText && (
                  <div>
                    <span className="text-xs text-muted uppercase font-bold tracking-wider">Catatan Tambahan</span>
                    <p className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark mt-1">{notesText}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
                  <button type="button" onClick={() => setConfirmingRes(null)} className="flex-1 py-3 border border-border-light dark:border-border-dark rounded-xl font-medium">Batal</button>
                  <button
                    type="button"
                    onClick={() => {
                      handleConfirm(confirmingRes);
                      setConfirmingRes(null);
                    }}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-500/10 text-center animate-pulse"
                  >
                    Konfirmasi
                  </button>
                </div>
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
              <input id="cashierDate" title="Tanggal Reservasi" type="date" value={bookForm.date} onChange={e => setBookForm({ ...bookForm, date: e.target.value })} min={getTodayStr()} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none" required />
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

export default function CashierReservationsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <CashierReservationsContent />
    </Suspense>
  );
}
