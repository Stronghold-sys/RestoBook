"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Loader2, AlertCircle, RotateCcw, CheckCircle, XCircle, Search, ArrowLeft, CreditCard, Upload, Wallet, Clock, FileSpreadsheet } from "lucide-react";
import toast from "react-hot-toast";
import { format, subDays, subMonths, startOfDay, isAfter, isSameDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import BaseModal from "@/components/BaseModal";
import dynamic from 'next/dynamic';

const LazyRefundPieChart = dynamic(
  () => import('@/components/charts/RefundsCharts').then(mod => mod.RefundPieChart),
  { ssr: false, loading: () => <div className="h-64 w-full bg-gray-100 dark:bg-gray-800 animate-pulse rounded-2xl" /> }
);

const LazyRefundBarChart = dynamic(
  () => import('@/components/charts/RefundsCharts').then(mod => mod.RefundBarChart),
  { ssr: false, loading: () => <div className="h-64 w-full bg-gray-100 dark:bg-gray-800 animate-pulse rounded-2xl" /> }
);

export default function AdminRefundsPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"all" | "today" | "week" | "month">("all");
  const [activeTab, setActiveTab] = useState<"list" | "analytics">("list");
  
  // Action Modals State
  const [selectedRefund, setSelectedRefund] = useState<any>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchRefundRequests();

    const channel = supabase.channel("admin-refunds-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchRefundRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRefund && actionType) {
      const isWallet = selectedRefund.refundDetails.refundMethod === "wallet" || selectedRefund.payment_method === "duitku" || selectedRefund.payment_method === "non_cash" || selectedRefund.payment_method === "wallet";
      const nominal = Number(selectedRefund.total_amount).toLocaleString("id-ID");
      const hasVoucher = !!selectedRefund.voucher_id;
      const isFree = Number(selectedRefund.total_amount) === 0;

      if (actionType === "approve") {
        if (isFree && hasVoucher) {
          setAdminNotes(`Halo, pengajuan pembatalan pesanan gratis Anda telah disetujui. Voucher belanja Anda telah kami kembalikan dan dapat Anda gunakan kembali. Terima kasih!`);
        } else if (isWallet) {
          if (hasVoucher) {
            setAdminNotes(`Halo, dana pengembalian sebesar Rp ${nominal} telah berhasil kami cairkan otomatis ke Saldo Dompet Anda. Voucher belanja Anda juga telah dikembalikan agar dapat digunakan lagi. Silakan cek saldo Anda kembali. Terima kasih!`);
          } else {
            setAdminNotes(`Halo, dana pengembalian sebesar Rp ${nominal} telah berhasil kami cairkan secara otomatis ke Saldo Dompet Anda. Silakan cek saldo Anda kembali. Terima kasih!`);
          }
        } else {
          setAdminNotes(`Halo, dana sebesar Rp ${nominal} telah berhasil kami transfer balik ke rekening ${selectedRefund.refundDetails.bankName} Anda atas nama ${selectedRefund.refundDetails.accountName}. Terima kasih atas kesabaran Anda!`);
        }
      } else {
        if (isWallet) {
          setAdminNotes("Halo, pengajuan refund Anda belum dapat kami setujui karena alasan kebijakan internal kami. Silakan hubungi layanan pelanggan kami untuk informasi lebih lanjut.");
        } else {
          setAdminNotes("Halo, pengajuan refund Anda belum dapat kami setujui karena nomor rekening atau data bank yang diisikan tidak cocok/valid. Silakan ajukan kembali dengan data rekening yang benar atau hubungi layanan pelanggan kami.");
        }
      }
    } else {
      setAdminNotes("");
    }
  }, [selectedRefund, actionType]);

  const fetchRefundRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*, profiles!orders_customer_id_fkey(full_name, phone)")
        .eq("status", "cancelled")
        .neq("payment_method", "cash") // Menampilkan semua pesanan non-tunai (termasuk non_cash dan duitku)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Filter and parse refund JSON
      const parsedRefunds = (data || []).map(order => {
        try {
          const parsed = JSON.parse(order.cancel_reason);
          if (parsed && typeof parsed === "object" && "refundStatus" in parsed) {
            return { ...order, refundDetails: parsed };
          }
        } catch {
          // ignore parsing error
        }
        return null;
      }).filter(Boolean);

      setOrders(parsedRefunds);
    } catch (e: any) {
      toast.error("Gagal mengambil data refund: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("isProfile", "false");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal mengunggah gambar");

      setProofUrl(result.url);
      toast.success("Bukti transfer refund berhasil diunggah!");
    } catch (e: any) {
      toast.error("Gagal mengunggah berkas: " + e.message);
    } finally {
      setUploadingProof(false);
    }
  };

  const handleProcessRefund = async () => {
    if (!selectedRefund || !actionType) return;
    setProcessing(true);
    try {
      const updatedDetails = {
        ...selectedRefund.refundDetails,
        refundStatus: actionType === "approve" ? "approved" : "rejected",
        adminNotes: adminNotes,
        proofUrl: actionType === "approve" ? proofUrl : "",
        processedAt: new Date().toISOString()
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedRefund.id,
          action: 'process_refund',
          refundDetails: updatedDetails
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal memproses refund');

      // Update local state instantly
      setOrders(prev => prev.map(o => o.id === selectedRefund.id ? { ...o, refundDetails: updatedDetails } : o));

      toast.success(actionType === "approve" ? "Refund berhasil disetujui!" : "Refund berhasil ditolak.");
      setSelectedRefund(null);
      setActionType(null);
      setAdminNotes("");
      setProofUrl("");
    } catch (e: any) {
      toast.error("Gagal memproses refund: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredOrders.length === 0) return toast.error("Tidak ada data untuk diekspor");
    
    const periodTitle = (periodFilter === 'all' ? 'Semua Waktu' : periodFilter === 'today' ? 'Hari Ini' : periodFilter === 'week' ? '7 Hari Terakhir' : '1 Bulan Terakhir').toUpperCase();
    
    let tableHtml = `<table border="1" style="border-collapse: collapse; font-family: Arial;">
       <tr style="height: 40px;"><td colspan="7" align="center" style="font-size: 16px; font-weight: bold; background-color: #fcfcfc;">LAPORAN PENGELOLAAN REFUND (PERIODE: ${periodTitle})</td></tr>
       <tr style="height: 25px;"><td colspan="7" align="left" style="font-size: 11px;">Dicetak oleh: Admin | Tanggal: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeId })} WIB</td></tr>
       <tr style="height: 30px; text-align: center;">
          <th class="th-header" style="border: 1px solid #cbd5e1; padding: 5px;">No. Pesanan</th>
          <th class="th-header" style="border: 1px solid #cbd5e1; padding: 5px;">Nama Pelanggan</th>
          <th class="th-header" style="border: 1px solid #cbd5e1; padding: 5px;">Jenis Pembayaran</th>
          <th class="th-header" style="border: 1px solid #cbd5e1; padding: 5px;">Metode Refund</th>
          <th class="th-header" style="border: 1px solid #cbd5e1; padding: 5px;">Alasan Refund</th>
          <th class="th-header" style="border: 1px solid #cbd5e1; padding: 5px;">Status</th>
          <th class="th-header" style="border: 1px solid #cbd5e1; padding: 5px;">Nominal Refund (Rp)</th>
       </tr>`;

    filteredOrders.forEach(o => {
       const details = o.refundDetails;
       const paymentText = o.payment_method === 'wallet' ? 'Saldo Dompet' : 'Pembayaran Online';
       const methodText = details.refundMethod === 'wallet' ? 'Saldo Dompet' : `Transfer ${details.bankName || ''}`;
       const statusText = details.refundStatus === 'pending' ? 'Menunggu' : details.refundStatus === 'approved' ? 'Disetujui' : 'Ditolak';
       
       tableHtml += `<tr style="height: 25px;">
          <td align="center" style="border: 1px solid #cbd5e1; padding: 5px; font-family: monospace;">#${o.id.split("-")[0]}</td>
          <td style="border: 1px solid #cbd5e1; padding: 5px;">${o.profiles?.full_name || "Guest"}</td>
          <td align="center" style="border: 1px solid #cbd5e1; padding: 5px;">${paymentText}</td>
          <td align="center" style="border: 1px solid #cbd5e1; padding: 5px;">${methodText}</td>
          <td style="border: 1px solid #cbd5e1; padding: 5px;">${details.refundReason || "-"}</td>
          <td align="center" style="border: 1px solid #cbd5e1; padding: 5px; font-weight: bold; color: ${details.refundStatus === 'approved' ? '#16a34a' : details.refundStatus === 'pending' ? '#d97706' : '#dc2626'}">${statusText}</td>
          <td align="right" style="border: 1px solid #cbd5e1; padding: 5px; font-weight: bold;">${Number(o.total_amount).toLocaleString("id-ID")}</td>
       </tr>`;
    });

    const approvedSum = filteredOrders.filter(o => o.refundDetails?.refundStatus === "approved").reduce((sum, o) => sum + Number(o.total_amount), 0);
    const pendingSum = filteredOrders.filter(o => o.refundDetails?.refundStatus === "pending").reduce((sum, o) => sum + Number(o.total_amount), 0);
    
    tableHtml += `<tr style="font-weight: bold; height: 25px;">
       <td colspan="6" align="center" class="total-bg" style="border: 1px solid #cbd5e1; padding: 5px;">TOTAL REFUND DISETUJUI</td>
       <td align="right" class="total-bg" style="border: 1px solid #cbd5e1; padding: 5px; font-weight: bold; color: #16a34a;">${approvedSum.toLocaleString("id-ID")}</td>
    </tr>`;
    tableHtml += `<tr style="font-weight: bold; height: 25px;">
       <td colspan="6" align="center" class="total-bg" style="border: 1px solid #cbd5e1; padding: 5px;">TOTAL REFUND MENUNGGU</td>
       <td align="right" class="total-bg" style="border: 1px solid #cbd5e1; padding: 5px; font-weight: bold; color: #d97706;">${pendingSum.toLocaleString("id-ID")}</td>
    </tr>`;

    tableHtml += `</table>`;

    const template = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>.th-header { background-color: #e85d04; color: #ffffff; font-weight: bold; } .total-bg { background-color: #f1f5f9; }</style><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Refunds</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${tableHtml}</body></html>`;

    const blob = new Blob([template], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Laporan_Refund_${format(new Date(), 'dd_MM_yyyy_HHmmss')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Berhasil mengekspor Laporan Refund!");
  };

  const filteredOrders = orders.filter(o => {
    const statusMatch = filter === "all" || o.refundDetails.refundStatus === filter;
    
    // Period filter logic
    if (periodFilter !== "all") {
      const orderDate = new Date(o.updated_at || o.created_at);
      const today = startOfDay(new Date());
      if (periodFilter === "today" && !isAfter(orderDate, today) && !isSameDay(orderDate, today)) return false;
      if (periodFilter === "week" && !isAfter(orderDate, subDays(today, 7))) return false;
      if (periodFilter === "month" && !isAfter(orderDate, subMonths(today, 1))) return false;
    }

    const custName = o.profiles?.full_name?.toLowerCase() || "guest";
    const bank = o.refundDetails.bankName?.toLowerCase() || "";
    const orderId = o.id.split("-")[0].toLowerCase();
    
    // Payment and refund methods searchable strings
    const paymentMethodText = o.payment_method === 'wallet' ? 'saldo dompet dompetku' : 'pembayaran online non-cash';
    const refundMethodText = o.refundDetails.refundMethod === 'wallet' ? 'saldo dompet dompetku' : `transfer bank ${o.refundDetails.bankName || ''}`;

    const searchMatch = custName.includes(searchQuery.toLowerCase()) || 
                        bank.includes(searchQuery.toLowerCase()) || 
                        orderId.includes(searchQuery.toLowerCase()) ||
                        paymentMethodText.includes(searchQuery.toLowerCase()) ||
                        refundMethodText.toLowerCase().includes(searchQuery.toLowerCase());

    return statusMatch && searchMatch;
  });

  // Real-time calculated stats
  const totalApprovedRefund = orders
    .filter(o => o.refundDetails?.refundStatus === "approved")
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const totalPendingRefund = orders
    .filter(o => o.refundDetails?.refundStatus === "pending")
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  // Group by customer for summary
  const customerStats = orders.reduce((acc, o) => {
    const name = o.profiles?.full_name || "Walk-In Customer";
    const isApproved = o.refundDetails?.refundStatus === "approved";
    const amount = Number(o.total_amount || 0);
    
    if (!acc[name]) {
      acc[name] = { approved: 0, pending: 0, total: 0 };
    }
    if (isApproved) {
      acc[name].approved += amount;
    } else if (o.refundDetails?.refundStatus === "pending") {
      acc[name].pending += amount;
    }
    acc[name].total += amount;
    return acc;
  }, {} as Record<string, { approved: number; pending: number; total: number }>);

  // Group by method for summary
  const methodStats = orders.reduce((acc, o) => {
    const isApproved = o.refundDetails?.refundStatus === "approved";
    const amount = Number(o.total_amount || 0);
    const method = o.refundDetails?.refundMethod === "wallet" ? "Saldo Dompet" : "Transfer Bank / Online";
    
    if (!acc[method]) {
      acc[method] = { approved: 0, pending: 0 };
    }
    if (isApproved) {
      acc[method].approved += amount;
    } else if (o.refundDetails?.refundStatus === "pending") {
      acc[method].pending += amount;
    }
    return acc;
  }, {} as Record<string, { approved: number; pending: number }>);

  // Data for Recharts Pie Chart (Status count)
  const approvedCount = orders.filter(o => o.refundDetails.refundStatus === "approved").length;
  const pendingCount = orders.filter(o => o.refundDetails.refundStatus === "pending").length;
  const rejectedCount = orders.filter(o => o.refundDetails.refundStatus === "rejected").length;

  const pieData = [
    { name: "Disetujui", value: approvedCount, color: "#10b981" },
    { name: "Menunggu", value: pendingCount, color: "#f59e0b" },
    { name: "Ditolak", value: rejectedCount, color: "#ef4444" }
  ].filter(d => d.value > 0);

  // Data for Recharts Bar Chart (Nominal per method)
  const barData = Object.keys(methodStats).map(method => {
    const stat = methodStats[method];
    return {
      name: method,
      "Disetujui": stat.approved,
      "Menunggu": stat.pending
    };
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button onClick={() => window.history.back()} className="flex items-center gap-2 text-sm font-bold text-muted hover:text-primary transition-all">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Sebelumnya
      </button>

      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-text-light dark:text-text-dark flex items-center gap-2">
            <RotateCcw className="w-7 h-7 text-primary" /> Kelola Pengajuan Refund
          </h1>
          <p className="text-sm text-muted">Daftar pengajuan pengembalian dana transaksi cashless pelanggan</p>
        </div>
      </div>

      {/* Stats Counter */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { key: "all", label: "Total Pengajuan", color: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800", count: orders.length },
          { key: "pending", label: "Menunggu", color: "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 border-yellow-100 dark:border-yellow-800 animate-pulse", count: orders.filter(o => o.refundDetails.refundStatus === "pending").length },
          { key: "approved", label: "Disetujui", color: "bg-green-50 text-green-700 dark:bg-green-900/20 border-green-100 dark:border-green-800", count: orders.filter(o => o.refundDetails.refundStatus === "approved").length },
          { key: "rejected", label: "Ditolak", color: "bg-red-50 text-red-700 dark:bg-red-900/20 border-red-100 dark:border-red-800", count: orders.filter(o => o.refundDetails.refundStatus === "rejected").length },
        ].map(stat => (
          <button key={stat.key} onClick={() => setFilter(stat.key as any)} className={`p-4 rounded-2xl border text-left transition-all ${filter === stat.key ? "ring-2 ring-primary bg-card-light dark:bg-card-dark font-black shadow-md" : "bg-card-light dark:bg-card-dark hover:shadow-md"}`}>
            <p className="text-xs text-muted font-bold uppercase tracking-wider">{stat.label}</p>
            <p className="text-3xl font-black mt-2 flex items-center justify-between">
              <span>{stat.count}</span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-black ${stat.color}`}>{stat.label}</span>
            </p>
          </button>
        ))}
      </div>

      {/* Financial Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-xs text-muted font-bold uppercase tracking-wider">Total Saldo Telah Di-Refund</p>
            <p className="text-3xl font-black mt-2 text-emerald-600 dark:text-emerald-400">
              Rp {totalApprovedRefund.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-muted font-semibold mt-1">{"Akumulasi saldo terbayar dari pengajuan berstatus 'Disetujui'"}</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center shadow-inner">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-amber-100 dark:border-amber-900/40 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <p className="text-xs text-muted font-bold uppercase tracking-wider">Total Saldo Belum Di-Refund</p>
            <p className="text-3xl font-black mt-2 text-amber-600 dark:text-amber-400">
              Rp {totalPendingRefund.toLocaleString("id-ID")}
            </p>
            <p className="text-[10px] text-muted font-semibold mt-1">{"Akumulasi saldo tertunda dari pengajuan berstatus 'Menunggu'"}</p>
          </div>
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center shadow-inner animate-pulse">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter, Search and Export Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-card-light dark:bg-card-dark p-4 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 text-muted absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            placeholder="Cari nama pelanggan, ID pesanan, bank atau e-wallet..." 
            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl pl-12 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 text-sm font-semibold text-text-light dark:text-text-dark" 
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select 
            value={periodFilter} 
            onChange={e => setPeriodFilter(e.target.value as any)} 
            className="bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-3 py-3 outline-none text-xs font-bold text-text-light dark:text-text-dark w-full md:w-auto"
            title="Filter Periode Refund"
            aria-label="Filter Periode Refund"
          >
            <option value="all">Semua Periode</option>
            <option value="today">Hari Ini</option>
            <option value="week">Minggu Ini (7 Hari)</option>
            <option value="month">Bulan Ini (30 Hari)</option>
          </select>

          <button 
            onClick={handleExportExcel} 
            className="flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-xl text-xs font-black uppercase transition-all shadow-md shadow-emerald-500/10 w-full md:w-auto whitespace-nowrap"
            title="Ekspor Laporan Excel"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-border-light dark:border-border-dark gap-6">
        <button 
          onClick={() => setActiveTab("list")} 
          className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "list" 
              ? "border-primary text-primary" 
              : "border-transparent text-muted hover:text-text-light dark:hover:text-text-dark"
          }`}
        >
          Daftar Pengajuan ({filteredOrders.length})
        </button>
        <button 
          onClick={() => setActiveTab("analytics")} 
          className={`pb-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "analytics" 
              ? "border-primary text-primary" 
              : "border-transparent text-muted hover:text-text-light dark:hover:text-text-dark"
          }`}
        >
          Analisis & Statistik
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : activeTab === "list" ? (
        filteredOrders.length === 0 ? (
          <div className="bg-card-light dark:bg-card-dark rounded-2xl p-12 text-center border border-dashed border-border-light dark:border-border-dark flex flex-col items-center justify-center">
            <AlertCircle className="w-12 h-12 text-muted mb-4" />
            <h3 className="text-lg font-bold text-text-light dark:text-text-dark">Tidak ada pengajuan refund</h3>
            <p className="text-sm text-muted mt-1">Belum ada pengajuan refund baru dalam status filter ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredOrders.map(order => {
              const details = order.refundDetails;
              const isPending = details.refundStatus === "pending";
              return (
                <motion.div layout key={order.id} className="bg-card-light dark:bg-card-dark rounded-2xl p-6 border border-border-light dark:border-border-dark shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start border-b pb-3 border-border-light dark:border-border-dark">
                      <div>
                        <span className="text-[10px] uppercase font-black tracking-wider text-primary">No. Pesanan {order.id.split("-")[0]}</span>
                        <p className="text-sm font-black text-text-light dark:text-text-dark mt-0.5">{order.profiles?.full_name || "Walk-In Customer"}</p>
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase border ${
                        details.refundStatus === "pending" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/30" :
                        details.refundStatus === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/30" :
                        "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/30"
                      }`}>
                        {details.refundStatus === "pending" ? "Menunggu" : details.refundStatus === "approved" ? "Disetujui" : "Ditolak"}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-text-light dark:text-text-dark">
                      <div className="space-y-1 bg-background-light dark:bg-background-dark p-3 rounded-xl border border-border-light dark:border-border-dark col-span-2">
                        <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Jenis Pembayaran Asal</p>
                        <p className="font-black text-xs text-text-light dark:text-text-dark flex items-center gap-1.5 flex-wrap">
                          {Number(order.total_amount) === 0 && order.voucher_id ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900 uppercase text-[9px] font-black">Full Voucher (Gratis)</span>
                          ) : order.voucher_id && Number(order.total_amount) > 0 ? (
                            <>
                              <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900 uppercase text-[9px] font-black">Kombo (Online + Voucher)</span>
                              <span className="text-muted text-[10px] font-semibold">
                                (Online: Rp {Number(order.total_amount).toLocaleString("id-ID")} + Voucher: Rp {Number(order.discount).toLocaleString("id-ID")})
                              </span>
                            </>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900 uppercase text-[9px] font-black">
                              {order.payment_method === 'wallet' ? 'Saldo Dompet' : 'Pembayaran Online'}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className={`space-y-1 bg-background-light dark:bg-background-dark p-3 rounded-xl border border-border-light dark:border-border-dark ${details.refundMethod === "wallet" ? "col-span-2" : ""}`}>
                        <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Metode Refund</p>
                        <p className="font-black text-sm text-primary flex items-center gap-1">
                          {details.refundMethod === "wallet" ? (
                            <Wallet className="w-4 h-4 shrink-0" />
                          ) : (
                            <CreditCard className="w-4 h-4 shrink-0" />
                          )} {details.bankName}
                        </p>
                      </div>
                      {details.refundMethod !== "wallet" && (
                        <>
                          <div className="space-y-1 bg-background-light dark:bg-background-dark p-3 rounded-xl border border-border-light dark:border-border-dark">
                            <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Nomor Rekening</p>
                            <p className="font-black text-sm text-text-light dark:text-text-dark">{details.accountNo}</p>
                          </div>
                          <div className="space-y-1 bg-background-light dark:bg-background-dark p-3 rounded-xl border border-border-light dark:border-border-dark col-span-2">
                            <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Atas Nama Pemilik</p>
                            <p className="font-black text-sm text-text-light dark:text-text-dark uppercase">{details.accountName}</p>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="space-y-1.5 p-3.5 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-border-light dark:border-border-dark">
                      <p className="text-[10px] font-black uppercase text-muted tracking-widest">Alasan Pengaju</p>
                      <p className="text-xs text-text-light dark:text-text-dark leading-relaxed font-medium">{details.refundReason}</p>
                    </div>

                    {details.adminNotes && (
                      <div className="space-y-1.5 p-3.5 bg-primary/5 rounded-xl border border-primary/10">
                        <p className="text-[10px] font-black uppercase text-primary tracking-widest">Catatan Admin</p>
                        <p className="text-xs text-text-light dark:text-text-dark leading-relaxed font-medium">{details.adminNotes}</p>
                      </div>
                    )}

                    {details.proofUrl && (
                      <div className="space-y-1.5 p-3.5 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-border-light dark:border-border-dark">
                        <p className="text-[10px] font-black uppercase text-muted tracking-widest">Bukti Transfer Refund</p>
                        <a href={details.proofUrl} target="_blank" rel="noreferrer" className="block mt-1 relative rounded-lg overflow-hidden border border-border-light dark:border-border-dark group">
                          <img src={details.proofUrl} alt="Bukti Transfer" className="object-cover w-full h-32 rounded-lg group-hover:scale-105 transition-all" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                            <span className="text-white text-[10px] font-black uppercase tracking-wider">Klik Untuk Memperbesar</span>
                          </div>
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-border-light dark:border-border-dark flex justify-between items-center">
                    <div>
                      <span className="text-[10px] font-black uppercase text-muted tracking-wider block">Total Refund</span>
                      <span className="text-lg font-black text-primary">Rp {Number(order.total_amount).toLocaleString("id-ID")}</span>
                    </div>

                    {isPending && (
                      <div className="flex gap-2">
                        <button onClick={() => { setSelectedRefund(order); setActionType("reject"); }} className="px-4 py-2 bg-red-50 text-red-500 rounded-xl font-bold hover:bg-red-100 transition-all text-xs flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Tolak</button>
                        <button onClick={() => { setSelectedRefund(order); setActionType("approve"); }} className="px-4 py-2 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-all text-xs flex items-center gap-1.5 shadow-lg shadow-green-500/10"><CheckCircle className="w-4 h-4" /> Setujui (ACC)</button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      ) : (
        /* Analytics Tab View */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Pie Chart */}
            <div className="bg-card-light dark:bg-card-dark p-6 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-text-light dark:text-text-dark mb-4">Proporsi Status Refund</h3>
              <div className="h-64 flex justify-center items-center">
                {pieData.length === 0 ? (
                  <p className="text-xs text-muted font-bold">Tidak ada data refund.</p>
                ) : (
                  <LazyRefundPieChart data={pieData} />
                )}
              </div>
            </div>

            {/* Method Bar Chart */}
            <div className="bg-card-light dark:bg-card-dark p-6 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-text-light dark:text-text-dark mb-4">Nominal Refund per Metode (Rp)</h3>
              <div className="h-64 flex justify-center items-center">
                {barData.length === 0 ? (
                  <p className="text-xs text-muted font-bold">Tidak ada data refund.</p>
                ) : (
                  <LazyRefundBarChart data={barData} />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left: Customer Accumulation (col-span-2) */}
            <div className="bg-card-light dark:bg-card-dark p-6 rounded-2xl border border-border-light dark:border-border-dark shadow-sm md:col-span-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-text-light dark:text-text-dark mb-4">Akumulasi Refund per Pelanggan</h3>
              <div className="overflow-x-auto max-h-80 custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border-light dark:border-border-dark pb-2 text-muted uppercase text-[9px] tracking-wider">
                      <th className="py-2.5 font-bold">Pelanggan</th>
                      <th className="py-2.5 font-bold text-right">Disetujui</th>
                      <th className="py-2.5 font-bold text-right">Menunggu</th>
                      <th className="py-2.5 font-bold text-right">Total Akumulasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(customerStats).map(name => {
                      const stat = customerStats[name];
                      return (
                        <tr key={name} className="border-b border-border-light/50 dark:border-border-dark/30 hover:bg-black/5 dark:hover:bg-white/5 transition-all">
                          <td className="py-3 font-semibold text-text-light dark:text-text-dark">{name}</td>
                          <td className="py-3 text-right text-emerald-600 dark:text-emerald-400 font-extrabold">Rp {stat.approved.toLocaleString("id-ID")}</td>
                          <td className="py-3 text-right text-amber-600 dark:text-amber-400 font-extrabold">Rp {stat.pending.toLocaleString("id-ID")}</td>
                          <td className="py-3 text-right font-black text-text-light dark:text-text-dark">Rp {stat.total.toLocaleString("id-ID")}</td>
                        </tr>
                      );
                    })}
                    {Object.keys(customerStats).length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-muted font-bold">Tidak ada data refund.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Method Summary (col-span-1) */}
            <div className="bg-card-light dark:bg-card-dark p-6 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
              <h3 className="text-xs font-black uppercase tracking-wider text-text-light dark:text-text-dark mb-4">Ringkasan per Metode</h3>
              <div className="space-y-4">
                {Object.keys(methodStats).map(method => {
                  const stat = methodStats[method];
                  return (
                    <div key={method} className="p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark space-y-2">
                      <p className="text-xs font-black uppercase text-primary tracking-wider">{method}</p>
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-muted">Telah Cair (Disetujui)</span>
                        <span className="text-emerald-600 dark:text-emerald-400">Rp {stat.approved.toLocaleString("id-ID")}</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-muted">Belum Cair (Menunggu)</span>
                        <span className="text-amber-600 dark:text-amber-400">Rp {stat.pending.toLocaleString("id-ID")}</span>
                      </div>
                    </div>
                  );
                })}
                {Object.keys(methodStats).length === 0 && (
                  <p className="text-xs text-muted text-center py-4 font-bold">Tidak ada data refund.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Process Action Modal */}
      <BaseModal isOpen={!!(selectedRefund && actionType)} onClose={() => { setSelectedRefund(null); setActionType(null); }} size="md" title={actionType === "approve" ? "Setujui Refund" : "Tolak Refund"}>
        {selectedRefund && actionType && (
          <div className="space-y-4">
            <div className="p-4 bg-background-light dark:bg-background-dark rounded-2xl border border-border-light dark:border-border-dark text-xs space-y-1.5 font-bold">
              <p><span className="text-muted">ID Pesanan:</span> #{selectedRefund.id.split("-")[0]}</p>
              <p><span className="text-muted">Pelanggan:</span> {selectedRefund.profiles?.full_name}</p>
              <p><span className="text-muted">Dana Cash Dibayar:</span> <span className="text-primary text-sm font-black">Rp {Number(selectedRefund.total_amount).toLocaleString("id-ID")}</span></p>
              {selectedRefund.voucher_id && (
                <p><span className="text-muted">Potongan Voucher:</span> <span className="text-rose-500 font-extrabold">Rp {Number(selectedRefund.discount).toLocaleString("id-ID")}</span></p>
              )}
              <p>
                <span className="text-muted">Jenis Pembayaran:</span>{' '}
                {Number(selectedRefund.total_amount) === 0 && selectedRefund.voucher_id ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 uppercase text-[9px] font-black inline-block">Full Voucher (Gratis)</span>
                ) : selectedRefund.voucher_id && Number(selectedRefund.total_amount) > 0 ? (
                  <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900 uppercase text-[9px] font-black inline-block">Kombo (Online + Voucher)</span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900 uppercase text-[9px] font-black inline-block">
                    {selectedRefund.payment_method === 'wallet' ? 'Saldo Dompet' : 'Pembayaran Online'}
                  </span>
                )}
              </p>
            </div>

            {actionType === "approve" && selectedRefund.refundDetails.refundMethod !== "wallet" && (
              <div>
                <label className="block text-xs font-black uppercase text-muted mb-2 ml-1">Unggah Bukti Transfer Refund</label>
                <div className="relative border-2 border-dashed border-border-light dark:border-border-dark rounded-2xl p-4 text-center hover:border-primary transition-all bg-background-light dark:bg-background-dark">
                  {uploadingProof ? (
                    <div className="flex flex-col items-center justify-center py-4 space-y-2">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-xs text-muted font-bold">Sedang mengunggah bukti...</span>
                    </div>
                  ) : proofUrl ? (
                    <div className="relative rounded-xl overflow-hidden max-h-40 bg-gray-100 dark:bg-gray-800 border border-border-light dark:border-border-dark flex justify-center items-center p-2">
                      <img src={proofUrl} alt="Bukti Transfer" className="object-contain max-h-36 rounded-lg" />
                      <button title="Hapus Bukti Transfer" type="button" onClick={() => setProofUrl("")} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all shadow">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center py-4 space-y-1.5">
                      <Upload className="w-8 h-8 text-muted" />
                      <span className="text-xs font-bold text-text-light dark:text-text-dark">Pilih berkas bukti transfer</span>
                      <span className="text-[10px] text-muted font-semibold">PNG, JPG, JPEG atau PDF</span>
                      <input type="file" accept="image/*,application/pdf" onChange={handleUploadProof} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
            )}

            {actionType === "approve" && (selectedRefund.refundDetails.refundMethod === "wallet" || selectedRefund.payment_method === "duitku" || selectedRefund.payment_method === "non_cash" || selectedRefund.payment_method === "wallet") && (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-2xl text-green-800 dark:text-green-400 flex items-start gap-3">
                <Wallet className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black uppercase tracking-wider">Pencairan Dana Refund</p>
                  <p className="text-[11px] font-semibold leading-relaxed mt-0.5">
                    {Number(selectedRefund.total_amount) === 0 ? (
                      <span>Pesanan ini gratis (full voucher). Menyetujui pengajuan akan mengembalikan voucher belanja ke pelanggan agar dapat digunakan kembali.</span>
                    ) : (
                      <span>Dana refund cash sebesar <span className="font-extrabold">Rp {Number(selectedRefund.total_amount).toLocaleString("id-ID")}</span> akan langsung dikreditkan ke Saldo Dompet pelanggan secara otomatis. Tidak diperlukan bukti transfer fisik. {selectedRefund.voucher_id && "Voucher belanja yang digunakan juga otomatis dikembalikan ke akun pelanggan."}</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-black uppercase text-muted mb-2 ml-1">Catatan {actionType === "approve" ? "Pencairan" : "Penolakan"}</label>
              <textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} rows={3} placeholder={actionType === "approve" ? "Contoh: Dana telah ditransfer balik ke rekening Anda." : "Contoh: Mohon maaf, data nomor rekening Anda tidak valid."} className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-primary/20 text-text-light dark:text-text-dark font-medium text-sm" />
            </div>

            <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
              <button type="button" onClick={() => { setSelectedRefund(null); setActionType(null); }} className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-muted font-black rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all uppercase text-xs">Tutup</button>
              <button type="button" onClick={handleProcessRefund} disabled={processing} className={`flex-[2] py-3.5 text-white font-black rounded-xl transition-all shadow-lg uppercase text-xs flex items-center justify-center gap-2 ${
                actionType === "approve" ? "bg-green-500 hover:bg-green-600 shadow-green-500/10" : "bg-red-500 hover:bg-red-600 shadow-red-500/10"
              }`}>
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : actionType === "approve" ? "Ya, Setujui" : "Ya, Tolak"}
              </button>
            </div>
          </div>
        )}
      </BaseModal>
    </div>
  );
}
