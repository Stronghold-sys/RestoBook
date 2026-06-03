"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Gift, Trophy, Award, Calendar, AlertCircle, Clock, 
  CheckCircle, HelpCircle, RefreshCw, Loader2, Plus, Edit2,
  Trash2, Settings, Users, BarChart3, ShieldAlert, X,
  Save, Ban, Unlock, RefreshCcw, Wallet, ArrowDown, ArrowUp,
  Ticket, Sparkles, ShoppingBag
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import toast from "react-hot-toast";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { createClient } from "@/lib/supabase/client";

export default function AdminRewardsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rewards, setRewards] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({
    totalEarned: 0,
    totalPending: 0,
    totalRedeemed: 0,
    leaderboard: [],
    chart: []
  });
  
  // Point rules settings
  const [settings, setSettings] = useState<any>({
    minRandomPoints: 10,
    maxRandomPoints: 100,
    isPointsEnabled: true,
    pointsExpiryDays: 365,
    maxPointsPerTransaction: 1000,
    bonusNewCustomer: 25,
    bonusBirthday: 50,
    multiplier: 1,
    bonusEventName: "",
    bonusEventPoints: 0,
    bonusDayOfWeek: -1,
    bonusDayMultiplier: 1,
    minTopup: 10000,
    maxTopup: 2000000,
    isDuitkuEnabled: true,
    isCashbackEnabled: true,
    walletAdminFee: 0,
    isAutoRefundEnabled: true,
    topupExpiryMinutes: 15,
    welcomeGiftEnabled: true,
    welcomeGiftPoints: 1000
  });

  const [activeTab, setActiveTab] = useState<"catalog" | "customers" | "redemptions" | "settings">("catalog");
  
  // Modal states
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [currentReward, setCurrentReward] = useState<any>(null); // null = add, otherwise edit
  const [rewardForm, setRewardForm] = useState<any>({
    title: "",
    description: "",
    category: "voucher",
    minPoints: 50,
    stock: "",
    imageUrl: "",
    discountPercent: 10,
    cashbackAmount: 0,
    isAutoCashback: false,
    expiryDays: "",
    redeemLimit: "",
    redeemLimitValue: "1",
    redeemLimitPeriod: "all",
    expiresAt: ""
  });

  // Customer manual adjustment modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [adjustForm, setAdjustForm] = useState({
    action: "adjust", // adjust, reset, adjust_wallet, reset_wallet, toggle_wallet_block
    amount: "",
    reason: ""
  });
  const [customerTxLogs, setCustomerTxLogs] = useState<any[]>([]);
  const [customerWalletTxLogs, setCustomerWalletTxLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeLogsTab, setActiveLogsTab] = useState<"points" | "wallet" | "quota">("points");

  // Custom delete confirmation modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Redemption management states
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState<any>(null);
  const [blockReason, setBlockReason] = useState("");
  const [showDeleteRedemptionConfirm, setShowDeleteRedemptionConfirm] = useState(false);
  const [selectedRedemptionForDelete, setSelectedRedemptionForDelete] = useState<any>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchAdminData();
    fetchRestaurantSettings();

    const channel = supabase
      .channel("admin-rewards-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reward_redemptions" }, () => {
        fetchAdminData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        fetchAdminData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "point_transactions" }, () => {
        fetchAdminData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rewards" }, () => {
        fetchAdminData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      // 1. Fetch rewards and stats
      const resRewards = await fetch("/api/admin/rewards");
      const dataRewards = await resRewards.json();
      if (!resRewards.ok) throw new Error(dataRewards.error || "Gagal memuat reward admin");
      setRewards(dataRewards.rewards || []);
      setStats(dataRewards.stats);

      // 2. Fetch customer point lists
      const resCust = await fetch("/api/admin/customers/points");
      const dataCust = await resCust.json();
      if (!resCust.ok) throw new Error(dataCust.error || "Gagal memuat pelanggan");
      setCustomers(dataCust.customers || []);

      // 3. Fetch customer redemptions
      const resRed = await fetch("/api/admin/rewards/redemptions");
      const dataRed = await resRed.json();
      if (resRed.ok) {
        setRedemptions(dataRed.redemptions || []);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurantSettings = async () => {
    try {
      const { data } = await supabase.from("restaurant_settings").select("*").single();
      if (data) {
        setSettings({
          minRandomPoints: data.min_random_points !== undefined && data.min_random_points !== null ? data.min_random_points : 10,
          maxRandomPoints: data.max_random_points !== undefined && data.max_random_points !== null ? data.max_random_points : 100,
          isPointsEnabled: data.is_points_enabled !== undefined && data.is_points_enabled !== null ? !!data.is_points_enabled : true,
          pointsExpiryDays: data.points_expiry_days !== undefined && data.points_expiry_days !== null ? data.points_expiry_days : 365,
          maxPointsPerTransaction: data.max_points_per_transaction !== undefined && data.max_points_per_transaction !== null ? data.max_points_per_transaction : 1000,
          bonusNewCustomer: data.bonus_new_customer !== undefined && data.bonus_new_customer !== null ? data.bonus_new_customer : 25,
          bonusBirthday: data.bonus_birthday !== undefined && data.bonus_birthday !== null ? data.bonus_birthday : 50,
          multiplier: data.multiplier !== undefined && data.multiplier !== null ? data.multiplier : 1,
          bonusEventName: data.bonus_event_name || "",
          bonusEventPoints: data.bonus_event_points !== undefined && data.bonus_event_points !== null ? data.bonus_event_points : 0,
          bonusDayOfWeek: data.bonus_day_of_week !== undefined && data.bonus_day_of_week !== null ? data.bonus_day_of_week : -1,
          bonusDayMultiplier: data.bonus_day_multiplier !== undefined && data.bonus_day_multiplier !== null ? data.bonus_day_multiplier : 1,
          minTopup: data.min_topup !== undefined && data.min_topup !== null ? data.min_topup : 10000,
          maxTopup: data.max_topup !== undefined && data.max_topup !== null ? data.max_topup : 2000000,
          isDuitkuEnabled: data.is_duitku_enabled !== undefined && data.is_duitku_enabled !== null ? !!data.is_duitku_enabled : true,
          isCashbackEnabled: data.is_cashback_enabled !== undefined && data.is_cashback_enabled !== null ? !!data.is_cashback_enabled : true,
          walletAdminFee: data.wallet_admin_fee !== undefined && data.wallet_admin_fee !== null ? data.wallet_admin_fee : 0,
          isAutoRefundEnabled: data.is_auto_refund_enabled !== undefined && data.is_auto_refund_enabled !== null ? !!data.is_auto_refund_enabled : true,
          topupExpiryMinutes: data.topup_expiry_minutes !== undefined && data.topup_expiry_minutes !== null ? data.topup_expiry_minutes : 15,
          welcomeGiftEnabled: data.welcome_gift_enabled !== undefined && data.welcome_gift_enabled !== null ? !!data.welcome_gift_enabled : true,
          welcomeGiftPoints: data.welcome_gift_points !== undefined && data.welcome_gift_points !== null ? data.welcome_gift_points : 1000
        });
      }
    } catch (err) {
      console.error("Error loading point settings:", err);
    }
  };


  const handleOpenRewardModal = (reward: any = null) => {
    const formatDatetimeLocal = (isoString: string) => {
      if (!isoString) return "";
      try {
        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      } catch {
        return "";
      }
    };

    if (reward) {
      setCurrentReward(reward);
      setRewardForm({
        title: reward.title,
        description: reward.description || "",
        category: reward.category,
        minPoints: reward.min_points,
        stock: reward.stock !== null ? String(reward.stock) : "",
        imageUrl: reward.image_url || "",
        discountPercent: reward.discount_percent || 10,
        cashbackAmount: reward.cashback_amount || 0,
        isAutoCashback: !!reward.is_auto_cashback,
        expiryDays: reward.expiry_days !== null && reward.expiry_days !== undefined ? String(reward.expiry_days) : "",
        redeemLimit: reward.redeem_limit !== null && reward.redeem_limit !== undefined ? String(reward.redeem_limit) : "",
        redeemLimitValue: reward.redeem_limit_value !== null && reward.redeem_limit_value !== undefined ? String(reward.redeem_limit_value) : "1",
        redeemLimitPeriod: reward.redeem_limit_period || "all",
        expiresAt: formatDatetimeLocal(reward.expires_at)
      });
    } else {
      setCurrentReward(null);
      setRewardForm({
        title: "",
        description: "",
        category: "voucher",
        minPoints: 50,
        stock: "",
        imageUrl: "",
        discountPercent: 10,
        cashbackAmount: 0,
        isAutoCashback: false,
        expiryDays: "",
        redeemLimit: "",
        redeemLimitValue: "1",
        redeemLimitPeriod: "all",
        expiresAt: ""
      });
    }
    setShowRewardModal(true);
  };

  const generateAutoDescription = () => {
    const { title, category, minPoints, discountPercent, expiryDays } = rewardForm;
    const pts = Number(minPoints) || 0;
    const exp = expiryDays ? `Berlaku ${expiryDays} hari setelah ditukar.` : "Berlaku tanpa batas waktu.";

    let desc = "";
    if (category === "voucher") {
      const disc = Number(discountPercent) || 0;
      desc = `${title || "Reward ini"} memberikan diskon sebesar ${disc}% untuk pembelian di RestoBook. Dapat ditukar dengan minimal ${pts} poin. ${exp}`;
    } else if (category === "food") {
      desc = `${title || "Menu spesial ini"} hadir sebagai hadiah eksklusif untuk pelanggan setia RestoBook! Tukarkan minimal ${pts} poin Anda dan nikmati sajian istimewa dari kami. ${exp}`;
    } else if (category === "cashback") {
      desc = `Tukarkan ${pts} poin untuk mendapatkan saldo Dompetku. ${exp}`;
    } else if (category === "product") {
      desc = `${title || "Produk promo eksklusif ini"} tersedia khusus untuk pelanggan RestoBook. Tukarkan minimal ${pts} poin dan dapatkan produk pilihan kami. ${exp}`;
    } else {
      desc = `${title || "Reward eksklusif ini"} dapat ditukar dengan minimal ${pts} poin RestoBook. ${exp}`;
    }
    setRewardForm((prev: any) => ({ ...prev, description: desc }));
    toast.success("Deskripsi berhasil digenerate!");
  };


  const handleSaveReward = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const loadingToast = toast.loading("Menyimpan reward...");
    try {
      const url = "/api/admin/rewards";
      const method = currentReward ? "PUT" : "POST";
      const cleanedForm = {
        ...rewardForm,
        minPoints: !rewardForm.minPoints ? 0 : Number(rewardForm.minPoints),
        discountPercent: !rewardForm.discountPercent ? 0 : Number(rewardForm.discountPercent),
        cashbackAmount: !rewardForm.cashbackAmount ? 0 : Number(rewardForm.cashbackAmount),
        isAutoCashback: !!rewardForm.isAutoCashback,
        expiryDays: rewardForm.expiryDays === "" ? null : Number(rewardForm.expiryDays),
        redeemLimit: rewardForm.redeemLimit === "" ? null : Number(rewardForm.redeemLimit),
        redeemLimitValue: rewardForm.redeemLimitValue === "" ? 1 : Number(rewardForm.redeemLimitValue),
        redeemLimitPeriod: rewardForm.redeemLimitPeriod || "all",
        expiresAt: rewardForm.expiresAt === "" ? null : new Date(rewardForm.expiresAt).toISOString(),
        isActive: currentReward ? currentReward.is_active : true
      };
      const bodyPayload = currentReward ? { id: currentReward.id, ...cleanedForm } : cleanedForm;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan reward");

      toast.success(currentReward ? "Reward berhasil diperbarui!" : "Reward baru berhasil ditambahkan!", { id: loadingToast });
      setShowRewardModal(false);
      fetchAdminData();
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReward = (id: string) => {
    setDeleteTargetId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteReward = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    const loadingToast = toast.loading("Menghapus reward...");
    try {
      const res = await fetch(`/api/admin/rewards?id=${deleteTargetId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus reward");

      toast.success("Reward berhasil dihapus!", { id: loadingToast });
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
      fetchAdminData();
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleRewardActive = async (reward: any) => {
    const loadingToast = toast.loading("Mengubah status reward...");
    try {
      const res = await fetch("/api/admin/rewards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: reward.id,
          title: reward.title,
          description: reward.description,
          category: reward.category,
          minPoints: reward.min_points,
          stock: reward.stock !== null ? String(reward.stock) : "",
          imageUrl: reward.image_url,
          discountPercent: reward.discount_percent,
          cashbackAmount: reward.cashback_amount,
          expiryDays: reward.expiry_days,
          redeemLimit: reward.redeem_limit !== null && reward.redeem_limit !== undefined ? String(reward.redeem_limit) : "",
          redeemLimitValue: reward.redeem_limit_value !== null && reward.redeem_limit_value !== undefined ? String(reward.redeem_limit_value) : "1",
          redeemLimitPeriod: reward.redeem_limit_period || "all",
          expiresAt: reward.expires_at || null,
          isActive: !reward.is_active
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui status reward");

      toast.success("Status reward berhasil diperbarui!", { id: loadingToast });
      fetchAdminData();
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const loadingToast = toast.loading("Menyimpan aturan poin...");
    try {
      const res = await fetch("/api/admin/settings/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan pengaturan");

      toast.success("Aturan poin berhasil diperbarui!", { id: loadingToast });
      fetchRestaurantSettings();
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdjustModal = async (cust: any) => {
    setSelectedCustomer(cust);
    setAdjustForm({
      action: "adjust",
      amount: "",
      reason: ""
    });
    setCustomerTxLogs([]);
    setCustomerWalletTxLogs([]);
    setShowAdjustModal(true);

    // Fetch customer logs
    setLoadingLogs(true);
    try {
      const res = await fetch(`/api/admin/customers/points?customerId=${cust.id}`);
      const data = await res.json();
      if (res.ok) {
        setCustomerTxLogs(data.transactions || []);
        setCustomerWalletTxLogs(data.walletTransactions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleAdjustPointsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || saving) return;
    setSaving(true);
    const loadingToast = toast.loading("Memproses penyesuaian...");
    try {
      const res = await fetch("/api/admin/customers/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          action: adjustForm.action,
          amount: ["reset", "reset_wallet", "toggle_wallet_block"].includes(adjustForm.action) ? 0 : Number(adjustForm.amount),
          reason: adjustForm.reason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses penyesuaian");

      toast.success("Penyesuaian berhasil diproses!", { id: loadingToast });
      setShowAdjustModal(false);
      fetchAdminData();
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };


  const handleToggleBlockRedeem = async (cust: any) => {
    const loadingToast = toast.loading("Mengubah status blokir pelanggan...");
    try {
      const res = await fetch("/api/admin/customers/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: cust.id,
          action: "toggle_block"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status blokir");

      toast.success(data.isRedeemBlocked ? "Akses redeem berhasil diblokir!" : "Akses redeem berhasil dibuka!", { id: loadingToast });
      fetchAdminData();
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    }
  };

  const handleToggleBlockRedemption = (red: any) => {
    if (red.is_blocked) {
      confirmToggleBlockRedemption(red, false, "");
    } else {
      setSelectedRedemption(red);
      setBlockReason("");
      setShowBlockModal(true);
    }
  };

  const confirmToggleBlockRedemption = async (red: any, blockStatus: boolean, reason: string) => {
    const loadingToast = toast.loading(blockStatus ? "Memblokir penukaran..." : "Membuka blokir penukaran...");
    try {
      const res = await fetch("/api/admin/rewards/redemptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redemptionId: red.id,
          isBlocked: blockStatus,
          blockReason: reason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status blokir");

      toast.success(blockStatus ? "Penukaran reward berhasil diblokir!" : "Blokir penukaran reward dibuka!", { id: loadingToast });
      setShowBlockModal(false);
      fetchAdminData();
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    }
  };

  const handleDeleteRedemption = (red: any) => {
    setSelectedRedemptionForDelete(red);
    setShowDeleteRedemptionConfirm(true);
  };

  const confirmDeleteRedemption = async () => {
    if (!selectedRedemptionForDelete) return;
    const loadingToast = toast.loading("Menghapus penukaran reward...");
    try {
      const res = await fetch(`/api/admin/rewards/redemptions?redemptionId=${selectedRedemptionForDelete.id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus penukaran reward");

      toast.success("Penukaran reward berhasil dihapus!", { id: loadingToast });
      setShowDeleteRedemptionConfirm(false);
      setSelectedRedemptionForDelete(null);
      fetchAdminData();
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    }
  };

  const getCustomerActiveRedemptionsCount = (reward: any, customerId: string) => {
    if (!reward.redeem_limit || reward.redeem_limit <= 0) return [];
    const limitValue = reward.redeem_limit_value || 1;
    const period = reward.redeem_limit_period || "all";

    const userReds = redemptions.filter(
      (r: any) => r.customer_id === customerId && r.reward_id === reward.id && r.status !== "cancelled"
    );

    if (period === "all") {
      return userReds;
    }

    const now = Date.now();
    let offsetMs = 0;
    if (period === "minute") offsetMs = limitValue * 60 * 1000;
    else if (period === "hour") offsetMs = limitValue * 60 * 60 * 1000;
    else if (period === "day") offsetMs = limitValue * 24 * 60 * 60 * 1000;
    else if (period === "week") offsetMs = limitValue * 7 * 24 * 60 * 60 * 1000;
    else if (period === "month") {
      const boundary = new Date();
      boundary.setMonth(boundary.getMonth() - limitValue);
      return userReds.filter((r: any) => new Date(r.created_at) >= boundary);
    }

    const boundaryTime = now - offsetMs;
    return userReds.filter((r: any) => new Date(r.created_at).getTime() >= boundaryTime);
  };

  const handleAdjustQuota = async (actionType: 'reset' | 'reduce', reward: any, customerId: string) => {
    const activeReds = getCustomerActiveRedemptionsCount(reward, customerId);
    if (activeReds.length === 0) {
      toast.error("Tidak ada kuota penukaran aktif yang bisa disesuaikan.");
      return;
    }

    let targetIds: string[] = [];
    if (actionType === 'reset') {
      targetIds = activeReds.map((r: any) => r.id);
    } else {
      activeReds.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      targetIds = [activeReds[0].id];
    }

    const loadingToast = toast.loading("Menyesuaikan kuota penukaran...");
    try {
      const res = await fetch("/api/admin/rewards/redemptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'cancel_redemptions',
          redemptionIds: targetIds
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyesuaikan kuota");

      toast.success(actionType === 'reset' ? "Kuota berhasil direset ke 0!" : "Kuota berhasil dikurangi 1!", { id: loadingToast });
      fetchAdminData();
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary flex items-center gap-3">
            <Trophy className="w-8 h-8 text-orange-500" /> Kelola Reward & Poin
          </h1>
          <p className="text-muted text-sm mt-1">
            Pantau statistik, atur poin pesanan, kelola reward penukaran, dan manipulasi poin pelanggan secara manual.
          </p>
        </div>
        <button
          onClick={fetchAdminData}
          disabled={loading}
          className="flex items-center gap-2 self-start sm:self-center px-4 py-2 text-sm font-bold bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl text-muted hover:text-primary transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
          <span>Memuat data kontrol reward & poin...</span>
        </div>
      ) : (
        <>
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 shadow-sm flex items-center gap-5">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 rounded-2xl">
                <ArrowUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Poin Terdistribusi</p>
                <h3 className="text-2xl font-black mt-1 font-mono text-text-light dark:text-text-dark">{stats.totalEarned}</h3>
              </div>
            </div>

            <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 shadow-sm flex items-center gap-5">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 rounded-2xl">
                <Clock className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Poin Pending</p>
                <h3 className="text-2xl font-black mt-1 font-mono text-text-light dark:text-text-dark">{stats.totalPending}</h3>
              </div>
            </div>

            <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 shadow-sm flex items-center gap-5">
              <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 rounded-2xl">
                <ArrowDown className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">Poin Terpakai (Redeem)</p>
                <h3 className="text-2xl font-black mt-1 font-mono text-text-light dark:text-text-dark">{stats.totalRedeemed}</h3>
              </div>
            </div>
          </div>

          {/* Analytics Chart & Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Chart */}
            <div className="lg:col-span-2 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 shadow-sm">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted mb-6 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" /> Volume Penukaran Reward (7 Hari Terakhir)
              </h3>
              <div className="h-64 w-full">
                {stats.chart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chart}>
                      <XAxis dataKey="label" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ background: "var(--card-color)", border: "1px solid var(--border-color)", borderRadius: "12px", fontSize: "12px" }} />
                      <Bar dataKey="count" fill="#ff5722" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-muted text-xs">Belum ada data penukaran</div>
                )}
              </div>
            </div>

            {/* Leaderboard */}
            <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 shadow-sm">
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted mb-6 flex items-center gap-2">
                <Award className="w-4 h-4 text-yellow-500" /> Poin Tertinggi Pelanggan
              </h3>
              <div className="space-y-4">
                {stats.leaderboard.length > 0 ? (
                  stats.leaderboard.map((cust: any, idx: number) => (
                    <div key={cust.id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 dark:bg-gray-800/20 border border-border-light/30 dark:border-border-dark/30">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                          idx === 0 ? "bg-yellow-400 text-white" :
                          idx === 1 ? "bg-gray-300 text-gray-800" :
                          idx === 2 ? "bg-amber-600 text-white" :
                          "bg-gray-100 dark:bg-gray-800 text-muted"
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-bold text-xs text-text-light dark:text-text-dark line-clamp-1 uppercase">{cust.full_name}</p>
                          <p className="text-[10px] text-muted line-clamp-1">{cust.email}</p>
                        </div>
                      </div>
                      <span className="font-mono font-black text-primary text-xs shrink-0">{cust.points} Poin</span>
                    </div>
                  ))
                ) : (
                  <div className="text-muted text-xs text-center py-10">Belum ada data pelanggan</div>
                )}
              </div>
            </div>
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
              onClick={() => setActiveTab("customers")}
              className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                activeTab === "customers"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-text-light dark:hover:text-text-dark"
              }`}
            >
              Manajemen Poin Pelanggan ({customers.length})
            </button>
            <button
              onClick={() => setActiveTab("redemptions")}
              className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                activeTab === "redemptions"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-text-light dark:hover:text-text-dark"
              }`}
            >
              Daftar Penukaran ({redemptions.length})
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${
                activeTab === "settings"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-text-light dark:hover:text-text-dark"
              }`}
            >
              Aturan & Pengaturan Poin
            </button>
          </div>

          {/* Tab Contents */}
          <div className="space-y-6">
            {activeTab === "catalog" ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-black text-text-light dark:text-text-dark uppercase tracking-tight">Katalog Reward Penukaran</h3>
                  <button
                    onClick={() => handleOpenRewardModal(null)}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
                  >
                    <Plus className="w-4 h-4" /> Tambah Reward
                  </button>
                </div>

                {rewards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted text-center bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-8">
                    <Gift className="w-12 h-12 text-muted/30 mb-3" />
                    <span className="font-bold text-lg text-text-light dark:text-text-dark">Katalog Kosong</span>
                    <span className="text-xs mt-1 max-w-sm">Belum ada penawaran reward yang dibuat. Tambahkan reward baru sekarang!</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {rewards.map((reward) => (
                      <div key={reward.id} className={`bg-card-light dark:bg-card-dark border rounded-3xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group overflow-hidden relative ${reward.is_active ? "border-border-light dark:border-border-dark" : "border-red-200 opacity-60 dark:border-red-950"}`}>
                        <div className="space-y-4">
                          <div className="flex justify-between items-start gap-4">
                            <div className="flex items-center gap-3">
                              <div className="bg-primary/5 p-3 rounded-2xl shrink-0">
                                {reward.category === "voucher" ? <Ticket className="w-6 h-6 text-orange-500" /> :
                                 reward.category === "food" ? <Sparkles className="w-6 h-6 text-amber-500" /> :
                                 reward.category === "cashback" ? <Wallet className="w-6 h-6 text-emerald-500" /> :
                                 reward.category === "product" ? <ShoppingBag className="w-6 h-6 text-blue-500" /> :
                                 <Gift className="w-6 h-6 text-purple-500" />}
                              </div>
                              <div>
                                <h4 className="font-bold text-base text-text-light dark:text-text-dark line-clamp-1">{reward.title}</h4>
                                <span className="text-[9px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-muted font-black uppercase tracking-wider">{reward.category}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xl font-black text-primary font-mono">{reward.min_points}</span>
                              <span className="block text-[9px] font-bold text-muted uppercase">Poin</span>
                            </div>
                          </div>

                          <p className="text-xs text-muted leading-relaxed">
                            {reward.description || "Tidak ada deskripsi."}
                          </p>

                          {reward.category === "voucher" && (
                            <div className="bg-orange-50/50 dark:bg-orange-950/10 p-3 rounded-xl text-xs text-orange-700 dark:text-orange-400 font-bold">
                              Potongan Voucher: {reward.discount_percent || 10}% Diskon
                            </div>
                          )}

                          {reward.category === "cashback" && (
                            <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-3 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                              Jumlah Saldo: Rp {Number(reward.cashback_amount || 0).toLocaleString("id-ID")} {reward.is_auto_cashback ? "(Otomatis)" : ""}
                            </div>
                          )}
                        </div>

                        <div className="mt-6 border-t border-border-light dark:border-border-dark pt-4 flex items-center justify-between gap-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-semibold text-muted">
                              Stok: {reward.stock !== null ? `${reward.stock} item` : "Tanpa batas"}
                            </span>
                            {reward.expiry_days !== null && reward.expiry_days !== undefined && reward.expiry_days > 0 && (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                Kadaluarsa Penggunaan: {reward.expiry_days} Hari setelah ditukar
                              </span>
                            )}
                            {reward.redeem_limit !== null && reward.redeem_limit !== undefined && reward.redeem_limit > 0 && (
                              <span className="text-[10px] font-bold text-primary flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3 text-primary shrink-0" />
                                Limit: {reward.redeem_limit}x per {
                                  reward.redeem_limit_period === 'all' ? 'selamanya' :
                                  `${reward.redeem_limit_value || 1} ${
                                    reward.redeem_limit_period === 'minute' ? 'menit' :
                                    reward.redeem_limit_period === 'hour' ? 'jam' :
                                    reward.redeem_limit_period === 'day' ? 'hari' :
                                    reward.redeem_limit_period === 'week' ? 'minggu' :
                                    reward.redeem_limit_period === 'month' ? 'bulan' : 'periode'
                                  }`
                                }
                              </span>
                            )}
                            {reward.expires_at && (
                              <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3 text-rose-500 dark:text-rose-400 shrink-0" />
                                Kadaluarsa Katalog: {format(new Date(reward.expires_at), "dd MMM yyyy, HH:mm", { locale: id })} WIB
                              </span>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleToggleRewardActive(reward)}
                              title={reward.is_active ? "Nonaktifkan Reward" : "Aktifkan Reward"}
                              className={`p-2 rounded-xl border text-xs font-black transition-all ${
                                reward.is_active
                                  ? "bg-amber-50 hover:bg-amber-100 text-amber-600 border-amber-200"
                                  : "bg-green-50 hover:bg-green-100 text-green-600 border-green-200"
                              }`}
                            >
                              {reward.is_active ? "Nonaktifkan" : "Aktifkan"}
                            </button>
                            <button
                              onClick={() => handleOpenRewardModal(reward)}
                              title="Edit Reward"
                              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-muted hover:text-primary transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteReward(reward.id)}
                              title="Hapus Reward"
                              className="p-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === "customers" ? (
              <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900 border-b border-border-light dark:border-border-dark text-[10px] font-black uppercase text-muted tracking-wider">
                        <th className="px-6 py-4 whitespace-nowrap">Nama Pelanggan</th>
                        <th className="px-6 py-4 whitespace-nowrap">Email</th>
                        <th className="px-6 py-4 text-right whitespace-nowrap">Poin</th>
                        <th className="px-6 py-4 text-right whitespace-nowrap">Pending</th>
                        <th className="px-6 py-4 text-right whitespace-nowrap">Dompet (Rp)</th>
                        <th className="px-6 py-4 text-center whitespace-nowrap">Status</th>
                        <th className="px-6 py-4 text-center whitespace-nowrap">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.map((cust) => (
                        <tr key={cust.id} className="border-b border-border-light dark:border-border-dark text-xs hover:bg-gray-50/40 dark:hover:bg-gray-900/10">
                          <td className="px-6 py-4 font-bold text-text-light dark:text-text-dark uppercase whitespace-nowrap">
                            {cust.full_name}
                          </td>
                          <td className="px-6 py-4 text-muted whitespace-nowrap">
                            {cust.email || "-"}
                          </td>
                          <td className="px-6 py-4 text-right font-black font-mono text-primary text-sm whitespace-nowrap">
                            {cust.points || 0}
                          </td>
                          <td className="px-6 py-4 text-right font-black font-mono text-amber-500 text-sm whitespace-nowrap">
                            {cust.pending_points || 0}
                          </td>
                          <td className="px-6 py-4 text-right font-black font-mono text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            Rp {Number(cust.wallet_balance || 0).toLocaleString("id-ID")}
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <div className="flex flex-col items-center gap-1.5 justify-center">
                              {cust.is_redeem_blocked ? (
                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-red-50 text-red-650 border border-red-200 block w-24 text-center whitespace-nowrap">Redeem Blok</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200 block w-24 text-center whitespace-nowrap">Redeem Aktif</span>
                              )}
                              {cust.is_wallet_blocked ? (
                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-red-50 text-red-650 border border-red-200 block w-24 text-center whitespace-nowrap">Dompet Blok</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200 block w-24 text-center whitespace-nowrap">Dompet Aktif</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                              <button
                                onClick={() => handleOpenAdjustModal(cust)}
                                className="px-3 py-1.5 bg-primary/10 text-primary font-black text-xs rounded-xl hover:bg-primary hover:text-white transition-all uppercase"
                              >
                                Detail & Poin
                              </button>
                              <button
                                onClick={() => handleToggleBlockRedeem(cust)}
                                className={`p-1.5 rounded-xl border text-xs transition-all ${
                                  cust.is_redeem_blocked
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                                    : "bg-red-50 border-red-200 text-red-500 hover:bg-red-100"
                                }`}
                                title={cust.is_redeem_blocked ? "Buka Blokir Redeem" : "Blokir Redeem"}
                              >
                                {cust.is_redeem_blocked ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === "redemptions" ? (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-black text-text-light dark:text-text-dark uppercase tracking-tight">Daftar Penukaran Reward Pelanggan</h3>
                    <p className="text-xs text-muted mt-1">Kelola status aktif, blokir, dan hapus reward yang telah ditukar oleh pelanggan.</p>
                  </div>
                </div>

                {redemptions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted text-center bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-8">
                    <Gift className="w-12 h-12 text-muted/30 mb-3" />
                    <span className="font-bold text-lg text-text-light dark:text-text-dark">Belum Ada Penukaran</span>
                    <span className="text-xs mt-1 max-w-sm">Belum ada pelanggan yang menukarkan poin mereka dengan reward.</span>
                  </div>
                ) : (
                  <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-900 border-b border-border-light dark:border-border-dark text-[10px] font-black uppercase text-muted tracking-wider">
                            <th className="px-6 py-4 whitespace-nowrap">Pelanggan</th>
                            <th className="px-6 py-4 whitespace-nowrap">Reward</th>
                            <th className="px-6 py-4 text-center whitespace-nowrap">Poin</th>
                            <th className="px-6 py-4 whitespace-nowrap">Kode / Status</th>
                            <th className="px-6 py-4 whitespace-nowrap">Tanggal Tukar</th>
                            <th className="px-6 py-4 text-center whitespace-nowrap">Status Blokir</th>
                            <th className="px-6 py-4 text-center whitespace-nowrap">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {redemptions.map((red) => {
                            const formattedDate = format(new Date(red.created_at), "dd MMM yyyy, HH:mm", { locale: id }) + " WIB";
                            return (
                              <tr key={red.id} className="border-b border-border-light dark:border-border-dark text-xs hover:bg-gray-50/40 dark:hover:bg-gray-900/10">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <p className="font-bold text-text-light dark:text-text-dark uppercase">{red.profiles?.full_name || "Pelanggan"}</p>
                                  <p className="text-[10px] text-muted">{red.profiles?.email || "-"}</p>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <p className="font-bold text-text-light dark:text-text-dark">{red.rewards?.title || "Reward Dihapus"}</p>
                                  <span className="text-[9px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-muted font-black uppercase tracking-wider">{red.rewards?.category || "custom"}</span>
                                </td>
                                <td className="px-6 py-4 text-center font-black font-mono text-primary text-sm whitespace-nowrap">
                                  {red.points_spent}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {red.status === 'used' ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="px-2 py-0.5 text-[9px] font-black rounded bg-emerald-50 text-emerald-600 border border-emerald-250 uppercase w-fit">Telah Digunakan</span>
                                      {red.code && <span className="font-mono font-bold text-[10px] text-muted">Kode: {red.code}</span>}
                                    </div>
                                  ) : red.status === 'expired' ? (
                                    <span className="px-2 py-0.5 text-[9px] font-black rounded bg-gray-100 text-gray-500 border border-gray-200 uppercase">Kadaluarsa</span>
                                  ) : (
                                    <span className="px-2 py-0.5 text-[9px] font-black rounded bg-yellow-50 text-yellow-600 border border-yellow-200 uppercase w-fit whitespace-nowrap animate-pulse">Belum Digunakan</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-muted whitespace-nowrap">
                                  {formattedDate}
                                </td>
                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                  {red.is_blocked ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase bg-red-50 text-red-600 border border-red-200">Diblokir</span>
                                      {red.block_reason && <span className="text-[9px] text-red-500 font-bold max-w-[120px] truncate" title={red.block_reason}>{red.block_reason}</span>}
                                    </div>
                                  ) : (
                                    <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200">Aktif</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                    <button
                                      onClick={() => handleToggleBlockRedemption(red)}
                                      className={`p-1.5 rounded-xl border text-xs transition-all ${
                                        red.is_blocked
                                          ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                                          : "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                                      }`}
                                      title={red.is_blocked ? "Buka Blokir Penukaran" : "Blokir Penukaran"}
                                    >
                                      {red.is_blocked ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteRedemption(red)}
                                      className="p-1.5 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-all"
                                      title="Hapus Penukaran"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
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
            ) : (
              <form onSubmit={handleSaveSettings} className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-8 shadow-sm max-w-2xl mx-auto space-y-6">
                <h3 className="text-lg font-black text-text-light dark:text-text-dark uppercase tracking-tight border-b border-border-light dark:border-border-dark pb-3 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" /> Pengaturan Sistem Reward Point
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div className="flex items-center justify-between sm:col-span-2 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-border-light dark:border-border-dark">
                     <div>
                       <label className="text-sm font-black text-text-light dark:text-text-dark uppercase tracking-wide block font-bold">Status Modul Point</label>
                       <span className="text-[10px] text-muted font-bold">Aktifkan atau nonaktifkan sistem poin pesanan pelanggan.</span>
                     </div>
                     <label className="relative inline-flex items-center cursor-pointer">
                       <input 
                         type="checkbox" 
                         checked={settings.isPointsEnabled} 
                         onChange={e => setSettings({ ...settings, isPointsEnabled: e.target.checked })}
                         className="sr-only peer" 
                         title="Status Modul Point"
                         aria-label="Status Modul Point"
                       />
                       <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-750 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary" />
                     </label>
                   </div>

                   <div className="flex items-center justify-between sm:col-span-2 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-border-light dark:border-border-dark">
                     <div>
                       <label className="text-sm font-black text-text-light dark:text-text-dark uppercase tracking-wide block font-bold">Hadiah Selamat Datang (Welcome Gift)</label>
                       <span className="text-[10px] text-muted font-bold">Aktifkan pop-up ucapan selamat datang dan bonus poin gratis untuk akun baru saat login pertama kali.</span>
                     </div>
                     <label className="relative inline-flex items-center cursor-pointer">
                       <input 
                         type="checkbox" 
                         checked={settings.welcomeGiftEnabled} 
                         onChange={e => setSettings({ ...settings, welcomeGiftEnabled: e.target.checked })}
                         className="sr-only peer" 
                         title="Status Hadiah Selamat Datang"
                         aria-label="Status Hadiah Selamat Datang"
                       />
                       <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-750 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary" />
                     </label>
                   </div>

                   {settings.welcomeGiftEnabled && (
                     <div className="sm:col-span-2">
                       <label htmlFor="welcomeGiftPoints" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Jumlah Poin Selamat Datang</label>
                       <input 
                         id="welcomeGiftPoints"
                         type="number" 
                         required
                         min={1}
                         value={settings.welcomeGiftPoints} 
                         onChange={e => setSettings({ ...settings, welcomeGiftPoints: e.target.value })}
                         placeholder="1000"
                         title="Jumlah Poin Selamat Datang"
                         className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                       />
                     </div>
                   )}

                  <div>
                    <label htmlFor="minRandomPoints" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Minimal Poin Random</label>
                    <input 
                      id="minRandomPoints"
                      type="number" 
                      required
                      min={0}
                      value={settings.minRandomPoints} 
                      onChange={e => setSettings({ ...settings, minRandomPoints: e.target.value })}
                      placeholder="0"
                      title="Minimal Poin Random"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>

                  <div>
                    <label htmlFor="maxRandomPoints" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Maksimal Poin Random</label>
                    <input 
                      id="maxRandomPoints"
                      type="number" 
                      required
                      min={1}
                      value={settings.maxRandomPoints} 
                      onChange={e => setSettings({ ...settings, maxRandomPoints: e.target.value })}
                      placeholder="100"
                      title="Maksimal Poin Random"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>

                  <div>
                    <label htmlFor="pointsExpiryDays" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Masa Aktif Poin (Hari)</label>
                    <input 
                      id="pointsExpiryDays"
                      type="number" 
                      required
                      min={1}
                      value={settings.pointsExpiryDays} 
                      onChange={e => setSettings({ ...settings, pointsExpiryDays: e.target.value })}
                      placeholder="365"
                      title="Masa Aktif Poin (Hari)"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>

                  <div>
                    <label htmlFor="maxPointsPerTransaction" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Maksimal Poin Per Transaksi</label>
                    <input 
                      id="maxPointsPerTransaction"
                      type="number" 
                      required
                      min={1}
                      value={settings.maxPointsPerTransaction} 
                      onChange={e => setSettings({ ...settings, maxPointsPerTransaction: e.target.value })}
                      placeholder="1000"
                      title="Maksimal Poin Per Transaksi"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>

                  <div>
                    <label htmlFor="bonusNewCustomer" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Bonus Pelanggan Baru</label>
                    <input 
                      id="bonusNewCustomer"
                      type="number" 
                      required
                      min={0}
                      value={settings.bonusNewCustomer} 
                      onChange={e => setSettings({ ...settings, bonusNewCustomer: e.target.value })}
                      placeholder="25"
                      title="Bonus Pelanggan Baru"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>

                  <div>
                    <label htmlFor="bonusBirthday" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Bonus Ulang Tahun Pelanggan</label>
                    <input 
                      id="bonusBirthday"
                      type="number" 
                      required
                      min={0}
                      value={settings.bonusBirthday} 
                      onChange={e => setSettings({ ...settings, bonusBirthday: e.target.value })}
                      placeholder="50"
                      title="Bonus Ulang Tahun Pelanggan"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>

                  <div>
                    <label htmlFor="multiplier" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Poin Multiplier Global (x1, x2, x3)</label>
                    <select 
                      id="multiplier"
                      value={settings.multiplier} 
                      onChange={e => setSettings({ ...settings, multiplier: Number(e.target.value) })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                      title="Multiplier"
                    >
                      <option value={1}>x1 (Normal)</option>
                      <option value={2}>x2 (Ganda)</option>
                      <option value={3}>x3 (Triple)</option>
                    </select>
                  </div>
                </div>

                <h3 className="text-lg font-black text-text-light dark:text-text-dark uppercase tracking-tight border-b border-border-light dark:border-border-dark pb-3 pt-6 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" /> Pengaturan E-Wallet (Dompetku)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="flex items-center justify-between sm:col-span-2 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-border-light dark:border-border-dark">
                    <div>
                      <label className="text-sm font-black text-text-light dark:text-text-dark uppercase tracking-wide block">Metode Pembayaran Online</label>
                      <span className="text-[10px] text-muted font-bold">Aktifkan integrasi isi saldo dompet via gerbang pembayaran online.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings.isDuitkuEnabled} 
                        onChange={e => setSettings({ ...settings, isDuitkuEnabled: e.target.checked })}
                        className="sr-only peer" 
                        title="Status Pembayaran Online"
                        aria-label="Status Pembayaran Online"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-750 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between sm:col-span-2 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-border-light dark:border-border-dark">
                    <div>
                      <label className="text-sm font-black text-text-light dark:text-text-dark uppercase tracking-wide block">Status Cashback Dompetku</label>
                      <span className="text-[10px] text-muted font-bold">Aktifkan pemberian cashback otomatis ke dompet saat pelanggan menukarkan reward cashback.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings.isCashbackEnabled} 
                        onChange={e => setSettings({ ...settings, isCashbackEnabled: e.target.checked })}
                        className="sr-only peer" 
                        title="Status Cashback"
                        aria-label="Status Cashback"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-750 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary" />
                    </label>
                  </div>

                  <div className="flex items-center justify-between sm:col-span-2 bg-gray-50 dark:bg-gray-800/40 p-4 rounded-2xl border border-border-light dark:border-border-dark">
                    <div>
                      <label className="text-sm font-black text-text-light dark:text-text-dark uppercase tracking-wide block">Auto Refund ke Dompetku</label>
                      <span className="text-[10px] text-muted font-bold">Dana pesanan dibatalkan otomatis refund ke wallet Dompetku pelanggan.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={settings.isAutoRefundEnabled} 
                        onChange={e => setSettings({ ...settings, isAutoRefundEnabled: e.target.checked })}
                        className="sr-only peer" 
                        title="Auto Refund"
                        aria-label="Auto Refund"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-750 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary" />
                    </label>
                  </div>

                  <div>
                    <label htmlFor="minTopup" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Minimal Top Up (Rp)</label>
                    <input 
                      id="minTopup"
                      type="number" 
                      required
                      min={0}
                      value={settings.minTopup} 
                      onChange={e => setSettings({ ...settings, minTopup: e.target.value })}
                      placeholder="10000"
                      title="Minimal Top Up"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>

                  <div>
                    <label htmlFor="maxTopup" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Maksimal Top Up (Rp)</label>
                    <input 
                      id="maxTopup"
                      type="number" 
                      required
                      min={0}
                      value={settings.maxTopup} 
                      onChange={e => setSettings({ ...settings, maxTopup: e.target.value })}
                      placeholder="2000000"
                      title="Maksimal Top Up"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>

                  <div>
                    <label htmlFor="walletAdminFee" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Biaya Admin per Top Up (Rp)</label>
                    <input 
                      id="walletAdminFee"
                      type="number" 
                      required
                      min={0}
                      value={settings.walletAdminFee} 
                      onChange={e => setSettings({ ...settings, walletAdminFee: e.target.value })}
                      placeholder="0"
                      title="Biaya Admin per Top Up"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>

                  <div>
                    <label htmlFor="topupExpiryMinutes" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Batas Waktu Pembayaran (Menit)</label>
                    <input 
                      id="topupExpiryMinutes"
                      type="number" 
                      required
                      min={1}
                      value={settings.topupExpiryMinutes} 
                      onChange={e => setSettings({ ...settings, topupExpiryMinutes: e.target.value })}
                      placeholder="15"
                      title="Batas Waktu Pembayaran (Menit)"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-border-light dark:border-border-dark flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Simpan Pengaturan</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </>
      )}

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setShowDeleteConfirm(false); setDeleteTargetId(null); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.85, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 20, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className="relative bg-white dark:bg-card-dark rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full border border-gray-200 dark:border-gray-800"
            >
              <div className="p-6 flex flex-col items-center text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
                  <Trash2 className="w-7 h-7 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mb-1">Hapus Reward?</h3>
                  <p className="text-sm text-muted">Apakah Anda yakin ingin menghapus reward ini secara permanen? Tindakan ini tidak dapat dibatalkan.</p>
                </div>
                <div className="flex gap-3 w-full mt-2">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteTargetId(null); }}
                    disabled={deleting}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-60"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmDeleteReward}
                    disabled={deleting}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {deleting ? "Menghapus..." : "Hapus Permanen"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 1. Add / Edit Reward Dialog Modal */}
      <AnimatePresence>
        {showRewardModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRewardModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }} className="relative bg-white dark:bg-card-dark w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-800">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
                  <Gift className="w-5 h-5 text-primary" /> {currentReward ? "Edit Katalog Reward" : "Tambah Reward Baru"}
                </h3>
                <button onClick={() => setShowRewardModal(false)} title="Tutup" className="p-2 hover:bg-gray-100 rounded-xl transition-all"><X className="w-5 h-5 text-muted" /></button>
              </div>

              <form onSubmit={handleSaveReward} className="overflow-y-auto p-6 space-y-5 flex-1 custom-scrollbar">
                <div>
                  <label htmlFor="rewardTitle" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Nama / Judul Reward</label>
                  <input 
                    id="rewardTitle"
                    type="text" 
                    required 
                    value={rewardForm.title} 
                    onChange={e => setRewardForm({ ...rewardForm, title: e.target.value })} 
                    placeholder="Contoh: Voucher Diskon 20%" 
                    title="Nama / Judul Reward"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                  />
                </div>

                <div>
                  <label htmlFor="rewardCategory" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Kategori Reward</label>
                  <select 
                    id="rewardCategory"
                    value={rewardForm.category} 
                    onChange={e => setRewardForm({ ...rewardForm, category: e.target.value })} 
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                    title="Kategori Reward"
                  >
                    <option value="voucher">Voucher Diskon</option>
                    <option value="food">Makanan / Minuman</option>
                    <option value="cashback">Cashback Saldo</option>
                    <option value="product">Produk Promo</option>
                    <option value="custom">Reward Custom</option>
                  </select>
                </div>

                {rewardForm.category === "voucher" && (
                  <div>
                    <label htmlFor="rewardDiscountPercent" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Diskon (%)</label>
                    <input 
                      id="rewardDiscountPercent"
                      type="number" 
                      min={1} 
                      max={100}
                      value={rewardForm.discountPercent} 
                      onChange={e => setRewardForm({ ...rewardForm, discountPercent: e.target.value })} 
                      placeholder="10"
                      title="Diskon (%)"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>
                )}
 
                {rewardForm.category === "cashback" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
                      <div>
                        <label htmlFor="isAutoCashbackSwitch" className="text-xs font-bold text-text-light dark:text-text-dark cursor-pointer">Pemberian Saldo Otomatis</label>
                        <p className="text-[10px] text-muted font-medium mt-0.5">Cashback otomatis bernilai Rp 100 per Poin penukaran</p>
                      </div>
                      <input 
                        id="isAutoCashbackSwitch"
                        type="checkbox" 
                        checked={rewardForm.isAutoCashback}
                        onChange={e => setRewardForm({ ...rewardForm, isAutoCashback: e.target.checked })}
                        className="w-4 h-4 text-primary rounded outline-none cursor-pointer"
                        title="Pemberian Saldo Otomatis"
                      />
                    </div>
 
                    {!rewardForm.isAutoCashback ? (
                      <div>
                        <label htmlFor="rewardCashbackAmount" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Nominal Saldo Cashback (Rp)</label>
                        <input 
                          id="rewardCashbackAmount"
                          type="number" 
                          min={0}
                          value={rewardForm.cashbackAmount} 
                          onChange={e => setRewardForm({ ...rewardForm, cashbackAmount: e.target.value })} 
                          placeholder="5000"
                          title="Nominal Saldo Cashback (Rp)"
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                        />
                      </div>
                    ) : (
                      <div className="p-3.5 bg-primary/5 rounded-xl border border-primary/10 text-primary text-xs font-bold flex items-center gap-2">
                        <Wallet className="w-4 h-4 shrink-0" />
                        <span>Estimasi Cashback: Rp {(Number(rewardForm.minPoints || 0) * 100).toLocaleString("id-ID")} (Otomatis)</span>
                      </div>
                    )}
                  </div>
                )}
 
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="rewardMinPoints" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Minimal Poin</label>
                    <input 
                      id="rewardMinPoints"
                      type="number" 
                      required 
                      min={0}
                      value={rewardForm.minPoints} 
                      onChange={e => setRewardForm({ ...rewardForm, minPoints: e.target.value })} 
                      placeholder="50"
                      title="Minimal Poin"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>

                  <div>
                    <label htmlFor="rewardStock" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Stok Ketersediaan</label>
                    <input 
                      id="rewardStock"
                      type="number" 
                      value={rewardForm.stock} 
                      onChange={e => setRewardForm({ ...rewardForm, stock: e.target.value })} 
                      placeholder="Kosongkan jika tak terbatas"
                      title="Stok Ketersediaan"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="rewardExpiryDays" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Masa Berlaku Reward Setelah Ditukar (Hari)</label>
                  <input 
                    id="rewardExpiryDays"
                    type="number" 
                    min={1}
                    value={rewardForm.expiryDays} 
                    onChange={e => setRewardForm({ ...rewardForm, expiryDays: e.target.value })} 
                    placeholder="Kosongkan jika tanpa batas waktu (selamanya)"
                    title="Masa Berlaku Reward Setelah Ditukar (Hari)"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                  />
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/45 p-4 rounded-2xl border border-gray-150 dark:border-gray-800 space-y-4">
                  <span className="text-[10px] font-black uppercase text-muted tracking-widest block font-extrabold">Batas Kuota Penukaran Pelanggan</span>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="rewardRedeemLimit" className="text-[9px] font-black uppercase text-muted tracking-widest mb-1.5 block">Kuota (x)</label>
                      <input 
                        id="rewardRedeemLimit"
                        type="number" 
                        min={1}
                        value={rewardForm.redeemLimit} 
                        onChange={e => setRewardForm({ ...rewardForm, redeemLimit: e.target.value })} 
                        placeholder="Bebas"
                        title="Batas Penukaran Pelanggan"
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                      />
                    </div>

                    <div>
                      <label htmlFor="rewardRedeemLimitValue" className="text-[9px] font-black uppercase text-muted tracking-widest mb-1.5 block">Durasi</label>
                      <input 
                        id="rewardRedeemLimitValue"
                        type="number" 
                        min={1}
                        disabled={rewardForm.redeemLimitPeriod === "all"}
                        value={rewardForm.redeemLimitPeriod === "all" ? "" : rewardForm.redeemLimitValue} 
                        onChange={e => setRewardForm({ ...rewardForm, redeemLimitValue: e.target.value })} 
                        placeholder="1"
                        title="Durasi Batas"
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark disabled:opacity-50 disabled:bg-gray-100" 
                      />
                    </div>

                    <div>
                      <label htmlFor="rewardRedeemLimitPeriod" className="text-[9px] font-black uppercase text-muted tracking-widest mb-1.5 block">Unit Periode</label>
                      <select 
                        id="rewardRedeemLimitPeriod"
                        value={rewardForm.redeemLimitPeriod} 
                        onChange={e => setRewardForm({ ...rewardForm, redeemLimitPeriod: e.target.value })} 
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                        title="Periode Batas"
                      >
                        <option value="all">Selamanya</option>
                        <option value="minute">Menit</option>
                        <option value="hour">Jam</option>
                        <option value="day">Hari</option>
                        <option value="week">Minggu</option>
                        <option value="month">Bulan</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="rewardExpiresAt" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Tanggal Kadaluarsa Katalog (Selesai Tayang)</label>
                  <input 
                    id="rewardExpiresAt"
                    type="datetime-local" 
                    value={rewardForm.expiresAt} 
                    onChange={e => setRewardForm({ ...rewardForm, expiresAt: e.target.value })} 
                    title="Tanggal Kadaluarsa Katalog"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                  />
                  <p className="text-[10px] text-muted mt-1">Kosongkan jika reward ingin selalu tampil di katalog pelanggan.</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="rewardDescription" className="text-[10px] font-black uppercase text-muted tracking-widest">Deskripsi Reward</label>
                    <button
                      type="button"
                      onClick={generateAutoDescription}
                      className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase tracking-wide hover:bg-primary/20 transition-all"
                    >
                      <Sparkles className="w-3 h-3" /> Generate Otomatis
                    </button>
                  </div>
                  <textarea 
                    id="rewardDescription"
                    rows={3} 
                    value={rewardForm.description} 
                    onChange={e => setRewardForm({ ...rewardForm, description: e.target.value })} 
                    placeholder="Klik 'Generate Otomatis' atau tulis deskripsi reward secara manual."
                    title="Deskripsi Reward"
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                  />
                </div>

                <div className="p-4 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-200/50 dark:border-gray-800 rounded-2xl">
                  <label htmlFor="rewardImageUrl" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Image URL / Link Foto Reward</label>
                  <input 
                    id="rewardImageUrl"
                    type="url" 
                    value={rewardForm.imageUrl} 
                    onChange={e => setRewardForm({ ...rewardForm, imageUrl: e.target.value })} 
                    placeholder="https://..." 
                    title="Image URL / Link Foto Reward"
                    className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-xs outline-none focus:ring-2 focus:ring-primary font-medium text-text-light dark:text-text-dark" 
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={saving} 
                  className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 flex items-center justify-center gap-2 hover:bg-primary-hover uppercase tracking-wider"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Simpan Reward</>}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Customer Manual points control Sheet Modal */}
      <AnimatePresence>
        {showAdjustModal && selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdjustModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-card-dark w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-800">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                <div>
                  <h3 className="font-black text-lg text-gray-900 dark:text-white uppercase tracking-tight">Detail & Kelola Poin</h3>
                  <p className="text-[10px] text-muted font-bold mt-0.5">Pelanggan: {selectedCustomer.full_name} ({selectedCustomer.email || "Tanpa Email"})</p>
                </div>
                <button onClick={() => setShowAdjustModal(false)} title="Tutup" className="p-2 hover:bg-gray-100 rounded-xl transition-all"><X className="w-5 h-5 text-muted" /></button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                {/* Profile points card */}
                <div className="grid grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-border-light dark:border-border-dark text-center">
                  <div>
                    <span className="text-[9px] font-black text-muted uppercase tracking-wider block">Poin Aktif</span>
                    <span className="text-xl font-mono font-black text-primary">{selectedCustomer.points || 0}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-muted uppercase tracking-wider block">Poin Pending</span>
                    <span className="text-xl font-mono font-black text-amber-500">{selectedCustomer.pending_points || 0}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-muted uppercase tracking-wider block">Saldo Dompet</span>
                    <span className="text-base font-mono font-black text-emerald-600 dark:text-emerald-400">Rp {Number(selectedCustomer.wallet_balance || 0).toLocaleString("id-ID")}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Adjustment Form */}
                  <form onSubmit={handleAdjustPointsSubmit} className="space-y-4 border-r border-border-light dark:border-border-dark pr-0 md:pr-6">
                    <h4 className="font-bold text-xs uppercase tracking-widest text-muted">Penyesuaian Manual</h4>
                    
                    <div>
                      <label htmlFor="adjustAction" className="text-[9px] font-black uppercase text-muted tracking-widest mb-1.5 block">Pilih Aksi</label>
                      <select 
                        id="adjustAction"
                        value={adjustForm.action} 
                        onChange={e => setAdjustForm({ ...adjustForm, action: e.target.value })} 
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                        title="Pilih Aksi"
                      >
                        <option value="adjust">Tambah / Kurangi Poin</option>
                        <option value="reset">Reset Poin ke 0</option>
                        <option value="adjust_wallet">Tambah / Kurangi Saldo Dompet (Rp)</option>
                        <option value="reset_wallet">Reset Saldo Dompet ke Rp 0</option>
                        <option value="toggle_wallet_block">Blokir / Buka Blokir Dompet</option>
                      </select>
                    </div>

                    {["adjust", "adjust_wallet"].includes(adjustForm.action) && (
                      <div>
                        <label htmlFor="adjustAmount" className="text-[9px] font-black uppercase text-muted tracking-widest mb-1.5 block">
                          {adjustForm.action === "adjust" ? "Jumlah Poin (Negatif untuk kurangi)" : "Jumlah Saldo Rp (Negatif untuk kurangi)"}
                        </label>
                        <input 
                          id="adjustAmount"
                          type="number" 
                          required 
                          placeholder={adjustForm.action === "adjust" ? "Misal: 50 atau -25" : "Misal: 50000 atau -20000"}
                          title="Jumlah"
                          value={adjustForm.amount} 
                          onChange={e => setAdjustForm({ ...adjustForm, amount: e.target.value })} 
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                        />
                      </div>
                    )}

                    {adjustForm.action !== "toggle_wallet_block" && (
                      <div>
                        <label htmlFor="adjustReason" className="text-[9px] font-black uppercase text-muted tracking-widest mb-1.5 block">Alasan Penyesuaian</label>
                        <textarea 
                          id="adjustReason"
                          rows={2} 
                          required
                          placeholder={adjustForm.action.includes("wallet") ? "Masukkan alasan manipulasi saldo..." : "Masukkan alasan manipulasi poin..."}
                          title="Alasan Penyesuaian"
                          value={adjustForm.reason} 
                          onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })} 
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                        />
                      </div>
                    )}

                    <button 
                      type="submit" 
                      disabled={saving}
                      className="w-full py-3 bg-primary text-white font-black rounded-xl shadow-md hover:shadow-lg transition-all text-xs uppercase tracking-wider"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Eksekusi Penyesuaian"}
                    </button>
                  </form>

                  {/* Customer Transaction Logs */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-border-light dark:border-border-dark pb-2">
                      <h4 className="font-bold text-xs uppercase tracking-widest text-muted">Log Riwayat</h4>
                      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg text-[10px] shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveLogsTab("points")}
                          className={`px-2 py-1 rounded font-bold transition-all ${
                            activeLogsTab === "points" ? "bg-primary text-white" : "text-muted"
                          }`}
                        >
                          Poin ({customerTxLogs.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveLogsTab("wallet")}
                          className={`px-2 py-1 rounded font-bold transition-all ${
                            activeLogsTab === "wallet" ? "bg-primary text-white" : "text-muted"
                          }`}
                        >
                          Dompet ({customerWalletTxLogs.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveLogsTab("quota")}
                          className={`px-2 py-1 rounded font-bold transition-all ${
                            activeLogsTab === "quota" ? "bg-primary text-white" : "text-muted"
                          }`}
                        >
                          Kuota Reward
                        </button>
                      </div>
                    </div>
                    
                    {loadingLogs ? (
                      <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                    ) : activeLogsTab === "points" ? (
                      customerTxLogs.length === 0 ? (
                        <div className="text-center py-10 text-muted text-[11px]">Belum ada aktivitas poin</div>
                      ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                          {customerTxLogs.map((tx) => (
                            <div key={tx.id} className="p-3 bg-gray-50/50 dark:bg-gray-900/30 border border-border-light/30 dark:border-border-dark/30 rounded-xl text-[11px] flex justify-between items-start gap-3">
                              <div>
                                <p className="font-bold text-text-light dark:text-text-dark">{tx.description}</p>
                                <span className="text-[9px] text-muted">{format(new Date(tx.created_at), "dd MMM yyyy, HH:mm", { locale: id })}</span>
                              </div>
                              <span className={`font-mono font-black text-xs shrink-0 ${tx.points > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {tx.points > 0 ? `+${tx.points}` : tx.points}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    ) : activeLogsTab === "wallet" ? (
                      customerWalletTxLogs.length === 0 ? (
                        <div className="text-center py-10 text-muted text-[11px]">Belum ada aktivitas dompet</div>
                      ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                          {customerWalletTxLogs.map((tx) => {
                            const isPositive = ["topup", "refund", "cashback", "adjust"].includes(tx.type) && tx.status === "success" ? tx.amount > 0 : false;
                            return (
                              <div key={tx.id} className="p-3 bg-gray-50/50 dark:bg-gray-900/30 border border-border-light/30 dark:border-border-dark/30 rounded-xl text-[11px] flex justify-between items-start gap-3">
                                <div>
                                  <p className="font-bold text-text-light dark:text-text-dark">{tx.description}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[8px] px-1 py-0.2 bg-gray-200 dark:bg-gray-800 text-muted uppercase font-black tracking-wide rounded">
                                      {tx.type}
                                    </span>
                                    <span className="text-[9px] text-muted">{format(new Date(tx.created_at), "dd MMM yyyy, HH:mm", { locale: id })}</span>
                                  </div>
                                </div>
                                <span className={`font-mono font-black text-xs shrink-0 ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                  {isPositive ? "+" : "-"}Rp {Math.abs(Number(tx.amount)).toLocaleString("id-ID")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )
                    ) : (
                      rewards.filter(r => r.redeem_limit !== null && r.redeem_limit > 0).length === 0 ? (
                        <div className="text-center py-10 text-muted text-[11px]">Belum ada reward dengan batas kuota penukaran</div>
                      ) : (
                        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                          {rewards
                            .filter(r => r.redeem_limit !== null && r.redeem_limit > 0)
                            .map((reward) => {
                              const activeReds = getCustomerActiveRedemptionsCount(reward, selectedCustomer.id);
                              const count = activeReds.length;
                              const limit = reward.redeem_limit;
                              const period = reward.redeem_limit_period;
                              const value = reward.redeem_limit_value || 1;

                              let periodLabel = "";
                              if (period === "all") periodLabel = "selamanya";
                              else {
                                const unitLabel = 
                                  period === "minute" ? "menit" :
                                  period === "hour" ? "jam" :
                                  period === "day" ? "hari" :
                                  period === "week" ? "minggu" :
                                  period === "month" ? "bulan" : "periode";
                                periodLabel = `per ${value} ${unitLabel}`;
                              }

                              return (
                                <div key={reward.id} className="p-3 bg-gray-50/50 dark:bg-gray-900/30 border border-border-light/30 dark:border-border-dark/30 rounded-xl text-[11px] space-y-2">
                                  <div className="flex justify-between items-start gap-2">
                                    <div>
                                      <p className="font-bold text-text-light dark:text-text-dark">{reward.title}</p>
                                      <p className="text-[9px] text-muted font-medium uppercase tracking-wide">Limit: {limit}x {periodLabel}</p>
                                    </div>
                                    <span className={`font-mono font-black text-xs shrink-0 px-2 py-0.5 rounded ${count >= limit ? "bg-red-50 text-red-600 border border-red-200" : "bg-primary/10 text-primary"}`}>
                                      {count}/{limit} Aktif
                                    </span>
                                  </div>
                                  
                                  {count > 0 && (
                                    <div className="flex gap-2 justify-end pt-1">
                                      <button
                                        type="button"
                                        onClick={() => handleAdjustQuota('reduce', reward, selectedCustomer.id)}
                                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all"
                                      >
                                        Kurangi 1
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleAdjustQuota('reset', reward, selectedCustomer.id)}
                                        className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all"
                                      >
                                        Reset Kuota (0)
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Block Redemption Modal */}
      <AnimatePresence>
        {showBlockModal && selectedRedemption && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowBlockModal(false)} 
              className="absolute inset-0 bg-black/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="relative bg-white dark:bg-card-dark w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 border border-gray-150 dark:border-gray-800 z-10 space-y-6 text-center"
            >
              <div>
                <div className="w-16 h-16 bg-red-50 dark:bg-red-950/20 mx-auto rounded-2xl flex items-center justify-center mb-4 border border-red-200/50">
                  <Ban className="w-8 h-8 text-red-650" />
                </div>
                <h3 className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tight">Blokir Reward Pelanggan?</h3>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Blokir penukaran reward <span className="font-bold text-text-light dark:text-text-dark">&ldquo;{selectedRedemption.rewards?.title}&rdquo;</span> milik <span className="font-bold text-text-light dark:text-text-dark">{selectedRedemption.profiles?.full_name}</span>.
                </p>
              </div>

              <div className="space-y-2 text-left">
                <label htmlFor="blockReasonInput" className="text-[10px] font-black uppercase text-muted tracking-widest block">Alasan Pemblokiran / Peringatan Kustom</label>
                <textarea 
                  id="blockReasonInput"
                  rows={3} 
                  required
                  placeholder="Misal: Reward ditangguhkan karena pelanggaran ketentuan penggunaan atau transaksi mencurigakan."
                  value={blockReason} 
                  onChange={e => setBlockReason(e.target.value)} 
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-xl p-3.5 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowBlockModal(false)} 
                  className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-xs uppercase"
                >
                  Batal
                </button>
                <button 
                  onClick={() => confirmToggleBlockRedemption(selectedRedemption, true, blockReason)} 
                  disabled={!blockReason.trim()}
                  className="flex-1 py-3.5 bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 hover:bg-red-750 transition-all disabled:opacity-50 text-xs uppercase"
                >
                  Ya, Blokir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Redemption Confirmation Modal */}
      <AnimatePresence>
        {showDeleteRedemptionConfirm && selectedRedemptionForDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowDeleteRedemptionConfirm(false)} 
              className="absolute inset-0 bg-black/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="relative bg-white dark:bg-card-dark w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center border border-gray-100 dark:border-gray-800 z-10 space-y-4"
            >
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/20 mx-auto rounded-2xl flex items-center justify-center mb-2 border border-red-200">
                <Trash2 className="w-8 h-8 text-red-650" />
              </div>
              <h3 className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tight">Hapus Penukaran?</h3>
              <p className="text-xs text-muted leading-relaxed font-medium">
                Apakah Anda yakin ingin menghapus data penukaran reward <span className="font-bold text-text-light dark:text-text-dark">&ldquo;{selectedRedemptionForDelete.rewards?.title}&rdquo;</span> milik <span className="font-bold text-text-light dark:text-text-dark">{selectedRedemptionForDelete.profiles?.full_name}</span>?
              </p>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/15 rounded-2xl text-[10px] text-amber-700 dark:text-amber-450 font-bold border border-amber-200/50">
                Tindakan ini tidak dapat dibatalkan. Reward akan langsung hilang dari halaman &ldquo;Reward Saya&rdquo; pelanggan secara real-time.
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteRedemptionConfirm(false)} 
                  className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-xs uppercase"
                >
                  Batal
                </button>
                <button 
                  onClick={confirmDeleteRedemption} 
                  className="flex-1 py-3.5 bg-red-650 text-white font-black rounded-2xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 hover:bg-red-700 transition-all text-xs uppercase"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
