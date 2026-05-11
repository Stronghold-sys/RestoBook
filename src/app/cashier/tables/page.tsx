"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Armchair, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function TablesPage() {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTable, setUpdatingTable] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchTables();
    
    const tablesChannel = supabase.channel('tables_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        fetchTables();
      })
      .subscribe();

    // Fast backup sync poll (every 3 seconds) for instant table changes
    const interval = setInterval(() => {
      fetchTables();
    }, 3000);

    return () => {
      supabase.removeChannel(tablesChannel);
      clearInterval(interval);
    };
  }, []);

  const fetchTables = async () => {
    try {
      const { data } = await supabase.from("tables").select("*").order("table_number");
      setTables(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTableStatus = async (tableId: string, currentStatus: string) => {
    setUpdatingTable(tableId);
    try {
      const newStatus = currentStatus === "available" ? "occupied" : "available";
      const { error } = await supabase.from("tables").update({ status: newStatus }).eq("id", tableId);
      if (error) throw error;
      toast.success(`Meja ${newStatus === "available" ? "tersedia kembali" : "ditandai terisi"}`);
      fetchTables();
    } catch (e: any) {
      toast.error(e.message);
    } finally { 
      setUpdatingTable(null); 
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Status Meja</h1>
        <p className="text-muted mt-1">Kelola status dan kapasitas meja restoran</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {tables.map(table => (
          <div key={table.id} className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-4 ${table.status === 'available' ? 'border-green-500/20 bg-green-50/50 dark:bg-green-900/10' : 'border-amber-500/20 bg-amber-50/50 dark:bg-amber-900/10'}`}>
            <div className={`p-4 rounded-2xl ${table.status === 'available' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
              <Armchair className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="font-black text-xl text-text-light dark:text-text-dark">Meja {table.table_number}</p>
              <p className="text-xs text-muted font-bold uppercase mt-1">Kapasitas: {table.capacity}</p>
            </div>
            <div className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${table.status === 'available' ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'}`}>
              {table.status === 'available' ? 'Tersedia' : 'Terisi'}
            </div>
            <button 
              disabled={updatingTable === table.id}
              onClick={() => toggleTableStatus(table.id, table.status)} 
              className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${table.status === 'available' ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-green-500 text-white hover:bg-green-600'}`}
            >
              {updatingTable === table.id ? <Loader2 className="w-4 h-4 animate-spin" /> : table.status === 'available' ? 'Tandai Terisi' : 'Kosongkan Meja'}
            </button>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
