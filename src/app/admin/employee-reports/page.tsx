"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { 
  FileText, Search, Filter, Clock, Check, X, 
  ArrowRight, Info, AlertTriangle, Eye, Loader2, 
  User, CheckCircle2, MessageSquare, ChevronRight
} from "lucide-react";
import BaseModal from "@/components/BaseModal";
import toast from "react-hot-toast";

export default function AdminEmployeeReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "processing" | "completed" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [actionComment, setActionComment] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [processing, setProcessing] = useState(false);

  const supabase = createClient();

  const fetchReports = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch reports with joining profiles data
      const { data, error } = await supabase
        .from("employee_data_reports")
        .select(`
          *,
          profiles:profile_id (
            id,
            full_name,
            email,
            employee_id,
            role,
            phone,
            jabatan,
            avatar_url
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err: any) {
      toast.error("Gagal memuat laporan data karyawan: " + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchReports();

    // Realtime Listener
    const channel = supabase
      .channel("admin-employee-reports-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "employee_data_reports" },
        (payload: any) => {
          fetchReports(true); // silent refresh
          
          if (payload.eventType === "INSERT") {
            toast.success("Ada laporan kesalahan data karyawan baru masuk!", {
              icon: "📣",
              duration: 5000
            });
            // Mainkan notif sound jika diperlukan
            try {
              const audio = new Audio("/assets/sounds/notification.mp3");
              audio.play().catch(() => {});
            } catch (soundErr) {}
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReports, supabase]);

  const handleAction = async (action: "approve" | "reject" | "process") => {
    if (action === "reject" && !actionComment.trim()) {
      toast.error("Silakan masukkan komentar alasan penolakan.");
      return;
    }

    setProcessing(true);
    const toastId = toast.loading("Sedang memproses laporan...");
    try {
      const res = await fetch("/api/admin/employee-reports/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_id: selectedReport.id,
          action,
          admin_comment: actionComment
        })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Gagal memproses");

      toast.success(
        action === "approve" ? "Laporan berhasil disetujui, profil karyawan diperbarui!" :
        action === "reject" ? "Laporan berhasil ditolak." : "Laporan ditandai sedang diproses.",
        { id: toastId }
      );

      setSelectedReport(null);
      setActionComment("");
      setShowRejectForm(false);
      fetchReports();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusLabel = (status: string) => {
    let colorClass = "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200/50";
    let text = "Menunggu";

    if (status === 'completed') {
      colorClass = "bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400 border-green-200/50";
      text = "Selesai";
    } else if (status === 'rejected') {
      colorClass = "bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400 border-red-200/50";
      text = "Ditolak";
    } else if (status === 'processing') {
      colorClass = "bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400 border-blue-200/50";
      text = "Diproses";
    }

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${colorClass}`}>
        {text}
      </span>
    );
  };

  // Filtered reports
  const filteredReports = reports.filter(r => {
    const matchesTab = activeTab === "all" || r.status === activeTab;
    const matchesSearch = 
      r.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.profiles?.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border-light dark:border-border-dark pb-6">
        <div>
          <h1 className="text-2xl font-black text-text-light dark:text-text-dark uppercase tracking-tight flex items-center gap-2">
            <FileText className="w-7 h-7 text-primary" /> Laporan Kesalahan Data Karyawan
          </h1>
          <p className="text-muted text-xs font-medium mt-0.5">Tinjau, setujui, dan koreksi kesalahan data profil karyawan secara instan & realtime</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Tab Buttons */}
        <div className="flex flex-wrap gap-1.5 bg-gray-50 dark:bg-gray-900/50 p-1.5 rounded-2xl border border-border-light dark:border-border-dark w-full md:w-auto">
          {[
            { key: "all", label: "Semua" },
            { key: "pending", label: "Menunggu" },
            { key: "processing", label: "Diproses" },
            { key: "completed", label: "Selesai" },
            { key: "rejected", label: "Ditolak" }
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                  isActive
                    ? "bg-primary text-white shadow-lg shadow-primary/20"
                    : "text-muted hover:bg-gray-150 dark:hover:bg-gray-800"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-muted absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Cari karyawan atau isi laporan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900/40 border border-border-light dark:border-border-dark focus:border-primary rounded-2xl outline-none font-medium text-xs text-text-light dark:text-text-dark transition-colors"
          />
        </div>

      </div>

      {/* Main Grid List Laporan */}
      {loading ? (
        <div className="text-center py-20">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted font-bold">Memuat laporan data karyawan...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="text-center py-16 bg-card-light dark:bg-card-dark rounded-3xl border border-dashed border-border-light dark:border-border-dark italic text-xs text-muted">
          Tidak ada laporan data karyawan yang ditemukan.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((report) => (
            <motion.div
              layout
              key={report.id}
              onClick={() => {
                setSelectedReport(report);
                setActionComment("");
                setShowRejectForm(false);
              }}
              className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-6 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col justify-between h-full space-y-4"
            >
              <div className="space-y-3">
                {/* Header Card: Profil Pengirim */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black border border-primary/20 text-lg shrink-0 overflow-hidden">
                    {report.profiles?.avatar_url ? (
                      <img src={report.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      report.profiles?.full_name?.charAt(0).toUpperCase() || "K"
                    )}
                  </div>
                  <div>
                    <h3 className="font-black text-text-light dark:text-text-dark text-xs uppercase tracking-wide truncate max-w-[180px]">{report.profiles?.full_name}</h3>
                    <p className="text-[10px] text-muted font-mono">{report.profiles?.employee_id || "-"}</p>
                  </div>
                </div>

                {/* Status & Date */}
                <div className="flex items-center justify-between text-[10px]">
                  {getStatusLabel(report.status)}
                  <span className="text-muted font-bold font-mono">
                    {new Date(report.created_at).toLocaleString('id-ID', { dateStyle: 'medium' })}
                  </span>
                </div>

                {/* Fields reported */}
                <div>
                  <span className="text-[9px] font-black uppercase text-muted tracking-wider block mb-1">Kolom yang Salah</span>
                  <div className="flex flex-wrap gap-1">
                    {report.reported_fields.map((f: string) => (
                      <span key={f} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[9px] font-black uppercase rounded">
                        {f === 'full_name' ? 'Nama' : f === 'phone' ? 'No. Telepon' : f}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Deskripsi deskriptif */}
                <div>
                  <span className="text-[9px] font-black uppercase text-muted tracking-wider block mb-0.5">Penjelasan</span>
                  <p className="text-xs text-text-light dark:text-text-dark font-medium line-clamp-2 italic leading-relaxed">
                    &quot;{report.description}&quot;
                  </p>
                </div>
              </div>

              {/* Action Trigger Link */}
              <div className="flex items-center justify-end text-primary text-[10px] font-black uppercase tracking-wider pt-3 border-t border-border-light dark:border-border-dark mt-2">
                <span>Tinjau Laporan</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </div>

            </motion.div>
          ))}
        </div>
      )}

      {/* DETAIL MODAL TINJAUAN LAPORAN KARYAWAN */}
      <BaseModal
        isOpen={!!selectedReport}
        onClose={() => {
          setSelectedReport(null);
          setActionComment("");
          setShowRejectForm(false);
        }}
        size="lg"
        title="Tinjau Laporan Kesalahan Data"
      >
        {selectedReport && (
          <div className="space-y-6">
            
            {/* Profil Pelapor */}
            <div className="bg-gray-50 dark:bg-gray-900/40 p-4 rounded-2xl border border-border-light dark:border-border-dark flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black border border-primary/20 text-xl shrink-0 overflow-hidden">
                {selectedReport.profiles?.avatar_url ? (
                  <img src={selectedReport.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  selectedReport.profiles?.full_name?.charAt(0).toUpperCase() || "K"
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 flex-1 text-xs">
                <div>
                  <span className="text-[9px] font-black uppercase text-muted block">Nama Lengkap</span>
                  <span className="font-bold text-text-light dark:text-text-dark">{selectedReport.profiles?.full_name}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black uppercase text-muted block">ID Karyawan</span>
                  <span className="font-bold text-text-light dark:text-text-dark font-mono">{selectedReport.profiles?.employee_id || "-"}</span>
                </div>
                <div className="mt-1">
                  <span className="text-[9px] font-black uppercase text-muted block">Email</span>
                  <span className="font-bold text-text-light dark:text-text-dark truncate block max-w-[150px]">{selectedReport.profiles?.email}</span>
                </div>
                <div className="mt-1">
                  <span className="text-[9px] font-black uppercase text-muted block">Role / Jabatan</span>
                  <span className="font-bold text-text-light dark:text-text-dark capitalize">{selectedReport.profiles?.role} ({selectedReport.profiles?.jabatan || "-"})</span>
                </div>
              </div>
            </div>

            {/* Perbandingan Data (Current vs Proposed) */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase text-text-light dark:text-text-dark tracking-wider">Perbandingan Nilai Data</h4>
              
              <div className="border border-border-light dark:border-border-dark rounded-2xl overflow-hidden divide-y divide-border-light dark:divide-border-dark">
                {selectedReport.reported_fields.map((field: string) => {
                  const currentVal = selectedReport.current_values[field] || "-";
                  const proposedVal = selectedReport.proposed_values[field] || "-";

                  return (
                    <div key={field} className="grid grid-cols-3 p-4 text-xs items-center gap-4 bg-white dark:bg-gray-950">
                      <div className="font-bold uppercase text-muted text-[10px] tracking-wider">
                        {field === 'full_name' ? 'Nama Lengkap' : field === 'phone' ? 'No. Telepon' : field}
                      </div>
                      <div className="text-red-650 dark:text-red-400 font-bold bg-red-500/5 px-3 py-2 rounded-xl border border-red-500/10 truncate" title={currentVal}>
                        {currentVal}
                      </div>
                      <div className="text-green-650 dark:text-green-400 font-bold bg-green-500/5 px-3 py-2 rounded-xl border border-green-500/10 truncate flex items-center justify-between" title={proposedVal}>
                        <span>{proposedVal}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-green-500" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Deskripsi & Bukti */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl text-xs space-y-1.5">
                <span className="text-[9px] font-black uppercase text-amber-700 dark:text-amber-500 tracking-wider block">Penjelasan Karyawan</span>
                <p className="font-semibold text-text-light dark:text-text-dark leading-relaxed italic">&quot;{selectedReport.description}&quot;</p>
              </div>

              {selectedReport.attachment_url ? (
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-border-light dark:border-border-dark text-xs flex flex-col justify-between h-full">
                  <div>
                    <span className="text-[9px] font-black uppercase text-muted block mb-1">Bukti Dokumen Lampiran</span>
                    <p className="text-[11px] font-medium text-muted">Karyawan melampirkan berkas bukti pendukung.</p>
                  </div>
                  <a
                    href={selectedReport.attachment_url}
                    target="_blank"
                    className="mt-3 py-2 bg-indigo-500 text-white rounded-xl font-bold text-center block text-[10px] uppercase tracking-wider hover:bg-indigo-650 transition-colors"
                  >
                    Buka Lampiran Bukti
                  </a>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-border-light dark:border-border-dark text-xs flex items-center justify-center italic text-muted text-center">
                  Tidak ada berkas bukti dilampirkan.
                </div>
              )}
            </div>

            {/* Keterangan Admin sebelumnya / komentar */}
            {selectedReport.admin_comment && (
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-250/30 text-xs">
                <span className="text-[9px] font-black uppercase text-indigo-650 dark:text-indigo-400 block mb-1">Komentar / Log Admin</span>
                <p className="font-semibold text-indigo-700 dark:text-indigo-300">{selectedReport.admin_comment}</p>
              </div>
            )}

            {/* Aksi Form untuk Penolakan */}
            {showRejectForm && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2.5 pt-4 border-t border-border-light dark:border-border-dark"
              >
                <label className="block text-xs font-black uppercase text-red-600 dark:text-red-400 tracking-wider">Masukkan Alasan Penolakan</label>
                <textarea
                  placeholder="Masukkan alasan penolakan perbaikan data karyawan di sini..."
                  rows={2}
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  className="w-full p-3 bg-red-500/5 border border-red-500/10 focus:border-red-500 rounded-2xl text-xs outline-none font-medium text-text-light dark:text-text-dark resize-none transition-colors"
                />
              </motion.div>
            )}

            {/* Tombol Aksi Utama */}
            {selectedReport.status !== 'completed' && selectedReport.status !== 'rejected' && (
              <div className="flex flex-wrap gap-3 pt-4 border-t border-border-light dark:border-border-dark">
                {!showRejectForm ? (
                  <>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => handleAction("approve")}
                      className="flex-1 min-w-[120px] py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Check className="w-4 h-4" /> Setujui (ACC)
                    </button>

                    {selectedReport.status === 'pending' && (
                      <button
                        type="button"
                        disabled={processing}
                        onClick={() => handleAction("process")}
                        className="flex-1 min-w-[120px] py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Clock className="w-4 h-4" /> Proses
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => setShowRejectForm(true)}
                      className="flex-1 min-w-[120px] py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <X className="w-4 h-4" /> Tolak
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => setShowRejectForm(false)}
                      className="flex-1 py-3.5 bg-gray-150 dark:bg-gray-800 text-text-light dark:text-text-dark rounded-2xl font-black text-xs uppercase tracking-wider transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => handleAction("reject")}
                      className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <X className="w-4 h-4" /> Konfirmasi Tolak
                    </button>
                  </>
                )}
              </div>
            )}

          </div>
        )}
      </BaseModal>

    </div>
  );
}
