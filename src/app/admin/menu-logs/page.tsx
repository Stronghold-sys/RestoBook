"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Check, UtensilsCrossed, ArrowLeft, Calendar, User, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function AdminMenuLogs() {
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  // Filtering States
  const [searchMenu, setSearchMenu] = useState("");
  const [searchCashier, setSearchCashier] = useState("");
  const [searchDate, setSearchDate] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchInitialData();

    // Subscribe to menu updates & notification logs realtime
    const menuChannel = supabase.channel("admin_menu_logs_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => {
        fetchMenuItems();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(menuChannel);
    };
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchMenuItems(), fetchLogs()]);
    setLoading(false);
  };

  const fetchMenuItems = async () => {
    const { data } = await supabase.from("menu_items").select("*").order("name");
    if (data) setMenuItems(data);
  };

  const fetchLogs = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*, profiles(full_name)")
      .eq("type", "audit_log")
      .order("created_at", { ascending: false });
    
    if (data) {
      // Filter only menu status logs (which contain "[Menu Log]")
      const menuLogs = data.filter(log => log.message.includes("[Menu Log]"));
      setLogs(menuLogs);
    }
  };

  const handleMakeAvailable = async (item: any) => {
    try {
      const { error } = await supabase.from("menu_items").update({ is_active: true }).eq("id", item.id);
      if (error) throw error;

      toast.success(`${item.name} telah kembali tersedia!`);

      // Log activity
      const { data: { session } } = await supabase.auth.getSession();
      let adminName = "Admin";
      let adminId = "";
      if (session?.user) {
        const { data: profile } = await supabase.from("profiles").select("id, full_name").eq("user_id", session.user.id).single();
        if (profile) {
          adminName = profile.full_name;
          adminId = profile.id;
        }
      }

      await supabase.from("notifications").insert({
        user_id: adminId || null,
        title: "Log Status Menu",
        message: `[Menu Log] Menu ${item.name} diubah dari Habis menjadi Tersedia oleh Admin ${adminName}.`,
        type: 'audit_log'
      });

      fetchInitialData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Filtered Logs
  const filteredLogs = logs.filter(log => {
    // Extract menu name and cashier name from log message for accurate filtering
    // Message format: [Menu Log] Menu <Name> diubah dari <X> menjadi <Y> oleh Kasir/Admin <User>
    const msg = log.message.toLowerCase();
    
    const matchesMenu = msg.includes(searchMenu.toLowerCase());
    const matchesUser = log.profiles?.full_name?.toLowerCase().includes(searchCashier.toLowerCase()) || msg.includes(searchCashier.toLowerCase());
    
    let matchesDate = true;
    if (searchDate) {
      const logDate = new Date(log.created_at).toISOString().split("T")[0];
      matchesDate = logDate === searchDate;
    }

    return matchesMenu && matchesUser && matchesDate;
  });

  const outOfStockItems = menuItems.filter(m => !m.is_active);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 p-4 space-y-8">
      {/* Back Button */}
      <button onClick={() => window.history.back()} className="flex items-center gap-2 text-sm font-bold text-muted hover:text-primary transition-all">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Sebelumnya
      </button>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-text-light dark:text-text-dark tracking-tight">Riwayat & Kontrol Ketersediaan Menu</h1>
          <p className="text-muted mt-1">Pantau perubahan ketersediaan menu secara realtime dan atur ketersediaan dengan cepat</p>
        </div>
        <button onClick={fetchInitialData} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl text-xs font-bold flex items-center gap-2 hover:border-primary transition-all text-text-light dark:text-text-dark shadow-sm">
          <RefreshCw className="w-4 h-4" /> Segarkan Data
        </button>
      </div>

      {/* QUICK CONTROL FOR OUT OF STOCK ITEMS */}
      <div className="bg-red-50/30 dark:bg-red-950/10 rounded-3xl p-6 border border-red-100 dark:border-red-900/30 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-text-light dark:text-text-dark">Menu Habis Saat Ini ({outOfStockItems.length})</h3>
            <p className="text-xs text-muted">Butuh pemulihan stok? Tandai kembali menjadi tersedia dengan satu klik secara realtime.</p>
          </div>
        </div>

        {outOfStockItems.length === 0 ? (
          <div className="py-6 text-center text-green-600 dark:text-green-400 font-bold text-sm bg-white dark:bg-card-dark rounded-2xl border border-green-100 dark:border-green-900/20">
            Semua menu saat ini tersedia! Tidak ada menu yang habis.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {outOfStockItems.map(item => (
              <motion.div
                key={item.id}
                whileHover={{ scale: 1.01 }}
                className="bg-white dark:bg-card-dark rounded-2xl p-4 border border-border-light dark:border-border-dark shadow-sm flex flex-col justify-between space-y-3"
              >
                <div className="flex items-center gap-3">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                      <UtensilsCrossed className="w-6 h-6 text-muted" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-text-light dark:text-text-dark truncate leading-tight">{item.name}</p>
                    <p className="text-[10px] font-black text-primary mt-1">Rp {item.price.toLocaleString("id-ID")}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleMakeAvailable(item)}
                  className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-green-500/10"
                >
                  <Check className="w-3.5 h-3.5" /> Tandai Tersedia
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* FILTER CONTROLS FOR LOGS */}
      <div className="bg-card-light dark:bg-card-dark rounded-3xl p-6 border border-border-light dark:border-border-dark shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="searchMenu" className="text-xs font-black uppercase text-muted tracking-widest block mb-2">Cari Nama Menu</label>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
            <input
              id="searchMenu"
              type="text"
              value={searchMenu}
              onChange={e => setSearchMenu(e.target.value)}
              placeholder="Contoh: Nasi Goreng..."
              title="Cari Nama Menu"
              className="w-full pl-9 pr-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:border-primary text-sm text-text-light dark:text-text-dark"
            />
          </div>
        </div>

        <div>
          <label htmlFor="searchCashier" className="text-xs font-black uppercase text-muted tracking-widest block mb-2">Cari Kasir / Aktor</label>
          <div className="relative">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted" />
            <input
              id="searchCashier"
              type="text"
              value={searchCashier}
              onChange={e => setSearchCashier(e.target.value)}
              placeholder="Contoh: Budi Kasir..."
              title="Cari Kasir / Aktor"
              className="w-full pl-9 pr-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:border-primary text-sm text-text-light dark:text-text-dark"
            />
          </div>
        </div>

        <div>
          <label htmlFor="searchDate" className="text-xs font-black uppercase text-muted tracking-widest block mb-2">Filter Tanggal</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted" />
            <input
              id="searchDate"
              type="date"
              value={searchDate}
              onChange={e => setSearchDate(e.target.value)}
              placeholder="Pilih Tanggal"
              title="Filter Tanggal"
              className="w-full pl-9 pr-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:border-primary text-sm text-text-light dark:text-text-dark font-medium"
            />
          </div>
        </div>
      </div>

      {/* AUDIT LOGS TABLE */}
      <div className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-gray-800/20">
          <h3 className="font-extrabold text-base text-text-light dark:text-text-dark flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Riwayat Log Ketersediaan Menu ({filteredLogs.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/30 border-b border-border-light dark:border-border-dark text-muted text-xs font-black uppercase tracking-wider">
                <th className="p-4 pl-6">Waktu Log</th>
                <th className="p-4">Deskripsi Perubahan</th>
                <th className="p-4">Aktor / Pelaku</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-muted text-sm font-semibold">
                    Tidak ada log ketersediaan menu ditemukan.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const dateFormatted = new Date(log.created_at).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short"
                  });

                  // Highlight change actions in the logs
                  const isToHabis = log.message.toLowerCase().includes("menjadi habis");

                  return (
                    <tr key={log.id} className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="p-4 pl-6 text-sm font-mono text-muted whitespace-nowrap">
                        {dateFormatted}
                      </td>
                      <td className="p-4 text-sm font-medium text-text-light dark:text-text-dark">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isToHabis ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                          <span>{log.message.replace("[Menu Log] ", "")}</span>
                        </div>
                      </td>
                      <td className="p-4 text-sm font-extrabold text-primary">
                        {log.profiles?.full_name || "Sistem"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
