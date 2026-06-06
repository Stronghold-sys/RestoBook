"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Heart, ShoppingBag, Loader2, Ban, X, UtensilsCrossed } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCartStore } from "@/store/useCartStore";
import toast from "react-hot-toast";
import Image from "next/image";
import { SkeletonMenuCard } from "@/components/Skeleton";
import BaseModal from "@/components/BaseModal";

interface Category {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  stock: number;
  is_active: boolean;
}

export default function CustomerMenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  
  // Warning popup states for out-of-stock menu items
  const [outOfStockItem, setOutOfStockItem] = useState<MenuItem | null>(null);
  const [clickCount, setClickCount] = useState(0);

  const supabase = createClient();
  const items = useCartStore(state => state.items);
  const addItem = useCartStore(state => state.addItem);
  const removeItem = useCartStore(state => state.removeItem);
  const updateQuantity = useCartStore(state => state.updateQuantity);

  useEffect(() => {
    fetchData();

    // Subscribe to menu updates realtime
    const menuChannel = supabase.channel("customer_menu_realtime_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, (payload) => {
        setMenuItems(prev => {
          if (payload.eventType === "INSERT") return [...prev, payload.new as MenuItem].sort((a, b) => a.name.localeCompare(b.name));
          if (payload.eventType === "UPDATE") return prev.map(m => m.id === payload.new.id ? (payload.new as MenuItem) : m);
          if (payload.eventType === "DELETE") return prev.filter(m => m.id !== payload.old.id);
          return prev;
        });
      })
      .subscribe();

    // Fast backup sync poll (every 3 seconds) for bulletproof realtime experience
    const interval = setInterval(() => {
      fetchMenuItemsOnly();
    }, 3000);

    return () => {
      supabase.removeChannel(menuChannel);
      clearInterval(interval);
    };
  }, []);

  const fetchMenuItemsOnly = async () => {
    try {
      const { data } = await supabase.from("menu_items").select("*").order("name");
      if (data) setMenuItems(data);
    } catch (e) {
      console.error("Fast poll error:", e);
    }
  };

  const fetchData = async () => {
    try {
      const { data: catData, error: catError } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
        
      if (catError) throw catError;
      setCategories(catData || []);

      // Fetch all menu items so we can display out-of-stock menu items too!
      const { data: menuData, error: menuError } = await supabase
        .from("menu_items")
        .select("*")
        .order("name");

      if (menuError) throw menuError;
      setMenuItems(menuData || []);

      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', session.session.user.id).single();
        if (profile) {
          const { data: favData } = await supabase.from('favorites').select('menu_item_id').eq('customer_id', profile.id);
          if (favData) {
            setFavorites(favData.map(f => f.menu_item_id));
          }
        }
      }
    } catch (error: any) {
      toast.error("Gagal memuat menu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    if (!item.is_active) {
      handleOutOfStockClick(item);
      return;
    }
    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
      image_url: item.image_url,
    });
    toast.success(`${item.name} ditambahkan ke keranjang`);
  };

  const handleOutOfStockClick = (item: MenuItem) => {
    setOutOfStockItem(item);
    setClickCount(prev => {
      const next = prev + 1;
      if (next > 2) {
        toast.error("Maaf menu yang Anda pilih sudah habis dan tidak bisa ditambahkan ke pesanan Anda.", { id: "spam-warn" });
      }
      return next;
    });
  };

  const toggleFavorite = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering card click
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) return toast.error("Silakan login kembali");

    const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', session.session.user.id).single();
    if (!profile) return;

    const isFav = favorites.includes(itemId);
    if (isFav) {
      setFavorites(favorites.filter(id => id !== itemId));
      await supabase.from('favorites').delete().eq('customer_id', profile.id).eq('menu_item_id', itemId);
      toast.success("Dihapus dari favorit");
    } else {
      setFavorites([...favorites, itemId]);
      await supabase.from('favorites').insert({ customer_id: profile.id, menu_item_id: itemId });
      toast.success("Ditambahkan ke favorit");
    }
  };

  const filteredMenu = menuItems.filter(item => {
    const matchCat = activeCategory === "all" || item.category_id === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 animate-pulse">
          <div className="space-y-2.5 w-48">
            <div className="h-8 bg-gray-250 dark:bg-gray-750 rounded-xl w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-xl w-1/2" />
          </div>
          <div className="h-11 bg-gray-250 dark:bg-gray-750 rounded-full w-full md:w-72" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 animate-pulse">
          <div className="w-28 h-10 bg-gray-250 dark:bg-gray-750 rounded-full flex-shrink-0" />
          <div className="w-24 h-10 bg-gray-250 dark:bg-gray-750 rounded-full flex-shrink-0" />
          <div className="w-32 h-10 bg-gray-250 dark:bg-gray-750 rounded-full flex-shrink-0" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <SkeletonMenuCard />
          <SkeletonMenuCard />
          <SkeletonMenuCard />
          <SkeletonMenuCard />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Eksplor Menu</h1>
          <p className="text-muted mt-1">Pilih hidangan favorit Anda</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-3 h-5 w-5 text-muted" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari makanan..." 
            className="w-full pl-10 pr-4 py-2.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-full focus:ring-2 focus:ring-primary outline-none transition-shadow text-text-light dark:text-text-dark"
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide mb-6">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-6 py-2.5 rounded-full font-medium whitespace-nowrap transition-colors ${
            activeCategory === "all" 
            ? "bg-primary text-white shadow-md shadow-primary/20" 
            : "bg-card-light dark:bg-card-dark text-text-light dark:text-text-dark border border-border-light dark:border-border-dark hover:border-primary"
          }`}
        >
          Semua Menu
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-6 py-2.5 rounded-full font-medium whitespace-nowrap transition-colors ${
              activeCategory === cat.id 
              ? "bg-primary text-white shadow-md shadow-primary/20" 
              : "bg-card-light dark:bg-card-dark text-text-light dark:text-text-dark border border-border-light dark:border-border-dark hover:border-primary"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence>
          {filteredMenu.map(item => {
            const cartItem = items.find(i => i.id === item.id);
            const quantityInCart = cartItem ? cartItem.quantity : 0;

            return (
              <motion.div
                layout
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => !item.is_active && handleOutOfStockClick(item)}
                whileHover={{ y: item.is_active ? -8 : 0, boxShadow: item.is_active ? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" : "none" }}
                transition={{ type: "spring", bounce: 0.4 }}
                className={`bg-card-light dark:bg-card-dark rounded-2xl overflow-hidden border border-border-light dark:border-border-dark flex flex-col transition-all duration-300 ${
                  item.is_active ? "" : "opacity-60 grayscale cursor-pointer"
                }`}
              >
                <div className="relative h-48 w-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                  <Image
                    src={item.image_url || "https://placehold.co/400x300?text=Menu"}
                    alt={item.name}
                    fill
                    className="object-contain"
                  />
                  {!item.is_active && (
                    <div className="absolute top-3 left-3 z-10 bg-red-600 text-white font-black px-3.5 py-1.5 rounded-xl text-[10px] uppercase tracking-widest border border-white shadow-lg">
                      HABIS
                    </div>
                  )}
                  <button 
                    onClick={(e) => toggleFavorite(item.id, e)}
                    aria-label={favorites.includes(item.id) ? "Hapus dari Favorit" : "Tambah ke Favorit"}
                    title={favorites.includes(item.id) ? "Hapus dari Favorit" : "Tambah ke Favorit"}
                    className="absolute top-3 right-3 p-2 bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-full hover:scale-110 transition-transform z-10"
                  >
                    <Heart className={`w-5 h-5 ${favorites.includes(item.id) ? "fill-red-500 text-red-500" : "text-gray-700 dark:text-gray-200"}`} />
                  </button>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-text-light dark:text-text-dark leading-tight">{item.name}</h3>
                  </div>
                  <p className="text-muted text-sm mb-4 line-clamp-2 flex-1">{item.description}</p>
                  
                  <div className="flex items-center justify-between mt-auto">
                    <span className="font-bold text-lg text-primary">Rp {item.price.toLocaleString('id-ID')}</span>
                    {item.is_active ? (
                      quantityInCart > 0 ? (
                        <div className="flex items-center bg-gray-100/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-1 select-none">
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (quantityInCart === 1) {
                                removeItem(item.id);
                                toast.success(`${item.name} dihapus dari keranjang`);
                              } else {
                                updateQuantity(item.id, quantityInCart - 1);
                              }
                            }}
                            className="w-7 h-7 rounded-xl bg-gray-200/70 dark:bg-gray-700/70 text-gray-800 dark:text-gray-200 flex items-center justify-center font-extrabold text-sm hover:bg-gray-300/80 dark:hover:bg-gray-600/80 transition-colors"
                            aria-label="Kurangi Jumlah"
                            title="Kurangi"
                          >
                            -
                          </motion.button>
                          <span className="font-extrabold text-text-light dark:text-text-dark text-sm px-4 min-w-[32px] text-center">{quantityInCart}</span>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              updateQuantity(item.id, quantityInCart + 1);
                            }}
                            className="w-7 h-7 text-gray-800 dark:text-gray-200 flex items-center justify-center font-extrabold text-sm hover:text-primary transition-colors"
                            aria-label="Tambah Jumlah"
                            title="Tambah"
                          >
                            +
                          </motion.button>
                        </div>
                      ) : (
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => { e.stopPropagation(); handleAddToCart(item); }}
                          aria-label="Tambah ke Keranjang"
                          title="Tambah ke Keranjang"
                          className="p-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl transition-colors"
                        >
                          <Plus className="w-5 h-5" />
                        </motion.button>
                      )
                    ) : (
                      <span className="text-xs font-black uppercase text-red-500 tracking-wider">
                        Tidak Tersedia
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {filteredMenu.length === 0 && !loading && (
        <div className="text-center py-20">
          <ShoppingBag className="w-16 h-16 text-muted mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-medium text-text-light dark:text-text-dark">Menu tidak ditemukan</h3>
          <p className="text-muted mt-2">Coba ubah kata kunci pencarian atau kategori.</p>
        </div>
      )}

      {/* WARNING MODAL FOR OUT OF STOCK */}
      <BaseModal
        isOpen={!!outOfStockItem}
        onClose={() => { setOutOfStockItem(null); setClickCount(0); }}
        size="md"
        showCloseButton={false}
      >
        <div className="space-y-6 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <Ban className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="font-black text-xl text-text-light dark:text-text-dark">Menu Tidak Tersedia</h3>
            <p className="text-muted text-sm leading-relaxed">
              {clickCount > 2 ? (
                <span className="text-red-500 font-bold block">
                  Maaf, menu {outOfStockItem?.name} sudah habis dan tidak bisa ditambahkan ke pesanan Anda.
                </span>
              ) : (
                <span>
                  Menu <span className="font-bold text-primary">{outOfStockItem?.name}</span> sedang tidak tersedia saat ini. Silakan pilih menu lain atau hubungi kasir untuk informasi lebih lanjut.
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button 
              onClick={() => { setOutOfStockItem(null); setClickCount(0); }} 
              className="flex-1 py-3 border border-border-light dark:border-border-dark rounded-xl font-bold text-muted hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-xs uppercase"
            >
              Tutup
            </button>
            <button 
              onClick={() => { setOutOfStockItem(null); setClickCount(0); }} 
              className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white font-black rounded-xl transition-colors uppercase text-xs shadow-lg shadow-primary/20"
            >
              Lihat Menu Lain
            </button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
