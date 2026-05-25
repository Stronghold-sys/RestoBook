"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Ticket, Copy, Calendar, AlertCircle, Clock,
  CheckCircle, HelpCircle, RefreshCw, Loader2, ArrowRight
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

export default function CustomerVouchersPage() {
  const [loading, setLoading] = useState(true);
  const [activeVouchers, setActiveVouchers] = useState<any[]>([]);
  const [historyVouchers, setHistoryVouchers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");

  const supabase = createClient();

  useEffect(() => {
    fetchCustomerVouchers();

    const channel = supabase
      .channel("customer-vouchers-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vouchers" },
        () => {
          fetchCustomerVouchers();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_vouchers" },
        () => {
          fetchCustomerVouchers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCustomerVouchers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/customer/vouchers");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memuat voucher");
      setActiveVouchers(data.active || []);
      setHistoryVouchers(data.history || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Kode voucher ${code} berhasil disalin!`);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-3">
            <Ticket className="w-8 h-8" /> Voucher Saya
          </h1>
          <p className="text-muted text-sm mt-1">
            Gunakan voucher promosi untuk menghemat pesanan makanan Anda.
          </p>
        </div>
        <button
          onClick={fetchCustomerVouchers}
          className="flex items-center gap-2 self-start sm:self-center px-4 py-2 text-sm font-bold bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl text-muted hover:text-primary transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-light dark:border-border-dark">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
            activeTab === "active"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-text-light dark:hover:text-text-dark"
          }`}
        >
          Voucher Aktif ({activeVouchers.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
            activeTab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted hover:text-text-light dark:hover:text-text-dark"
          }`}
        >
          Riwayat Voucher ({historyVouchers.length})
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
          <span>Memuat data voucher Anda...</span>
        </div>
      ) : activeTab === "active" ? (
        // TAB VOUCHER AKTIF
        activeVouchers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted text-center bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-8">
            <Ticket className="w-12 h-12 text-muted/30 mb-3" />
            <span className="font-bold text-lg text-text-light dark:text-text-dark">Tidak ada voucher aktif</span>
            <span className="text-xs mt-1 max-w-sm">
              Saat ini Anda tidak memiliki voucher aktif. Hubungi kasir atau tunggu promo menarik selanjutnya!
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeVouchers.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 shadow-lg flex flex-col justify-between overflow-hidden group hover:shadow-xl hover:border-primary/30 transition-all duration-300"
              >
                {/* Background Ticket Notch Effect */}
                <div className="absolute top-1/2 -left-3 w-6 h-6 rounded-full bg-background-light dark:bg-background-dark border-r border-border-light dark:border-border-dark -translate-y-1/2 z-10" />
                <div className="absolute top-1/2 -right-3 w-6 h-6 rounded-full bg-background-light dark:bg-background-dark border-l border-border-light dark:border-border-dark -translate-y-1/2 z-10" />

                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                      {item.discount_percent}% <span className="text-xs font-bold text-muted uppercase tracking-wider block">Diskon</span>
                    </span>
                    <span className="px-2.5 py-1 text-[10px] font-black rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/20 uppercase tracking-wider">
                      Dapat Digunakan
                    </span>
                  </div>

                  <h3 className="font-mono text-xl font-black text-text-light dark:text-text-dark tracking-wide uppercase flex items-center gap-2 mb-2">
                    {item.code}
                    <button
                      onClick={() => handleCopyCode(item.code)}
                      title="Salin Kode Voucher"
                      className="p-1.5 rounded-lg bg-primary/5 hover:bg-primary/20 text-primary transition-all group-hover:scale-105"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </h3>
                  
                  <p className="text-xs text-muted leading-relaxed">
                    Gunakan kode ini saat proses checkout di keranjang belanja untuk mendapatkan potongan sebesar {item.discount_percent}% dari total transaksi Anda.
                  </p>
                </div>

                <div className="mt-6 border-t border-border-light dark:border-border-dark pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                  <span className="text-muted flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    Batas: {format(new Date(item.expires_at), "dd MMM yyyy, HH:mm", { locale: id })}
                  </span>
                  <span className="text-muted font-bold flex items-center gap-1">
                    Pemakaian Anda: {item.used_count} / {item.max_usage_per_user} kali
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )
      ) : (
        // TAB RIWAYAT VOUCHER
        historyVouchers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted text-center bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-8">
            <Clock className="w-12 h-12 text-muted/30 mb-3" />
            <span className="font-bold text-lg text-text-light dark:text-text-dark">Riwayat kosong</span>
            <span className="text-xs mt-1 max-w-sm">
              Anda belum pernah menggunakan voucher atau tidak memiliki voucher yang hangus.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-75">
            {historyVouchers.map((item) => {
              let badgeColor = "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200/20";
              let badgeText = "Kadaluarsa";

              if (item.status === "used") {
                badgeColor = "bg-primary/5 text-primary dark:bg-primary/10 dark:text-primary/90 border border-primary/20";
                badgeText = "Sudah Digunakan";
              } else if (item.status === "exhausted") {
                badgeColor = "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/20";
                badgeText = "Kuota Habis";
              } else if (item.status === "inactive") {
                badgeColor = "bg-gray-50 text-gray-500 dark:bg-gray-950/20 dark:text-gray-400 border border-gray-200/20";
                badgeText = "Tidak Aktif";
              }

              return (
                <div
                  key={item.id}
                  className="relative bg-card-light/50 dark:bg-card-dark/50 border border-border-light/50 dark:border-border-dark/50 rounded-3xl p-6 flex flex-col justify-between overflow-hidden"
                >
                  {/* Background Ticket Notch Effect */}
                  <div className="absolute top-1/2 -left-3 w-6 h-6 rounded-full bg-background-light dark:bg-background-dark border-r border-border-light/50 dark:border-border-dark/50 -translate-y-1/2 z-10" />
                  <div className="absolute top-1/2 -right-3 w-6 h-6 rounded-full bg-background-light dark:bg-background-dark border-l border-border-light/50 dark:border-border-dark/50 -translate-y-1/2 z-10" />

                  <div>
                    <div className="flex justify-between items-start gap-2 mb-3">
                      <span className="text-3xl font-black text-muted">
                        {item.discount_percent}% <span className="text-xs font-bold text-muted uppercase tracking-wider block">Diskon</span>
                      </span>
                      <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider ${badgeColor}`}>
                        {badgeText}
                      </span>
                    </div>

                    <h3 className="font-mono text-xl font-black text-muted tracking-wide uppercase mb-2 line-through">
                      {item.code}
                    </h3>
                    
                    <p className="text-xs text-muted leading-relaxed">
                      {item.status === "used" 
                        ? `Voucher ini telah sukses Anda gunakan untuk menghemat pesanan Anda.`
                        : `Voucher ini sudah tidak dapat digunakan lagi karena statusnya yang telah ${badgeText.toLowerCase()}.`}
                    </p>
                  </div>

                  <div className="mt-6 border-t border-border-light/50 dark:border-border-dark/50 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Berakhir: {format(new Date(item.expires_at), "dd MMM yyyy, HH:mm", { locale: id })}
                    </span>
                    <span className="font-bold">
                      Digunakan: {item.used_count} kali
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
