"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { 
  History, CalendarDays, Search, Filter, RefreshCw, X, Loader2, ArrowLeft, 
  Clock, CheckCircle, XCircle, AlertCircle, Ban, Wallet, CreditCard, RotateCcw, 
  HelpCircle, ChevronRight, FileSpreadsheet, Eye, Info
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import Link from "next/link";
import BaseModal from "@/components/BaseModal";

type RefundStatusType = 
  | 'pengajuan_refund' 
  | 'menunggu_peninjauan' 
  | 'menunggu_verifikasi' 
  | 'disetujui' 
  | 'ditolak' 
  | 'dana_dikirim' 
  | 'refund_selesai'
  | 'waiting_review'
  | 'completed'
  | 'rejected'
  | null;

interface Reservation {
  id: string;
  customer_id: string;
  table_id: string;
  reservation_date: string;
  reservation_time: string;
  guest_count: number;
  notes: string;
  status: 'pending' | 'confirmed' | 'arrived' | 'seated' | 'completed' | 'cancelled';
  payment_method: string;
  payment_status: string;
  dp_amount: number;
  menu_total: number;
  remaining_amount: number;
  refund_status: RefundStatusType;
  refund_method: string | null;
  refund_amount: number | null;
  refund_reason: string | null;
  refund_bank_account: string | null;
  refund_proof: string | null;
  cancelled_by: string | null;
  cancelled_role: string | null;
  cancellation_reason: string | null;
  cancellation_time: string | null;
  created_at: string;
  updated_at: string;
  dp_percent?: number;
  tables: {
    table_number: number;
  } | null;
}

