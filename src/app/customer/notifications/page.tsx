"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCheck, Loader2, ShoppingBag, CalendarDays, Info, Award, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { SkeletonOrderItem } from "@/components/Skeleton";

interface Notification {
  id: string; 
  title: string; 
  message: string; 
  is_read: boolean; 
  type: string; 
  created_at: string;
  points?: number;
  order_id?: string;
  status_badge?: string;
}

export default function CustomerNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => { 
    fetchNotifs(); 

    const channel = supabase.channel("customer-notifications-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        fetchNotifs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchNotifs = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;
      const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", session.session.user.id).single();
      if (!profile) return;
      const { data } = await supabase.from("notifications").select("*").eq("user_id", profile.id).order("created_at", { ascending: false });
      setNotifications(data || []);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  const markAllRead = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user) return;
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", session.session.user.id).single();
    if (!profile) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", profile.id).eq("is_read", false);
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    toast.success("Semua notifikasi telah dibaca");
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "order": return <ShoppingBag className="w-5 h-5 text-primary" />;
      case "reservation": return <CalendarDays className="w-5 h-5 text-blue-500" />;
      case "point": return <Award className="w-5 h-5 text-orange-500" />;
      case "new_reward": return <Gift className="w-5 h-5 text-emerald-500" />;
      default: return <Info className="w-5 h-5 text-muted" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "pending":
      case "pending reward":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-yellow-50 text-yellow-600 border border-yellow-100 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/50 uppercase">Pending</span>;
      case "menunggu dikonfirmasi":
      case "menunggu konfirmasi":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-amber-50 text-amber-600 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50 uppercase">Menunggu Konfirmasi</span>;
      case "menunggu untuk dibayar":
      case "menunggu dibayar":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-yellow-50 text-yellow-600 border border-yellow-100 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-900/50 uppercase">Menunggu Dibayar</span>;
      case "menunggu untuk dibayar ulang":
      case "menunggu dibayar ulang":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-orange-50 text-orange-600 border border-orange-100 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/50 uppercase">Bayar Ulang</span>;
      case "berhasil":
      case "reward masuk":
      case "redeem berhasil":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-emerald-50 text-emerald-600 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50 uppercase">Berhasil</span>;
      case "dibatalkan":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-red-50 text-red-600 border border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50 uppercase">Batal</span>;
      case "dikembalikan":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50 uppercase">Dikembalikan</span>;
      case "gagal":
      case "gagal redeem":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-rose-50 text-rose-600 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50 uppercase">Gagal</span>;
      case "baru":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50 uppercase">Baru</span>;
      case "dikonfirmasi":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-blue-50 text-blue-600 border border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50 uppercase">Dikonfirmasi</span>;
      case "proses":
      case "dalam proses":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/50 uppercase">Diproses</span>;
      case "siap":
      case "siap disajikan":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50 uppercase">Siap</span>;
      case "dikirim":
      case "shipping":
      case "dalam pengiriman":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-cyan-50 text-cyan-700 border border-cyan-100 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/50 uppercase">Dikirim</span>;
      case "selesai":
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-green-50 text-green-700 border border-green-100 dark:bg-green-950/20 dark:text-green-400 dark:border-green-900/50 uppercase">Selesai</span>;
      default:
        return <span className="px-2 py-0.5 text-[9px] font-black rounded bg-gray-50 text-gray-500 border border-gray-150 uppercase">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center mb-8 animate-pulse">
          <div className="space-y-2.5 w-48">
            <div className="h-8 bg-gray-250 dark:bg-gray-750 rounded-xl w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-xl w-1/2" />
          </div>
        </div>
        <div className="space-y-3">
          <SkeletonOrderItem />
          <SkeletonOrderItem />
          <SkeletonOrderItem />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Notifikasi</h1>
          <p className="text-muted mt-1">{notifications.filter(n => !n.is_read).length} belum dibaca</p>
        </div>
        {notifications.some(n => !n.is_read) && (
          <motion.button whileTap={{ scale: 0.95 }} onClick={markAllRead} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors">
            <CheckCheck className="w-4 h-4" /> Tandai Semua Dibaca
          </motion.button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-16 h-16 text-muted mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-medium text-text-light dark:text-text-dark">Belum Ada Notifikasi</h3>
          <p className="text-muted mt-2">Notifikasi pesanan, reservasi, dan reward point loyalitas akan muncul di sini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif, i) => (
            <motion.div key={notif.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className={`p-5 rounded-2xl border transition-colors ${!notif.is_read ? "bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30" : "bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark"}`}>
              <div className="flex gap-4 items-start">
                <div className={`p-2.5 rounded-xl shrink-0 ${!notif.is_read ? "bg-primary/10" : "bg-gray-100 dark:bg-gray-800"}`}>
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`font-semibold ${!notif.is_read ? "text-text-light dark:text-text-dark" : "text-muted"}`}>{notif.title}</h3>
                      {notif.status_badge && getStatusBadge(notif.status_badge)}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {notif.points !== undefined && notif.points !== null && (
                        <span className={`font-mono font-black text-xs px-2 py-0.5 rounded-md ${
                          notif.points > 0 
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400" 
                            : notif.points < 0 
                            ? "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400"
                            : "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-405"
                        }`}>
                          {notif.points > 0 ? `+${notif.points}` : notif.points} Point
                        </span>
                      )}
                      {!notif.is_read && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                    </div>
                  </div>
                  <p className="text-sm text-muted mt-1 leading-relaxed">{notif.message}</p>
                  
                  <div className="flex flex-wrap justify-between items-center gap-2 mt-2 pt-2 border-t border-gray-100/50 dark:border-gray-800/30 text-[10px] text-muted/70">
                    <span>{format(new Date(notif.created_at), "dd MMM yyyy, HH:mm", { locale: localeId })} WIB</span>
                    {notif.order_id && (
                      <span className="font-mono font-bold bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded text-muted">
                        Order ID: #{notif.order_id.substring(0, 8).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
