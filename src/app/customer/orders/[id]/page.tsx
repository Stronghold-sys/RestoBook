"use client";

export const runtime = 'edge';

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle2, Clock, ChefHat, PackageCheck, AlertCircle, Printer, Banknote, CreditCard, Receipt as ReceiptIcon, XCircle, ShieldAlert, RotateCcw, Star, MessageSquare } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import Image from "next/image";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import Receipt from "@/components/Receipt";

export default function OrderTrackingPage() {
  const { id } = useParams();
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

      // Get customer name
      if (orderData.customer_id) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", orderData.customer_id).single();
        if (profile) setCustomerName(profile.full_name);
      }

      // Check if review exists
      const { data: revData } = await supabase.from("reviews").select("id").eq("order_id", id).maybeSingle();
      if (revData) setHasReviewed(true);
    } catch (e: any) {
      toast.error("Gagal memuat: " + e.message);
      router.push("/customer/orders");
    } finally { setLoading(false); }
  };

  const handleSendReview = async () => {
    if (reviewRating < 1 || reviewRating > 5) {
      return toast.error("Rating harus antara 1 sampai 5 bintang!");
    }
    setSubmittingReview(true);
    const rToast = toast.loading("Mengirim ulasan Anda...");
    try {
      let insertError;
      try {
        const { error } = await supabase.from("reviews").insert([
          {
            customer_id: order.customer_id,
            order_id: order.id,
            rating: reviewRating,
            comment: reviewComment,
            is_published: false
          }
        ]);
        insertError = error;
      } catch (err: any) {
        insertError = err;
      }

      // Fallback jika kolom is_published tidak ditemukan di skema database
      if (insertError && (insertError.message?.includes("is_published") || insertError.message?.includes("schema cache"))) {
        console.warn("Fallback insert tanpa kolom is_published...");
        const { error: fallbackError } = await supabase.from("reviews").insert([
          {
            customer_id: order.customer_id,
            order_id: order.id,
            rating: reviewRating,
            comment: reviewComment
          }
        ]);
        insertError = fallbackError;
      }

      if (insertError) throw insertError;
      
      toast.success("Terima kasih atas ulasan Anda!", { id: rToast });
      setHasReviewed(true);
      setShowReviewModal(false);
    } catch (e: any) {
      toast.error("Gagal mengirim ulasan: " + e.message, { id: rToast });
    } finally {
      setSubmittingReview(false);
    }
  };

  const getStatusText = (s: string) => {
    if (s === "pending" && order?.payment_method === "non_cash") return "Menunggu Verifikasi";
    const map: Record<string, string> = { pending: "Menunggu", confirmed: "Dikonfirmasi", processing: "Diproses", ready: "Siap", completed: "Selesai", cancelled: "Dibatalkan" };
    return map[s] || s;
  };

  const canCancel = order?.status === "pending";

  const handleCancelClick = () => {
    if (!canCancel) {
      toast.error("Pesanan sudah dikonfirmasi dan tidak dapat dibatalkan. Hubungi kasir untuk bantuan.", { duration: 4000 });
      return;
    }
    setShowCancelConfirm(true);
  };

  const handleCancelOrder = async () => {
    if (!canCancel) return;
    setCancelling(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, action: 'cancel', reason: 'Dibatalkan oleh pelanggan' }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal membatalkan pesanan');

      toast.success("Pesanan berhasil dibatalkan");
      setShowCancelConfirm(false);
      // Data will be updated automatically via Realtime subscription
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmitRefund = async () => {
    if (!bankName) return toast.error("Silakan pilih bank atau e-wallet");
    if (!accountNo) return toast.error("Silakan masukkan nomor rekening atau nomor HP");
    if (!accountName) return toast.error("Silakan masukkan nama pemilik rekening");
    if (!refundReason) return toast.error("Silakan masukkan alasan refund");

    setSubmittingRefund(true);
    try {
      const refundDetails = {
        bankName,
        accountNo,
        accountName,
        refundReason,
        refundStatus: "pending",
        adminNotes: "",
        submittedAt: new Date().toISOString()
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: id,
          action: 'submit_refund',
          refundDetails
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal mengirim pengajuan refund');

      // Update local state instantly
      setOrder((prev: any) => ({
        ...prev,
        cancel_reason: JSON.stringify(refundDetails)
      }));

      toast.success("Pengajuan refund berhasil dikirim ke admin!");
      setShowRefundModal(false);
    } catch (e: any) {
      toast.error("Gagal mengirim pengajuan refund: " + e.message);
    } finally {
      setSubmittingRefund(false);
    }
  };

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank", "width=450,height=700");
    if (!win) return;
    win.document.write(`<html><head><title>Kwitansi - RestoBook</title><style>body{margin:0;padding:20px;font-family:'Courier New',monospace;font-size:13px}*{box-sizing:border-box}.text-center{text-align:center}.font-bold{font-weight:bold}.font-extrabold{font-weight:800}.text-xs{font-size:11px}.text-sm{font-size:12px}.text-base{font-size:14px}.text-2xl{font-size:22px}.mb-2{margin-bottom:8px}.mb-4{margin-bottom:16px}.mb-6{margin-bottom:24px}.mt-1{margin-top:4px}.mt-2{margin-top:8px}.mt-3{margin-top:12px}.pt-2{padding-top:8px}.pt-4{padding-top:16px}.pb-4{padding-bottom:16px}.pb-6{padding-bottom:24px}.p-8{padding:20px}.space-y-1>*+*{margin-top:4px}.border-dashed{border-style:dashed}.border-b{border-bottom:1px dashed #ccc}.border-t{border-top:1px dashed #ccc}.flex{display:flex}.justify-between{justify-content:space-between}.items-center{align-items:center}.gap-2{gap:8px}.uppercase{text-transform:uppercase}.tracking-wider{letter-spacing:2px}.text-gray-400{color:#999}.text-gray-500{color:#777}.text-gray-600{color:#555}.text-green-700{color:#15803d}.text-red-700{color:#b91c1c}.bg-green-100{background:#dcfce7;padding:4px 12px;border-radius:12px;border:1px solid #86efac}.bg-red-100{background:#fee2e2;padding:4px 12px;border-radius:12px;border:1px solid #fca5a5}@media print{body{padding:10px}}</style></head><body>`);
    win.document.write(printContent.innerHTML);
    win.document.write("</body></html>");
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!order) return null;

  const steps = [
    { id: "pending", label: "Menunggu", icon: Clock },
    { id: "confirmed", label: "Dikonfirmasi", icon: CheckCircle2 },
    { id: "processing", label: "Dimasak", icon: ChefHat },
    { id: "ready", label: "Siap", icon: PackageCheck },
    { id: "completed", label: "Selesai", icon: CheckCircle2 },
  ];
  const currentIdx = steps.findIndex(s => s.id === order.status);
  const isCancelled = order.status === "cancelled";
  const isPaid = order.payment_status === "paid";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/customer/orders" className="inline-flex items-center gap-2 text-muted hover:text-primary transition-colors">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </Link>

      {/* Header + Tracking */}
      <div className="bg-card-light dark:bg-card-dark rounded-2xl p-6 md:p-8 shadow-sm border border-border-light dark:border-border-dark">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-text-light dark:text-text-dark">Pesanan #{order.id.split("-")[0]}</h1>
            <p className="text-muted mt-1">{format(new Date(order.created_at), "dd MMMM yyyy, HH:mm", { locale: localeId })}</p>
          </div>
          <div className="flex gap-3 items-center">
            <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${order.order_type === "dine_in" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
              {order.order_type === "dine_in" ? `Dine In - Meja ${order.tables?.table_number}` : "Takeaway"}
            </span>
            <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-bold ${order.payment_method === "cash" ? "bg-amber-100 text-amber-700" : "bg-cyan-100 text-cyan-700"}`}>
              {order.payment_method === "cash" ? <><Banknote className="w-3 h-3" /> Tunai</> : <><CreditCard className="w-3 h-3" /> Non-Tunai</>}
            </span>
          </div>
        </div>

        {isCancelled ? (
          <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-200 dark:border-red-900/50 flex flex-col items-center text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
            <h3 className="text-xl font-bold text-red-700 dark:text-red-400">Pesanan Dibatalkan</h3>
            
            {!refundData ? (
              <>
                <p className="text-red-600/80 mt-1 mb-4">{order.cancel_reason || "Dibatalkan oleh sistem/kasir"}</p>
                {order.payment_method === "non_cash" && (
                  <button onClick={() => setShowRefundModal(true)} className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all">
                    <RotateCcw className="w-4 h-4" /> Ajukan Pengembalian Dana (Refund)
                  </button>
                )}
              </>
            ) : (
              <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark text-left w-full max-w-lg space-y-3 shadow-sm">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-bold text-xs uppercase tracking-wider text-muted">Status Refund:</span>
                  <span className={`text-xs font-black px-2.5 py-1 rounded-full uppercase ${
                    refundData.refundStatus === "pending" ? "bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse" :
                    refundData.refundStatus === "approved" ? "bg-green-100 text-green-700 border border-green-200" :
                    "bg-red-100 text-red-700 border border-red-200"
                  }`}>
                    {refundData.refundStatus === "pending" ? "Menunggu" :
                     refundData.refundStatus === "approved" ? "Disetujui" : "Ditolak"}
                  </span>
                </div>
                
                <div className="text-xs text-text-light dark:text-text-dark space-y-1.5 font-semibold">
                  <p><span className="text-muted">Bank/E-Wallet:</span> {refundData.bankName}</p>
                  <p><span className="text-muted">No. Rekening/HP:</span> {refundData.accountNo}</p>
                  <p><span className="text-muted">Atas Nama:</span> {refundData.accountName}</p>
                  <p><span className="text-muted">Alasan Refund:</span> {refundData.refundReason}</p>
                  {refundData.adminNotes && (
                    <p className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800 text-[11px]"><span className="font-bold text-primary">Catatan Admin:</span> {refundData.adminNotes}</p>
                  )}
                </div>

                {refundData.refundStatus === "pending" && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2.5 rounded border border-amber-200 dark:border-amber-900 leading-relaxed font-bold mt-2">
                    Menunggu Konfirmasi Pencairan. Pengajuan refund Anda sedang diverifikasi oleh Admin. Pencairan refund akan diproses dalam waktu 2x24 jam (hari kerja), namun biasanya bisa lebih cepat tergantung antrean mutasi. Mohon periksa rekening Anda secara berkala.
                  </p>
                )}
                {refundData.refundStatus === "approved" && (
                  <>
                    <p className="text-[11px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 p-2.5 rounded border border-green-200 dark:border-green-900 leading-relaxed font-bold mt-2">
                      Refund Disetujui! Admin telah mentransfer kembali dana Anda ke rekening yang tertera di atas. Silakan periksa mutasi rekening Anda. Terima kasih!
                    </p>
                    {refundData.proofUrl && (
                      <div className="mt-2.5 p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-border-light dark:border-border-dark space-y-1.5">
                        <span className="font-bold text-[10px] uppercase tracking-wider text-muted block">Bukti Transfer Refund:</span>
                        <a href={refundData.proofUrl} target="_blank" rel="noreferrer" className="block relative rounded-lg overflow-hidden border border-border-light dark:border-border-dark group">
                          <img src={refundData.proofUrl} alt="Bukti Transfer Refund" className="object-cover w-full h-32 rounded-lg group-hover:scale-105 transition-all" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                            <span className="text-white text-[10px] font-black uppercase tracking-wider">Klik Untuk Memperbesar</span>
                          </div>
                        </a>
                      </div>
                    )}
                  </>
                )}
                {refundData.refundStatus === "rejected" && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-2.5 rounded border border-red-200 dark:border-red-900 leading-relaxed font-bold mt-2">
                    Refund Ditolak oleh Admin. Silakan hubungi Customer Service kami untuk bantuan lebih lanjut.
                  </p>
                )}
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
                    <motion.div animate={{ scale: current ? 1.2 : 1, backgroundColor: done ? "#e85d04" : "var(--card-color)" }} className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${done ? "border-primary text-white" : "border-gray-300 dark:border-gray-600 text-gray-400 bg-card-light dark:bg-card-dark"}`}>
                      <Icon className="w-5 h-5" />
                    </motion.div>
                    <span className={`text-xs font-medium absolute top-12 w-24 text-center ${current ? "text-primary" : done ? "text-text-light dark:text-text-dark" : "text-muted"}`}>{step.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-card-light dark:bg-card-dark rounded-2xl p-6 md:p-8 shadow-sm border border-border-light dark:border-border-dark mt-8 pt-12 md:pt-8">
        <h2 className="text-xl font-bold text-text-light dark:text-text-dark mb-6 border-b border-border-light dark:border-border-dark pb-4">Daftar Item</h2>
        <div className="space-y-4">
          {orderItems.map(item => (
            <div key={item.id} className="flex gap-4 items-center">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-gray-100 dark:bg-gray-800">
                <Image src={item.menu_items?.image_url || "https://placehold.co/100"} alt={item.menu_items?.name} fill className="object-cover" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-text-light dark:text-text-dark">{item.menu_items?.name}</h4>
                <p className="text-sm text-muted">{item.quantity} x Rp {Number(item.price).toLocaleString("id-ID")}</p>
              </div>
              <div className="font-bold text-text-light dark:text-text-dark">Rp {Number(item.subtotal).toLocaleString("id-ID")}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-border-light dark:border-border-dark">
          <div className="space-y-3 max-w-sm ml-auto">
            <div className="flex justify-between text-muted"><span>Subtotal</span><span>Rp {Number(order.total_amount).toLocaleString("id-ID")}</span></div>
            <div className="flex justify-between text-muted"><span>Pajak & Layanan</span><span>Termasuk</span></div>
            <div className="flex justify-between items-center pt-3 border-t border-border-light dark:border-border-dark">
              <span className="font-bold text-text-light dark:text-text-dark">Total</span>
              <span className="text-2xl font-black text-primary">Rp {Number(order.total_amount).toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between items-center pt-3">
              <span className="text-sm text-muted">Status Pembayaran</span>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-lg uppercase ${isPaid ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-500"}`}>
                {isPaid ? "Lunas" : "Belum Bayar"}
              </span>
            </div>
            {!isPaid && order.payment_method === "cash" && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800 mt-2">
                Silakan lakukan pembayaran di kasir. Kwitansi akan muncul setelah pembayaran dikonfirmasi.
              </motion.p>
            )}
            {!isPaid && order.payment_method === "non_cash" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 space-y-2">
                <p className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-2 font-medium">
                  <Clock className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
                  <span>Pembayaran sedang diverifikasi oleh kasir dan pesanan akan segera diproses setelah pembayaran terkonfirmasi.</span>
                </p>
                {(() => {
                  const createdAt = new Date(order.created_at).getTime();
                  const now = new Date().getTime();
                  const elapsedMinutes = (now - createdAt) / (1000 * 60);
                  if (elapsedMinutes >= 5) {
                    return (
                      <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800 flex items-center gap-2 font-bold animate-pulse">
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                        <span>Pembayaran belum terkonfirmasi oleh kasir. Silakan hubungi kasir secara langsung untuk konfirmasi pembayaran.</span>
                      </p>
                    );
                  }
                  return null;
                })()}
              </motion.div>
            )}
          </div>
        </div>

        {/* Receipt Button - only if paid */}
        {isPaid && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 pt-6 border-t border-border-light dark:border-border-dark">
            <div className="flex flex-col sm:flex-row gap-3">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowReceipt(true)} className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                <ReceiptIcon className="w-5 h-5" /> Lihat Kwitansi
              </motion.button>
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setShowReceipt(true); setTimeout(handlePrint, 300); }} className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
                <Printer className="w-5 h-5" /> Cetak Kwitansi
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Cancel Order Button */}
        {!isCancelled && order.status !== "completed" && (
          <div className="mt-8 pt-6 border-t border-border-light dark:border-border-dark">
            <motion.button
              whileTap={canCancel ? { scale: 0.98 } : {}}
              onClick={handleCancelClick}
              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                canCancel
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 cursor-pointer"
                  : "bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
              }`}
            >
              <XCircle className="w-5 h-5" /> Batalkan Pesanan
              {!canCancel && <ShieldAlert className="w-4 h-4 ml-1" />}
            </motion.button>
            {!canCancel && (
              <p className="text-xs text-center text-muted mt-2 flex items-center justify-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Pesanan sudah dikonfirmasi dan tidak dapat dibatalkan
              </p>
            )}
          </div>
        )}

        {order.status === "completed" && (
          <div className="mt-8 pt-6 border-t border-border-light dark:border-border-dark text-center">
            <h3 className="text-lg font-bold text-text-light dark:text-text-dark mb-2">Bagaimana pesanan Anda?</h3>
            <p className="text-muted text-sm mb-4">Bantu kami menjadi lebih baik.</p>
            {hasReviewed ? (
              <span className="inline-block bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 px-6 py-2.5 rounded-xl font-bold text-sm">
                Ulasan Telah Dikirim
              </span>
            ) : (
              <button 
                onClick={() => setShowReviewModal(true)} 
                className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-hover transition-all shadow-lg shadow-primary/20"
              >
                Beri Ulasan
              </button>
            )}
          </div>
        )}
      </div>

      {/* Receipt Modal */}
      <AnimatePresence>
        {showReceipt && isPaid && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowReceipt(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-[420px] w-full my-8">
              <div className="p-4 bg-gray-50 flex justify-between items-center border-b">
                <h3 className="font-bold text-gray-800">Kwitansi Pembayaran</h3>
                <button onClick={handlePrint} className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"><Printer className="w-4 h-4" /> Cetak</button>
              </div>
              <Receipt ref={receiptRef} order={order} orderItems={orderItems} customerName={customerName} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCancelConfirm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card-light dark:bg-card-dark rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-text-light dark:text-text-dark mb-2">Batalkan Pesanan?</h3>
                <p className="text-muted text-sm mb-6">Apakah Anda yakin ingin membatalkan pesanan ini? Tindakan ini tidak dapat dibatalkan.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowCancelConfirm(false)} className="flex-1 py-3 border border-border-light dark:border-border-dark rounded-xl font-medium text-text-light dark:text-text-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Tidak, Kembali</button>
                  <motion.button whileTap={{ scale: 0.98 }} onClick={handleCancelOrder} disabled={cancelling} className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 flex items-center justify-center gap-2 shadow-lg shadow-red-500/20">
                    {cancelling ? <Loader2 className="w-5 h-5 animate-spin" /> : <><XCircle className="w-5 h-5" /> Ya, Batalkan</>}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refund Modal */}
      <AnimatePresence>
        {showRefundModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowRefundModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card-light dark:bg-card-dark rounded-3xl w-full max-w-md shadow-2xl overflow-hidden p-6 md:p-8">
              <div className="flex items-center gap-4 mb-6 border-b pb-4 border-border-light dark:border-border-dark">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary"><RotateCcw className="w-6 h-6" /></div>
                <div>
                  <h3 className="font-black text-xl text-text-light dark:text-text-dark">Ajukan Refund</h3>
                  <p className="text-sm text-muted">Lengkapi data pengembalian dana</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black uppercase text-muted mb-2 ml-1">Bank / E-Wallet Tujuan</label>
                  <select title="Pilih Bank atau E-Wallet" value={bankName} onChange={e => setBankName(e.target.value)} className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-primary/20 text-text-light dark:text-text-dark font-bold text-sm">
                    <option value="">Pilih Bank / E-Wallet</option>
                    <option value="BCA">BCA</option>
                    <option value="Mandiri">Mandiri</option>
                    <option value="BRI">BRI</option>
                    <option value="BNI">BNI</option>
                    <option value="GoPay">GoPay</option>
                    <option value="OVO">OVO</option>
                    <option value="Dana">Dana</option>
                    <option value="ShopeePay">ShopeePay</option>
                    <option value="LinkAja">LinkAja</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-muted mb-2 ml-1">Nomor Rekening / No. HP</label>
                  <input type="text" value={accountNo} onChange={e => setAccountNo(e.target.value)} placeholder="Contoh: 8691234567 atau 0812..." className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-primary/20 text-text-light dark:text-text-dark font-bold text-sm" />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-muted mb-2 ml-1">Atas Nama (Pemilik Rekening)</label>
                  <input type="text" value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Masukkan nama pemilik rekening" className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-primary/20 text-text-light dark:text-text-dark font-bold text-sm" />
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-muted mb-2 ml-1">Alasan Pengajuan Refund</label>
                  <textarea value={refundReason} onChange={e => setRefundReason(e.target.value)} rows={3} placeholder="Contoh: Salah pesan menu, tidak jadi datang, dll..." className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-primary/20 text-text-light dark:text-text-dark font-medium text-sm" />
                </div>

                <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
                  <button onClick={() => setShowRefundModal(false)} className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-muted font-black rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all uppercase text-xs">Batal</button>
                  <button onClick={handleSubmitRefund} disabled={submittingRefund} className="flex-[2] py-3.5 bg-primary text-white font-black rounded-xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 uppercase text-xs flex items-center justify-center gap-2">
                    {submittingRefund ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kirim Pengajuan"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        {showReviewModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowReviewModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card-light dark:bg-card-dark w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6 space-y-6 border border-border-light dark:border-border-dark">
              <div className="flex justify-between items-center pb-4 border-b border-border-light dark:border-border-dark">
                <h3 className="font-bold text-xl text-text-light dark:text-text-dark flex items-center gap-2"><MessageSquare className="w-5 h-5 text-primary" /> Beri Ulasan</h3>
                <button onClick={() => setShowReviewModal(false)} className="text-muted hover:text-text-light dark:hover:text-text-dark font-medium text-sm">Tutup</button>
              </div>

              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted">Ketuk bintang untuk memberikan penilaian Anda:</p>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button 
                        key={star} 
                        onClick={() => setReviewRating(star)} 
                        title={`Bintang ${star}`}
                        aria-label={`Beri rating ${star} bintang`}
                        className="focus:outline-none transition-transform hover:scale-110"
                      >
                        <Star className={`w-8 h-8 ${star <= reviewRating ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase text-muted mb-2 ml-1">Komentar / Masukan Anda</label>
                  <textarea 
                    value={reviewComment} 
                    onChange={e => setReviewComment(e.target.value)} 
                    rows={4} 
                    placeholder="Tulis ulasan Anda di sini... Makanan enak, pelayanan cepat!" 
                    className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-primary/20 text-text-light dark:text-text-dark font-medium text-sm" 
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
                  <button onClick={() => setShowReviewModal(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-muted font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-sm">Batal</button>
                  <button onClick={handleSendReview} disabled={submittingReview} className="flex-[2] py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 text-sm flex items-center justify-center gap-2">
                    {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kirim Ulasan"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
