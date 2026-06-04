"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Search, Filter, RefreshCw, AlertTriangle, User, Clock,
  Lock, Unlock, Download, CheckCircle2, Activity, FileSpreadsheet,
  Plus, Minus, Info, X, ChevronRight, UserMinus, ShieldAlert,
  HelpCircle, CreditCard, Clipboard
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import toast from "react-hot-toast";

type WalletStatusFilter = "all" | "active" | "inactive" | "blocked" | "pending" | "processing";

export default function AdminWalletPage() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    total: 0, active: 0, inactive: 0, blocked: 0, pending: 0, processing: 0, totalBalance: 0, totalBlockedBalance: 0
  });
  const [finance, setFinance] = useState<any>({
    totalTopup: 0, totalRefund: 0, totalSpent: 0, totalAdjust: 0
  });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<WalletStatusFilter>("all");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"" | "aktif" | "nonaktif" | "diblokir">("");
  const [bulkReason, setBulkReason] = useState("");
  
  // Modal Manage States
  const [manageTab, setManageTab] = useState<"status" | "balance" | "history" | "audit" | "note">("status");
  const [statusForm, setStatusForm] = useState({ targetStatus: "", reason: "", resumeStatus: "aktif" });
  const [balanceForm, setBalanceForm] = useState({ type: "add", amountValue: "", adjustReason: "", refundReference: "" });
  const [internalNote, setInternalNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Customer transactions history in modal
  const [customerTx, setCustomerTx] = useState<any[]>([]);
  const [customerAudit, setCustomerAudit] = useState<any[]>([]);
  const [loadingModalLogs, setLoadingModalLogs] = useState(false);

  const supabase = createClient();

  const fetchWalletData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        search: searchQuery,
        status: statusFilter,
      });
      const response = await fetch(`/api/admin/wallet?${queryParams.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mengambil data");
      
      setCustomers(data.customers || []);
      setStats(data.stats || {});
      setFinance(data.finance || {});
      setAuditLogs(data.auditLogs || []);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("admin-wallet-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        fetchWalletData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions" }, () => {
        fetchWalletData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_audit_logs" }, () => {
        fetchWalletData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [searchQuery, statusFilter]);

  const fetchCustomerLogs = async (custId: string) => {
    setLoadingModalLogs(true);
    try {
      // Fetch customer transactions
      const txRes = await fetch(`/api/customer/wallet?userId=${custId}`);
      const txData = await txRes.json();
      
      // Fetch audit logs for this specific customer
      const { data: auditData } = await supabase
        .from("wallet_audit_logs")
        .select("*, actor:acted_by(full_name)")
        .eq("customer_id", custId)
        .order("created_at", { ascending: false });

      setCustomerTx(txData.transactions || []);
      setCustomerAudit(auditData || []);
    } catch (e) {
      console.error("Error fetching customer logs:", e);
    } finally {
      setLoadingModalLogs(false);
    }
  };

  const handleOpenManageModal = (cust: any) => {
    setSelectedCustomer(cust);
    setManageTab("status");
    setStatusForm({ targetStatus: cust.is_wallet_blocked ? "diblokir" : cust.wallet_status || "belum_aktif", reason: "", resumeStatus: "aktif" });
    setBalanceForm({ type: "add", amountValue: "", adjustReason: "", refundReference: "" });
    setInternalNote("");
    setCustomerTx([]);
    setCustomerAudit([]);
    setShowManageModal(true);
    fetchCustomerLogs(cust.id);
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || saving) return;
    
    setSaving(true);
    const loadingToast = toast.loading("Memperbarui status Dompetku...");
    try {
      const response = await fetch("/api/admin/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          action: "change_status",
          targetStatus: statusForm.targetStatus,
          statusReason: statusForm.reason,
          resumeStatus: statusForm.resumeStatus,
          note: internalNote
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memperbarui status");

      toast.success(data.message || "Status berhasil diperbarui!", { id: loadingToast });
      setShowManageModal(false);
      fetchWalletData();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui status", { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const handleBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || saving) return;

    setSaving(true);
    const loadingToast = toast.loading("Menyesuaikan saldo Dompetku...");
    try {
      const response = await fetch("/api/admin/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          action: "adjust_balance",
          type: balanceForm.type,
          amountValue: balanceForm.amountValue,
          adjustReason: balanceForm.adjustReason,
          refundReference: balanceForm.refundReference,
          note: internalNote
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memperbarui saldo");

      toast.success(data.message || "Saldo berhasil disesuaikan!", { id: loadingToast });
      setShowManageModal(false);
      fetchWalletData();
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui saldo", { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || saving || !internalNote.trim()) return;

    setSaving(true);
    const loadingToast = toast.loading("Menyimpan memo internal...");
    try {
      const response = await fetch("/api/admin/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          action: "internal_note",
          note: internalNote
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan memo");

      toast.success(data.message || "Memo internal berhasil disimpan!", { id: loadingToast });
      setInternalNote("");
      fetchCustomerLogs(selectedCustomer.id);
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan memo", { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0 || !bulkAction || saving) return;

    if (bulkAction === "diblokir" && !bulkReason.trim()) {
      toast.error("Alasan tindakan massal wajib diisi untuk pemblokiran");
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading(`Memproses tindakan massal untuk ${selectedIds.length} akun...`);
    try {
      const response = await fetch("/api/admin/wallet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerIds: selectedIds,
          targetStatus: bulkAction,
          statusReason: bulkReason
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memproses tindakan massal");

      toast.success(data.message || "Tindakan massal berhasil diterapkan!", { id: loadingToast });
      setSelectedIds([]);
      setBulkAction("");
      setBulkReason("");
      fetchWalletData();
    } catch (err: any) {
      toast.error(err.message || "Gagal memproses tindakan massal", { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(customers.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(rowId => rowId !== id));
    }
  };

  const exportToCSV = () => {
    if (customers.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const headers = ["Nama Lengkap", "Email", "Nomor HP", "Status Dompet", "Status Blokir", "Saldo (Rp)", "Tanggal Registrasi"];
    const rows = customers.map(c => [
      c.full_name,
      c.email || "-",
      c.phone || "-",
      c.wallet_status || "belum_aktif",
      c.is_wallet_blocked ? "YA" : "TIDAK",
      c.wallet_balance || 0,
      c.created_at ? format(new Date(c.created_at), "yyyy-MM-dd HH:mm:ss") : "-"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `laporan_dompetku_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-3">
            <Wallet className="w-8 h-8" /> Fitur Dompetku Admin
          </h1>
          <p className="text-muted text-sm mt-1">
            Pusat manajemen status e-wallet, mutasi saldo, bulk action, catatan internal, dan audit trail transaksi Dompetku pelanggan.
          </p>
        </div>
        <div className="flex gap-3 self-start md:self-auto">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow transition-all hover:scale-105"
          >
            <FileSpreadsheet className="w-4 h-4" /> Ekspor CSV
          </button>
          <button
            onClick={fetchWalletData}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl text-muted hover:text-primary transition-all hover:scale-105"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Data
          </button>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
          <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Total Saldo Dompet</span>
          <h3 className="text-xl md:text-2xl font-black mt-2 font-mono text-emerald-650 dark:text-emerald-400">
            Rp {stats.totalBalance.toLocaleString("id-ID")}
          </h3>
          <span className="text-[9px] text-muted block mt-1">Saldo aktif siap bertransaksi</span>
        </div>
        <div className="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
          <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Total Saldo Terblokir</span>
          <h3 className="text-xl md:text-2xl font-black mt-2 font-mono text-rose-650 dark:text-rose-450">
            Rp {stats.totalBlockedBalance.toLocaleString("id-ID")}
          </h3>
          <span className="text-[9px] text-muted block mt-1">Milik {stats.blocked} akun dibekukan</span>
        </div>
        <div className="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
          <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Total Pelanggan Aktif</span>
          <h3 className="text-xl md:text-2xl font-black mt-2 font-mono text-primary">
            {stats.active} <span className="text-xs font-bold text-muted uppercase">user</span>
          </h3>
          <span className="text-[9px] text-muted block mt-1">Dompet aktif & terverifikasi</span>
        </div>
        <div className="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
          <span className="text-[10px] font-black text-muted uppercase tracking-widest block">Butuh Verifikasi (Pending)</span>
          <h3 className="text-xl md:text-2xl font-black mt-2 font-mono text-amber-500">
            {stats.pending + stats.processing} <span className="text-xs font-bold text-muted uppercase">user</span>
          </h3>
          <span className="text-[9px] text-muted block mt-1">Menunggu persetujuan aktivasi</span>
        </div>
      </div>

      {/* Main Grid: Customers list & Global Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Customer List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-4">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-text-light dark:text-text-dark">
                Daftar Akun Dompetku
              </h3>
              
              {/* Filter & Search */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cari pelanggan..."
                    className="pl-9 pr-4 py-2 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary w-full sm:w-48 font-semibold text-text-light dark:text-text-dark"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as WalletStatusFilter)}
                  className="px-3 py-2 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none text-text-light dark:text-text-dark font-semibold"
                  title="Filter Status"
                >
                  <option value="all">Semua Status</option>
                  <option value="active">Aktif</option>
                  <option value="blocked">Diblokir</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Diproses</option>
                  <option value="inactive">Nonaktif</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20 text-muted">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                <span className="text-xs">Memuat data e-wallet pelanggan...</span>
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-20 text-muted">
                <Info className="w-10 h-10 mx-auto text-muted/30 mb-2" />
                <p className="text-xs">Tidak ditemukan data pelanggan Dompetku.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-border-light dark:border-border-dark text-muted font-bold">
                      <th className="py-3 px-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === customers.length && customers.length > 0}
                          onChange={e => handleSelectAll(e.target.checked)}
                          className="rounded border-border-light dark:border-border-dark text-primary focus:ring-primary"
                        />
                      </th>
                      <th className="py-3 px-3">Nama Pelanggan</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Saldo</th>
                      <th className="py-3 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150/40 dark:divide-gray-800/40">
                    {customers.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-900/10 transition-colors">
                        <td className="py-3 px-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(c.id)}
                            onChange={e => handleSelectRow(c.id, e.target.checked)}
                            className="rounded border-border-light dark:border-border-dark text-primary focus:ring-primary"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div>
                            <p className="font-extrabold text-text-light dark:text-text-dark">{c.full_name}</p>
                            <p className="text-[10px] text-muted">{c.email || "Tanpa email"}</p>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            c.is_wallet_blocked ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" :
                            ["aktif", "selesai", "diterima"].includes(c.wallet_status) ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" :
                            ["diajukan", "diajukan_ulang", "pending"].includes(c.wallet_status) ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" :
                            c.wallet_status === "diproses" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-450" :
                            "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                          }`}>
                            {c.is_wallet_blocked ? "Diblokir" : 
                             (["aktif", "selesai", "diterima"].includes(c.wallet_status) ? "Aktif" : c.wallet_status || "nonaktif")}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-text-light dark:text-text-dark">
                          Rp {Number(c.wallet_balance || 0).toLocaleString("id-ID")}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={() => handleOpenManageModal(c)}
                            className="px-3 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white font-bold text-[10px] rounded-lg transition-all"
                          >
                            Kelola
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Audit Log Side Widget */}
        <div className="lg:col-span-1">
          <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 shadow-sm space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-text-light dark:text-text-dark flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
              <Activity className="w-4 h-4 text-primary" /> Log Audit Global
            </h3>
            {auditLogs.length === 0 ? (
              <div className="text-center py-10 text-muted text-[11px]">
                <Clock className="w-8 h-8 mx-auto text-muted/30 mb-2" />
                Tidak ada log audit terekam.
              </div>
            ) : (
              <div className="space-y-3.5">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-gray-50/50 dark:bg-gray-900/30 border border-border-light/40 dark:border-border-dark/45 rounded-2xl text-[11px] space-y-1.5">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-black text-primary capitalize text-[10px]">{log.action_type.replace("_", " ")}</span>
                      <span className="text-[9px] text-muted">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}</span>
                    </div>
                    <p className="text-text-light dark:text-text-dark font-medium leading-relaxed">
                      <strong>{log.customer?.full_name || "Pelanggan"}:</strong> {log.reason}
                    </p>
                    <div className="flex justify-between text-[9px] text-muted border-t border-border-light/30 pt-1 mt-1">
                      <span>Oleh: {log.actor?.full_name || "Sistem"}</span>
                      {log.internal_note && <span className="text-amber-600 dark:text-amber-400 font-bold">Ada Catatan</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-6 right-6 md:left-72 z-40 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-4 rounded-2xl shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary font-black text-xs flex items-center justify-center">
                {selectedIds.length}
              </span>
              <span className="text-xs font-bold text-text-light dark:text-text-dark">Pelanggan terpilih</span>
            </div>
            
            <form onSubmit={handleBulkActionSubmit} className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <select
                value={bulkAction}
                onChange={e => setBulkAction(e.target.value as any)}
                required
                className="px-3 py-2 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none text-text-light dark:text-text-dark font-semibold"
                title="Pilih Tindakan Massal"
              >
                <option value="">-- Pilih Tindakan Massal --</option>
                <option value="aktif">Aktifkan Dompetku</option>
                <option value="nonaktif">Nonaktifkan Dompetku</option>
                <option value="diblokir">Blokir Dompetku</option>
              </select>

              {bulkAction === "diblokir" && (
                <input
                  type="text"
                  required
                  placeholder="Masukkan alasan pemblokiran massal..."
                  value={bulkReason}
                  onChange={e => setBulkReason(e.target.value)}
                  className="px-3 py-2 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none text-text-light dark:text-text-dark font-semibold w-full sm:w-64"
                />
              )}

              <button
                type="submit"
                disabled={saving || !bulkAction}
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-black rounded-xl uppercase tracking-wider transition-all disabled:opacity-50"
              >
                Terapkan Aksi
              </button>
              
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="px-3 py-2 text-xs text-muted hover:text-text-light dark:hover:text-text-dark font-bold transition-all"
              >
                Batal
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manage Customer Wallet Modal */}
      <AnimatePresence>
        {showManageModal && selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowManageModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white dark:bg-card-dark w-full max-w-3xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-gray-800">
              {/* Modal Header */}
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                <div>
                  <h3 className="font-black text-lg text-gray-900 dark:text-white uppercase tracking-tight">Kelola Dompet Pelanggan</h3>
                  <p className="text-[10px] text-muted font-bold mt-0.5">Nama: {selectedCustomer.full_name} ({selectedCustomer.email || "Tanpa Email"})</p>
                </div>
                <button onClick={() => setShowManageModal(false)} title="Tutup" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"><X className="w-5 h-5 text-muted" /></button>
              </div>

              {/* Modal Navigation Tabs */}
              <div className="flex border-b border-gray-100 dark:border-gray-800 px-6 py-2 bg-gray-50/20 dark:bg-gray-900/20 gap-2 overflow-x-auto scrollbar-none">
                {[
                  { key: "status", label: "Status Dompet", icon: ShieldAlert },
                  { key: "balance", label: "Kelola Saldo", icon: CreditCard },
                  { key: "history", label: "Mutasi Saldo", icon: Clipboard },
                  { key: "audit", label: "Log Audit", icon: Activity },
                  { key: "note", label: "Catatan Memo", icon: Info }
                ].map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setManageTab(t.key as any)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
                      manageTab === t.key
                        ? "bg-primary text-white border-primary"
                        : "bg-transparent text-muted border-transparent hover:text-text-light dark:hover:text-text-dark"
                    }`}
                  >
                    <t.icon className="w-4 h-4" />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar text-xs">
                
                {/* Profile Snapshot Header */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-900/30 p-4 rounded-2xl border border-border-light dark:border-border-dark text-center">
                  <div>
                    <span className="text-[9px] font-black text-muted uppercase tracking-wider block">Saldo Saat Ini</span>
                    <span className="text-lg font-mono font-black text-emerald-650 dark:text-emerald-400">Rp {Number(selectedCustomer.wallet_balance || 0).toLocaleString("id-ID")}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-muted uppercase tracking-wider block">Status Awal</span>
                    <span className="text-xs font-black uppercase block tracking-widest mt-1 text-primary">
                      {selectedCustomer.is_wallet_blocked ? "Terblokir" : (selectedCustomer.wallet_status || "nonaktif")}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[9px] font-black text-muted uppercase tracking-wider block">Nomor HP</span>
                    <span className="text-xs font-bold font-mono block mt-1 text-text-light dark:text-text-dark">{selectedCustomer.phone || "-"}</span>
                  </div>
                </div>

                {/* Tab: STATUS */}
                {manageTab === "status" && (
                  <form onSubmit={handleStatusSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label htmlFor="targetStatusSelect" className="text-[10px] font-black uppercase text-muted tracking-widest block">Ubah Status Menjadi</label>
                      <select
                        id="targetStatusSelect"
                        value={statusForm.targetStatus}
                        onChange={e => setStatusForm({ ...statusForm, targetStatus: e.target.value })}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-bold text-text-light dark:text-text-dark"
                      >
                        <option value="aktif">Aktif (Dapat Bertransaksi)</option>
                        <option value="nonaktif">Nonaktif (Dinonaktifkan Sementara)</option>
                        <option value="diblokir">Diblokir (Pelanggaran / Masalah Keamanan)</option>
                        <option value="buka_blokir">Buka Blokir</option>
                        <option value="pending">Pending Verifikasi</option>
                        <option value="diproses">Dalam Proses Peninjauan</option>
                      </select>
                    </div>

                    {statusForm.targetStatus === "buka_blokir" && (
                      <div className="space-y-1.5">
                        <label htmlFor="resumeStatusSelect" className="text-[10px] font-black uppercase text-muted tracking-widest block">Status Lanjutan Setelah Blokir Dibuka</label>
                        <select
                          id="resumeStatusSelect"
                          value={statusForm.resumeStatus}
                          onChange={e => setStatusForm({ ...statusForm, resumeStatus: e.target.value })}
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-bold text-text-light dark:text-text-dark"
                        >
                          <option value="aktif">Aktif (Kembali Normal)</option>
                          <option value="nonaktif">Nonaktif</option>
                        </select>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label htmlFor="statusReasonInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">
                        Alasan Perubahan Status {statusForm.targetStatus === "diblokir" && <span className="text-red-500 font-bold">(Wajib)</span>}
                      </label>
                      <textarea
                        id="statusReasonInput"
                        required={statusForm.targetStatus === "diblokir"}
                        value={statusForm.reason}
                        onChange={e => setStatusForm({ ...statusForm, reason: e.target.value })}
                        placeholder="Masukkan alasan formal perubahan status..."
                        rows={3}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="statusNoteInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">Catatan Internal Admin (Opsional)</label>
                      <textarea
                        id="statusNoteInput"
                        value={internalNote}
                        onChange={e => setInternalNote(e.target.value)}
                        placeholder="Memo internal yang hanya dapat dilihat oleh admin..."
                        rows={2}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-black rounded-xl shadow uppercase tracking-wider"
                    >
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : "Perbarui Status Akun"}
                    </button>
                  </form>
                )}

                {/* Tab: BALANCE */}
                {manageTab === "balance" && (
                  <form onSubmit={handleBalanceSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="balanceTypeSelect" className="text-[10px] font-black uppercase text-muted tracking-widest block">Tipe Penyesuaian Saldo</label>
                        <select
                          id="balanceTypeSelect"
                          value={balanceForm.type}
                          onChange={e => setBalanceForm({ ...balanceForm, type: e.target.value })}
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-bold text-text-light dark:text-text-dark"
                        >
                          <option value="add">Tambah Saldo</option>
                          <option value="deduct">Kurangi Saldo</option>
                          <option value="correct">Koreksi Saldo Manual (Set ke nominal)</option>
                          <option value="reset">Reset Saldo ke Rp 0</option>
                          <option value="refund">Refund Dana Transaksi</option>
                        </select>
                      </div>

                      {balanceForm.type !== "reset" && (
                        <div className="space-y-1.5">
                          <label htmlFor="balanceAmountInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">
                            {balanceForm.type === "correct" ? "Nominal Target Saldo (Rp)" : "Nominal Saldo (Rp)"}
                          </label>
                          <input
                            id="balanceAmountInput"
                            type="number"
                            required
                            min={0}
                            value={balanceForm.amountValue}
                            onChange={e => setBalanceForm({ ...balanceForm, amountValue: e.target.value })}
                            placeholder="Misal: 50000"
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-bold font-mono text-text-light dark:text-text-dark"
                          />
                        </div>
                      )}
                    </div>

                    {balanceForm.type === "refund" && (
                      <div className="space-y-1.5">
                        <label htmlFor="balanceRefundRef" className="text-[10px] font-black uppercase text-muted tracking-widest block">ID Transaksi / Nomor Referensi Sumber Refund</label>
                        <input
                          id="balanceRefundRef"
                          type="text"
                          required
                          value={balanceForm.refundReference}
                          onChange={e => setBalanceForm({ ...balanceForm, refundReference: e.target.value })}
                          placeholder="Masukkan nomor transaksi atau ID pesanan..."
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-bold text-text-light dark:text-text-dark"
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label htmlFor="balanceAdjustReason" className="text-[10px] font-black uppercase text-muted tracking-widest block">Alasan Penyesuaian Saldo <span className="text-red-500 font-bold">(Wajib)</span></label>
                      <textarea
                        id="balanceAdjustReason"
                        required
                        value={balanceForm.adjustReason}
                        onChange={e => setBalanceForm({ ...balanceForm, adjustReason: e.target.value })}
                        placeholder="Contoh: Refund pembatalan pesanan makanan karena bahan habis."
                        rows={2}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="balanceNoteInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">Catatan Internal Admin (Opsional)</label>
                      <textarea
                        id="balanceNoteInput"
                        value={internalNote}
                        onChange={e => setInternalNote(e.target.value)}
                        placeholder="Memo internal yang hanya dapat dilihat oleh admin..."
                        rows={2}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full py-3 bg-emerald-650 hover:bg-emerald-700 text-white font-black rounded-xl shadow uppercase tracking-wider"
                    >
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : "Eksekusi Penyesuaian Saldo"}
                    </button>
                  </form>
                )}

                {/* Tab: MUTATION HISTORY */}
                {manageTab === "history" && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-xs uppercase tracking-widest text-muted border-b border-border-light dark:border-border-dark pb-2">Riwayat Mutasi Saldo Pelanggan</h4>
                    {loadingModalLogs ? (
                      <div className="text-center py-10"><RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
                    ) : customerTx.length === 0 ? (
                      <div className="text-center py-10 text-muted">Belum ada riwayat transaksi dompet.</div>
                    ) : (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {customerTx.map((tx) => {
                          const isPositive = ["topup", "refund", "cashback", "adjust"].includes(tx.type) && tx.status === "success" ? tx.amount > 0 : false;
                          return (
                            <div key={tx.id} className="p-3 bg-gray-50/50 dark:bg-gray-900/30 border border-border-light/35 dark:border-border-dark/35 rounded-xl flex justify-between items-start gap-3">
                              <div>
                                <p className="font-bold text-text-light dark:text-text-dark">{tx.description || "Penyesuaian Saldo"}</p>
                                <div className="flex items-center gap-1.5 mt-1 text-[9px] text-muted">
                                  <span className="px-1.5 py-0.2 bg-gray-200 dark:bg-gray-800 text-[8px] font-black uppercase rounded tracking-wide">{tx.type}</span>
                                  <span>{format(new Date(tx.created_at), "dd MMM yyyy, HH:mm", { locale: localeId })} WIB</span>
                                </div>
                              </div>
                              <span className={`font-mono font-black text-xs shrink-0 ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {isPositive ? "+" : "-"}Rp {Math.abs(Number(tx.amount)).toLocaleString("id-ID")}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: AUDIT LOGS */}
                {manageTab === "audit" && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-xs uppercase tracking-widest text-muted border-b border-border-light dark:border-border-dark pb-2">Jejak Audit Aktivitas Admin</h4>
                    {loadingModalLogs ? (
                      <div className="text-center py-10"><RefreshCw className="w-6 h-6 animate-spin text-primary mx-auto" /></div>
                    ) : customerAudit.length === 0 ? (
                      <div className="text-center py-10 text-muted">Belum ada jejak audit untuk pelanggan ini.</div>
                    ) : (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {customerAudit.map((log) => (
                          <div key={log.id} className="p-3 bg-gray-50/40 dark:bg-gray-900/20 border border-border-light/40 dark:border-border-dark/40 rounded-xl space-y-1.5">
                            <div className="flex justify-between items-center text-[9px] text-muted border-b border-border-light/20 pb-1">
                              <span className="font-black text-primary uppercase">{log.action_type.replace("_", " ")}</span>
                              <span>{format(new Date(log.created_at), "dd MMM yyyy, HH:mm", { locale: localeId })}</span>
                            </div>
                            <p className="font-semibold text-text-light dark:text-text-dark">{log.reason}</p>
                            <div className="grid grid-cols-2 gap-4 text-[9px] text-muted pt-1">
                              <div>Nilai Sebelum: <span className="font-bold text-text-light dark:text-text-dark">{log.before_value || "-"}</span></div>
                              <div>Nilai Sesudah: <span className="font-bold text-text-light dark:text-text-dark">{log.after_value || "-"}</span></div>
                            </div>
                            <div className="text-[9px] text-muted flex justify-between items-center pt-1 border-t border-border-light/10">
                              <span>Oleh Admin: {log.actor?.full_name || "Sistem"}</span>
                              {log.internal_note && <span className="text-amber-600 dark:text-amber-400 font-bold font-mono">Memo: {log.internal_note}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: NOTE (INTERNAL MEMO) */}
                {manageTab === "note" && (
                  <form onSubmit={handleNoteSubmit} className="space-y-4">
                    <h4 className="font-bold text-xs uppercase tracking-widest text-muted border-b border-border-light dark:border-border-dark pb-2">Tambahkan Memo Internal Admin</h4>
                    
                    <div className="space-y-1.5">
                      <label htmlFor="memoInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">Memo Internal <span className="text-red-500 font-bold">(Wajib)</span></label>
                      <textarea
                        id="memoInput"
                        required
                        value={internalNote}
                        onChange={e => setInternalNote(e.target.value)}
                        placeholder="Memo khusus ini hanya dapat diakses dan dibaca oleh administrator. Tulis rincian atau investigasi penting..."
                        rows={4}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={saving || !internalNote.trim()}
                      className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-black rounded-xl shadow uppercase tracking-wider disabled:opacity-50"
                    >
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : "Simpan Memo Internal"}
                    </button>
                  </form>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
