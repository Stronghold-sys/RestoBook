"use client";

export const runtime = 'edge';

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
import BaseModal from "@/components/BaseModal";

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

  useEffect(() => {
    if (showManageModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showManageModal]);

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

  const exportToExcel = () => {
    if (customers.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const periodTitle = format(new Date(), "dd MMMM yyyy", { locale: localeId }).toUpperCase();

    let tableHtml = `<table border="1" style="border-collapse: collapse; font-family: Arial;">
       <tr style="height: 40px;"><td colspan="8" align="center" style="font-size: 16px; font-weight: bold; background-color: #fcfcfc;">LAPORAN DOMPETKU CUSTOMER (TANGGAL: ${periodTitle})</td></tr>
       <tr style="height: 30px; text-align: center;">
          <th class="wallet-header" style="border: 1px solid #d1d5db; padding: 5px;">No</th>
          <th class="wallet-header" style="border: 1px solid #d1d5db; padding: 5px;">Nama Lengkap</th>
          <th class="wallet-header" style="border: 1px solid #d1d5db; padding: 5px;">Email</th>
          <th class="wallet-header" style="border: 1px solid #d1d5db; padding: 5px;">Nomor HP</th>
          <th class="wallet-header" style="border: 1px solid #d1d5db; padding: 5px;">Status Dompet</th>
          <th class="wallet-header" style="border: 1px solid #d1d5db; padding: 5px;">Status Blokir</th>
          <th class="wallet-header" style="border: 1px solid #d1d5db; padding: 5px;">Saldo Dompetku (Rp)</th>
          <th class="wallet-header" style="border: 1px solid #d1d5db; padding: 5px;">Tanggal Registrasi</th>
       </tr>`;

    customers.forEach((c, idx) => {
       tableHtml += `<tr style="height: 25px;">
          <td align="center" style="border: 1px solid #d1d5db; padding: 5px;">${idx + 1}</td>
          <td style="border: 1px solid #d1d5db; padding: 5px;">${c.full_name}</td>
          <td style="border: 1px solid #d1d5db; padding: 5px;">${c.email || "-"}</td>
          <td style="border: 1px solid #d1d5db; padding: 5px;">${c.phone || "-"}</td>
          <td align="center" style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold; text-transform: uppercase;">${c.wallet_status || "belum_aktif"}</td>
          <td align="center" style="border: 1px solid #d1d5db; padding: 5px; color: ${c.is_wallet_blocked ? "#dc2626" : "#16a34a"}; font-weight: bold;">${c.is_wallet_blocked ? "TERBLOKIR" : "AKTIF"}</td>
          <td align="right" style="border: 1px solid #d1d5db; padding: 5px; font-weight: bold;">${Number(c.wallet_balance || 0).toLocaleString("id-ID")}</td>
          <td align="center" style="border: 1px solid #d1d5db; padding: 5px;">${c.created_at ? format(new Date(c.created_at), "yyyy-MM-dd HH:mm:ss") : "-"}</td>
       </tr>`;
    });

    tableHtml += `</table>`;

    const template = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>.wallet-header { background-color: #10b981; color: #ffffff; font-weight: bold; }</style><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Dompetku</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${tableHtml}</body></html>`;
    
    const blob = new Blob([template], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan_dompetku_${format(new Date(), "yyyyMMdd_HHmmss")}.xls`;
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
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow transition-all hover:scale-105"
          >
            <FileSpreadsheet className="w-4 h-4" /> Ekspor Excel
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
                          title="Pilih Semua Pelanggan"
                          aria-label="Pilih Semua Pelanggan"
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
                            title={`Pilih ${c.full_name}`}
                            aria-label={`Pilih ${c.full_name}`}
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
      <BaseModal
        isOpen={showManageModal && !!selectedCustomer}
        onClose={() => setShowManageModal(false)}
        size="3xl"
        showCloseButton={false}
        noPadding={true}
      >
        {selectedCustomer && (
          <div className="flex flex-col bg-white dark:bg-card-dark text-text-light dark:text-text-dark">
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
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border shrink-0 whitespace-nowrap ${
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
            <div className="p-6 space-y-6 flex-1 text-xs">
              
              {/* Profile Snapshot Header */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-900/30 p-4 rounded-2xl border border-border-light dark:border-border-dark text-center">
                <div>
                  <span className="text-[9px] font-black text-muted uppercase tracking-wider block">Saldo Saat Ini</span>
                  <span className="text-lg font-mono font-black text-emerald-650 dark:text-emerald-400">Rp {Number(selectedCustomer.wallet_balance || 0).toLocaleString("id-ID")}</span>
                </div>
                <div>
                  <span className="text-[9px] font-black text-muted uppercase tracking-wider block">Status Awal</span>
                  <span className="text-xs font-black uppercase block tracking-widest mt-1 text-primary">
                    {selectedCustomer.wallet_status || "Belum Aktif"}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="text-[9px] font-black text-muted uppercase tracking-wider block">Terakhir Update</span>
                  <span className="text-[10px] font-bold block mt-1">
                    {selectedCustomer.wallet_updated_at 
                      ? format(new Date(selectedCustomer.wallet_updated_at), "dd MMM yyyy HH:mm", { locale: localeId })
                      : "-"}
                  </span>
                </div>
              </div>

              {/* Tab: STATUS */}
              {manageTab === "status" && (
                <form onSubmit={handleStatusSubmit} className="space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-widest text-muted border-b border-border-light dark:border-border-dark pb-2">Ubah Status Dompetku</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="targetStatus" className="text-[10px] font-black uppercase text-muted tracking-widest block">Status Target</label>
                      <select
                        id="targetStatus"
                        value={statusForm.targetStatus}
                        onChange={e => setStatusForm(prev => ({ ...prev, targetStatus: e.target.value }))}
                        required
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                      >
                        <option value="">-- Pilih Status --</option>
                        <option value="aktif">Aktif (Buka Blokir / Verifikasi Manual)</option>
                        <option value="nonaktif">Nonaktifkan</option>
                        <option value="diblokir">Blokir Sementara</option>
                      </select>
                    </div>

                    {statusForm.targetStatus === "aktif" && (
                      <div className="space-y-1.5">
                        <label htmlFor="resumeStatus" className="text-[10px] font-black uppercase text-muted tracking-widest block">Level Aktif</label>
                        <select
                          id="resumeStatus"
                          value={statusForm.resumeStatus}
                          onChange={e => setStatusForm(prev => ({ ...prev, resumeStatus: e.target.value }))}
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                        >
                          <option value="aktif">Aktif Penuh</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="statusReason" className="text-[10px] font-black uppercase text-muted tracking-widest block">Alasan Perubahan <span className="text-red-500 font-bold">(Wajib)</span></label>
                    <input
                      id="statusReason"
                      type="text"
                      required
                      placeholder="Masukkan alasan detail untuk perubahan status dompet ini..."
                      value={statusForm.reason}
                      onChange={e => setStatusForm(prev => ({ ...prev, reason: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving || !statusForm.targetStatus}
                    className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-black rounded-xl shadow uppercase tracking-wider disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : "Terapkan Perubahan Status"}
                  </button>
                </form>
              )}

              {/* Tab: BALANCE */}
              {manageTab === "balance" && (
                <form onSubmit={handleBalanceSubmit} className="space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-widest text-muted border-b border-border-light dark:border-border-dark pb-2">Penyesuaian / Kredit / Debit Saldo</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="balanceType" className="text-[10px] font-black uppercase text-muted tracking-widest block">Tipe Penyesuaian</label>
                      <select
                        id="balanceType"
                        value={balanceForm.type}
                        onChange={e => setBalanceForm(prev => ({ ...prev, type: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                      >
                        <option value="add">Kredit / Tambah Saldo (Top Up Manual / Bonus)</option>
                        <option value="sub">Debit / Kurangi Saldo (Penalti / Koreksi)</option>
                        <option value="refund">Refund Transaksi / Pengembalian Dana</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="amountInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">Jumlah Nominal (Rp) <span className="text-red-500 font-bold">(Wajib)</span></label>
                      <input
                        id="amountInput"
                        type="number"
                        min="100"
                        required
                        placeholder="Contoh: 50000"
                        value={balanceForm.amountValue}
                        onChange={e => setBalanceForm(prev => ({ ...prev, amountValue: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-mono font-bold text-text-light dark:text-text-dark"
                      />
                    </div>
                  </div>

                  {balanceForm.type === "refund" && (
                    <div className="space-y-1.5">
                      <label htmlFor="refInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">ID Transaksi / Nomor Referensi Refund <span className="text-red-500 font-bold">(Wajib)</span></label>
                      <input
                        id="refInput"
                        type="text"
                        required
                        placeholder="Masukkan ID Order atau kode reservasi..."
                        value={balanceForm.refundReference}
                        onChange={e => setBalanceForm(prev => ({ ...prev, refundReference: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="adjustReason" className="text-[10px] font-black uppercase text-muted tracking-widest block">Alasan Detail Penyesuaian Saldo <span className="text-red-500 font-bold">(Wajib)</span></label>
                    <input
                      id="adjustReason"
                      type="text"
                      required
                      placeholder="Tulis alasan, memo, atau referensi audit internal..."
                      value={balanceForm.adjustReason}
                      onChange={e => setBalanceForm(prev => ({ ...prev, adjustReason: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={saving || !balanceForm.amountValue}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow uppercase tracking-wider disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : "Eksekusi Mutasi Saldo"}
                  </button>
                </form>
              )}

              {/* Tab: HISTORY (MUTATION LOG) */}
              {manageTab === "history" && (
                <div className="space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-widest text-muted border-b border-border-light dark:border-border-dark pb-2">Riwayat Mutasi Saldo Pelanggan</h4>
                  
                  {customerTx.length === 0 ? (
                    <div className="py-8 text-center text-muted font-bold flex flex-col items-center justify-center gap-2">
                      <Clock className="w-8 h-8 opacity-40" />
                      <span>Belum ada riwayat transaksi dompet digital.</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                      {customerTx.map((tx: any) => (
                        <div key={tx.id} className="p-3 bg-gray-50 dark:bg-gray-900/30 border border-border-light dark:border-border-dark rounded-xl flex items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${
                              tx.transaction_type === "topup" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                              tx.transaction_type === "payment" ? "bg-blue-500/10 text-blue-600 dark:text-blue-450" :
                              tx.transaction_type === "refund" ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" :
                              "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}>
                              {tx.transaction_type}
                            </span>
                            <p className="text-[10px] font-black text-text-light dark:text-text-dark mt-1">{tx.description || "Tanpa Keterangan"}</p>
                            <span className="text-[8px] text-muted block font-bold">
                              {format(new Date(tx.created_at), "dd MMM yyyy HH:mm:ss", { locale: localeId })}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`font-mono font-black text-sm block ${
                              tx.transaction_type === "topup" || tx.transaction_type === "refund"
                                ? "text-emerald-650 dark:text-emerald-400"
                                : "text-red-500"
                            }`}>
                              {tx.transaction_type === "topup" || tx.transaction_type === "refund" ? "+" : "-"} 
                              Rp {Number(tx.amount || 0).toLocaleString("id-ID")}
                            </span>
                            <span className="text-[8px] text-muted block font-mono">Saldo akhir: Rp {Number(tx.current_balance || 0).toLocaleString("id-ID")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: AUDIT LOG */}
              {manageTab === "audit" && (
                <div className="space-y-4">
                  <h4 className="font-bold text-xs uppercase tracking-widest text-muted border-b border-border-light dark:border-border-dark pb-2">Log Jejak Audit Administrator</h4>
                  
                  {customerAudit.length === 0 ? (
                    <div className="py-8 text-center text-muted font-bold flex flex-col items-center justify-center gap-2">
                      <Clock className="w-8 h-8 opacity-40" />
                      <span>Belum ada log jejak audit terekam.</span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                      {customerAudit.map((log: any) => (
                        <div key={log.id} className="p-3 bg-gray-50 dark:bg-gray-900/30 border border-border-light dark:border-border-dark rounded-xl space-y-1 text-[10px]">
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-black text-text-light dark:text-text-dark uppercase">{log.action_type || "Aksi Sistem"}</span>
                            <span className="text-[8px] text-muted font-bold">{format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: localeId })}</span>
                          </div>
                          <p className="text-muted font-semibold">{log.reason || "Tidak ada alasan tertulis"}</p>
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
          </div>
        )}
      </BaseModal>
    </div>
  );
}
