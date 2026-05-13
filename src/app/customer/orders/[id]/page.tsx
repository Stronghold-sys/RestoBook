"use client";

export const runtime = 'edge';

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle2, Clock, ChefHat, PackageCheck, AlertCircle, Printer, Banknote, CreditCard, Receipt as ReceiptIcon, XCircle, ShieldAlert, RotateCcw, Star, MessageSquare, ArrowRight, Globe, X, Lock } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import Image from "next/image";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import Receipt from "@/components/Receipt";

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

    setPaying(true);
    const pToast = toast.loading("Menyiapkan portal pembayaran aman...");
    try {
      const res = await fetch('/api/payment/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: id,
          paymentMethod: "", // Kosongkan untuk pilihan lengkap
          returnUrl: window.location.href
        })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Gagal menyiapkan tagihan');
      
      if (data.reference && typeof (window as any).checkout !== 'undefined') {
         toast.dismiss(pToast);
         setPaying(false);
         (window as any).checkout.process(data.reference, {
            successEvent: async function(result: any) {
               console.log("Duitku Success Event:", result);
               toast.success("Pembayaran Berhasil!");
               await fetch('/api/payment/check-status', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    orderId: id,
                    duitkuOrderId: result?.merchantOrderId || id 
                  })
               });
               setTimeout(() => fetchOrderDetails(), 500);
            },
            pendingEvent: async function(result: any) {
               console.log("Duitku Pending Event:", result);
               toast("Menunggu Konfirmasi...", { icon: "⏳" });
               await fetch('/api/payment/check-status', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    orderId: id,
                    duitkuOrderId: result?.merchantOrderId || id 
                  })
               });
               setTimeout(() => fetchOrderDetails(), 500);
            },
            errorEvent: function(result: any) {
               toast.error("Transaksi dibatalkan.");
            },
            closeEvent: async function() {
               console.log("Duitku Pop Closed. Syncing status...");
               // Proaktif cek status ke Duitku saat popup ditutup
               await fetch('/api/payment/check-status', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ orderId: id })
               });
               setTimeout(() => fetchOrderDetails(), 500);
            }
         });
      } else if (data.paymentUrl) {
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
    const el = receiptRef.current;
    if (!el) return;
    const win = window.open("", "_blank", "width=450,height=700");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Cetak Kwitansi</title>
          <style>
            body { margin: 0; padding: 0; font-family: monospace; }
            @page { margin: 0; size: 80mm auto; }
          </style>
        </head>
        <body>
          ${el.outerHTML}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const handleCancelOrder = async () => {
    setCancelling(true);
    try {
      // Jika tunai, langsung batalkan tanpa data refund
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
      
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: id,
          action: 'submit_refund',
          refundDetails: refundInfo
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal mengirim pengajuan refund');
      
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
      case "confirmed": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-500 border-orange-200 dark:border-orange-800";
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
          <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-100 dark:border-red-900 rounded-3xl p-8 flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/50 text-red-500 rounded-2xl flex items-center justify-center mb-4"><XCircle className="w-8 h-8" /></div>
            <h3 className="text-xl font-black text-red-900 dark:text-red-400 mb-2 uppercase tracking-tight">Pesanan Dibatalkan</h3>
            
            {!refundData ? (
              <p className="text-red-600/80 mt-1 mb-4 font-medium text-center">{order.cancel_reason || "Dibatalkan oleh sistem/kasir"}</p>
            ) : (
              <div className="mt-6 w-full space-y-6">
                <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl border border-red-200 dark:border-red-900 shadow-sm">
                   <div className="flex items-center gap-3">
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${refundData.refundStatus === 'approved' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                       {refundData.refundStatus === 'approved' ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                     </div>
                     <div>
                       <p className="text-[10px] font-black uppercase text-muted tracking-widest">Status Refund</p>
                       <p className="text-sm font-black text-text-light dark:text-text-dark uppercase">
                         {refundData.refundStatus === "pending" ? "Menunggu Persetujuan" :
                          refundData.refundStatus === "approved" ? "Refund Disetujui" : "Refund Ditolak"}
                       </p>
                     </div>
                   </div>
                   <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${
                     refundData.refundStatus === "pending" ? "bg-yellow-100 text-yellow-700 animate-pulse" :
                     refundData.refundStatus === "approved" ? "bg-green-100 text-green-700" :
                     "bg-red-100 text-red-700"
                   }`}>
                     {refundData.refundStatus === "pending" ? "Proses" :
                      refundData.refundStatus === "approved" ? "Berhasil" : "Gagal"}
                   </span>
                </div>

                {/* Refund Details Grid (Seperti di Gambar) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Metode Refund</p>
                    <p className="text-lg font-black text-primary flex items-center gap-2">
                      <CreditCard className="w-5 h-5" /> {refundData.bankName}
                    </p>
                  </div>
                  <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Nomor Rekening</p>
                    <p className="text-lg font-black text-text-light dark:text-text-dark tracking-tighter">
                      {refundData.accountNo}
                    </p>
                  </div>
                  <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm md:col-span-2">
                    <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Atas Nama Pemilik</p>
                    <p className="text-lg font-black text-text-light dark:text-text-dark uppercase">
                      {refundData.accountName}
                    </p>
                  </div>
                </div>

                <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                  <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Alasan Pengaju</p>
                  <p className="text-sm font-medium text-text-light dark:text-text-dark">
                    {refundData.refundReason}
                  </p>
                </div>

                {refundData.adminNotes && (
                  <div className="p-6 bg-orange-50 dark:bg-orange-950/20 rounded-2xl border border-orange-100 dark:border-orange-900 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-orange-600 tracking-widest mb-1">Catatan Admin</p>
                    <p className="text-sm font-semibold text-orange-900 dark:text-orange-400 leading-relaxed">
                      {refundData.adminNotes}
                    </p>
                  </div>
                )}

                {refundData.proofUrl && (
                  <div className="p-5 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-3">Bukti Transfer Refund</p>
                    <div className="relative rounded-2xl overflow-hidden border border-border-light dark:border-border-dark group cursor-zoom-in" onClick={() => window.open(refundData.proofUrl)}>
                      <img src={refundData.proofUrl} alt="Bukti Transfer" className="w-full h-auto max-h-[300px] object-contain bg-gray-50 rounded-xl" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <span className="bg-white/90 text-black text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-wider">Perbesar Gambar</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-red-200 dark:border-red-900 flex justify-between items-center">
                   <span className="text-[10px] font-black uppercase text-muted tracking-widest">Total Refund</span>
                   <span className="text-2xl font-black text-primary">Rp {Number(order.total_amount).toLocaleString("id-ID")}</span>
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
                    <motion.div animate={{ scale: current ? 1.2 : 1, backgroundColor: done ? "#f97316" : "var(--card-color)" }} className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 ${done ? "border-primary text-white" : "border-gray-300 dark:border-gray-600 text-gray-400 bg-card-light dark:bg-card-dark"}`}>
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
          <div className="mt-10">
            <button 
              onClick={() => setShowReceipt(true)} 
              className="w-full py-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl font-black flex items-center justify-center gap-4 shadow-xl shadow-emerald-500/20 transition-all uppercase tracking-widest group"
            >
              <div className="bg-white/20 p-2 rounded-lg group-hover:scale-110 transition-transform">
                <ReceiptIcon className="w-6 h-6" />
              </div>
              Lihat Kwitansi Digital
            </button>
          </div>
        )}

        {/* FOOTER ACTIONS (CANCEL, REFUND, REVIEW) */}
        <div className="mt-6 flex flex-wrap gap-4 border-t border-border-light dark:border-border-dark pt-6">
          {!isCancelled && (
            <>
              {order.status === "pending" ? (
                order.payment_method !== 'cash' && isPaid ? (
                  <button 
                    onClick={() => setShowRefundModal(true)}
                    className="flex items-center gap-2 text-red-600 hover:text-red-700 font-bold text-xs uppercase tracking-wider bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-xl border border-red-200 transition-all shadow-sm"
                  >
                    <RotateCcw className="w-4 h-4" /> Batalkan & Refund
                  </button>
                ) : (
                  <button 
                    onClick={() => setShowCancelConfirm(true)}
                    className="flex items-center gap-2 text-gray-600 hover:text-red-600 font-bold text-xs uppercase tracking-wider hover:bg-red-50 px-4 py-2.5 rounded-xl transition-all"
                  >
                    <XCircle className="w-4 h-4" /> Batalkan Pesanan
                  </button>
                )
              ) : ["confirmed", "processing"].includes(order.status) ? (
                <button 
                  onClick={() => toast.error("Mohon maaf, pesanan tidak dapat dibatalkan karena Chef kami sudah mulai menyiapkan hidangan Anda di dapur. Silakan hubungi staf jika ada kendala mendesak.", {
                    icon: "👨‍🍳",
                    duration: 4000
                  })}
                  className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wider bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 rounded-xl border border-amber-200 dark:border-amber-800 transition-all active:scale-95 shadow-sm"
                >
                  <Lock className="w-4 h-4 text-amber-500" /> Sedang Diproses (Tidak Bisa Dibatalkan)
                </button>
              ) : null}
            </>
          )}

          {isCancelled && isPaid && order.payment_method !== 'cash' && !refundData && (
            <button 
              onClick={() => setShowRefundModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-red-500 to-pink-600 text-white font-black text-xs uppercase tracking-widest px-6 py-3 rounded-2xl shadow-lg shadow-red-500/20 hover:scale-105 transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Ajukan Refund Dana Sekarang
            </button>
          )}
          
          {order.status === "completed" && !hasReviewed && (
            <button 
              onClick={() => setShowReviewModal(true)}
              className="w-full mt-4 py-4 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-orange-500/30 transition-all uppercase tracking-wider transform hover:-translate-y-1"
            >
              <Star className="w-6 h-6 fill-white" /> Beri Ulasan & Penilaian
            </button>
          )}
        </div>
      </div>

      {/* ================== MODALS ZONE ================== */}

      {/* 1. CANCEL CONFIRM MODAL */}
      <AnimatePresence>
        {showCancelConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCancelConfirm(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-card-dark w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-8 text-center border border-gray-100 dark:border-gray-800">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 mx-auto rounded-2xl flex items-center justify-center mb-4 border border-red-100"><ShieldAlert className="w-8 h-8 text-red-500" /></div>
              <h3 className="font-black text-xl text-gray-900 dark:text-white mb-2">Batalkan Pesanan?</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">Tindakan ini tidak dapat dibatalkan. Lanjutkan membatalkan pesanan Anda?</p>
              <div className="flex gap-3">
                <button onClick={() => setShowCancelConfirm(false)} className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">Kembali</button>
                <button onClick={handleCancelOrder} disabled={cancelling} className="flex-1 py-3.5 bg-red-500 text-white font-black rounded-2xl shadow-lg shadow-red-500/30 flex items-center justify-center hover:bg-red-600">
                  {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ya, Batalkan"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. REFUND APPLICATION MODAL */}
      <AnimatePresence>
        {showRefundModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRefundModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }} className="relative bg-white dark:bg-card-dark w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-800">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
                <h3 className="font-black text-lg text-gray-900 dark:text-white flex items-center gap-2"><RotateCcw className="w-5 h-5 text-primary" /> Pengajuan Refund</h3>
                <button 
                  onClick={() => setShowRefundModal(false)} 
                  aria-label="Tutup"
                  title="Tutup"
                  className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-all text-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto space-y-5">
                <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 font-bold leading-relaxed flex items-start gap-3">
                  <Info className="w-5 h-5 shrink-0" />
                  Dana yang sudah dibayar akan diproses pengembaliannya secara manual oleh tim Kasir/Admin ke rekening tujuan di bawah.
                </p>
                <div>
                  <label className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Bank / Platform E-Wallet</label>
                  <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Contoh: BCA / DANA / OVO" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Nomor Rekening / Nomor HP</label>
                  <input type="text" value={accountNo} onChange={e => setAccountNo(e.target.value)} placeholder="Nomor akun/nomor HP yang terdaftar" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Atas Nama Pemilik Akun</label>
                  <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Nama lengkap pemilik rekening" className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Alasan Pembatalan</label>
                  <textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} rows={3} placeholder="Contoh: Menunggu terlalu lama karena pesanan tidak kunjung diproses atau alasan lainnya..." className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-medium text-text-light dark:text-text-dark" />
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                <button onClick={handleSubmitRefund} disabled={submittingRefund} className="w-full py-4 bg-primary hover:bg-primary-hover text-white font-black rounded-2xl shadow-xl shadow-primary/30 flex items-center justify-center gap-2 transition-all uppercase">
                  {submittingRefund ? <Loader2 className="w-5 h-5 animate-spin" /> : "Kirim Pengajuan Refund"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. REVIEW MODAL */}
      <AnimatePresence>
        {showReviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReviewModal(false)} className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, y: 50 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 50 }} className="relative bg-white dark:bg-card-dark w-full max-w-md rounded-3xl shadow-2xl overflow-hidden text-center border border-gray-200 dark:border-gray-800">
               <div className="p-10 bg-gradient-to-br from-orange-400 via-primary to-red-600 text-white flex flex-col items-center relative overflow-hidden">
                 <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent animate-pulse" />
                 <Star className="w-16 h-16 mb-4 fill-yellow-300 text-yellow-300 drop-shadow-[0_5px_15px_rgba(253,224,71,0.5)] relative z-10" />
                 <h3 className="text-3xl font-black uppercase tracking-tight relative z-10">Berikan Ulasan</h3>
                 <p className="text-white/90 text-sm mt-2 font-bold relative z-10">Kepuasan Anda adalah prioritas utama kami!</p>
               </div>
               <div className="p-8 space-y-6">
                 <div className="flex justify-center gap-3">
                   {[1, 2, 3, 4, 5].map(star => (
                     <button 
                       key={star} 
                       onClick={() => setReviewRating(star)} 
                       aria-label={`Beri Bintang ${star}`}
                       title={`Beri Bintang ${star}`}
                       className="transition-all hover:scale-125 transform active:scale-95"
                     >
                       <Star className={`w-12 h-12 ${reviewRating >= star ? "fill-yellow-400 text-yellow-400 drop-shadow-sm" : "text-gray-200 dark:text-gray-700 fill-gray-50 dark:fill-gray-800"}`} />
                     </button>
                   ))}
                 </div>
                 <div className="text-center">
                    <span className="px-4 py-1 bg-orange-50 dark:bg-orange-900/20 text-primary font-black text-sm rounded-full border border-orange-100 dark:border-orange-800 uppercase tracking-widest">
                        {reviewRating === 5 ? "Luar Biasa! ✨" : reviewRating === 4 ? "Sangat Enak! 👍" : reviewRating === 3 ? "Biasa Saja 😐" : reviewRating === 2 ? "Kurang Memuaskan 👎" : "Sangat Buruk 😤"}
                    </span>
                 </div>
                 <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={3} placeholder="Tulis pengalaman bersantap Anda di sini (Rasa, pelayanan, porsi, dll)..." className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl p-4 text-sm outline-none focus:border-primary text-left font-medium text-text-light dark:text-text-dark" />
                 <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowReviewModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">Nanti</button>
                    <button onClick={handleSendReview} disabled={submittingReview} className="flex-[2] py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/30 hover:bg-primary-hover transition-all">
                      {submittingReview ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Kirim Ulasan"}
                    </button>
                 </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. RECEIPT OVERLAY MODAL */}
      <AnimatePresence>
        {showReceipt && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowReceipt(false)} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="relative bg-white dark:bg-card-dark w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                   <h4 className="font-black text-xs uppercase tracking-widest text-gray-500">Pratinjau Kwitansi</h4>
                   <button 
                      onClick={() => setShowReceipt(false)} 
                      aria-label="Tutup Pratinjau"
                      title="Tutup"
                      className="p-2 text-muted hover:bg-gray-200 rounded-xl"
                    >
                      <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto bg-gray-100 p-4 flex justify-center items-start">
                   <Receipt ref={receiptRef} order={order} orderItems={orderItems.map(i=>({...i.menu_items, quantity: i.quantity, subtotal: i.subtotal}))} customerName={customerName || "Pelanggan"} />
                </div>
                <div className="p-4 border-t border-gray-100 bg-white">
                   <button onClick={handlePrint} className="w-full py-3 bg-blue-600 text-white font-black rounded-xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 hover:bg-blue-700"><Printer className="w-4 h-4" /> Cetak Sekarang</button>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
