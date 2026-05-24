"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, Mail, Phone, Calendar,
  Filter, Download, User, Shield, Trash2, Edit, Loader2,
  AlertTriangle, Clock, Ban, CheckCircle, ShieldAlert,
  ArrowRight, MessageSquare, Check, X, Bell
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import toast from "react-hot-toast";

// Helper component for live countdown timer in table row
function CountdownTimer({ suspendUntil, onExpired }: { suspendUntil: string; onExpired: () => void }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const calculate = () => {
      const difference = new Date(suspendUntil).getTime() - Date.now();
      if (difference <= 0) {
        setTimeLeft("Habis");
        onExpired();
        return;
      }
      let tempDiff = difference;
      const tahun = Math.floor(tempDiff / 31536000000);
      tempDiff -= tahun * 31536000000;

      const bulan = Math.floor(tempDiff / 2592000000);
      tempDiff -= bulan * 2592000000;

      const minggu = Math.floor(tempDiff / 604800000);
      tempDiff -= minggu * 604800000;

      const hari = Math.floor(tempDiff / 86400000);
      tempDiff -= hari * 86400000;

      const jam = Math.floor(tempDiff / 3600000);
      tempDiff -= jam * 3600000;

      const menit = Math.floor(tempDiff / 60000);
      tempDiff -= menit * 60000;

      const detik = Math.floor(tempDiff / 1000);

      const parts = [];
      if (tahun > 0) parts.push(`${tahun}th`);
      if (bulan > 0) parts.push(`${bulan}bl`);
      if (minggu > 0) parts.push(`${minggu}mg`);
      if (hari > 0) parts.push(`${hari}hr`);
      if (jam > 0) parts.push(`${jam}j`);
      if (menit > 0) parts.push(`${menit}m`);
      if (detik > 0) parts.push(`${detik}d`);

      setTimeLeft(parts.join(" "));
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [suspendUntil, onExpired]);

  return (
    <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md border border-amber-200/30">
      {timeLeft}
    </span>
  );
}

