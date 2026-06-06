"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, FileText, Loader2, TrendingUp, DollarSign, Search, Filter, Eye, X, Receipt, Banknote, CreditCard, FileSpreadsheet, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format, subDays, subMonths, startOfDay, isAfter, isSameDay } from "date-fns";
import { id as localeId } from "date-fns/locale";
import toast from "react-hot-toast";
import BaseModal from "@/components/BaseModal";

import { downloadFile } from '@/utils/downloadHelper';
import dynamic from 'next/dynamic';

const LazyTransactionsChart = dynamic(
  () => import('@/components/charts/TransactionsChart'),
  { ssr: false, loading: () => <div className="h-[300px] w-full bg-gray-100 dark:bg-gray-800 animate-pulse rounded-2xl" /> }
);

export default function AdminTransactions() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [adminName, setAdminName] = useState("");
  
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // 'today', 'week', 'month', '6months', 'all'
  const [typeFilter, setTypeFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [selectedOrder, setSelectedOrder] = useState<any>(null); // For detail modal

  // Reset page to 1 when filters or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, dateFilter, typeFilter, paymentFilter]);

  const supabase = createClient();

  useEffect(() => {
    fetchData();

    // Real-time: Listen for ANY changes in orders table
    const channel = supabase.channel("admin-transactions-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).single();
        if (profile) setAdminName(profile.full_name);
      }

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *, 
          profiles!orders_customer_id_fkey(full_name),
          order_items(
            quantity, 
            price, 
            menu_items(name)
          )
        `)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const tx = data || [];
      setTransactions(tx);

      // Chart Data (7 Hari Terakhir)
      const last7Days = Array.from({ length: 7 }).map((_, i) => subDays(new Date(), 6 - i));
      const dailyData = last7Days.map(date => {
        const dayTx = tx.filter(t => isSameDay(new Date(t.created_at), date));
        const dayTotal = dayTx.reduce((sum, item) => sum + item.total_amount, 0);
        return {
          date: format(date, 'dd MMM', { locale: localeId }),
          pendapatan: dayTotal
        };
      });
      setChartData(dailyData);

    } catch (error: any) {
      toast.error("Gagal memuat data transaksi: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format order items into a readable string
  const formatOrderItems = (items: any[]) => {
    if (!items || items.length === 0) return "-";
    return items.map(i => `${i.quantity}x ${i.menu_items?.name}`).join(", ");
  };

  // Perhitungan Statistik
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const thisMonthOrders = transactions.filter(o => {
    const d = new Date(o.created_at);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  
  const totalRevenue = thisMonthOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
  
  const todayOrders = transactions.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString());
  const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

  // Filter Data for Table
  const filtered = transactions.filter(o => {
    // 1. Search Filter
    const matchesSearch = !search || 
      o.id.includes(search) || 
      (o.profiles?.full_name?.toLowerCase() || "").includes(search.toLowerCase()) ||
      formatOrderItems(o.order_items).toLowerCase().includes(search.toLowerCase());
      
    if (!matchesSearch) return false;

    // 2. Date Filter
    if (dateFilter !== "all") {
      const orderDate = new Date(o.created_at);
      const today = startOfDay(new Date());

      if (dateFilter === "today" && !isAfter(orderDate, today)) return false;
      if (dateFilter === "week" && !isAfter(orderDate, subDays(today, 7))) return false;
      if (dateFilter === "month" && !isAfter(orderDate, subMonths(today, 1))) return false;
      if (dateFilter === "6months" && !isAfter(orderDate, subMonths(today, 6))) return false;
    }

    // 3. Tipe Pesanan Filter
    if (typeFilter !== "all" && o.order_type !== typeFilter) return false;

    // 4. Metode Pembayaran Filter
    if (paymentFilter !== "all") {
      if (paymentFilter === "cash" && o.payment_method !== "cash") return false;
      if (paymentFilter === "non_cash" && o.payment_method === "cash") return false;
    }
    
    return true;
  });

  // Pagination Helper Calculations
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTransactions = filtered.slice(startIndex, startIndex + itemsPerPage);

  const handleExportExcel = () => {
    if (filtered.length === 0) return toast.error("Tidak ada data untuk diekspor");
    
    const periodTitle = (dateFilter === 'all' ? 'Semua Waktu' : dateFilter === 'today' ? 'Hari Ini' : dateFilter === 'week' ? '7 Hari Terakhir' : dateFilter === 'month' ? '1 Bulan Terakhir' : '6 Bulan Terakhir').toUpperCase();
    
    let tableHtml = `<table border="1" style="border-collapse: collapse; font-family: Arial;">
       <tr style="height: 40px;"><td colspan="7" align="center" style="font-size: 16px; font-weight: bold; background-color: #fcfcfc;">LAPORAN TRANSAKSI RESTORAN (TANGGAL: ${periodTitle})</td></tr>
       <tr style="height: 25px;"><td colspan="7" align="left" style="font-size: 11px;">Dicetak oleh: ${adminName || "Admin"} | Tanggal: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeId })} WIB</td></tr>
       <tr style="height: 30px; text-align: center;">
          <th class="th-header" style="border: 1px solid #cbd5e1; padding: 5px;">No. Pesanan</th>
          <th class="th-header" style="border: 1px solid #cbd5e1; padding: 5px;">Pelanggan</th>
          <th class="th-header" style="border: 1px solid #cbd5e1; padding: 5px;">Tipe Pesanan</th>
          <th class="th-header" style="border: 1px solid #cbd5e1; padding: 5px;">Pesanan</th>
          <th class="th-header" style="border: 1px solid #cbd5e1; padding: 5px;">Metode Pembayaran</th>
          <th class="th-header" style="border: 1px solid #cbd5e1; padding: 5px;">Total (Rp)</th>
          <th class="th-header" style="border: 1px solid #cbd5e1; padding: 5px;">Tanggal Waktu</th>
       </tr>`;

    filtered.forEach(order => {
       tableHtml += `<tr style="height: 25px;">
          <td align="center" style="border: 1px solid #cbd5e1; padding: 5px; font-family: monospace;">#${order.id.split("-")[0]}</td>
          <td style="border: 1px solid #cbd5e1; padding: 5px;">${order.profiles?.full_name || "Guest"}</td>
          <td align="center" style="border: 1px solid #cbd5e1; padding: 5px;">${order.order_type === "dine_in" ? "Dine In" : order.order_type === "delivery" ? "Delivery" : "Takeaway"}</td>
          <td style="border: 1px solid #cbd5e1; padding: 5px;">${formatOrderItems(order.order_items)}</td>
          <td align="center" style="border: 1px solid #cbd5e1; padding: 5px;">${order.payment_method === "cash" ? "Cash" : "Non-Cash"}</td>
          <td align="right" style="border: 1px solid #cbd5e1; padding: 5px; font-weight: bold;">${Number(order.total_amount).toLocaleString("id-ID")}</td>
          <td align="center" style="border: 1px solid #cbd5e1; padding: 5px;">${format(new Date(order.created_at), "dd MMM yyyy, HH:mm", { locale: localeId })}</td>
       </tr>`;
    });

    const totalSum = filtered.reduce((sum, order) => sum + Number(order.total_amount), 0);
    tableHtml += `<tr style="font-weight: bold; height: 30px;">
       <td colspan="5" align="center" class="total-bg" style="border: 1px solid #cbd5e1; padding: 5px;">TOTAL PENDAPATAN</td>
       <td align="right" class="total-bg" style="border: 1px solid #cbd5e1; padding: 5px; font-weight: bold; color: #e85d04;">${totalSum.toLocaleString("id-ID")}</td>
       <td class="total-bg" style="border: 1px solid #cbd5e1; padding: 5px;"></td>
    </tr>`;

    tableHtml += `</table>`;

    const template = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>.th-header { background-color: #e85d04; color: #ffffff; font-weight: bold; } .total-bg { background-color: #f1f5f9; }</style><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Transaksi</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${tableHtml}</body></html>`;

    const blob = new Blob([template], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Laporan_Admin_Transaksi_${format(new Date(), 'dd_MM_yyyy')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Berhasil mengekspor ke Excel!");
  };

  // Export PDF
  const handleExportPDF = async () => {
    if (filtered.length === 0) return toast.error("Tidak ada data untuk diekspor");
    const toastId = toast.loading("Mempersiapkan ekspor PDF...");
    
    try {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF('landscape'); 
      
      doc.setFontSize(18);
      doc.setTextColor(20);
      doc.text("Laporan Transaksi Restoran (Admin)", 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Dicetak pada: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: localeId })} WIB`, 14, 30);
      doc.text(`Dicetak oleh: ${adminName || "Admin"}`, 14, 35);
      
      // Header Tabel
      doc.setFontSize(10);
      doc.setTextColor(255);
      doc.setFillColor(232, 93, 4); // Orange primary color Admin
      doc.rect(14, 42, 269, 10, 'F'); 
      
      doc.text("ID", 16, 48);
      doc.text("Pelanggan", 35, 48);
      doc.text("Pesanan", 72, 48);
      doc.text("Tipe", 172, 48);
      doc.text("Pembayaran", 194, 48);
      doc.text("Total", 224, 48);
      doc.text("Tanggal", 252, 48);
      
      doc.setTextColor(60);
      let y = 58;
      
      filtered.forEach((order) => {
        if (y > 190) { 
          doc.addPage();
          y = 20;
          
          doc.setTextColor(255);
          doc.setFillColor(232, 93, 4);
          doc.rect(14, y-8, 269, 10, 'F');
          doc.text("ID", 16, y-2);
          doc.text("Pelanggan", 35, y-2);
          doc.text("Pesanan", 72, y-2);
          doc.text("Tipe", 172, y-2);
          doc.text("Pembayaran", 194, y-2);
          doc.text("Total", 224, y-2);
          doc.text("Tanggal", 252, y-2);
          
          doc.setTextColor(60);
          y += 10;
        }
        
        const itemsStr = formatOrderItems(order.order_items);
        const truncItems = itemsStr.length > 75 ? itemsStr.substring(0, 72) + "..." : itemsStr;
        
        doc.text(`#${order.id.split("-")[0]}`, 16, y);
        doc.text(order.profiles?.full_name?.substring(0, 15) || "Guest", 35, y);
        doc.text(truncItems, 72, y);
        doc.text(order.order_type === "dine_in" ? "Dine In" : order.order_type === "delivery" ? "Delivery" : "Takeaway", 172, y);
        doc.text(order.payment_method === "cash" ? "Cash" : "Non-Cash", 194, y);
        doc.text(`Rp ${Number(order.total_amount).toLocaleString("id-ID")}`, 224, y);
        doc.text(format(new Date(order.created_at), "dd MMM yyyy, HH:mm", { locale: localeId }), 252, y);
        
        y += 10;
        doc.setDrawColor(220);
        doc.line(14, y - 6, 283, y - 6);
      });
      
      const pdfBase64 = doc.output('datauristring');
      await downloadFile({
        dataBase64: pdfBase64,
        filename: `Laporan_Admin_Transaksi_${format(new Date(), 'dd_MM_yyyy')}.pdf`,
        mimeType: 'application/pdf'
      });
      toast.success("Berhasil mengekspor ke PDF!", { id: toastId });
    } catch (e) {
      toast.error("Gagal mengekspor ke PDF", { id: toastId });
      console.error(e);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      <button onClick={() => window.history.back()} className="flex items-center gap-2 text-sm font-bold text-muted hover:text-primary transition-all">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Sebelumnya
      </button>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/20 text-primary rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-text-light dark:text-text-dark tracking-tight">Laporan & Analitik</h1>
            <p className="text-muted text-sm mt-1 font-medium">Pantau performa penjualan dan unduh laporan transaksi.</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-4">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari ID, Nama, Pesanan..." className="w-full pl-12 pr-4 py-3 bg-white dark:bg-card-dark border-2 border-transparent focus:border-primary rounded-2xl outline-none text-text-light dark:text-text-dark font-bold shadow-sm transition-all" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportPDF} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-2xl font-bold transition-colors">
              <FileText className="w-5 h-5" /> <span className="hidden sm:inline">PDF</span>
            </button>
            <button onClick={handleExportExcel} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded-2xl font-bold transition-colors">
              <FileSpreadsheet className="w-5 h-5" /> <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="xl:w-1/4 bg-white dark:bg-card-dark rounded-3xl shadow-sm border border-border-light dark:border-border-dark p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-text-light dark:text-text-dark">Filter Waktu</h3>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { id: 'today', label: 'Hari Ini' },
              { id: 'week', label: '7 Hari Terakhir' },
              { id: 'month', label: '1 Bulan Terakhir' },
              { id: '6months', label: '6 Bulan Terakhir' },
              { id: 'all', label: 'Semua Waktu' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setDateFilter(filter.id)}
                className={`text-left px-4 py-3 rounded-xl font-bold transition-all ${
                  dateFilter === filter.id 
                    ? 'bg-primary text-white shadow-md shadow-primary/20' 
                    : 'bg-gray-50 text-muted hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mt-6 border-t border-border-light/50 dark:border-border-dark/50 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-text-light dark:text-text-dark">Tipe Pesanan</h3>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { id: 'all', label: 'Semua Tipe' },
                { id: 'dine_in', label: 'Dine In' },
                { id: 'takeaway', label: 'Takeaway' },
                { id: 'delivery', label: 'Delivery' }
              ].map(type => (
                <button
                  key={type.id}
                  onClick={() => setTypeFilter(type.id)}
                  className={`text-left px-4 py-3 rounded-xl font-bold transition-all ${
                    typeFilter === type.id 
                      ? 'bg-primary text-white shadow-md shadow-primary/20' 
                      : 'bg-gray-50 text-muted hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-border-light/50 dark:border-border-dark/50 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-text-light dark:text-text-dark">Metode Pembayaran</h3>
            </div>
            <div className="flex flex-col gap-2">
              {[
                { id: 'all', label: 'Semua Metode' },
                { id: 'cash', label: 'Cash' },
                { id: 'non_cash', label: 'Non-Cash' }
              ].map(pm => (
                <button
                  key={pm.id}
                  onClick={() => setPaymentFilter(pm.id)}
                  className={`text-left px-4 py-3 rounded-xl font-bold transition-all ${
                    paymentFilter === pm.id 
                      ? 'bg-primary text-white shadow-md shadow-primary/20' 
                      : 'bg-gray-50 text-muted hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800'
                  }`}
                >
                  {pm.label}
                </button>
              ))}
            </div>
          </div>
          
          <div className="mt-8 border-t border-border-light/50 dark:border-border-dark/50 pt-6">
            <h3 className="font-bold text-text-light dark:text-text-dark mb-4 text-sm uppercase tracking-widest text-muted">Ringkasan Statistik</h3>
            <div className="space-y-4">
              <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
                <p className="text-xs font-black uppercase tracking-widest text-primary mb-1">Pendapatan Bulan Ini</p>
                <p className="text-xl font-black text-primary">Rp {totalRevenue.toLocaleString("id-ID")}</p>
              </div>
              <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-600 mb-1">Pendapatan Hari Ini</p>
                <p className="text-xl font-black text-emerald-600">Rp {todayRevenue.toLocaleString("id-ID")}</p>
              </div>
              <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-1">Total Pesanan</p>
                <p className="text-xl font-black text-blue-600">{transactions.length} Pesanan</p>
              </div>
            </div>
          </div>
        </div>

        <div className="xl:w-3/4 flex flex-col gap-6">
          <div className="bg-white dark:bg-card-dark rounded-3xl shadow-sm border border-border-light dark:border-border-dark p-6 h-[400px]">
            <h3 className="font-bold text-lg text-text-light dark:text-text-dark flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-primary" /> Tren Pendapatan (7 Hari Terakhir)
            </h3>
            <LazyTransactionsChart data={chartData} />
          </div>

          <div className="bg-white dark:bg-card-dark rounded-3xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden flex-1">
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: '1100px' }}>
                <thead className="bg-gray-50/50 dark:bg-gray-800/20 border-b border-border-light dark:border-border-dark">
                  <tr>
                    <th className="text-left py-5 px-6 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">No. Pesanan</th>
                    <th className="text-left py-5 px-6 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">Pelanggan</th>
                    <th className="text-left py-5 px-6 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">Pesanan</th>
                    <th className="text-left py-5 px-6 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">Tipe</th>
                    <th className="text-left py-5 px-6 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">Pembayaran</th>
                    <th className="text-left py-5 px-6 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">Total</th>
                    <th className="text-left py-5 px-6 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">Tanggal</th>
                    <th className="text-left py-5 px-6 text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {paginatedTransactions.map((order, i) => {
                    const itemsStr = formatOrderItems(order.order_items);
                    const truncItems = itemsStr.length > 30 ? itemsStr.substring(0, 30) + "..." : itemsStr;
                    return (
                      <motion.tr key={order.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="py-4 px-6 font-mono text-sm font-bold text-text-light dark:text-text-dark whitespace-nowrap">#{order.id.split("-")[0]}</td>
                        <td className="py-4 px-6 text-sm font-medium text-text-light dark:text-text-dark whitespace-nowrap">{order.profiles?.full_name || "Guest"}</td>
                        <td className="py-4 px-6 text-sm text-muted max-w-[200px] truncate whitespace-nowrap" title={itemsStr}>{truncItems}</td>
                        <td className="py-4 px-6 whitespace-nowrap"><span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-muted whitespace-nowrap">{order.order_type === "dine_in" ? "Dine In" : order.order_type === "delivery" ? "Delivery" : "Takeaway"}</span></td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full whitespace-nowrap ${order.payment_method === "cash" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800/50" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50"}`}>
                            {order.payment_method === "cash" ? <><Banknote className="w-3 h-3" /> Cash</> : <><CreditCard className="w-3 h-3" /> Non-Cash</>}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-black text-primary text-base whitespace-nowrap">Rp {Number(order.total_amount).toLocaleString("id-ID")}</td>
                        <td className="py-4 px-6 text-sm font-medium text-muted whitespace-nowrap">{format(new Date(order.created_at), "dd MMM yyyy", { locale: localeId })}<br/><span className="text-xs">{format(new Date(order.created_at), "HH:mm")}</span></td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <button 
                            onClick={() => setSelectedOrder(order)}
                            className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors"
                            title="Lihat Detail"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-16 flex flex-col items-center justify-center">
                <Receipt className="w-16 h-16 text-muted mb-4 opacity-50" />
                <p className="text-muted font-medium">Belum ada transaksi yang sesuai filter Anda.</p>
              </div>
            )}
            {filtered.length > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border-light dark:border-border-dark bg-gray-50/30 dark:bg-gray-800/10">
                <span className="text-xs text-muted font-bold">
                  Menampilkan {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filtered.length)} dari {filtered.length} transaksi
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark text-text-light dark:text-text-dark hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Sebelumnya
                  </button>
                  <div className="flex items-center gap-1">
                    {[...Array(totalPages)].map((_, idx) => {
                      const pageNum = idx + 1;
                      if (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - currentPage) <= 1) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`w-8 h-8 text-xs font-bold rounded-xl transition-all ${
                              currentPage === pageNum
                                ? 'bg-primary text-white'
                                : 'bg-transparent text-muted hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      }
                      if (pageNum === 2 || pageNum === totalPages - 1) {
                        return <span key={pageNum} className="text-xs text-muted">...</span>;
                      }
                      return null;
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark text-text-light dark:text-text-dark hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Detail Pesanan */}
      <BaseModal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} size="lg" noPadding={true} showCloseButton={false}>
        <div className="p-6 md:p-8 relative">
          <button aria-label="Tutup" title="Tutup" onClick={() => setSelectedOrder(null)} className="absolute right-6 top-6 text-muted hover:text-text-light dark:hover:text-text-dark bg-gray-50 dark:bg-gray-800 p-2 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
          
          <h3 className="text-2xl font-black text-text-light dark:text-text-dark mb-6">Detail Pesanan <span className="text-primary">#{selectedOrder?.id.split('-')[0]}</span></h3>
          
          <div className="space-y-4 mb-8 text-text-light dark:text-text-dark">
            <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark">
              <span className="text-muted font-medium">Pelanggan</span>
              <span className="font-bold text-text-light dark:text-text-dark">{selectedOrder?.profiles?.full_name || "Guest"}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark">
              <span className="text-muted font-medium">Waktu Transaksi</span>
              <span className="font-bold text-text-light dark:text-text-dark">{selectedOrder && format(new Date(selectedOrder.created_at), "dd MMMM yyyy, HH:mm", { locale: localeId })}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark">
              <span className="text-muted font-medium">Tipe</span>
              <span className="font-bold uppercase tracking-wider text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">{selectedOrder?.order_type === "dine_in" ? "Dine In" : selectedOrder?.order_type === "delivery" ? "Delivery" : "Takeaway"}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-border-light dark:border-border-dark">
              <span className="text-muted font-medium">Pembayaran</span>
              <span className="font-bold uppercase tracking-wider text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center gap-1">
                {selectedOrder?.payment_method === 'cash' ? <><Banknote className="w-3 h-3"/> Cash</> : <><CreditCard className="w-3 h-3"/> Non-Cash</>}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h4 className="font-bold text-text-light dark:text-text-dark mb-3">Item Dipesan:</h4>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 space-y-3 max-h-48 overflow-y-auto">
              {selectedOrder?.order_items?.map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center font-bold text-sm text-primary shadow-sm">{item.quantity}x</span>
                    <span className="font-medium text-text-light dark:text-text-dark">{item.menu_items?.name}</span>
                  </div>
                  <span className="font-bold text-text-light dark:text-text-dark">Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center p-5 bg-primary/10 dark:bg-primary/5 rounded-2xl border border-primary/20">
            <span className="font-bold text-text-light dark:text-text-dark">Total Pembayaran</span>
            <span className="text-2xl font-black text-primary">Rp {selectedOrder && Number(selectedOrder.total_amount).toLocaleString("id-ID")}</span>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
