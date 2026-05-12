"use client";

export const runtime = 'edge';

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle2, Clock, ChefHat, PackageCheck, AlertCircle, Printer, Banknote, CreditCard, Receipt as ReceiptIcon, XCircle, ShieldAlert, RotateCcw, Star, MessageSquare, ArrowRight, Globe, X } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import Image from "next/image";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import Receipt from "@/components/Receipt";
import PaymentMethodSelector from "@/components/PaymentMethodSelector";

export default function OrderTrackingPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  
  // Refund States
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [accountName, setAccountName] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [submittingRefund, setSubmittingRefund] = useState(false);

  // Review States
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  // Payment Selection States
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);
  const [duitkuMethod, setDuitkuMethod] = useState("");
  const supabase = createClient();

  useEffect(() => {
    if (id) fetchOrderDetails();
    const channel = supabase.channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, payload => {
        setOrder((prev: any) => ({ ...prev, ...payload.new }));
        toast.success(`Status pesanan berubah: ${getStatusText(payload.new.status)}`);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      const { data: orderData, error } = await supabase.from("orders").select("*, tables(table_number)").eq("id", id).single();
      if (error) throw error;
      setOrder(orderData);

      const { data: itemsData } = await supabase.from("order_items").select("*, menu_items(name, image_url)").eq("order_id", id);
      setOrderItems(itemsData || []);

      if (orderData.customer_id) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", orderData.customer_id).single();
        if (profile) setCustomerName(profile.full_name);
      }

      const { data: revData } = await supabase.from("reviews").select("id").eq("order_id", id).maybeSingle();
      if (revData) setHasReviewed(true);
    } catch (e: any) {
      toast.error("Gagal memuat: " + e.message);
      router.push("/customer/orders");
    } finally { setLoading(false); }
  };

  const [paying, setPaying] = useState(false);

  const handlePayDuitku = async () => {
    if (paying) return;
    if (!duitkuMethod) {
      setShowPaymentSelector(true);
      return;
    }

    setPaying(true);
    const pToast = toast.loading("Menyiapkan pembayaran...");
    try {
      const res = await fetch('/api/payment/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: id,
          paymentMethod: duitkuMethod,
          returnUrl: window.location.href
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Gagal menyiapkan tagihan');
      
      if (data.paymentUrl) {
        toast.success("Menuju halaman pembayaran...", { id: pToast });
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("Gagal mengunduh tautan pembayaran.");
      }
    } catch (e: any) {
      toast.error(e.message, { id: pToast });
      setPaying(false);
    }
  };

  const handlePrint = () => {
    if (receiptRef.current) {
      const content = receiptRef.current.innerHTML;
      const win = window.open('', '', 'height=600,width=400');
      win?.document.write(`
        <html>
          <head>
            <title>Cetak Kwitansi</title>
            <style>
              body { font-family: monospace; padding: 20px; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body>${content}</body>
        </html>
      `);
      win?.document.close();
      win?.focus();
      setTimeout(() => { win?.print(); win?.close(); }, 500);
    }
  };

  const handleCancelOrder = async () => {
    setCancelling(true);
    try {
      const { error } = await supabase.from("orders").update({ 
        status: "cancelled",
        cancel_reason: "Dibatalkan oleh pelanggan"
      }).eq("id", id);
      if (error) throw error;
      
      if (order.table_id) {
        await supabase.from("tables").update({ status: "available" }).eq("id", order.table_id);
      }
      
      toast.success("Pesanan berhasil dibatalkan");
      fetchOrderDetails();
      setShowCancelConfirm(false);
    } catch (e: any) {
      toast.error("Gagal membatalkan: " + e.message);
    } finally { setCancelling(false); }
  };

  const handleSendReview = async () => {
    setSubmittingReview(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Silakan login kembali");
      
      const { error } = await supabase.from("reviews").insert({
        order_id: id,
        user_id: session.user.id,
        rating: reviewRating,
        comment: reviewComment
      });
      if (error) throw error;
      
      toast.success("Terima kasih atas ulasan Anda!");
      setHasReviewed(true);
      setShowReviewModal(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSubmittingReview(false); }
  };

  const handleSubmitRefund = async () => {
    if (!bankName || !accountNo || !accountName || !refundReason) {
      return toast.error("Mohon lengkapi semua data");
    }
    setSubmittingRefund(true);
    try {
      const refundInfo = {
        bankName,
        accountNo,
        accountName,
        refundReason,
        refundStatus: "pending",
        requestedAt: new Date().toISOString()
      };
      
      const { error } = await supabase.from("orders").update({
        cancel_reason: JSON.stringify(refundInfo),
        status: "cancelled"
      }).eq("id", id);
      
      if (error) throw error;
      toast.success("Pengajuan refund berhasil dikirim!");
      fetchOrderDetails();
      setShowRefundModal(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSubmittingRefund(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-muted font-medium animate-pulse">Memuat Detail Pesanan...</p>
      </div>
    </div>
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock className="w-6 h-6" />;
      case "confirmed": return <ChefHat className="w-6 h-6" />;
      case "completed": return <PackageCheck className="w-6 h-6" />;
      case "cancelled": return <AlertCircle className="w-6 h-6" />;
      default: return <Clock className="w-6 h-6" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending": return "Menunggu";
      case "confirmed": return "Diproses";
      case "completed": return "Selesai";
      case "cancelled": return "Dibatalkan";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500 border-amber-200 dark:border-amber-800";
      case "confirmed": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-500 border-blue-200 dark:border-blue-800";
      case "completed": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500 border-green-200 dark:border-green-800";
      case "cancelled": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-500 border-red-200 dark:border-red-800";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const steps = [
    { id: "pending", label: "Menunggu", icon: Clock },
    { id: "confirmed", label: "Diproses", icon: ChefHat },
    { id: "completed", label: "Selesai", icon: PackageCheck },
  ];
  const currentIdx = steps.findIndex(s => s.id === order.status);
  const isPaid = order.payment_status === "paid";
  const isCancelled = order.status === "cancelled";
  const canCancel = order.status === "pending";

  const getRefundData = () => {
    if (!order?.cancel_reason) return null;
    try {
      const parsed = JSON.parse(order.cancel_reason);
      if (parsed && typeof parsed === "object" && "refundStatus" in parsed) {
        return parsed;
      }
    } catch (e) {}
    return null;
  };
  const refundData = getRefundData();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 pb-32">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/customer/orders" className="flex items-center gap-2 text-muted hover:text-primary transition-colors font-bold text-sm uppercase tracking-wider">
          <ArrowLeft className="w-5 h-5" /> Kembali ke Riwayat
        </Link>
        <div className={`px-4 py-1.5 rounded-full border-2 font-black text-xs uppercase tracking-widest ${getStatusColor(order.status)}`}>
          {getStatusText(order.status)}
        </div>
      </div>

      <div className="bg-card-light dark:bg-card-dark rounded-3xl p-8 md:p-10 shadow-sm border border-border-light dark:border-border-dark relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-8 border-b border-border-light dark:border-border-dark">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-text-light dark:text-text-dark tracking-tight">Pesanan #{id?.substring(0, 8).toUpperCase()}</h1>
            <p className="text-muted mt-2 font-medium">Dipesan pada {format(new Date(order.created_at), "d MMMM yyyy, HH:mm", { locale: localeId })}</p>
          </div>
          <div className="text-left md:text-right">
            <span className="text-xs font-black uppercase text-muted tracking-widest block mb-1">Total Transaksi</span>
            <span className="text-3xl font-black text-primary">Rp {Number(order.total_amount).toLocaleString("id-ID")}</span>
          </div>
        </div>

        {isCancelled ? (
          <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-100 dark:border-red-900 rounded-3xl p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 text-red-500 rounded-2xl flex items-center justify-center mb-4"><XCircle className="w-8 h-8" /></div>
            <h3 className="text-xl font-black text-red-900 dark:text-red-400 mb-2 uppercase tracking-tight">Pesanan Dibatalkan</h3>
            
            {!refundData ? (
              <p className="text-red-600/80 mt-1 mb-4 font-medium">{order.cancel_reason || "Dibatalkan oleh sistem/kasir"}</p>
            ) : (
              <div className="mt-4 p-5 bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-900 text-left w-full max-w-lg space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b pb-3">
                  <span className="font-bold text-xs uppercase tracking-wider text-muted">Status Refund:</span>
                  <span className={`text-xs font-black px-3 py-1 rounded-full uppercase ${
                    refundData.refundStatus === "pending" ? "bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse" :
                    refundData.refundStatus === "approved" ? "bg-green-100 text-green-700 border border-green-200" :
                    "bg-red-100 text-red-700 border border-red-200"
                  }`}>
                    {refundData.refundStatus === "pending" ? "Menunggu" :
                     refundData.refundStatus === "approved" ? "Disetujui" : "Ditolak"}
                  </span>
                </div>
                <div className="text-xs text-text-light dark:text-text-dark space-y-2 font-semibold">
                  <p><span className="text-muted">Bank/E-Wallet:</span> {refundData.bankName}</p>
                  <p><span className="text-muted">No. Rekening/HP:</span> {refundData.accountNo}</p>
                  <p><span className="text-muted">Atas Nama:</span> {refundData.accountName}</p>
                  <p><span className="text-muted">Alasan:</span> {refundData.refundReason}</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8">
            <div className="relative flex justify-between items-center w-full max-w-2xl mx-auto before:absolute before:inset-0 before:top-1/2 before:-translate-y-1/2 before:h-1 before:bg-gray-200 dark:before:bg-gray-700 before:z-0">
              <motion.div className="absolute top-1/2 -translate-y-1/2 h-1 bg-primary z-0" initial={{ width: "0%" }} animate={{ width: `${Math.max(0, (currentIdx / (steps.length - 1)) * 100)}%` }} transition={{ duration: 0.5 }} />
              {steps.map((step, i) => {
                const done = i <= currentIdx; const current = i === currentIdx; const Icon = step.icon;
                return (
                  <div key={step.id} className="relative z-10 flex flex-col items-center gap-3">
                    <motion.div animate={{ scale: current ? 1.2 : 1, backgroundColor: done ? "#e85d04" : "var(--card-color)" }} className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${done ? "border-primary text-white" : "border-gray-300 dark:border-gray-600 text-gray-400 bg-card-light dark:bg-card-dark"}`}>
                      <Icon className="w-6 h-6" />
                    </motion.div>
                    <span className={`text-xs font-black absolute top-14 w-24 text-center uppercase tracking-tighter ${current ? "text-primary" : done ? "text-text-light dark:text-text-dark" : "text-muted"}`}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="bg-card-light dark:bg-card-dark rounded-3xl p-8 md:p-10 shadow-sm border border-border-light dark:border-border-dark mt-8">
        <h2 className="text-xl font-black text-text-light dark:text-text-dark mb-8 border-b border-border-light dark:border-border-dark pb-4 uppercase tracking-widest flex items-center gap-3">
          <ReceiptIcon className="w-6 h-6 text-primary" /> Daftar Item
        </h2>
        <div className="space-y-6">
          {orderItems.map(item => (
            <div key={item.id} className="flex gap-6 items-center p-4 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-border-light dark:border-border-dark">
                <Image src={item.menu_items?.image_url || "https://placehold.co/100"} alt={item.menu_items?.name} fill className="object-cover" />
              </div>
              <div className="flex-1">
                <h4 className="font-black text-lg text-text-light dark:text-text-dark">{item.menu_items?.name}</h4>
                <p className="text-sm font-bold text-muted mt-1">{item.quantity} x Rp {Number(item.price).toLocaleString("id-ID")}</p>
                {item.notes && <p className="text-[11px] text-primary italic font-medium mt-1">Note: {item.notes}</p>}
              </div>
              <div className="font-black text-lg text-text-light dark:text-text-dark text-right">Rp {Number(item.subtotal).toLocaleString("id-ID")}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-8 border-t border-border-light dark:border-border-dark">
          <div className="space-y-4 max-w-sm ml-auto">
            <div className="flex justify-between text-muted font-bold"><span>Subtotal</span><span>Rp {Number(order.total_amount).toLocaleString("id-ID")}</span></div>
            <div className="flex justify-between text-muted font-bold"><span>Pajak & Layanan</span><span>Termasuk</span></div>
            <div className="flex justify-between items-center pt-4 border-t border-border-light dark:border-border-dark">
              <span className="font-black text-text-light dark:text-text-dark uppercase tracking-wider">Total Akhir</span>
              <span className="text-3xl font-black text-primary">Rp {Number(order.total_amount).toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between items-center pt-4">
              <span className="text-xs font-black text-muted uppercase tracking-widest">Status Pembayaran</span>
              <span className={`text-xs font-black px-4 py-1.5 rounded-full uppercase ${
                isPaid ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500" : 
                isCancelled ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" : 
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-500"
              }`}>
                {isPaid ? "Lunas" : isCancelled ? "Dibatalkan" : "Belum Bayar"}
              </span>
            </div>

            {!isPaid && !isCancelled && (
              <div className="mt-6 pt-6 border-t border-border-light dark:border-border-dark">
                {order.payment_method === "cash" ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3">
                    <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-bold leading-relaxed">
                      Silakan lakukan pembayaran secara tunai di kasir utama. Status pesanan akan otomatis terupdate setelah dikonfirmasi oleh staf.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    <button
                      onClick={handlePayDuitku}
                      disabled={paying}
                      className="w-full py-4 bg-primary text-white rounded-2xl font-black text-lg hover:bg-primary-hover shadow-xl shadow-primary/30 transition-all flex items-center justify-center gap-3 uppercase tracking-wider"
                    >
                      {paying ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CreditCard className="w-6 h-6" /> Bayar Sekarang</>}
                    </button>
                    <p className="text-[10px] text-center text-muted font-bold uppercase tracking-widest">
                      Aman & Terverifikasi Otomatis
                    </p>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>

        {isPaid && (
          <div className="mt-10 flex flex-col sm:flex-row gap-4">
            <button onClick={() => setShowReceipt(true)} className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20 transition-all uppercase tracking-wider">
              <ReceiptIcon className="w-6 h-6" /> Kwitansi
            </button>
            <button onClick={() => { setShowReceipt(true); setTimeout(handlePrint, 300); }} className="flex-1 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20 transition-all uppercase tracking-wider">
              <Printer className="w-6 h-6" /> Cetak
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showPaymentSelector && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowPaymentSelector(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card-light dark:bg-card-dark rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden border border-border-light dark:border-border-dark my-8">
              <div className="bg-primary p-8 text-white flex justify-between items-center relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                <div className="relative">
                  <h2 className="text-2xl font-black uppercase tracking-tight">Metode Pembayaran</h2>
                  <p className="text-white/80 text-sm mt-1">Total Tagihan: <span className="font-extrabold text-white text-base">Rp {Number(order.total_amount).toLocaleString("id-ID")}</span></p>
                </div>
                <button onClick={() => setShowPaymentSelector(false)} title="Tutup" aria-label="Tutup" className="p-2 hover:bg-white/10 rounded-full text-white relative z-10"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <PaymentMethodSelector 
                  amount={Number(order.total_amount)} 
                  onSelect={(method) => setDuitkuMethod(method)} 
                  selectedMethod={duitkuMethod} 
                />
              </div>

              <div className="p-8 bg-gray-50 dark:bg-gray-800/50 border-t border-border-light dark:border-border-dark flex gap-4">
                <button onClick={() => setShowPaymentSelector(false)} className="flex-1 py-4 border border-border-light dark:border-border-dark rounded-2xl font-bold text-muted hover:bg-gray-50 transition-colors uppercase text-sm">Batal</button>
                <button 
                  onClick={handlePayDuitku} 
                  disabled={paying || !duitkuMethod} 
                  className="flex-[2] py-4 bg-primary text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg shadow-primary/20 disabled:opacity-50 uppercase tracking-widest text-sm"
                >
                  {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CreditCard className="w-5 h-5" /> Bayar Sekarang</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* END OF MAIN WRAPPER */}
    </div>
  );
}

function Info(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
}
