"use client";

export const runtime = 'edge';

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  ShoppingBag, Search, Clock, CheckCircle2, XCircle, 
  Globe, Check, X, AlertTriangle, Filter, 
  ArrowRight, MessageSquare, Timer, Zap, History,
  Volume2, VolumeX, ChevronRight, MapPin, Store
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import Image from "next/image";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

export default function OnlineOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "processing" | "history">("pending");
  const [cashierName, setCashierName] = useState("");
  const supabase = createClient();

  // Modal Rejection
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [orderToReject, setOrderToReject] = useState<any>(null);

  useEffect(() => {
    fetchOrders();
    fetchCashierName();

    // Realtime Listener
    const channel = supabase
      .channel('online-orders-management')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: "order_type=in.(delivery,takeaway)"
      }, () => fetchOrders())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchCashierName = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).single();
      setCashierName(data?.full_name || "Kasir");
    }
  };

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, profiles(full_name, email, phone), order_items(*, menu_items(*))')
      .in('order_type', ['delivery', 'takeaway'])
      .or('payment_status.eq.paid,payment_method.eq.cash') // Hanya yang sudah bayar atau tunai
      .order('created_at', { ascending: false });

    if (!error) setOrders(data || []);
    setLoading(false);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string, reason?: string) => {
    const loadingToast = toast.loading("Memperbarui status...");
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === 'cancelled' && reason) {
        const timestamp = format(new Date(), "HH:mm:ss");
        updateData.notes = `[Dibatalkan Kasir ${cashierName} jam ${timestamp}]: ${reason}`;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      
      toast.success(
        newStatus === 'confirmed' ? "Pesanan Diterima!" : 
        newStatus === 'processing' ? "Pesanan Mulai Diproses" :
        newStatus === 'completed' ? "Pesanan Selesai" : "Pesanan Dibatalkan", 
        { id: loadingToast }
      );
      
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
      }
      setShowRejectModal(false);
      setRejectionReason("");
      fetchOrders();
    } catch (err) {
      toast.error("Gagal memperbarui status", { id: loadingToast });
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(search.toLowerCase()) ||
      order.profiles?.full_name?.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;

    if (activeTab === "pending") return order.status === "pending";
    if (activeTab === "processing") return order.status === "confirmed" || order.status === "processing";
    if (activeTab === "history") return order.status === "completed" || order.status === "cancelled";
    
    return true;
  });

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pending": return { label: "Baru", color: "bg-rose-100 text-rose-700 border-rose-200", icon: Zap };
      case "confirmed": return { label: "Diterima", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle2 };
      case "processing": return { label: "Diproses", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Timer };
      case "completed": return { label: "Selesai", color: "bg-gray-100 text-gray-700 border-gray-200", icon: History };
      case "cancelled": return { label: "Ditolak", color: "bg-rose-100 text-rose-700 border-rose-200", icon: XCircle };
      default: return { label: status, color: "bg-gray-100 text-gray-700 border-gray-200", icon: Clock };
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-8 bg-background-light dark:bg-background-dark min-h-screen">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-light dark:text-text-dark flex items-center gap-3 tracking-tight">
            <div className="p-2.5 bg-primary/10 rounded-2xl text-primary">
              <Globe className="w-8 h-8" />
            </div>
            Manajemen Pesanan Online
          </h1>
          <p className="text-muted text-sm mt-1 font-medium">Monitoring dan verifikasi pesanan pelanggan secara real-time.</p>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Cari Pesanan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 pr-4 py-3.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl focus:ring-2 focus:ring-primary outline-none w-full md:w-64 transition-all text-sm font-bold shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex gap-2 p-1.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl w-fit shadow-sm">
        {[
          { id: "pending", label: "Baru", icon: Zap, count: orders.filter(o => o.status === "pending").length },
          { id: "processing", label: "Aktif", icon: Timer, count: orders.filter(o => ["confirmed", "processing"].includes(o.status)).length },
          { id: "history", label: "Riwayat", icon: History, count: orders.filter(o => ["completed", "cancelled"].includes(o.status)).length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
              activeTab === tab.id 
                ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" 
                : "text-muted hover:text-text-light dark:hover:text-text-dark"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? "bg-white/20 text-white" : "bg-primary/10 text-primary"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Order List List */}
        <div className="lg:col-span-7 space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4 bg-card-light dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted font-black text-xs uppercase tracking-widest animate-pulse">Menghubungkan Server...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-64 gap-4 bg-card-light dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm"
              >
                <div className="p-5 bg-gray-50 dark:bg-gray-800 rounded-full text-muted/30">
                  <ShoppingBag className="w-10 h-10" />
                </div>
                <p className="text-muted font-bold">Tidak ada pesanan di tab {activeTab}.</p>
              </motion.div>
            ) : (
              filteredOrders.map((order) => {
                const statusInfo = getStatusInfo(order.status);
                const Icon = statusInfo.icon;
                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => setSelectedOrder(order)}
                    className={`p-6 rounded-[2rem] border transition-all cursor-pointer group relative overflow-hidden ${
                      selectedOrder?.id === order.id 
                        ? "bg-primary/5 border-primary shadow-2xl shadow-primary/10" 
                        : "bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark hover:shadow-xl hover:translate-y-[-2px]"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl ${statusInfo.color} flex items-center justify-center transition-transform group-hover:scale-110`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-black text-base text-text-light dark:text-text-dark tracking-tight">
                            #{order.id.substring(0, 8).toUpperCase()}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3 text-muted" />
                            <p className="text-[10px] text-muted font-bold uppercase tracking-wider">
                              {format(new Date(order.created_at), "HH:mm · dd MMM", { locale: localeId })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${statusInfo.color}`}>
                          {statusInfo.label}
                        </div>
                        {order.payment_status === 'paid' ? (
                          <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[9px] font-black uppercase tracking-tighter">Lunas</div>
                        ) : (
                          <div className="px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg text-[9px] font-black uppercase tracking-tighter">Bayar Tunai</div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-gray-50/50 dark:bg-gray-800/30 p-4 rounded-2xl border border-border-light/50 dark:border-border-dark/50">
                      <div>
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Pelanggan</p>
                        <p className="text-sm font-black text-text-light dark:text-text-dark truncate">
                          {order.profiles?.full_name || 'Guest'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Total Bayar</p>
                        <p className="text-base font-black text-primary">Rp {Number(order.total_amount).toLocaleString('id-ID')}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                       <div className="flex items-center gap-2 text-[10px] font-bold text-muted uppercase">
                          {order.order_type === 'delivery' ? (
                            <><Globe className="w-3 h-3 text-primary" /> Delivery Order</>
                          ) : (
                            <><Store className="w-3 h-3 text-blue-500" /> Takeaway Order</>
                          )}
                       </div>
                       <ChevronRight className={`w-5 h-5 text-muted transition-transform ${selectedOrder?.id === order.id ? 'rotate-90 text-primary' : 'group-hover:translate-x-1'}`} />
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-5">
          <AnimatePresence mode="wait">
            {selectedOrder ? (
              <motion.div
                key={selectedOrder.id}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                className="bg-card-light dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark p-8 sticky top-8 shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                
                <div className="flex items-center justify-between mb-8 relative z-10">
                  <h2 className="text-xl font-black text-text-light dark:text-text-dark uppercase tracking-tight">Detail Transaksi</h2>
                  <button 
                    onClick={() => setSelectedOrder(null)} 
                    aria-label="Tutup Detail"
                    title="Tutup Detail"
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
                  >
                    <X className="w-6 h-6 text-muted" />
                  </button>
                </div>

                <div className="space-y-8 relative z-10">
                  {/* Customer Info Card */}
                  <div className="p-5 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-xl shadow-lg shadow-primary/30">
                        {selectedOrder.profiles?.full_name?.charAt(0) || 'P'}
                      </div>
                      <div>
                        <p className="text-base font-black text-text-light dark:text-text-dark leading-none">{selectedOrder.profiles?.full_name || 'Pelanggan Umum'}</p>
                        <p className="text-xs text-muted font-bold mt-1.5">{selectedOrder.profiles?.email || 'Tidak ada email'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <div className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark text-[10px] font-black text-muted uppercase tracking-widest text-center">
                          {selectedOrder.profiles?.phone || 'Tanpa HP'}
                       </div>
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-muted uppercase tracking-widest">Daftar Menu</p>
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-black">{selectedOrder.order_items?.length} Items</span>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                      {selectedOrder.order_items?.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800/40 rounded-2xl border border-border-light/50 dark:border-border-dark/50">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden border border-border-light dark:border-border-dark">
                              {item.menu_items?.image_url ? (
                                <Image src={item.menu_items.image_url} alt={item.menu_items.name} width={48} height={48} className="object-cover w-full h-full" />
                              ) : (
                                <ShoppingBag className="w-5 h-5 text-muted/30" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-black text-text-light dark:text-text-dark">{item.menu_items?.name}</p>
                              <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-0.5">{item.quantity} x Rp {Number(item.price).toLocaleString('id-ID')}</p>
                            </div>
                          </div>
                          <p className="text-sm font-black text-primary">Rp {Number(item.subtotal).toLocaleString('id-ID')}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing Summary */}
                  <div className="pt-6 border-t-2 border-dashed border-border-light dark:border-border-dark space-y-3">
                    <div className="flex justify-between items-center text-sm font-bold text-muted uppercase tracking-wider">
                      <span>Subtotal</span>
                      <span className="text-text-light dark:text-text-dark">Rp {Number(selectedOrder.total_amount).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-black text-text-light dark:text-text-dark uppercase tracking-tight">Total Akhir</span>
                      <span className="text-3xl font-black text-primary">Rp {Number(selectedOrder.total_amount).toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  {/* Conditional Actions */}
                  <div className="pt-4">
                    {selectedOrder.status === 'pending' && (
                      <div className="flex gap-4">
                        <button 
                          onClick={() => updateOrderStatus(selectedOrder.id, 'confirmed')}
                          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 transition-all active:scale-95 uppercase tracking-widest text-xs"
                        >
                          <Check className="w-5 h-5" /> TERIMA
                        </button>
                        <button 
                          onClick={() => { setOrderToReject(selectedOrder); setShowRejectModal(true); }}
                          aria-label="Tolak Pesanan"
                          title="Tolak Pesanan"
                          className="w-16 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-xl shadow-rose-500/20"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                    )}

                    {selectedOrder.status === 'confirmed' && (
                      <button 
                        onClick={() => updateOrderStatus(selectedOrder.id, 'processing')}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3 transition-all active:scale-95 uppercase tracking-widest text-sm"
                      >
                        <Timer className="w-6 h-6" /> MULAI PROSES MASAK
                      </button>
                    )}

                    {selectedOrder.status === 'processing' && (
                      <button 
                        onClick={() => updateOrderStatus(selectedOrder.id, 'completed')}
                        className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 transition-all active:scale-95 uppercase tracking-widest text-sm"
                      >
                        <CheckCircle2 className="w-6 h-6" /> SELESAIKAN PESANAN
                      </button>
                    )}
                    
                    {['completed', 'cancelled'].includes(selectedOrder.status) && (
                      <div className={`p-5 rounded-2xl border flex items-center gap-4 ${
                        selectedOrder.status === 'completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-rose-50 border-rose-100 text-rose-700'
                      }`}>
                        {selectedOrder.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                        <div>
                           <p className="text-sm font-black uppercase tracking-widest">Transaksi Selesai</p>
                           <p className="text-[10px] font-bold opacity-80">{selectedOrder.status === 'completed' ? 'Pesanan telah diantar dan sukses.' : 'Pesanan ini telah ditolak/dibatalkan.'}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-[500px] flex flex-col items-center justify-center p-12 bg-card-light/50 dark:bg-card-dark/50 rounded-[3rem] border-2 border-dashed border-border-light dark:border-border-dark opacity-50">
                <div className="p-8 bg-gray-100 dark:bg-gray-800 rounded-full mb-6">
                  <Globe className="w-16 h-16 text-muted/30" />
                </div>
                <p className="text-center font-black text-muted uppercase tracking-widest text-sm">Pilih pesanan untuk kelola</p>
                <p className="text-center text-xs text-muted font-medium mt-2">Detail transaksi akan muncul di sini secara real-time.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowRejectModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 30 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative bg-card-light dark:bg-card-dark rounded-[2.5rem] border border-border-light dark:border-border-dark p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center gap-5 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-inner">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-text-light dark:text-text-dark tracking-tight">Tolak Pesanan</h3>
                  <p className="text-[10px] text-rose-500 font-black uppercase tracking-widest mt-1">#{orderToReject?.id.substring(0, 8).toUpperCase()}</p>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-sm text-muted font-medium">Mohon tuliskan alasan penolakan. Pelanggan akan menerima notifikasi alasan ini.</p>
                <textarea 
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Contoh: Maaf, stok menu tersebut sudah habis atau restoran sedang tutup..."
                  className="w-full h-40 p-5 bg-gray-50 dark:bg-gray-800/50 border border-border-light dark:border-border-dark rounded-[1.5rem] focus:ring-2 focus:ring-rose-500 outline-none text-sm transition-all font-medium resize-none shadow-inner"
                />
                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowRejectModal(false)}
                    className="flex-1 py-4 font-black text-xs uppercase tracking-widest text-muted hover:bg-gray-100 dark:hover:bg-gray-800 rounded-2xl transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => updateOrderStatus(orderToReject.id, 'cancelled', rejectionReason)}
                    disabled={!rejectionReason.trim()}
                    className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all active:scale-95 shadow-xl shadow-rose-500/20"
                  >
                    KIRIM PENOLAKAN
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
