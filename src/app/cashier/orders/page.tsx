"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, Eye, Check, X, CreditCard, Banknote, Printer, Receipt as ReceiptIcon, CheckCircle, Ban, MessageSquare, Users, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { format } from "date-fns";
import Receipt from "@/components/Receipt";

export default function CashierOrders() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "paid" | "cancelled">("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [processingPayment, setProcessingPayment] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const receiptRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchOrders();
    fetchCashierName();
    const orderChannel = supabase.channel("cashier-orders-v3")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .subscribe();
    
    // tableChannel sync removed since fetchTables is not defined here.
    
    const timer = setInterval(() => setCurrentTime(new Date()), 60000); // update every minute

    return () => { 
      supabase.removeChannel(orderChannel); 
      clearInterval(timer);
    };
  }, []);

  const fetchCashierName = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase.from("profiles").select("full_name").eq("user_id", session.user.id).single();
      if (data) setCashierName(data.full_name);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data } = await supabase
        .from("orders")
        .select("*, profiles!orders_customer_id_fkey(full_name), tables(table_number), cashier:profiles!orders_cashier_id_fkey(full_name)")
        .neq('order_type', 'delivery') // Sembunyikan pesanan online dari sini
        .order("created_at", { ascending: false });
      setOrders(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const getCustomerName = (order: any) => {
    if (!order) return "Guest";
    // Robustly unpack relationship just in case Supabase returns an array wrapper
    const rawProfile = order.profiles;
    const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;

    if (profile?.full_name) return profile.full_name;
    
    if (order.notes?.includes("[NAMA: ")) {
      const nameSegment = order.notes.split("[NAMA: ")[1]?.split("]")[0];
      if (nameSegment && nameSegment.trim()) {
         return nameSegment.trim();
      }
    }
    return "Guest";
  };



  const updateOrderStatus = async (orderId: string, newStatus: string, reason?: string) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action: 'update_status', status: newStatus, reason }),
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal mengubah status');
      
      toast.success(`Status: ${newStatus}`);
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus, cancel_reason: reason || selectedOrder.cancel_reason });
      }
      fetchOrders();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) return toast.error("Silakan masukkan alasan pembatalan");
    setCancellingOrder(true);
    try {
      const detailedReason = `[Oleh: ${cashierName || 'Kasir'} - ${format(new Date(), "dd/MM/yy HH:mm")}] ${cancelReason}`;
      await updateOrderStatus(selectedOrder.id, "cancelled", detailedReason);
      setShowCancelModal(false);
      setCancelReason("");
    } finally { setCancellingOrder(false); }
  };

  const processPayment = async (orderId: string) => {
    setProcessingPayment(true);
    try {
      // Get current cashier profile ID
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", session?.user.id).single();

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId, 
          action: 'update_payment', 
          paymentStatus: 'paid',
          cashierId: profile?.id 
        }),
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal memproses pembayaran');

      // Update status to processing (Diproses) automatically
      const resStatus = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action: 'update_status', status: 'processing' }),
      });
      
      toast.success("Pembayaran cashless berhasil diverifikasi & Pesanan otomatis diproses!");
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, payment_status: "paid", status: "processing" });
      }
      fetchOrders();
    } catch (e: any) { toast.error(e.message); } finally { setProcessingPayment(false); }
  };

  const handleGenerateDuitkuLink = async (orderId: string) => {
    setProcessingPayment(true);
    const loadingToast = toast.loading("Membuat tagihan pembayaran...");
    try {
      const res = await fetch('/api/payment/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Gagal membuat tagihan pembayaran');
      
      if (data.reference && typeof (window as any).checkout !== 'undefined') {
        toast.dismiss(loadingToast);
        // Gunakan Duitku Pop SDK untuk popup transparan
        (window as any).checkout.process(data.reference, {
          successEvent: async function(result: any) {
            toast.success("Pembayaran berhasil!");
            await fetch('/api/payment/check-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId })
            });
            fetchOrders();
            if (selectedOrder?.id === orderId) {
              setSelectedOrder({ ...selectedOrder, payment_status: "paid", status: "confirmed" });
            }
            setProcessingPayment(false);
          },
          pendingEvent: function(result: any) {
            toast.success("Menunggu konfirmasi pembayaran...");
            fetchOrders();
            setProcessingPayment(false);
          },
          errorEvent: function(result: any) {
            toast.error("Pembayaran gagal.");
            setProcessingPayment(false);
          },
          closeEvent: async function() {
            const checkRes = await fetch('/api/payment/check-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId })
            });
            const checkData = await checkRes.json();
            if (checkData.status === 'paid') {
              toast.success("Pembayaran berhasil!");
              if (selectedOrder?.id === orderId) {
                setSelectedOrder({ ...selectedOrder, payment_status: "paid", status: "confirmed" });
              }
            }
            fetchOrders();
            setProcessingPayment(false);
          }
        });
      } else if (data.paymentUrl) {
        // Fallback: copy link & open window
        await navigator.clipboard.writeText(data.paymentUrl);
        toast.success("Tautan pembayaran berhasil disalin!", { id: loadingToast, duration: 5000 });
        window.open(data.paymentUrl, "OnlinePayment", "width=450,height=700");
        setProcessingPayment(false);
      }
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan sistem', { id: loadingToast });
      setProcessingPayment(false);
    }
  };

  const viewOrderDetails = async (order: any) => {
    setSelectedOrder(order);
    setShowReceipt(false);
    const { data } = await supabase.from("order_items").select("*, menu_items(name)").eq("order_id", order.id);
    setOrderItems(data || []);
    
    // Use cashier name from join if exists, otherwise use current session name
    if (order.cashier?.full_name) {
      setCashierName(order.cashier.full_name);
    } else {
      fetchCashierName(); // Fallback to current user if just paid
    }

    if (order.customer_id) {
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", order.customer_id).single();
      if (p) setCustomerName(p.full_name);
    } else {
      setCustomerName(getCustomerName(order));
    }
  };

  const handlePrint = () => {
    const el = receiptRef.current;
    if (!el) return;
    const win = window.open("", "_blank", "width=450,height=700");
    if (!win) return;
    win.document.write(`<html><head><title>Kwitansi</title><style>body{margin:0;padding:20px;font-family:'Courier New',monospace;font-size:13px}*{box-sizing:border-box}.text-center{text-align:center}.font-bold{font-weight:bold}.font-extrabold{font-weight:800}.text-xs{font-size:11px}.text-sm{font-size:12px}.text-base{font-size:14px}.text-2xl{font-size:22px}.mb-2{margin-bottom:8px}.mb-4{margin-bottom:16px}.mb-6{margin-bottom:24px}.mt-1{margin-top:4px}.mt-2{margin-top:8px}.mt-3{margin-top:12px}.pt-2{padding-top:8px}.pt-4{padding-top:16px}.pb-4{padding-bottom:16px}.pb-6{padding-bottom:24px}.p-8{padding:20px}.space-y-1>*+*{margin-top:4px}.border-dashed{border-style:dashed}.border-b{border-bottom:1px dashed #ccc}.border-t{border-top:1px dashed #ccc}.flex{display:flex}.justify-between{justify-content:space-between}.items-center{align-items:center}.gap-2{gap:8px}.uppercase{text-transform:uppercase}.tracking-wider{letter-spacing:2px}.text-gray-400{color:#999}.text-gray-500{color:#777}.text-gray-600{color:#555}.text-green-700{color:#15803d}.text-red-700{color:#b91c1c}.bg-green-100{background:#dcfce7;padding:4px 12px;border-radius:12px;border:1px solid #86efac}.bg-red-100{background:#fee2e2;padding:4px 12px;border-radius:12px;border:1px solid #fca5a5}@media print{body{padding:10px}}</style></head><body>`);
    win.document.write(el.innerHTML);
    win.document.write("</body></html>");
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const filtered = orders.filter(o => {
    const matchesSearch = o.id.toLowerCase().includes(searchQuery.toLowerCase()) || getCustomerName(o).toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === "pending") return o.status === "pending";
    if (activeTab === "paid") return o.payment_status === "paid";
    if (activeTab === "cancelled") return o.status === "cancelled";
    return true;
  });

  const getPaymentBadge = (order: any) => {
    if (order.status === "cancelled") return <span className="text-gray-400 text-xs">-</span>;
    if (order.payment_status === "paid") {
      return <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs px-2 py-1 rounded-md font-bold uppercase flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Lunas</span>;
    }
    return <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs px-2 py-1 rounded-md font-bold uppercase">Belum Bayar</span>;
  };

  return (
    <div className="max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Daftar Pesanan</h1>
          <p className="text-muted mt-1">Kelola dan pantau pesanan pelanggan</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari pesanan..." className="w-full pl-10 pr-4 py-2.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-full focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark shadow-sm" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { id: "all", label: "Semua", count: orders.length },
          { id: "pending", label: "Menunggu", count: orders.filter(o => o.status === "pending").length },
          { id: "paid", label: "Lunas", count: orders.filter(o => o.payment_status === "paid").length },
          { id: "cancelled", label: "Dibatalkan", count: orders.filter(o => o.status === "cancelled").length }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === tab.id ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-card-light dark:bg-card-dark text-muted hover:text-text-light dark:hover:text-text-dark border border-border-light dark:border-border-dark"}`}>
            {tab.label} <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.id ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-800 text-muted"}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
          <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card-light dark:bg-card-dark rounded-3xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark text-muted text-xs uppercase tracking-wider">
                    <th className="p-6 font-bold">ID Pesanan</th>
                    <th className="p-6 font-bold">Waktu</th>
                    <th className="p-6 font-bold">Pelanggan</th>
                    <th className="p-6 font-bold">Tipe</th>
                    <th className="p-6 font-bold">Total</th>
                    <th className="p-6 font-bold">Metode</th>
                    <th className="p-6 font-bold">Pembayaran</th>
                    <th className="p-6 font-bold">Status</th>
                    <th className="p-6 font-bold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={9} className="py-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={9} className="py-20 text-center">
                      <div className="flex flex-col items-center opacity-50">
                        <Ban className="w-16 h-16 text-muted mb-4" />
                        <p className="text-muted font-medium">Tidak ada pesanan di kategori ini.</p>
                      </div>
                    </td></tr>
                  ) : filtered.map(order => (
                    <tr key={order.id} className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="p-6 font-mono text-sm font-bold text-text-light dark:text-text-dark">
                        #{order.id.split("-")[0]}
                        {["pending", "confirmed", "processing"].includes(order.status) && (currentTime.getTime() - new Date(order.created_at).getTime()) > 15 * 60 * 1000 && (
                          <span title="Pesanan tertunda > 15 menit" className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-red-100 text-red-600 rounded-full animate-pulse">!</span>
                        )}
                      </td>
                      <td className="p-6 text-sm text-muted">{format(new Date(order.created_at), "HH:mm")}</td>
                      <td className="p-6">
                        <p className="text-sm font-bold text-text-light dark:text-text-dark">{getCustomerName(order)}</p>
                        <p className="text-[10px] text-muted uppercase mt-0.5">{order.order_type}</p>
                      </td>
                      <td className="p-6 text-sm text-muted">{order.order_type === "dine_in" ? `Meja ${order.tables?.table_number || "-"}` : "Takeaway"}</td>
                      <td className="p-6 font-black text-text-light dark:text-text-dark">Rp {Number(order.total_amount).toLocaleString("id-ID")}</td>
                      <td className="p-6 text-xs font-bold text-muted uppercase">
                        {order.notes?.includes("[METODE:") 
                          ? order.notes.split("[METODE:")[1].split("]")[0] 
                          : order.payment_method}
                      </td>
                      <td className="p-6">{getPaymentBadge(order)}</td>
                      <td className="p-6">
                        <select disabled={order.status === "cancelled" || (order.status === "completed" && order.payment_status === "paid")} title="Status" value={order.status} onChange={e => updateOrderStatus(order.id, e.target.value)} className={`text-[10px] px-3 py-1.5 rounded-full font-black uppercase outline-none border cursor-pointer transition-all ${order.status === "pending" ? "bg-yellow-50 text-yellow-700 border-yellow-200" : order.status === "completed" ? "bg-green-50 text-green-700 border-green-200" : order.status === "cancelled" ? "bg-red-50 text-red-700 border-red-200 opacity-50" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                          <option value="pending">Pending</option>
                          <option value="confirmed">Konfirmasi</option>
                          <option value="processing">Proses</option>
                          <option value="ready">Siap</option>
                          <option value="completed">Selesai</option>
                          <option value="cancelled">Dibatalkan</option>
                        </select>
                      </td>
                      <td className="p-6 text-center">
                        <button onClick={() => viewOrderDetails(order)} title="Lihat Detail" aria-label="Lihat Detail" className="p-2.5 text-primary hover:bg-primary/10 rounded-xl transition-all shadow-sm"><Eye className="w-5 h-5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

      </AnimatePresence>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedOrder && !showReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedOrder(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.95 }} className="relative bg-card-light dark:bg-card-dark w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-2xl text-text-light dark:text-text-dark">Pesanan #{selectedOrder.id.split("-")[0]}</h3>
                    <span className={`text-[10px] px-2 py-1 rounded-md font-black uppercase ${selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'}`}>{selectedOrder.status}</span>
                  </div>
                  <p className="text-sm text-muted mt-1">{format(new Date(selectedOrder.created_at), "dd MMMM yyyy, HH:mm")}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} title="Tutup" aria-label="Tutup" className="p-3 text-muted hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl transition-all"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-8 overflow-y-auto flex-1 space-y-8">
                <div className="grid grid-cols-2 gap-6 p-6 bg-background-light dark:bg-background-dark rounded-3xl border border-border-light dark:border-border-dark">
                  <div><p className="text-[10px] font-bold uppercase text-muted tracking-widest mb-1">Pelanggan</p><p className="font-black text-lg text-text-light dark:text-text-dark">{customerName || selectedOrder.profiles?.full_name || "Guest"}</p></div>
                  <div className="text-right"><p className="text-[10px] font-bold uppercase text-muted tracking-widest mb-1">Tipe</p><p className="font-black text-lg text-primary">{selectedOrder.order_type === "dine_in" ? `Meja ${selectedOrder.tables?.table_number}` : "Takeaway"}</p></div>
                  <div><p className="text-[10px] font-bold uppercase text-muted tracking-widest mb-1">Pembayaran</p><p className="font-black flex items-center gap-2 text-text-light dark:text-text-dark">
                    {selectedOrder.notes?.includes("[METODE:") 
                      ? selectedOrder.notes.split("[METODE:")[1].split("]")[0] 
                      : selectedOrder.payment_method}
                  </p></div>
                  <div className="text-right"><p className="text-[10px] font-bold uppercase text-muted tracking-widest mb-1">Status Bayar</p><span className={`text-xs font-black px-3 py-1 rounded-full uppercase ${selectedOrder.payment_status === "paid" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{selectedOrder.payment_status === "paid" ? "Lunas" : "Belum Bayar"}</span></div>
                </div>

                {selectedOrder.status === "cancelled" && selectedOrder.cancel_reason && (
                  <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-3xl flex gap-4">
                    <Ban className="w-6 h-6 text-red-500 shrink-0" />
                    <div>
                      <p className="font-black text-red-700 dark:text-red-400 uppercase text-xs">Alasan Pembatalan</p>
                      <p className="text-red-600 dark:text-red-300 mt-1 font-medium">{selectedOrder.cancel_reason}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h4 className="font-black text-sm uppercase tracking-widest text-muted flex items-center gap-2"><ReceiptIcon className="w-4 h-4" /> Daftar Pesanan</h4>
                  <div className="space-y-3">
                    {orderItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-border-light dark:border-border-dark">
                        <div>
                          <p className="font-bold text-text-light dark:text-text-dark">{item.quantity}x {item.menu_items?.name}</p>
                          {item.notes && <p className="text-[10px] font-bold text-primary mt-1 uppercase">Notes: {item.notes}</p>}
                        </div>
                        <p className="font-black text-text-light dark:text-text-dark">Rp {Number(item.subtotal).toLocaleString("id-ID")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-8 border-t border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-gray-800/30">
                <div className="flex justify-between items-center mb-8">
                  <span className="font-black text-muted uppercase tracking-widest">Total Bayar</span>
                  <span className="font-black text-3xl text-primary">Rp {Number(selectedOrder.total_amount).toLocaleString("id-ID")}</span>
                </div>

                <div className="flex gap-4">
                  {selectedOrder.status !== "cancelled" && selectedOrder.status !== "completed" && (
                    <>
                      {selectedOrder.status === "pending" && (
                        <div className="flex flex-1 gap-3">
                          <motion.button 
                            whileTap={{ scale: 0.98 }} 
                            onClick={() => updateOrderStatus(selectedOrder.id, "confirmed")} 
                            className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black hover:bg-green-700 flex items-center justify-center gap-2 shadow-xl shadow-green-500/20 transition-all uppercase text-sm tracking-wider"
                          >
                            <CheckCircle className="w-6 h-6" /> Terima Pesanan
                          </motion.button>
                          
                          <motion.button 
                            whileTap={{ scale: 0.98 }} 
                            onClick={() => setShowCancelModal(true)} 
                            className="flex-1 py-4 bg-red-50 text-red-500 rounded-2xl font-black hover:bg-red-100 transition-all uppercase text-xs"
                          >
                            <X className="w-5 h-5" /> Tolak Pesanan
                          </motion.button>
                        </div>
                      )}
                      
                      {selectedOrder.payment_method === "non_cash" && selectedOrder.payment_status !== "paid" && (
                        <motion.button whileTap={{ scale: 0.98 }} onClick={() => processPayment(selectedOrder.id)} disabled={processingPayment} className="flex-1 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-2xl font-black hover:from-cyan-600 hover:to-blue-700 flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/20 transition-all uppercase text-xs tracking-wider">
                          {processingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Verifikasi Manual</>}
                        </motion.button>
                      )}
                      
                      {(selectedOrder.status === "confirmed" || selectedOrder.status === "processing") && (
                        <div className="flex flex-1 gap-3">
                          <motion.button whileTap={{ scale: 0.98 }} onClick={() => updateOrderStatus(selectedOrder.id, "completed")} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black hover:bg-primary-hover flex items-center justify-center gap-2 shadow-xl shadow-primary/30 transition-all uppercase text-sm tracking-wider">
                            <CheckCircle className="w-6 h-6" /> Pesanan Selesai
                          </motion.button>
                          <motion.button 
                            whileTap={{ scale: 0.98 }} 
                            onClick={() => setShowCancelModal(true)} 
                            className="py-4 px-6 bg-red-50 text-red-500 rounded-2xl font-black hover:bg-red-100 transition-all uppercase text-xs"
                          >
                            Batalkan
                          </motion.button>
                        </div>
                      )}
                    </>
                  )}

                  {selectedOrder.payment_status === "paid" && selectedOrder.status !== "cancelled" && (
                    <motion.button whileTap={{ scale: 0.98 }} onClick={() => setShowReceipt(true)} className="flex-1 py-4 bg-blue-500 text-white rounded-2xl font-black hover:bg-blue-600 flex items-center justify-center gap-2 shadow-xl shadow-blue-500/30 transition-all uppercase text-sm tracking-wider">
                      <ReceiptIcon className="w-6 h-6" /> Kwitansi
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel Reason Modal */}
      <AnimatePresence>
        {showCancelModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCancelModal(false)} className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-card-light dark:bg-card-dark w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center"><Ban className="w-6 h-6 text-red-500" /></div>
                <div>
                  <h3 className="font-black text-xl text-text-light dark:text-text-dark">Batalkan Pesanan</h3>
                  <p className="text-sm text-muted">Berikan alasan pembatalan ini</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} placeholder="Contoh: Stok habis, pelanggan tidak jadi, dll..." className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl p-4 outline-none focus:ring-2 focus:ring-red-500/20 text-text-light dark:text-text-dark font-medium" />
                
                <div className="flex gap-3">
                  <button onClick={() => setShowCancelModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-muted font-black rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all uppercase text-xs">Tutup</button>
                  <button onClick={handleCancelOrder} disabled={cancellingOrder} className="flex-[2] py-4 bg-red-500 text-white font-black rounded-2xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/30 uppercase text-xs flex items-center justify-center gap-2">
                    {cancellingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : "Batalkan Sekarang"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Receipt Modal */}
      <AnimatePresence>
        {showReceipt && selectedOrder?.payment_status === "paid" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-md z-[70] flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowReceipt(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} onClick={e => e.stopPropagation()} className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-[420px] w-full my-8">
              <div className="p-6 bg-gray-50 flex justify-between items-center border-b border-gray-100">
                <button onClick={() => setShowReceipt(false)} className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-xl text-xs font-black hover:bg-gray-50 transition-all uppercase"><ArrowLeft className="w-3 h-3" /> Kembali</button>
                <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-xl text-xs font-black hover:bg-primary-hover shadow-lg shadow-primary/30 transition-all uppercase"><Printer className="w-4 h-4" /> Cetak Kwitansi</button>
              </div>
              <Receipt ref={receiptRef} order={selectedOrder} orderItems={orderItems} customerName={customerName || selectedOrder.profiles?.full_name || "Guest"} cashierName={cashierName} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
