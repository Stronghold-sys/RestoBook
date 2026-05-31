"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Gift, Trophy, Award, Calendar, AlertCircle, Clock, 
  CheckCircle, HelpCircle, RefreshCw, Loader2, ArrowRight,
  Sparkles, Wallet, Ticket, ShoppingBag, CreditCard, ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import toast from "react-hot-toast";
import confetti from "canvas-confetti";
import { createClient } from "@/lib/supabase/client";

export default function CustomerRewardsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<any>({
    points: 0,
    pending_points: 0,
    points_used: 0,
    is_redeem_blocked: false,
    wallet_balance: 0
  });
  const [rewards, setRewards] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"catalog" | "history" | "my-rewards">("catalog");
  const [confirmReward, setConfirmReward] = useState<any>(null);

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

  const handleRedeemClick = (reward: any) => {
    if (profile.is_redeem_blocked) {
      toast.error("Akses penukaran poin Anda sedang diblokir oleh admin.");
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

  const getRewardIcon = (category: string) => {
    switch (category) {
      case "voucher": return <Ticket className="w-6 h-6 text-orange-500" />;
      case "food": return <Sparkles className="w-6 h-6 text-amber-500" />;
      case "cashback": return <Wallet className="w-6 h-6 text-emerald-500" />;
      case "product": return <ShoppingBag className="w-6 h-6 text-blue-500" />;
      default: return <Gift className="w-6 h-6 text-purple-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-yellow-50 text-yellow-600 border border-yellow-100 uppercase animate-pulse whitespace-nowrap">Pending</span>;
      case "earned":
      case "manual_earned":
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase whitespace-nowrap">Selesai</span>;
      case "redeemed":
      case "manual_redeemed":
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-rose-50 text-rose-600 border border-rose-100 uppercase whitespace-nowrap">Redeem</span>;
      case "cancelled":
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-gray-100 text-gray-500 border border-gray-200 uppercase whitespace-nowrap">Batal</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-black rounded bg-gray-50 text-gray-450 border border-gray-100 uppercase whitespace-nowrap">{status}</span>;
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
          {/* Hero Point Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              className="md:col-span-2 relative overflow-hidden bg-gradient-to-br from-primary to-orange-600 rounded-[2rem] p-6 text-white shadow-xl shadow-primary/20 flex flex-col justify-between min-h-[160px]"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start z-10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Poin Aktif Saya</p>
                  <h2 className="text-5xl font-black mt-1 font-mono tracking-tight">{profile.points} <span className="text-xs font-bold text-white/90">Poin</span></h2>
                </div>
                <div className="bg-white/20 p-3 rounded-2xl">
                  <Award className="w-6 h-6 text-yellow-300" />
                </div>
              </div>
              <div className="border-t border-white/20 pt-3 mt-4 flex justify-between items-center z-10 text-xs text-white/90">
                <span className="font-bold flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-emerald-300" />
                  Saldo Dompet: Rp {profile.wallet_balance.toLocaleString("id-ID")}
                </span>
                {profile.is_redeem_blocked && (
                  <span className="bg-red-500/80 px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wider">REDEEM BLOCKED</span>
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Point Pending</p>
                <h3 className="text-3xl font-black mt-2 font-mono text-amber-500">{profile.pending_points}</h3>
              </div>
              <p className="text-[10px] text-muted leading-tight mt-4">
                Poin akan aktif setelah pesanan diproses selesai oleh kasir.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 shadow-sm flex flex-col justify-between"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Total Point Terpakai</p>
                <h3 className="text-3xl font-black mt-2 font-mono text-primary">{profile.points_used}</h3>
              </div>
              <p className="text-[10px] text-muted leading-tight mt-4">
                Jumlah total poin yang telah Anda belanjakan untuk menukar reward.
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
              Reward Saya ({redemptions.length})
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
                  {rewards.map((reward) => {
                    const isPointsEnough = profile.points >= reward.min_points;
                    const isOutOfStock = reward.stock !== null && reward.stock <= 0;
                    const diffPoints = reward.min_points - profile.points;
                    const progressPercent = Math.min(100, Math.round((profile.points / reward.min_points) * 100));

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

                          <p className="text-xs text-muted leading-relaxed line-clamp-2 pl-1.5 border-l-2 border-primary/20">
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

                        <div className="mt-6 border-t border-border-light dark:border-border-dark pt-4 flex items-center justify-between gap-4">
                          <span className="text-xs font-bold text-muted shrink-0">
                            {reward.stock !== null ? `Stok: ${reward.stock} item` : "Stok melimpah"}
                          </span>

                          {isOutOfStock ? (
                            <button
                              disabled
                              className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 text-xs font-black uppercase tracking-wider border border-border-light dark:border-border-dark cursor-not-allowed"
                            >
                              Stok Habis
                            </button>
                          ) : !isPointsEnough ? (
                            <div className="flex flex-col items-end gap-1">
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
                              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg hover:shadow-primary/20 transition-all flex items-center gap-1.5"
                            >
                              Redeem <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )
            ) : activeTab === "my-rewards" ? (
              redemptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted text-center bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-8">
                  <Award className="w-12 h-12 text-muted/30 mb-3" />
                  <span className="font-bold text-lg text-text-light dark:text-text-dark">Belum Ada Penukaran</span>
                  <span className="text-xs mt-1 max-w-sm">
                    Poin yang telah Anda kumpulkan belum ditukar dengan reward. Kumpulkan poin dan lakukan klaim reward Anda sekarang!
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {redemptions.map((red) => (
                    <motion.div
                      key={red.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-3">
                        <span className="px-2.5 py-1 text-[9px] font-black uppercase rounded bg-emerald-100/50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/20">
                          {red.status === "success" ? "Berhasil" : red.status}
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-primary/5 p-3 rounded-2xl shrink-0">
                            {getRewardIcon(red.rewards?.category || "custom")}
                          </div>
                          <div>
                            <h3 className="font-bold text-lg text-text-light dark:text-text-dark">{red.rewards?.title || "Reward Dihapus"}</h3>
                            <p className="text-[10px] text-muted font-medium">Ditukar: {format(new Date(red.created_at), "dd MMM yyyy, HH:mm", { locale: id })} WIB</p>
                          </div>
                        </div>

                        {red.code && (
                          <div className="bg-gray-50 dark:bg-gray-800/40 border border-border-light/50 dark:border-border-dark/50 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                            <div>
                              <span className="text-[9px] font-black text-muted uppercase block">Kode Voucher Penukaran</span>
                              <span className="font-mono font-black text-primary text-lg uppercase tracking-wide">{red.code}</span>
                            </div>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(red.code);
                                toast.success(`Kode voucher ${red.code} berhasil disalin! Gunakan saat proses checkout.`);
                              }}
                              className="px-3 py-2 bg-primary/10 text-primary font-bold text-xs rounded-xl hover:bg-primary hover:text-white transition-all uppercase"
                            >
                              Salin Kode
                            </button>
                          </div>
                        )}

                        {!red.code && red.rewards?.category === "cashback" && (
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl text-xs text-emerald-800 dark:text-emerald-400 font-bold flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 shrink-0" />
                            Dana cashback sebesar Rp {Number(red.cashback_amount !== null && red.cashback_amount !== undefined ? red.cashback_amount : (red.rewards?.cashback_amount || 0)).toLocaleString("id-ID")} telah dikreditkan ke Saldo Dompet Anda.
                          </div>
                        )}

                        {!red.code && red.rewards?.category !== "cashback" && (
                          <div className="p-3 bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 rounded-2xl text-xs text-muted font-bold flex items-center gap-2">
                            <Clock className="w-4 h-4 shrink-0 text-orange-500" />
                            Tunjukkan tanda terima ini ke pelayan/kasir untuk mengklaim {red.rewards?.title || 'reward'}.
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-border-light dark:border-border-dark flex justify-between items-center text-[10px] text-muted">
                        <span>Penukaran ID: #{red.id.substring(0, 8).toUpperCase()}</span>
                        <span className="font-bold">Biaya: {red.points_spent} Poin</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )
            ) : (
              transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted text-center bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-8">
                  <Clock className="w-12 h-12 text-muted/30 mb-3" />
                  <span className="font-bold text-lg text-text-light dark:text-text-dark">Riwayat Poin Bersih</span>
                  <span className="text-xs mt-1 max-w-sm">
                    Anda belum memiliki transaksi poin pending, earned, maupun redeem.
                  </span>
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
                          return (
                            <tr key={tx.id} className={`border-b border-border-light dark:border-border-dark text-xs ${idx % 2 === 1 ? "bg-gray-50/30 dark:bg-gray-900/10" : ""}`}>
                              <td className="px-6 py-4 text-muted">
                                {format(new Date(tx.created_at), "dd MMM yyyy, HH:mm", { locale: id })}
                              </td>
                              <td className="px-6 py-4 font-bold text-text-light dark:text-text-dark">
                                {tx.description || "Transaksi Point"}
                              </td>
                              <td className="px-6 py-4">
                                {getStatusBadge(tx.status)}
                              </td>
                              <td className={`px-6 py-4 text-right font-black font-mono text-sm ${isAdd ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {isAdd ? `+${tx.points}` : tx.points}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
          </div>
        </>
      )}

      {/* Confirmation Redeem Modal */}
      <AnimatePresence>
        {confirmReward && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setConfirmReward(null)} 
              className="absolute inset-0 bg-black/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="relative bg-white dark:bg-card-dark w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center border border-gray-100 dark:border-gray-800 z-10"
            >
              <div className="w-16 h-16 bg-primary/10 mx-auto rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
                {getRewardIcon(confirmReward.category)}
              </div>
              <h3 className="font-black text-xl text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Tukar Reward?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">
                Apakah Anda yakin ingin menukarkan <span className="font-extrabold text-primary font-mono">{confirmReward.min_points} poin</span> Anda dengan reward <span className="font-bold text-text-light dark:text-text-dark">&ldquo;{confirmReward.title}&rdquo;</span>?
              </p>
              <div className="flex gap-3">
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
