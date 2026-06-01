"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wallet, ArrowUpRight, ArrowDownLeft, HelpCircle, 
  RefreshCw, Loader2, ArrowRight, Sparkles, CheckCircle, 
  Clock, AlertTriangle, Search, Filter, Play, DollarSign, X, Check, ArrowDown, ArrowUp, Calendar, Ticket, RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Transaction {
  id: string;
  amount: number;
  type: 'topup' | 'payment' | 'refund' | 'cashback' | 'adjust' | 'cancel';
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  payment_method: string;
  payment_reference: string;
  duitku_tx_id: string;
  fee: number;
  description: string;
  created_at: string;
}

export default function CustomerWalletPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [wallet, setWallet] = useState<any>({
    balance: 0,
    monthlyTopup: 0,
    monthlySpending: 0,
    monthlyTxCount: 0
  });
  const [settings, setSettings] = useState<any>({
    minTopup: 10000,
    maxTopup: 2000000,
    isDuitkuEnabled: true,
    adminFee: 0
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<string>("");

  const supabase = createClient();

  useEffect(() => {
    fetchWalletData();

    // Real-time Subscription to wallet transactions and profiles changes
    const channel = supabase
      .channel("customer-wallet-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions" }, () => {
        fetchWalletData();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        fetchWalletData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchWalletData = async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    }
    try {
      const res = await fetch("/api/customer/wallet");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat dompet");
      setWallet(data.wallet);
      setSettings(data.settings);
      setTransactions(data.transactions || []);
      if (isManual) {
        toast.success("Saldo & transaksi berhasil diperbarui!");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(topUpAmount);

    if (isNaN(amount) || amount <= 0) {
      toast.error("Nominal top up tidak valid");
      return;
    }

    if (amount < settings.minTopup) {
      toast.error(`Minimal top up adalah Rp ${settings.minTopup.toLocaleString('id-ID')}`);
      return;
    }

    if (amount > settings.maxTopup) {
      toast.error(`Maksimal top up adalah Rp ${settings.maxTopup.toLocaleString('id-ID')}`);
      return;
    }

    setSubmitting(true);
    const topupToast = toast.loading("Memproses request top up...");
    try {
      const res = await fetch("/api/customer/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gagal membuat invoice top up");

      toast.dismiss(topupToast);
      setShowTopUpModal(false);
      setTopUpAmount("");

      // Use Duitku Pop if available
      if (data.reference && typeof (window as any).checkout !== 'undefined') {
        (window as any).checkout.process(data.reference, {
          successEvent: function(result: any) {
            console.log("Duitku Wallet Topup Success:", result);
            toast.success("Top Up Berhasil! Saldo akan masuk dalam beberapa saat.");
            fetchWalletData();
          },
          pendingEvent: function(result: any) {
            console.log("Duitku Wallet Topup Pending:", result);
            toast("Menunggu pembayaran...", { icon: "⏳" });
            fetchWalletData();
          },
          errorEvent: function(result: any) {
            console.error("Duitku Wallet Topup Error:", result);
            toast.error("Pembayaran dibatalkan.");
            fetchWalletData();
          },
          closeEvent: function() {
            console.log("Duitku Pop Closed.");
            fetchWalletData();
          }
        });
      } else if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("Gagal mengunduh tautan pembayaran.");
      }
    } catch (err: any) {
      toast.error(err.message, { id: topupToast });
    } finally {
      setSubmitting(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "topup": return <ArrowDownLeft className="w-5 h-5 text-emerald-500" />;
      case "payment": return <ArrowUpRight className="w-5 h-5 text-rose-500" />;
      case "refund": return <RotateCcw className="w-5 h-5 text-blue-500" />;
      case "cashback": return <Sparkles className="w-5 h-5 text-amber-500" />;
      default: return <Wallet className="w-5 h-5 text-purple-500" />;
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case "topup": return "Isi Saldo";
      case "payment": return "Pembayaran Pesanan";
      case "refund": return "Refund Pengembalian";
      case "cashback": return "Cashback Reward";
      case "adjust": return "Penyesuaian Admin";
      case "cancel": return "Pembatalan Transaksi";
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-amber-50 text-amber-600 border border-amber-100 uppercase animate-pulse">Menunggu</span>;
      case "success":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">Sukses</span>;
      case "failed":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-rose-50 text-rose-600 border border-rose-100 uppercase">Gagal</span>;
      case "cancelled":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-gray-100 text-gray-500 border border-gray-200 uppercase">Batal</span>;
      default:
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-gray-50 text-gray-450 border border-gray-100 uppercase">{status}</span>;
    }
  };

  // Filter & Search logic
  const filteredTransactions = transactions.filter(tx => {
    const matchesType = filterType === "all" || tx.type === filterType;
    const matchesSearch = searchQuery === "" || 
      tx.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      tx.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (tx.payment_reference && tx.payment_reference.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-3">
            <Wallet className="w-8 h-8 text-primary" /> Dompetku
          </h1>
          <p className="text-muted text-sm mt-1">
            Gunakan saldo dompet digital internal Anda untuk mempermudah transaksi pembayaran makanan & reservasi.
          </p>
        </div>
        <button
          onClick={() => fetchWalletData(true)}
          disabled={loading || isRefreshing}
          className="flex items-center gap-2 self-start sm:self-center px-4 py-2 text-sm font-bold bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl text-muted hover:text-primary transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-primary" : ""}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
          <span>Memuat data Dompetku...</span>
        </div>
      ) : (
        <>
          {/* Main Info Dashboard Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Premium Wallet Balance Card */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              className="md:col-span-2 relative overflow-hidden bg-gradient-to-br from-primary to-orange-600 rounded-[2rem] p-6 text-white shadow-xl shadow-primary/20 flex flex-col justify-between min-h-[180px]"
            >
              <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start z-10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Saldo Dompetku</p>
                  <h2 className="text-4xl font-black mt-1.5 font-mono tracking-tight">Rp {wallet.balance.toLocaleString("id-ID")}</h2>
                </div>
                <div className="bg-white/20 p-3 rounded-2xl">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="border-t border-white/20 pt-4 mt-6 flex justify-between items-center z-10">
                <button
                  onClick={() => setShowTopUpModal(true)}
                  className="px-5 py-2.5 bg-white text-primary font-black text-xs rounded-xl shadow-md hover:bg-orange-50 transition-all uppercase tracking-wider"
                >
                  Isi Saldo
                </button>
                <span className="text-[10px] font-bold text-white/90 bg-white/10 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
                  Realtime Sync
                </span>
              </div>
            </motion.div>

            {/* Spending & Top up Monthly Stats */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 shadow-sm flex flex-col justify-between min-h-[180px]"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted block">Top Up Bulan Ini</span>
                    <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">Rp {wallet.monthlyTopup.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl">
                    <ArrowDown className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>
                <div className="flex justify-between items-start border-t border-gray-100 dark:border-gray-800 pt-3">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted block">Pengeluaran Bulan Ini</span>
                    <span className="text-lg font-black font-mono text-rose-600 dark:text-rose-400 mt-1 block">Rp {wallet.monthlySpending.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/20 rounded-xl">
                    <ArrowUp className="w-4 h-4 text-rose-500" />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Quick Helper Stats */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 shadow-sm flex flex-col justify-between min-h-[180px]"
            >
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-muted block">Aktivitas Transaksi</span>
                <h3 className="text-3xl font-black mt-2 font-mono text-primary flex items-baseline gap-1">
                  {wallet.monthlyTxCount}
                  <span className="text-xs font-bold text-muted uppercase">kali</span>
                </h3>
              </div>
              <p className="text-[10px] text-muted leading-tight mt-4">
                Total transaksi top up, pembayaran, cashback, dan refund bulan ini.
              </p>
            </motion.div>
          </div>

          {/* Quick Menu Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button
              onClick={() => router.push("/customer/menu")}
              className="p-4 bg-card-light dark:bg-card-dark hover:border-primary/40 border border-border-light dark:border-border-dark rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group"
            >
              <Play className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-xs font-black uppercase tracking-wider text-text-light dark:text-text-dark">Bayar Sekarang</span>
            </button>
            <button
              onClick={() => {
                const el = document.getElementById("wallet-history");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="p-4 bg-card-light dark:bg-card-dark hover:border-primary/40 border border-border-light dark:border-border-dark rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group"
            >
              <Calendar className="w-5 h-5 text-orange-500 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-black uppercase tracking-wider text-text-light dark:text-text-dark">Riwayat Mutasi</span>
            </button>
            <button
              onClick={() => router.push("/customer/vouchers")}
              className="p-4 bg-card-light dark:bg-card-dark hover:border-primary/40 border border-border-light dark:border-border-dark rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group"
            >
              <Ticket className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-black uppercase tracking-wider text-text-light dark:text-text-dark">Voucher Saya</span>
            </button>
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-4 bg-card-light dark:bg-card-dark hover:border-primary/40 border border-border-light dark:border-border-dark rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group"
            >
              <HelpCircle className="w-5 h-5 text-blue-500 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-black uppercase tracking-wider text-text-light dark:text-text-dark">Bantuan</span>
            </button>
          </div>

          {/* Transactions List */}
          <div id="wallet-history" className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-light dark:border-border-dark pb-3">
              <h3 className="text-lg font-black uppercase tracking-tight text-text-light dark:text-text-dark flex items-center gap-2">
                Riwayat Transaksi Dompet
              </h3>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Cari transaksi..."
                    className="pl-9 pr-4 py-2 text-xs bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary w-full sm:w-48 font-medium text-text-light dark:text-text-dark"
                  />
                </div>
                <div className="flex items-center gap-1.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl p-1 text-xs">
                  <button onClick={() => setFilterType("all")} className={`px-2.5 py-1 rounded-lg font-bold ${filterType === "all" ? "bg-primary text-white" : "text-muted"}`}>Semua</button>
                  <button onClick={() => setFilterType("topup")} className={`px-2.5 py-1 rounded-lg font-bold ${filterType === "topup" ? "bg-primary text-white" : "text-muted"}`}>Top Up</button>
                  <button onClick={() => setFilterType("payment")} className={`px-2.5 py-1 rounded-lg font-bold ${filterType === "payment" ? "bg-primary text-white" : "text-muted"}`}>Bayar</button>
                  <button onClick={() => setFilterType("refund")} className={`px-2.5 py-1 rounded-lg font-bold ${filterType === "refund" ? "bg-primary text-white" : "text-muted"}`}>Refund</button>
                  <button onClick={() => setFilterType("cashback")} className={`px-2.5 py-1 rounded-lg font-bold ${filterType === "cashback" ? "bg-primary text-white" : "text-muted"}`}>Cashback</button>
                </div>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted text-center bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-8">
                <Wallet className="w-12 h-12 text-muted/30 mb-3" />
                <span className="font-bold text-lg text-text-light dark:text-text-dark">Tidak Ada Transaksi</span>
                <span className="text-xs mt-1 max-w-sm">
                  Tidak ditemukan riwayat transaksi yang cocok dengan kriteria filter atau pencarian Anda.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransactions.map(tx => {
                  const isDebit = ['topup', 'refund', 'cashback', 'adjust'].includes(tx.type) && tx.status === 'success';
                  return (
                    <motion.div 
                      key={tx.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm hover:shadow transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/5 p-3 rounded-2xl shrink-0">
                          {getTransactionIcon(tx.type)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-text-light dark:text-text-dark">{getTransactionTypeLabel(tx.type)}</h4>
                          <p className="text-[10px] text-muted mt-0.5">
                            {tx.description} • {format(new Date(tx.created_at), "dd MMM yyyy, HH:mm", { locale: id })} WIB
                          </p>
                          <p className="text-[9px] font-mono text-muted uppercase mt-0.5 tracking-wider">ID: #{tx.id.substring(0, 8).toUpperCase()}</p>
                        </div>
                      </div>
                      <div className="flex sm:flex-col items-end justify-between sm:justify-center w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-border-light dark:border-border-dark">
                        <span className="sm:hidden">{getStatusBadge(tx.status)}</span>
                        <div className="flex flex-col items-end">
                          <span className={`font-mono font-black text-sm ${isDebit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                            {isDebit ? "+" : "-"}Rp {Number(tx.amount).toLocaleString("id-ID")}
                          </span>
                          {tx.fee > 0 && <span className="text-[9px] text-muted">Fee: Rp {Number(tx.fee).toLocaleString("id-ID")}</span>}
                          <span className="hidden sm:block mt-1">{getStatusBadge(tx.status)}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* 1. Help Modal */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHelpModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} className="relative bg-white dark:bg-card-dark w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 z-10">
              <div className="p-6 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-primary" /> Informasi & Bantuan
                </h3>
                <button onClick={() => setShowHelpModal(false)} title="Tutup" className="p-2 hover:bg-gray-100 rounded-xl transition-all"><X className="w-5 h-5 text-muted" /></button>
              </div>
              <div className="p-6 space-y-4 text-sm text-muted leading-relaxed">
                <div>
                  <h4 className="font-bold text-text-light dark:text-text-dark text-xs uppercase tracking-wider mb-1">Apa itu Dompetku?</h4>
                  <p>Dompetku adalah e-wallet internal yang memungkinkan Anda menyimpan saldo digital di RestoBook guna melakukan checkout pesanan atau pembayaran deposit reservasi dengan sangat cepat tanpa perlu mengulang pembayaran di luar.</p>
                </div>
                <div>
                  <h4 className="font-bold text-text-light dark:text-text-dark text-xs uppercase tracking-wider mb-1">Metode Top Up Pembayaran</h4>
                  <p>Top Up didukung penuh secara realtime dengan Integrasi Payment Gateway Duitku. Anda bisa menggunakan QRIS, Virtual Account Bank (BCA, Mandiri, BNI, BRI), E-Wallet (DANA, OVO, ShopeePay), dan Gerai Retail terdekat (Indomaret, Alfamart).</p>
                </div>
                <div>
                  <h4 className="font-bold text-text-light dark:text-text-dark text-xs uppercase tracking-wider mb-1">Ketentuan Top Up</h4>
                  <p>Minimal isi saldo sekali transaksi adalah Rp {settings.minTopup.toLocaleString('id-ID')} dan maksimal sebesar Rp {settings.maxTopup.toLocaleString('id-ID')}.</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Top Up Modal */}
      <AnimatePresence>
        {showTopUpModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowTopUpModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} className="relative bg-white dark:bg-card-dark w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 z-10">
              <div className="p-6 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <ArrowDownLeft className="w-5 h-5 text-primary" /> Isi Saldo Dompetku
                </h3>
                <button onClick={() => setShowTopUpModal(false)} title="Tutup" className="p-2 hover:bg-gray-100 rounded-xl transition-all"><X className="w-5 h-5 text-muted" /></button>
              </div>

              <form onSubmit={handleTopUpSubmit} className="p-6 space-y-5">
                <div>
                  <label htmlFor="topUpAmountInput" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Nominal Isi Saldo (Rp)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted text-sm">Rp</span>
                    <input 
                      id="topUpAmountInput"
                      type="number" 
                      required 
                      min={settings.minTopup}
                      max={settings.maxTopup}
                      value={topUpAmount} 
                      onChange={e => setTopUpAmount(e.target.value)} 
                      placeholder="Contoh: 50000" 
                      title="Nominal Isi Saldo (Rp)"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>
                  <span className="text-[9px] text-muted font-medium mt-1 block">Minimal Rp {settings.minTopup.toLocaleString('id-ID')} • Maksimal Rp {settings.maxTopup.toLocaleString('id-ID')}</span>
                </div>

                {/* Quick Nominal Selectors */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-muted tracking-widest block">Pilih Cepat</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[10000, 20000, 50000, 100000, 200000, 500000].map(nom => (
                      <button
                        key={nom}
                        type="button"
                        onClick={() => setTopUpAmount(String(nom))}
                        className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${
                          topUpAmount === String(nom)
                            ? "bg-primary border-primary text-white shadow-md shadow-primary/10"
                            : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-muted hover:border-primary/50"
                        }`}
                      >
                        Rp {nom.toLocaleString('id-ID').replace(',00', '')}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-50 mt-4 uppercase tracking-wider text-xs"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Lanjut Pembayaran"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
