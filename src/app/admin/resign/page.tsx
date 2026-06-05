"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BaseModal from "@/components/BaseModal";
import { 
  Users, UserCheck, UserMinus, Clock, Search, Filter, 
  Trash2, Check, X, AlertTriangle, Send, FileText, Loader2, 
  ShieldAlert, Mail, Phone, Calendar, Briefcase, Eye, User, RefreshCw 
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// Reusable Live Countdown Component for Table Cells
const CountdownCell = ({ suspensionTime, status, decision }: { suspensionTime: string; status: string; decision: string }) => {
  const [tick, setTick] = useState<{d:number, h:number, m:number, s:number} | null>(null);

  useEffect(() => {
    if (!suspensionTime || status !== 'Disetujui' || decision === 'lanjut_bekerja') {
      setTick(null);
      return;
    }

    const run = () => {
      const now = new Date().getTime();
      const target = new Date(suspensionTime).getTime();
      const diff = target - now;
      if (diff <= 0) {
        setTick({d:0, h:0, m:0, s:0});
        return;
      }
      setTick({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        s: Math.floor((diff % (1000 * 60)) / 1000)
      });
    };
    run();
    const timer = setInterval(run, 1000);
    return () => clearInterval(timer);
  }, [suspensionTime, status, decision]);

  if (!tick) return <span className="text-muted font-medium italic">-</span>;

  return (
    <div className="font-mono text-xs font-black flex items-center gap-1 text-slate-800 dark:text-slate-200">
       <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-border-light dark:border-border-dark">{String(tick.d).padStart(2,'0')}d</span>
       <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-border-light dark:border-border-dark">{String(tick.h).padStart(2,'0')}h</span>
       <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-border-light dark:border-border-dark">{String(tick.m).padStart(2,'0')}m</span>
       <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-border-light dark:border-border-dark animate-pulse">{String(tick.s).padStart(2,'0')}s</span>
    </div>
  );
};

export default function AdminResignPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [divFilter, setDivFilter] = useState("All");

  // Selection & Modal States
  const [selectedReq, setSelectedReq] = useState<any | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [spDate, setSpDate] = useState("");
  const [spTime, setSpTime] = useState("");
  const [actioning, setActioning] = useState(false);

  // Pecat Karyawan States
  const [activeTab, setActiveTab] = useState<"resign" | "pecat">("resign");
  const [selectedEmp, setSelectedEmp] = useState<any | null>(null);
  const [showPecatModal, setShowPecatModal] = useState(false);
  const [pecatReason, setPecatReason] = useState("");

  // Delete Permanently 2-Step Confirmation States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1);
  const [deleteProfileId, setDeleteProfileId] = useState("");
  const [deleteType, setDeleteType] = useState<"resign" | "pecat">("resign");

  // Modern Confirmation Modal State
  const [genericConfirm, setGenericConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    type: 'warning' | 'danger';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Lanjutkan",
    type: 'warning',
    onConfirm: () => {},
  });

  useEffect(() => {
    fetchData();

    // Subscribe to REALTIME updates on resign_requests
    const resignSub = supabase
      .channel("realtime-resign")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "resign_requests" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    // Subscribe to REALTIME updates on profiles
    const profileSub = supabase
      .channel("realtime-profiles")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(resignSub);
      supabase.removeChannel(profileSub);
    };
  }, []);

  const fetchData = async () => {
    try {
      // 1. Fetch resign requests
      const { data: resData, error: resErr } = await supabase
        .from("resign_requests")
        .select(`
          *,
          profiles (
            avatar_url,
            phone,
            email,
            status_karyawan
          )
        `)
        .order("created_at", { ascending: false });

      if (resErr) throw resErr;
      setRequests(resData || []);

      // 2. Fetch non-customer, non-admin active employees
      const { data: empData, error: empErr } = await supabase
        .from("profiles")
        .select("*")
        .neq("role", "customer")
        .neq("role", "admin")
        .order("full_name", { ascending: true });

      if (empErr) throw empErr;
      setEmployees(empData || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Resign Actions
  const handleApprove = async (reqId: string) => {
    if (!spDate || !spTime) return toast.error("Silakan tentukan TANGGAL & WAKTU penangguhan akun terlebih dahulu.");
    
    const finalSuspensionTimeStr = `${spDate}T${spTime}:00`;

    setActioning(true);
    try {
      const res = await fetch("/api/admin/resign-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "approve", 
          requestId: reqId,
          suspensionTime: new Date(finalSuspensionTimeStr).toISOString()
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Gagal menyetujui pengajuan");
      }
      toast.success("Pengajuan disetujui & waktu penangguhan ditetapkan!");
      // HOT-UPDATE MODAL LOCALLY
      setSelectedReq((prev: any) => ({
        ...prev,
        status: 'Disetujui',
        suspension_time: new Date(finalSuspensionTimeStr).toISOString()
      }));
      setSpDate("");
      setSpTime("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActioning(false);
    }
  };

  const handleResumeResign = async (reqId: string) => {
    if (!spDate || !spTime) return toast.error("Silakan tentukan TANGGAL & WAKTU penangguhan akun yang baru terlebih dahulu.");
    
    const finalSuspensionTimeStr = `${spDate}T${spTime}:00`;

    setActioning(true);
    try {
      const res = await fetch("/api/admin/resign-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "resume_resign", 
          requestId: reqId,
          suspensionTime: new Date(finalSuspensionTimeStr).toISOString()
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Gagal melanjutkan proses");
      }
      toast.success("Proses pengunduran diri resmi dilanjutkan kembali!");
      // HOT-UPDATE MODAL LOCALLY
      setSelectedReq((prev: any) => ({
        ...prev,
        status: 'Disetujui',
        suspension_time: new Date(finalSuspensionTimeStr).toISOString(),
        employee_decision: null
      }));
      setSpDate("");
      setSpTime("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActioning(false);
    }
  };

  const handleCancelResign = async (reqId: string) => {
    setActioning(true);
    try {
      const res = await fetch("/api/admin/resign-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_resign", requestId: reqId })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Gagal membatalkan pengajuan");
      }
      toast.success("Proses resign dibatalkan! Karyawan kembali aktif.");
      // HOT-UPDATE MODAL LOCALLY
      setSelectedReq((prev: any) => ({
        ...prev,
        status: 'Dibatalkan',
        suspension_time: null,
        profiles: prev?.profiles ? { ...prev.profiles, status_karyawan: 'aktif' } : null
      }));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActioning(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) return toast.error("Alasan penolakan wajib diisi");
    setActioning(true);
    try {
      const res = await fetch("/api/admin/resign-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "reject", 
          requestId: selectedReq.id, 
          notes: rejectReason 
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Gagal menolak pengajuan");
      }
      toast.success("Pengajuan resign ditolak dengan catatan!");
      setShowRejectModal(false);
      // HOT-UPDATE MODAL LOCALLY
      setSelectedReq((prev: any) => ({
        ...prev,
        status: 'Ditolak',
        admin_notes: rejectReason
      }));
      setRejectReason("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActioning(false);
    }
  };

  const handleMarkOut = async (profileId: string) => {
    setActioning(true);
    try {
      const res = await fetch("/api/admin/resign-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_out", profileId })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Gagal menandai karyawan keluar");
      }
      toast.success("Karyawan ditangguhkan (Status: Resign)!");
      // HOT-UPDATE MODAL LOCALLY
      setSelectedReq((prev: any) => ({
        ...prev,
        profiles: prev?.profiles ? { ...prev.profiles, status_karyawan: 'resign' } : null
      }));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActioning(false);
    }
  };

  // Pemecatan Actions
  const handlePecatSubmit = async () => {
    setActioning(true);
    try {
      const res = await fetch("/api/admin/resign-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "terminate", 
          profileId: selectedEmp.id,
          employeeId: selectedEmp.employee_id,
          notes: {
            fullName: selectedEmp.full_name,
            role: selectedEmp.role,
            reason: pecatReason || "Pemecatan oleh manajemen"
          }
        })
      });
      if (!res.ok) throw new Error("Gagal melakukan pemecatan");
      toast.success(`Karyawan ${selectedEmp.full_name} berhasil ditangguhkan (Status: Dipecat)!`);
      setShowPecatModal(false);
      setSelectedEmp(null);
      setPecatReason("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActioning(false);
    }
  };

  // Delete 2-Step Action
  const handleDeletePermanently = async () => {
    setActioning(true);
    try {
      const res = await fetch("/api/admin/resign-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "delete_permanently", 
          profileId: deleteProfileId,
          notes: { type: deleteType }
        })
      });
      if (!res.ok) throw new Error("Gagal menghapus akun secara permanen");
      toast.success("Akun berhasil dihapus permanen & WhatsApp apresiasi berhasil dikirim!");
      setShowDeleteModal(false);
      setDeleteConfirmStep(1);
      setSelectedReq(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActioning(false);
    }
  };

  // Reactivate Suspended Account Action
  const handleReactivate = async (profileId: string) => {
    setActioning(true);
    try {
      const res = await fetch("/api/admin/resign-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate", profileId })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Gagal mengaktifkan kembali akun");
      }
      toast.success("Akun karyawan berhasil diaktifkan kembali secara real-time!");
      // HOT-UPDATE MODAL LOCALLY
      setSelectedReq((prev: any) => ({
        ...prev,
        status: 'Dibatalkan',
        suspension_time: null,
        profiles: prev?.profiles ? { ...prev.profiles, status_karyawan: 'aktif' } : null
      }));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActioning(false);
    }
  };

  // PDF Export (Print Layout styling)
  const handlePrint = () => {
    window.print();
  };

  // Filter & Search computation
  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (req.employee_id && req.employee_id.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === "All" || req.status === statusFilter;
    const matchesDiv = divFilter === "All" || req.division.toLowerCase() === divFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesDiv;
  });

  const filteredEmployees = employees.filter(emp => {
    return emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
           (emp.employee_id && emp.employee_id.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  // Analytics Computation
  const activeResignsThisMonth = requests.filter(req => {
    const reqDate = new Date(req.created_at);
    const now = new Date();
    return reqDate.getMonth() === now.getMonth() && reqDate.getFullYear() === now.getFullYear();
  }).length;

  const totalTerminated = employees.filter(emp => emp.status_karyawan === "dipecat").length;
  const waitingConfirmations = requests.filter(req => req.status === "Menunggu Konfirmasi").length;

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;

  return (
    <div className="p-8 pb-24 max-w-7xl mx-auto space-y-8 print:p-0 print:pb-0">
      
      {/* Print Only Header */}
      <div className="hidden print:block mb-8 border-b-2 border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide">
          Laporan Manajemen Resign & Pemecatan
        </h1>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
          RestoBook - Sistem Pemesanan Restoran
        </p>
        <p className="text-[10px] text-slate-400 mt-2">
          Tanggal Cetak: {format(new Date(), "dd MMMM yyyy, HH:mm", { locale: id })} WIB
        </p>
      </div>

      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-black text-text-light dark:text-text-dark uppercase tracking-wide flex items-center gap-2">
            <ShieldAlert className="w-8 h-8 text-red-500" /> Manajemen Resign & Pemecatan
          </h1>
          <p className="text-muted mt-1">Kelola permohonan pengunduran diri, mutasi, penangguhan, dan penghapusan akun karyawan secara real-time</p>
        </div>
        <button onClick={handlePrint} className="flex items-center justify-center gap-2 px-5 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-text-light dark:text-text-dark rounded-2xl font-black text-sm uppercase tracking-wider transition-all">
          <FileText className="w-4 h-4" /> Export Laporan (PDF)
        </button>
      </div>

      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
        <div className="bg-card-light dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark flex items-center gap-5 shadow-xl">
          <div className="p-4 bg-teal-500/10 text-teal-600 rounded-2xl"><UserCheck className="w-8 h-8" /></div>
          <div>
            <p className="text-xs font-black uppercase text-muted">Resign Bulan Ini</p>
            <p className="text-3xl font-black text-text-light dark:text-text-dark mt-1">{activeResignsThisMonth}</p>
          </div>
        </div>
        <div className="bg-card-light dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark flex items-center gap-5 shadow-xl">
          <div className="p-4 bg-red-500/10 text-red-600 rounded-2xl"><UserMinus className="w-8 h-8" /></div>
          <div>
            <p className="text-xs font-black uppercase text-muted">Total Dipecat</p>
            <p className="text-3xl font-black text-text-light dark:text-text-dark mt-1">{totalTerminated}</p>
          </div>
        </div>
        <div className="bg-card-light dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark flex items-center gap-5 shadow-xl">
          <div className="p-4 bg-amber-500/10 text-amber-600 rounded-2xl"><Clock className="w-8 h-8" /></div>
          <div>
            <p className="text-xs font-black uppercase text-muted">Menunggu Konfirmasi</p>
            <p className="text-3xl font-black text-text-light dark:text-text-dark mt-1">{waitingConfirmations}</p>
          </div>
        </div>
      </div>

      {/* Module Selector tabs */}
      <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl gap-2 max-w-md shadow-inner print:hidden overflow-x-auto whitespace-nowrap scrollbar-none pb-1.5 sm:pb-1.5">
        <button 
          onClick={() => setActiveTab("resign")}
          className={`flex-1 py-3 rounded-xl font-black text-xs transition-all uppercase tracking-wider shrink-0 whitespace-nowrap ${activeTab === "resign" ? "bg-white dark:bg-gray-700 shadow text-primary" : "text-muted hover:text-text-light dark:hover:text-text-dark"}`}
        >
          Pengajuan Resign
        </button>
        <button 
          onClick={() => setActiveTab("pecat")}
          className={`flex-1 py-3 rounded-xl font-black text-xs transition-all uppercase tracking-wider shrink-0 whitespace-nowrap ${activeTab === "pecat" ? "bg-white dark:bg-gray-700 shadow text-red-600" : "text-muted hover:text-text-light dark:hover:text-text-dark"}`}
        >
          Pecat / Keluarkan Karyawan
        </button>
      </div>

      {/* Search & Filter section */}
      <div className="bg-card-light dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark shadow-xl space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama karyawan atau No. ID..." 
              className="w-full pl-12 pr-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold"
            />
          </div>

          {activeTab === "resign" && (
            <div className="flex gap-4">
              <div className="relative flex items-center">
                <Filter className="absolute left-4 w-4 h-4 text-muted" />
                <select 
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  title="Filter Status"
                  className="pl-10 pr-8 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-xs uppercase cursor-pointer"
                >
                  <option value="All">Semua Status</option>
                  <option value="Menunggu Konfirmasi">Menunggu Konfirmasi</option>
                  <option value="Disetujui">Disetujui</option>
                  <option value="Dibatalkan">Dibatalkan</option>
                  <option value="Ditolak">Ditolak</option>
                </select>
              </div>

              <div className="relative flex items-center">
                <Filter className="absolute left-4 w-4 h-4 text-muted" />
                <select 
                  value={divFilter}
                  onChange={e => setDivFilter(e.target.value)}
                  title="Filter Divisi"
                  className="pl-10 pr-8 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-xs uppercase cursor-pointer"
                >
                  <option value="All">Semua Divisi</option>
                  <option value="Kasir">Kasir</option>
                  <option value="Operasional">Operasional</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Lists */}
      <div className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark shadow-xl overflow-hidden">
        
        {activeTab === "resign" ? (
          /* RESIGN TABLE */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ minWidth: '1000px' }}>
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/40 border-b border-border-light dark:border-border-dark">
                  <th className="p-5 text-xs font-black uppercase text-muted tracking-wider whitespace-nowrap">Karyawan & ID</th>
                  <th className="p-5 text-xs font-black uppercase text-muted tracking-wider whitespace-nowrap">Tgl Pengajuan</th>
                  <th className="p-5 text-xs font-black uppercase text-muted tracking-wider whitespace-nowrap">Batas Waktu</th>
                  <th className="p-5 text-xs font-black uppercase text-muted tracking-wider whitespace-nowrap">Countdown</th>
                  <th className="p-5 text-xs font-black uppercase text-muted tracking-wider whitespace-nowrap">Pilihan Karyawan</th>
                  <th className="p-5 text-xs font-black uppercase text-muted tracking-wider whitespace-nowrap">Status Akun</th>
                  <th className="p-5 text-xs font-black uppercase text-muted tracking-wider text-right print:hidden whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {filteredRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-muted font-bold">Tidak ada pengajuan resign ditemukan.</td>
                  </tr>
                ) : (
                  filteredRequests.map(req => (
                    <tr key={req.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-all">
                      <td className="p-5 flex items-center gap-4 whitespace-nowrap">
                        <div className="w-11 h-11 rounded-full overflow-hidden border border-border-light dark:border-border-dark bg-gray-100 flex items-center justify-center flex-shrink-0">
                          {req.profiles?.avatar_url ? (
                            <img src={req.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-muted" />
                          )}
                        </div>
                        <div className="whitespace-nowrap">
                          <p className="font-bold text-text-light dark:text-text-dark text-sm whitespace-nowrap">{req.full_name}</p>
                          <p className="text-[10px] text-muted font-black uppercase tracking-widest whitespace-nowrap">{req.employee_id || "NO-ID"} - {req.role}</p>
                        </div>
                      </td>
                      <td className="p-5 text-xs font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {new Date(req.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="p-5 text-xs font-black text-text-light dark:text-text-dark whitespace-nowrap">
                        {req.suspension_time ? format(new Date(req.suspension_time), "dd MMM, HH:mm", { locale: id }) : <span className="text-muted font-medium italic text-[10px] whitespace-nowrap">Belum Disetujui</span>}
                      </td>
                      <td className="p-5 whitespace-nowrap">
                        <CountdownCell suspensionTime={req.suspension_time} status={req.status} decision={req.employee_decision} />
                      </td>
                      <td className="p-5 whitespace-nowrap">
                        {!req.employee_decision ? (
                           req.status === 'Disetujui' 
                             ? <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-600 text-[9px] font-black uppercase border border-amber-500/20 whitespace-nowrap">Menunggu Konfirmasi</span>
                             : <span className="text-muted italic text-[10px] whitespace-nowrap">-</span>
                        ) : req.employee_decision === 'lanjut_bekerja' ? (
                          <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-600 text-[9px] font-black uppercase border border-green-500/20 whitespace-nowrap">Lanjut Bekerja</span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-600 text-[9px] font-black uppercase border border-red-500/20 whitespace-nowrap">Lanjutkan Resign</span>
                        )}
                      </td>
                      <td className="p-5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase whitespace-nowrap ${
                          req.profiles?.status_karyawan === "aktif" ? "bg-green-100 text-green-600 dark:bg-green-900/30" :
                          req.profiles?.status_karyawan === "resign" ? "bg-red-100 text-red-600 dark:bg-red-900/30" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {req.profiles?.status_karyawan || "aktif"}
                        </span>
                      </td>
                      <td className="p-5 text-right print:hidden whitespace-nowrap">
                         <div className="flex items-center justify-end gap-2">
                           <button 
                             onClick={() => setSelectedReq(req)}
                             className="px-3 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-1.5"
                           >
                             <Eye className="w-3.5 h-3.5" />
                             Detail
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* PECAT / KELUARKAN KARYAWAN */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ minWidth: '800px' }}>
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/40 border-b border-border-light dark:border-border-dark">
                  <th className="p-5 text-xs font-black uppercase text-muted tracking-wider whitespace-nowrap">Karyawan</th>
                  <th className="p-5 text-xs font-black uppercase text-muted tracking-wider whitespace-nowrap">No. ID</th>
                  <th className="p-5 text-xs font-black uppercase text-muted tracking-wider whitespace-nowrap">Telepon</th>
                  <th className="p-5 text-xs font-black uppercase text-muted tracking-wider whitespace-nowrap">Status Karyawan</th>
                  <th className="p-5 text-xs font-black uppercase text-muted tracking-wider text-right print:hidden whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-muted font-bold">Karyawan tidak ditemukan.</td>
                  </tr>
                ) : (
                  filteredEmployees.map(emp => (
                    <tr key={emp.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-all">
                      <td className="p-5 flex items-center gap-4 whitespace-nowrap">
                        <div className="w-11 h-11 rounded-full overflow-hidden border border-border-light dark:border-border-dark bg-gray-100 flex items-center justify-center whitespace-nowrap">
                          {emp.avatar_url ? (
                            <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-muted" />
                          )}
                        </div>
                        <div className="whitespace-nowrap">
                          <p className="font-bold text-text-light dark:text-text-dark whitespace-nowrap">{emp.full_name}</p>
                          <p className="text-[10px] text-muted font-bold uppercase whitespace-nowrap">{emp.role}</p>
                        </div>
                      </td>
                      <td className="p-5 font-mono font-bold text-sm whitespace-nowrap">{emp.employee_id || "-"}</td>
                      <td className="p-5 text-xs font-bold text-muted whitespace-nowrap">{emp.phone || "-"}</td>
                      <td className="p-5 whitespace-nowrap">
                        <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase whitespace-nowrap ${
                          emp.status_karyawan === "aktif" ? "bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400" :
                          emp.status_karyawan === "resign" ? "bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" :
                          "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                        }`}>
                          {emp.status_karyawan || "aktif"}
                        </span>
                      </td>
                      <td className="p-5 text-right space-x-2 print:hidden whitespace-nowrap">
                        {emp.status_karyawan === "aktif" ? (
                          <button 
                            onClick={() => { setSelectedEmp(emp); setShowPecatModal(true); }}
                            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all inline-flex items-center gap-1.5 shadow-lg shadow-red-600/10"
                          >
                            <UserMinus className="w-3.5 h-3.5" /> Pecat / Keluarkan
                          </button>
                        ) : (
                          <>
                            <span className="text-[10px] text-muted font-bold uppercase mr-2">Akun Ditangguhkan</span>
                            <button 
                              onClick={() => { 
                                setDeleteProfileId(emp.id); 
                                setDeleteType(emp.status_karyawan === "dipecat" ? "pecat" : "resign"); 
                                setDeleteConfirmStep(1); 
                                setShowDeleteModal(true); 
                              }}
                              className="px-3.5 py-2 bg-gray-900 dark:bg-gray-800 hover:bg-red-600 hover:text-white text-white dark:text-muted rounded-xl font-black text-xs uppercase tracking-wider transition-all inline-flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Hapus Akun
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL MODAL FOR RESIGN REQUEST */}
      <BaseModal isOpen={!!selectedReq} onClose={() => setSelectedReq(null)} size="2xl" title="Detail Pengajuan Resign">
        {selectedReq && (
          <div>
            <div className="flex flex-col md:flex-row gap-6 items-center md:items-start border-b border-border-light dark:border-border-dark pb-6 mb-6">
              <div className="w-24 h-24 rounded-3xl overflow-hidden bg-gray-100 flex-shrink-0 border border-border-light dark:border-border-dark shadow-md flex items-center justify-center">
                {selectedReq.profiles?.avatar_url ? (
                  <img src={selectedReq.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-muted" />
                )}
              </div>
              <div className="text-center md:text-left space-y-2 flex-1">
                <h3 className="text-2xl font-black text-text-light dark:text-text-dark uppercase">{selectedReq.full_name}</h3>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  <span className="px-3 py-1 bg-teal-500/10 text-teal-600 dark:text-teal-400 font-mono text-xs font-black uppercase rounded-lg">ID: {selectedReq.employee_id}</span>
                  <span className="px-3 py-1 bg-primary/10 text-primary font-black text-xs uppercase rounded-lg">{selectedReq.role}</span>
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-muted font-black text-xs uppercase rounded-lg">{selectedReq.division}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-sm">
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted">Tanggal Pengajuan</p>
                  <p className="font-bold text-text-light dark:text-text-dark mt-0.5">{new Date(selectedReq.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted">Tanggal Efektif Keluar</p>
                  <p className="font-black text-teal-600 dark:text-teal-400 mt-0.5">{new Date(selectedReq.effective_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted">Telepon Karyawan</p>
                  <p className="font-bold text-text-light dark:text-text-dark mt-0.5">{selectedReq.profiles?.phone || "-"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase text-muted">Email Karyawan</p>
                  <p className="font-bold text-text-light dark:text-text-dark mt-0.5">{selectedReq.profiles?.email || "-"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t border-border-light dark:border-border-dark pt-6 mb-8">
              <div className="bg-gray-50 dark:bg-gray-800/40 p-5 rounded-2xl">
                <p className="text-[10px] font-black uppercase text-muted mb-2">Alasan Pengunduran Diri</p>
                <p className="text-xs text-text-light dark:text-text-dark leading-relaxed italic">&ldquo;{selectedReq.reason}&rdquo;</p>
              </div>
              {selectedReq.additional_notes && (
                <div className="p-5 border border-dashed border-border-light dark:border-border-dark rounded-2xl">
                  <p className="text-[10px] font-black uppercase text-muted mb-2">Keterangan Tambahan</p>
                  <p className="text-xs text-muted leading-relaxed">{selectedReq.additional_notes}</p>
                </div>
              )}
              {selectedReq.admin_notes && (
                <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 p-5 rounded-2xl">
                  <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 mb-1">Catatan Tanggapan Admin</p>
                  <p className="text-xs text-text-light dark:text-text-dark font-medium leading-relaxed">{selectedReq.admin_notes}</p>
                </div>
              )}
            </div>

            {(selectedReq.status === "Menunggu Konfirmasi" || selectedReq.status === "Dibatalkan") && (
              <div className="mb-6 p-5 bg-blue-500/5 border border-blue-500/20 rounded-2xl space-y-3">
                <p className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Tentukan Waktu Akhir Akun Aktif (Suspension Deadline)
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-muted uppercase ml-1">Tanggal</label>
                    <input 
                      type="date"
                      title="Tentukan tanggal penangguhan"
                      value={spDate}
                      onChange={(e) => setSpDate(e.target.value)}
                      className="w-full bg-white dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-xl px-4 py-3 font-bold text-sm text-text-light dark:text-text-dark outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-muted uppercase ml-1">Waktu / Jam</label>
                    <input 
                      type="time"
                      title="Tentukan jam penangguhan"
                      value={spTime}
                      onChange={(e) => setSpTime(e.target.value)}
                      className="w-full bg-white dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-xl px-4 py-3 font-bold text-sm text-text-light dark:text-text-dark outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <p className="text-[9px] text-muted font-medium italic">* Akun akan otomatis dinonaktifkan pada waktu tersebut.</p>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap gap-4 justify-end">
              {selectedReq.status === "Menunggu Konfirmasi" ? (
                <>
                  <button 
                    onClick={() => setShowRejectModal(true)}
                    className="px-5 py-3 bg-red-100 hover:bg-red-600 hover:text-white text-red-600 rounded-2xl font-black text-xs uppercase tracking-wider transition-all"
                  >
                    Tolak Pengajuan
                  </button>
                  <button 
                    onClick={() => handleApprove(selectedReq.id)}
                    disabled={actioning}
                    className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-green-600/10"
                  >
                    {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Setujui Resign
                  </button>
                </>
              ) : selectedReq.status === "Disetujui" && selectedReq.profiles?.status_karyawan === "aktif" ? (
                <>
                  <button 
                    onClick={() => setGenericConfirm({
                      isOpen: true,
                      title: "Batalkan Resign Paksa?",
                      message: "Apakah Anda yakin ingin membatalkan proses resign ini secara paksa? Status akun akan kembali aktif penuh.",
                      confirmText: "Ya, Batalkan Resign",
                      type: 'warning',
                      onConfirm: () => handleCancelResign(selectedReq.id)
                    })}
                    className="px-5 py-3 bg-amber-100 hover:bg-amber-500 hover:text-white text-amber-600 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" /> Batalkan Resign
                  </button>
                  <button 
                    onClick={() => setGenericConfirm({
                      isOpen: true,
                      title: "Suspend Akun Sekarang?",
                      message: "Suspend akun karyawan ini secara manual sekarang tanpa menunggu sisa waktu timer?",
                      confirmText: "Ya, Suspend Sekarang",
                      type: 'danger',
                      onConfirm: () => handleMarkOut(selectedReq.profile_id)
                    })}
                    className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-red-600/10"
                  >
                    {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />} Suspend Akun Sekarang
                  </button>
                </>
              ) : selectedReq.profiles?.status_karyawan !== "aktif" ? (
                <>
                  <button 
                    onClick={() => handleReactivate(selectedReq.profile_id)}
                    disabled={actioning}
                    className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-green-600/10"
                  >
                    <UserCheck className="w-4 h-4" /> Aktifkan Kembali
                  </button>
                  <button 
                    onClick={() => { 
                      setDeleteProfileId(selectedReq.profile_id); 
                      setDeleteType("resign"); 
                      setDeleteConfirmStep(1); 
                      setShowDeleteModal(true); 
                    }}
                    className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-red-600/10"
                  >
                    <Trash2 className="w-4 h-4" /> Hapus Akun Permanen (Farewell WA)
                  </button>
                </>
              ) : selectedReq.status === "Dibatalkan" ? (
                <div className="w-full flex flex-col gap-4 mt-4">
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl">
                    <p className="text-xs font-bold text-red-600 dark:text-red-400 leading-relaxed">
                       <strong className="uppercase font-black tracking-wider">Pengajuan Dibatalkan</strong><br/>
                      Seluruh tombol aksi standar telah dinonaktifkan karena pengajuan ini tercatat batal. Namun, jika Anda ingin mengaktifkan/melanjutkan kembali proses keluar untuk karyawan ini, isi form waktu di atas dan klik tombol di bawah.
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <button 
                      onClick={() => handleResumeResign(selectedReq.id)}
                      disabled={actioning}
                      className="px-6 py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-teal-600/20"
                    >
                      {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Lanjutkan Proses Keluar yang Sempat Dibatalkan
                    </button>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-muted font-bold uppercase py-2">Proses Pengajuan Selesai</span>
              )}
            </div>
          </div>
        )}
      </BaseModal>

      {/* REJECT EXPLANATION MODAL */}
      <BaseModal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} size="md" title="Tolak Pengajuan Resign">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <p className="text-sm text-muted">Masukkan catatan atau alasan mengapa pengunduran diri ditolak oleh pihak manajemen.</p>
        </div>

        <div className="space-y-4">
          <textarea 
            rows={3} 
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Contoh: Tanggal efektif keluar terlalu dekat, silakan ajukan ulang minimal H-30..."
            className="w-full p-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-red-500 text-sm text-text-light dark:text-text-dark"
          />
          <div className="flex gap-4">
            <button type="button" onClick={() => setShowRejectModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-muted rounded-2xl font-black text-xs uppercase">Batal</button>
            <button 
              type="button"
              onClick={handleRejectSubmit} 
              disabled={actioning} 
              className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
            >
              {actioning ? <Loader2 className="w-5 h-5 animate-spin" /> : "Tolak Pengajuan"}
            </button>
          </div>
        </div>
      </BaseModal>

      {/* PECAT CONFIRMATION MODAL */}
      <BaseModal isOpen={showPecatModal && !!selectedEmp} onClose={() => setShowPecatModal(false)} size="md" title="Pecat Karyawan">
        {selectedEmp && (
          <div>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <p className="text-sm text-muted">Anda akan memberhentikan secara sepihak akun kasir/karyawan <strong className="font-bold text-text-light dark:text-text-dark">{selectedEmp.full_name}</strong> dan menangguhkan aktivitasnya.</p>
            </div>

            <div className="space-y-4">
              <textarea 
                rows={3} 
                value={pecatReason}
                onChange={e => setPecatReason(e.target.value)}
                placeholder="Sebutkan alasan penonaktifan karyawan (Opsional)..."
                className="w-full p-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-red-500 text-sm text-text-light dark:text-text-dark"
              />
              <div className="flex gap-4">
                <button type="button" onClick={() => setShowPecatModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-muted rounded-2xl font-black text-xs uppercase">Batal</button>
                <button 
                  type="button"
                  onClick={handlePecatSubmit} 
                  disabled={actioning} 
                  className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                >
                  {actioning ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ya, Suspend Akun"}
                </button>
              </div>
            </div>
          </div>
        )}
      </BaseModal>

      {/* DELETE PERMANENTLY 2-STEP CONFIRMATION */}
      <BaseModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} size="md" title="Hapus Akun Permanen">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-bold text-text-light dark:text-text-dark uppercase mb-2">
            {deleteConfirmStep === 1 ? "Konfirmasi Langkah 1" : "Konfirmasi Langkah Terakhir!"}
          </h4>
          <p className="text-sm text-muted leading-relaxed">
            {deleteConfirmStep === 1 
              ? "Tindakan ini akan menghapus akun login dan seluruh profil karyawan secara permanen dari database." 
              : "PERINGATAN KERAS! Akun yang dihapus tidak dapat dipulihkan dengan cara apa pun. Pesan WhatsApp perpisahan otomatis akan langsung terkirim."}
          </p>
        </div>

        <div className="space-y-4">
          {deleteConfirmStep === 1 ? (
            <div className="flex gap-4">
              <button type="button" onClick={() => setShowDeleteModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-muted rounded-2xl font-black text-xs uppercase">Batal</button>
              <button 
                type="button"
                onClick={() => setDeleteConfirmStep(2)} 
                className="flex-1 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-500/20"
              >
                Lanjut Langkah 2
              </button>
            </div>
          ) : (
            <div className="flex gap-4">
              <button type="button" onClick={() => setDeleteConfirmStep(1)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-muted rounded-2xl font-black text-xs uppercase">Kembali</button>
              <button 
                type="button"
                onClick={handleDeletePermanently} 
                disabled={actioning} 
                className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
              >
                {actioning ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ya, Hapus Akun & Kirim WA"}
              </button>
            </div>
          )}
        </div>
      </BaseModal>

      {/* GENERIC MODERN CONFIRMATION MODAL */}
      <BaseModal isOpen={genericConfirm.isOpen} onClose={() => setGenericConfirm(prev => ({...prev, isOpen: false}))} size="sm" showCloseButton={false}>
        <div className="text-center space-y-6">
          <div className={`w-16 h-16 ${genericConfirm.type === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'} rounded-2xl flex items-center justify-center mx-auto`}>
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-black text-text-light dark:text-text-dark uppercase tracking-wide">{genericConfirm.title}</h3>
            <p className="text-sm text-muted leading-relaxed mt-2">{genericConfirm.message}</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => setGenericConfirm(prev => ({...prev, isOpen: false}))}
              className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-muted font-black rounded-xl text-xs uppercase"
            >
              Batal
            </button>
            <button 
              onClick={() => {
                genericConfirm.onConfirm();
                setGenericConfirm(prev => ({...prev, isOpen: false}));
              }}
              className={`flex-1 py-3.5 ${genericConfirm.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'} text-white font-black rounded-xl text-xs uppercase shadow-lg transition-all`}
            >
              {genericConfirm.confirmText}
            </button>
          </div>
        </div>
      </BaseModal>

      {/* PRINT STYLING */}
      <style jsx global>{`
        @media print {
          /* Sembunyikan chrome pembungkus dashboard */
          aside,
          header,
          nav,
          .print\\:hidden,
          button {
            display: none !important;
          }

          /* Hilangkan banner maintenance jika ada */
          .bg-gradient-to-r.from-amber-500.to-orange-600 {
            display: none !important;
          }

          /* Hilangkan padding kiri layout utama agar laporan penuh */
          .lg\\:pl-72 {
            padding-left: 0 !important;
          }
          
          /* Atur normalisasi halaman cetak */
          body, html {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Hilangkan efek bayangan dan warna latar gelap */
          .bg-card-light, .dark\\:bg-card-dark, .bg-white, .dark\\:bg-gray-900, .bg-card-dark {
            background: transparent !important;
            box-shadow: none !important;
            border: none !important;
          }

          /* Pastikan tabel tidak terpotong (overflow visible) */
          .overflow-x-auto, .overflow-hidden {
            overflow: visible !important;
            max-width: 100% !important;
          }

          /* Desain tabel yang rapi dan tegas */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            border: 1.5px solid #000000 !important;
            margin-top: 20px !important;
          }
          th {
            background-color: #f1f5f9 !important;
            color: #000000 !important;
            font-weight: bold !important;
            border: 1px solid #000000 !important;
            padding: 10px 8px !important;
            font-size: 11px !important;
            text-transform: uppercase !important;
          }
          td {
            border: 1px solid #64748b !important;
            padding: 10px 8px !important;
            font-size: 11px !important;
            color: #000000 !important;
          }

          /* Layout kartu statistik khusus cetak */
          .grid {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 15px !important;
            margin-bottom: 20px !important;
          }
          .grid > div {
            border: 1.5px solid #000000 !important;
            border-radius: 12px !important;
            padding: 15px !important;
            background-color: #f8fafc !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            justify-content: center !important;
          }
          /* Sembunyikan ikon lingkaran di dalam kartu statistik saat cetak */
          .grid > div > div:first-child {
            display: none !important;
          }
        }
      `}</style>

    </div>
  );
}
