"use client";

export const runtime = 'edge';

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  ShoppingBag, Search, Clock, CheckCircle2, XCircle, 
  ChevronRight, ArrowRight, Printer, MessageSquare, 
  Timer, Globe, Check, X, AlertTriangle
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
  const [cashierName, setCashierName] = useState("");
  const supabase = createClient();

  // Modal Rejection
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [orderToReject, setOrderToReject] = useState<any>(null);

  useEffect(() => {
    fetchOrders();
    fetchCashierName();

    const channel = supabase
      .channel('online-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
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
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, profiles(full_name, email), order_items(*, menu_items(*))')
      .eq('order_type', 'delivery') // Fokus hanya pesanan online (delivery)
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
      
      toast.success(newStatus === 'confirmed' ? "Pesanan Diterima & Masuk Dapur" : "Pesanan Berhasil Dibatalkan", { id: loadingToast });
      setSelectedOrder(null);
      setShowRejectModal(false);
      setRejectionReason("");
      fetchOrders();
    } catch (err) {
      toast.error("Gagal memperbarui status", { id: loadingToast });
    }
  };

  const filteredOrders = orders.filter(order => 
    order.id.toLowerCase().includes(search.toLowerCase()) ||
    order.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-amber-100 text-amber-700 border-amber-200";
      case "confirmed": return "bg-orange-100 text-orange-700 border-orange-200";
      case "processing": return "bg-blue-100 text-blue-700 border-blue-200";
      case "completed": return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "cancelled": return "bg-rose-100 text-rose-700 border-rose-200";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-text-light dark:text-text-dark flex items-center gap-2">
            <Globe className="w-8 h-8 text-primary" />
            Manajemen Pesanan Online
          </h1>
          <p className="text-muted text-sm mt-1">Kelola dan verifikasi pesanan yang masuk melalui aplikasi pelanggan.</p>
        </div>
        
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Cari ID atau nama pelanggan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary outline-none w-full md:w-80 transition-all text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Order List */}
        <div className="lg:col-span-7 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark">
              <Clock className="w-8 h-8 text-primary animate-spin" />
              <p className="text-muted text-sm animate-pulse">Menghubungkan ke database...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark">
              <ShoppingBag className="w-12 h-12 text-muted/30" />
              <p className="text-muted font-medium">Belum ada pesanan online masuk.</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <motion.div
                key={order.id}
                layoutId={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`p-5 rounded-3xl border transition-all cursor-pointer group relative overflow-hidden ${
                  selectedOrder?.id === order.id 
                    ? "bg-primary/5 border-primary shadow-lg shadow-primary/10" 
                    : "bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark hover:shadow-xl hover:translate-y-[-2px]"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-sm text-text-light dark:text-text-dark">
                        #{order.id.substring(0, 8).toUpperCase()}
                      </h3>
                      <p className="text-[10px] text-muted font-bold uppercase tracking-wider">
                        {format(new Date(order.created_at), "HH:mm · dd MMM yyyy", { locale: localeId })}
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getStatusColor(order.status)}`}>
                    {order.status === 'pending' ? 'Menunggu' : order.status === 'confirmed' ? 'Diterima' : order.status}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-muted uppercase">Pelanggan</p>
                    <p className="text-sm font-black text-text-light dark:text-text-dark">{order.profiles?.full_name || 'Pelanggan Umum'}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs font-bold text-muted uppercase">Total Bayar</p>
                    <p className="text-base font-black text-primary">Rp {Number(order.total_amount).toLocaleString('id-ID')}</p>
                  </div>
                </div>

                {order.status === 'pending' && (
                  <div className="mt-4 flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); updateOrderStatus(order.id, 'confirmed'); }}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" /> Terima
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setOrderToReject(order); setShowRejectModal(true); }}
                      className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" /> Tolak
                    </button>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>

        {/* Order Details Panel */}
        <div className="lg:col-span-5">
          <AnimatePresence mode="wait">
            {selectedOrder ? (
              <motion.div
                key={selectedOrder.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-6 sticky top-8 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black text-text-light dark:text-text-dark">Detail Pesanan</h2>
                  <button 
                    onClick={() => setSelectedOrder(null)} 
                    aria-label="Tutup Detail"
                    title="Tutup Detail"
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-muted" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Customer Info */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-border-light dark:border-border-dark">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase">
                        {selectedOrder.profiles?.full_name?.charAt(0) || 'P'}
                      </div>
                      <div>
                        <p className="text-sm font-black text-text-light dark:text-text-dark">{selectedOrder.profiles?.full_name || 'Pelanggan Umum'}</p>
                        <p className="text-[10px] text-muted font-bold">{selectedOrder.profiles?.email || 'No Email'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="space-y-3">
                    <p className="text-xs font-black text-muted uppercase tracking-widest">Daftar Menu</p>
                    {selectedOrder.order_items?.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b border-border-light dark:border-border-dark last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                            {item.menu_items?.image_url ? (
                              <Image src={item.menu_items.image_url} alt={item.menu_items.name} width={48} height={48} className="object-cover w-full h-full" />
                            ) : (
                              <ShoppingBag className="w-5 h-5 text-muted/30" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-text-light dark:text-text-dark">{item.menu_items?.name}</p>
                            <p className="text-[10px] text-muted font-bold uppercase">{item.quantity} x Rp {Number(item.price).toLocaleString('id-ID')}</p>
                            {item.notes && <p className="text-[9px] text-primary font-bold mt-1 italic">Note: {item.notes}</p>}
                          </div>
                        </div>
                        <p className="text-sm font-black text-text-light dark:text-text-dark">Rp {Number(item.subtotal).toLocaleString('id-ID')}</p>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="pt-6 border-t border-border-light dark:border-border-dark space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-muted">Subtotal</span>
                      <span className="text-sm font-bold text-text-light dark:text-text-dark">Rp {Number(selectedOrder.total_amount).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-black">
                      <span className="text-text-light dark:text-text-dark">Total</span>
                      <span className="text-primary">Rp {Number(selectedOrder.total_amount).toLocaleString('id-ID')}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {selectedOrder.status === 'pending' && (
                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={() => updateOrderStatus(selectedOrder.id, 'confirmed')}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        <Check className="w-5 h-5" /> TERIMA PESANAN
                      </button>
                      <button 
                        onClick={() => { setOrderToReject(selectedOrder); setShowRejectModal(true); }}
                        aria-label="Tolak Pesanan"
                        title="Tolak Pesanan"
                        className="w-16 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-rose-500/20"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  )}

                  {selectedOrder.status === 'confirmed' && (
                    <div className="flex flex-col gap-2 pt-4">
                       <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Pesanan telah diterima dan sedang diproses di dapur.</p>
                       </div>
                       <button 
                          onClick={() => updateOrderStatus(selectedOrder.id, 'processing')}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                          PROSES SEKARANG
                        </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 bg-card-light/50 dark:bg-card-dark/50 rounded-3xl border-2 border-dashed border-border-light dark:border-border-dark opacity-50">
                <Globe className="w-16 h-16 text-muted mb-4" />
                <p className="text-center font-bold text-muted">Pilih pesanan online di samping untuk melihat rincian.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Reject Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowRejectModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-6 w-full max-w-md shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-text-light dark:text-text-dark">Tolak Pesanan Online</h3>
                  <p className="text-xs text-muted font-bold uppercase tracking-widest">#{orderToReject?.id.substring(0, 8).toUpperCase()}</p>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-muted">Mohon berikan alasan penolakan pesanan ini agar pelanggan mengetahuinya.</p>
                <textarea 
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Contoh: Menu habis, Restoran sedang sangat ramai, dll..."
                  className="w-full h-32 p-4 bg-gray-50 dark:bg-gray-800/50 border border-border-light dark:border-border-dark rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none text-sm transition-all"
                />
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setShowRejectModal(false)}
                    className="flex-1 py-3 font-black text-xs uppercase tracking-widest text-muted hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={() => updateOrderStatus(orderToReject.id, 'cancelled', rejectionReason)}
                    disabled={!rejectionReason.trim()}
                    className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-lg shadow-rose-500/20"
                  >
                    TOLAK PESANAN
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
