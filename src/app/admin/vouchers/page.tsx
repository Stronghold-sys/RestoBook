"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket, Plus, Trash2, Send, Calendar, Percent,
  Users, CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw
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

  // Form State
  const [form, setForm] = useState({
    code: "",
    discount_percent: "",
    usage_limit: "100",
    max_usage_per_user: "1",
    expires_at: "",
    is_active: true
  });

  const supabase = createClient();

  useEffect(() => {
    fetchVouchers();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code || !form.discount_percent || !form.expires_at) {
      return toast.error("Semua field wajib diisi");
    }

    const discountVal = Number(form.discount_percent);
    if (isNaN(discountVal) || discountVal <= 0 || discountVal > 100) {
      return toast.error("Persentase diskon harus bernilai antara 1 dan 100");
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal membuat voucher");

      toast.success(`Voucher ${data.voucher.code} Berhasil Dibuat!`);
      
      // Reset Form (except usage_limit and max_usage defaults)
      setForm({
        code: "",
        discount_percent: "",
        usage_limit: "100",
        max_usage_per_user: "1",
        expires_at: "",
        is_active: true
      });
      
      fetchVouchers();
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
    if (!confirm(`Apakah Anda yakin ingin menghapus voucher ${voucherCode}?`)) return;

    try {
      const response = await fetch(`/api/admin/vouchers?id=${voucherId}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menghapus voucher");

      toast.success(`Voucher ${voucherCode} dihapus`);
      setVouchers(prev => prev.filter(v => v.id !== voucherId));
    } catch (error: any) {
      toast.error(error.message);
    }
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
              <Plus className="w-5 h-5 text-primary" /> Buat Voucher Baru
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Kode Voucher</label>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                className="w-full bg-primary hover:bg-primary/90 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Menyimpan...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" /> Tambah Voucher
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Daftar Voucher (Kanan) */}
        <div className="lg:col-span-2">
          <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 shadow-xl min-h-[400px]">
            <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-6 flex items-center gap-2 pb-4 border-b border-border-light dark:border-border-dark">
              <Ticket className="w-5 h-5 text-primary" /> Daftar Voucher Aktif & Riwayat
            </h2>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
                <span>Memuat data voucher...</span>
              </div>
            ) : vouchers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted text-center">
                <AlertCircle className="w-12 h-12 text-muted/50 mb-3" />
                <span className="font-bold">Belum ada voucher</span>
                <span className="text-xs mt-1">Tambahkan voucher baru menggunakan form di sebelah kiri.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border-light dark:border-border-dark">
                      <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider">Kode</th>
                      <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider text-center">Diskon</th>
                      <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider text-center">Pemakaian</th>
                      <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider">Berakhir Pada</th>
                      <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider text-center">Status</th>
                      <th className="pb-3 text-xs font-bold text-muted uppercase tracking-wider text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vouchers.map((voucher) => {
                      const isExpired = new Date(voucher.expires_at) <= new Date();
                      const isLimitReached = voucher.used_count >= voucher.usage_limit;

                      return (
                        <tr
                          key={voucher.id}
                          className="border-b border-border-light/50 dark:border-border-dark/50 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                        >
                          <td className="py-4">
                            <span className="font-mono font-black text-text-light dark:text-text-dark bg-primary/10 text-primary px-2.5 py-1 rounded-lg text-sm border border-primary/20">
                              {voucher.code}
                            </span>
                          </td>
                          <td className="py-4 text-center">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {voucher.discount_percent}%
                            </span>
                          </td>
                          <td className="py-4 text-center text-sm">
                            <div className="flex flex-col items-center">
                              <span className="font-bold text-text-light dark:text-text-dark">
                                {voucher.used_count} <span className="text-muted font-normal">/ {voucher.usage_limit}</span>
                              </span>
                              <span className="text-[10px] text-muted">
                                Max {voucher.max_usage_per_user}x/user
                              </span>
                            </div>
                          </td>
                          <td className="py-4 text-sm text-muted">
                            {format(new Date(voucher.expires_at), "dd MMM yyyy, HH:mm", { locale: id })}
                            {isExpired && (
                              <span className="block text-[10px] text-rose-500 font-bold">Kadaluarsa</span>
                            )}
                          </td>
                          <td className="py-4 text-center">
                            <button
                              onClick={() => handleToggleActive(voucher.id, voucher.is_active)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
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
                          <td className="py-4 text-right space-x-2">
                            <button
                              onClick={() => handleDistribute(voucher.id, voucher.code)}
                              disabled={distributingId === voucher.id || isExpired || !voucher.is_active}
                              title="Kirim ke Semua Pelanggan"
                              className="inline-flex items-center justify-center p-2 rounded-xl text-primary bg-primary/10 hover:bg-primary hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
                            >
                              {distributingId === voucher.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleDelete(voucher.id, voucher.code)}
                              title="Hapus Voucher"
                              className="inline-flex items-center justify-center p-2 rounded-xl text-rose-500 bg-rose-500/10 hover:bg-rose-500 hover:text-white transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
