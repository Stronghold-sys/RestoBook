"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, UtensilsCrossed, ShoppingBag, DollarSign, Loader2, TrendingUp, Calendar } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { format, subDays, isSameDay } from "date-fns";
import { id as localeId } from "date-fns/locale";

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMenu: 0,
    totalOrders: 0,
    totalRevenue: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [orderTypes, setOrderTypes] = useState<any[]>([]);
  
  const supabase = createClient();

  useEffect(() => {
    fetchData();

    const channel = supabase.channel('admin-dashboard-realtime-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = async () => {
    try {
      const [users, menu, orders] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('menu_items').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('total_amount, payment_status, created_at, order_type')
      ]);

      const allOrders = orders.data || [];
      const revenue = allOrders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + o.total_amount, 0) || 0;

      // Stats
      setStats({
        totalUsers: users.count || 0,
        totalMenu: menu.count || 0,
        totalOrders: allOrders.length || 0,
        totalRevenue: revenue
      });

      // Revenue Chart (Last 7 Days)
      const last7Days = Array.from({ length: 7 }).map((_, i) => subDays(new Date(), 6 - i));
      const dailyData = last7Days.map(date => {
        const dayOrders = allOrders.filter(o => o.payment_status === 'paid' && isSameDay(new Date(o.created_at), date));
        const dayTotal = dayOrders.reduce((sum, o) => sum + o.total_amount, 0);
        return {
          date: format(date, 'dd MMM', { locale: localeId }),
          pendapatan: dayTotal
        };
      });
      setChartData(dailyData);

      // Order Type Stats
      const dineIn = allOrders.filter(o => o.order_type === 'dine_in').length;
      const takeaway = allOrders.filter(o => o.order_type === 'takeaway').length;
      setOrderTypes([
        { name: 'Dine In', value: dineIn, color: '#e85d04' },
        { name: 'Takeaway', value: takeaway, color: '#3b82f6' }
      ]);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Admin Dashboard</h1>
        <p className="text-muted mt-1">Ringkasan performa RestoBook secara real-time.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Pengguna", value: stats.totalUsers, icon: Users, color: "blue" },
          { label: "Menu Makanan", value: stats.totalMenu, icon: UtensilsCrossed, color: "yellow" },
          { label: "Total Pesanan", value: stats.totalOrders, icon: ShoppingBag, color: "green" },
          { label: "Total Pendapatan", value: `Rp ${(stats.totalRevenue/1000).toFixed(0)}k`, icon: DollarSign, color: "primary" },
        ].map((item, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            whileHover={{ y: -4 }} 
            className="bg-card-light dark:bg-card-dark p-6 rounded-3xl shadow-sm border border-border-light dark:border-border-dark flex items-center gap-4"
          >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${item.color === 'primary' ? 'bg-primary/10 text-primary' : `bg-${item.color}-100 text-${item.color}-600 dark:bg-${item.color}-900/30`}`}>
              <item.icon className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-wider mb-1">{item.label}</p>
              <h3 className="text-2xl font-black text-text-light dark:text-text-dark">{item.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card-light dark:bg-card-dark p-8 rounded-3xl shadow-sm border border-border-light dark:border-border-dark">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-lg text-text-light dark:text-text-dark flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Tren Pendapatan 7 Hari
            </h3>
            <span className="text-xs font-bold text-muted flex items-center gap-1"><Calendar className="w-3 h-3" /> Real-time Updates</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e85d04" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#e85d04" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF', fontWeight: 'bold' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF', fontWeight: 'bold' }} tickFormatter={(val) => `Rp ${val/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', background: '#fff' }}
                  itemStyle={{ fontWeight: 'bold', color: '#e85d04' }}
                />
                <Area type="monotone" dataKey="pendapatan" stroke="#e85d04" strokeWidth={4} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card-light dark:bg-card-dark p-8 rounded-3xl shadow-sm border border-border-light dark:border-border-dark flex flex-col">
          <h3 className="font-black text-lg text-text-light dark:text-text-dark mb-8">Tipe Pesanan</h3>
          <div className="flex-1 flex items-center justify-center min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orderTypes}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                <YAxis hide />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} barSize={40}>
                  {orderTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-6">
            {orderTypes.map((type, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-center">
                <p className="text-[10px] font-bold text-muted uppercase mb-1">{type.name}</p>
                <p className="text-xl font-black text-text-light dark:text-text-dark">{type.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
