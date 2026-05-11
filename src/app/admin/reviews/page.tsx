"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, Loader2, MessageSquare, Check, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

const DUMMY_REVIEWS = [
  {
    id: "dummy-1",
    rating: 5,
    comment: "Makanannya sangat lezat! Nasi Goreng Spesialnya benar-benar juara. Bumbu meresap sempurna dan porsinya mengenyangkan. Pelayanan ramah dan cepat!",
    created_at: "2026-05-08T10:00:00.000Z",
    is_published: true,
    is_dummy: true,
    profiles: {
      full_name: "Budi Santoso",
      avatar_url: null
    }
  },
  {
    id: "dummy-2",
    rating: 5,
    comment: "Suasana restoran sangat nyaman dan bersih. Cocok sekali untuk makan malam bersama keluarga. Jus Alpukatnya sangat kental dan segar, porsi ayam bakar juga empuk sekali.",
    created_at: "2026-05-08T08:30:00.000Z",
    is_published: true,
    is_dummy: true,
    profiles: {
      full_name: "Siti Rahma",
      avatar_url: null
    }
  },
  {
    id: "dummy-3",
    rating: 4,
    comment: "Pelayanannya cepat sekali walaupun dalam keadaan ramai di akhir pekan. Sop Buntutnya gurih dan dagingnya empuk. Sangat direkomendasikan untuk pecinta kuliner!",
    created_at: "2026-05-07T15:45:00.000Z",
    is_published: false,
    is_dummy: true,
    profiles: {
      full_name: "Andi Wijaya",
      avatar_url: null
    }
  }
];

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchReviews();

    const channel = supabase.channel("realtime-admin-reviews")
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => {
        fetchReviews();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/reviews?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      const liveReviews = (json.data || []) as any[];

      // Ulasan dummy: pakai localStorage untuk status publish
      const storedStates = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("review-publish-states") || "{}") : {};

      setReviews((prev) => {
        const storedDummies = prev.filter(r => r.is_dummy);
        const initialDummies = storedDummies.length > 0 ? storedDummies : DUMMY_REVIEWS.map(d => ({ ...d, is_dummy: true }));
        
        const mappedDummies = initialDummies.map(d => ({
          ...d,
          is_published: storedStates[d.id] !== undefined ? storedStates[d.id] : d.is_published
        }));

        return [...liveReviews, ...mappedDummies.filter(d => !liveReviews.some((r: any) => r.id === d.id))];
      });
    } catch (e: any) { 
      toast.error(e.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleTogglePublish = async (id: string, currentPublished: boolean, isDummy = false) => {
    // Helper: kirim sinyal broadcast ke homepage agar langsung re-fetch
    const notifyHomepage = () => {
      const ch = supabase.channel('reviews-sync-signal');
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          ch.send({ type: 'broadcast', event: 'refresh', payload: {} }).then(() => supabase.removeChannel(ch));
        }
      });
    };

    if (isDummy) {
      const storedStates = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("review-publish-states") || "{}") : {};
      storedStates[id] = !currentPublished;
      if (typeof window !== 'undefined') {
        localStorage.setItem("review-publish-states", JSON.stringify(storedStates));
      }
      setReviews((prev) => prev.map(r => r.id === id ? { ...r, is_published: !currentPublished } : r));
      toast.success(currentPublished ? "Ulasan ditarik dari halaman utama" : "Ulasan berhasil dipublikasikan!");
      notifyHomepage();
      return;
    }

    const tToast = toast.loading(currentPublished ? "Menarik ulasan..." : "Mempublikasikan ulasan...");
    try {
      const res = await fetch('/api/reviews/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_published: !currentPublished })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal update');
      
      toast.success(currentPublished ? "Ulasan ditarik dari halaman utama" : "Ulasan berhasil dipublikasikan!", { id: tToast });
      fetchReviews();
      notifyHomepage();
    } catch (e: any) {
      toast.error("Gagal memperbarui: " + e.message, { id: tToast });
    }
  };

  const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : "0";

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Ulasan Pelanggan</h1>
        <p className="text-muted mt-1">{reviews.length} ulasan dari pelanggan</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div whileHover={{ y: -2 }} className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-6 text-white shadow-lg">
          <p className="text-white/80 text-sm">Rating Rata-rata</p>
          <div className="flex items-center gap-2 mt-2"><Star className="w-8 h-8 fill-white text-white border-none outline-none" /><span className="text-4xl font-bold">{avgRating}</span></div>
        </motion.div>
        <motion.div whileHover={{ y: -2 }} className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
          <p className="text-white/80 text-sm">Ulasan Positif (4-5 Bintang)</p>
          <p className="text-4xl font-bold mt-2">{reviews.filter(r => r.rating >= 4).length}</p>
        </motion.div>
        <motion.div whileHover={{ y: -2 }} className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl p-6 text-white shadow-lg">
          <p className="text-white/80 text-sm">Total Ulasan</p>
          <p className="text-4xl font-bold mt-2">{reviews.length}</p>
        </motion.div>
      </div>

      <div className="space-y-4">
        {reviews.map((review, i) => (
          <motion.div key={review.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark p-6 shadow-sm flex flex-col justify-between">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg shrink-0">
                {review.profiles?.full_name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-text-light dark:text-text-dark">{review.profiles?.full_name || "Anonim"}</h3>
                  <span className="text-xs text-muted">{format(new Date(review.created_at), "dd MMM yyyy", { locale: localeId })}</span>
                </div>
                <div className="flex gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={`w-4 h-4 ${s <= review.rating ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"}`} />
                  ))}
                </div>
                {review.comment && <p className="text-sm text-muted mt-3 leading-relaxed">{review.comment}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-light dark:border-border-dark">
              <div className="flex items-center gap-2">
                {review.is_dummy && (
                  <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 font-bold px-2 py-0.5 rounded-full uppercase">Dummy</span>
                )}
                {review.is_published ? (
                  <span className="text-xs bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Terbit di Utama</span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 font-bold px-2.5 py-1 rounded-full flex items-center gap-1"><EyeOff className="w-3.5 h-3.5" /> Draft</span>
                )}
              </div>
              <button 
                onClick={() => handleTogglePublish(review.id, review.is_published, review.is_dummy)} 
                className={`text-xs font-bold px-4 py-2 rounded-xl transition-all ${
                  review.is_published 
                    ? "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/20 dark:text-red-400" 
                    : "bg-primary text-white hover:bg-primary-hover shadow-md shadow-primary/10"
                }`}
              >
                {review.is_published ? "Tarik Ulasan" : "Terbitkan Ulasan"}
              </button>
            </div>
          </motion.div>
        ))}
        {reviews.length === 0 && (
          <div className="text-center py-20"><MessageSquare className="w-16 h-16 text-muted mx-auto mb-4 opacity-50" /><h3 className="text-xl font-medium text-text-light dark:text-text-dark">Belum Ada Ulasan</h3><p className="text-muted mt-2">Ulasan dari pelanggan akan tampil di sini.</p></div>
        )}
      </div>
    </div>
  );
}
