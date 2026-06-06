"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ShoppingBag, Trash2, Loader2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCartStore } from "@/store/useCartStore";
import toast from "react-hot-toast";
import Image from "next/image";
import { SkeletonMenuCard } from "@/components/Skeleton";

interface FavoriteItem {
  id: string;
  menu_item_id: string;
  menu_items: { id: string; name: string; description: string; price: number; image_url: string; stock: number } | null;
}

export default function CustomerFavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const addItem = useCartStore(state => state.addItem);

  useEffect(() => { 
    fetchFavorites(); 

    const channel = supabase.channel("customer-favorites-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "favorites" }, () => {
        fetchFavorites();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchFavorites = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;
      const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", session.session.user.id).single();
      if (!profile) return;

      const { data } = await supabase.from("favorites").select("*, menu_items(*)").eq("customer_id", profile.id).order("created_at", { ascending: false });
      setFavorites(data || []);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const removeFav = async (favId: string) => {
    await supabase.from("favorites").delete().eq("id", favId);
    setFavorites(favorites.filter(f => f.id !== favId));
    toast.success("Dihapus dari favorit");
  };

  const addToCart = (item: FavoriteItem) => {
    if (!item.menu_items) return;
    addItem({ id: item.menu_items.id, name: item.menu_items.name, price: item.menu_items.price, quantity: 1, image_url: item.menu_items.image_url });
    toast.success(`${item.menu_items.name} ditambahkan ke keranjang`);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="mb-8 animate-pulse">
          <div className="h-8 bg-gray-250 dark:bg-gray-750 rounded-xl w-48 mb-2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-xl w-64" />
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
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Menu Favorit</h1>
        <p className="text-muted mt-1">Koleksi hidangan favorit Anda</p>
      </div>

      {favorites.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="w-16 h-16 text-muted mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-medium text-text-light dark:text-text-dark">Belum Ada Favorit</h3>
          <p className="text-muted mt-2">Tambahkan menu favorit Anda dari halaman Eksplor Menu.</p>
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence>
            {favorites.map((fav, i) => fav.menu_items && (
              <motion.div key={fav.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ delay: i * 0.05 }} whileHover={{ y: -8 }} className="bg-card-light dark:bg-card-dark rounded-2xl overflow-hidden border border-border-light dark:border-border-dark flex flex-col shadow-sm">
                <div className="relative h-48 w-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                  <Image src={fav.menu_items.image_url || "https://placehold.co/400x300"} alt={fav.menu_items.name} fill className="object-contain" />
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => removeFav(fav.id)} className="absolute top-3 right-3 p-2 bg-red-500 text-white rounded-full shadow-lg" aria-label="Hapus dari Favorit" title="Hapus dari Favorit">
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-bold text-lg text-text-light dark:text-text-dark">{fav.menu_items.name}</h3>
                  <p className="text-muted text-sm mb-4 line-clamp-2 flex-1">{fav.menu_items.description}</p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="font-bold text-lg text-primary">Rp {fav.menu_items.price.toLocaleString("id-ID")}</span>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => addToCart(fav)} className="p-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl transition-colors" aria-label="Tambah ke Keranjang" title="Tambah ke Keranjang">
                      <Plus className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
