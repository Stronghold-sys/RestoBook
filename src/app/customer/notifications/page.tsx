"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCheck, Loader2, ShoppingBag, CalendarDays, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface Notification {
  id: string; title: string; message: string; is_read: boolean; type: string; created_at: string;
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
      default: return <Info className="w-5 h-5 text-muted" />;
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

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
          <p className="text-muted mt-2">Notifikasi pesanan dan reservasi akan muncul di sini.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif, i) => (
            <motion.div key={notif.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className={`p-5 rounded-2xl border transition-colors ${!notif.is_read ? "bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30" : "bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark"}`}>
              <div className="flex gap-4">
                <div className={`p-2.5 rounded-xl shrink-0 ${!notif.is_read ? "bg-primary/10" : "bg-gray-100 dark:bg-gray-800"}`}>
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-semibold ${!notif.is_read ? "text-text-light dark:text-text-dark" : "text-muted"}`}>{notif.title}</h3>
                    {!notif.is_read && <div className="w-2.5 h-2.5 bg-primary rounded-full shrink-0 mt-1.5" />}
                  </div>
                  <p className="text-sm text-muted mt-1 leading-relaxed">{notif.message}</p>
                  <p className="text-xs text-muted/70 mt-2">{format(new Date(notif.created_at), "dd MMM yyyy, HH:mm", { locale: localeId })}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
