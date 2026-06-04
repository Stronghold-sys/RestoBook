"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, X, CheckCheck, Trash2, Clock, CalendarDays, ShoppingBag, Award, Gift, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useActivityStore } from "@/store/useActivityStore";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  type: string;
  created_at: string;
  points?: number;
}

interface NotificationCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  profileId: string;
  role: string;
}

export default function NotificationCenterDrawer({
  isOpen,
  onClose,
  userId,
  profileId,
  role
}: NotificationCenterDrawerProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState<"notifications" | "activity">("notifications");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const drawerRef = useRef<HTMLDivElement>(null);
  
  // Read activity logs
  const logs = useActivityStore((state) => state.logs);
  const clearLogs = useActivityStore((state) => state.clearLogs);

  // Lock scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Trap focus
  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex="0"]'
    );
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          last?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first?.focus();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleTab);
    return () => window.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  // Fetch notifications
  const fetchNotifs = async () => {
    if (!profileId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profileId)
        .order("created_at", { ascending: false })
        .limit(20);
      setNotifications(data || []);
    } catch (e: any) {
      console.error("Error fetching notifications:", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && profileId) {
      fetchNotifs();
      
      const channel = supabase
        .channel(`notif-center-${profileId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${profileId}` }, () => {
          fetchNotifs();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, profileId]);

  const handleMarkAllRead = async () => {
    if (!profileId) return;
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", profileId)
        .eq("is_read", false);
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      toast.success("Semua notifikasi telah dibaca");
    } catch (e) {}
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "order": return <ShoppingBag className="w-4 h-4 text-primary" />;
      case "reservation": return <CalendarDays className="w-4 h-4 text-blue-500" />;
      case "point": return <Award className="w-4 h-4 text-orange-500" />;
      case "new_reward": return <Gift className="w-4 h-4 text-emerald-500" />;
      default: return <Info className="w-4 h-4 text-muted" />;
    }
  };

  const formatTimeAgo = (isoString: string) => {
    try {
      return formatDistanceToNow(new Date(isoString), { addSuffix: true, locale: localeId });
    } catch (e) {
      return "";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9990] flex justify-end">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
          />

          {/* Slide-out Panel */}
          <motion.div
            ref={drawerRef}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            className="relative w-full max-w-md bg-card-light dark:bg-card-dark border-l border-border-light dark:border-border-dark shadow-2xl h-full flex flex-col z-10 pointer-events-auto"
          >
            {/* Header */}
            <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-black text-text-light dark:text-text-dark uppercase tracking-wider">
                  Pusat Informasi
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-muted hover:text-text-light dark:hover:text-text-dark rounded-xl bg-gray-50 dark:bg-gray-800 transition-colors"
                title="Tutup"
                aria-label="Tutup Pusat Informasi"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Navigators */}
            <div className="px-6 py-4 border-b border-border-light dark:border-border-dark flex gap-2">
              <button
                onClick={() => setActiveTab("notifications")}
                className={`flex-1 py-3 text-xs font-black rounded-xl uppercase tracking-wider transition-all ${
                  activeTab === "notifications"
                    ? "bg-primary text-white shadow-lg shadow-primary/15"
                    : "bg-gray-50 dark:bg-gray-800 text-muted hover:text-text-light dark:hover:text-text-dark"
                }`}
              >
                Notifikasi
              </button>
              <button
                onClick={() => setActiveTab("activity")}
                className={`flex-1 py-3 text-xs font-black rounded-xl uppercase tracking-wider transition-all ${
                  activeTab === "activity"
                    ? "bg-primary text-white shadow-lg shadow-primary/15"
                    : "bg-gray-50 dark:bg-gray-800 text-muted hover:text-text-light dark:hover:text-text-dark"
                }`}
              >
                Aktivitas Saya
              </button>
            </div>

            {/* Content Lists */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {activeTab === "notifications" ? (
                // Notifications Tab
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-[10px] font-black uppercase text-muted">
                      {notifications.filter(n => !n.is_read).length} Baru
                    </span>
                    {notifications.some(n => !n.is_read) && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[10px] font-black uppercase text-primary hover:underline flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> Tandai Dibaca
                      </button>
                    )}
                  </div>

                  {loading && notifications.length === 0 ? (
                    <div className="text-center py-12 text-xs text-muted">Memuat notifikasi...</div>
                  ) : notifications.length === 0 ? (
                    <div className="text-center py-20 text-muted space-y-2">
                      <Bell className="w-12 h-12 mx-auto opacity-30 text-primary" />
                      <p className="font-bold text-sm">Tidak Ada Notifikasi</p>
                      <p className="text-xs max-w-[200px] mx-auto leading-relaxed">
                        Semua pemberitahuan pesanan dan info penting lainnya akan muncul di sini.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-4 rounded-xl border flex gap-3.5 transition-colors ${
                            !notif.is_read
                              ? "bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30"
                              : "bg-background-light/40 dark:bg-background-dark/20 border-border-light dark:border-border-dark"
                          }`}
                        >
                          <div className={`p-2 rounded-lg shrink-0 h-fit ${
                            !notif.is_read ? "bg-primary/10" : "bg-gray-100 dark:bg-gray-800"
                          }`}>
                            {getIcon(notif.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <h4 className={`font-bold text-xs ${!notif.is_read ? "text-text-light dark:text-text-dark" : "text-muted"}`}>
                                {notif.title}
                              </h4>
                              {!notif.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1" />}
                            </div>
                            <p className="text-[11px] text-muted mt-1 leading-relaxed">
                              {notif.message}
                            </p>
                            <span className="text-[9px] text-muted/65 block mt-2">
                              {formatTimeAgo(notif.created_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Activity Log Tab
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-[10px] font-black uppercase text-muted">
                      Total {logs.length} riwayat
                    </span>
                    {logs.length > 0 && (
                      <button
                        onClick={clearLogs}
                        className="text-[10px] font-black uppercase text-rose-500 hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Bersihkan
                      </button>
                    )}
                  </div>

                  {logs.length === 0 ? (
                    <div className="text-center py-20 text-muted space-y-2">
                      <Clock className="w-12 h-12 mx-auto opacity-30 text-primary" />
                      <p className="font-bold text-sm">Belum Ada Aktivitas</p>
                      <p className="text-xs max-w-[200px] mx-auto leading-relaxed">
                        Aksi yang Anda lakukan di dalam aplikasi (seperti mengubah profil) akan tercatat di sini.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className="p-4 rounded-xl border border-border-light dark:border-border-dark bg-background-light/40 dark:bg-background-dark/20 flex gap-3"
                        >
                          <div className="p-2 bg-gray-150 dark:bg-gray-800 rounded-lg h-fit text-muted">
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-xs text-text-light dark:text-text-dark">
                              {log.action}
                            </h4>
                            <p className="text-[11px] text-muted mt-1 leading-relaxed">
                              {log.details}
                            </p>
                            <span className="text-[9px] text-muted/65 block mt-2">
                              {formatTimeAgo(log.timestamp)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
