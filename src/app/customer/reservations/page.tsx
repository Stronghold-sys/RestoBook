"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Clock, Users, Plus, Loader2, X, MapPin, CheckCircle, Phone, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { SkeletonOrderItem } from "@/components/Skeleton";

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
}

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
}

export default function CustomerReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [profileId, setProfileId] = useState<string>("");
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
  const supabase = createClient();

  useEffect(() => { 
    fetchData(); 

    const channel = supabase.channel("customer-reservations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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

      const { data: tbl } = await supabase.from("tables").select("*").eq("status", "available").order("table_number");
      setTables(tbl || []);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

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

    setSubmitting(true);
    try {
      const selectedTables = tables.filter(t => selectedTableIds.includes(t.id));
      const structuredNotes = JSON.stringify({
        atas_nama: form.atasNama,
        telepon: form.telepon,
        meja_tambahan: selectedTables.map(t => t.table_number),
        meja_ids: selectedTableIds,
        catatan: form.notes
      });

      const { error } = await supabase.from("reservations").insert({
        customer_id: profileId,
        table_id: selectedTableIds[0], // primary table
        reservation_date: form.date,
        reservation_time: form.time,
        guest_count: form.guests,
        notes: structuredNotes,
        status: "pending",
      });
      if (error) throw error;

      // Add Notification
      await supabase.from("notifications").insert({
        user_id: profileId,
        title: "Reservasi Baru Diajukan",
        message: `Reservasi atas nama ${form.atasNama} pada tanggal ${format(new Date(form.date), "dd MMM yyyy")} meja ${selectedTables.map(t => t.table_number).join(", ")} sedang menunggu konfirmasi kasir.`,
        type: "reservation"
      });

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
        ? JSON.stringify({ ...parsedNotes, catatan_batal: cancelReason })
        : JSON.stringify({ catatan_batal: cancelReason });

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
        type: "reservation"
      });

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

  const getParsedNotes = (notesStr: string) => {
    try {
      const parsed = JSON.parse(notesStr);
      if (parsed && typeof parsed === "object" && "atas_nama" in parsed) {
        return parsed;
      }
    } catch (e) {}
    return null;
  };

  const getStatusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    };
    return map[s] || "bg-gray-100 text-gray-800";
  };

  const getStatusText = (s: string) => {
    const map: Record<string, string> = { pending: "Menunggu", confirmed: "Dikonfirmasi", cancelled: "Dibatalkan", completed: "Selesai" };
    return map[s] || s;
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
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
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-light dark:text-text-dark leading-tight">Observasi &amp; Reservasi Meja</h1>
          <p className="text-muted mt-1 text-sm sm:text-base">Ajukan reservasi meja bebas (bisa pilih banyak meja sekaligus)</p>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/20 shrink-0 self-start sm:self-auto">
          <Plus className="w-5 h-5" /> Ajukan Reservasi
        </motion.button>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {reservations.map((res, i) => {
            const parsedNotes = getParsedNotes(res.notes);
            const displayNotes = parsedNotes ? parsedNotes.catatan : res.notes;
            const displayAtasNama = parsedNotes ? parsedNotes.atas_nama : null;
            const displayMejaList = parsedNotes?.meja_tambahan ? parsedNotes.meja_tambahan.join(", ") : res.tables?.table_number;

            return (
              <motion.div key={res.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark p-6 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-4 rounded-xl text-center min-w-[70px]">
                      <p className="text-xs text-primary font-medium uppercase">{format(new Date(res.reservation_date), "MMM", { locale: localeId })}</p>
                      <p className="text-2xl font-bold text-primary">{format(new Date(res.reservation_date), "dd")}</p>
                    </div>
                    <div>
                      <p className="font-bold text-text-light dark:text-text-dark text-lg">
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
                  <div className="flex items-center gap-3">
                    <span className={`text-xs uppercase font-bold px-3 py-1.5 rounded-lg ${getStatusBadge(res.status)}`}>{getStatusText(res.status)}</span>
                    {res.status === "pending" && (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setCancellingId(res.id); setCancelReason(""); }} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors" aria-label="Batalkan Reservasi" title="Batalkan Reservasi">
                        <X className="w-5 h-5" />
                      </motion.button>
                    )}
                  </div>
                </div>
                {displayNotes && <p className="mt-3 text-sm text-muted bg-background-light dark:bg-background-dark p-3 rounded-lg"><span className="font-bold">Catatan:</span> {displayNotes}</p>}
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
              </motion.div>
            );
          })}
        </AnimatePresence>
        {reservations.length === 0 && (
          <div className="text-center py-20">
            <CalendarDays className="w-16 h-16 text-muted mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-medium text-text-light dark:text-text-dark">Belum Ada Reservasi</h3>
            <p className="text-muted mt-2">Pilih meja bebas dan ajukan observasi sekarang!</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card-light dark:bg-card-dark rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
              <div className="bg-primary p-6 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">Ajukan Observasi Meja</h2>
                  <p className="text-white/80 text-sm mt-1">Lengkapi informasi diri & pilih meja bebas</p>
                </div>
                <button onClick={() => setShowModal(false)} title="Tutup" aria-label="Tutup" className="p-1 hover:bg-white/10 rounded-full text-white"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto scrollbar-hide">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="atasNama" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Atas Nama</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
                      <input id="atasNama" type="text" value={form.atasNama} onChange={e => setForm({ ...form, atasNama: e.target.value })} placeholder="Masukkan nama pemesan..." className="w-full pl-9 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark" required />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="telepon" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Nomor Telepon</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
                      <input id="telepon" type="tel" value={form.telepon} onChange={e => setForm({ ...form, telepon: e.target.value })} placeholder="Contoh: 08123456789" className="w-full pl-9 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark" required />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="resDate" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Tanggal</label>
                    <input id="resDate" title="Tanggal Reservasi" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} min={new Date().toISOString().split("T")[0]} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark" required />
                  </div>
                  <div>
                    <label htmlFor="resTime" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Waktu</label>
                    <input id="resTime" title="Waktu Reservasi" type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark" required />
                  </div>
                </div>

                <div>
                  <label htmlFor="resGuests" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Jumlah Tamu</label>
                  <input id="resGuests" title="Jumlah Tamu" type="number" value={form.guests} onChange={e => setForm({ ...form, guests: parseInt(e.target.value) })} min={1} max={50} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark" required />
                </div>

                <div>
                  <label className="text-sm font-medium text-text-light dark:text-text-dark mb-2 block">Pilih Meja (Bisa pilih lebih dari satu)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {tables.map(t => {
                      const isSelected = selectedTableIds.includes(t.id);
                      return (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => handleTableToggle(t.id)}
                          className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                            isSelected
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-background-light dark:bg-background-dark border-border-light dark:border-border-dark text-muted hover:border-gray-300"
                          }`}
                        >
                          <span className="font-black text-lg">Meja {t.table_number}</span>
                          <span className="text-[10px] font-bold mt-1">Cap: {t.capacity} org</span>
                        </button>
                      );
                    })}
                  </div>
                  {tables.length === 0 && <p className="text-sm text-red-500">Tidak ada meja kosong tersedia saat ini.</p>}
                </div>

                <div>
                  <label htmlFor="resNotes" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Catatan Tambahan (Opsional)</label>
                  <textarea id="resNotes" title="Catatan" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark" rows={2} placeholder="Contoh: Butuh colokan listrik, AC dingin, dll" />
                </div>

                <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 border border-border-light dark:border-border-dark rounded-xl font-medium text-text-light dark:text-text-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Batal</button>
                  <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={submitting} className="flex-1 py-3 bg-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Ajukan Sekarang</>}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Pembatalan */}
      <AnimatePresence>
        {cancellingId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setCancellingId(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card-light dark:bg-card-dark rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-border-light dark:border-border-dark">
              <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl">
                  <X className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Batalkan Reservasi</h2>
                  <p className="text-white/80 text-sm">Berikan alasan pembatalan Anda</p>
                </div>
              </div>
              <form onSubmit={handleCancelSubmit} className="p-6 space-y-4">
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
                  <button type="button" onClick={() => setCancellingId(null)} className="flex-1 py-3 rounded-xl font-medium text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Kembali</button>
                  <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={cancelling || !cancelReason.trim()} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 disabled:opacity-50">
                    {cancelling ? <Loader2 className="w-5 h-5 animate-spin" /> : "Konfirmasi Batal"}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
