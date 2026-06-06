"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Search, Eye, Loader2, Filter, Clock, CheckCircle, XCircle, ChefHat, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import OrderCountdown from "@/components/OrderCountdown";
import OrderEstimationBadge from "@/components/OrderEstimationBadge";
import BaseModal from "@/components/BaseModal";

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    fetchOrders();

    const channel = supabase.channel("admin-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      const { data } = await supabase.from("orders").select("*, profiles!orders_customer_id_fkey(full_name)").order("created_at", { ascending: false });
      const filtered = (data || []).filter((o: any) => !(o.payment_method === 'non_cash' && o.payment_status === 'unpaid'));
      setOrders(filtered);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const viewOrder = async (order: any) => {
    setSelectedOrder(order);
    const { data } = await supabase.from("order_items").select("*, menu_items(name, image_url)").eq("order_id", order.id);
    setOrderItems(data || []);
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    processing: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  const statusTexts: Record<string, string> = { pending: "Menunggu", confirmed: "Dikonfirmasi", processing: "Diproses", ready: "Siap", completed: "Selesai", cancelled: "Dibatalkan" };

  const filtered = orders.filter(o => {
    if (filter !== "all" && o.status !== filter) return false;
    if (search && !o.id.includes(search) && !o.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Kelola Pesanan</h1>
          <p className="text-muted mt-1">{orders.length} total pesanan</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari pesanan..." className="w-full pl-10 pr-4 py-2.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-full focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
        {["all", "pending", "confirmed", "processing", "ready", "completed", "cancelled"].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filter === s ? "bg-primary text-white" : "bg-card-light dark:bg-card-dark text-text-light dark:text-text-dark border border-border-light dark:border-border-dark"}`}>
            {s === "all" ? "Semua" : statusTexts[s] || s} {s !== "all" && `(${orders.filter(o => o.status === s).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((order, i) => (
          <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="bg-card-light dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark p-5 hover:border-primary/30 transition-colors">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-text-light dark:text-text-dark">#{order.id.split("-")[0]}</span>
                  <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-md ${statusColors[order.status]}`}>{statusTexts[order.status]}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-muted">{order.order_type === "dine_in" ? "Dine In" : order.order_type === "delivery" ? "Delivery" : "Takeaway"}</span>
                  <OrderEstimationBadge order={order} />
                </div>
                <p className="text-sm text-muted">{order.profiles?.full_name || "Guest"} - {new Date(order.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' })} WIB</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-primary">Rp {Number(order.total_amount).toLocaleString("id-ID")}</span>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => viewOrder(order)} className="p-2 hover:bg-primary/10 rounded-lg transition-colors text-primary" aria-label="Lihat Detail" title="Lihat Detail">
                  <Eye className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16"><ShoppingBag className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" /><p className="text-muted">Tidak ada pesanan ditemukan.</p></div>
        )}
      </div>

      {/* Detail Modal */}
      <BaseModal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} size="lg" title={selectedOrder ? `Detail No. Pesanan ${selectedOrder.id.split("-")[0]}` : ""}>
        {selectedOrder && (
          <div className="space-y-4">
            {selectedOrder.estimated_duration_minutes && (
              <OrderCountdown order={selectedOrder} />
            )}
            {orderItems.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-background-light dark:bg-background-dark rounded-xl">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden shrink-0">
                  {item.menu_items?.image_url && <img src={item.menu_items.image_url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-text-light dark:text-text-dark">{item.menu_items?.name}</p>
                  <p className="text-xs text-muted">{item.quantity}x @ Rp {Number(item.price).toLocaleString("id-ID")}</p>
                </div>
                <span className="font-bold text-sm text-primary">Rp {Number(item.subtotal).toLocaleString("id-ID")}</span>
              </div>
            ))}
            <div className="border-t border-border-light dark:border-border-dark pt-4 flex justify-between">
              <span className="font-bold text-text-light dark:text-text-dark">Total</span>
              <span className="font-bold text-xl text-primary">Rp {Number(selectedOrder.total_amount).toLocaleString("id-ID")}</span>
            </div>
          </div>
        )}
      </BaseModal>
    </div>
  );
}
