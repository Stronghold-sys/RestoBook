"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, CalendarDays, Bell, ArrowRight, Loader2, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { SkeletonDashboard } from "@/components/Skeleton";

export default function CustomerDashboard() {
  const [loading, setLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [upcomingReservations, setUpcomingReservations] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;

      const { data: profile } = await supabase.from('profiles').select('id, full_name').eq('user_id', session.session.user.id).single();
      if (!profile) return;

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
    </div>
  );
}
