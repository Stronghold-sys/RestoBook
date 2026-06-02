"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";

export default function CashierQueue() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    fetchActiveOrders();

    const channel = supabase.channel('queue-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchActiveOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchActiveOrders = async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, tables(table_number)')
        .in('status', ['confirmed', 'processing', 'ready'])
        .order('created_at', { ascending: true });
      
      setOrders(data || []);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id, action: 'update_status', status: newStatus }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Gagal memperbarui status');
      }
      toast.success("Status diperbarui!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const columns = [
    { id: 'confirmed', title: 'Antrian Masuk', color: 'bg-blue-500', next: 'processing' },
    { id: 'processing', title: 'Sedang Dimasak', color: 'bg-purple-500', next: 'ready' },
    { id: 'ready', title: 'Siap Disajikan', color: 'bg-green-500', next: 'completed' },
  ];

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Antrian Dapur & Pesanan</h1>
        <p className="text-muted mt-1">Kelola progres pesanan secara real-time (Kanban Board)</p>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {columns.map(col => {
          const colOrders = orders.filter(o => o.status === col.id);
          return (
            <div key={col.id} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark flex flex-col overflow-hidden shadow-sm">
              <div className={`${col.color} text-white p-4 font-bold flex justify-between items-center`}>
                <span>{col.title}</span>
                <span className="bg-white/20 px-2.5 py-1 rounded text-sm">{colOrders.length}</span>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-background-light/50 dark:bg-background-dark/50">
                <AnimatePresence>
                  {colOrders.length === 0 ? (
                    <p className="text-center text-muted text-sm py-4">Kosong</p>
                  ) : (
                    colOrders.map(order => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        key={order.id}
                        className="bg-card-light dark:bg-card-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-text-light dark:text-text-dark">#{order.id.split('-')[0]}</span>
                          <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${order.order_type === 'dine_in' ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                            {order.order_type === 'dine_in' ? `Meja ${order.tables?.table_number}` : 'Takeaway'}
                          </span>
                        </div>
                        <p className="text-xs text-muted mb-4">{new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                        
                        <button
                          onClick={() => updateStatus(order.id, col.next)}
                          className={`w-full py-2 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity ${col.color}`}
                        >
                          Lanjut {col.next === 'completed' ? 'Selesai' : 'ke Tahap Berikutnya'} <ArrowRight className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
