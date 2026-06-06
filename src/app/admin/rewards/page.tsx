"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Gift, Trophy, Award, Calendar, AlertCircle, Clock, 
  CheckCircle, HelpCircle, RefreshCw, Loader2, Plus, Edit2,
  Trash2, Settings, Users, BarChart3, ShieldAlert, X,
  Save, Ban, Unlock, RefreshCcw, Wallet, ArrowDown, ArrowUp,
  Ticket, Sparkles, ShoppingBag, Truck
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import toast from "react-hot-toast";
import BaseModal from "@/components/BaseModal";
import { createClient } from "@/lib/supabase/client";
import { downloadFile } from "@/utils/downloadHelper";
import dynamic from "next/dynamic";

const LazyRewardsChart = dynamic(
  () => import("@/components/charts/RewardsChart"),
  { ssr: false, loading: () => <div className="h-64 w-full bg-gray-100 dark:bg-gray-800 animate-pulse rounded-2xl" /> }
);

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
    action: "adjust", // adjust, set, reset, update_status
    amount: "",
    reason: "",
    status: "aktif"
  });
  const [customerTxLogs, setCustomerTxLogs] = useState<any[]>([]);
  const [customerWalletTxLogs, setCustomerWalletTxLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [activeLogsTab, setActiveLogsTab] = useState<"points" | "wallet" | "quota" | "rewards">("points");

  // Customer points search/filter & bulk action states
  const [custSearchQuery, setCustSearchQuery] = useState("");
  const [custStatusFilter, setCustStatusFilter] = useState("all");
  const [selectedCustIds, setSelectedCustIds] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'adjust' | 'reset' | 'status' | null>(null);
  const [bulkForm, setBulkForm] = useState({
    amount: "",
    reason: "",
    status: "aktif"
  });
  const [bulkSaving, setBulkSaving] = useState(false);

  // Detail customer logs date & type filter
  const [activePointsTab, setActivePointsTab] = useState<"semua" | "masuk" | "keluar" | "pending" | "dibatalkan" | "reward" | "order" | "refund" | "manual">("semua");
  const [txStartDate, setTxStartDate] = useState("");
  const [txEndDate, setTxEndDate] = useState("");
  const [txSearchQuery, setTxSearchQuery] = useState("");

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
    if (showAdjustModal || showBulkModal || showRewardModal || showBlockModal || showDeleteConfirm || showDeleteRedemptionConfirm) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showAdjustModal, showBulkModal, showRewardModal, showBlockModal, showDeleteConfirm, showDeleteRedemptionConfirm]);

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
    } else if (category === "shipping") {
      const disc = Number(discountPercent) || 0;
      desc = `${title || "Reward ini"} memberikan diskon ongkos kirim sebesar ${disc}% untuk pesanan delivery RestoBook. Dapat ditukar dengan minimal ${pts} poin. ${exp}`;
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
      reason: "",
      status: cust.points_status || "aktif"
    });
    setCustomerTxLogs([]);
    setCustomerWalletTxLogs([]);
    setActivePointsTab("semua");
    setTxStartDate("");
    setTxEndDate("");
    setTxSearchQuery("");
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
    if (!adjustForm.reason.trim()) {
      toast.error("Alasan penyesuaian wajib diisi!");
      return;
    }
    
    // Client-side negative validation
    if (adjustForm.action === 'adjust' && Number(adjustForm.amount) < 0) {
      const currentPoints = selectedCustomer.points || 0;
      if (currentPoints + Number(adjustForm.amount) < 0) {
        toast.error("Saldo poin aktif tidak mencukupi untuk dikurangi.");
        return;
      }
    }

    // Client-side validation for 'set' action
    if (adjustForm.action === 'set') {
      const target = Number(adjustForm.amount);
      if (isNaN(target) || target < 0) {
        toast.error("Nominal poin target tidak valid (harus lebih besar atau sama dengan 0).");
        return;
      }
    }

    const confirmMsg = adjustForm.action === 'reset'
      ? "APAKAH ANDA YAKIN? Tindakan ini akan menghapus semua poin aktif pelanggan menjadi 0. Konfirmasi reset poin pelanggan?"
      : adjustForm.action === 'set'
      ? `Apakah Anda yakin ingin mengubah total poin aktif pelanggan menjadi ${adjustForm.amount} poin?`
      : adjustForm.action === 'update_status'
      ? `Apakah Anda yakin ingin mengubah status poin pelanggan menjadi '${adjustForm.status}'?`
      : `Apakah Anda yakin ingin melakukan penyesuaian poin sebesar ${adjustForm.amount} poin untuk pelanggan ini?`;

    if (!window.confirm(confirmMsg)) return;

    setSaving(true);
    const loadingToast = toast.loading("Memproses penyesuaian...");
    try {
      const res = await fetch("/api/admin/customers/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          action: adjustForm.action,
          amount: ["reset"].includes(adjustForm.action) ? 0 : Number(adjustForm.amount),
          status: adjustForm.action === "update_status" ? adjustForm.status : "",
          reason: adjustForm.reason.trim()
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
    const nextStatus = !cust.is_redeem_blocked;
    const reason = nextStatus ? "Akses penukaran diblokir oleh admin" : "Akses penukaran dibuka oleh admin";
    const loadingToast = toast.loading("Mengubah status blokir pelanggan...");
    try {
      const res = await fetch("/api/admin/customers/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: cust.id,
          action: "update_status",
          status: nextStatus ? "diblokir" : "aktif",
          reason: reason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status blokir");

      toast.success(nextStatus ? "Akses redeem berhasil diblokir!" : "Akses redeem berhasil dibuka!", { id: loadingToast });
      fetchAdminData();
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    }
  };

  const handleApprovePending = async (txId: string, custId: string) => {
    const reason = window.prompt("Masukkan alasan menyetujui poin pending:");
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error("Alasan persetujuan wajib diisi!");
      return;
    }

    const loadingToast = toast.loading("Menyetujui poin pending...");
    try {
      const res = await fetch("/api/admin/customers/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_pending",
          customerId: custId,
          transactionId: txId,
          reason: reason.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyetujui poin");

      toast.success("Poin pending berhasil disetujui!", { id: loadingToast });
      fetchAdminData();
      
      // Refresh current customer logs if open
      if (selectedCustomer && selectedCustomer.id === custId) {
        // Find updated customer object
        const updatedCust = customers.find(c => c.id === custId) || selectedCustomer;
        handleOpenAdjustModal(updatedCust);
      }
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    }
  };

  const handleRejectPending = async (txId: string, custId: string) => {
    const reason = window.prompt("Masukkan alasan menolak poin pending:");
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error("Alasan penolakan wajib diisi!");
      return;
    }

    const loadingToast = toast.loading("Menolak poin pending...");
    try {
      const res = await fetch("/api/admin/customers/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject_pending",
          customerId: custId,
          transactionId: txId,
          reason: reason.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menolak poin");

      toast.success("Poin pending berhasil ditolak!", { id: loadingToast });
      fetchAdminData();

      // Refresh current customer logs if open
      if (selectedCustomer && selectedCustomer.id === custId) {
        const updatedCust = customers.find(c => c.id === custId) || selectedCustomer;
        handleOpenAdjustModal(updatedCust);
      }
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    }
  };

  const handleBulkActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCustIds.length === 0 || !bulkAction) return;
    if (!bulkForm.reason.trim()) {
      toast.error("Alasan penyesuaian massal wajib diisi!");
      return;
    }
    setBulkSaving(true);
    const loadingToast = toast.loading("Memproses aksi massal...");
    try {
      let apiAction = "";
      if (bulkAction === "adjust") apiAction = "bulk_adjust";
      else if (bulkAction === "reset") apiAction = "bulk_reset";
      else if (bulkAction === "status") apiAction = "bulk_update_status";

      const res = await fetch("/api/admin/customers/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: apiAction,
          customerIds: selectedCustIds,
          amount: bulkAction === "adjust" ? Number(bulkForm.amount) : 0,
          status: bulkAction === "status" ? bulkForm.status : "",
          reason: bulkForm.reason.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses aksi massal");

      toast.success(data.message || "Aksi massal berhasil diproses!", { id: loadingToast });
      setShowBulkModal(false);
      setSelectedCustIds([]);
      fetchAdminData();
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    } finally {
      setBulkSaving(false);
    }
  };

  const handleExportCustomersExcel = async () => {
    if (customers.length === 0) {
      toast.error("Tidak ada data pelanggan untuk diekspor");
      return;
    }

    const filtered = customers.filter(cust => {
      const matchSearch = 
        cust.full_name.toLowerCase().includes(custSearchQuery.toLowerCase()) ||
        (cust.email || '').toLowerCase().includes(custSearchQuery.toLowerCase()) ||
        (cust.phone || '').toLowerCase().includes(custSearchQuery.toLowerCase());
      
      const matchStatus = custStatusFilter === 'all' || cust.points_status === custStatusFilter;
      return matchSearch && matchStatus;
    });

    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Pelanggan");

    // Title Row on Row 1
    worksheet.mergeCells('A1:I1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = 'LAPORAN DATA POIN PELANGGAN RESTOBOOK';
    titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF000000' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(1).height = 30;

    // Headers on Row 2
    worksheet.getRow(2).values = [
      'No',
      'ID Pelanggan',
      'Nama Pelanggan',
      'Email',
      'Nomor HP',
      'Poin Aktif',
      'Poin Pending',
      'Status Poin',
      'Blokir Redeem'
    ];
    worksheet.getRow(2).height = 24;

    // Columns config
    worksheet.columns = [
      { key: 'no', width: 6 },
      { key: 'id', width: 38 },
      { key: 'full_name', width: 25 },
      { key: 'email', width: 30 },
      { key: 'phone', width: 18 },
      { key: 'points', width: 14 },
      { key: 'pending_points', width: 14 },
      { key: 'points_status', width: 18 },
      { key: 'is_redeem_blocked', width: 16 }
    ];

    // Add Data rows starting at Row 3
    filtered.forEach((c, i) => {
      worksheet.addRow({
        no: i + 1,
        id: c.id,
        full_name: c.full_name,
        email: c.email || '-',
        phone: c.phone || '-',
        points: c.points || 0,
        pending_points: c.pending_points || 0,
        points_status: c.points_status || 'aktif',
        is_redeem_blocked: c.is_redeem_blocked ? 'Ya' : 'Tidak'
      });
    });

    // Add TOTAL row at the bottom
    const totalPoints = filtered.reduce((sum, c) => sum + (c.points || 0), 0);
    const totalPending = filtered.reduce((sum, c) => sum + (c.pending_points || 0), 0);
    const totalRowIndex = filtered.length + 3; // Title = 1, Header = 2, Data = filtered.length
    
    const totalRow = worksheet.addRow({
      no: '',
      id: '',
      full_name: 'TOTAL',
      email: '',
      phone: '',
      points: totalPoints,
      pending_points: totalPending,
      points_status: '',
      is_redeem_blocked: ''
    });
    totalRow.height = 22;

    // Freeze header row (Row 2, so active cell is A3)
    worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 2, activeCell: 'A3' }];

    // Style the sheet cells with thin black borders
    const thinBorder = {
      top: { style: 'thin' as const, color: { argb: 'FF000000' } },
      left: { style: 'thin' as const, color: { argb: 'FF000000' } },
      bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
      right: { style: 'thin' as const, color: { argb: 'FF000000' } }
    };

    const doubleBottomBorder = {
      top: { style: 'thin' as const, color: { argb: 'FF000000' } },
      left: { style: 'thin' as const, color: { argb: 'FF000000' } },
      bottom: { style: 'double' as const, color: { argb: 'FF000000' } },
      right: { style: 'thin' as const, color: { argb: 'FF000000' } }
    };

    // Row 2 is Header
    worksheet.getRow(2).eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = thinBorder;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEFEFEF' } // Light gray fill for headers
      };
    });

    // Style data rows and total row
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= 2) return; // Skip title and header

      row.height = 20;
      const isTotal = rowNumber === totalRowIndex;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 11, bold: isTotal };
        cell.border = isTotal ? doubleBottomBorder : thinBorder;
        
        // Alignments & formats
        if (colNumber === 1) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colNumber === 2) {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        } else if (colNumber === 6 || colNumber === 7) {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          cell.numFmt = '#,##0';
        } else if (colNumber === 8 || colNumber === 9) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
    });

    try {
      const buffer = await workbook.xlsx.writeBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const excelBase64 = window.btoa(binary);

      await downloadFile({
        dataBase64: excelBase64,
        filename: `laporan_poin_pelanggan_${new Date().toISOString().split('T')[0]}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      toast.success("Data pelanggan berhasil diekspor ke Excel!");
    } catch (e) {
      toast.error("Gagal mengekspor data pelanggan ke Excel");
      console.error(e);
    }
  };

  const handleExportMutationsExcel = async () => {
    const loadingToast = toast.loading("Mengambil seluruh log mutasi poin...");
    try {
      const res = await fetch("/api/admin/customers/points?allTransactions=true");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengambil data mutasi");

      const txs = data.transactions || [];
      if (txs.length === 0) {
        toast.error("Tidak ada log mutasi poin untuk diekspor", { id: loadingToast });
        return;
      }

      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Mutasi Poin");

      // Title Row on Row 1
      worksheet.mergeCells('A1:M1');
      const titleCell = worksheet.getCell('A1');
      titleCell.value = 'LAPORAN MUTASI POIN LOYALITAS RESTOBOOK';
      titleCell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF000000' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
      worksheet.getRow(1).height = 30;

      // Headers on Row 2
      worksheet.getRow(2).values = [
        'No',
        'ID Transaksi',
        'Nama Pelanggan',
        'Email Pelanggan',
        'Nomor HP',
        'Poin',
        'Poin Sebelum',
        'Poin Sesudah',
        'Status',
        'Jenis Sumber',
        'Keterangan / Alasan',
        'Operator Admin',
        'Waktu'
      ];
      worksheet.getRow(2).height = 24;

      // Columns config
      worksheet.columns = [
        { key: 'no', width: 6 },
        { key: 'id', width: 38 },
        { key: 'customer_name', width: 25 },
        { key: 'customer_email', width: 30 },
        { key: 'customer_phone', width: 18 },
        { key: 'points', width: 12 },
        { key: 'before_points', width: 14 },
        { key: 'after_points', width: 14 },
        { key: 'status', width: 14 },
        { key: 'source_type', width: 16 },
        { key: 'reason', width: 35 },
        { key: 'acted_by', width: 20 },
        { key: 'created_at', width: 22 }
      ];

      // Add Data rows starting at Row 3
      txs.forEach((t: any, i: number) => {
        const timeStr = format(new Date(t.created_at), "yyyy-MM-dd HH:mm:ss");
        worksheet.addRow({
          no: i + 1,
          id: t.id,
          customer_name: t.customer?.full_name || 'Pelanggan',
          customer_email: t.customer?.email || '-',
          customer_phone: t.customer?.phone || '-',
          points: t.points || 0,
          before_points: t.before_points !== null && t.before_points !== undefined ? t.before_points : '-',
          after_points: t.after_points !== null && t.after_points !== undefined ? t.after_points : '-',
          status: t.status || '-',
          source_type: t.source_type || '-',
          reason: t.reason || t.description || '-',
          acted_by: t.acted_profile?.full_name || 'Sistem',
          created_at: timeStr
        });
      });

      // Add TOTAL row at the bottom
      const totalPoints = txs.reduce((sum: number, t: any) => sum + (t.points || 0), 0);
      const totalRowIndex = txs.length + 3;

      const totalRow = worksheet.addRow({
        no: '',
        id: '',
        customer_name: 'TOTAL',
        customer_email: '',
        customer_phone: '',
        points: totalPoints,
        before_points: '',
        after_points: '',
        status: '',
        source_type: '',
        reason: '',
        acted_by: '',
        created_at: ''
      });
      totalRow.height = 22;

      // Freeze header row (Row 2, so active cell is A3)
      worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 2, activeCell: 'A3' }];

      // Style borders
      const thinBorder = {
        top: { style: 'thin' as const, color: { argb: 'FF000000' } },
        left: { style: 'thin' as const, color: { argb: 'FF000000' } },
        bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
        right: { style: 'thin' as const, color: { argb: 'FF000000' } }
      };

      const doubleBottomBorder = {
        top: { style: 'thin' as const, color: { argb: 'FF000000' } },
        left: { style: 'thin' as const, color: { argb: 'FF000000' } },
        bottom: { style: 'double' as const, color: { argb: 'FF000000' } },
        right: { style: 'thin' as const, color: { argb: 'FF000000' } }
      };

      // Row 2 is Header
      worksheet.getRow(2).eachCell((cell) => {
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = thinBorder;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEFEFEF' }
        };
      });

      // Style data rows and total row
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= 2) return; // Skip title and header

        row.height = 20;
        const isTotal = rowNumber === totalRowIndex;

        row.eachCell((cell, colNumber) => {
          cell.font = { name: 'Calibri', size: 11, bold: isTotal };
          cell.border = isTotal ? doubleBottomBorder : thinBorder;
          
          // Alignments & formats
          if (colNumber === 1) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNumber === 6 || colNumber === 7 || colNumber === 8) {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            if (typeof cell.value === 'number') {
              cell.numFmt = '#,##0';
            }
          } else if (colNumber === 9 || colNumber === 10 || colNumber === 13) {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          }
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const excelBase64 = window.btoa(binary);

      await downloadFile({
        dataBase64: excelBase64,
        filename: `mutasi_poin_loyalitas_${new Date().toISOString().split('T')[0]}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      toast.success("Laporan mutasi berhasil diekspor ke Excel!", { id: loadingToast });
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
      (r: any) => r.customer_id === customerId && r.reward_id === reward.id && r.status !== "cancelled" && !r.is_quota_freed
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
      return userReds.filter((r: any) => new Date(r.created_at) >= boundary && !r.is_quota_freed);
    }

    const boundaryTime = now - offsetMs;
    return userReds.filter((r: any) => new Date(r.created_at).getTime() >= boundaryTime && !r.is_quota_freed);
  };

  const handleAdjustQuota = async (actionType: 'reset' | 'reduce' | 'add', reward: any, customerId: string) => {
    let targetIds: string[] = [];
    let isQuotaFreed = true;

    if (actionType === 'add') {
      const freedReds = redemptions.filter(
        (r: any) => r.customer_id === customerId && r.reward_id === reward.id && r.status !== "cancelled" && r.is_quota_freed
      );
      if (freedReds.length === 0) {
        toast.error("Tidak ada kuota penukaran yang dapat ditambahkan.");
        return;
      }
      freedReds.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      targetIds = [freedReds[0].id];
      isQuotaFreed = false;
    } else {
      const activeReds = getCustomerActiveRedemptionsCount(reward, customerId);
      if (activeReds.length === 0) {
        toast.error("Tidak ada kuota penukaran aktif yang bisa disesuaikan.");
        return;
      }

      if (actionType === 'reset') {
        targetIds = activeReds.map((r: any) => r.id);
      } else {
        activeReds.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        targetIds = [activeReds[0].id];
      }
    }

    const loadingToast = toast.loading("Menyesuaikan kuota penukaran...");
    try {
      const res = await fetch("/api/admin/rewards/redemptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'free_quota',
          redemptionIds: targetIds,
          value: isQuotaFreed
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyesuaikan kuota");

      let successMsg = "";
      if (actionType === 'reset') successMsg = "Kuota berhasil direset ke 0!";
      else if (actionType === 'reduce') successMsg = "Kuota berhasil dikurangi 1!";
      else successMsg = "Kuota berhasil ditambahkan 1!";

      toast.success(successMsg, { id: loadingToast });
      fetchAdminData();
    } catch (err: any) {
      toast.error(err.message, { id: loadingToast });
    }
  };

  const handleRefundRedemption = async (redemption: any) => {
    const confirmRefund = window.confirm(`Apakah Anda yakin ingin membatalkan penukaran reward "${redemption.rewards?.title || 'Reward'}" dan mengembalikan ${redemption.points_spent} poin ke pelanggan?`);
    if (!confirmRefund) return;

    const loadingToast = toast.loading("Membatalkan penukaran & merefund poin...");
    try {
      const res = await fetch("/api/admin/rewards/redemptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'refund_redemption',
          redemptionId: redemption.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal merefund penukaran");

      toast.success("Reward berhasil dibatalkan dan poin dikembalikan!", { id: loadingToast });
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
                  <LazyRewardsChart data={stats.chart} />
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
          <div className="flex border-b border-border-light dark:border-border-dark overflow-x-auto whitespace-nowrap scrollbar-none pb-0.5">
            <button
              onClick={() => setActiveTab("catalog")}
              className={`px-6 py-3 font-bold text-sm transition-all border-b-2 shrink-0 whitespace-nowrap ${
                activeTab === "catalog"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-text-light dark:hover:text-text-dark"
              }`}
            >
              Katalog Reward ({rewards.length})
            </button>
            <button
              onClick={() => setActiveTab("customers")}
              className={`px-6 py-3 font-bold text-sm transition-all border-b-2 shrink-0 whitespace-nowrap ${
                activeTab === "customers"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-text-light dark:hover:text-text-dark"
              }`}
            >
              Manajemen Poin Pelanggan ({customers.length})
            </button>
            <button
              onClick={() => setActiveTab("redemptions")}
              className={`px-6 py-3 font-bold text-sm transition-all border-b-2 shrink-0 whitespace-nowrap ${
                activeTab === "redemptions"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-text-light dark:hover:text-text-dark"
              }`}
            >
              Daftar Penukaran ({redemptions.length})
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-6 py-3 font-bold text-sm transition-all border-b-2 shrink-0 whitespace-nowrap ${
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
                                 reward.category === "shipping" ? <Truck className="w-6 h-6 text-cyan-500" /> :
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

                          {(reward.category === "voucher" || reward.category === "shipping") && (
                            <div className="bg-orange-50/50 dark:bg-orange-950/10 p-3 rounded-xl text-xs text-orange-700 dark:text-orange-400 font-bold">
                              {reward.category === "shipping" ? "Diskon Ongkir: " : "Potongan Voucher: "}{reward.discount_percent || 10}%{reward.category === "shipping" ? " untuk pesanan Delivery" : " Diskon"}
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
              <div className="space-y-4">
                {/* Search, Filter, Export Bar */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card-light dark:bg-card-dark p-4 border border-border-light dark:border-border-dark rounded-3xl shadow-sm">
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
                    <input
                      type="text"
                      placeholder="Cari nama, email, nomor HP, ID pelanggan..."
                      value={custSearchQuery}
                      onChange={e => {
                        setCustSearchQuery(e.target.value);
                        setSelectedCustIds([]); // Reset selection
                      }}
                      className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary font-medium text-text-light dark:text-text-dark flex-1 max-w-md"
                    />
                    <select
                      value={custStatusFilter}
                      onChange={e => {
                        setCustStatusFilter(e.target.value);
                        setSelectedCustIds([]); // Reset selection
                      }}
                      title="Filter Status Poin Pelanggan"
                      aria-label="Filter Status Poin Pelanggan"
                      className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-primary font-bold text-muted"
                    >
                      <option value="all">Semua Status Poin</option>
                      <option value="aktif">Status: Aktif</option>
                      <option value="pending">Status: Pending</option>
                      <option value="diblokir">Status: Diblokir</option>
                      <option value="dibatasi">Status: Dibatasi</option>
                      <option value="nonaktif_sementara">Status: Nonaktif Sementara</option>
                    </select>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto shrink-0 justify-end">
                    <button
                      onClick={handleExportCustomersExcel}
                      className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-wider bg-gray-50 hover:bg-gray-100 text-muted border border-border-light dark:border-border-dark rounded-xl transition-all"
                    >
                      Export Pelanggan
                    </button>
                    <button
                      onClick={handleExportMutationsExcel}
                      className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-black uppercase tracking-wider bg-primary/10 hover:bg-primary/25 text-primary rounded-xl transition-all"
                    >
                      Laporan Mutasi
                    </button>
                  </div>
                </div>

                {/* Bulk Action Bar (Visible when customers checked) */}
                {selectedCustIds.length > 0 && (
                  <div className="flex flex-wrap gap-3 items-center justify-between p-4 bg-orange-50/50 dark:bg-orange-950/10 border border-orange-200/50 rounded-2xl animate-fade-in">
                    <span className="text-xs font-bold text-orange-700 dark:text-orange-400">
                      {selectedCustIds.length} pelanggan dipilih secara massal
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setBulkAction("adjust");
                          setBulkForm({ amount: "", reason: "", status: "aktif" });
                          setShowBulkModal(true);
                        }}
                        className="px-3.5 py-2 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-primary-hover shadow-md transition-all"
                      >
                        Adjust Poin massal
                      </button>
                      <button
                        onClick={() => {
                          setBulkAction("status");
                          setBulkForm({ amount: "", reason: "", status: "aktif" });
                          setShowBulkModal(true);
                        }}
                        className="px-3.5 py-2 bg-card-light dark:bg-card-dark text-muted border border-border-light dark:border-border-dark text-xs font-black uppercase tracking-wider rounded-xl hover:text-primary transition-all"
                      >
                        Ubah Status Massal
                      </button>
                      <button
                        onClick={() => {
                          setBulkAction("reset");
                          setBulkForm({ amount: "", reason: "", status: "aktif" });
                          setShowBulkModal(true);
                        }}
                        className="px-3.5 py-2 bg-red-50 text-red-650 border border-red-200 text-xs font-black uppercase tracking-wider rounded-xl hover:bg-red-100 transition-all"
                      >
                        Reset Massal
                      </button>
                      <button
                        onClick={() => setSelectedCustIds([])}
                        className="px-3 py-2 text-xs font-bold text-muted hover:text-primary transition-all"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                {/* Customers Table */}
                <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900 border-b border-border-light dark:border-border-dark text-[10px] font-black uppercase text-muted tracking-wider">
                          <th className="px-6 py-4 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={customers.length > 0 && selectedCustIds.length === customers.filter(c => {
                                const matchSearch = 
                                  c.full_name.toLowerCase().includes(custSearchQuery.toLowerCase()) ||
                                  (c.email || '').toLowerCase().includes(custSearchQuery.toLowerCase()) ||
                                  (c.phone || '').toLowerCase().includes(custSearchQuery.toLowerCase());
                                const matchStatus = custStatusFilter === 'all' || c.points_status === custStatusFilter;
                                return matchSearch && matchStatus;
                              }).length}
                              onChange={e => {
                                const filtered = customers.filter(c => {
                                  const matchSearch = 
                                    c.full_name.toLowerCase().includes(custSearchQuery.toLowerCase()) ||
                                    (c.email || '').toLowerCase().includes(custSearchQuery.toLowerCase()) ||
                                    (c.phone || '').toLowerCase().includes(custSearchQuery.toLowerCase());
                                  const matchStatus = custStatusFilter === 'all' || c.points_status === custStatusFilter;
                                  return matchSearch && matchStatus;
                                });
                                if (e.target.checked) {
                                  setSelectedCustIds(filtered.map(c => c.id));
                                } else {
                                  setSelectedCustIds([]);
                                }
                              }}
                              className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                              title="Pilih Semua"
                              aria-label="Pilih Semua"
                            />
                          </th>
                          <th className="px-6 py-4 whitespace-nowrap">Nama Pelanggan</th>
                          <th className="px-6 py-4 whitespace-nowrap">Email</th>
                          <th className="px-6 py-4 text-right whitespace-nowrap">Poin</th>
                          <th className="px-6 py-4 text-right whitespace-nowrap">Pending</th>
                          <th className="px-6 py-4 text-center whitespace-nowrap">Status Poin</th>
                          <th className="px-6 py-4 text-center whitespace-nowrap">Pembatasan</th>
                          <th className="px-6 py-4 text-center whitespace-nowrap">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customers.filter(c => {
                          const matchSearch = 
                            c.full_name.toLowerCase().includes(custSearchQuery.toLowerCase()) ||
                            (c.email || '').toLowerCase().includes(custSearchQuery.toLowerCase()) ||
                            (c.phone || '').toLowerCase().includes(custSearchQuery.toLowerCase());
                          const matchStatus = custStatusFilter === 'all' || c.points_status === custStatusFilter;
                          return matchSearch && matchStatus;
                        }).length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-10 text-muted text-xs">
                              Tidak ada data pelanggan yang cocok dengan pencarian / filter.
                            </td>
                          </tr>
                        ) : (
                          customers.filter(c => {
                            const matchSearch = 
                              c.full_name.toLowerCase().includes(custSearchQuery.toLowerCase()) ||
                              (c.email || '').toLowerCase().includes(custSearchQuery.toLowerCase()) ||
                              (c.phone || '').toLowerCase().includes(custSearchQuery.toLowerCase());
                            const matchStatus = custStatusFilter === 'all' || c.points_status === custStatusFilter;
                            return matchSearch && matchStatus;
                          }).map((cust) => (
                            <tr key={cust.id} className="border-b border-border-light dark:border-border-dark text-xs hover:bg-gray-50/40 dark:hover:bg-gray-900/10">
                              <td className="px-6 py-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedCustIds.includes(cust.id)}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setSelectedCustIds(prev => [...prev, cust.id]);
                                    } else {
                                      setSelectedCustIds(prev => prev.filter(id => id !== cust.id));
                                    }
                                  }}
                                  className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                                  title={`Pilih ${cust.full_name}`}
                                  aria-label={`Pilih ${cust.full_name}`}
                                />
                              </td>
                              <td className="px-6 py-4 font-bold text-text-light dark:text-text-dark uppercase whitespace-nowrap">
                                {cust.full_name}
                              </td>
                              <td className="px-6 py-4 text-muted whitespace-nowrap">
                                <div>{cust.email || "-"}</div>
                                {cust.phone && <div className="text-[10px] text-muted/80">{cust.phone}</div>}
                              </td>
                              <td className="px-6 py-4 text-right font-black font-mono text-primary text-sm whitespace-nowrap">
                                {cust.points || 0}
                              </td>
                              <td className="px-6 py-4 text-right font-black font-mono text-amber-500 text-sm whitespace-nowrap">
                                {cust.pending_points || 0}
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border inline-block text-center w-28 whitespace-nowrap ${
                                  cust.points_status === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                  cust.points_status === 'diblokir' ? 'bg-red-50 text-red-600 border-red-200' :
                                  cust.points_status === 'dibatasi' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                  cust.points_status === 'nonaktif_sementara' ? 'bg-gray-50 text-gray-500 border-gray-200' :
                                  'bg-emerald-50 text-emerald-600 border-emerald-200'
                                }`}>
                                  {cust.points_status || 'aktif'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                {cust.is_redeem_blocked ? (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-red-50 text-red-600 border border-red-200 block w-24 mx-auto text-center whitespace-nowrap">Redeem Blok</span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-200 block w-24 mx-auto text-center whitespace-nowrap">Redeem Aktif</span>
                                )}
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
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
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
                                    {red.status !== 'cancelled' && (
                                      <button
                                        onClick={() => handleRefundRedemption(red)}
                                        className="p-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 transition-all"
                                        title="Batalkan & Refund Poin"
                                      >
                                        <RefreshCcw className="w-4 h-4" />
                                      </button>
                                    )}
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
      <BaseModal
        isOpen={showDeleteConfirm}
        onClose={() => { setShowDeleteConfirm(false); setDeleteTargetId(null); }}
        size="sm"
        showCloseButton={false}
        noPadding={true}
      >
        <div className="bg-white dark:bg-card-dark text-text-light dark:text-text-dark p-6 flex flex-col items-center text-center gap-4">
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
      </BaseModal>

      {/* 1. Add / Edit Reward Dialog Modal */}
      <BaseModal
        isOpen={showRewardModal}
        onClose={() => setShowRewardModal(false)}
        size="md"
        showCloseButton={false}
        noPadding={true}
      >
        <div className="bg-white dark:bg-card-dark text-text-light dark:text-text-dark">
          <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
            <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" /> {currentReward ? "Edit Katalog Reward" : "Tambah Reward Baru"}
            </h3>
            <button onClick={() => setShowRewardModal(false)} title="Tutup" className="p-2 hover:bg-gray-100 rounded-xl transition-all"><X className="w-5 h-5 text-muted" /></button>
          </div>

          <form onSubmit={handleSaveReward} className="p-6 space-y-5">
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
                <option value="shipping">Diskon Ongkir (Delivery)</option>
                <option value="custom">Reward Custom</option>
              </select>
            </div>

            {(rewardForm.category === "voucher" || rewardForm.category === "shipping") && (
              <div>
                <label htmlFor="rewardDiscountPercent" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">
                  {rewardForm.category === "shipping" ? "Diskon Ongkir (%)" : "Diskon (%)"}
                </label>
                <input 
                  id="rewardDiscountPercent"
                  type="number" 
                  min={1} 
                  max={100}
                  value={rewardForm.discountPercent} 
                  onChange={e => setRewardForm({ ...rewardForm, discountPercent: e.target.value })} 
                  placeholder="10"
                  title={rewardForm.category === "shipping" ? "Diskon Ongkir (%)" : "Diskon (%)"}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                />
                {rewardForm.category === "shipping" && (
                  <p className="text-[10px] text-muted mt-1.5">Diskon ini akan diterapkan pada biaya ongkos kirim pesanan delivery pelanggan.</p>
                )}
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
        </div>
      </BaseModal>

      {/* 2. Customer Manual points control Sheet Modal */}
      <BaseModal
        isOpen={showAdjustModal && !!selectedCustomer}
        onClose={() => setShowAdjustModal(false)}
        size="2xl"
        noPadding
        showCloseButton={false}
      >
        {selectedCustomer && (() => {
          const cancelledPointsTotal = customerTxLogs
            .filter(tx => ['cancelled', 'dibatalkan', 'ditolak'].includes(tx.status))
            .reduce((sum, tx) => sum + Math.abs(tx.points), 0);

          const filteredTxLogs = customerTxLogs.filter(tx => {
            // 1. Kategori Tab
            if (activePointsTab === "masuk" && !(tx.points > 0)) return false;
            if (activePointsTab === "keluar" && !(tx.points < 0 || tx.status === 'redeemed' || tx.status === 'manual_redeemed')) return false;
            if (activePointsTab === "pending" && tx.status !== 'pending') return false;
            if (activePointsTab === "dibatalkan" && !['cancelled', 'dibatalkan', 'ditolak'].includes(tx.status)) return false;
            if (activePointsTab === "reward" && tx.source_type !== 'reward' && tx.status !== 'redeemed' && tx.status !== 'manual_redeemed') return false;
            if (activePointsTab === "order" && tx.source_type !== 'order') return false;
            if (activePointsTab === "refund" && tx.source_type !== 'refund') return false;
            if (activePointsTab === "manual" && tx.source_type !== 'manual') return false;

            // 2. Rentang Tanggal
            if (txStartDate) {
              const start = new Date(txStartDate);
              start.setHours(0, 0, 0, 0);
              const txDate = new Date(tx.created_at);
              if (txDate < start) return false;
            }
            if (txEndDate) {
              const end = new Date(txEndDate);
              end.setHours(23, 59, 59, 999);
              const txDate = new Date(tx.created_at);
              if (txDate > end) return false;
            }

            // 3. Pencarian ID / Deskripsi / Alasan
            if (txSearchQuery.trim()) {
              const q = txSearchQuery.toLowerCase();
              const idMatch = String(tx.id).toLowerCase().includes(q);
              const descMatch = (tx.description || '').toLowerCase().includes(q);
              const reasonMatch = (tx.reason || '').toLowerCase().includes(q);
              if (!idMatch && !descMatch && !reasonMatch) return false;
            }

            return true;
          });

          return (
            <div className="flex flex-col">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                <div>
                  <h3 className="font-black text-lg text-gray-900 dark:text-white uppercase tracking-tight">Detail & Kelola Poin</h3>
                  <p className="text-[10px] text-muted font-bold mt-0.5">Pelanggan: {selectedCustomer.full_name} ({selectedCustomer.email || "Tanpa Email"})</p>
                </div>
                <button onClick={() => setShowAdjustModal(false)} title="Tutup" className="p-2 hover:bg-gray-100 rounded-xl transition-all"><X className="w-5 h-5 text-muted" /></button>
              </div>

              <div className="p-6 space-y-6">
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
                    <span className="text-[9px] font-black text-muted uppercase tracking-wider block">Poin Dibatalkan</span>
                    <span className="text-xl font-mono font-black text-rose-550">{cancelledPointsTotal}</span>
                  </div>
                  <div className="col-span-3 flex justify-between items-center bg-white dark:bg-gray-800 p-2 px-3.5 rounded-xl border border-border-light/40 dark:border-border-dark/40 text-xs">
                    <span className="text-[9.5px] font-black text-muted uppercase tracking-wider">Status Akun Poin:</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wide border ${
                      selectedCustomer.points_status === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-250' :
                      selectedCustomer.points_status === 'diblokir' ? 'bg-red-50 text-red-650 border-red-200' :
                      selectedCustomer.points_status === 'dibatasi' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                      selectedCustomer.points_status === 'nonaktif_sementara' ? 'bg-gray-50 text-gray-500 border-gray-255' :
                      'bg-emerald-50 text-emerald-600 border-emerald-255'
                    }`}>
                      {selectedCustomer.points_status || 'aktif'}
                    </span>
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
                        <option value="set">Set Poin ke Nominal Tertentu</option>
                        <option value="reset">Reset Poin ke 0</option>
                        <option value="update_status">Ubah Status Poin</option>
                      </select>
                    </div>

                    {adjustForm.action === "adjust" && (
                      <div>
                        <label htmlFor="adjustAmount" className="text-[9px] font-black uppercase text-muted tracking-widest mb-1.5 block">
                          Jumlah Poin (Negatif untuk kurangi)
                        </label>
                        <input 
                          id="adjustAmount"
                          type="number" 
                          required 
                          placeholder="Misal: 50 atau -25"
                          title="Jumlah"
                          value={adjustForm.amount} 
                          onChange={e => setAdjustForm({ ...adjustForm, amount: e.target.value })} 
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                        />
                      </div>
                    )}

                    {adjustForm.action === "set" && (
                      <div>
                        <label htmlFor="adjustSetAmount" className="text-[9px] font-black uppercase text-muted tracking-widest mb-1.5 block">
                          Set Total Poin Baru
                        </label>
                        <input 
                          id="adjustSetAmount"
                          type="number" 
                          min={0}
                          required 
                          placeholder="Misal: 100"
                          title="Set Total Poin"
                          value={adjustForm.amount} 
                          onChange={e => setAdjustForm({ ...adjustForm, amount: e.target.value })} 
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                        />
                      </div>
                    )}

                    {adjustForm.action === "update_status" && (
                      <div>
                        <label htmlFor="adjustStatus" className="text-[9px] font-black uppercase text-muted tracking-widest mb-1.5 block">
                          Pilih Status Poin
                        </label>
                        <select 
                          id="adjustStatus"
                          value={adjustForm.status} 
                          onChange={e => setAdjustForm({ ...adjustForm, status: e.target.value })} 
                          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                          title="Pilih Status Poin"
                        >
                          <option value="aktif">Aktif</option>
                          <option value="pending">Pending Verifikasi</option>
                          <option value="diblokir">Diblokir</option>
                          <option value="dibatasi">Dibatasi</option>
                          <option value="nonaktif_sementara">Nonaktif Sementara</option>
                        </select>
                      </div>
                    )}

                    {adjustForm.action === "reset" && (
                      <div className="p-3 bg-red-50 dark:bg-red-955/15 rounded-xl border border-red-200/50 text-[10px] text-red-750 dark:text-red-400 font-bold leading-normal">
                        Perhatian: Aksi ini akan mereset seluruh poin aktif pelanggan menjadi 0. Alasan wajib diisi dan diperlukan konfirmasi lanjutan.
                      </div>
                    )}

                    <div>
                      <label htmlFor="adjustReason" className="text-[9px] font-black uppercase text-muted tracking-widest mb-1.5 block">Alasan Penyesuaian</label>
                      <textarea 
                        id="adjustReason"
                        rows={2} 
                        required
                        placeholder="Masukkan alasan manipulasi poin..."
                        title="Alasan Penyesuaian"
                        value={adjustForm.reason} 
                        onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })} 
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={saving || !adjustForm.reason.trim()}
                      className="w-full py-3 bg-primary text-white font-black rounded-xl shadow-md hover:shadow-lg transition-all text-xs uppercase tracking-wider disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Eksekusi Penyesuaian"}
                    </button>
                  </form>

                  {/* Customer Transaction Logs */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-border-light dark:border-border-dark pb-2">
                      <h4 className="font-bold text-xs uppercase tracking-widest text-muted">Log Riwayat</h4>
                      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg text-[10px] shrink-0 overflow-x-auto whitespace-nowrap scrollbar-none">
                        <button
                          type="button"
                          onClick={() => setActiveLogsTab("points")}
                          className={`px-2 py-1 rounded font-bold transition-all shrink-0 whitespace-nowrap ${
                            activeLogsTab === "points" ? "bg-primary text-white" : "text-muted"
                          }`}
                        >
                          Poin ({customerTxLogs.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveLogsTab("rewards")}
                          className={`px-2 py-1 rounded font-bold transition-all shrink-0 whitespace-nowrap ${
                            activeLogsTab === "rewards" ? "bg-primary text-white" : "text-muted"
                          }`}
                        >
                          Reward ({redemptions.filter(r => r.customer_id === selectedCustomer.id).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveLogsTab("quota")}
                          className={`px-2 py-1 rounded font-bold transition-all shrink-0 whitespace-nowrap ${
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
                      <div className="space-y-3">
                        {/* Sub-tabs category */}
                        <div className="flex gap-1 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-gray-250 dark:scrollbar-thumb-gray-750 text-[9px]">
                          {(["semua", "masuk", "keluar", "pending", "dibatalkan", "reward", "order", "refund", "manual"] as const).map(tab => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => setActivePointsTab(tab)}
                              className={`px-2 py-1 rounded-md font-bold uppercase whitespace-nowrap transition-all border shrink-0 ${
                                activePointsTab === tab
                                  ? "bg-gray-800 text-white border-gray-800 dark:bg-white dark:text-gray-900"
                                  : "text-muted border-border-light dark:border-border-dark hover:border-gray-400"
                              }`}
                            >
                              {tab}
                            </button>
                          ))}
                        </div>

                        {/* Date Range & ID Search Filters */}
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <label htmlFor="txSearchInput" className="sr-only">Cari ID / Keterangan</label>
                            <input
                              id="txSearchInput"
                              type="text"
                              placeholder="Cari ID / Keterangan..."
                              value={txSearchQuery}
                              onChange={e => setTxSearchQuery(e.target.value)}
                              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-[10px] font-semibold text-text-light dark:text-text-dark outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <div className="flex gap-1 items-center">
                            <label htmlFor="startDateInput" className="sr-only">Mulai</label>
                            <input
                              id="startDateInput"
                              type="date"
                              title="Tanggal Mulai"
                              value={txStartDate}
                              onChange={e => setTxStartDate(e.target.value)}
                              className="w-[48%] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-[9px] font-semibold text-text-light dark:text-text-dark outline-none"
                            />
                            <span className="text-muted text-[8px] font-bold">s/d</span>
                            <label htmlFor="endDateInput" className="sr-only">Selesai</label>
                            <input
                              id="endDateInput"
                              type="date"
                              title="Tanggal Selesai"
                              value={txEndDate}
                              onChange={e => setTxEndDate(e.target.value)}
                              className="w-[48%] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-[9px] font-semibold text-text-light dark:text-text-dark outline-none"
                            />
                          </div>
                        </div>

                        {filteredTxLogs.length === 0 ? (
                          <div className="text-center py-10 text-muted text-[11px]">Belum ada aktivitas poin yang cocok</div>
                        ) : (
                          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                            {filteredTxLogs.map((tx) => (
                              <div key={tx.id} className="p-3 bg-gray-50/50 dark:bg-gray-900/30 border border-border-light/30 dark:border-border-dark/30 rounded-xl text-[11px] space-y-2">
                                <div className="flex justify-between items-start gap-3">
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-text-light dark:text-text-dark">{tx.description}</span>
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border ${
                                        tx.status === 'pending' ? 'bg-yellow-50 text-yellow-600 border-yellow-200 animate-pulse' :
                                        tx.status === 'cancelled' || tx.status === 'dibatalkan' || tx.status === 'ditolak' ? 'bg-red-50 text-red-650 border-red-200' :
                                        tx.status === 'aktif' || tx.status === 'earned' || tx.status === 'selesai' ? 'bg-emerald-50 text-emerald-600 border-emerald-250' :
                                        tx.status === 'redeemed' || tx.status === 'manual_redeemed' ? 'bg-rose-50 text-rose-600 border-rose-200' :
                                        tx.status === 'koreksi' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                        tx.status === 'reset' ? 'bg-gray-100 text-gray-500 border-gray-255' :
                                        'bg-blue-50 text-blue-650 border-blue-200'
                                      }`}>
                                        {tx.status}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-muted">
                                      <span>ID: {tx.id}</span>
                                      <span>•</span>
                                      <span>{format(new Date(tx.created_at), "dd MMM yyyy, HH:mm", { locale: id })}</span>
                                      {tx.acted_profile?.full_name && (
                                        <>
                                          <span>•</span>
                                          <span className="font-semibold text-primary/80">Oleh: {tx.acted_profile.full_name}</span>
                                        </>
                                      )}
                                    </div>
                                    {tx.reason && (
                                      <p className="text-[10px] text-muted italic mt-1 bg-white dark:bg-gray-800 p-1.5 rounded-lg border border-border-light/30 dark:border-border-dark/30 leading-normal">
                                        Alasan: {tx.reason}
                                      </p>
                                    )}
                                  </div>
                                  <span className={`font-mono font-black text-xs shrink-0 ${tx.points > 0 ? "text-emerald-600 dark:text-emerald-400" : tx.points < 0 ? "text-rose-600 dark:text-rose-400" : "text-gray-550"}`}>
                                    {tx.points > 0 ? `+${tx.points}` : tx.points}
                                  </span>
                                </div>

                                {tx.status === 'pending' && (
                                  <div className="flex gap-1.5 justify-end pt-1">
                                    <button
                                      type="button"
                                      onClick={() => handleApprovePending(tx.id, selectedCustomer.id)}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-lg text-[9px] uppercase tracking-wider transition-all shadow-sm"
                                    >
                                      Setujui
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRejectPending(tx.id, selectedCustomer.id)}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-lg text-[9px] uppercase tracking-wider transition-all shadow-sm"
                                    >
                                      Tolak
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : activeLogsTab === "rewards" ? (
                      redemptions.filter(r => r.customer_id === selectedCustomer.id).length === 0 ? (
                        <div className="text-center py-10 text-muted text-[11px]">Belum ada reward yang ditukarkan</div>
                      ) : (
                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                          {redemptions
                            .filter(r => r.customer_id === selectedCustomer.id)
                            .map((red) => (
                              <div key={red.id} className="p-3 bg-gray-50/50 dark:bg-gray-900/30 border border-border-light/30 dark:border-border-dark/30 rounded-xl text-[11px] flex justify-between items-center gap-3">
                                <div>
                                  <p className="font-bold text-text-light dark:text-text-dark">{red.rewards?.title || 'Reward Dihapus'}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-muted">
                                    <span>{format(new Date(red.created_at), "dd MMM yyyy, HH:mm", { locale: id })}</span>
                                    <span>•</span>
                                    <span className="font-semibold">{red.points_spent} Poin</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {red.status === 'cancelled' ? (
                                    <span className="px-2 py-0.5 text-[9px] font-black rounded bg-gray-100 text-gray-500 uppercase">Dibatalkan</span>
                                  ) : red.status === 'used' ? (
                                    <span className="px-2 py-0.5 text-[9px] font-black rounded bg-emerald-50 text-emerald-600 uppercase">Digunakan</span>
                                  ) : red.status === 'expired' ? (
                                    <span className="px-2 py-0.5 text-[9px] font-black rounded bg-rose-50 text-rose-600 uppercase">Kadaluarsa</span>
                                  ) : (
                                    <>
                                      <span className="px-2 py-0.5 text-[9px] font-black rounded bg-yellow-50 text-yellow-600 uppercase animate-pulse">Aktif</span>
                                      <button
                                        type="button"
                                        onClick={() => handleRefundRedemption(red)}
                                        className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all"
                                        title="Batalkan & Refund"
                                      >
                                        Refund
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
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
                                    <span className={`font-mono font-black text-xs shrink-0 px-2 py-0.5 rounded ${count >= limit ? "bg-red-50 text-red-650 border border-red-200" : "bg-primary/10 text-primary"}`}>
                                      {count}/{limit} Aktif
                                    </span>
                                  </div>
                                  
                                  <div className="flex gap-2 justify-end pt-1">
                                    {redemptions.filter(r => r.customer_id === selectedCustomer.id && r.reward_id === reward.id && r.status !== "cancelled" && r.is_quota_freed).length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleAdjustQuota('add', reward, selectedCustomer.id)}
                                        className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all"
                                      >
                                        Tambah 1
                                      </button>
                                    )}
                                    {count > 0 && (
                                      <>
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
                                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all"
                                        >
                                          Reset Kuota (0)
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </BaseModal>

      {/* Block Redemption Modal */}
      <BaseModal
        isOpen={showBlockModal && !!selectedRedemption}
        onClose={() => setShowBlockModal(false)}
        size="md"
        showCloseButton={false}
      >
        {selectedRedemption && (
          <div className="space-y-6 text-center">
            <div>
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/20 mx-auto rounded-2xl flex items-center justify-center mb-4 border border-red-200/50">
                <Ban className="w-8 h-8 text-red-600" />
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
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-255 dark:border-gray-700 rounded-xl p-3.5 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
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
                className="flex-1 py-3.5 bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 hover:bg-red-700 transition-all disabled:opacity-50 text-xs uppercase"
              >
                Ya, Blokir
              </button>
            </div>
          </div>
        )}
      </BaseModal>

      {/* Delete Redemption Confirmation Modal */}
      <BaseModal
        isOpen={showDeleteRedemptionConfirm && !!selectedRedemptionForDelete}
        onClose={() => setShowDeleteRedemptionConfirm(false)}
        size="sm"
        showCloseButton={false}
      >
        {selectedRedemptionForDelete && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-955/20 mx-auto rounded-2xl flex items-center justify-center mb-2 border border-red-200">
              <Trash2 className="w-8 h-8 text-red-650" />
            </div>
            <h3 className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tight">Hapus Penukaran?</h3>
            <p className="text-xs text-muted leading-relaxed font-medium">
              Apakah Anda yakin ingin menghapus data penukaran reward <span className="font-bold text-text-light dark:text-text-dark">&ldquo;{selectedRedemptionForDelete.rewards?.title}&rdquo;</span> milik <span className="font-bold text-text-light dark:text-text-dark">{selectedRedemptionForDelete.profiles?.full_name}</span>?
            </p>
            <div className="p-3 bg-amber-50 dark:bg-amber-955/15 rounded-2xl text-[10px] text-amber-700 dark:text-amber-450 font-bold border border-amber-200/50">
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
                className="flex-1 py-3.5 bg-red-600 text-white font-black rounded-2xl shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 hover:bg-red-755 transition-all text-xs uppercase"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        )}
      </BaseModal>

      {/* 4. Bulk Action Confirmation Modal */}
      <BaseModal
        isOpen={showBulkModal && !!bulkAction}
        onClose={() => setShowBulkModal(false)}
        size="md"
        showCloseButton={false}
      >
        {bulkAction && (
          <div className="space-y-6">
            <div>
              <h3 className="font-black text-xl text-gray-900 dark:text-white uppercase tracking-tight text-center">
                {bulkAction === 'adjust' && 'Aksi Massal: Penyesuaian Poin'}
                {bulkAction === 'status' && 'Aksi Massal: Ubah Status Poin'}
                {bulkAction === 'reset' && 'Aksi Massal: Reset Poin ke 0'}
              </h3>
              <p className="text-xs text-muted mt-1 leading-relaxed text-center">
                Memproses {selectedCustIds.length} pelanggan yang dipilih.
              </p>
            </div>

            <form onSubmit={handleBulkActionSubmit} className="space-y-4">
              {bulkAction === 'adjust' && (
                <div>
                  <label htmlFor="bulkAmount" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">
                    Jumlah Poin (Negatif untuk kurangi)
                  </label>
                  <input 
                    id="bulkAmount"
                    type="number" 
                    required 
                    placeholder="Misal: 50 atau -25"
                    title="Jumlah Poin"
                    value={bulkForm.amount} 
                    onChange={e => setBulkForm({ ...bulkForm, amount: e.target.value })} 
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-xl p-3.5 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                  />
                </div>
              )}

              {bulkAction === 'status' && (
                <div>
                  <label htmlFor="bulkStatus" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">
                    Pilih Status Poin
                  </label>
                  <select 
                    id="bulkStatus"
                    value={bulkForm.status} 
                    onChange={e => setBulkForm({ ...bulkForm, status: e.target.value })} 
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-255 dark:border-gray-700 rounded-xl p-3.5 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark"
                    title="Pilih Status"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="pending">Pending Verifikasi</option>
                    <option value="diblokir">Diblokir</option>
                    <option value="dibatasi">Dibatasi</option>
                    <option value="nonaktif_sementara">Nonaktif Sementara</option>
                  </select>
                </div>
              )}

              {bulkAction === 'reset' && (
                <div className="p-3.5 bg-red-50 dark:bg-red-950/15 rounded-2xl text-[10px] text-red-750 dark:text-red-400 font-bold border border-red-200/50">
                  Peringatan: Seluruh poin aktif milik {selectedCustIds.length} pelanggan terpilih akan direset secara permanen menjadi 0. Tindakan ini tidak dapat dibatalkan.
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="bulkReason" className="text-[10px] font-black uppercase text-muted tracking-widest block">Alasan Penyesuaian Massal</label>
                <textarea 
                  id="bulkReason"
                  rows={3} 
                  required
                  placeholder="Masukkan alasan penyesuaian untuk log mutasi..."
                  value={bulkForm.reason} 
                  onChange={e => setBulkForm({ ...bulkForm, reason: e.target.value })} 
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-255 dark:border-gray-700 rounded-xl p-3.5 text-xs outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setShowBulkModal(false)} 
                  className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-xs uppercase"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={bulkSaving || !bulkForm.reason.trim()}
                  className="flex-1 py-3.5 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 hover:bg-primary-hover transition-all disabled:opacity-50 text-xs uppercase"
                >
                  {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Eksekusi Massal"}
                </button>
              </div>
            </form>
          </div>
        )}
      </BaseModal>
    </div>
  );
}
