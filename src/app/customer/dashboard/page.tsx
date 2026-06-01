"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, CalendarDays, Bell, ArrowRight, Loader2, Clock, Gift, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { SkeletonDashboard } from "@/components/Skeleton";
import toast from "react-hot-toast";
import Portal from "@/components/Portal";

export default function CustomerDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [upcomingReservations, setUpcomingReservations] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // Welcome Gift Popup States
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [welcomePoints, setWelcomePoints] = useState(1000);
  const [claiming, setClaiming] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchDashboardData();

    const ordersChannel = supabase.channel("customer-dashboard-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        fetchDashboardData();
      })
      .subscribe();

    const reservationsChannel = supabase.channel("customer-dashboard-reservations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        fetchDashboardData();
      })
      .subscribe();

    const notificationsChannel = supabase.channel("customer-dashboard-notifications-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        fetchDashboardData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(reservationsChannel);
      supabase.removeChannel(notificationsChannel);
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      const { data: profile } = await supabase.from('profiles').select('id, full_name, welcome_gift_claimed').eq('user_id', session.session.user.id).single();
      if (!profile) return;

      // Clean up expired unpaid non-cash orders
      const { data: settings } = await supabase.from("restaurant_settings").select("payment_expiry_minutes, welcome_gift_enabled, welcome_gift_points").single();
      const expiryMinutes = settings?.payment_expiry_minutes ? Number(settings.payment_expiry_minutes) : 60;
      const expiryThreshold = new Date(Date.now() - expiryMinutes * 60 * 1000).toISOString();

      if (settings && settings.welcome_gift_enabled && !profile.welcome_gift_claimed) {
        setWelcomePoints(settings.welcome_gift_points || 1000);
        setShowWelcomeModal(true);
      }

      const { data: expiredOrders } = await supabase.from("orders")
        .select("id, table_id")
        .eq("payment_method", "non_cash")
        .eq("payment_status", "unpaid")
        .neq("status", "cancelled")
        .lt("created_at", expiryThreshold);

      if (expiredOrders && expiredOrders.length > 0) {
        const expiredIds = expiredOrders.map(o => o.id);
        const tableIdsToRelease = expiredOrders.filter(o => o.table_id).map(o => o.table_id);

        await supabase.from("orders")
          .update({ status: "cancelled", cancel_reason: "Batas waktu pembayaran habis (Batal Otomatis)" })
          .in("id", expiredIds);

        if (tableIdsToRelease.length > 0) {
          await supabase.from("tables")
            .update({ status: "available" })
            .in("id", tableIdsToRelease);
        }
      }

      // Fetch active orders
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', profile.id)
        .not('status', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: false });
      
      setActiveOrders(orders || []);

      // Fetch upcoming reservations
      const { data: reservations } = await supabase
        .from('reservations')
        .select(`*, tables(table_number)`)
        .eq('customer_id', profile.id)
        .in('status', ['pending', 'confirmed'])
        .gte('reservation_date', new Date().toISOString().split('T')[0])
        .order('reservation_date', { ascending: true })
        .limit(3);
      
      setUpcomingReservations(reservations || []);

      // Fetch notifications
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      setNotifications(notifs || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimPoints = async () => {
    setClaiming(true);
    try {
      const res = await fetch("/api/customer/claim-welcome-points", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengklaim poin");
      
      toast.success(`Selamat! ${welcomePoints.toLocaleString('id-ID')} Poin Reward berhasil diklaim.`);
      setShowWelcomeModal(false);
      fetchDashboardData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setClaiming(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500';
      case 'confirmed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-500';
      case 'processing': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-500';
      case 'ready': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case 'pending': return 'Menunggu Konfirmasi';
      case 'confirmed': return 'Dikonfirmasi';
      case 'processing': return 'Sedang Diproses';
      case 'ready': return 'Siap Disajikan';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Dashboard</h1>
          <p className="text-muted mt-1">Memuat ringkasan aktivitas Anda...</p>
        </div>
        <SkeletonDashboard />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Dashboard</h1>
        <p className="text-muted mt-1">Selamat datang kembali! Berikut ringkasan aktivitas Anda.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/customer/menu">
          <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-primary to-primary-hover p-6 rounded-2xl shadow-lg shadow-primary/20 text-white cursor-pointer h-full">
            <ShoppingBag className="w-8 h-8 mb-4 opacity-80" />
            <h3 className="text-xl font-bold mb-1">Pesan Makanan</h3>
            <p className="text-white/80 text-sm">Eksplor menu dan pesan sekarang</p>
          </motion.div>
        </Link>
        <Link href="/customer/reservations">
          <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-500/20 text-white cursor-pointer h-full">
            <CalendarDays className="w-8 h-8 mb-4 opacity-80" />
            <h3 className="text-xl font-bold mb-1">Reservasi Meja</h3>
            <p className="text-white/80 text-sm">Pesan meja untuk kunjungan Anda</p>
          </motion.div>
        </Link>
        <Link href="/customer/orders">
          <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 rounded-2xl shadow-lg shadow-emerald-500/20 text-white cursor-pointer h-full">
            <Clock className="w-8 h-8 mb-4 opacity-80" />
            <h3 className="text-xl font-bold mb-1">Riwayat Pesanan</h3>
            <p className="text-white/80 text-sm">Lihat pesanan Anda sebelumnya</p>
          </motion.div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active Orders */}
        <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-text-light dark:text-text-dark flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" /> Pesanan Aktif
            </h2>
            <Link href="/customer/orders" className="text-sm text-primary hover:underline flex items-center gap-1">
              Lihat Semua <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="space-y-4 flex-1">
            {activeOrders.length === 0 ? (
              <p className="text-muted text-sm text-center py-8 bg-background-light dark:bg-background-dark rounded-xl border border-dashed border-border-light dark:border-border-dark">Tidak ada pesanan aktif saat ini.</p>
            ) : (
              activeOrders.map(order => (
                <Link key={order.id} href={`/customer/orders/${order.id}`}>
                  <motion.div whileHover={{ x: 4 }} className="flex items-center justify-between p-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl cursor-pointer hover:border-primary/50 transition-colors">
                    <div>
                      <p className="font-semibold text-text-light dark:text-text-dark text-sm">No. Pesanan #{order.id.split('-')[0]}</p>
                      <p className="text-xs text-muted mt-1">{format(new Date(order.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary text-sm mb-2">Rp {order.total_amount.toLocaleString('id-ID')}</p>
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-md ${getStatusColor(order.status)}`}>
                        {getStatusText(order.status)}
                      </span>
                    </div>
                  </motion.div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Notifications & Reservations */}
        <div className="space-y-8 flex flex-col">
          <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-6">
            <h2 className="text-lg font-bold text-text-light dark:text-text-dark flex items-center gap-2 mb-6">
              <CalendarDays className="w-5 h-5 text-blue-500" /> Reservasi Mendatang
            </h2>
            <div className="space-y-4">
              {upcomingReservations.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">Tidak ada reservasi mendatang.</p>
              ) : (
                upcomingReservations.map(res => (
                  <div key={res.id} className="flex items-center gap-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                    <div className="bg-white dark:bg-card-dark p-3 rounded-lg text-center shadow-sm min-w-[60px]">
                      <p className="text-xs text-muted uppercase">{format(new Date(res.reservation_date), 'MMM', { locale: id })}</p>
                      <p className="text-xl font-bold text-blue-600">{format(new Date(res.reservation_date), 'dd')}</p>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-text-light dark:text-text-dark">Jam: {res.reservation_time.substring(0,5)}</p>
                      <p className="text-xs text-muted mt-1">{res.guest_count} Orang - Meja {res.tables?.table_number}</p>
                    </div>
                    <div className="ml-auto">
                      <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-md ${res.status === 'confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-500'}`}>
                        {res.status === 'confirmed' ? 'Dikonfirmasi' : 'Menunggu'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-6 flex-1">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                <Bell className="w-5 h-5 text-accent" /> Notifikasi Terbaru
              </h2>
            </div>
            <div className="space-y-4">
              {notifications.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">Belum ada notifikasi.</p>
              ) : (
                notifications.map(notif => (
                  <div key={notif.id} className="flex items-start gap-3 border-b border-border-light dark:border-border-dark last:border-0 pb-3 last:pb-0">
                    <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${!notif.is_read ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <div>
                      <p className="text-sm font-medium text-text-light dark:text-text-dark">{notif.title}</p>
                      <p className="text-xs text-muted mt-1 leading-relaxed">{notif.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Welcome Gift Modal */}
      <Portal>
        <AnimatePresence>
          {showWelcomeModal && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }} 
                animate={{ scale: 1, opacity: 1 }} 
                exit={{ scale: 0.9, opacity: 0 }} 
                className="bg-card-light dark:bg-card-dark rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-border-light dark:border-border-dark p-8 flex flex-col items-center text-center relative"
              >
                {/* Decorative top background gradient */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-primary to-rose-500" />
                
                <div className="w-20 h-20 bg-amber-100 dark:bg-amber-950/40 rounded-full flex items-center justify-center text-amber-500 mb-6 shadow-inner animate-bounce">
                  <Gift className="w-10 h-10" />
                </div>
                
                <h2 className="text-2xl font-black text-text-light dark:text-text-dark mb-2 flex items-center gap-1.5 justify-center">
                  Selamat Datang! <Sparkles className="w-5 h-5 text-amber-500 animate-pulse shrink-0" />
                </h2>
                
                <p className="text-muted text-sm leading-relaxed mb-6">
                  Terima kasih telah bergabung di RestoBook. Sebagai ucapan terima kasih spesial, dapatkan bonus poin cuma-cuma dari kami!
                </p>
                
                <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 px-6 py-4 rounded-2xl mb-8 flex flex-col items-center justify-center">
                  <span className="text-xs font-bold text-amber-500 uppercase tracking-widest mb-1">Bonus Akun Baru</span>
                  <span className="text-3xl font-black text-amber-500 font-mono">+{welcomePoints.toLocaleString('id-ID')} Poin</span>
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClaimPoints}
                  disabled={claiming}
                  className="w-full py-4 bg-gradient-to-r from-amber-500 to-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:from-amber-600 hover:to-primary-hover transition-all flex items-center justify-center gap-2 uppercase tracking-wide disabled:opacity-50"
                >
                  {claiming ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Klaim Poin Reward</>
                  )}
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>
    </div>
  );
}
