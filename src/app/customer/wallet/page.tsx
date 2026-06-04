"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Wallet, ArrowUpRight, ArrowDownLeft, HelpCircle, 
  RefreshCw, Loader2, ArrowRight, Sparkles, CheckCircle, 
  Clock, AlertTriangle, Search, Filter, Play, DollarSign, X, Check, ArrowDown, ArrowUp, Calendar, Ticket, RotateCcw,
  ShoppingBag, Lock, ShieldAlert, FileText, Upload, Key
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
  const [showUnpaidModal, setShowUnpaidModal] = useState(false);
  const [unpaidTransactions, setUnpaidTransactions] = useState<any[]>([]);
  const [isDuitkuOpen, setIsDuitkuOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<string>("");

  // PIN Transaction states
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinType, setPinType] = useState<"create" | "change" | null>(null);
  const [pinForm, setPinForm] = useState({
    oldPin: "",
    newPin: "",
    pin: "",
    otp: "",
    otpChannel: "email" as "email" | "whatsapp",
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  // Appeal states
  const [appealReason, setAppealReason] = useState("");
  const [appealFile, setAppealFile] = useState<File | null>(null);
  const [appealLoading, setAppealLoading] = useState(false);
  const [walletAppeal, setWalletAppeal] = useState<any>(null);

  // Wallet Activation states
  const [walletStatus, setWalletStatus] = useState<string>("belum_aktif");
  const [rejectionReason, setRejectionReason] = useState<string>("");

  useEffect(() => {
    if (otpTimer > 0) {
      const t = setTimeout(() => setOtpTimer(otpTimer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpTimer]);

  const supabase = createClient();

  useEffect(() => {
    fetchWalletData();

    // Real-time Subscription to wallet transactions, profiles, and orders changes
    const channel = supabase
      .channel("customer-wallet-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions" }, () => {
        fetchWalletData();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        fetchWalletData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchWalletData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_activations" }, () => {
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
      setUnpaidTransactions(data.unpaidTransactions || []);
      setWalletAppeal(data.walletAppeal || null);
      
      // Load activation status
      const actRes = await fetch("/api/customer/wallet/activation");
      const actData = await actRes.json();
      if (actRes.ok && actData.activation) {
        setWalletStatus(actData.activation.status || "belum_aktif");
        setRejectionReason(actData.activation.rejection_reason || "");
      } else {
        setWalletStatus(data.wallet?.walletStatus || "belum_aktif");
      }

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

  const handleSendOtp = async () => {
    if (otpTimer > 0) return;
    setOtpLoading(true);
    try {
      const isCreate = !wallet.hasPin || pinType === "create" || wallet.pinResetRequired;
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: wallet.email,
          phone: wallet.phone,
          type: isCreate ? "create_pin" : "change_pin",
          method: pinForm.otpChannel,
          name: wallet.fullName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim OTP");
      toast.success(`OTP berhasil dikirim ke ${pinForm.otpChannel === "email" ? "Email" : "WhatsApp"} Anda!`);
      setOtpSent(true);
      setOtpTimer(60);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setOtpLoading(false);
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isCreate = !wallet.hasPin || pinType === "create" || wallet.pinResetRequired;
    const targetPin = isCreate ? pinForm.pin : pinForm.newPin;

    if (!/^\d{6}$/.test(targetPin)) {
      toast.error("PIN harus terdiri dari 6 digit angka");
      return;
    }

    if (!isCreate && !/^\d{6}$/.test(pinForm.oldPin)) {
      toast.error("PIN lama harus terdiri dari 6 digit angka");
      return;
    }

    if (!pinForm.otp) {
      toast.error("Kode OTP wajib diisi");
      return;
    }

    setPinLoading(true);
    try {
      const res = await fetch("/api/customer/wallet/pin", {
        method: isCreate ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: isCreate ? pinForm.pin : undefined,
          oldPin: isCreate ? undefined : pinForm.oldPin,
          newPin: isCreate ? undefined : pinForm.newPin,
          otp: pinForm.otp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses PIN");
      toast.success(isCreate ? "PIN transaksi berhasil dibuat!" : "PIN transaksi berhasil diubah!");
      setShowPinModal(false);
      setPinForm({
        oldPin: "",
        newPin: "",
        pin: "",
        otp: "",
        otpChannel: "email",
      });
      setOtpSent(false);
      fetchWalletData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPinLoading(false);
    }
  };

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealReason.trim()) {
      toast.error("Alasan banding wajib diisi");
      return;
    }

    setAppealLoading(true);
    const appealToast = toast.loading("Mengirim permohonan banding...");
    try {
      let uploadedUrl = "";
      if (appealFile) {
        const formData = new FormData();
        formData.append("file", appealFile);
        formData.append("userId", wallet.fullName || "customer");
        formData.append("bucket", "profiles");
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "Gagal mengunggah file bukti");
        uploadedUrl = uploadData.url;
      }

      // Submit appeal
      const res = await fetch("/api/admin/customers/appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: wallet.id,
          reason: appealReason,
          type: "wallet_unblock",
          attachment_url: uploadedUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim banding");
      toast.success("Permohonan banding berhasil dikirim ke Admin!", { id: appealToast });
      setAppealReason("");
      setAppealFile(null);
      fetchWalletData();
    } catch (err: any) {
      toast.error(err.message, { id: appealToast });
    } finally {
      setAppealLoading(false);
    }
  };

  const handleUnpaidClick = async (tx: any) => {
    if (tx.type === 'topup') {
      if (!tx.payment_reference) {
        toast.error("Reference pembayaran tidak ditemukan.");
        return;
      }
      
      if (typeof (window as any).checkout !== 'undefined') {
        setIsDuitkuOpen(true);
        (window as any).checkout.process(tx.payment_reference, {
          successEvent: function(result: any) {
            console.log("Duitku Topup Success:", result);
            toast.success("Top Up Berhasil! Saldo akan masuk dalam beberapa saat.");
            setIsDuitkuOpen(false);
            setShowUnpaidModal(false);
            fetchWalletData();
          },
          pendingEvent: function(result: any) {
            console.log("Duitku Topup Pending:", result);
            toast("Menunggu pembayaran...", { icon: <Loader2 className="w-4 h-4 animate-spin text-primary" /> });
            setIsDuitkuOpen(false);
            fetchWalletData();
          },
          errorEvent: function(result: any) {
            console.error("Duitku Topup Error:", result);
            toast.error("Pembayaran gagal/dibatalkan.");
            setIsDuitkuOpen(false);
            fetchWalletData();
          },
          closeEvent: function() {
            console.log("Duitku Pop Closed.");
            setIsDuitkuOpen(false);
            fetchWalletData();
          }
        });
      } else {
        toast.error("Portal pembayaran tidak siap. Silakan coba lagi.");
      }
    } else if (tx.type === 'order') {
      const pToast = toast.loading("Menyiapkan portal pembayaran aman...");
      try {
        const res = await fetch('/api/payment/create-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            orderId: tx.id,
            paymentMethod: "",
            returnUrl: window.location.href
          })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Gagal menyiapkan tagihan');
        
        if (data.reference && typeof (window as any).checkout !== 'undefined') {
          toast.dismiss(pToast);
          setIsDuitkuOpen(true);
          (window as any).checkout.process(data.reference, {
            successEvent: async function(result: any) {
              console.log("Duitku Order Success:", result);
              setIsDuitkuOpen(false);
              setShowUnpaidModal(false);
              toast.success("Pembayaran Pesanan Berhasil!");
              await fetch('/api/payment/check-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  orderId: tx.id,
                  duitkuOrderId: result?.merchantOrderId || tx.id 
                })
              });
              fetchWalletData();
            },
            pendingEvent: async function(result: any) {
              console.log("Duitku Order Pending:", result);
              setIsDuitkuOpen(false);
              toast("Menunggu konfirmasi pembayaran...", { icon: <Loader2 className="w-4 h-4 animate-spin text-primary" /> });
              await fetch('/api/payment/check-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  orderId: tx.id,
                  duitkuOrderId: result?.merchantOrderId || tx.id 
                })
              });
              fetchWalletData();
            },
            errorEvent: async function(result: any) {
              setIsDuitkuOpen(false);
              toast.error("Transaksi dibatalkan.");
              await supabase.from("orders").update({ created_at: new Date().toISOString() }).eq("id", tx.id);
              fetchWalletData();
            },
            closeEvent: async function() {
              console.log("Duitku Pop Closed. Syncing status...");
              setIsDuitkuOpen(false);
              await supabase.from("orders").update({ created_at: new Date().toISOString() }).eq("id", tx.id);
              await fetch('/api/payment/check-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: tx.id })
              });
              fetchWalletData();
            }
          });
        } else if (data.paymentUrl) {
          toast.dismiss(pToast);
          window.location.href = data.paymentUrl;
        } else {
          throw new Error("Gagal memuat portal pembayaran.");
        }
      } catch (err: any) {
        toast.error(err.message, { id: pToast });
      }
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
            toast("Menunggu pembayaran...", { icon: <Loader2 className="w-4 h-4 animate-spin text-primary" /> });
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
          <h1 className="text-3xl font-black text-primary flex flex-wrap items-center gap-3">
            <Wallet className="w-8 h-8 text-primary" /> Dompetku
            {/* Status Badge */}
            {walletStatus === "belum_aktif" && (
              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700 uppercase tracking-wider">Belum Aktif</span>
            )}
            {walletStatus === "diajukan" && (
              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800 uppercase tracking-wider animate-pulse">Diajukan</span>
            )}
            {walletStatus === "diajukan_ulang" && (
              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-blue-100 text-blue-650 dark:bg-blue-900/30 dark:text-blue-450 border border-blue-200 dark:border-blue-800 uppercase tracking-wider animate-pulse">Diajukan Ulang</span>
            )}
            {walletStatus === "diproses" && (
              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 uppercase tracking-wider animate-pulse">Diproses</span>
            )}
            {walletStatus === "diterima" && (
              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 uppercase tracking-wider">Diterima</span>
            )}
            {walletStatus === "ditolak" && (
              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800 uppercase tracking-wider">Ditolak</span>
            )}
            {walletStatus === "selesai" && (
              <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-450 border border-green-200 dark:border-green-800 uppercase tracking-wider">Selesai / Aktif</span>
            )}
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
          {/* Status Aktivasi Dompetku Banners */}
          {walletStatus === "belum_aktif" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-orange-500/10 to-red-500/10 dark:from-orange-500/5 dark:to-red-500/5 border border-orange-500/30 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-orange-500/20 rounded-2xl text-orange-600 dark:text-orange-400 shrink-0">
                  <Wallet className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-text-light dark:text-text-dark">Aktivasi Dompetku Diperlukan</h3>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Demi keamanan akun dan kepatuhan regulasi, Anda wajib melakukan aktivasi akun Dompetku terlebih dahulu sebelum dapat menggunakannya untuk transaksi pembayaran makanan maupun pengisian saldo (top up).
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push("/customer/wallet/activation")}
                className="px-6 py-3 bg-primary hover:bg-primary-hover text-white font-black text-xs rounded-xl shadow-md transition-all whitespace-nowrap self-start md:self-center uppercase tracking-wider"
              >
                Aktivasi Sekarang
              </button>
            </motion.div>
          )}

          {["diajukan", "diajukan_ulang", "diproses"].includes(walletStatus) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/5 dark:to-orange-500/5 border border-amber-500/30 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-500/20 rounded-2xl text-amber-600 dark:text-amber-400 shrink-0 animate-pulse">
                  <Clock className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-text-light dark:text-text-dark">Pengajuan Aktivasi Sedang Ditinjau</h3>
                    <span className="px-2 py-0.5 text-[9px] font-black rounded bg-amber-500 text-white uppercase tracking-wider animate-pulse">
                      {walletStatus === "diproses" ? "Sedang Diproses" : "Diajukan"}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Berkas pengajuan aktivasi Dompetku Anda telah diterima oleh sistem dan sedang diperiksa oleh tim verifikator kami. Proses validasi memakan waktu maksimal 1x24 jam. Terima kasih atas kesabaran Anda.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {walletStatus === "ditolak" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-red-500/10 to-rose-500/10 dark:from-red-500/5 dark:to-rose-500/5 border border-red-500/30 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-500/20 rounded-2xl text-red-650 shrink-0">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base text-red-600 dark:text-red-400">Pengajuan Aktivasi Ditolak</h3>
                    <span className="px-2 py-0.5 text-[9px] font-black rounded bg-red-500 text-white uppercase tracking-wider">
                      Perlu Revisi
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    Maaf, pengajuan aktivasi Dompetku Anda belum dapat disetujui karena berkas/data tidak valid. Silakan lakukan perbaikan data dan unggah kembali dokumen revisi yang diminta.
                  </p>
                  {rejectionReason && (
                    <div className="p-3 bg-card-light dark:bg-card-dark border border-red-200 dark:border-red-900/50 rounded-xl text-xs">
                      <span className="font-bold text-red-500">Catatan Admin:</span> &quot;{rejectionReason}&quot;
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => router.push("/customer/wallet/activation")}
                className="px-6 py-3 bg-red-500 hover:bg-red-650 text-white font-black text-xs rounded-xl shadow-md transition-all whitespace-nowrap self-start md:self-center uppercase tracking-wider"
              >
                Perbaiki & Ajukan Ulang
              </button>
            </motion.div>
          )}

          {/* Recommendation & Block Banners */}
          {!wallet.hasPin && !wallet.isBlocked && !wallet.pinResetRequired && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/5 dark:to-orange-500/5 border border-amber-500/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-text-light dark:text-text-dark">Amankan Transaksi Dompetku Anda!</h4>
                  <p className="text-xs text-muted mt-0.5">Anda belum membuat PIN transaksi. Kami sangat menyarankan untuk segera membuatnya demi melindungi saldo Dompetku Anda.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setPinType("create");
                  setOtpSent(false);
                  setShowPinModal(true);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs rounded-xl shadow-md transition-all whitespace-nowrap self-start md:self-center uppercase tracking-wider"
              >
                Buat PIN Sekarang
              </button>
            </motion.div>
          )}

          {wallet.isBlocked && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Premium Blocked Banner */}
              <div className="bg-gradient-to-r from-rose-500/10 to-red-650/10 dark:from-rose-500/5 dark:to-red-650/5 border border-rose-500/30 rounded-[2rem] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-lg shadow-rose-500/5">
                <div className="flex items-start gap-4">
                  <div className="p-4 bg-rose-500/20 rounded-2xl text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-black text-xl text-rose-600 dark:text-rose-400">Akses Dompetku Diblokir</h3>
                    <p className="text-sm text-muted mt-1 leading-relaxed">
                      {wallet.blockReason === 'wrong_pin_3x' 
                        ? 'Demi keamanan akun, akses transaksi Dompetku Anda diblokir otomatis setelah salah memasukkan PIN sebanyak 3x berturut-turut.'
                        : `Akses transaksi Dompetku Anda telah dinonaktifkan sementara oleh administrator. Alasan: ${wallet.blockReason || 'Kebijakan Keamanan Restoran'}.`
                      }
                    </p>
                    <p className="text-xs text-rose-500 font-extrabold mt-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Anda tidak dapat melakukan Top Up maupun melakukan pembayaran menggunakan saldo Dompetku selama blokir aktif.</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Appeal Section */}
              <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 md:p-8 space-y-6 shadow-sm">
                <h4 className="font-black text-lg text-text-light dark:text-text-dark flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" /> Pengajuan Banding Pembukaan Blokir
                </h4>

                {walletAppeal && walletAppeal.status === 'pending' ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 text-center space-y-3">
                    <Clock className="w-10 h-10 text-amber-500 mx-auto animate-pulse" />
                    <h5 className="font-extrabold text-base text-amber-600 dark:text-amber-400">Banding Sedang Ditinjau Admin</h5>
                    <p className="text-xs text-muted max-w-lg mx-auto">
                      Permohonan banding Anda yang dikirim pada tanggal <strong>{format(new Date(walletAppeal.created_at), "dd MMMM yyyy", { locale: id })}</strong> sedang dalam proses verifikasi dokumen dan investigasi oleh tim restoran. Proses peninjauan memakan waktu maksimal 1x24 jam.
                    </p>
                    <div className="pt-2">
                      <span className="px-3 py-1 text-[10px] font-black rounded-full bg-amber-500 text-white uppercase tracking-wider animate-pulse">Pending Review</span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAppealSubmit} className="space-y-4">
                    {walletAppeal && walletAppeal.status === 'rejected' && (
                      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-xs text-rose-600 dark:text-rose-400 font-bold flex items-start gap-2">
                        <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <span>Permohonan banding Anda sebelumnya ditolak: &quot;{walletAppeal.admin_message || 'Alasan ditolak tidak dicantumkan.'}&quot;. Silakan ajukan kembali dengan menyertakan bukti pendukung baru yang valid.</span>
                      </div>
                    )}
                    
                    <div className="space-y-1.5">
                      <label htmlFor="appealReasonInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">Alasan Pengajuan Banding</label>
                      <textarea
                        id="appealReasonInput"
                        required
                        value={appealReason}
                        onChange={e => setAppealReason(e.target.value)}
                        placeholder="Jelaskan alasan mengapa blokir dompet Anda harus dibuka (misalnya: 'Saya lupa PIN transaksi saya karena jarang bertransaksi, tolong bantu buka blokir')"
                        rows={3}
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 text-sm outline-none focus:ring-2 focus:ring-primary font-medium text-text-light dark:text-text-dark"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="appealFileInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">Unggah Bukti Pendukung (KTP/Screenshot Percobaan PIN)</label>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-muted hover:text-primary cursor-pointer hover:border-primary/50 transition-all">
                          <Upload className="w-4 h-4 text-primary" /> 
                          {appealFile ? appealFile.name : "Pilih File Gambar"}
                          <input
                            id="appealFileInput"
                            type="file"
                            accept="image/*"
                            onChange={e => setAppealFile(e.target.files?.[0] || null)}
                            className="hidden"
                          />
                        </label>
                        {appealFile && (
                          <button
                            type="button"
                            onClick={() => setAppealFile(null)}
                            className="p-2 hover:bg-rose-50 rounded-xl text-rose-500 transition-all text-xs font-bold"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted font-medium mt-1">Format gambar (JPG, PNG) maksimal 5MB. Dokumen ini hanya akan digunakan oleh admin untuk verifikasi identitas pemilik akun demi mencegah pencurian saldo.</p>
                    </div>

                    <button
                      type="submit"
                      disabled={appealLoading}
                      className="px-6 py-3.5 bg-primary hover:bg-primary-hover text-white font-black text-xs rounded-xl shadow-md uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      {appealLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Kirim Permohonan Banding
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          )}

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
                  onClick={() => {
                    if (!['diterima', 'selesai'].includes(walletStatus)) {
                      toast.error("Aktivasi Dompetku diperlukan sebelum melakukan pengisian saldo (top up)");
                      return;
                    }
                    setShowTopUpModal(true);
                  }}
                  className={`px-5 py-2.5 font-black text-xs rounded-xl shadow-md transition-all uppercase tracking-wider ${
                    ['diterima', 'selesai'].includes(walletStatus)
                      ? "bg-white text-primary hover:bg-orange-50"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed shadow-none"
                  }`}
                >
                  Isi Saldo
                </button>
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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <button
              onClick={() => {
                if (!['diterima', 'selesai'].includes(walletStatus)) {
                  toast.error("Aktivasi Dompetku diperlukan sebelum mengatur PIN");
                  return;
                }
                setPinType(wallet.hasPin ? "change" : "create");
                setOtpSent(false);
                setShowPinModal(true);
              }}
              className={`p-4 bg-card-light dark:bg-card-dark hover:border-primary/40 border border-border-light dark:border-border-dark rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group ${
                !['diterima', 'selesai'].includes(walletStatus) ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              <Lock className="w-5 h-5 text-purple-500 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-black uppercase tracking-wider text-text-light dark:text-text-dark">Keamanan PIN</span>
            </button>
            <button
              onClick={() => setShowUnpaidModal(true)}
              className="p-4 bg-card-light dark:bg-card-dark hover:border-primary/40 border border-border-light dark:border-border-dark rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group relative"
            >
              {unpaidTransactions.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[9px] px-2 py-0.5 rounded-full shadow-md animate-pulse">
                  {unpaidTransactions.length}
                </span>
              )}
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
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            <p className="text-[9px] font-mono text-muted uppercase mt-0.5 tracking-wider">ID: #{tx.id.substring(0, 8).toUpperCase()}</p>
                            {tx.status === 'pending' && tx.type === 'topup' && (
                              <CountdownTimer 
                                createdAt={tx.created_at} 
                                expiryMinutes={settings.topupExpiryMinutes || 15} 
                                onExpire={() => fetchWalletData()} 
                              />
                            )}
                          </div>
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
                  <p>Top Up didukung penuh secara realtime dengan Integrasi Gerbang Pembayaran Resmi. Anda bisa menggunakan QRIS, Virtual Account Bank (BCA, Mandiri, BNI, BRI), E-Wallet (DANA, OVO, ShopeePay), dan Gerai Retail terdekat (Indomaret, Alfamart).</p>
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

      {/* 3. Bayar Sekarang (Unpaid Transactions) Modal */}
      <AnimatePresence>
        {showUnpaidModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowUnpaidModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} className="relative bg-white dark:bg-card-dark w-[calc(100%-2rem)] md:w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-gray-200 dark:border-gray-800 z-10">
              <div className="p-6 md:p-8 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                <h3 className="font-black text-lg md:text-xl text-gray-900 dark:text-white flex items-center gap-2">
                  <Play className="w-5 h-5 text-primary" /> Transaksi Belum Dibayar
                </h3>
                <button onClick={() => setShowUnpaidModal(false)} title="Tutup" className="p-2 hover:bg-gray-100 rounded-xl transition-all"><X className="w-5 h-5 text-muted" /></button>
              </div>

              <div className="p-6 md:p-8 overflow-y-auto space-y-6 custom-scrollbar flex-1">
                <p className="text-xs md:text-sm text-muted leading-relaxed">
                  Pilih transaksi yang tertunda di bawah ini untuk melanjutkan proses pembayaran secara aman.
                </p>

                {unpaidTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <CheckCircle className="w-16 h-16 text-emerald-500 mb-4 animate-bounce" />
                    <span className="font-extrabold text-base text-text-light dark:text-text-dark">Semua Tagihan Lunas!</span>
                    <span className="text-xs text-muted mt-1.5">Tidak ada transaksi atau isi saldo yang menunggu pembayaran saat ini.</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {unpaidTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        onClick={() => handleUnpaidClick(tx)}
                        className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-850/50 border border-gray-150 dark:border-gray-700/60 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group shadow-sm hover:shadow"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors shrink-0">
                            {tx.type === 'topup' ? (
                              <Wallet className="w-6 h-6 text-primary" />
                            ) : (
                              <ShoppingBag className="w-6 h-6 text-orange-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-black text-text-light dark:text-text-dark">
                                {tx.type === 'topup' ? 'Isi Saldo Dompetku' : 'Pesanan Makanan'}
                              </span>
                              <CountdownTimer
                                createdAt={tx.created_at}
                                expiryMinutes={tx.type === 'topup' ? (settings.topupExpiryMinutes || 15) : (settings.paymentExpiryMinutes || 60)}
                                onExpire={() => fetchWalletData()}
                              />
                            </div>
                            <span className="text-xs text-muted block mt-1 font-medium truncate max-w-full">
                              {tx.description}
                            </span>
                            <span className="text-[10px] font-mono text-muted uppercase mt-0.5 tracking-wider block">
                              ID: #{tx.id.substring(0, 8).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-100 dark:border-gray-700/50 shrink-0">
                          <span className="font-mono font-black text-base text-primary block">
                            Rp {Number(tx.amount).toLocaleString("id-ID")}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs font-black text-white bg-primary px-4 py-2 rounded-xl uppercase tracking-wider sm:mt-2 shadow-md shadow-primary/20 group-hover:bg-primary-hover group-hover:shadow-primary/30 transition-all">
                            Bayar <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. PIN Modal */}
      <AnimatePresence>
        {showPinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPinModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} className="relative bg-white dark:bg-card-dark w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 z-10">
              <div className="p-6 border-b border-gray-150 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" /> {pinType === "create" ? "Buat PIN Keamanan Baru" : "Ubah PIN Keamanan"}
                </h3>
                <button onClick={() => setShowPinModal(false)} title="Tutup" className="p-2 hover:bg-gray-100 rounded-xl transition-all"><X className="w-5 h-5 text-muted" /></button>
              </div>

              <form onSubmit={handlePinSubmit} className="p-6 space-y-4">
                {pinType === "change" && (
                  <div className="space-y-1.5">
                    <label htmlFor="oldPinInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">PIN Transaksi Lama</label>
                    <input
                      id="oldPinInput"
                      type="password"
                      maxLength={6}
                      required
                      value={pinForm.oldPin}
                      onChange={e => setPinForm({ ...pinForm, oldPin: e.target.value.replace(/\D/g, "") })}
                      placeholder="Masukkan 6 digit PIN lama"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary font-mono tracking-widest text-center"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="newPinInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">
                    {pinType === "create" ? "PIN Transaksi Baru (6 Digit)" : "PIN Transaksi Baru"}
                  </label>
                  <input
                    id="newPinInput"
                    type="password"
                    maxLength={6}
                    required
                    value={pinType === "create" ? pinForm.pin : pinForm.newPin}
                    onChange={e => setPinForm(
                      pinType === "create" 
                        ? { ...pinForm, pin: e.target.value.replace(/\D/g, "") }
                        : { ...pinForm, newPin: e.target.value.replace(/\D/g, "") }
                    )}
                    placeholder="Masukkan 6 digit angka"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary font-mono tracking-widest text-center"
                  />
                </div>

                <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                  <label className="text-[10px] font-black uppercase text-muted tracking-widest block">Metode Pengiriman OTP</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPinForm({ ...pinForm, otpChannel: "email" })}
                      className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${
                        pinForm.otpChannel === "email"
                          ? "bg-primary border-primary text-white"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-muted"
                      }`}
                    >
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setPinForm({ ...pinForm, otpChannel: "whatsapp" })}
                      className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${
                        pinForm.otpChannel === "whatsapp"
                          ? "bg-primary border-primary text-white"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-muted"
                      }`}
                    >
                      WhatsApp
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1.5">
                    <label htmlFor="otpInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">Kode OTP Verifikasi</label>
                    <input
                      id="otpInput"
                      type="text"
                      maxLength={6}
                      required
                      value={pinForm.otp}
                      onChange={e => setPinForm({ ...pinForm, otp: e.target.value.replace(/\D/g, "") })}
                      placeholder="6 Digit OTP"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary font-mono text-center font-bold"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={otpLoading || otpTimer > 0}
                    onClick={handleSendOtp}
                    className="px-4 py-3.5 bg-gray-150 hover:bg-gray-250 dark:bg-gray-800 dark:hover:bg-gray-700 text-muted rounded-xl text-xs font-black shrink-0 transition-all uppercase tracking-wider disabled:opacity-50 h-[46px]"
                  >
                    {otpLoading ? "Mengirim..." : otpTimer > 0 ? `Ulangi (${otpTimer}s)` : "Kirim OTP"}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={pinLoading || !pinForm.otp || (pinType === "create" ? !pinForm.pin : !pinForm.newPin)}
                  className="w-full py-4 bg-primary hover:bg-primary-hover text-white font-black rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 disabled:opacity-50 mt-4 uppercase tracking-wider text-xs"
                >
                  {pinLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verifikasi & Simpan PIN"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Forced PIN Reset Modal */}
      <AnimatePresence>
        {wallet.pinResetRequired && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/85 backdrop-blur-xl pointer-events-none" />
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} className="relative bg-white dark:bg-card-dark w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800 z-[101]">
              <div className="p-6 md:p-8 border-b border-gray-150 dark:border-gray-800 bg-emerald-500/5 text-center">
                <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="font-black text-xl text-gray-900 dark:text-white">Banding Dompetku Disetujui!</h3>
                <p className="text-xs text-muted mt-2 leading-relaxed">
                  Permohonan banding Anda telah disetujui. Untuk menjaga keamanan saldo Dompetku Anda dari potensi akses ilegal, <strong>Anda wajib membuat PIN transaksi baru</strong> sebelum dapat bertransaksi kembali.
                </p>
              </div>

              <form onSubmit={handlePinSubmit} className="p-6 md:p-8 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="forcedNewPinInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">Buat PIN Transaksi Baru (6 Digit)</label>
                  <input
                    id="forcedNewPinInput"
                    type="password"
                    maxLength={6}
                    required
                    value={pinForm.pin}
                    onChange={e => setPinForm({ ...pinForm, pin: e.target.value.replace(/\D/g, "") })}
                    placeholder="Masukkan 6 digit angka baru"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary font-mono tracking-widest text-center font-bold"
                  />
                </div>

                <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                  <label className="text-[10px] font-black uppercase text-muted tracking-widest block">Pilih Saluran Kirim OTP</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPinForm({ ...pinForm, otpChannel: "email" })}
                      className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${
                        pinForm.otpChannel === "email"
                          ? "bg-primary border-primary text-white"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-muted"
                      }`}
                    >
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setPinForm({ ...pinForm, otpChannel: "whatsapp" })}
                      className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${
                        pinForm.otpChannel === "whatsapp"
                          ? "bg-primary border-primary text-white"
                          : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-muted"
                      }`}
                    >
                      WhatsApp
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1.5">
                    <label htmlFor="forcedOtpInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">Masukkan Kode OTP</label>
                    <input
                      id="forcedOtpInput"
                      type="text"
                      maxLength={6}
                      required
                      value={pinForm.otp}
                      onChange={e => setPinForm({ ...pinForm, otp: e.target.value.replace(/\D/g, "") })}
                      placeholder="6 Digit OTP"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary font-mono text-center font-bold"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={otpLoading || otpTimer > 0}
                    onClick={handleSendOtp}
                    className="px-4 py-3.5 bg-gray-150 hover:bg-gray-250 dark:bg-gray-800 dark:hover:bg-gray-700 text-muted rounded-xl text-xs font-black shrink-0 transition-all uppercase tracking-wider disabled:opacity-50 h-[46px]"
                  >
                    {otpLoading ? "Mengirim..." : otpTimer > 0 ? `Ulangi (${otpTimer}s)` : "Kirim OTP"}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={pinLoading || !pinForm.otp || !pinForm.pin}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 disabled:opacity-50 mt-4 uppercase tracking-wider text-xs"
                >
                  {pinLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Buat PIN & Aktifkan E-Wallet"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CountdownTimer({ createdAt, expiryMinutes, onExpire }: { createdAt: string; expiryMinutes: number; onExpire: () => void }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const createdTime = new Date(createdAt).getTime();
      const expiryTime = createdTime + expiryMinutes * 60 * 1000;
      const difference = expiryTime - Date.now();
      return difference > 0 ? Math.floor(difference / 1000) : 0;
    };

    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [createdAt, expiryMinutes]);

  if (timeLeft <= 0) {
    return <span className="text-[9px] text-rose-500 font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900">Waktu habis</span>;
  }

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  const pad = (num: number) => String(num).padStart(2, "0");

  return (
    <span className="text-[9px] text-amber-600 dark:text-amber-400 font-extrabold font-mono bg-amber-50 dark:bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900 animate-pulse inline-flex items-center gap-1">
      <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" /> {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}
