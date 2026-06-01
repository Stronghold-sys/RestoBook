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
  const [settings, setSettings] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchTables();
    fetchSettings();
    
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

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from("restaurant_settings").select("auto_empty_hours, auto_empty_minutes, auto_empty_seconds").single();
      if (data) {
        setSettings({
          hours: data.auto_empty_hours || 0,
          minutes: data.auto_empty_minutes || 0,
          seconds: data.auto_empty_seconds || 0,
        });
      }
    } catch (error) {
      console.error("Gagal memuat pengaturan meja:", error);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const { data: currentSettings } = await supabase.from("restaurant_settings").select("id").single();
      if (!currentSettings) throw new Error("Pengaturan belum diinisialisasi");

      const { error } = await supabase.from("restaurant_settings").update({
        auto_empty_hours: Number(settings.hours),
        auto_empty_minutes: Number(settings.minutes),
        auto_empty_seconds: Number(settings.seconds),
      }).eq("id", currentSettings.id);

      if (error) throw error;
      toast.success("Pengaturan waktu otomatis berhasil disimpan!");
    } catch (error: any) {
      toast.error("Gagal menyimpan: " + error.message);
    } finally {
      setSavingSettings(false);
    }
  };

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

      {/* Settings Form */}
      <form onSubmit={handleSaveSettings} className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-6 rounded-3xl mb-8 flex flex-col md:flex-row md:items-end gap-4 shadow-sm">
        <div className="flex-1 space-y-1">
          <label className="text-sm font-black text-text-light dark:text-text-dark uppercase tracking-wide">Auto-Kosongkan Meja Terisi</label>
          <p className="text-xs text-muted">Atur durasi agar meja yang terisi otomatis menjadi kosong jika kasir lupa mengubah statusnya.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-20">
            <label htmlFor="hours" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1">Jam</label>
            <input 
              id="hours"
              type="number" 
              min={0} 
              max={23} 
              value={settings.hours} 
              onChange={e => setSettings({ ...settings, hours: Math.max(0, parseInt(e.target.value) || 0) })}
              className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-3 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-primary font-bold"
            />
          </div>
          <span className="font-bold text-muted mt-5">:</span>
          <div className="w-20">
            <label htmlFor="minutes" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1">Menit</label>
            <input 
              id="minutes"
              type="number" 
              min={0} 
              max={59} 
              value={settings.minutes} 
              onChange={e => setSettings({ ...settings, minutes: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
              className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-3 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-primary font-bold"
            />
          </div>
          <span className="font-bold text-muted mt-5">:</span>
          <div className="w-20">
            <label htmlFor="seconds" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1">Detik</label>
            <input 
              id="seconds"
              type="number" 
              min={0} 
              max={59} 
              value={settings.seconds} 
              onChange={e => setSettings({ ...settings, seconds: Math.max(0, Math.min(59, parseInt(e.target.value) || 0)) })}
              className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-3 py-2 text-sm text-center outline-none focus:ring-2 focus:ring-primary font-bold"
            />
          </div>
        </div>
        <button 
          type="submit" 
          disabled={savingSettings}
          className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-black shadow-md shadow-primary/20 shrink-0 transition-all uppercase tracking-wider disabled:opacity-50 h-[38px] flex items-center justify-center gap-2"
        >
          {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : "Simpan Waktu"}
        </button>
      </form>

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
