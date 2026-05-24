"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Loader2, ArrowRight, Clock, CheckCircle, XCircle, ChefHat, Banknote, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { SkeletonOrderItem } from "@/components/Skeleton";

type TabType = "active" | "completed" | "cancelled";

export default function CustomerOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("active");
  const supabase = createClient();

  useEffect(() => {
    fetchOrders();

    // Realtime: listen for ALL changes (INSERT, UPDATE)
    const channel = supabase.channel("customer-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        // Re-fetch all orders to get fresh data
        fetchOrders();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchOrders = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;
      const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", session.session.user.id).single();
      if (!profile) return;

      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", profile.id)
        .order("created_at", { ascending: false });

      setOrders(data || []);
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      processing: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
      completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    };
    return map[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusText = (status: string, paymentMethod?: string) => {
    if (status === "pending" && paymentMethod === "non_cash") return "Menunggu Verifikasi";
    const map: Record<string, string> = {
      pending: "Menunggu", confirmed: "Dikonfirmasi", processing: "Diproses",
      ready: "Siap Disajikan", completed: "Selesai", cancelled: "Dibatalkan",
    };
    return map[status] || status;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="w-5 h-5 text-yellow-500" />;
      case "confirmed": case "processing": return <ChefHat className="w-5 h-5 text-blue-500" />;
      case "ready": return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case "completed": return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "cancelled": return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-muted" />;
    }
  };

  // Filter orders by tab
  const activeOrders = orders.filter(o => !["completed", "cancelled"].includes(o.status));
  const completedOrders = orders.filter(o => o.status === "completed");
  const cancelledOrders = orders.filter(o => o.status === "cancelled");

  const currentOrders = activeTab === "active" ? activeOrders : activeTab === "completed" ? completedOrders : cancelledOrders;

  const tabs = [
    { id: "active" as TabType, label: "Aktif", count: activeOrders.length, color: "text-primary", bgActive: "bg-primary" },
    { id: "completed" as TabType, label: "Selesai", count: completedOrders.length, color: "text-green-600", bgActive: "bg-green-500" },
    { id: "cancelled" as TabType, label: "Dibatalkan", count: cancelledOrders.length, color: "text-red-600", bgActive: "bg-red-500" },
  ];

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="mb-8 animate-pulse">
          <div className="h-8 bg-gray-250 dark:bg-gray-750 rounded-xl w-48 mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-xl w-64" />
        </div>
        
        {/* Stats Cards Skeleton */}
        <div className="grid grid-cols-3 gap-4 mb-8 animate-pulse">
          <div className="bg-gray-250 dark:bg-gray-750 h-24 rounded-2xl" />
          <div className="bg-gray-250 dark:bg-gray-750 h-24 rounded-2xl" />
          <div className="bg-gray-250 dark:bg-gray-750 h-24 rounded-2xl" />
        </div>

        {/* Tab Buttons Skeleton */}
        <div className="flex gap-2 mb-6 animate-pulse">
          <div className="bg-gray-250 dark:bg-gray-750 w-24 h-10 rounded-full" />
          <div className="bg-gray-250 dark:bg-gray-750 w-24 h-10 rounded-full" />
          <div className="bg-gray-250 dark:bg-gray-750 w-24 h-10 rounded-full" />
        </div>

        <div className="space-y-4">
          <SkeletonOrderItem />
          <SkeletonOrderItem />
          <SkeletonOrderItem />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Pesanan Saya</h1>
        <p className="text-muted mt-1">Lacak status pesanan Anda secara real-time</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <motion.div whileHover={{ y: -2 }} onClick={() => setActiveTab("active")} className={`rounded-2xl p-5 text-white shadow-lg cursor-pointer transition-all bg-gradient-to-br from-primary to-primary-hover ${activeTab === "active" ? "ring-4 ring-primary/30 scale-[1.02]" : ""}`}>
          <div className="flex items-center gap-2 mb-2"><Clock className="w-5 h-5 opacity-80" /><span className="text-white/80 text-sm">Aktif</span></div>
          <p className="text-3xl font-bold">{activeOrders.length}</p>
        </motion.div>
        <motion.div whileHover={{ y: -2 }} onClick={() => setActiveTab("completed")} className={`rounded-2xl p-5 text-white shadow-lg cursor-pointer transition-all bg-gradient-to-br from-green-500 to-emerald-600 ${activeTab === "completed" ? "ring-4 ring-green-500/30 scale-[1.02]" : ""}`}>
          <div className="flex items-center gap-2 mb-2"><CheckCircle className="w-5 h-5 opacity-80" /><span className="text-white/80 text-sm">Selesai</span></div>
          <p className="text-3xl font-bold">{completedOrders.length}</p>
        </motion.div>
        <motion.div whileHover={{ y: -2 }} onClick={() => setActiveTab("cancelled")} className={`rounded-2xl p-5 text-white shadow-lg cursor-pointer transition-all bg-gradient-to-br from-red-500 to-rose-600 ${activeTab === "cancelled" ? "ring-4 ring-red-500/30 scale-[1.02]" : ""}`}>
          <div className="flex items-center gap-2 mb-2"><XCircle className="w-5 h-5 opacity-80" /><span className="text-white/80 text-sm">Dibatalkan</span></div>
          <p className="text-3xl font-bold">{cancelledOrders.length}</p>
        </motion.div>
      </div>

      {/* Tab Buttons */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${activeTab === tab.id ? `${tab.bgActive} text-white shadow-md` : "bg-card-light dark:bg-card-dark text-text-light dark:text-text-dark border border-border-light dark:border-border-dark hover:border-primary/50"}`}>
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-white/20" : "bg-gray-100 dark:bg-gray-800 text-muted"}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {currentOrders.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center py-20 bg-card-light dark:bg-card-dark rounded-2xl border border-dashed border-border-light dark:border-border-dark">
              {activeTab === "active" && <><ShoppingBag className="w-16 h-16 text-muted mx-auto mb-4 opacity-50" /><h3 className="text-xl font-medium text-text-light dark:text-text-dark">Tidak ada pesanan aktif</h3><p className="text-muted mt-2">Pesan makanan favorit Anda dari menu!</p></>}
              {activeTab === "completed" && <><CheckCircle className="w-16 h-16 text-muted mx-auto mb-4 opacity-50" /><h3 className="text-xl font-medium text-text-light dark:text-text-dark">Belum ada pesanan selesai</h3><p className="text-muted mt-2">Pesanan yang sudah selesai akan muncul di sini.</p></>}
              {activeTab === "cancelled" && <><XCircle className="w-16 h-16 text-muted mx-auto mb-4 opacity-50" /><h3 className="text-xl font-medium text-text-light dark:text-text-dark">Tidak ada pesanan dibatalkan</h3><p className="text-muted mt-2">Pesanan yang dibatalkan akan muncul di sini.</p></>}
            </motion.div>
          ) : (
            <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {currentOrders.map((order, i) => (
                <Link key={order.id} href={`/customer/orders/${order.id}`}>
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -2 }} className={`bg-card-light dark:bg-card-dark border rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer transition-colors shadow-sm mb-4 ${order.status === "cancelled" ? "border-red-200 dark:border-red-900/40" : "border-border-light dark:border-border-dark hover:border-primary/50"}`}>
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl hidden sm:flex items-center justify-center ${order.status === "cancelled" ? "bg-red-100 dark:bg-red-900/20" : order.status === "completed" ? "bg-green-100 dark:bg-green-900/20" : "bg-primary/10"}`}>
                        {getStatusIcon(order.status)}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-bold text-lg text-text-light dark:text-text-dark">#{order.id.split("-")[0]}</h3>
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-md ${getStatusColor(order.status)}`}>
                            {getStatusText(order.status, order.payment_method)}
                          </span>
                          {order.payment_status === "paid" && (
                            <span className="text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-md bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Lunas</span>
                          )}
                          {order.payment_status !== "paid" && order.status !== "cancelled" && (
                            <span className="text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Belum Bayar</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                          <span>{format(new Date(order.created_at), "dd MMM yyyy, HH:mm", { locale: localeId })}</span>
                          <span>-</span>
                          <span>{order.order_type === "dine_in" ? "Dine In" : "Takeaway"}</span>
                          {order.payment_method && (
                            <>
                              <span>-</span>
                              <span className="flex items-center gap-1">
                                {order.payment_method === "cash" ? <Banknote className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                                {order.payment_method === "cash" ? "Tunai" : "Non-Tunai"}
                              </span>
                            </>
                          )}
                        </div>
                        {order.status === "cancelled" && order.cancel_reason && (
                          <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Alasan: {order.cancel_reason}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-0 border-border-light dark:border-border-dark pt-4 md:pt-0 mt-2 md:mt-0">
                      <div className="text-left md:text-right">
                        <p className="text-xs text-muted mb-1">Total</p>
                        <p className={`font-bold text-lg ${order.status === "cancelled" ? "text-muted line-through" : "text-primary"}`}>
                          Rp {Number(order.total_amount).toLocaleString("id-ID")}
                        </p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark flex items-center justify-center shrink-0">
                        <ArrowRight className="w-5 h-5 text-muted" />
                      </div>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