export default function CustomerRiwayatPage() {
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  
  // Filters and search states
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [refundMethodFilter, setRefundMethodFilter] = useState<string>("all");
  const [refundTypeFilter, setRefundTypeFilter] = useState<string>("all");
  const [searchResNo, setSearchResNo] = useState("");
  
  // Selected Detail Modal
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchProfileAndData();

    // Setup realtime listener for reservations
    const channel = supabase.channel("customer-riwayat-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchProfileAndData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (profile) {
          setProfileId(profile.id);
          await fetchCustomerReservations(profile.id);
        }
      }
    } catch (e: any) {
      toast.error("Gagal memuat profil: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    if (profileId) {
      await fetchCustomerReservations(profileId);
    }
  };

  const fetchCustomerReservations = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, tables(table_number)")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReservations(data || []);
    } catch (e: any) {
      console.error("Gagal mengambil riwayat:", e.message);
    }
  };

  const getParsedNotes = (notesStr: string) => {
    if (!notesStr) return { atas_nama: "", telepon: "", catatan: "", meja_tambahan: [] };
    try {
      const parsed = JSON.parse(notesStr);
      if (parsed && typeof parsed === "object") {
        return {
          atas_nama: parsed.atas_nama || "",
          telepon: parsed.telepon || "",
          catatan: parsed.catatan || "",
          meja_tambahan: parsed.meja_tambahan || []
        };
      }
    } catch (e) {}
    return { atas_nama: "", telepon: "", catatan: notesStr, meja_tambahan: [] };
  };

  // Status mapping functions
  const getStatusText = (status: string) => {
    switch (status) {
      case "pending": return "Menunggu";
      case "confirmed": return "Belum Check-In";
      case "arrived": return "Seated / Arrived";
      case "seated": return "Seated / Arrived";
      case "completed": return "Selesai";
      case "cancelled": return "Dibatalkan";
      default: return status;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-250 dark:border-yellow-900/40";
      case "confirmed": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-250 dark:border-orange-900/40";
      case "arrived":
      case "seated": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-250 dark:border-blue-900/40";
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-250 dark:border-green-900/40";
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-250 dark:border-red-900/40";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getRefundStatusText = (status: RefundStatusType) => {
    switch (status) {
      case "pengajuan_refund":
      case "waiting_review":
      case "menunggu_peninjauan":
        return "Pengajuan Refund";
      case "menunggu_verifikasi":
        return "Menunggu Verifikasi";
      case "disetujui":
        return "Disetujui";
      case "ditolak":
      case "rejected":
        return "Ditolak";
      case "dana_dikirim":
        return "Dana Dikirim";
      case "refund_selesai":
      case "completed":
        return "Refund Selesai";
      default:
        return "Tidak Ada Refund";
    }
  };

  const getRefundBadgeClass = (status: RefundStatusType) => {
    switch (status) {
      case "pengajuan_refund":
      case "waiting_review":
      case "menunggu_peninjauan":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200";
      case "menunggu_verifikasi":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-250";
      case "disetujui":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200";
      case "ditolak":
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200";
      case "dana_dikirim":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200";
      case "refund_selesai":
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200";
      default:
        return "bg-gray-100 text-gray-500 border-gray-200";
    }
  };

  // Filtered Reservations Logic
  const filtered = reservations.filter(res => {
    // 1. Tab Filter
    if (activeTab === "active" && !["pending", "confirmed", "arrived", "seated"].includes(res.status)) return false;
    if (activeTab === "completed" && res.status !== "completed") return false;
    if (activeTab === "cancelled" && res.status !== "cancelled") return false;
    
    if (activeTab === "refund_pending" && !["pengajuan_refund", "waiting_review", "menunggu_peninjauan", "menunggu_verifikasi"].includes(res.refund_status || "")) return false;
    if (activeTab === "refund_approved" && res.refund_status !== "disetujui") return false;
    if (activeTab === "refund_rejected" && !["ditolak", "rejected"].includes(res.refund_status || "")) return false;
    if (activeTab === "refund_completed" && !["refund_selesai", "completed", "dana_dikirim"].includes(res.refund_status || "")) return false;

    // 2. Search Query (Nomor Reservasi / Catatan / Status)
    const notesParsed = getParsedNotes(res.notes);
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      res.id.toLowerCase().includes(searchLower) ||
      notesParsed.catatan.toLowerCase().includes(searchLower) ||
      notesParsed.atas_nama.toLowerCase().includes(searchLower) ||
      getStatusText(res.status).toLowerCase().includes(searchLower) ||
      getRefundStatusText(res.refund_status).toLowerCase().includes(searchLower);
    
    if (!matchesSearch) return false;

    // 3. Date Range Filter
    if (startDate && res.reservation_date < startDate) return false;
    if (endDate && res.reservation_date > endDate) return false;

    // 4. Refund Method Filter
    if (refundMethodFilter !== "all") {
      if (refundMethodFilter === "dompetku" && res.refund_method !== "dompetku") return false;
      if (refundMethodFilter === "bank" && res.refund_method !== "transfer") return false;
    }

    // 5. Jenis Refund Filter (Reservasi vs Pesanan vs Gabungan)
    if (refundTypeFilter !== "all") {
      const hasMenu = res.menu_total > 0;
      if (refundTypeFilter === "reservation" && hasMenu) return false;
      if (refundTypeFilter === "order" && !hasMenu) return false;
    }

    // 6. Reservation Number Specific Filter
    if (searchResNo && !res.id.toLowerCase().includes(searchResNo.toLowerCase())) return false;

    return true;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-black text-text-light dark:text-text-dark flex items-center gap-2">
            <History className="w-8 h-8 text-primary" /> Riwayat Transaksi &amp; Reservasi
          </h1>
          <p className="text-muted mt-1">Lacak status reservasi aktif, riwayat pembatalan, dan pengajuan refund Anda secara lengkap.</p>
        </div>
        <button
          onClick={fetchProfileAndData}
          className="flex items-center gap-1.5 px-4 py-2 bg-gray-50 dark:bg-gray-800 text-xs font-bold text-muted hover:text-primary transition-all border border-border-light dark:border-border-dark rounded-xl"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto scrollbar-hide border-b border-border-light dark:border-border-dark pb-1 gap-2">
        {[
          { key: "all", label: "Semua" },
          { key: "active", label: "Reservasi Aktif" },
          { key: "completed", label: "Reservasi Selesai" },
          { key: "cancelled", label: "Reservasi Dibatalkan" },
          { key: "refund_pending", label: "Pengajuan Refund" },
          { key: "refund_approved", label: "Refund Disetujui" },
          { key: "refund_rejected", label: "Refund Ditolak" },
          { key: "refund_completed", label: "Refund Selesai" }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border-none outline-none ${
              activeTab === tab.key 
                ? "bg-primary text-white shadow-md shadow-primary/15" 
                : "bg-gray-50 dark:bg-gray-800/50 text-muted hover:bg-gray-100 dark:hover:bg-gray-850"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters Box */}
      <div className="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search Input */}
        <div className="relative col-span-1 sm:col-span-2">
          <label htmlFor="quickSearch" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1.5 ml-1">Pencarian Cepat</label>
          <div className="relative">
            <Search className="w-4 h-4 text-muted absolute left-3 top-3.5" />
            <input
              id="quickSearch"
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari kata kunci status, nama, atau catatan..."
              className="w-full pl-9 pr-4 py-2.5 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-text-light dark:text-text-dark"
            />
          </div>
        </div>

        {/* Date Filter */}
        <div>
          <label htmlFor="startDateInput" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1.5 ml-1">Mulai Tanggal</label>
          <input
            id="startDateInput"
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full px-3 py-2.5 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none text-text-light dark:text-text-dark font-medium"
          />
        </div>

        <div>
          <label htmlFor="endDateInput" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1.5 ml-1">Sampai Tanggal</label>
          <input
            id="endDateInput"
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full px-3 py-2.5 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none text-text-light dark:text-text-dark font-medium"
          />
        </div>

        {/* Refund Method Filter */}
        <div>
          <label htmlFor="refMethodSelect" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1.5 ml-1">Metode Refund</label>
          <select
            id="refMethodSelect"
            value={refundMethodFilter}
            onChange={e => setRefundMethodFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none text-text-light dark:text-text-dark font-bold"
          >
            <option value="all">Semua Metode</option>
            <option value="dompetku">DompetKu</option>
            <option value="bank">Transfer Bank</option>
          </select>
        </div>

        {/* Refund Type Filter */}
        <div>
          <label htmlFor="refTypeSelect" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1.5 ml-1">Jenis Pengajuan</label>
          <select
            id="refTypeSelect"
            value={refundTypeFilter}
            onChange={e => setRefundTypeFilter(e.target.value)}
            className="w-full px-3 py-2.5 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none text-text-light dark:text-text-dark font-bold"
          >
            <option value="all">Semua Jenis</option>
            <option value="reservation">Reservasi Meja Saja</option>
            <option value="order">Reservasi + Pre-Order Menu</option>
          </select>
        </div>

        {/* Reservation ID Specific Search */}
        <div>
          <label htmlFor="resNoSearch" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1.5 ml-1">Nomor Reservasi</label>
          <input
            id="resNoSearch"
            type="text"
            value={searchResNo}
            onChange={e => setSearchResNo(e.target.value)}
            placeholder="No. Reservasi..."
            className="w-full px-3 py-2.5 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none text-text-light dark:text-text-dark"
          />
        </div>

        {/* Clear Filters Button */}
        <div className="flex items-end">
          <button
            onClick={() => {
              setSearchQuery("");
              setStartDate("");
              setEndDate("");
              setRefundMethodFilter("all");
              setRefundTypeFilter("all");
              setSearchResNo("");
            }}
            className="w-full py-2.5 border border-dashed border-red-300 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl text-xs font-bold transition-all uppercase flex items-center justify-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Hapus Semua Filter
          </button>
        </div>
      </div>

      {/* Main Content List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card-light dark:bg-card-dark rounded-3xl p-16 text-center border border-dashed border-border-light dark:border-border-dark flex flex-col items-center justify-center">
          <CalendarDays className="w-16 h-16 text-muted mb-4 opacity-50" />
          <h3 className="text-lg font-bold text-text-light dark:text-text-dark">Tidak ada transaksi ditemukan</h3>
          <p className="text-sm text-muted mt-1">Coba sesuaikan kata kunci pencarian atau bersihkan filter yang aktif.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs font-bold text-muted ml-1">
            <span>Menampilkan {filtered.length} riwayat transaksi</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filtered.map(res => {
              const parsedNotes = getParsedNotes(res.notes);
              const hasPreOrder = res.menu_total > 0;
              const displayMejaList = parsedNotes.meja_tambahan && parsedNotes.meja_tambahan.length > 0 
                ? parsedNotes.meja_tambahan.join(", ") 
                : res.tables?.table_number;

              return (
                <div 
                  key={res.id} 
                  className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 border-b border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2.5 rounded-xl text-center min-w-[55px] shrink-0">
                        <p className="text-[10px] text-primary font-bold uppercase">{format(new Date(res.reservation_date), "MMM", { locale: localeId })}</p>
                        <p className="text-lg font-black text-primary">{format(new Date(res.reservation_date), "dd")}</p>
                      </div>
                      <div>
                        <span className="text-[9px] uppercase font-black text-primary tracking-wider">
                          Reservasi #{res.id.substring(0, 8).toUpperCase()}
                        </span>
                        <h4 className="font-extrabold text-sm text-text-light dark:text-text-dark mt-0.5">
                          Meja {displayMejaList} ({res.guest_count} Orang)
                        </h4>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                      {/* Booking Status Badge */}
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase border ${getStatusBadgeClass(res.status)}`}>
                        {getStatusText(res.status)}
                      </span>

                      {/* Refund Status Badge (if exists) */}
                      {res.refund_status && (
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase border ${getRefundBadgeClass(res.refund_status)}`}>
                          Refund: {getRefundStatusText(res.refund_status)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-semibold">
                    <div>
                      <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Waktu Kunjungan</span>
                      <p className="font-bold text-text-light dark:text-text-dark mt-0.5">
                        {format(new Date(res.reservation_date), "dd MMM yyyy", { locale: localeId })} Pukul {res.reservation_time.substring(0, 5)} WIB
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Jenis Pengajuan</span>
                      <p className="font-bold text-text-light dark:text-text-dark mt-0.5">
                        {hasPreOrder ? "Reservasi + Pre-Order Menu" : "Reservasi Meja Saja"}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Total Pembayaran</span>
                      <p className="font-black text-sm text-primary mt-0.5">
                        Rp {(res.menu_total || res.dp_amount || 0).toLocaleString("id-ID")} 
                        <span className="text-[10px] font-medium text-muted ml-1 uppercase">({res.payment_status})</span>
                      </p>
                    </div>
                  </div>

                  {/* Cancellation / Rejection info inline on card */}
                  {res.status === "cancelled" && (
                    <div className="mt-1 p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl space-y-1.5 mb-3">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-red-600 dark:text-red-400">
                        <Ban className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {res.cancelled_role === "cashier" ? "Dibatalkan oleh Kasir" : res.cancelled_role === "admin" ? "Dibatalkan oleh Resto" : "Dibatalkan oleh Anda"}
                          {res.cancelled_by && ` (${res.cancelled_by})`}
                        </span>
                      </div>
                      {(res.cancellation_reason || res.refund_reason) && (
                        <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed font-medium">
                          <span className="font-bold">Alasan:</span> {res.cancellation_reason || res.refund_reason}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Footer Actions */}
                  <div className="pt-4 border-t border-border-light dark:border-border-dark flex justify-between items-center mt-2">
                    <span className="text-[10px] font-bold text-muted font-mono">Dibuat pada {format(new Date(res.created_at), "dd MMM yyyy HH:mm", { locale: localeId })}</span>
                    <button 
                      onClick={() => setSelectedRes(res)}
                      className="px-4 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-xs font-bold text-primary rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" /> Detail Transaksi
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
          const mejaNumbers = parsed.meja_tambahan && parsed.meja_tambahan.length > 0 ? parsed.meja_tambahan.join(", ") : selectedRes.tables?.table_number;
          const notesText = parsed.catatan;

          return (
            <>
              <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50 dark:bg-gray-850">
                <div>
                  <h3 className="font-bold text-lg text-text-light dark:text-text-dark">Detail Transaksi Reservasi</h3>
                  <p className="text-xs text-muted mt-0.5">#{selectedRes.id}</p>
                </div>
                <button onClick={() => setSelectedRes(null)} title="Tutup" aria-label="Tutup" className="text-muted hover:text-text-light"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-5 max-h-[600px] overflow-y-auto pr-1">
                {/* Status Badges Info */}
                <div className="flex flex-wrap gap-2 items-center p-4 bg-primary/5 dark:bg-primary/10 border border-primary/15 rounded-2xl">
                  <div className="w-full flex justify-between items-center text-xs font-bold text-text-light dark:text-text-dark border-b border-dashed border-primary/20 pb-2 mb-2">
                    <span>Status Reservasi:</span>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase border ${getStatusBadgeClass(selectedRes.status)}`}>
                      {getStatusText(selectedRes.status)}
                    </span>
                  </div>
                  {selectedRes.refund_status && (
                    <div className="w-full flex justify-between items-center text-xs font-bold text-text-light dark:text-text-dark">
                      <span>Status Pengembalian Dana (Refund):</span>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase border ${getRefundBadgeClass(selectedRes.refund_status)}`}>
                        {getRefundStatusText(selectedRes.refund_status)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Main details */}
                <div className="grid grid-cols-2 gap-4 text-xs font-bold text-text-light dark:text-text-dark bg-gray-50/50 dark:bg-gray-800/20 p-4 rounded-2xl border border-border-light dark:border-border-dark">
                  <div>
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Atas Nama Pemesan</span>
                    <p className="font-black text-sm text-text-light dark:text-text-dark mt-0.5">{parsed.atas_nama || "Pelanggan"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Nomor HP Kontak</span>
                    <p className="font-bold text-text-light dark:text-text-dark mt-0.5">{parsed.telepon || "-"}</p>
                  </div>
                  <div className="col-span-2 border-t border-border-light dark:border-border-dark pt-3 mt-1"></div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Tanggal Booking</span>
                    <p className="font-bold text-text-light dark:text-text-dark mt-0.5">{format(new Date(selectedRes.reservation_date), "dd MMMM yyyy", { locale: localeId })}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Jam Booking</span>
                    <p className="font-bold text-text-light dark:text-text-dark mt-0.5">{selectedRes.reservation_time.substring(0, 5)} WIB</p>
                  </div>
                  <div className="col-span-2 border-t border-border-light dark:border-border-dark pt-3 mt-1"></div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Nomor Meja</span>
                    <p className="font-black text-sm text-primary mt-0.5">Meja {mejaNumbers}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Jumlah Tamu</span>
                    <p className="font-bold text-text-light dark:text-text-dark mt-0.5">{selectedRes.guest_count} Orang</p>
                  </div>
                </div>

                {/* Pre-Order Menu Items */}
                {selectedRes.menu_total > 0 && selectedRes.notes && (
                  <div className="space-y-2.5">
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Daftar Pre-Order Menu</span>
                    <div className="bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-4 border border-border-light dark:border-border-dark space-y-2">
                      {/* Try to parse menu items from database row (either menu_items field or from note parsing if required) */}
                      {/* For now let's display standard invoice summaries */}
                      <div className="flex justify-between text-xs font-bold text-text-light dark:text-text-dark">
                        <span>Total Harga Menu:</span>
                        <span>Rp {selectedRes.menu_total.toLocaleString("id-ID")}</span>
                      </div>
                      {selectedRes.payment_method === "dp" && (
                        <div className="flex justify-between text-xs text-primary font-bold">
                          <span>DP Dibayar ({selectedRes.dp_percent || 0}%):</span>
                          <span>Rp {selectedRes.dp_amount.toLocaleString("id-ID")}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs text-muted font-bold">
                        <span>Sisa Pembayaran di Kasir:</span>
                        <span>Rp {selectedRes.remaining_amount.toLocaleString("id-ID")}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cancellation Details */}
                {selectedRes.status === "cancelled" && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-900 rounded-2xl text-xs space-y-2 text-text-light dark:text-text-dark">
                    <p className="font-black text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Ban className="w-4 h-4 shrink-0" /> Informasi Pembatalan
                    </p>
                    <div className="grid grid-cols-2 gap-3 font-semibold mt-1">
                      <div>
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Pembatal Oleh</span>
                        <p className="mt-0.5 uppercase font-bold">
                          {selectedRes.cancelled_role === "cashier" ? "Kasir" : selectedRes.cancelled_role === "admin" ? "Resto/Admin" : "Pelanggan"}
                          {selectedRes.cancelled_by && ` (${selectedRes.cancelled_by})`}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Waktu Pembatalan</span>
                        <p className="mt-0.5">
                          {selectedRes.cancellation_time 
                            ? format(new Date(selectedRes.cancellation_time), "dd MMM yyyy HH:mm", { locale: localeId }) + " WIB"
                            : "-"}
                        </p>
                      </div>
                    </div>
                    {selectedRes.cancellation_reason && (
                      <div className="pt-2 border-t border-red-200/50 dark:border-red-900/30">
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Alasan Pembatalan / Penolakan</span>
                        <p className="mt-0.5 font-medium text-red-800 dark:text-red-400 leading-relaxed bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-red-200/50 dark:border-red-900/40">
                          {selectedRes.cancellation_reason}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Refund Details */}
                {selectedRes.refund_status && (
                  <div className="p-4 bg-blue-50/50 dark:bg-blue-950/10 border-2 border-blue-200 dark:border-blue-900 rounded-2xl text-xs space-y-3 text-text-light dark:text-text-dark">
                    <p className="font-black text-blue-800 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4 shrink-0" /> Detail Pengembalian Dana
                    </p>
                    <div className="grid grid-cols-2 gap-3 font-semibold">
                      <div>
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Metode Pencairan</span>
                        <p className="mt-0.5 uppercase font-bold text-primary flex items-center gap-1">
                          {selectedRes.refund_method === "dompetku" ? <Wallet className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                          {selectedRes.refund_method === "dompetku" ? "DompetKu" : "Transfer Bank"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Nominal Refund</span>
                        <p className="mt-0.5 font-black text-sm text-primary">
                          Rp {Number(selectedRes.refund_amount || selectedRes.dp_amount || selectedRes.menu_total).toLocaleString("id-ID")}
                        </p>
                      </div>
                      {selectedRes.refund_method !== "dompetku" && selectedRes.refund_bank_account && (
                        <div className="col-span-2 pt-2 border-t border-dashed border-blue-200/50 dark:border-blue-900/30">
                          <span className="text-[10px] text-muted uppercase tracking-wider block">Detail Rekening Tujuan</span>
                          <p className="mt-0.5 font-bold p-2 bg-white dark:bg-gray-900 rounded-lg border border-blue-200/50 dark:border-blue-900/40 font-mono tracking-tight leading-relaxed">
                            {selectedRes.refund_bank_account}
                          </p>
                        </div>
                      )}
                    </div>

                    {selectedRes.refund_reason && (
                      <div className="pt-2 border-t border-dashed border-blue-200/50 dark:border-blue-900/30">
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Alasan Pengajuan Refund</span>
                        <p className="mt-0.5 font-medium leading-relaxed">{selectedRes.refund_reason}</p>
                      </div>
                    )}

                    {selectedRes.refund_proof && (
                      <div className="pt-2 border-t border-dashed border-blue-200/50 dark:border-blue-900/30 space-y-1.5">
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Bukti Transfer Refund</span>
                        <a href={selectedRes.refund_proof} target="_blank" rel="noreferrer" className="block relative rounded-lg overflow-hidden border border-border-light dark:border-border-dark group">
                          <img src={selectedRes.refund_proof} alt="Bukti Transfer" className="object-cover w-full h-32 rounded-lg" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                            <span className="text-white text-[10px] font-black uppercase tracking-wider">Perbesar Bukti</span>
                          </div>
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer close button */}
                <div className="pt-2 border-t border-border-light dark:border-border-dark">
                  <button 
                    type="button" 
                    onClick={() => setSelectedRes(null)}
                    className="w-full py-3.5 bg-gray-100 dark:bg-gray-800 text-muted hover:bg-gray-200 dark:hover:bg-gray-700 font-bold rounded-xl text-center text-xs uppercase tracking-wider transition-all"
                  >
                    Tutup Detail
                  </button>
                </div>
              </div>
            </>
          );
        })()}
      </BaseModal>
    </div>
  );
}