export default function AdminCustomersPage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  
  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterWarning, setFilterWarning] = useState("all");
  
  // Edit customer details
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", phone: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  // Modals for actions
  const [activeModal, setActiveModal] = useState<{
    type: "suspend" | "ban" | "restore" | "warning" | "bulk_suspend" | "bulk_ban" | "bulk_restore";
    customer?: any;
  } | null>(null);

  // Action forms states
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [duration, setDuration] = useState<Record<string, string>>({
    years: "", months: "", weeks: "", days: "", hours: "1", minutes: "", seconds: ""
  });
  const [prevDefaultMsg, setPrevDefaultMsg] = useState("");
  const [prevDefaultReason, setPrevDefaultReason] = useState("");

  // Helper to build a readable Indonesian duration string
  const getDurationText = () => {
    const parts = [];
    if (duration.years && Number(duration.years) > 0) parts.push(`${duration.years} tahun`);
    if (duration.months && Number(duration.months) > 0) parts.push(`${duration.months} bulan`);
    if (duration.weeks && Number(duration.weeks) > 0) parts.push(`${duration.weeks} minggu`);
    if (duration.days && Number(duration.days) > 0) parts.push(`${duration.days} hari`);
    if (duration.hours && Number(duration.hours) > 0) parts.push(`${duration.hours} jam`);
    if (duration.minutes && Number(duration.minutes) > 0) parts.push(`${duration.minutes} menit`);
    if (duration.seconds && Number(duration.seconds) > 0) parts.push(`${duration.seconds} detik`);
    return parts.join(" ") || "1 jam";
  };

  useEffect(() => {
    if (!activeModal) {
      setPrevDefaultMsg("");
      setPrevDefaultReason("");
      return;
    }

    let nextReason = "";
    let nextMessage = "";

    if (activeModal.type === "suspend" || activeModal.type === "bulk_suspend") {
      nextReason = "Pelanggaran syarat ketentuan penggunaan layanan";
      const durText = getDurationText();
      nextMessage = `Akun Anda ditangguhkan sementara selama ${durText} karena alasan penertiban sistem. Akses Anda akan dipulihkan secara otomatis setelah masa penangguhan selesai.`;
    } else if (activeModal.type === "ban" || activeModal.type === "bulk_ban") {
      nextReason = "Pelanggaran berat ketentuan layanan";
      nextMessage = "Akun Anda diblokir secara permanen dari sistem RestoBook karena pelanggaran berat terhadap syarat dan ketentuan penggunaan. Keputusan ini bersifat final.";
    } else if (activeModal.type === "warning") {
      nextMessage = "Ini adalah peringatan resmi mengenai aktivitas akun Anda. Harap patuhi kebijakan komunitas dan syarat penggunaan RestoBook agar terhindar dari penangguhan akun.";
    } else if (activeModal.type === "restore" || activeModal.type === "bulk_restore") {
      nextMessage = "Selamat, akun Anda telah diaktifkan kembali oleh manajemen. Anda sekarang dapat menikmati kembali seluruh layanan kami.";
    }

    // Only update if current is empty or matches the previous default
    if (reason === "" || reason === prevDefaultReason) {
      setReason(nextReason);
      setPrevDefaultReason(nextReason);
    }
    if (message === "" || message === prevDefaultMsg) {
      setMessage(nextMessage);
      setPrevDefaultMsg(nextMessage);
    }
  }, [activeModal, duration.years, duration.months, duration.weeks, duration.days, duration.hours, duration.minutes, duration.seconds]);
  
  // Scheduling & Warnings settings
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [warningThreshold, setWarningThreshold] = useState("none");

  // Slideover Detail Panel state
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerLogs, setCustomerLogs] = useState<any[]>([]);
  const [customerAppeals, setCustomerAppeals] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});

  const supabase = createClient();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "customer")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(data || []);

      // Trigger automatic checks for scheduled suspends that are past due
      if (data) {
        checkAndRunScheduledSuspends(data);
      }
    } catch (error: any) {
      toast.error("Gagal mengambil data pelanggan: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Check and execute scheduled suspends on the fly
  const checkAndRunScheduledSuspends = async (list: any[]) => {
    const now = new Date();
    const toSuspend = list.filter(c =>
      c.status === "active" &&
      c.scheduled_suspend_at &&
      new Date(c.scheduled_suspend_at) <= now
    );

    if (toSuspend.length === 0) return;

    // Process concurrently
    await Promise.all(toSuspend.map(async (c) => {
      try {
        const isPermanent = c.suspend_type === "permanent";
        
        let secondsLeft = 3600; // default 1 hour if not specified
        if (c.suspend_until) {
          secondsLeft = Math.max(60, Math.floor((new Date(c.suspend_until).getTime() - Date.now()) / 1000));
        }

        await fetch("/api/admin/customers/suspend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: isPermanent ? "ban" : "suspend",
            customer_id: c.id,
            reason: c.suspend_reason || "Penangguhan terjadwal otomatis dimulai",
            message: c.suspend_message || "Akun Anda ditangguhkan sesuai jadwal",
            duration: isPermanent ? null : { seconds: secondsLeft }
          })
        });
      } catch (err) {
        console.error("Gagal memproses penangguhan terjadwal:", err);
      }
    }));

    // Reload list after processing
    const { data: updatedData } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "customer")
      .order("created_at", { ascending: false });
    if (updatedData) setCustomers(updatedData);
  };

  // Fetch details (logs & appeals) when a customer detail panel is opened
  const fetchCustomerDetails = async (customer: any) => {
    setLoadingDetails(true);
    try {
      // 1. Fetch suspend logs
      const { data: logs, error: logsErr } = await supabase
        .from("suspend_logs")
        .select("*")
        .eq("user_id", customer.id)
        .order("acted_at", { ascending: false });

      if (logsErr) throw logsErr;
      setCustomerLogs(logs || []);

      // 2. Fetch appeals
      const { data: appeals, error: appealsErr } = await supabase
        .from("appeals")
        .select("*")
        .eq("user_id", customer.id)
        .order("created_at", { ascending: false });

      if (appealsErr) throw appealsErr;
      setCustomerAppeals(appeals || []);

      // 3. Fetch admin names for acted_by field
      const adminIds = Array.from(new Set(logs?.map(l => l.acted_by).filter(Boolean)));
      if (adminIds.length > 0) {
        const { data: admins } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", adminIds);
        
        const namesMap: Record<string, string> = {};
        admins?.forEach(a => {
          namesMap[a.id] = a.full_name;
        });
        setAdminNames(prev => ({ ...prev, ...namesMap }));
      }
    } catch (err: any) {
      toast.error("Gagal memuat detail riwayat: " + err.message);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerDetails(selectedCustomer);
    }
  }, [selectedCustomer]);

  // Selection toggle handlers
  const handleSelectRow = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const activeFiltered = filteredCustomers.map(c => c.id);
      setSelectedIds(activeFiltered);
    } else {
      setSelectedIds([]);
    }
  };

  // Searching & Filtering
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch =
      customer.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone?.includes(searchQuery) ||
      customer.suspend_reason?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      filterStatus === "all" || customer.status === filterStatus;

    let matchesWarning = true;
    if (filterWarning === "1") matchesWarning = (customer.warning_count || 0) >= 1;
    if (filterWarning === "3") matchesWarning = (customer.warning_count || 0) >= 3;

    return matchesSearch && matchesStatus && matchesWarning;
  });

  // Action submit handlers
  const handleSuspendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal?.customer) return;
    if (!reason.trim() || !message.trim()) return toast.error("Alasan dan pesan wajib diisi");

    const toastId = toast.loading(isScheduled ? "Menjadwalkan penangguhan..." : "Memproses penangguhan...");
    try {
      const { data: adminUser } = await supabase.auth.getUser();
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", adminUser.user?.id || "")
        .single();

      const endpoint = "/api/admin/customers/suspend";
      const parsedDuration = {
        years: duration.years ? Number(duration.years) : 0,
        months: duration.months ? Number(duration.months) : 0,
        weeks: duration.weeks ? Number(duration.weeks) : 0,
        days: duration.days ? Number(duration.days) : 0,
        hours: duration.hours ? Number(duration.hours) : 0,
        minutes: duration.minutes ? Number(duration.minutes) : 0,
        seconds: duration.seconds ? Number(duration.seconds) : 0
      };

      const payload = isScheduled ? {
        action: "schedule",
        customer_id: activeModal.customer.id,
        admin_id: adminProfile?.id,
        scheduled_at: scheduledAt,
        suspend_type: "temporary",
        reason,
        message,
        duration: parsedDuration
      } : {
        action: "suspend",
        customer_id: activeModal.customer.id,
        admin_id: adminProfile?.id,
        reason,
        message,
        duration: parsedDuration
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Gagal memproses permintaan");

      toast.success(resData.message || "Tindakan berhasil diterapkan", { id: toastId });
      setActiveModal(null);
      resetForms();
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handleBanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal?.customer) return;
    if (!reason.trim() || !message.trim()) return toast.error("Alasan dan pesan wajib diisi");

    const toastId = toast.loading(isScheduled ? "Menjadwalkan pemblokiran..." : "Memproses pemblokiran...");
    try {
      const { data: adminUser } = await supabase.auth.getUser();
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", adminUser.user?.id || "")
        .single();

      const endpoint = "/api/admin/customers/suspend";
      const payload = isScheduled ? {
        action: "schedule",
        customer_id: activeModal.customer.id,
        admin_id: adminProfile?.id,
        scheduled_at: scheduledAt,
        suspend_type: "permanent",
        reason,
        message
      } : {
        action: "ban",
        customer_id: activeModal.customer.id,
        admin_id: adminProfile?.id,
        reason,
        message
      };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Gagal memproses permintaan");

      toast.success("Akun berhasil dibanned permanen", { id: toastId });
      setActiveModal(null);
      resetForms();
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal?.customer) return;

    const toastId = toast.loading("Memulihkan akun...");
    try {
      const { data: adminUser } = await supabase.auth.getUser();
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", adminUser.user?.id || "")
        .single();

      const res = await fetch("/api/admin/customers/suspend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore",
          customer_id: activeModal.customer.id,
          admin_id: adminProfile?.id,
          restored_message: message || "Selamat, akun Anda telah diaktifkan kembali."
        })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Gagal memulihkan akun");

      toast.success("Akun berhasil dipulihkan kembali", { id: toastId });
      setActiveModal(null);
      resetForms();
      fetchCustomers();
      if (selectedCustomer?.id === activeModal.customer.id) {
        setSelectedCustomer({ ...selectedCustomer, status: "active" });
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handleWarningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModal?.customer) return;
    if (!message.trim()) return toast.error("Pesan peringatan wajib diisi");

    const toastId = toast.loading("Mengirim peringatan...");
    try {
      const res = await fetch("/api/admin/customers/warning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: activeModal.customer.id,
          warning_message: message
        })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Gagal mengirim peringatan");

      toast.success(resData.message || "Peringatan berhasil dikirim", { id: toastId });

      // Handle threshold auto-suspend logic locally on demand
      if (warningThreshold !== "none") {
        const nextCount = (activeModal.customer.warning_count || 0) + 1;
        const limit = Number(warningThreshold);
        if (nextCount >= limit) {
          toast.loading("Batas peringatan terlampaui. Menangguhkan akun otomatis...", { id: toastId });
          
          const { data: adminUser } = await supabase.auth.getUser();
          const { data: adminProfile } = await supabase.from("profiles").select("id").eq("user_id", adminUser.user?.id || "").single();

          await fetch("/api/admin/customers/suspend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "suspend",
              customer_id: activeModal.customer.id,
              admin_id: adminProfile?.id,
              reason: `Ditangguhkan otomatis setelah mencapai ${limit} peringatan.`,
              message: "Akun Anda ditangguhkan otomatis oleh sistem karena telah menerima peringatan berulang.",
              duration: { days: 1 } // Auto suspend 1 day
            })
          });
          toast.success("Akun otomatis ditangguhkan selama 24 jam", { id: toastId });
        }
      }

      setActiveModal(null);
      resetForms();
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handleBulkActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !activeModal) return;

    const actionMap: Record<string, string> = {
      bulk_suspend: "suspend",
      bulk_ban: "ban",
      bulk_restore: "restore"
    };
    const currentAction = actionMap[activeModal.type];

    const toastId = toast.loading(`Memproses ${selectedIds.length} akun secara massal...`);
    try {
      const { data: adminUser } = await supabase.auth.getUser();
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", adminUser.user?.id || "")
        .single();

      const parsedDuration = {
        years: duration.years ? Number(duration.years) : 0,
        months: duration.months ? Number(duration.months) : 0,
        weeks: duration.weeks ? Number(duration.weeks) : 0,
        days: duration.days ? Number(duration.days) : 0,
        hours: duration.hours ? Number(duration.hours) : 0,
        minutes: duration.minutes ? Number(duration.minutes) : 0,
        seconds: duration.seconds ? Number(duration.seconds) : 0
      };

      const res = await fetch("/api/admin/customers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: currentAction,
          customer_ids: selectedIds,
          admin_id: adminProfile?.id,
          reason: reason || "Tindakan massal administrator",
          message: message || "Akun Anda diubah statusnya oleh manajemen RestoBook",
          duration: parsedDuration
        })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Gagal memproses aksi massal");

      toast.success(`Berhasil memproses ${selectedIds.length} pelanggan`, { id: toastId });
      setActiveModal(null);
      resetForms();
      setSelectedIds([]);
      fetchCustomers();
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  const resetForms = () => {
    setReason("");
    setMessage("");
    setScheduledAt("");
    setIsScheduled(false);
    setWarningThreshold("none");
    setDuration({ years: "", months: "", weeks: "", days: "", hours: "1", minutes: "", seconds: "" });
    setPrevDefaultMsg("");
    setPrevDefaultReason("");
  };

  const handleAppealReview = async (appealId: string, status: "approved" | "rejected") => {
    const msg = prompt(`Masukkan tanggapan atau pesan manajemen untuk banding ini (opsional):`);
    if (msg === null) return; // cancelled

    const toastId = toast.loading("Memproses banding...");
    try {
      const { data: adminUser } = await supabase.auth.getUser();
      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", adminUser.user?.id || "")
        .single();

      const res = await fetch("/api/admin/customers/appeal", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appeal_id: appealId,
          status,
          admin_message: msg || (status === "approved" ? "Banding diterima." : "Banding ditolak."),
          admin_id: adminProfile?.id
        })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Gagal memproses banding");

      toast.success(status === "approved" ? "Banding berhasil disetujui, akun aktif" : "Banding ditolak", { id: toastId });
      if (selectedCustomer) {
        fetchCustomerDetails(selectedCustomer);
        fetchCustomers();
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  const handleEditClick = (customer: any) => {
    setIsEditing(customer);
    setEditForm({ full_name: customer.full_name || "", phone: customer.phone || "" });
  };

  // Edit core customer (profile details)
  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;
    setSavingEdit(true);
    const toastId = toast.loading("Menyimpan data...");
    try {
      const res = await fetch("/api/admin/customers/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isEditing.id,
          full_name: editForm.full_name,
          phone: editForm.phone
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui data");
      toast.success("Data profil berhasil diperbarui", { id: toastId });
      setIsEditing(null);
      fetchCustomers();
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    } finally {
      setSavingEdit(false);
    }
  };

  // Delete customer core
  const handleDelete = async (customer: any) => {
    if (!confirm(`Yakin ingin menghapus seluruh data pelanggan ${customer.full_name || customer.email}?`)) return;
    setIsDeleting(customer.id);
    const toastId = toast.loading("Sedang menghapus data...");
    try {
      const res = await fetch("/api/profile/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: customer.user_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus pelanggan");
      toast.success("Pelanggan berhasil dihapus", { id: toastId });
      fetchCustomers();
    } catch (e: any) {
      toast.error(e.message, { id: toastId });
    } finally {
      setIsDeleting(null);
    }
  };

  // Helper stats values
  const totalCount = customers.length;
  const suspendedCount = customers.filter(c => c.status === "suspended").length;
  const bannedCount = customers.filter(c => c.status === "banned").length;
  const activeCount = totalCount - suspendedCount - bannedCount;

  return (
    <div className="space-y-8 pb-20 relative min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black text-text-light dark:text-text-dark tracking-tight">Data Pelanggan</h1>
          </div>
          <p className="text-muted text-sm font-medium">Manajemen data status, penangguhan, dan pemblokiran pelanggan RestoBook</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Pelanggan", value: totalCount, icon: Users, color: "bg-blue-500", text: "Registrasi aktif" },
          { label: "Pelanggan Aktif", value: activeCount, icon: CheckCircle, color: "bg-emerald-500", text: "Akses normal" },
          { label: "Ditangguhkan", value: suspendedCount, icon: Clock, color: "bg-amber-500", text: "Akses dibatasi sementara" },
          { label: "Dibanned Permanen", value: bannedCount, icon: Ban, color: "bg-red-500", text: "Blokir akses selamanya" },
        ].map((stat, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="p-6 bg-white dark:bg-gray-800 rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm flex items-center gap-5"
          >
            <div className={`p-4 ${stat.color} text-white rounded-2xl shadow-lg`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-muted text-xs font-bold uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-2xl font-black text-text-light dark:text-text-dark mt-0.5">{stat.value}</h3>
              <p className="text-[10px] text-muted font-medium mt-0.5">{stat.text}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bulk Action Panel - Float at top table if elements selected */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-primary/10 border-2 border-primary/20 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                {selectedIds.length}
              </div>
              <span className="text-sm font-bold text-primary">Pelanggan Terpilih</span>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setActiveModal({ type: "bulk_suspend" })}
                className="flex-1 sm:flex-initial px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1"
              >
                <Clock className="w-3.5 h-3.5" /> Suspen Massal
              </button>
              <button
                onClick={() => setActiveModal({ type: "bulk_ban" })}
                className="flex-1 sm:flex-initial px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1"
              >
                <Ban className="w-3.5 h-3.5" /> Ban Massal
              </button>
              <button
                onClick={() => setActiveModal({ type: "bulk_restore" })}
                className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Pulihkan Massal
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-text-light dark:text-text-dark rounded-xl text-xs font-bold transition-colors"
                title="Batal pilih semua"
              >
                Batal
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter & Table Section */}
      <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="p-8 border-b border-border-light dark:border-border-dark flex flex-col lg:flex-row gap-4 justify-between items-center">
          <div className="relative w-full lg:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Cari nama, email, no. telp, alasan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-primary rounded-2xl outline-none transition-all text-sm font-medium text-text-light dark:text-text-dark"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
            {/* Status Filter */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border border-border-light dark:border-border-dark">
              <Filter className="w-4 h-4 text-muted" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-xs font-bold outline-none text-text-light dark:text-text-dark"
                title="Status Filter"
              >
                <option value="all">Semua Status</option>
                <option value="active">Aktif</option>
                <option value="suspended">Ditangguhkan</option>
                <option value="banned">Dibanned</option>
              </select>
            </div>

            {/* Warning Filter */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-xl border border-border-light dark:border-border-dark">
              <ShieldAlert className="w-4 h-4 text-muted" />
              <select
                value={filterWarning}
                onChange={(e) => setFilterWarning(e.target.value)}
                className="bg-transparent text-xs font-bold outline-none text-text-light dark:text-text-dark"
                title="Warning Threshold Filter"
              >
                <option value="all">Semua Peringatan</option>
                <option value="1">Minimal 1 Peringatan</option>
                <option value="3">Minimal 3 Peringatan</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="px-6 py-5 text-center w-12">
                  <input
                    type="checkbox"
                    checked={filteredCustomers.length > 0 && selectedIds.length === filteredCustomers.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                    title="Select all customers on page"
                  />
                </th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted">Pelanggan</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted">Kontak</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted">Status & Peringatan</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted">Tipe & Sisa Waktu</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-muted text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-muted font-bold">Sedang memuat data...</p>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-muted font-medium italic">
                    Tidak ada pelanggan yang ditemukan.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const isSelected = selectedIds.includes(customer.id);
                  const isSuspended = customer.status === "suspended";
                  const isBanned = customer.status === "banned";
                  const isScheduledSuspend = customer.scheduled_suspend_at !== null;

                  return (
                    <tr
                      key={customer.id}
                      className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group ${
                        isSelected ? "bg-primary/5 dark:bg-primary/5" : ""
                      }`}
                    >
                      <td className="px-6 py-5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(customer.id)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary"
                          title={`Select ${customer.full_name || 'customer'}`}
                        />
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 dark:border-gray-700 shadow-sm flex-shrink-0 flex items-center justify-center text-primary bg-primary/10">
                            {customer.avatar_url ? (
                              <img src={customer.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-text-light dark:text-text-dark text-sm leading-tight">
                              {customer.full_name || "Tanpa Nama"}
                            </p>
                            <p className="text-[10px] font-mono text-muted tracking-tight mt-0.5">
                              ID: {customer.id.split("-")[0]}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-light/80 dark:text-text-dark/80">
                            <Mail className="w-3.5 h-3.5 text-muted" /> {customer.email || "-"}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
                            <Phone className="w-3.5 h-3.5" /> {customer.phone || "-"}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1.5 items-start">
                          {isBanned ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400 text-[10px] font-black uppercase tracking-wider border border-red-200/50 dark:border-red-800/30 flex items-center gap-1">
                              <Ban className="w-3 h-3" /> Ban Permanen
                            </span>
                          ) : isSuspended ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider border border-amber-200/50 dark:border-amber-800/30 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Suspen
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 text-[10px] font-black uppercase tracking-wider border border-green-200/50 dark:border-green-800/30 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Aktif
                            </span>
                          )}

                          {customer.warning_count > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-text-light dark:text-text-dark text-[10px] font-bold flex items-center gap-1 border border-border-light dark:border-border-dark">
                              <ShieldAlert className="w-3 h-3 text-red-500" /> {customer.warning_count} Peringatan
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1 items-start text-xs font-semibold text-text-light dark:text-text-dark">
                          {isBanned ? (
                            <span className="text-red-600 dark:text-red-400 font-bold">Permanen</span>
                          ) : isSuspended && customer.suspend_until ? (
                            <CountdownTimer
                              suspendUntil={customer.suspend_until}
                              onExpired={fetchCustomers}
                            />
                          ) : isScheduledSuspend && customer.scheduled_suspend_at ? (
                            <div className="space-y-0.5">
                              <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                                Terjadwal
                              </span>
                              <p className="text-[10px] text-muted">
                                {format(new Date(customer.scheduled_suspend_at), "dd MMM yyyy HH:mm", { locale: id })}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick action: Suspen */}
                          {!isBanned && !isSuspended && (
                            <button
                              onClick={() => setActiveModal({ type: "suspend", customer })}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 dark:text-amber-400 rounded-lg text-[10px] font-bold transition-all"
                            >
                              Suspen
                            </button>
                          )}

                          {/* Quick action: Ban */}
                          {!isBanned && (
                            <button
                              onClick={() => setActiveModal({ type: "ban", customer })}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-400 rounded-lg text-[10px] font-bold transition-all"
                            >
                              Ban
                            </button>
                          )}

                          {/* Quick action: Buka Akun */}
                          {(isSuspended || isBanned) && (
                            <button
                              onClick={() => setActiveModal({ type: "restore", customer })}
                              className="px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/20 dark:hover:bg-green-950/40 dark:text-green-400 rounded-lg text-[10px] font-bold transition-all"
                            >
                              Buka Akun
                            </button>
                          )}

                          {/* Quick action: Kirim Peringatan */}
                          {!isBanned && (
                            <button
                              onClick={() => setActiveModal({ type: "warning", customer })}
                              className="p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 rounded-lg transition-all text-muted"
                              title="Kirim Peringatan"
                            >
                              <Bell className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedCustomer(customer)}
                            className="px-2.5 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                          >
                            Detail
                          </button>

                          <button
                            onClick={() => handleEditClick(customer)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 rounded-lg text-muted transition-colors"
                            title="Edit Profil"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDelete(customer)}
                            className="p-1.5 hover:bg-red-150 hover:text-red-650 rounded-lg text-muted transition-colors"
                            title="Hapus Akun"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slideover Detail Panel */}
      <AnimatePresence>
        {selectedCustomer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black"
              onClick={() => setSelectedCustomer(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white dark:bg-gray-800 shadow-2xl border-l border-border-light dark:border-border-dark overflow-y-auto flex flex-col p-8"
            >
              {/* Slideover Header */}
              <div className="flex items-center justify-between pb-6 border-b border-border-light dark:border-border-dark mb-6">
                <div>
                  <h3 className="text-xl font-black text-text-light dark:text-text-dark uppercase tracking-tight">Detail & Riwayat Akun</h3>
                  <p className="text-muted text-xs font-medium mt-0.5">Informasi penangguhan, log audit, dan pengajuan banding</p>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="Tutup Panel"
                >
                  <X className="w-5 h-5 text-muted" />
                </button>
              </div>

              {/* Customer summary */}
              <div className="bg-gray-50 dark:bg-gray-900/40 p-6 rounded-2xl border border-border-light dark:border-border-dark mb-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black border border-primary/20 text-xl">
                    {selectedCustomer.avatar_url ? (
                      <img src={selectedCustomer.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      selectedCustomer.full_name?.charAt(0).toUpperCase() || "P"
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-text-light dark:text-text-dark text-base">{selectedCustomer.full_name || "Tanpa Nama"}</h4>
                    <p className="text-xs text-muted font-medium">{selectedCustomer.email}</p>
                    <p className="text-[10px] text-muted font-mono mt-1">UID: {selectedCustomer.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-light dark:border-border-dark">
                  <div>
                    <span className="text-[10px] font-black uppercase text-muted tracking-wider block">Status Saat Ini</span>
                    <span className={`inline-block px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full mt-1 ${
                      selectedCustomer.status === "banned" ? "bg-red-100 text-red-700 dark:bg-red-950/20 dark:text-red-400" :
                      selectedCustomer.status === "suspended" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400" :
                      "bg-green-100 text-green-700 dark:bg-green-950/20 dark:text-green-400"
                    }`}>
                      {selectedCustomer.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-muted tracking-wider block">Peringatan Dikirim</span>
                    <span className="text-sm font-bold text-text-light dark:text-text-dark mt-1 block">
                      {selectedCustomer.warning_count || 0} Kali
                    </span>
                  </div>
                </div>
              </div>

              {/* Banding Section (Appeals) */}
              <div className="space-y-4 mb-6">
                <h4 className="text-xs font-black uppercase tracking-wider text-text-light dark:text-text-dark flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" /> Pengajuan Banding (Appeals)
                </h4>

                {loadingDetails ? (
                  <div className="py-4 text-center text-xs text-muted">Memuat banding...</div>
                ) : customerAppeals.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-xl border border-border-light dark:border-border-dark text-xs text-muted italic text-center">
                    Belum ada pengajuan banding.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customerAppeals.map((appeal) => (
                      <div
                        key={appeal.id}
                        className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                          appeal.status === "pending"
                            ? "bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-800/30"
                            : appeal.status === "approved"
                            ? "bg-green-50/50 dark:bg-green-950/10 border-green-200/50 dark:border-green-800/30"
                            : "bg-red-50/50 dark:bg-red-950/10 border-red-200/50 dark:border-red-800/30"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            appeal.status === "approved" ? "bg-green-100 text-green-800 dark:bg-green-900/30" :
                            appeal.status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900/30" :
                            "bg-amber-100 text-amber-800 dark:bg-amber-900/30"
                          }`}>
                            {appeal.status}
                          </span>
                          <span className="text-[10px] text-muted">
                            {format(new Date(appeal.created_at), "dd MMM yyyy HH:mm", { locale: id })}
                          </span>
                        </div>

                        <div>
                          <p className="font-bold text-muted uppercase text-[9px] tracking-wider mb-0.5">Argumen Banding Pengguna</p>
                          <p className="font-semibold text-text-light dark:text-text-dark">{appeal.reason}</p>
                        </div>

                        {appeal.admin_message && (
                          <div className="pt-2 border-t border-dashed border-border-light dark:border-border-dark">
                            <p className="font-bold text-muted uppercase text-[9px] tracking-wider mb-0.5">Tanggapan Admin</p>
                            <p className="italic font-medium text-text-light dark:text-text-dark">{appeal.admin_message}</p>
                          </div>
                        )}

                        {appeal.status === "pending" && (
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => handleAppealReview(appeal.id, "approved")}
                              className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                            >
                              <Check className="w-3 h-3" /> Terima
                            </button>
                            <button
                              onClick={() => handleAppealReview(appeal.id, "rejected")}
                              className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                            >
                              <X className="w-3 h-3" /> Tolak
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Timeline Suspend Logs */}
              <div className="space-y-4 flex-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-text-light dark:text-text-dark flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" /> Riwayat Audit Penangguhan (Audit Logs)
                </h4>

                {loadingDetails ? (
                  <div className="py-4 text-center text-xs text-muted">Memuat log...</div>
                ) : customerLogs.length === 0 ? (
                  <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-xl border border-border-light dark:border-border-dark text-xs text-muted italic text-center">
                    Belum ada log audit penangguhan.
                  </div>
                ) : (
                  <div className="relative pl-6 border-l-2 border-border-light dark:border-border-dark space-y-6">
                    {customerLogs.map((log) => {
                      const dateStr = format(new Date(log.acted_at), "dd MMM yyyy HH:mm", { locale: id });
                      const adminName = log.acted_by ? (adminNames[log.acted_by] || "Admin") : "Sistem";

                      return (
                        <div key={log.id} className="relative">
                          {/* Dot marker */}
                          <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-4 border-white dark:border-gray-800 flex items-center justify-center ${
                            log.action === "suspended" ? "bg-amber-500" :
                            log.action === "banned" ? "bg-red-600" :
                            log.action === "restored" ? "bg-green-500" :
                            "bg-blue-500"
                          }`} />

                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-text-light dark:text-text-dark uppercase tracking-tight">
                                {log.action === "suspended" ? "Akun Ditangguhkan" :
                                 log.action === "banned" ? "Akun Diblokir Permanen" :
                                 log.action === "restored" ? "Akun Dipulihkan" : log.action}
                              </span>
                              <span className="text-[10px] text-muted font-bold">{dateStr}</span>
                            </div>

                            <p className="text-[10px] text-muted font-semibold uppercase">
                              Eksekutor: <span className="text-text-light dark:text-text-dark">{adminName}</span>
                            </p>

                            {log.duration && (
                              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                                Durasi: {log.duration}
                              </p>
                            )}

                            {log.reason && (
                              <div className="p-3 bg-gray-50 dark:bg-gray-900/60 rounded-xl border border-border-light dark:border-border-dark text-[11px] font-medium text-text-light dark:text-text-dark mt-1">
                                <p className="text-[9px] uppercase font-bold text-muted mb-0.5">Alasan</p>
                                {log.reason}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Edit Customer Profile Info Modal */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsEditing(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-[2rem] p-8 w-full max-w-md shadow-2xl border border-border-light dark:border-border-dark"
            >
              <h3 className="text-2xl font-black text-text-light dark:text-text-dark mb-6">Edit Data Pelanggan</h3>
              <form onSubmit={submitEdit} className="space-y-5">
                <div>
                  <label htmlFor="customerFullName" className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">Nama Lengkap</label>
                  <input
                    id="customerFullName"
                    type="text"
                    required
                    placeholder="Nama lengkap"
                    value={editForm.full_name}
                    onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-primary rounded-xl outline-none font-medium text-text-light dark:text-text-dark transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="customerPhone" className="block text-xs font-bold text-muted mb-2 uppercase tracking-wider">No. WhatsApp / Telepon</label>
                  <input
                    id="customerPhone"
                    type="text"
                    placeholder="Contoh: 08123456789"
                    value={editForm.phone}
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-primary rounded-xl outline-none font-medium text-text-light dark:text-text-dark transition-colors"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setIsEditing(null)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-text-light dark:text-text-dark rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    Batal
                  </button>
                  <button type="submit" disabled={savingEdit} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex justify-center items-center gap-2 disabled:opacity-70">
                    {savingEdit ? <Loader2 className="w-5 h-5 animate-spin" /> : "Simpan"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Action Modals (Suspend / Ban / Restore / Warning / Bulk Actions) */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setActiveModal(null);
              resetForms();
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl border border-border-light dark:border-border-dark relative max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Head */}
              <div className="mb-6">
                <h3 className="text-xl font-black text-text-light dark:text-text-dark uppercase tracking-tight">
                  {activeModal.type === "suspend" && `Suspen Pelanggan`}
                  {activeModal.type === "ban" && `Ban Permanen Pelanggan`}
                  {activeModal.type === "restore" && `Pulihkan Akun Pelanggan`}
                  {activeModal.type === "warning" && `Kirim Surat Peringatan`}
                  {activeModal.type === "bulk_suspend" && `Suspen Massal (${selectedIds.length} Pelanggan)`}
                  {activeModal.type === "bulk_ban" && `Ban Massal (${selectedIds.length} Pelanggan)`}
                  {activeModal.type === "bulk_restore" && `Pulihkan Massal (${selectedIds.length} Pelanggan)`}
                </h3>
                {activeModal.customer && (
                  <p className="text-xs text-muted font-bold mt-1">
                    Target: {activeModal.customer.full_name || activeModal.customer.email}
                  </p>
                )}
              </div>

              {/* Form contents */}
              <form
                onSubmit={
                  activeModal.type === "suspend" ? handleSuspendSubmit :
                  activeModal.type === "ban" ? handleBanSubmit :
                  activeModal.type === "restore" ? handleRestoreSubmit :
                  activeModal.type === "warning" ? handleWarningSubmit :
                  handleBulkActionSubmit
                }
                className="space-y-5"
              >
                {/* 1. Duration input for TEMPORARY Suspend or BULK Suspend */}
                {(activeModal.type === "suspend" || activeModal.type === "bulk_suspend") && (
                  <div className="space-y-4">
                    {/* Schedule switch */}
                    {activeModal.type === "suspend" && (
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-border-light dark:border-border-dark">
                        <input
                          id="is_scheduled"
                          type="checkbox"
                          checked={isScheduled}
                          onChange={(e) => setIsScheduled(e.target.checked)}
                          className="w-4 h-4 rounded text-primary focus:ring-primary"
                        />
                        <label htmlFor="is_scheduled" className="text-xs font-bold text-text-light dark:text-text-dark uppercase cursor-pointer">
                          Jadwalkan Aksi Ini (Penangguhan Terjadwal)
                        </label>
                      </div>
                    )}

                    {/* Schedule datetime input */}
                    {isScheduled && (
                      <div className="space-y-2">
                        <label htmlFor="scheduled_at" className="block text-xs font-black uppercase text-muted tracking-wider">Tanggal & Waktu Mulai</label>
                        <input
                          id="scheduled_at"
                          type="datetime-local"
                          required
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-xl outline-none text-xs font-bold text-text-light dark:text-text-dark"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="block text-xs font-black uppercase text-muted tracking-wider">Konfigurasi Durasi Penangguhan</label>
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label htmlFor="dur_years" className="block text-[10px] font-bold text-muted uppercase text-center mb-1">Tahun</label>
                          <input
                            id="dur_years"
                            type="text"
                            placeholder="0"
                            value={duration.years}
                            onChange={(e) => setDuration({ ...duration, years: e.target.value.replace(/\D/g, '') })}
                            className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-xl text-center text-sm font-bold text-text-light dark:text-text-dark"
                          />
                        </div>
                        <div>
                          <label htmlFor="dur_months" className="block text-[10px] font-bold text-muted uppercase text-center mb-1">Bulan</label>
                          <input
                            id="dur_months"
                            type="text"
                            placeholder="0"
                            value={duration.months}
                            onChange={(e) => setDuration({ ...duration, months: e.target.value.replace(/\D/g, '') })}
                            className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-xl text-center text-sm font-bold text-text-light dark:text-text-dark"
                          />
                        </div>
                        <div>
                          <label htmlFor="dur_weeks" className="block text-[10px] font-bold text-muted uppercase text-center mb-1">Minggu</label>
                          <input
                            id="dur_weeks"
                            type="text"
                            placeholder="0"
                            value={duration.weeks}
                            onChange={(e) => setDuration({ ...duration, weeks: e.target.value.replace(/\D/g, '') })}
                            className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-xl text-center text-sm font-bold text-text-light dark:text-text-dark"
                          />
                        </div>
                        <div>
                          <label htmlFor="dur_days" className="block text-[10px] font-bold text-muted uppercase text-center mb-1">Hari</label>
                          <input
                            id="dur_days"
                            type="text"
                            placeholder="0"
                            value={duration.days}
                            onChange={(e) => setDuration({ ...duration, days: e.target.value.replace(/\D/g, '') })}
                            className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-xl text-center text-sm font-bold text-text-light dark:text-text-dark"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div>
                          <label htmlFor="dur_hours" className="block text-[10px] font-bold text-muted uppercase text-center mb-1">Jam</label>
                          <input
                            id="dur_hours"
                            type="text"
                            placeholder="0"
                            value={duration.hours}
                            onChange={(e) => setDuration({ ...duration, hours: e.target.value.replace(/\D/g, '') })}
                            className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-xl text-center text-sm font-bold text-text-light dark:text-text-dark"
                          />
                        </div>
                        <div>
                          <label htmlFor="dur_minutes" className="block text-[10px] font-bold text-muted uppercase text-center mb-1">Menit</label>
                          <input
                            id="dur_minutes"
                            type="text"
                            placeholder="0"
                            value={duration.minutes}
                            onChange={(e) => setDuration({ ...duration, minutes: e.target.value.replace(/\D/g, '') })}
                            className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-xl text-center text-sm font-bold text-text-light dark:text-text-dark"
                          />
                        </div>
                        <div>
                          <label htmlFor="dur_seconds" className="block text-[10px] font-bold text-muted uppercase text-center mb-1">Detik</label>
                          <input
                            id="dur_seconds"
                            type="text"
                            placeholder="0"
                            value={duration.seconds}
                            onChange={(e) => setDuration({ ...duration, seconds: e.target.value.replace(/\D/g, '') })}
                            className="w-full p-2 bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-xl text-center text-sm font-bold text-text-light dark:text-text-dark"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Schedule settings for BANS */}
                {activeModal.type === "ban" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-border-light dark:border-border-dark">
                      <input
                        id="is_scheduled_ban"
                        type="checkbox"
                        checked={isScheduled}
                        onChange={(e) => setIsScheduled(e.target.checked)}
                        className="w-4 h-4 rounded text-primary focus:ring-primary"
                      />
                      <label htmlFor="is_scheduled_ban" className="text-xs font-bold text-text-light dark:text-text-dark uppercase cursor-pointer">
                        Jadwalkan Aksi Ini (Ban Terjadwal)
                      </label>
                    </div>

                    {isScheduled && (
                      <div className="space-y-2">
                        <label htmlFor="scheduled_at_ban" className="block text-xs font-black uppercase text-muted tracking-wider">Tanggal & Waktu Mulai</label>
                        <input
                          id="scheduled_at_ban"
                          type="datetime-local"
                          required
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-xl outline-none text-xs font-bold text-text-light dark:text-text-dark"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Reason textarea */}
                {activeModal.type !== "restore" && activeModal.type !== "bulk_restore" && activeModal.type !== "warning" && (
                  <div className="space-y-2">
                    <label htmlFor="modal_reason" className="block text-xs font-black uppercase text-muted tracking-wider">Alasan Tindakan</label>
                    <textarea
                      id="modal_reason"
                      placeholder="Masukkan alasan penindakan yang sah..."
                      required
                      rows={2}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-2xl text-xs font-medium outline-none text-text-light dark:text-text-dark resize-none focus:border-primary transition-colors"
                    />
                  </div>
                )}

                {/* 4. Notification message textarea */}
                {activeModal.type !== "bulk_ban" && activeModal.type !== "bulk_restore" && (
                  <div className="space-y-2">
                    <label htmlFor="modal_msg" className="block text-xs font-black uppercase text-muted tracking-wider">
                      {activeModal.type === "restore" ? "Pesan Pemulihan Kustom" : "Pesan Notifikasi Untuk Pengguna"}
                    </label>
                    <textarea
                      id="modal_msg"
                      placeholder={
                        activeModal.type === "restore"
                          ? "Masukkan ucapan selamat atau catatan pemulihan..."
                          : "Tuliskan rincian detail/instruksi penangguhan yang akan dikirim ke pengguna..."
                      }
                      required={activeModal.type !== "restore" && activeModal.type !== "warning"}
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-2xl text-xs font-medium outline-none text-text-light dark:text-text-dark resize-none focus:border-primary transition-colors"
                    />
                  </div>
                )}

                {/* 5. Warning System Settings */}
                {activeModal.type === "warning" && (
                  <div className="space-y-2">
                    <label htmlFor="warning_threshold" className="block text-xs font-black uppercase text-muted tracking-wider">Batas Tindakan Otomatis (Threshold)</label>
                    <select
                      id="warning_threshold"
                      value={warningThreshold}
                      onChange={(e) => setWarningThreshold(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-xl outline-none text-xs font-bold text-text-light dark:text-text-dark"
                    >
                      <option value="none">Hanya Kirim Peringatan</option>
                      <option value="1">Suspen Otomatis Pada Peringatan Ke-1 (24 Jam)</option>
                      <option value="3">Suspen Otomatis Pada Peringatan Ke-3 (24 Jam)</option>
                    </select>
                    <p className="text-[10px] text-muted font-medium mt-1">
                      Akun akan otomatis ditangguhkan selama 24 jam jika total peringatan mencapai batas tersebut.
                    </p>
                  </div>
                )}

                {/* Submit / Cancel Buttons */}
                <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModal(null);
                      resetForms();
                    }}
                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-text-light dark:text-text-dark rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs uppercase tracking-wider"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold shadow-lg shadow-primary/20 transition-all text-xs uppercase tracking-wider"
                  >
                    Konfirmasi Aksi
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

