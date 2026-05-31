"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Check, X, Loader2, Clock, Users, MapPin, Eye, MessageSquare, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export default function AdminReservationsPage() {
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  // Selected details modal
  const [selectedRes, setSelectedRes] = useState<any>(null);

  // Modern Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    hasInput: boolean;
    inputPlaceholder?: string;
    confirmText: string;
    type: "danger" | "warning" | "success" | "info";
    onConfirm: (inputValue?: string) => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    hasInput: false,
    confirmText: "Lanjutkan",
    type: "info",
    onConfirm: () => {},
  });
  const [confirmInput, setConfirmInput] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchData();

    const channel = supabase.channel("admin-reservations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    try {
      const { data } = await supabase.from("reservations").select("*, profiles!reservations_customer_id_fkey(full_name, phone), tables(table_number, capacity)").order("reservation_date", { ascending: false });
      setReservations(data || []);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

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

      // Update tables to reserved
      if (tableIds && tableIds.length > 0) {
        await supabase.from("tables").update({ status: "reserved" }).in("id", tableIds);
      }

      // Add Notification
      if (res.customer_id) {
        await supabase.from("notifications").insert({
          user_id: res.customer_id,
          title: "Reservasi Disetujui",
          message: `Reservasi Anda pada tanggal ${format(new Date(res.reservation_date), "dd MMM yyyy")} telah disetujui oleh admin.`,
          type: "reservation"
        });
      }

      toast.success("Reservasi berhasil dikonfirmasi!");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleReject = (res: any) => {
    setConfirmInput("");
    setConfirmModal({
      isOpen: true,
      title: "Tolak Reservasi",
      message: `Masukkan alasan penolakan untuk reservasi atas nama ${getParsedNotes(res.notes)?.atas_nama || res.profiles?.full_name || "Guest"}:`,
      hasInput: true,
      inputPlaceholder: "Alasan penolakan...",
      confirmText: "Tolak",
      type: "danger",
      onConfirm: async (reason) => {
        if (!reason || !reason.trim()) return;
        const toastId = toast.loading("Menolak reservasi...");
        try {
          const parsedNotes = getParsedNotes(res.notes);
          const tableIds = parsedNotes?.meja_ids || [res.table_id];

          const updatedNotes = parsedNotes
            ? JSON.stringify({ ...parsedNotes, catatan_tolak: reason })
            : `${res.notes || ""} (Ditolak: ${reason})`;

          // Update reservation status
          const { error: resError } = await supabase.from("reservations").update({ status: "cancelled", notes: updatedNotes }).eq("id", res.id);
          if (resError) throw resError;

          // Set tables to available
          if (tableIds && tableIds.length > 0) {
            await supabase.from("tables").update({ status: "available" }).in("id", tableIds);
          }

          // Add Notification
          if (res.customer_id) {
            await supabase.from("notifications").insert({
              user_id: res.customer_id,
              title: "Reservasi Ditolak",
              message: `Reservasi Anda pada tanggal ${format(new Date(res.reservation_date), "dd MMM yyyy")} ditolak dengan alasan: ${reason}`,
              type: "reservation"
            });
          }

          toast.success("Reservasi telah ditolak.", { id: toastId });
          fetchData();
        } catch (e: any) {
          toast.error(e.message, { id: toastId });
        }
      }
    });
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
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Kelola Reservasi (Admin)</h1>
        <p className="text-muted mt-1">{reservations.length} total reservasi masuk</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
        {[
          { val: "all", text: "Semua" },
          { val: "pending", text: "Menunggu" },
          { val: "confirmed", text: "Dikonfirmasi" },
          { val: "completed", text: "Selesai" },
          { val: "cancelled", text: "Dibatalkan" }
        ].map(s => (
          <button key={s.val} onClick={() => setFilter(s.val)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === s.val ? "bg-primary text-white" : "bg-card-light dark:bg-card-dark text-text-light dark:text-text-dark border border-border-light dark:border-border-dark"}`}>
            {s.text} ({s.val === "all" ? reservations.length : reservations.filter(r => r.status === s.val).length})
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((res, i) => {
          const parsedNotes = getParsedNotes(res.notes);
          const customerName = parsedNotes ? parsedNotes.atas_nama : (res.profiles?.full_name || "Guest");
          const displayMejaList = parsedNotes?.meja_tambahan ? parsedNotes.meja_tambahan.join(", ") : res.tables?.table_number;

          return (
            <motion.div key={res.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 p-3 rounded-xl text-center min-w-[60px]">
                    <p className="text-xs text-primary font-medium">{format(new Date(res.reservation_date), "MMM", { locale: localeId })}</p>
                    <p className="text-xl font-bold text-primary">{format(new Date(res.reservation_date), "dd")}</p>
                  </div>
                  <div>
                    <p className="font-bold text-text-light dark:text-text-dark">Atas Nama: {customerName}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted">
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {res.reservation_time?.substring(0, 5)}</span>
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {res.guest_count} Orang</span>
                      <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Meja: {displayMejaList}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs uppercase font-bold px-3 py-1.5 rounded-lg ${statusBadge[res.status]}`}>{res.status === "pending" ? "Menunggu" : res.status === "confirmed" ? "Dikonfirmasi" : res.status === "cancelled" ? "Dibatalkan" : "Selesai"}</span>
                  
                  {/* Action Detail Button */}
                  <button onClick={() => setSelectedRes(res)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-primary" title="Detail Pemesan">
                    <Eye className="w-5 h-5" />
                  </button>

                  {res.status === "pending" && (
                    <div className="flex gap-2">
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleConfirm(res)} className="p-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg transition-colors" aria-label="Konfirmasi" title="Konfirmasi"><Check className="w-5 h-5" /></motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleReject(res)} className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors" aria-label="Tolak" title="Tolak"><X className="w-5 h-5" /></motion.button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16"><CalendarDays className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" /><p className="text-muted">Tidak ada reservasi ditemukan.</p></div>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedRes && (() => {
          const parsed = getParsedNotes(selectedRes.notes);
          const clientName = parsed ? parsed.atas_nama : (selectedRes.profiles?.full_name || "Guest");
          const clientPhone = parsed ? parsed.telepon : (selectedRes.profiles?.phone || "-");
          const mejaNumbers = parsed?.meja_tambahan ? parsed.meja_tambahan.join(", ") : selectedRes.tables?.table_number;
          const notesText = parsed ? parsed.catatan : selectedRes.notes;

          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedRes(null)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card-light dark:bg-card-dark rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-border-light dark:border-border-dark">
                <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                  <h3 className="font-bold text-lg text-text-light dark:text-text-dark">Data Diri Pemesan (Admin View)</h3>
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
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* GENERIC MODERN CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card-light dark:bg-card-dark max-w-sm w-full rounded-[2rem] p-8 shadow-2xl border border-border-light dark:border-border-dark text-center space-y-6"
            >
              <div className={`w-16 h-16 ${confirmModal.type === 'danger' ? 'bg-red-500/10 text-red-500' : confirmModal.type === 'warning' ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'} rounded-2xl flex items-center justify-center mx-auto`}>
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-text-light dark:text-text-dark uppercase tracking-wide">{confirmModal.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{confirmModal.message}</p>
              </div>

              {confirmModal.hasInput && (
                <div className="mt-4">
                  <textarea
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder={confirmModal.inputPlaceholder || "Masukkan catatan..."}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-800 text-text-light dark:text-text-dark border border-border-light dark:border-border-dark rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none h-24"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => {
                    setConfirmModal(prev => ({...prev, isOpen: false}));
                    setConfirmInput("");
                  }}
                  className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-muted font-black rounded-xl text-xs uppercase"
                >
                  Batal
                </button>
                <button 
                  onClick={async () => {
                    if (confirmModal.hasInput && !confirmInput.trim()) {
                      toast.error("Alasan penolakan wajib diisi.");
                      return;
                    }
                    await confirmModal.onConfirm(confirmInput);
                    setConfirmModal(prev => ({...prev, isOpen: false}));
                    setConfirmInput("");
                  }}
                  className={`flex-1 py-3.5 ${confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : confirmModal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-primary/90'} text-white font-black rounded-xl text-xs uppercase shadow-lg transition-all`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
