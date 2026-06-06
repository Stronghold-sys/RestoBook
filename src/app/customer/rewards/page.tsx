"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Gift, Trophy, Award, Calendar, AlertCircle, Clock, 
  CheckCircle, HelpCircle, RefreshCw, Loader2, ArrowRight,
  Sparkles, Wallet, Ticket, ShoppingBag, CreditCard, ChevronRight, Truck
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import { createClient } from "@/lib/supabase/client";
import BaseModal from "@/components/BaseModal";

export default function CustomerRewardsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<any>({
    points: 0,
    pending_points: 0,
    points_used: 0,
    is_redeem_blocked: false,
    wallet_balance: 0,
    points_status: "aktif"
  });
  const [rewards, setRewards] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"catalog" | "history" | "my-rewards">("catalog");
  const [confirmReward, setConfirmReward] = useState<any>(null);
  const [tick, setTick] = useState(0);

  const supabase = createClient();

  useEffect(() => {
    fetchPointData();

    // Subscribe to realtime changes in point transactions and reward redemptions
    const channel = supabase
      .channel("customer-points-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "point_transactions" }, () => {
        fetchPointData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_redemptions" }, () => {
        fetchPointData();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        fetchPointData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rewards" }, () => {
        fetchPointData();
      })
      .subscribe();

    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchPointData = async () => {
    setLoading(true);
    try {
      // 1. Fetch points and transactions
      const resPoints = await fetch("/api/customer/points");
      const dataPoints = await resPoints.json();
      if (!resPoints.ok) throw new Error(dataPoints.error || "Gagal memuat poin");
      setProfile(dataPoints.profile);
      setTransactions(dataPoints.transactions || []);

      // 2. Fetch rewards
      const resRewards = await fetch("/api/customer/rewards");
      const dataRewards = await resRewards.json();
      if (!resRewards.ok) throw new Error(dataRewards.error || "Gagal memuat reward");
      setRewards(dataRewards.rewards || []);
      setRedemptions(dataRewards.redemptions || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const checkRedemptionLimit = (reward: any) => {
    if (!reward.redeem_limit || reward.redeem_limit <= 0) {
      return { exceeded: false, count: 0, limit: 0, period: "all", message: "" };
    }

    const limit = reward.redeem_limit;
    const limitValue = reward.redeem_limit_value || 1;
    const period = reward.redeem_limit_period || "all";

    // Filter redemptions for this reward that are not cancelled and not freed from quota
    const rewardRedemptions = redemptions.filter(
      (r) => r.reward_id === reward.id && r.status !== "cancelled" && !r.is_quota_freed
    );

    const now = new Date();
    let activeRedemptions = rewardRedemptions;

    if (period !== "all") {
      let offsetMs = 0;
      if (period === "minute") {
        offsetMs = limitValue * 60 * 1000;
      } else if (period === "hour") {
        offsetMs = limitValue * 60 * 60 * 1000;
      } else if (period === "day") {
        offsetMs = limitValue * 24 * 60 * 60 * 1000;
      } else if (period === "week") {
        offsetMs = limitValue * 7 * 24 * 60 * 60 * 1000;
      } else if (period === "month") {
        const boundary = new Date(now);
        boundary.setMonth(boundary.getMonth() - limitValue);
        activeRedemptions = rewardRedemptions.filter((r) => {
          const d = new Date(r.created_at);
          return d >= boundary;
        });
      }

      if (period !== "month") {
        const boundaryTime = now.getTime() - offsetMs;
        activeRedemptions = rewardRedemptions.filter((r) => {
          const d = new Date(r.created_at).getTime();
          return d >= boundaryTime;
        });
      }
    }

    const count = activeRedemptions.length;
    const exceeded = count >= limit;

    let periodLabel = "";
    if (period === "minute") periodLabel = "menit";
    else if (period === "hour") periodLabel = "jam";
    else if (period === "day") periodLabel = "hari";
    else if (period === "week") periodLabel = "minggu";
    else if (period === "month") periodLabel = "bulan";

    let message = "";
    if (exceeded) {
      if (period === "all") {
        message = "Kuota penukaran penuh. Reward ini tidak dapat ditukarkan lagi.";
      } else {
        message = "Kuota penukaran penuh. Dapat ditukar kembali pada periode berikutnya.";
      }
    }

    return { exceeded, count, limit, period, message, limitValue, periodLabel };
  };

  const getQuotaResetCountdown = (reward: any) => {
    if (!reward.redeem_limit || reward.redeem_limit <= 0) return null;
    const limit = reward.redeem_limit;
    const limitValue = reward.redeem_limit_value || 1;
    const period = reward.redeem_limit_period || "all";
    if (period === "all") return null;

    const rewardRedemptions = redemptions.filter(
      (r) => r.reward_id === reward.id && r.status !== "cancelled" && !r.is_quota_freed
    );

    const now = new Date();
    let activeRedemptions = rewardRedemptions;

    let offsetMs = 0;
    if (period === "minute") offsetMs = limitValue * 60 * 1000;
    else if (period === "hour") offsetMs = limitValue * 60 * 60 * 1000;
    else if (period === "day") offsetMs = limitValue * 24 * 60 * 60 * 1000;
    else if (period === "week") offsetMs = limitValue * 7 * 24 * 60 * 60 * 1000;
    else if (period === "month") {
      const boundary = new Date(now);
      boundary.setMonth(boundary.getMonth() - limitValue);
      activeRedemptions = rewardRedemptions.filter((r) => new Date(r.created_at) >= boundary);
    }

    if (period !== "month") {
      const boundaryTime = now.getTime() - offsetMs;
      activeRedemptions = rewardRedemptions.filter((r) => new Date(r.created_at).getTime() >= boundaryTime);
    }

    if (activeRedemptions.length < limit) return null;

    activeRedemptions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const targetRedemption = activeRedemptions[activeRedemptions.length - limit];
    if (!targetRedemption) return null;

    let resetTime = 0;
    if (period === "month") {
      const dateObj = new Date(targetRedemption.created_at);
      dateObj.setMonth(dateObj.getMonth() + limitValue);
      resetTime = dateObj.getTime();
    } else {
      resetTime = new Date(targetRedemption.created_at).getTime() + offsetMs;
    }

    const diff = resetTime - now.getTime();
    if (diff <= 0) return null;

    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const pad = (num: number) => String(num).padStart(2, "0");

    if (days > 0) {
      return `${days} hari ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const handleRedeemClick = (reward: any) => {
    if (profile.is_redeem_blocked) {
      toast.error("Akses penukaran poin Anda sedang diblokir oleh admin.");
      return;
    }
    const limitCheck = checkRedemptionLimit(reward);
    if (limitCheck.exceeded) {
      toast.error(limitCheck.message);
      return;
    }
    if (profile.points < reward.min_points) {
      toast.error("Poin Anda tidak mencukupi!");
      return;
    }
    if (reward.stock !== null && reward.stock <= 0) {
      toast.error("Stok reward telah habis!");
      return;
    }
    setConfirmReward(reward);
  };

  const handleConfirmRedeem = async () => {
    if (!confirmReward || submitting) return;
    setSubmitting(true);
    const loadingToast = toast.loading("Memproses penukaran reward...");
    try {
      const res = await fetch("/api/customer/rewards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: confirmReward.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menukarkan reward");

      // Trigger Confetti Effect!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#ff5722", "#059669", "#3b82f6", "#eab308"]
      });

      toast.success(data.message || "Berhasil menukarkan reward!", { id: loadingToast });
      setConfirmReward(null);
      fetchPointData();
      
      // Auto switch to my rewards tab if it is a voucher
      if (confirmReward.category === "voucher") {
        setActiveTab("my-rewards");
      }
    } catch (error: any) {
      toast.error(error.message, { id: loadingToast });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimCashback = async (redemptionId: string) => {
    if (submitting) return;

    // Find category for custom label
    const red = redemptions.find(r => r.id === redemptionId);
    const category = red?.rewards?.category || 'custom';
    const actionLabel = category === 'cashback' ? "mengklaim cashback" : "mengaktifkan reward";

    setSubmitting(true);
    const loadingToast = toast.loading(`Sedang ${actionLabel}...`);
    try {
      const res = await fetch("/api/customer/rewards/claim-cashback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ redemptionId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Gagal ${actionLabel}`);

      toast.success(data.message || "Reward berhasil diaktifkan!", { id: loadingToast });
      
      // Refresh data
      fetchPointData();
      
      // Trigger Confetti
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.85 }
      });
    } catch (error: any) {
      toast.error(error.message, { id: loadingToast });
    } finally {
      setSubmitting(false);
    }
  };

  const getRewardIcon = (category: string) => {
    switch (category) {
      case "voucher": return <Ticket className="w-6 h-6 text-orange-500" />;
      case "food": return <Sparkles className="w-6 h-6 text-amber-500" />;
      case "cashback": return <Wallet className="w-6 h-6 text-emerald-500" />;
      case "product": return <ShoppingBag className="w-6 h-6 text-blue-500" />;
      case "shipping": return <Truck className="w-6 h-6 text-cyan-500" />;
      default: return <Gift className="w-6 h-6 text-purple-500" />;
    }
  };

  const getSourceLabel = (sourceType: string, description: string) => {
    if (sourceType === 'order') return 'dari order';
    if (sourceType === 'reward') return 'dari reward';
    if (sourceType === 'refund') return 'dari refund';
    if (sourceType === 'pembatalan') return 'dari pembatalan';
    if (sourceType === 'manual') return 'dari admin';
    if (sourceType === 'sistem') return 'dari promo';
    
    const desc = (description || '').toLowerCase();
    if (desc.includes('order') || desc.includes('pesanan')) return 'dari order';
    if (desc.includes('reward') || desc.includes('voucher') || desc.includes('tukar')) return 'dari reward';
    if (desc.includes('refund') || desc.includes('kembali')) return 'dari refund';
    if (desc.includes('batal') || desc.includes('cancel')) return 'dari pembatalan';
    if (desc.includes('admin') || desc.includes('manual')) return 'dari admin';
    if (desc.includes('welcome') || desc.includes('promo')) return 'dari promo';
    
    return 'dari sistem';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
      case "diproses":
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-yellow-50 text-yellow-600 border border-yellow-100 uppercase animate-pulse whitespace-nowrap">Pending</span>;
      case "earned":
      case "manual_earned":
      case "aktif":
      case "selesai":
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase whitespace-nowrap">Selesai</span>;
      case "redeemed":
      case "manual_redeemed":
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-rose-50 text-rose-600 border border-rose-100 uppercase whitespace-nowrap">Redeem</span>;
      case "cancelled":
      case "dibatalkan":
      case "ditolak":
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-red-50 text-red-600 border border-red-200 uppercase whitespace-nowrap">Batal</span>;
      case "koreksi":
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-orange-50 text-orange-600 border border-orange-200 uppercase whitespace-nowrap">Koreksi</span>;
      case "reset":
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-gray-100 text-gray-500 border border-gray-200 uppercase whitespace-nowrap">Reset</span>;
      case "refunded":
      case "returned":
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-blue-50 text-blue-600 border border-blue-100 uppercase whitespace-nowrap">Dikembalikan</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-gray-50 text-gray-450 border border-gray-100 uppercase whitespace-nowrap">{status}</span>;
    }
  };

  const activeRedemptions = redemptions.filter(red => {
    if (red.status === 'used') {
      if (red.rewards?.category === 'cashback' && red.used_at) {
        const elapsedMs = Date.now() - new Date(red.used_at).getTime();
        return elapsedMs < 60 * 1000;
      }
      return false;
    }
    if (red.status === 'expired') return false;
    if (red.status === 'cancelled') return false;
    if (red.expires_at && new Date(red.expires_at).getTime() <= Date.now()) {
      return false;
    }
    return true;
  });

  const usedRedemptions = redemptions.filter(red => {
    if (red.status === 'expired') return true;
    if (red.status !== 'used' && red.expires_at && new Date(red.expires_at).getTime() <= Date.now()) {
      return true;
    }
    if (red.status === 'used') {
      if (red.rewards?.category === 'cashback') {
        if (!red.used_at) return true;
        const elapsedMs = Date.now() - new Date(red.used_at).getTime();
        return elapsedMs >= 60 * 1000;
      }
      return true;
    }
    return false;
  });
  const getCountdownString = (expiresAtStr: string) => {
    if (!expiresAtStr) return null;
    const expiresAt = new Date(expiresAtStr).getTime();
    const now = Date.now();
    const diff = expiresAt - now;

    if (diff <= 0) {
      return "EXPIRED";
    }

    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const pad = (num: number) => String(num).padStart(2, "0");

    if (days > 0) {
      return `${days} hari ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const getWibExpiryString = (expiresAtStr: string) => {
    if (!expiresAtStr) return "";
    const date = new Date(expiresAtStr);
    return format(date, "EEEE, dd MMMM yyyy 'pukul' HH:mm", { locale: id }) + " WIB";
  };

  const cancelledPointsTotal = transactions
    .filter(tx => ['cancelled', 'dibatalkan', 'ditolak'].includes(tx.status))
    .reduce((sum, tx) => sum + Math.abs(tx.points), 0);

  const getPointsStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending Verifikasi';
      case 'diblokir': return 'Diblokir';
      case 'dibatasi': return 'Dibatasi';
      case 'nonaktif_sementara': return 'Nonaktif Sementara';
      default: return 'Aktif';
    }
  };

  const getPointsStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-250';
      case 'diblokir': return 'bg-red-100 text-red-800 border-red-250';
      case 'dibatasi': return 'bg-orange-100 text-orange-850 border-orange-250';
      case 'nonaktif_sementara': return 'bg-gray-100 text-gray-800 border-gray-250';
      default: return 'bg-emerald-100 text-emerald-800 border-emerald-250';
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-3">
            <Trophy className="w-8 h-8 text-orange-500" /> Reward & Point
          </h1>
          <p className="text-muted text-sm mt-1">
            Kumpulkan poin dari setiap pesanan dan tukarkan dengan berbagai penawaran premium.
          </p>
        </div>
        <button
          onClick={fetchPointData}
          disabled={loading}
          className="flex items-center gap-2 self-start sm:self-center px-4 py-2 text-sm font-bold bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl text-muted hover:text-primary transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
          <span>Memuat data poin & reward Anda...</span>
        </div>
      ) : (
        <>
          {/* Status Alert Banner */}
          {profile.points_status !== 'aktif' && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-3xl text-xs text-red-800 dark:text-red-400 font-bold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <span className="font-extrabold uppercase block text-[10px] tracking-wider mb-0.5">Pemberitahuan Status Poin</span>
                {profile.points_status === 'diblokir' && "Akses penukaran poin Anda saat ini ditangguhkan/diblokir oleh admin. Hubungi admin untuk bantuan."}
                {profile.points_status === 'dibatasi' && "Akses penukaran poin Anda sedang dibatasi oleh admin. Beberapa penukaran reward mungkin dinonaktifkan sementara."}
                {profile.points_status === 'nonaktif_sementara' && "Penggunaan poin Anda dinonaktifkan sementara oleh admin."}
                {profile.points_status === 'pending' && "Akun poin Anda dalam status peninjauan pending."}
              </div>
            </div>
          )}

          {/* Hero Point Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden bg-gradient-to-br from-primary to-orange-600 rounded-[2rem] p-6 text-white shadow-xl shadow-primary/20 flex flex-col justify-between min-h-[160px]"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start z-10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Poin Aktif Saya</p>
                  <h2 className="text-4xl font-black mt-1 font-mono tracking-tight">{profile.points} <span className="text-xs font-bold text-white/90">Poin</span></h2>
                </div>
                <div className="bg-white/20 p-2.5 rounded-2xl">
                  <Award className="w-5 h-5 text-yellow-300" />
                </div>
              </div>
              <div className="border-t border-white/20 pt-3 mt-4 flex flex-col gap-1.5 z-10 text-xs text-white/90">
                <span className="font-bold flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5 text-emerald-300" />
                  Wallet: Rp {profile.wallet_balance.toLocaleString("id-ID")}
                </span>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${getPointsStatusColor(profile.points_status)}`}>
                    Status: {getPointsStatusLabel(profile.points_status)}
                  </span>
                  {profile.is_redeem_blocked && (
                    <span className="bg-red-650 px-2 py-0.5 rounded font-black text-[8px] uppercase tracking-wider">BLOCK</span>
                  )}
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 shadow-sm flex flex-col justify-between min-h-[160px]"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Point Pending</p>
                <h3 className="text-3xl font-black mt-2 font-mono text-amber-500">{profile.pending_points}</h3>
              </div>
              <p className="text-[9px] text-muted leading-tight mt-4">
                Poin ditahan sementara dan akan aktif setelah transaksi diselesaikan.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 shadow-sm flex flex-col justify-between min-h-[160px]"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Total Poin Terpakai</p>
                <h3 className="text-3xl font-black mt-2 font-mono text-primary">{profile.points_used}</h3>
              </div>
              <p className="text-[9px] text-muted leading-tight mt-4">
                Jumlah poin yang telah dibelanjakan untuk klaim voucher/reward.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 shadow-sm flex flex-col justify-between min-h-[160px]"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Poin Dibatalkan</p>
                <h3 className="text-3xl font-black mt-2 font-mono text-red-500">{cancelledPointsTotal}</h3>
              </div>
              <p className="text-[9px] text-muted leading-tight mt-4">
                Jumlah poin dari order yang dibatalkan atau pengembalian dana.
              </p>
            </motion.div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-border-light dark:border-border-dark">
            <button
              onClick={() => setActiveTab("catalog")}
              className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                activeTab === "catalog"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-text-light dark:hover:text-text-dark"
              }`}
            >
              Katalog Reward ({rewards.length})
            </button>
            <button
              onClick={() => setActiveTab("my-rewards")}
              className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                activeTab === "my-rewards"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-text-light dark:hover:text-text-dark"
              }`}
            >
              Reward Saya ({activeRedemptions.length})
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                activeTab === "history"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-text-light dark:hover:text-text-dark"
              }`}
            >
              Riwayat Poin ({transactions.length})
            </button>
          </div>

          {/* Content Tab Zone */}
          <div className="space-y-6">
            {activeTab === "catalog" ? (
              rewards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted text-center bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-8">
                  <Gift className="w-12 h-12 text-muted/30 mb-3" />
                  <span className="font-bold text-lg text-text-light dark:text-text-dark">Katalog Reward Kosong</span>
                  <span className="text-xs mt-1 max-w-sm">
                    Admin belum mengaktifkan penawaran reward poin saat ini. Hubungi kasir untuk info program loyalitas pelanggan!
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {rewards
                    .filter(reward => !reward.expires_at || new Date(reward.expires_at).getTime() > Date.now())
                    .map((reward) => {
                    const isPointsEnough = profile.points >= reward.min_points;
                    const isOutOfStock = reward.stock !== null && reward.stock <= 0;
                    const diffPoints = reward.min_points - profile.points;
                    const progressPercent = Math.min(100, Math.round((profile.points / reward.min_points) * 100));
                    const limitCheck = checkRedemptionLimit(reward);

                    return (
                      <motion.div
                        key={reward.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group overflow-hidden relative"
                      >
                        {/* Ticket notches decoration */}
                        <div className="absolute top-1/2 -left-3 w-6 h-6 rounded-full bg-background-light dark:bg-background-dark border-r border-border-light dark:border-border-dark -translate-y-1/2 z-10" />
                        <div className="absolute top-1/2 -right-3 w-6 h-6 rounded-full bg-background-light dark:bg-background-dark border-l border-border-light dark:border-border-dark -translate-y-1/2 z-10" />

                        <div className="space-y-4">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-primary/5 p-3 rounded-2xl group-hover:scale-105 transition-transform shrink-0">
                                {getRewardIcon(reward.category)}
                              </div>
                              <div>
                                <h3 className="font-bold text-lg text-text-light dark:text-text-dark line-clamp-1">{reward.title}</h3>
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-muted font-black uppercase tracking-wider">{reward.category}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-2xl font-black text-primary font-mono">{reward.min_points}</span>
                              <span className="block text-[9px] font-bold text-muted uppercase">Poin</span>
                            </div>
                          </div>

                          <p className="text-xs text-muted leading-relaxed pl-1.5 border-l-2 border-primary/20">
                            {reward.description || "Tukarkan poin Anda dengan reward istimewa ini."}
                          </p>

                          {/* Progress bar towards reward */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-bold text-muted">
                              <span>Progress Pencapaian</span>
                              <span>{progressPercent}%</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-primary h-full rounded-full transition-all duration-500" 
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 border-t border-border-light dark:border-border-dark pt-4 space-y-2">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex flex-col gap-0.5">
                              {reward.expires_at && (
                                <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 flex flex-wrap items-center gap-1">
                                  <span>Dapat ditukar s.d: {format(new Date(reward.expires_at), "dd MMM yyyy, HH:mm", { locale: id })} WIB</span>
                                  {getCountdownString(reward.expires_at) && getCountdownString(reward.expires_at) !== "EXPIRED" && (
                                    <span className="text-rose-500 font-black animate-pulse">
                                      (Selesai dalam: {getCountdownString(reward.expires_at)})
                                    </span>
                                  )}
                                </span>
                              )}
                              {reward.redeem_limit !== null && reward.redeem_limit > 0 && (
                                <span className="text-[10px] font-extrabold text-primary">
                                  Sisa penukaran: {limitCheck.count}/{limitCheck.limit}
                                </span>
                              )}
                            </div>

                            {isOutOfStock ? (
                              <button
                                disabled
                                className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-xs font-black uppercase tracking-wider border border-border-light dark:border-border-dark cursor-not-allowed shrink-0"
                              >
                                Stok Habis
                              </button>
                            ) : limitCheck.exceeded ? (
                              <button
                                disabled
                                className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-xs font-black uppercase tracking-wider border border-border-light dark:border-border-dark cursor-not-allowed shrink-0"
                              >
                                Kuota Habis
                              </button>
                            ) : !isPointsEnough ? (
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <button
                                  disabled
                                  className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-xs font-black uppercase tracking-wider border border-border-light dark:border-border-dark cursor-not-allowed"
                                >
                                  Poin Kurang
                                </button>
                                <span className="text-[9px] font-black text-rose-500 uppercase tracking-wide">Kurang {diffPoints} poin lagi</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleRedeemClick(reward)}
                                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-1.5 shrink-0"
                              >
                                Redeem <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {limitCheck.exceeded && limitCheck.message && (
                            <div className="text-[10px] font-extrabold text-rose-650 dark:text-rose-400 animate-pulse bg-rose-50/50 dark:bg-rose-950/10 border border-rose-200/20 rounded-xl p-2.5 leading-relaxed text-left space-y-1">
                              <div>{limitCheck.message}</div>
                              {getQuotaResetCountdown(reward) && (
                                <div className="text-primary font-black mt-1 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 animate-spin" />
                                  <span>Dapat ditukar kembali dalam: {getQuotaResetCountdown(reward)}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )
            ) : activeTab === "my-rewards" ? (
              <div className="space-y-8">
                {/* Reward Aktif */}
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-text-light dark:text-text-dark uppercase tracking-tight flex items-center gap-2">
                    <Gift className="w-5 h-5 text-primary" /> Reward Aktif Saya
                  </h3>
                  {activeRedemptions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted text-center bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-8 shadow-sm">
                      <Award className="w-10 h-10 text-muted/30 mb-3" />
                      <span className="font-bold text-sm text-text-light dark:text-text-dark">Belum Ada Penukaran Aktif</span>
                      <span className="text-xs mt-1 max-w-sm">
                        Anda tidak memiliki reward aktif yang belum digunakan saat ini. Silakan tukarkan poin Anda di tab Katalog Reward.
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {activeRedemptions.map((red) => {
                        const isUsed = red.status === "used";
                        const category = red.rewards?.category || "custom";
                        const cashbackVal = Number(red.cashback_amount !== null && red.cashback_amount !== undefined ? red.cashback_amount : (red.rewards?.cashback_amount || 0));

                        const countdownText = getCountdownString(red.expires_at);
                        const isExpired = countdownText === "EXPIRED";

                        return (
                          <motion.div
                            key={red.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 p-3">
                              <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded ${
                                red.is_blocked
                                  ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200/40 animate-pulse"
                                  : isUsed 
                                    ? "bg-gray-100 text-gray-500 border border-gray-200" 
                                    : isExpired
                                      ? "bg-rose-100/50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-450 border border-rose-200/20"
                                      : "bg-emerald-100/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/20"
                              }`}>
                                {red.is_blocked ? "Diblokir oleh Admin" : isUsed ? "Telah Digunakan" : isExpired ? "Kadaluarsa" : "Belum Aktif"}
                              </span>
                            </div>

                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="bg-primary/5 p-3 rounded-2xl shrink-0">
                                  {getRewardIcon(category)}
                                </div>
                                <div>
                                  <h3 className={`font-bold text-lg text-text-light dark:text-text-dark ${isUsed ? "line-through text-muted" : ""}`}>
                                    {red.rewards?.title || "Reward Dihapus"}
                                  </h3>
                                  <p className="text-[10px] text-muted font-medium">Ditukar: {format(new Date(red.created_at), "dd MMM yyyy, HH:mm", { locale: id })} WIB</p>
                                </div>
                              </div>

                              {/* JIKA REWARD TELAH DIGUNAKAN (Masa tenggang 1 menit) */}
                              {isUsed && (
                                <div className="space-y-2">
                                  {category === "cashback" ? (
                                    <div className="p-4 bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/50 rounded-2xl text-xs text-green-800 dark:text-green-400 font-bold flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400" />
                                      Dana cashback sebesar Rp {cashbackVal.toLocaleString("id-ID")} telah dikreditkan ke Saldo Dompet Anda.
                                    </div>
                                  ) : category === "voucher" || category === "food" || category === "shipping" ? (
                                    <div className="space-y-2">
                                      <div className="p-4 bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/50 rounded-2xl text-xs text-green-800 dark:text-green-400 font-bold flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400" />
                                        Voucher {red.rewards?.title} telah berhasil diaktifkan!
                                      </div>
                                      {red.code && (
                                        <div className="bg-gray-50 dark:bg-gray-800/40 border border-border-light/50 dark:border-border-dark/50 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                                          <div>
                                            <span className="text-[9px] font-black text-muted uppercase block">Kode Voucher Penukaran</span>
                                            <span className="font-mono font-black text-primary text-lg uppercase tracking-wide">{red.code}</span>
                                          </div>
                                          <span className="px-3.5 py-2 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 font-extrabold text-xs rounded-xl border border-green-200/50 dark:border-green-900/30 uppercase tracking-wide text-center shrink-0">
                                            Tersimpan di Menu Voucher Saya
                                          </span>
                                        </div>
                                      )}
                                      {category === 'food' && (
                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold leading-relaxed bg-emerald-50/50 dark:bg-emerald-950/10 p-2.5 rounded-xl border border-emerald-100/20">
                                          *Gunakan voucher diskon 100% ini pada halaman pembayaran untuk memesan makanan/minuman secara gratis (Maksimal 5 item, sudah termasuk pajak).
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="p-3 bg-green-50 dark:bg-green-950/10 border border-green-100 dark:border-green-800 rounded-2xl text-xs text-green-800 dark:text-green-400 font-bold flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4 shrink-0 text-green-600 dark:text-green-400" />
                                      Reward {red.rewards?.title} telah sukses diaktifkan dan digunakan.
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* JIKA REWARD BELUM AKTIF (Menampilkan tombol Gunakan) */}
                              {!isUsed && (
                                <div className="space-y-3">
                                  {/* Info Masa Berlaku & Countdown */}
                                  {red.expires_at && (
                                    <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed font-bold ${
                                      isExpired 
                                        ? "bg-rose-50 dark:bg-rose-950/10 border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-455"
                                        : "bg-amber-50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-400"
                                    }`}>
                                      <div className="flex items-center gap-2 mb-1.5">
                                        <Clock className={`w-4 h-4 ${isExpired ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"}`} />
                                        <span className="font-extrabold uppercase tracking-wide">
                                          {isExpired ? "Telah Kadaluarsa" : `Sisa Waktu: ${countdownText}`}
                                        </span>
                                      </div>
                                      <p className="text-[11px] opacity-90">
                                        Berlaku hingga: <span className="font-extrabold">{getWibExpiryString(red.expires_at)}</span>
                                      </p>
                                      <p className="text-[11px] mt-1.5 font-extrabold flex items-center gap-1.5">
                                        {isExpired ? (
                                          <>
                                            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                                            <span>Reward ini telah kadaluarsa dan tidak dapat digunakan lagi.</span>
                                          </>
                                        ) : (
                                          <>
                                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                                            <span>Peringatan: Silakan gunakan reward ini sebelum batas waktu berakhir!</span>
                                          </>
                                        )}
                                      </p>
                                    </div>
                                  )}

                                  {/* Panduan Penggunaan (Hanya jika belum kadaluarsa) */}
                                  {!isExpired && (
                                    <>
                                      {red.is_blocked ? (
                                        <div className="p-3.5 bg-red-50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/50 rounded-2xl text-xs text-red-800 dark:text-red-400 font-bold leading-relaxed flex flex-col gap-1">
                                          <div className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            <span className="font-extrabold uppercase tracking-wide">Reward ini diblokir</span>
                                          </div>
                                          <span>Alasan: {red.block_reason || "Tidak ada alasan spesifik."}</span>
                                        </div>
                                      ) : category === "cashback" ? (
                                        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs text-amber-800 dark:text-amber-400 font-bold leading-relaxed">
                                          Dana cashback sebesar Rp {cashbackVal.toLocaleString("id-ID")} siap untuk diklaim ke Saldo Dompet Anda. Silakan klik tombol di bawah untuk menggunakan.
                                        </div>
                                      ) : category === "voucher" || category === "food" || category === "shipping" ? (
                                        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs text-amber-800 dark:text-amber-400 font-bold leading-relaxed">
                                          Voucher &ldquo;{red.rewards?.title}&rdquo; siap untuk diaktifkan dan dimasukkan ke menu Voucher Saya Anda. Silakan klik tombol di bawah untuk menggunakan.
                                        </div>
                                      ) : (
                                        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/50 rounded-2xl text-xs text-amber-800 dark:text-amber-400 font-bold leading-relaxed">
                                          Reward &ldquo;{red.rewards?.title}&rdquo; siap untuk diaktifkan. Silakan tunjukkan ke kasir/pelayan atau klik tombol di bawah untuk mengaktifkan.
                                        </div>
                                      )}
                                    </>
                                  )}

                                  {/* Tombol Gunakan (Disabled jika kadaluarsa) */}
                                  {category === "cashback" ? (
                                    <button
                                      onClick={() => handleClaimCashback(red.id)}
                                      disabled={submitting || isExpired}
                                      className={`w-full py-3 text-white font-black text-xs rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                                        isExpired 
                                          ? "bg-gray-250 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-300/30"
                                          : "bg-primary hover:bg-primary-hover shadow-lg shadow-primary/20"
                                      }`}
                                    >
                                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isExpired ? "Cashback Kadaluarsa" : <><Wallet className="w-4 h-4" /> Gunakan Cashback</>}
                                    </button>
                                  ) : category === "voucher" || category === "food" || category === "shipping" ? (
                                    <button
                                      onClick={() => handleClaimCashback(red.id)}
                                      disabled={submitting || isExpired}
                                      className={`w-full py-3 text-white font-black text-xs rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                                        isExpired 
                                          ? "bg-gray-250 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-300/30"
                                          : "bg-primary hover:bg-primary-hover shadow-lg shadow-primary/20"
                                      }`}
                                    >
                                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isExpired ? "Voucher Kadaluarsa" : <><Ticket className="w-4 h-4" /> Gunakan Reward</>}
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleClaimCashback(red.id)}
                                      disabled={submitting || isExpired}
                                      className={`w-full py-3 text-white font-black text-xs rounded-xl transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                                        isExpired 
                                          ? "bg-gray-250 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed border border-gray-300/30"
                                          : "bg-primary hover:bg-primary-hover shadow-lg shadow-primary/20"
                                      }`}
                                    >
                                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isExpired ? "Reward Kadaluarsa" : <><Gift className="w-4 h-4" /> Gunakan Reward</>}
                                    </button>
                                  )}
                                </div>
                              )}

                            </div>

                            <div className="mt-4 pt-3 border-t border-border-light dark:border-border-dark flex justify-between items-center text-[10px] text-muted">
                              <span>Penukaran ID: #{red.id.substring(0, 8).toUpperCase()}</span>
                              <span className="font-bold">Biaya: {red.points_spent} Poin</span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Riwayat Reward yang Telah Digunakan */}
                <div className="space-y-4 pt-6 border-t border-border-light dark:border-border-dark">
                  <h3 className="text-lg font-black text-text-light dark:text-text-dark uppercase tracking-tight flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted" /> Riwayat Reward yang Telah Digunakan
                  </h3>
                  {usedRedemptions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted text-center bg-card-light/50 dark:bg-card-dark/50 border border-border-light/50 dark:border-border-dark/50 rounded-3xl p-8">
                      <Gift className="w-10 h-10 text-muted/30 mb-3" />
                      <span className="font-bold text-sm text-text-light dark:text-text-dark">Belum Ada Riwayat Reward</span>
                      <span className="text-xs mt-1">Belum ada reward voucher yang telah digunakan pada pesanan Anda.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {usedRedemptions.map((red) => {
                        const category = red.rewards?.category || "custom";
                        const cashbackVal = Number(red.cashback_amount !== null && red.cashback_amount !== undefined ? red.cashback_amount : (red.rewards?.cashback_amount || 0));
                        const isExpired = red.status === "expired" || (red.status !== "used" && red.expires_at && new Date(red.expires_at).getTime() <= Date.now());

                        return (
                          <div
                            key={red.id}
                            className="bg-card-light/50 dark:bg-card-dark/50 border border-border-light/50 dark:border-border-dark/50 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden"
                          >
                            <div className="absolute top-0 right-0 p-3">
                              <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded ${
                                isExpired
                                  ? "bg-rose-100/50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-455 border border-rose-200/20"
                                  : "bg-gray-100 text-gray-500 border border-gray-200"
                              }`}>
                                {isExpired ? "Kadaluarsa (Belum Digunakan)" : "Telah Digunakan"}
                              </span>
                            </div>

                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="bg-primary/5 p-3 rounded-2xl shrink-0 opacity-60">
                                  {getRewardIcon(category)}
                                </div>
                                <div>
                                  <h3 className="font-bold text-base text-muted line-through">{red.rewards?.title || "Reward Dihapus"}</h3>
                                  <p className="text-[9px] text-muted">Ditukar: {format(new Date(red.created_at), "dd MMM yyyy, HH:mm", { locale: id })} WIB</p>
                                </div>
                              </div>

                              {isExpired ? (
                                <div className="bg-rose-50/30 dark:bg-rose-950/10 border border-rose-200/30 dark:border-rose-900/30 rounded-2xl p-3 text-xs text-rose-750 dark:text-rose-400 font-bold leading-relaxed flex flex-col gap-1">
                                  <span>
                                    Voucher/Reward &ldquo;{red.rewards?.title || "Reward"}&rdquo; telah kadaluarsa dan tidak dapat digunakan lagi.
                                  </span>
                                  {red.expires_at && (
                                    <span className="text-[10px] opacity-80 font-normal block">
                                      Tanggal Kadaluarsa: {getWibExpiryString(red.expires_at)}
                                    </span>
                                  )}
                                </div>
                              ) : category === "cashback" ? (
                                <div className="bg-green-50/30 dark:bg-green-950/10 border border-green-200/30 dark:border-green-900/30 rounded-2xl p-3 text-xs text-green-750 dark:text-green-400 font-bold leading-relaxed">
                                  Dana cashback sebesar Rp {cashbackVal.toLocaleString("id-ID")} telah berhasil diklaim dan dikreditkan ke Saldo Dompet Anda.
                                </div>
                              ) : category === "voucher" || category === "food" || category === "shipping" ? (
                                <div className="space-y-2">
                                  {red.code && (
                                    <div className="bg-gray-50/50 dark:bg-gray-800/20 border border-border-light/30 dark:border-border-dark/30 rounded-2xl p-3">
                                      <span className="text-[9px] font-black text-muted uppercase block">Kode Voucher</span>
                                      <span className="font-mono font-black text-muted text-sm uppercase tracking-wide line-through">{red.code}</span>
                                    </div>
                                  )}
                                  <div className="p-3 bg-gray-50/50 dark:bg-gray-800/20 border border-border-light/30 dark:border-border-dark/30 rounded-2xl text-[10px] text-green-600 dark:text-green-400 font-bold leading-relaxed">
                                    Voucher ini telah berhasil diaktifkan{red.code ? ` dengan kode ${red.code}` : ""} dan tersimpan di menu Voucher Saya untuk transaksi Anda.
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-gray-50/50 dark:bg-gray-800/20 border border-border-light/30 dark:border-border-dark/30 rounded-2xl p-3 text-xs text-muted font-bold leading-relaxed">
                                  Reward ini telah sukses diaktifkan dan digunakan.
                                </div>
                              )}
                            </div>

                            <div className="mt-4 pt-3 border-t border-border-light/30 dark:border-border-dark/30 flex justify-between items-center text-[9px] text-muted">
                              <span>Penukaran ID: #{red.id.substring(0, 8).toUpperCase()}</span>
                              <span>Biaya: {red.points_spent} Poin</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* 1. Riwayat Transaksi Poin */}
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-text-light dark:text-text-dark uppercase tracking-tight">Riwayat Transaksi Poin</h3>
                  {transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted text-center bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-8">
                      <Clock className="w-10 h-10 text-muted/30 mb-3" />
                      <span className="font-bold text-sm text-text-light dark:text-text-dark">Riwayat Poin Bersih</span>
                      <span className="text-xs mt-1">Anda belum memiliki transaksi poin pending, earned, maupun redeem.</span>
                    </div>
                  ) : (
                    <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl overflow-hidden shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-border-light dark:border-border-dark text-[10px] font-black uppercase text-muted tracking-wider">
                              <th className="px-6 py-4">Tanggal & Waktu</th>
                              <th className="px-6 py-4">Keterangan</th>
                              <th className="px-6 py-4">Status</th>
                              <th className="px-6 py-4 text-right">Poin</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.map((tx, idx) => {
                              const isAdd = tx.points > 0;
                              const sourceLabel = getSourceLabel(tx.source_type, tx.description);
                              return (
                                <tr key={tx.id} className={`border-b border-border-light dark:border-border-dark text-xs ${idx % 2 === 1 ? "bg-gray-50/30 dark:bg-gray-900/10" : ""}`}>
                                  <td className="px-6 py-4 text-muted">
                                    {format(new Date(tx.created_at), "dd MMM yyyy, HH:mm", { locale: id })}
                                  </td>
                                  <td className="px-6 py-4 text-text-light dark:text-text-dark font-medium">
                                    <div className="font-bold uppercase text-[11px]">{tx.description || "Transaksi Point"}</div>
                                    <div className="text-[10px] text-muted font-bold tracking-wide mt-0.5 flex flex-wrap gap-1.5 items-center">
                                      <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[9px] uppercase">{sourceLabel}</span>
                                      {tx.status === 'pending' && (
                                        <span className="text-amber-500 font-extrabold text-[9px] uppercase tracking-wide">Menunggu proses verifikasi pesanan selesai</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    {getStatusBadge(tx.status)}
                                  </td>
                                  <td className={`px-6 py-4 text-right font-mono text-sm font-black ${isAdd ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                    {isAdd ? `+${tx.points}` : tx.points}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Confirmation Redeem Modal */}
      <BaseModal
        isOpen={!!confirmReward}
        onClose={() => setConfirmReward(null)}
        size="sm"
        showCloseButton={false}
      >
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 bg-primary/10 mx-auto rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
            {confirmReward && getRewardIcon(confirmReward.category)}
          </div>
          <h3 className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tight">Tukar Reward?</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            Apakah Anda yakin ingin menukarkan <span className="font-extrabold text-primary font-mono">{confirmReward?.min_points} poin</span> Anda dengan reward <span className="font-bold text-text-light dark:text-text-dark">&ldquo;{confirmReward?.title}&rdquo;</span>?
          </p>
          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => setConfirmReward(null)} 
              disabled={submitting}
              className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
            >
              Batal
            </button>
            <button 
              onClick={handleConfirmRedeem} 
              disabled={submitting} 
              className="flex-1 py-3.5 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Ya, Tukar"}
            </button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
