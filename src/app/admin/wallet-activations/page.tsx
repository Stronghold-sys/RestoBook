"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw,
  Eye, Check, X, Clock, FileText, ChevronRight, Info, Calendar,
  User, Phone, Mail, MapPin, Activity, HelpCircle, ShieldAlert,
  Download, ZoomIn, ShieldCheck, AlertTriangle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import toast from "react-hot-toast";
import BaseModal from "@/components/BaseModal";

type TabType = "diajukan" | "diproses" | "selesai" | "ditolak" | "logs";

export default function AdminWalletActivationsPage() {
  const [loading, setLoading] = useState(true);
  const [activations, setActivations] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("diajukan");
  const [selectedActivation, setSelectedActivation] = useState<any>(null);
  
  // Review Actions state
  const [submittingAction, setSubmittingAction] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  
  // Image zoom modal state
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const supabase = createClient();

  const fetchActivationsAndLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/wallet-activations");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mengambil data");
      setActivations(data.activations || []);
      setLogs(data.logs || []);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivationsAndLogs();

    // Subscribe to realtime updates on wallet_activations and wallet_activation_logs
    const activationsChannel = supabase
      .channel("admin-wallet-activations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallet_activations" },
        () => {
          fetchActivationsAndLogs();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallet_activation_logs" },
        () => {
          fetchActivationsAndLogs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(activationsChannel);
    };
  }, []);

  const handleAction = async (activationId: string, action: "start_review" | "approve" | "reject") => {
    if (action === "reject" && !rejectionReason.trim()) {
      toast.error("Alasan penolakan / catatan revisi wajib diisi untuk tindakan penolakan");
      return;
    }

    setSubmittingAction(true);
    const actionToast = toast.loading("Memproses tindakan...");
    try {
      const response = await fetch("/api/admin/wallet-activations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activationId,
          action,
          rejectionReason: action === "reject" ? rejectionReason : undefined,
          invalidFields: action === "reject" ? invalidFields : undefined
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memproses pengajuan");

      toast.success(data.message || "Status berhasil diperbarui!", { id: actionToast });
      
      // Close detail view & reset fields
      setSelectedActivation(null);
      setRejectionReason("");
      setInvalidFields([]);
      
      // Re-fetch data
      fetchActivationsAndLogs();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui status", { id: actionToast });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleFieldCheck = (field: string) => {
    if (invalidFields.includes(field)) {
      setInvalidFields(prev => prev.filter(f => f !== field));
    } else {
      setInvalidFields(prev => [...prev, field]);
    }
  };

  const checklistOptions = [
    { key: "nik", label: "NIK tidak sesuai atau tidak valid" },
    { key: "ktp_front", label: "Foto KTP Depan buram / terpotong" },
    { key: "ktp_back", label: "Foto KTP Belakang buram / terpotong" },
    { key: "supporting_doc", label: "Dokumen pendukung tidak sah / kadaluwarsa" },
    { key: "full_name", label: "Nama lengkap tidak sesuai identitas KTP" },
    { key: "birth_info", label: "Tempat/Tanggal lahir tidak sesuai identitas" },
    { key: "mother_name", label: "Nama ibu kandung salah atau tidak lengkap" },
    { key: "source_of_funds", label: "Sumber dana utama mencurigakan" },
    { key: "selfie", label: "Foto verifikasi selfie tidak valid" },
  ];

  // Helper to filter activations by tab
  const getFilteredActivations = () => {
    return activations.filter(item => {
      if (activeTab === "diajukan") {
        return item.status === "diajukan" || item.status === "diajukan_ulang";
      }
      if (activeTab === "diproses") {
        return item.status === "diproses";
      }
      if (activeTab === "selesai") {
        return item.status === "selesai" || item.status === "diterima";
      }
      if (activeTab === "ditolak") {
        return item.status === "ditolak";
      }
      return false;
    });
  };

  const filteredItems = getFilteredActivations();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-3">
            <Wallet className="w-8 h-8" /> Aktivasi Dompetku
          </h1>
          <p className="text-muted text-sm mt-1">
            Tinjau dan verifikasi pengajuan data diri pelanggan untuk mengaktifkan wallet internal.
          </p>
        </div>
        <button
          onClick={fetchActivationsAndLogs}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl text-muted hover:text-primary transition-all self-start md:self-auto hover:scale-105"
        >
          <RefreshCw className="w-4 h-4" /> Refresh Data
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-light dark:border-border-dark pb-4 overflow-x-auto whitespace-nowrap scrollbar-none">
        {[
          { key: "diajukan", label: "Pengajuan Baru", count: activations.filter(a => ["diajukan", "diajukan_ulang"].includes(a.status)).length },
          { key: "diproses", label: "Sedang Diproses", count: activations.filter(a => a.status === "diproses").length },
          { key: "selesai", label: "Disetujui", count: activations.filter(a => ["selesai", "diterima"].includes(a.status)).length },
          { key: "ditolak", label: "Ditolak", count: activations.filter(a => a.status === "ditolak").length },
          { key: "logs", label: "Riwayat Audit", count: null }
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setActiveTab(t.key as TabType);
              setSelectedActivation(null);
            }}
            className={`shrink-0 whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all border ${
              activeTab === t.key
                ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                : "bg-card-light text-muted dark:bg-card-dark border-border-light dark:border-border-dark hover:text-text-light dark:hover:text-text-dark"
            }`}
          >
            {t.label} {t.count !== null && <span className="ml-1 px-1.5 py-0.5 bg-black/10 dark:bg-white/10 rounded-md text-[10px]">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main List */}
        <div className={`lg:col-span-2 space-y-4 ${selectedActivation ? "hidden lg:block" : "block"}`}>
          {activeTab === "logs" ? (
            /* Audit Logs View */
            <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 shadow-xl space-y-6">
              <h3 className="text-lg font-extrabold text-text-light dark:text-text-dark flex items-center gap-2 border-b border-border-light dark:border-border-dark pb-4">
                <Activity className="w-5 h-5 text-primary" /> Log Riwayat Audit
              </h3>
              {logs.length === 0 ? (
                <div className="text-center py-10 text-muted">
                  <Info className="w-10 h-10 mx-auto text-muted/40 mb-2" />
                  <p className="text-xs">Tidak ada log aktivitas audit yang terekam.</p>
                </div>
              ) : (
                <div className="flow-root">
                  <ul className="-mb-8">
                    {logs.map((log, idx) => (
                      <li key={log.id}>
                        <div className="relative pb-8">
                          {idx !== logs.length - 1 && (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-800" aria-hidden="true" />
                          )}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-card-light dark:ring-card-dark ${
                                log.action === "approve" ? "bg-green-100 text-green-600" :
                                log.action === "reject" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"
                              }`}>
                                {log.action === "approve" ? <CheckCircle2 className="w-4 h-4" /> :
                                 log.action === "reject" ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-xs text-text-light dark:text-text-dark font-semibold">
                                  {log.notes}
                                </p>
                                <span className="text-[10px] text-muted font-medium mt-0.5 block">
                                  Oleh Admin: {log.admin?.full_name || "Sistem"} &middot; Status: {log.from_status} &rarr; {log.to_status}
                                </span>
                              </div>
                              <div className="text-right text-[10px] whitespace-nowrap text-muted font-bold">
                                {format(new Date(log.created_at), "dd MMM yyyy, HH:mm", { locale: localeId })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            /* Activations List */
            <>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
                  <span className="text-muted text-xs">Memuat daftar pengajuan...</span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl text-center p-6">
                  <AlertCircle className="w-12 h-12 text-muted/40 mb-3" />
                  <span className="font-bold text-sm text-text-light dark:text-text-dark">Tidak ada pengajuan</span>
                  <span className="text-xs text-muted mt-1">Pengajuan dengan kriteria ini kosong atau telah diproses.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedActivation(item);
                        setRejectionReason(item.rejection_reason || "");
                        try {
                          setInvalidFields(typeof item.invalid_fields === 'string' ? JSON.parse(item.invalid_fields) : (item.invalid_fields || []));
                        } catch (e) {
                          setInvalidFields([]);
                        }
                      }}
                      className={`p-5 rounded-3xl border text-left cursor-pointer transition-all hover:shadow-lg ${
                        selectedActivation?.id === item.id
                          ? "border-primary bg-primary/5 dark:bg-primary/5 shadow-md"
                          : "border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark hover:border-primary/50"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <div>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                            item.status === "diajukan_ulang" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
                            item.status === "diajukan" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" :
                            item.status === "diproses" ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400" :
                            item.status === "selesai" || item.status === "diterima" ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" :
                            "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                          }`}>
                            {item.status === "diajukan_ulang" ? "Pengajuan Ulang" :
                             (item.status === "selesai" || item.status === "diterima") ? "Aktif" :
                             item.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted font-bold">
                          {format(new Date(item.updated_at), "dd MMM yyyy", { locale: localeId })}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-sm text-text-light dark:text-text-dark">{item.profiles?.full_name || item.full_name}</h4>
                      <p className="text-[11px] text-muted mt-0.5">{item.profiles?.email || item.email}</p>
                      
                      <div className="mt-4 pt-3 border-t border-border-light/60 dark:border-border-dark/60 flex justify-between items-center text-xs">
                        <div>
                          <span className="text-[10px] text-muted font-semibold block">NIK</span>
                          <span className="font-mono font-bold">{item.nik}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail Panel */}
        <div className={`lg:col-span-1 ${selectedActivation ? "block" : "hidden lg:block"}`}>
          {selectedActivation ? (
            <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 shadow-xl space-y-6 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center border-b border-border-light dark:border-border-dark pb-4">
                <h3 className="font-extrabold text-base text-text-light dark:text-text-dark flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" /> Rincian Pengajuan
                </h3>
                <button
                  onClick={() => setSelectedActivation(null)}
                  className="p-1 text-muted hover:text-text-light dark:hover:text-text-dark rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all lg:hidden"
                  title="Tutup Detail Pengajuan"
                  aria-label="Tutup Detail Pengajuan"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Banner */}
              <div className={`p-4 rounded-2xl text-xs flex gap-2.5 items-start ${
                selectedActivation.status === "diajukan_ulang" ? "bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400" :
                selectedActivation.status === "diajukan" ? "bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-400" :
                selectedActivation.status === "diproses" ? "bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-400" :
                selectedActivation.status === "selesai" || selectedActivation.status === "diterima" ? "bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400" :
                "bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400"
              }`}>
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold uppercase tracking-wider">
                    Status: {selectedActivation.status === "diajukan_ulang" ? "Diajukan Ulang" :
                             (selectedActivation.status === "selesai" || selectedActivation.status === "diterima") ? "Aktif" :
                             selectedActivation.status}
                  </p>
                  <p className="mt-0.5 text-muted leading-relaxed">
                    {selectedActivation.status === "diajukan" ? "Pengajuan baru terdaftar dan menunggu proses verifikasi." :
                     selectedActivation.status === "diajukan_ulang" ? "Pengguna telah memperbaiki data yang salah dan mengirimkan kembali." :
                     selectedActivation.status === "diproses" ? "Pengajuan sedang ditinjau oleh tim administrator." :
                     selectedActivation.status === "selesai" || selectedActivation.status === "diterima" ? "Telah disetujui. Akun Dompetku pelanggan sekarang aktif." :
                     `Pengajuan ditolak. Alasan: ${selectedActivation.rejection_reason}`}
                  </p>
                </div>
              </div>

              {/* Detail Data */}
              <div className="space-y-5 text-left text-xs">
                {/* 1. Informasi Pribadi */}
                <div className="space-y-3">
                  <h4 className="font-black text-[10px] text-primary uppercase tracking-widest border-b border-border-light/40 dark:border-border-dark/40 pb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Informasi Pribadi
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <span className="text-muted block text-[10px]">Nama Lengkap</span>
                      <span className="font-bold text-text-light dark:text-text-dark">{selectedActivation.full_name}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">NIK</span>
                      <span className="font-mono font-bold text-text-light dark:text-text-dark">{selectedActivation.nik}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Tempat, Tgl Lahir</span>
                      <span className="font-bold text-text-light dark:text-text-dark">
                        {selectedActivation.birth_place}, {format(new Date(selectedActivation.birth_date), "dd MMM yyyy", { locale: localeId })}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Jenis Kelamin</span>
                      <span className="font-bold text-text-light dark:text-text-dark">{selectedActivation.gender === "male" ? "Laki-laki" : "Perempuan"}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Status Pernikahan</span>
                      <span className="font-bold text-text-light dark:text-text-dark">{selectedActivation.marital_status}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Kewarganegaraan</span>
                      <span className="font-bold text-text-light dark:text-text-dark uppercase">{selectedActivation.nationality}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Agama</span>
                      <span className="font-bold text-text-light dark:text-text-dark capitalize">{selectedActivation.religion}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Pekerjaan</span>
                      <span className="font-bold text-text-light dark:text-text-dark">{selectedActivation.occupation}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted block text-[10px]">Nama Ibu Kandung</span>
                      <span className="font-bold text-text-light dark:text-text-dark">{selectedActivation.mother_name}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Kontak & Alamat */}
                <div className="space-y-3">
                  <h4 className="font-black text-[10px] text-primary uppercase tracking-widest border-b border-border-light/40 dark:border-border-dark/40 pb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> Kontak & Alamat
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <span className="text-muted block text-[10px]">No. Telepon</span>
                      <span className="font-mono font-bold text-text-light dark:text-text-dark flex items-center gap-1">
                        <Phone className="w-3 h-3 text-muted" /> {selectedActivation.phone}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Email</span>
                      <span className="font-bold text-text-light dark:text-text-dark flex items-center gap-1 truncate" title={selectedActivation.email}>
                        <Mail className="w-3 h-3 text-muted shrink-0" /> {selectedActivation.email}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted block text-[10px]">Alamat Lengkap</span>
                      <span className="font-bold text-text-light dark:text-text-dark">{selectedActivation.address} &middot; RT/RW {selectedActivation.rt_rw}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Kelurahan / Desa</span>
                      <span className="font-bold text-text-light dark:text-text-dark">{selectedActivation.village}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Kecamatan</span>
                      <span className="font-bold text-text-light dark:text-text-dark">{selectedActivation.district}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Kota / Kabupaten</span>
                      <span className="font-bold text-text-light dark:text-text-dark">{selectedActivation.regency}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Provinsi</span>
                      <span className="font-bold text-text-light dark:text-text-dark">{selectedActivation.province}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Kode Pos</span>
                      <span className="font-mono font-bold text-text-light dark:text-text-dark">{selectedActivation.postal_code}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Verifikasi Keuangan */}
                <div className="space-y-3">
                  <h4 className="font-black text-[10px] text-primary uppercase tracking-widest border-b border-border-light/40 dark:border-border-dark/40 pb-1 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> Data Dompet & Verifikasi
                  </h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                      <span className="text-muted block text-[10px]">Nama Sesuai KTP</span>
                      <span className="font-bold text-text-light dark:text-text-dark">{selectedActivation.ktp_name}</span>
                    </div>
                    <div>
                      <span className="text-muted block text-[10px]">Nomor KTP</span>
                      <span className="font-mono font-bold text-text-light dark:text-text-dark">{selectedActivation.ktp_number}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted block text-[10px]">Tujuan Penggunaan</span>
                      <span className="font-bold text-text-light dark:text-text-dark">{selectedActivation.purpose}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted block text-[10px]">Sumber Dana Utama</span>
                      <span className="font-bold text-text-light dark:text-text-dark capitalize">{selectedActivation.source_of_funds.replace("_", " ")}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Dokumen KTP & Dokumen Pendukung */}
                <div className="space-y-3">
                  <h4 className="font-black text-[10px] text-primary uppercase tracking-widest border-b border-border-light/40 dark:border-border-dark/40 pb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Lampiran Dokumen
                  </h4>
                  
                  <div className="space-y-3">
                    {/* Front KTP */}
                    <div>
                      <span className="text-muted block text-[10px] mb-1">Foto KTP Depan</span>
                      {selectedActivation.ktp_front_url ? (
                        <div className="relative group overflow-hidden border border-border-light dark:border-border-dark rounded-xl aspect-[1.6/1] bg-muted/20">
                          <img src={selectedActivation.ktp_front_url} alt="KTP Depan" className="object-cover w-full h-full" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setZoomImage(selectedActivation.ktp_front_url)}
                              className="p-2 bg-white/20 hover:bg-white/35 rounded-xl text-white backdrop-blur-sm"
                              title="Zoom Foto KTP Depan"
                              aria-label="Zoom Foto KTP Depan"
                            >
                              <ZoomIn className="w-4 h-4" />
                            </button>
                            <a
                              href={selectedActivation.ktp_front_url}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-white/20 hover:bg-white/35 rounded-xl text-white backdrop-blur-sm"
                              title="Unduh Foto KTP Depan"
                              aria-label="Unduh Foto KTP Depan"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 border border-dashed rounded-xl text-center text-rose-500 font-bold bg-rose-50/20">
                          <XCircle className="w-4 h-4 mx-auto text-rose-500 mb-1" />
                          KTP Depan Tidak Diunggah
                        </div>
                      )}
                    </div>

                    {/* Back KTP */}
                    <div>
                      <span className="text-muted block text-[10px] mb-1">Foto KTP Belakang</span>
                      {selectedActivation.ktp_back_url ? (
                        <div className="relative group overflow-hidden border border-border-light dark:border-border-dark rounded-xl aspect-[1.6/1] bg-muted/20">
                          <img src={selectedActivation.ktp_back_url} alt="KTP Belakang" className="object-cover w-full h-full" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => setZoomImage(selectedActivation.ktp_back_url)}
                              className="p-2 bg-white/20 hover:bg-white/35 rounded-xl text-white backdrop-blur-sm"
                              title="Zoom Foto KTP Belakang"
                              aria-label="Zoom Foto KTP Belakang"
                            >
                              <ZoomIn className="w-4 h-4" />
                            </button>
                            <a
                              href={selectedActivation.ktp_back_url}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-white/20 hover:bg-white/35 rounded-xl text-white backdrop-blur-sm"
                              title="Unduh Foto KTP Belakang"
                              aria-label="Unduh Foto KTP Belakang"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl text-center text-muted font-bold">
                          KTP Belakang Opsional / Tidak Diunggah
                        </div>
                      )}
                    </div>

                    {/* Supporting Doc */}
                    <div>
                      <span className="text-muted block text-[10px] mb-1">Dokumen Pendukung Lain</span>
                      {selectedActivation.supporting_doc_url ? (
                        <div className="relative group overflow-hidden border border-border-light dark:border-border-dark rounded-xl aspect-[1.6/1] bg-muted/20">
                          {selectedActivation.supporting_doc_url.toLowerCase().endsWith(".pdf") ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-4">
                              <FileText className="w-8 h-8 text-primary mb-1" />
                              <span className="text-[10px] font-bold text-center">Dokumen PDF</span>
                            </div>
                          ) : (
                            <img src={selectedActivation.supporting_doc_url} alt="Dokumen Pendukung" className="object-cover w-full h-full" />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                            {!selectedActivation.supporting_doc_url.toLowerCase().endsWith(".pdf") && (
                              <button
                                type="button"
                                onClick={() => setZoomImage(selectedActivation.supporting_doc_url)}
                                className="p-2 bg-white/20 hover:bg-white/35 rounded-xl text-white backdrop-blur-sm"
                                title="Zoom Dokumen Pendukung"
                                aria-label="Zoom Dokumen Pendukung"
                              >
                                <ZoomIn className="w-4 h-4" />
                              </button>
                            )}
                            <a
                              href={selectedActivation.supporting_doc_url}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 bg-white/20 hover:bg-white/35 rounded-xl text-white backdrop-blur-sm"
                              title="Unduh Dokumen Pendukung"
                              aria-label="Unduh Dokumen Pendukung"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl text-center text-muted font-bold">
                          Dokumen Pendukung Lain Tidak Diunggah
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Review Section */}
              {["diajukan", "diajukan_ulang", "diproses"].includes(selectedActivation.status) && (
                <div className="pt-6 border-t border-border-light dark:border-border-dark space-y-4 text-left">
                  <h4 className="font-extrabold text-sm text-text-light dark:text-text-dark flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500" /> Panel Keputusan Admin
                  </h4>

                  <div className="space-y-4">
                    {/* Invalid fields checklist */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-muted tracking-widest block">Tandai Data/Dokumen Salah (Revisian)</label>
                      <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto custom-scrollbar p-1">
                        {checklistOptions.map(opt => (
                          <label
                            key={opt.key}
                            className={`flex items-center gap-2 px-3 py-2 border rounded-xl cursor-pointer text-xs font-semibold select-none transition-all ${
                              invalidFields.includes(opt.key)
                                ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400"
                                : "bg-background-light dark:bg-background-dark border-border-light dark:border-border-dark text-text-light dark:text-text-dark hover:border-primary/50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={invalidFields.includes(opt.key)}
                              onChange={() => handleFieldCheck(opt.key)}
                              className="rounded border-border-light dark:border-border-dark text-red-600 focus:ring-red-600"
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Rejection / Note Input */}
                    <div className="space-y-1.5">
                      <label htmlFor="rejectionReasonInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">Alasan Penolakan / Catatan Revisi</label>
                      <textarea
                        id="rejectionReasonInput"
                        rows={3}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Contoh: Foto KTP depan buram dan tidak terbaca. Harap unggah ulang."
                        className="w-full text-xs p-3.5 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(selectedActivation.id, "reject")}
                        disabled={submittingAction}
                        className="flex-1 py-3 bg-danger hover:bg-danger-hover text-white font-black text-xs rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                      >
                        {submittingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <><X className="w-4 h-4" /> Tolak Pengajuan</>}
                      </button>
                      <button
                        onClick={() => handleAction(selectedActivation.id, "approve")}
                        disabled={submittingAction}
                        className="flex-1 py-3 bg-success hover:bg-success-hover text-white font-black text-xs rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-success/15 disabled:opacity-50"
                      >
                        {submittingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Setujui Aktivasi</>}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 text-center text-muted min-h-[300px] flex flex-col justify-center items-center">
              <Wallet className="w-12 h-12 text-muted/40 mb-3" />
              <h3 className="font-extrabold text-sm text-text-light dark:text-text-dark">Pilih Data Pengajuan</h3>
              <p className="text-xs text-muted max-w-[200px] mt-1 leading-relaxed">
                Silakan pilih salah satu pengajuan di list sebelah kiri untuk memproses data.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Zoom Modal */}
      <BaseModal isOpen={!!zoomImage} onClose={() => setZoomImage(null)} size="full" noPadding={true} showCloseButton={false}>
        <div className="relative w-full h-full flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <button 
            onClick={() => setZoomImage(null)} 
            className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/85 rounded-xl text-white backdrop-blur-sm z-50 transition-all"
            title="Tutup Preview Gambar"
            aria-label="Tutup Preview Gambar"
          >
            <X className="w-6 h-6" />
          </button>
          {zoomImage && <img src={zoomImage} alt="Zoom Preview" className="object-contain max-w-full max-h-full rounded-2xl" />}
        </div>
      </BaseModal>
    </div>
  );
}
