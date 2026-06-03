"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket, Plus, Trash2, Send, Calendar, Percent,
  Users, CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw, Pencil, Save
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import toast from "react-hot-toast";

export default function AdminVouchersPage() {
  const [loading, setLoading] = useState(true);
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [distributingId, setDistributingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "history">("active");

  // Modern Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    type: "danger" | "warning" | "success" | "info";
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Lanjutkan",
    type: "info",
    onConfirm: () => {},
  });

  // Form State
  const [form, setForm] = useState({
    code: "",
    discount_percent: "",
    usage_limit: "100",
    max_usage_per_user: "1",
    expires_at: "",
    is_active: true,
    voucher_type: "general",
    discount_type: "percent",
    discount_value: "",
    min_transaction: "0"
  });

  const generateRandomCode = (showToast = true) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "RSTB-";
    for (let i = 0; i < 5; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm(prev => ({ ...prev, code: result }));
    if (showToast) {
      toast.success(`Kode voucher otomatis dibuat: ${result}`);
    }
  };

  const supabase = createClient();

  useEffect(() => {
    fetchVouchers();
    generateRandomCode(false);

    const channel = supabase
      .channel("admin-vouchers-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vouchers" },
        () => {
          fetchVouchers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/vouchers");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memuat voucher");
      setVouchers(data.vouchers || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleEditClick = (voucher: any) => {
    setEditingId(voucher.id);
    setForm({
      code: voucher.code,
      discount_percent: voucher.discount_percent ? voucher.discount_percent.toString() : "",
      usage_limit: voucher.usage_limit.toString(),
      max_usage_per_user: voucher.max_usage_per_user.toString(),
      expires_at: voucher.expires_at ? new Date(voucher.expires_at).toISOString().substring(0, 16) : "",
      is_active: !!voucher.is_active,
      voucher_type: voucher.voucher_type || "general",
      discount_type: voucher.discount_type || "percent",
      discount_value: voucher.discount_value ? voucher.discount_value.toString() : "",
      min_transaction: voucher.min_transaction ? voucher.min_transaction.toString() : "0"
    });
    toast.success(`Mengedit voucher ${voucher.code}`);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({
      code: "",
      discount_percent: "",
      usage_limit: "100",
      max_usage_per_user: "1",
      expires_at: "",
      is_active: true,
      voucher_type: "general",
      discount_type: "percent",
      discount_value: "",
      min_transaction: "0"
    });
    generateRandomCode(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.expires_at) {
      return toast.error("Kode dan tanggal kedaluwarsa wajib diisi");
    }

    if (form.discount_type === "percent") {
      if (!form.discount_percent) return toast.error("Persentase diskon wajib diisi");
      const discountVal = Number(form.discount_percent);
      if (isNaN(discountVal) || discountVal <= 0 || discountVal > 100) {
        return toast.error("Persentase diskon harus bernilai antara 1 dan 100");
      }
    } else {
      if (!form.discount_value) return toast.error("Nominal diskon wajib diisi");
      const discountVal = Number(form.discount_value);
      if (isNaN(discountVal) || discountVal <= 0) {
        return toast.error("Nominal diskon harus bernilai lebih besar dari 0");
      }
    }

    setIsSubmitting(true);
    try {
      const formattedForm = {
        ...form,
        discount_percent: form.discount_type === "percent" ? Number(form.discount_percent) : 0,
        discount_value: form.discount_type === "nominal" ? Number(form.discount_value) : 0,
        min_transaction: Number(form.min_transaction || 0),
        expires_at: new Date(form.expires_at).toISOString()
      };

      let response;
      if (editingId) {
        response = await fetch("/api/admin/vouchers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            voucherId: editingId,
            action: "edit",
            ...formattedForm
          })
        });
      } else {
        response = await fetch("/api/admin/vouchers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formattedForm)
        });
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan voucher");

      if (editingId) {
        toast.success(`Voucher ${data.voucher.code} Berhasil Diperbarui!`);
        setEditingId(null);
      } else {
        toast.success(`Voucher ${data.voucher.code} Berhasil Dibuat!`);
      }
      
      // Reset Form (except usage_limit and max_usage defaults)
      setForm({
        code: "",
        discount_percent: "",
        usage_limit: "100",
        max_usage_per_user: "1",
        expires_at: "",
        is_active: true,
        voucher_type: "general",
        discount_type: "percent",
        discount_value: "",
        min_transaction: "0"
      });
      
      fetchVouchers();
      generateRandomCode(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (voucherId: string, currentStatus: boolean) => {
    try {
      const response = await fetch("/api/admin/vouchers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherId,
          action: "toggle_active",
          is_active: !currentStatus
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memperbarui status");

      toast.success(`Voucher status diperbarui`);
      setVouchers(prev =>
        prev.map(v => (v.id === voucherId ? { ...v, is_active: !currentStatus } : v))
      );
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDistribute = async (voucherId: string, voucherCode: string) => {
    setDistributingId(voucherId);
    const loadingToast = toast.loading(`Mengirim voucher ${voucherCode} ke seluruh pelanggan...`);
    try {
      const response = await fetch("/api/admin/vouchers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voucherId,
          action: "distribute"
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mengirimkan voucher");

      toast.success(data.message || `Voucher ${voucherCode} dikirim ke semua pelanggan!`, { id: loadingToast });
    } catch (error: any) {
      toast.error(error.message, { id: loadingToast });
    } finally {
      setDistributingId(null);
    }
  };

  const handleDelete = async (voucherId: string, voucherCode: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Hapus Voucher",
      message: `Apakah Anda yakin ingin menghapus voucher ${voucherCode}? Tindakan ini tidak dapat dibatalkan.`,
      confirmText: "Hapus",
      type: "danger",
      onConfirm: async () => {
        const loadingToast = toast.loading("Menghapus voucher...");
        try {
          const response = await fetch(`/api/admin/vouchers?id=${voucherId}`, {
            method: "DELETE"
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Gagal menghapus voucher");

          toast.success(`Voucher ${voucherCode} berhasil dihapus!`, { id: loadingToast });
          setVouchers(prev => prev.filter(v => v.id !== voucherId));
        } catch (error: any) {
          toast.error(error.message, { id: loadingToast });
        }
      }
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-3">
            <Ticket className="w-8 h-8" /> Manajemen Voucher
          </h1>
          <p className="text-muted text-sm mt-1">
            Buat, aktifkan, dan kirimkan voucher promosi dengan pembatasan penggunaan serta kedaluwarsa.
          </p>
        </div>
        <button
          onClick={fetchVouchers}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl text-muted hover:text-primary transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Pembuatan (Kiri) */}
        <div className="lg:col-span-1">
          <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 shadow-xl sticky top-24">
            <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-6 flex items-center gap-2 border-b border-border-light dark:border-border-dark pb-4">
              {editingId ? (
                <>
                  <Pencil className="w-5 h-5 text-amber-500" /> Edit Voucher
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 text-primary" /> Buat Voucher Baru
                </>
              )}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-xs font-bold text-muted uppercase tracking-wider mb-2 flex justify-between items-center">
                  <span>Kode Voucher</span>
                  <button
                    type="button"
                    onClick={() => generateRandomCode(true)}
                    className="text-primary hover:text-primary/80 font-black text-[10px] uppercase tracking-wider bg-primary/5 px-2.5 py-1 rounded-lg border border-primary/10 transition-all hover:scale-105"
                  >
                    Buat Otomatis
                  </button>
                </label>
                <input
                  type="text"
                  id="code"
                  name="code"
                  placeholder="Contoh: PROMO50"
                  title="Kode Voucher"
                  value={form.code}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 uppercase"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="voucher_type" className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Tipe Voucher</label>
                  <select
                    id="voucher_type"
                    name="voucher_type"
                    value={form.voucher_type}
                    onChange={(e) => setForm(prev => ({ ...prev, voucher_type: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                  >
                    <option value="general">Umum / Potongan Belanja</option>
                    <option value="shipping">Ongkir / Potongan Pengiriman</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="discount_type" className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Tipe Potongan</label>
                  <select
                    id="discount_type"
                    name="discount_type"
                    value={form.discount_type}
                    onChange={(e) => setForm(prev => ({ ...prev, discount_type: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs"
                  >
                    <option value="percent">Persentase (%)</option>
                    <option value="nominal">Nominal (Rupiah)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {form.discount_type === "percent" ? (
                  <div>
                    <label htmlFor="discount_percent" className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Diskon (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        id="discount_percent"
                        name="discount_percent"
                        min="1"
                        max="100"
                        placeholder="10"
                        title="Diskon (%)"
                        value={form.discount_percent}
                        onChange={handleInputChange}
                        className="w-full pl-4 pr-10 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20"
                        required
                      />
                      <Percent className="absolute right-3 top-3.5 w-4 h-4 text-muted" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="discount_value" className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Diskon (Rp)</label>
                    <input
                      type="number"
                      id="discount_value"
                      name="discount_value"
                      min="1"
                      placeholder="10000"
                      title="Diskon (Rp)"
                      value={form.discount_value}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="min_transaction" className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Min. Belanja (Rp)</label>
                  <input
                    type="number"
                    id="min_transaction"
                    name="min_transaction"
                    min="0"
                    placeholder="0"
                    title="Minimal Transaksi"
                    value={form.min_transaction}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="usage_limit" className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Limit Global</label>
                  <input
                    type="number"
                    id="usage_limit"
                    name="usage_limit"
                    min="1"
                    placeholder="100"
                    title="Limit Global"
                    value={form.usage_limit}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="max_usage_per_user" className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Limit Per User</label>
                  <input
                    type="number"
                    id="max_usage_per_user"
                    name="max_usage_per_user"
                    min="1"
                    placeholder="1"
                    title="Limit Per User"
                    value={form.max_usage_per_user}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1">
                <div>
                  <label htmlFor="expires_at" className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Masa Aktif</label>
                  <div className="relative">
                    <input
                      type="datetime-local"
                      id="expires_at"
                      name="expires_at"
                      title="Masa Aktif"
                      placeholder="Pilih Tanggal Kedaluwarsa"
                      value={form.expires_at}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="is_active"
                  name="is_active"
                  checked={form.is_active}
                  onChange={handleInputChange}
                  className="rounded border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-primary focus:ring-primary"
                />
                <label htmlFor="is_active" className="text-sm font-bold text-text-light dark:text-text-dark select-none cursor-pointer">
                  Aktifkan langsung setelah dibuat
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  editingId 
                    ? "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20" 
                    : "bg-primary hover:bg-primary/90 shadow-primary/20"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Menyimpan...
                  </>
                ) : editingId ? (
                  <>
                    <Save className="w-5 h-5" /> Simpan Perubahan
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" /> Tambah Voucher
                  </>
                )}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="w-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-muted py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all mt-2 text-xs uppercase"
                >
                  Batal Edit
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Daftar Voucher (Kanan) */}
        <div className="lg:col-span-2">
          {(() => {
            const nowTime = new Date();
            const activeVouchers = vouchers.filter(v => new Date(v.expires_at) > nowTime && v.used_count < v.usage_limit && v.is_active);
            const historyVouchers = vouchers.filter(v => new Date(v.expires_at) <= nowTime || v.used_count >= v.usage_limit || !v.is_active);
            const displayedVouchers = tab === "active" ? activeVouchers : historyVouchers;

            return (
              <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 shadow-xl min-h-[400px]">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 pb-4 border-b border-border-light dark:border-border-dark">
                  <h2 className="text-xl font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-primary" /> Daftar Voucher
                  </h2>
                  
                  {/* Tab Selector */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTab("active")}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border ${
                        tab === "active"
                          ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                          : "bg-background-light text-muted dark:bg-background-dark border-border-light dark:border-border-dark hover:text-text-light dark:hover:text-text-dark"
                      }`}
                    >
                      Aktif ({activeVouchers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("history")}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all border ${
                        tab === "history"
                          ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                          : "bg-background-light text-muted dark:bg-background-dark border-border-light dark:border-border-dark hover:text-text-light dark:hover:text-text-dark"
                      }`}
                    >
                      Riwayat ({historyVouchers.length})
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
                    <span>Memuat data voucher...</span>
                  </div>
                ) : displayedVouchers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted text-center">
                    <AlertCircle className="w-12 h-12 text-muted/50 mb-3" />
                    <span className="font-bold">Belum ada voucher</span>
                    <span className="text-xs mt-1">Tidak ada voucher di kategori ini.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse" style={{ minWidth: '800px' }}>
                      <thead>
                        <tr className="border-b border-border-light dark:border-border-dark">
                          <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">Kode</th>
                          <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider text-center whitespace-nowrap">Tipe</th>
                          <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider text-center whitespace-nowrap">Diskon</th>
                          <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider text-center whitespace-nowrap">Min. Belanja</th>
                          <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider text-center whitespace-nowrap">Pemakaian</th>
                          <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">Berakhir Pada</th>
                          <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider text-center whitespace-nowrap">Status</th>
                          <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider text-right whitespace-nowrap">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedVouchers.map((voucher) => {
                          const isExpired = new Date(voucher.expires_at) <= nowTime;
                          const isLimitReached = voucher.used_count >= voucher.usage_limit;

                          return (
                        <tr
                          key={voucher.id}
                          className="border-b border-border-light/50 dark:border-border-dark/50 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                        >
                          <td className="py-4 whitespace-nowrap">
                            <span className="font-mono font-black text-text-light dark:text-text-dark bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-sm border border-primary/20 whitespace-nowrap">
                              {voucher.code}
                            </span>
                          </td>
                          <td className="py-4 text-center whitespace-nowrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              voucher.voucher_type === "shipping" 
                                ? "bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400" 
                                : "bg-purple-50 text-purple-600 dark:bg-purple-950/20 dark:text-purple-400"
                            }`}>
                              {voucher.voucher_type === "shipping" ? "Ongkir" : "Umum"}
                            </span>
                          </td>
                          <td className="py-4 text-center whitespace-nowrap">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {voucher.discount_type === "nominal" 
                                ? `Rp ${Number(voucher.discount_value || 0).toLocaleString("id-ID")}` 
                                : `${voucher.discount_percent}%`}
                            </span>
                          </td>
                          <td className="py-4 text-center text-sm text-text-light dark:text-text-dark whitespace-nowrap">
                            Rp {Number(voucher.min_transaction || 0).toLocaleString("id-ID")}
                          </td>
                          <td className="py-4 text-center text-sm whitespace-nowrap">
                            <div className="flex flex-col items-center whitespace-nowrap">
                              <span className="font-bold text-text-light dark:text-text-dark whitespace-nowrap">
                                {voucher.used_count} <span className="text-muted font-normal">/ {voucher.usage_limit}</span>
                              </span>
                              <span className="text-[10px] text-muted whitespace-nowrap">
                                Max {voucher.max_usage_per_user}x/user
                              </span>
                            </div>
                          </td>
                          <td className="py-4 text-sm text-muted whitespace-nowrap">
                            {format(new Date(voucher.expires_at), "dd MMM yyyy, HH:mm", { locale: id })}
                            {isExpired && (
                              <span className="block text-[10px] text-rose-500 font-bold whitespace-nowrap">Kadaluarsa</span>
                            )}
                          </td>
                          <td className="py-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleToggleActive(voucher.id, voucher.is_active)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                                voucher.is_active && !isExpired && !isLimitReached
                                  ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/30"
                                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200/30"
                              }`}
                            >
                              {voucher.is_active && !isExpired && !isLimitReached ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Aktif
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3.5 h-3.5" /> Nonaktif
                                </>
                              )}
                            </button>
                          </td>
                          <td className="py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleEditClick(voucher)}
                                title="Edit Voucher"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-600 bg-amber-500/10 hover:bg-amber-600 hover:text-white transition-all shadow-sm hover:shadow-amber-500/10"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => handleDistribute(voucher.id, voucher.code)}
                                disabled={distributingId === voucher.id || isExpired || !voucher.is_active}
                                title="Kirim ke Semua Pelanggan"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary hover:text-white transition-all shadow-sm hover:shadow-primary/10 disabled:opacity-30 disabled:pointer-events-none"
                              >
                                {distributingId === voucher.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengirim
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3.5 h-3.5" /> Kirim
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleDelete(voucher.id, voucher.code)}
                                title="Hapus Voucher"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-500/10 hover:bg-rose-600 hover:text-white transition-all shadow-sm hover:shadow-rose-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          );
        })()}
        </div>
      </div>
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
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-text-light dark:text-text-dark uppercase tracking-wide">{confirmModal.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{confirmModal.message}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => {
                    setConfirmModal(prev => ({...prev, isOpen: false}));
                  }}
                  className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-muted font-black rounded-xl text-xs uppercase"
                >
                  Batal
                </button>
                <button 
                  onClick={async () => {
                    await confirmModal.onConfirm();
                    setConfirmModal(prev => ({...prev, isOpen: false}));
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
