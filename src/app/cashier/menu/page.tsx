"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Ban, Check, UtensilsCrossed, ArrowLeft, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import BaseModal from "@/components/BaseModal";

export default function CashierMenuManagement() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  
  // Filtering States
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeStatus, setActiveStatus] = useState<"all" | "available" | "out">("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [cashierName, setCashierName] = useState("");
  const [cashierId, setCashierId] = useState("");

  // Confirmation Modal State
  const [confirmItem, setConfirmItem] = useState<any | null>(null);
  const [updating, setUpdating] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchInitialData();

    // Subscribe to menu updates realtime
    const menuChannel = supabase.channel("cashier_menu_management_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, (payload) => {
        setMenuItems(prev => {
          if (payload.eventType === "INSERT") return [...prev, payload.new].sort((a, b) => a.name.localeCompare(b.name));
          if (payload.eventType === "UPDATE") return prev.map(m => m.id === payload.new.id ? payload.new : m);
          if (payload.eventType === "DELETE") return prev.filter(m => m.id !== payload.old.id);
          return prev;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(menuChannel);
    };
  }, []);

  const fetchInitialData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase.from("profiles").select("id, full_name").eq("user_id", session.user.id).single();
        if (profile) {
          setCashierName(profile.full_name);
          setCashierId(profile.id);
        }
      }

      const [catRes, menuRes] = await Promise.all([
        supabase.from("categories").select("*").order("sort_order", { ascending: true }),
        supabase.from("menu_items").select("*").order("name")
      ]);

      setCategories(catRes.data || []);
      setMenuItems(menuRes.data || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleClick = (item: any) => {
    setConfirmItem(item);
  };

  const handleConfirmToggle = async () => {
    if (!confirmItem) return;
    setUpdating(true);
    const newStatus = !confirmItem.is_active;
    try {
      const { error } = await supabase.from("menu_items").update({ is_active: newStatus }).eq("id", confirmItem.id);
      if (error) throw error;

      toast.success(`${confirmItem.name} berhasil ditandai ${newStatus ? 'Tersedia' : 'Habis'}`);

      // Update local state instantly
      setMenuItems(prev => prev.map(m => m.id === confirmItem.id ? { ...m, is_active: newStatus } : m));

      // Log to notifications table as audit log for Admin & system log
      await supabase.from("notifications").insert({
        user_id: cashierId,
        title: "Log Status Menu",
        message: `[Menu Log] Menu ${confirmItem.name} diubah dari ${confirmItem.is_active ? 'Tersedia' : 'Habis'} menjadi ${newStatus ? 'Tersedia' : 'Habis'} oleh Kasir ${cashierName}.`,
        type: 'audit_log'
      });

      // Send real-time notification specifically to admin
      if (!newStatus) {
        await supabase.from("notifications").insert({
          user_id: null, // Broadcast to admin dashboard
          title: "Stok Menu Habis!",
          message: `Menu ${confirmItem.name} ditandai HABIS oleh kasir ${cashierName} pada pukul ${new Date().toLocaleTimeString("id-ID")}.`,
          type: 'system_alert'
        });
      }

      setConfirmItem(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUpdating(false);
    }
  };

  const filteredMenu = menuItems.filter(item => {
    const matchesCategory = activeCategory === "all" || item.category_id === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (activeStatus === "available") matchesStatus = item.is_active === true;
    if (activeStatus === "out") matchesStatus = item.is_active === false;

    return matchesCategory && matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 p-4 space-y-6">
      {/* Back Button */}
      <button onClick={() => window.history.back()} className="flex items-center gap-2 text-sm font-bold text-muted hover:text-primary transition-all">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Sebelumnya
      </button>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-light dark:text-text-dark tracking-tight">Status Ketersediaan Menu</h1>
          <p className="text-muted mt-1">Kelola ketersediaan menu secara realtime untuk pelanggan dan kasir POS</p>
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari makanan atau minuman..."
            className="w-full pl-11 pr-4 py-3.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark shadow-sm font-medium"
          />
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-card-light dark:bg-card-dark rounded-3xl p-6 border border-border-light dark:border-border-dark shadow-sm space-y-4">
        <div>
          <p className="text-xs font-black uppercase text-muted tracking-widest mb-3">Filter Kategori</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeCategory === "all"
                  ? "bg-primary text-white shadow-md shadow-primary/20"
                  : "bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-border-light dark:border-border-dark"
              }`}
            >
              Semua Kategori ({menuItems.length})
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  activeCategory === c.id
                    ? "bg-primary text-white shadow-md shadow-primary/20"
                    : "bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark border border-border-light dark:border-border-dark"
                }`}
              >
                {c.name} ({menuItems.filter(m => m.category_id === c.id).length})
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-border-light dark:border-border-dark">
          <p className="text-xs font-black uppercase text-muted tracking-widest mb-3">Filter Status Stok</p>
          <div className="flex gap-3">
            {[
              { id: "all", label: "Semua Menu", count: menuItems.length },
              { id: "available", label: "Tersedia", count: menuItems.filter(m => m.is_active).length },
              { id: "out", label: "Habis", count: menuItems.filter(m => !m.is_active).length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveStatus(tab.id as any)}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
                  activeStatus === tab.id
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${tab.id === 'available' ? 'bg-green-500' : tab.id === 'out' ? 'bg-red-500' : 'bg-gray-400'}`} />
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MENU GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredMenu.map((item) => (
          <motion.div
            key={item.id}
            layout
            className={`bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark overflow-hidden shadow-xl flex flex-col justify-between transition-all group ${
              item.is_active ? "hover:scale-[1.01] hover:shadow-2xl" : "opacity-80 grayscale"
            }`}
          >
            <div className="relative h-44 bg-gray-100 overflow-hidden shrink-0">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted">
                  <UtensilsCrossed className="w-14 h-14 opacity-20 animate-pulse" />
                </div>
              )}
              {!item.is_active && (
                <div className="absolute inset-0 bg-red-950/20 backdrop-blur-[1px] flex items-center justify-center">
                  <span className="bg-red-600 text-white font-black px-4 py-1.5 rounded-full text-xs uppercase tracking-widest transform -rotate-12 border-2 border-white shadow-xl">
                    HABIS
                  </span>
                </div>
              )}
            </div>

            <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="font-bold text-text-light dark:text-text-dark text-lg leading-tight line-clamp-1">{item.name}</h3>
                <p className="text-xs text-muted font-bold uppercase mt-1">Kategori: {categories.find(c => c.id === item.category_id)?.name || "Lainnya"}</p>
                <p className="text-base font-black text-primary mt-2">Rp {item.price.toLocaleString("id-ID")}</p>
              </div>

              <div className="pt-4 border-t border-border-light dark:border-border-dark flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-black uppercase text-muted block">STATUS STOK</span>
                  <span className={`text-xs font-black uppercase tracking-wider ${item.is_active ? 'text-green-600' : 'text-red-500'}`}>
                    {item.is_active ? 'Tersedia' : 'Habis'}
                  </span>
                </div>

                <button
                  onClick={() => handleToggleClick(item)}
                  className={`px-4 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-wider text-white transition-all ${
                    item.is_active
                      ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20"
                      : "bg-green-500 hover:bg-green-600 shadow-lg shadow-green-500/20"
                  }`}
                >
                  {item.is_active ? "Tandai Habis" : "Tandai Tersedia"}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredMenu.length === 0 && (
        <div className="text-center py-20 bg-card-light dark:bg-card-dark rounded-3xl border border-dashed border-border-light dark:border-border-dark">
          <UtensilsCrossed className="w-16 h-16 text-muted mx-auto mb-4 opacity-30" />
          <h3 className="text-xl font-bold text-text-light dark:text-text-dark">Tidak ada menu ditemukan</h3>
          <p className="text-muted mt-1">Ganti kata kunci pencarian atau ganti filter status ketersediaan.</p>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      <BaseModal
        isOpen={!!confirmItem}
        onClose={() => setConfirmItem(null)}
        size="md"
        showCloseButton={false}
      >
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 rounded-full flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-xl text-text-light dark:text-text-dark">Konfirmasi Ubah Status</h3>
              <p className="text-muted text-sm mt-1 leading-relaxed">
                Apakah Anda yakin ingin mengubah status menu <span className="font-extrabold text-primary">{confirmItem?.name}</span> menjadi <span className="font-black text-red-500">{confirmItem?.is_active ? "HABIS" : "TERSEDIA KEMBALI"}</span>?
              </p>
            </div>
          </div>
 
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={updating}
              onClick={() => setConfirmItem(null)}
              className="flex-1 py-3 border border-border-light dark:border-border-dark rounded-xl font-bold text-muted hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={updating}
              onClick={handleConfirmToggle}
              className="flex-1 py-3 bg-primary text-white rounded-xl font-black shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ya, Konfirmasi"}
            </button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
