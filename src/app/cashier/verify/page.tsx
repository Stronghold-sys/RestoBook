"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { 
  User, Mail, Phone, Shield, FileText, AlertTriangle, 
  CheckCircle2, Loader2, LogOut, Send, Clock, 
  ChevronRight, Upload, X, ShieldCheck, Shuffle
} from "lucide-react";
import BaseModal from "@/components/BaseModal";
import toast from "react-hot-toast";

export default function CashierVerifyPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  // Form states
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [proposedValues, setProposedValues] = useState<any>({
    full_name: "",
    email: "",
    phone: "",
    employee_id: "",
    role: "",
    jabatan: ""
  });
  const [description, setDescription] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const supabase = createClient();

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      setProfile(data);
      
      // Auto redirect jika sudah diverifikasi
      if (data.data_verified) {
        window.location.href = `/${data.role}/dashboard`;
      }
    } catch (err: any) {
      toast.error("Gagal memuat profil: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const fetchReports = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from("employee_data_reports")
        .select("*")
        .eq("profile_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err: any) {
      console.error("Gagal memuat riwayat laporan:", err.message);
    } finally {
      setLoadingReports(false);
    }
  }, [profile?.id, supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile?.id) {
      fetchReports();

      // Realtime subscription untuk profil
      const profileChannel = supabase
        .channel(`verify-profile-realtime-${profile.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${profile.id}` },
          (payload) => {
            setProfile(payload.new);
            if (payload.new.data_verified) {
              toast.success("Data profil Anda telah diverifikasi! Mengalihkan...", { duration: 4000 });
              setTimeout(() => {
                window.location.href = `/${payload.new.role}/dashboard`;
              }, 1500);
            }
          }
        )
        .subscribe();

      // Realtime subscription untuk laporan
      const reportChannel = supabase
        .channel(`verify-reports-realtime-${profile.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "employee_data_reports", filter: `profile_id=eq.${profile.id}` },
          () => {
            fetchReports();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(profileChannel);
        supabase.removeChannel(reportChannel);
      };
    }
  }, [profile?.id, fetchReports, fetchProfile, supabase]);

  const handleConfirm = async () => {
    setConfirming(true);
    const toastId = toast.loading("Mengonfirmasi data Anda...");
    try {
      const res = await fetch("/api/cashier/verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Gagal mengonfirmasi");

      toast.success("Verifikasi data berhasil dikonfirmasi!", { id: toastId });
      setTimeout(() => {
        window.location.href = `/${profile.role}/dashboard`;
      }, 1000);
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setConfirming(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('API logout failed', e);
    }
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleFieldToggle = (field: string) => {
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter(f => f !== field));
      setProposedValues({
        ...proposedValues,
        [field]: ""
      });
    } else {
      setSelectedFields([...selectedFields, field]);
      setProposedValues({
        ...proposedValues,
        [field]: profile[field] || ""
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran berkas maksimal adalah 5MB");
      return;
    }

    setUploading(true);
    const toastId = toast.loading("Mengunggah berkas...");
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `verification-proofs/${fileName}`;

      const { data, error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(filePath, file);

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      setAttachmentUrl(publicUrl);
      toast.success("Bukti berhasil diunggah!", { id: toastId });
    } catch (err: any) {
      toast.error("Gagal mengunggah bukti: " + err.message, { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFields.length === 0) {
      toast.error("Silakan pilih data mana yang salah.");
      return;
    }
    if (!description.trim()) {
      toast.error("Silakan berikan deskripsi penjelasan kesalahan.");
      return;
    }

    setReporting(true);
    const toastId = toast.loading("Mengirim laporan...");

    // Filter proposed values only for selected fields
    const filteredProposed: any = {};
    const filteredCurrent: any = {};
    selectedFields.forEach(field => {
      filteredProposed[field] = proposedValues[field];
      filteredCurrent[field] = profile[field];
    });

    try {
      const res = await fetch("/api/cashier/verify/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reported_fields: selectedFields,
          current_values: filteredCurrent,
          proposed_values: filteredProposed,
          description,
          attachment_url: attachmentUrl
        })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Gagal mengirim laporan");

      toast.success("Laporan berhasil dikirim ke Admin!", { id: toastId });
      setShowReportModal(false);
      setSelectedFields([]);
      setDescription("");
      setAttachmentUrl("");
      fetchProfile();
      fetchReports();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setReporting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    let colorClass = "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200/50";
    let text = "Menunggu";

    if (status === 'completed') {
      colorClass = "bg-green-100 text-green-800 dark:bg-green-950/30 dark:text-green-400 border-green-200/50";
      text = "Selesai";
    } else if (status === 'rejected') {
      colorClass = "bg-red-100 text-red-800 dark:bg-red-950/30 dark:text-red-400 border-red-200/50";
      text = "Ditolak";
    } else if (status === 'processing') {
      colorClass = "bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400 border-blue-200/50";
      text = "Diproses";
    }

    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${colorClass}`}>
        {text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted font-bold">Memuat profil verifikasi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <div className="max-w-4xl w-full space-y-8">
        
        {/* Header Section */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="w-20 h-20 bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/25"
          >
            <Shield className="w-10 h-10" />
          </motion.div>
          <h1 className="text-3xl font-black text-text-light dark:text-text-dark tracking-tight uppercase">Verifikasi Identitas Anda</h1>
          <p className="text-sm text-muted mt-2 max-w-lg mx-auto font-medium">
            Harap periksa kembali detail data akun Anda sebelum masuk ke sistem utama RestoBook.
          </p>
        </div>

        {/* Pending Laporan Alert Banner */}
        {profile?.verification_status === 'report_submitted' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-amber-50 dark:bg-amber-950/10 border-l-4 border-amber-500 rounded-r-2xl flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-black text-amber-850 dark:text-amber-400 uppercase tracking-wide">Laporan Kesalahan Sedang Ditinjau</p>
              <p className="text-xs text-amber-700 dark:text-amber-450 font-medium mt-1">
                Anda telah mengirimkan laporan kesalahan data. Akses ke sistem utama akan ditangguhkan hingga Admin menyetujui perbaikan data Anda.
              </p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          
          {/* Left Panel: Profile Detail */}
          <div className="md:col-span-2 bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-6 sm:p-8 shadow-xl space-y-6">
            
            {/* Foto Profil & Header */}
            <div className="flex items-center gap-5 pb-6 border-b border-border-light dark:border-border-dark">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black border border-primary/20 text-3xl shrink-0 overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  profile?.full_name?.charAt(0).toUpperCase() || "K"
                )}
              </div>
              <div>
                <span className="px-2.5 py-0.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[9px] font-black uppercase tracking-wider rounded-full">
                  {profile?.role === 'cashier' ? 'KASIR' : profile?.role === 'kitchen' ? 'DAPUR' : profile?.role}
                </span>
                <h3 className="font-black text-text-light dark:text-text-dark text-xl mt-1.5">{profile?.full_name}</h3>
                <p className="text-xs text-muted font-mono mt-0.5">{profile?.employee_id || "-"}</p>
              </div>
            </div>

            {/* Profile fields detail */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-muted tracking-wider block">Email Terdaftar</span>
                <div className="flex items-center gap-2 text-text-light dark:text-text-dark font-bold bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl border border-border-light dark:border-border-dark">
                  <Mail className="w-4 h-4 text-muted" />
                  <span>{profile?.email || "-"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-muted tracking-wider block">No. Telepon / WA</span>
                <div className="flex items-center gap-2 text-text-light dark:text-text-dark font-bold bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl border border-border-light dark:border-border-dark">
                  <Phone className="w-4 h-4 text-muted" />
                  <span>{profile?.phone || "-"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-muted tracking-wider block">Jabatan Karyawan</span>
                <div className="flex items-center gap-2 text-text-light dark:text-text-dark font-bold bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl border border-border-light dark:border-border-dark">
                  <ShieldCheck className="w-4 h-4 text-muted" />
                  <span className="capitalize">{profile?.jabatan || "-"}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-muted tracking-wider block">Tanggal Bergabung</span>
                <div className="flex items-center gap-2 text-text-light dark:text-text-dark font-bold bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl border border-border-light dark:border-border-dark">
                  <FileText className="w-4 h-4 text-muted" />
                  <span>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('id-ID', { dateStyle: 'long' }) : "-"}</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-border-light dark:border-border-dark">
              <button
                onClick={handleConfirm}
                disabled={confirming || profile?.verification_status === 'report_submitted'}
                className="flex-1 py-3.5 bg-primary hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Masuk Sistem
              </button>

              <button
                onClick={() => setShowReportModal(true)}
                disabled={profile?.verification_status === 'report_submitted'}
                className="flex-1 py-3.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/20 rounded-2xl font-black text-xs uppercase tracking-wider transition-colors hover:bg-rose-100 hover:text-rose-700 flex items-center justify-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Laporkan Kesalahan Data
              </button>
            </div>

          </div>

          {/* Right Panel: Rules & History */}
          <div className="space-y-6">
            
            {/* Guide Info Box */}
            <div className="bg-gray-50 dark:bg-gray-900/40 p-6 rounded-3xl border border-border-light dark:border-border-dark space-y-4">
              <h4 className="font-black text-xs uppercase text-text-light dark:text-text-dark tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" /> Panduan Verifikasi
              </h4>
              <ul className="text-[11px] text-muted space-y-2.5 font-medium list-disc list-inside leading-relaxed">
                <li>Pastikan seluruh nama, foto, ID karyawan, role, dan status sudah benar.</li>
                <li>Jika semua data sudah sesuai dengan identitas Anda, silakan klik tombol <strong>&quot;Masuk Sistem&quot;</strong>.</li>
                <li>Jika ada kesalahan pada data Anda, jangan klik tombol konfirmasi. Silakan ajukan laporan kesalahan ke Admin.</li>
              </ul>
            </div>

            {/* Logout Panel */}
            <button
              onClick={handleLogout}
              className="w-full py-4 bg-gray-100 hover:bg-gray-250 dark:bg-gray-800 dark:hover:bg-gray-700 text-text-light dark:text-text-dark rounded-2xl font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-border-light dark:border-border-dark shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Keluar Akun
            </button>

          </div>

        </div>

        {/* Riwayat Laporan Kesalahan Section */}
        <div className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-6 shadow-xl space-y-5">
          <h3 className="font-black text-sm text-text-light dark:text-text-dark uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" /> Riwayat Laporan Data Anda ({reports.length})
          </h3>

          {loadingReports ? (
            <div className="text-center py-6 text-xs text-muted">Memuat riwayat laporan...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted italic border border-dashed border-border-light dark:border-border-dark rounded-2xl">
              Belum ada riwayat laporan kesalahan data yang diajukan.
            </div>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {reports.map((report) => (
                <div key={report.id} className="p-4 bg-gray-50 dark:bg-gray-900/60 border border-border-light dark:border-border-dark rounded-2xl text-xs space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-muted font-mono">{new Date(report.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    {getStatusBadge(report.status)}
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase text-muted tracking-wider block mb-1">Kolom yang Salah</span>
                    <div className="flex flex-wrap gap-1.5">
                      {report.reported_fields.map((f: string) => (
                        <span key={f} className="px-2 py-0.5 bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 text-[9px] font-black uppercase rounded">
                          {f === 'full_name' ? 'Nama' : f === 'phone' ? 'No. Telepon' : f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-white dark:bg-gray-950 p-3 rounded-xl border border-border-light dark:border-border-dark">
                    <div>
                      <span className="text-[9px] font-black uppercase text-muted tracking-wider block mb-0.5">Nilai Saat Ini</span>
                      <div className="font-medium text-red-600 dark:text-red-400">
                        {Object.entries(report.current_values).map(([k, v]: any) => (
                          <div key={k} className="truncate">{k === 'full_name' ? 'Nama' : k}: {v || '-'}</div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-muted tracking-wider block mb-0.5">Usulan Nilai Baru</span>
                      <div className="font-medium text-green-600 dark:text-green-400">
                        {Object.entries(report.proposed_values).map(([k, v]: any) => (
                          <div key={k} className="truncate">{k === 'full_name' ? 'Nama' : k}: {v || '-'}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase text-muted tracking-wider block mb-0.5">Penjelasan Kesalahan</span>
                    <p className="font-semibold text-text-light dark:text-text-dark leading-relaxed italic">{report.description}</p>
                  </div>

                  {report.admin_comment && (
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/25 rounded-xl border border-indigo-200/50 dark:border-indigo-900/20">
                      <span className="text-[9px] font-black uppercase text-indigo-650 dark:text-indigo-400 block mb-0.5">Tanggapan Admin</span>
                      <p className="font-semibold text-indigo-700 dark:text-indigo-300 leading-normal">{report.admin_comment}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* FORM MODAL LAPORAN KESALAHAN DATA */}
      <BaseModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        size="lg"
        title="Laporkan Kesalahan Data Akun"
      >
        <form onSubmit={handleReportSubmit} className="space-y-5">
          <p className="text-xs text-muted font-medium bg-indigo-50 dark:bg-indigo-950/20 p-3.5 rounded-2xl border border-indigo-200/30">
            Isi formulir ini dengan lengkap agar pihak administrator dapat melakukan peninjauan dan perbaikan data Anda secara tepat.
          </p>

          {/* Checklist kolom yang salah */}
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase text-muted tracking-wider">Pilih Kolom Data yang Salah</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { key: 'full_name', label: 'Nama Lengkap' },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'No. Telepon / WA' },
                { key: 'employee_id', label: 'ID Karyawan' },
                { key: 'role', label: 'Role' },
                { key: 'jabatan', label: 'Jabatan' }
              ].map((f) => {
                const isSelected = selectedFields.includes(f.key);
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => handleFieldToggle(f.key)}
                    className={`p-2.5 rounded-xl border text-[11px] font-bold uppercase transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? "bg-indigo-500/10 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-md"
                        : "bg-gray-50 dark:bg-gray-900 border-border-light dark:border-border-dark text-muted hover:bg-gray-100"
                    }`}
                  >
                    <span>{f.label}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form input untuk usulan nilai data baru */}
          {selectedFields.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="space-y-3 bg-gray-50 dark:bg-gray-900/60 p-4 rounded-2xl border border-border-light dark:border-border-dark"
            >
              <label className="block text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">Nilai Data yang Seharusnya</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold">
                {selectedFields.includes('full_name') && (
                  <div>
                    <label className="text-[10px] text-muted uppercase block mb-1">Nama Lengkap yang Benar</label>
                    <input
                      type="text"
                      required
                      value={proposedValues.full_name}
                      onChange={(e) => setProposedValues({ ...proposedValues, full_name: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-gray-950 border border-border-light dark:border-border-dark rounded-lg focus:border-primary outline-none"
                    />
                  </div>
                )}
                {selectedFields.includes('email') && (
                  <div>
                    <label className="text-[10px] text-muted uppercase block mb-1">Email yang Benar</label>
                    <input
                      type="email"
                      required
                      value={proposedValues.email}
                      onChange={(e) => setProposedValues({ ...proposedValues, email: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-gray-950 border border-border-light dark:border-border-dark rounded-lg focus:border-primary outline-none"
                    />
                  </div>
                )}
                {selectedFields.includes('phone') && (
                  <div>
                    <label className="text-[10px] text-muted uppercase block mb-1">No. Telepon yang Benar</label>
                    <input
                      type="text"
                      required
                      value={proposedValues.phone}
                      onChange={(e) => setProposedValues({ ...proposedValues, phone: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-gray-950 border border-border-light dark:border-border-dark rounded-lg focus:border-primary outline-none"
                    />
                  </div>
                )}
                {selectedFields.includes('employee_id') && (
                  <div>
                    <label className="text-[10px] text-muted uppercase block mb-1">ID Karyawan yang Benar</label>
                    <input
                      type="text"
                      required
                      value={proposedValues.employee_id}
                      onChange={(e) => setProposedValues({ ...proposedValues, employee_id: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-gray-950 border border-border-light dark:border-border-dark rounded-lg focus:border-primary outline-none"
                    />
                  </div>
                )}
                {selectedFields.includes('role') && (
                  <div>
                    <label className="text-[10px] text-muted uppercase block mb-1">Role yang Benar</label>
                    <select
                      value={proposedValues.role}
                      onChange={(e) => setProposedValues({ ...proposedValues, role: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-gray-950 border border-border-light dark:border-border-dark rounded-lg focus:border-primary outline-none font-bold text-xs"
                    >
                      <option value="cashier">Kasir (Cashier)</option>
                      <option value="kitchen">Dapur (Kitchen)</option>
                    </select>
                  </div>
                )}
                {selectedFields.includes('jabatan') && (
                  <div>
                    <label className="text-[10px] text-muted uppercase block mb-1">Jabatan yang Benar</label>
                    <input
                      type="text"
                      required
                      value={proposedValues.jabatan}
                      onChange={(e) => setProposedValues({ ...proposedValues, jabatan: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-gray-950 border border-border-light dark:border-border-dark rounded-lg focus:border-primary outline-none"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Deskripsi penjelasan detail */}
          <div className="space-y-1">
            <label htmlFor="report_desc" className="block text-xs font-black uppercase text-muted tracking-wider">Penjelasan Detail Kesalahan Data</label>
            <textarea
              id="report_desc"
              rows={3}
              placeholder="Berikan deskripsi detail kesalahan yang Anda temukan (Contoh: Foto profil saya menggunakan foto orang lain, atau nama belakang saya kurang satu huruf...)"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-2xl text-xs outline-none transition-all font-medium text-text-light dark:text-text-dark resize-none focus:border-primary"
            />
          </div>

          {/* Upload bukti pendukung */}
          <div className="space-y-1">
            <span className="block text-xs font-black uppercase text-muted tracking-wider">Unggah Bukti Pendukung (Opsional)</span>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-text-light dark:text-text-dark border border-border-light dark:border-border-dark rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-muted" />
                Pilih Berkas
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {uploading && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
              {attachmentUrl && (
                <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-xl border border-emerald-250/30 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Bukti terunggah</span>
                  <button 
                    type="button" 
                    onClick={() => setAttachmentUrl("")} 
                    className="p-0.5 hover:bg-emerald-100 rounded-full shrink-0"
                    title="Hapus bukti"
                    aria-label="Hapus bukti"
                  >
                    <X className="w-3 h-3 text-emerald-600" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-[10px] text-muted font-medium mt-1">Mendukung format gambar (JPG, PNG) atau PDF dengan ukuran maksimal 5MB.</p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
            <button
              type="button"
              onClick={() => setShowReportModal(false)}
              className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-text-light dark:text-text-dark rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs uppercase tracking-wider"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={reporting || uploading}
              className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold shadow-lg shadow-primary/20 transition-all text-xs uppercase tracking-wider flex justify-center items-center gap-2 disabled:opacity-50"
            >
              {reporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Kirim Laporan
            </button>
          </div>
        </form>
      </BaseModal>

    </div>
  );
}
