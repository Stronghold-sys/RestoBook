"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function AdminTables() {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ table_number: 1, capacity: 2, status: "available" });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchTables();

    // Real-time: Listen for changes in tables
    const channel = supabase.channel('admin-tables-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
        fetchTables();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchTables = async () => {
    try {
      const { data, error } = await supabase.from('tables').select('*').order('table_number', { ascending: true });
      if (error) throw error;
      setTables(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat meja: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (table: any = null) => {
    if (table) {
      setEditingId(table.id);
      setFormData({ 
        table_number: table.table_number, 
        capacity: table.capacity, 
        status: table.status 
      });
    } else {
      setEditingId(null);
      const nextNum = tables.length > 0 ? Math.max(...tables.map(t => t.table_number)) + 1 : 1;
      setFormData({ table_number: nextNum, capacity: 4, status: "available" });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('tables').update(formData).eq('id', editingId);
        if (error) throw error;
        toast.success("Meja berhasil diperbarui");
      } else {
        const { error } = await supabase.from('tables').insert([formData]);
        if (error) throw error;
        toast.success("Meja berhasil ditambahkan");
      }
      setIsModalOpen(false);
      fetchTables();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('tables').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success("Meja berhasil dihapus");
      setDeleteId(null);
      fetchTables();
    } catch (error: any) {
      toast.error("Gagal menghapus meja: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'available': return 'bg-green-100 text-green-700';
      case 'occupied': return 'bg-red-100 text-red-700';
      case 'reserved': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Manajemen Meja</h1>
          <p className="text-muted mt-1">Atur meja dan kapasitas untuk Dine-in & Reservasi</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleOpenModal()}
          className="bg-primary text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/30"
        >
          <Plus className="w-5 h-5" /> Tambah Meja
        </motion.button>
      </div>

      <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark text-muted text-sm">
              <th className="p-4 font-medium w-24 text-center">No. Meja</th>
              <th className="p-4 font-medium text-center">Kapasitas</th>
              <th className="p-4 font-medium text-center">Status Saat Ini</th>
              <th className="p-4 font-medium text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {tables.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-muted">Belum ada meja.</td></tr>
            ) : (
              tables.map(table => (
                <tr key={table.id} className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="p-4 text-center font-bold text-lg text-text-light dark:text-text-dark">{table.table_number}</td>
                  <td className="p-4 text-center font-medium text-text-light dark:text-text-dark">{table.capacity} Orang</td>
                  <td className="p-4 text-center">
                    <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${getStatusColor(table.status)}`}>
                      {table.status}
                    </span>
                  </td>
                  <td className="p-4 text-center space-x-2">
                    <button onClick={() => handleOpenModal(table)} aria-label="Edit" title="Edit" className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors inline-block">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(table.id)} aria-label="Hapus" title="Hapus" className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors inline-block">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-card-light dark:bg-card-dark w-full max-w-sm rounded-2xl shadow-xl overflow-hidden p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-xl text-text-light dark:text-text-dark">{editingId ? 'Edit Meja' : 'Tambah Meja'}</h3>
                <button onClick={() => setIsModalOpen(false)} aria-label="Tutup" title="Tutup" className="text-muted hover:text-text-light dark:hover:text-text-dark"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label htmlFor="tableNumber" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">Nomor Meja</label>
                    <input id="tableNumber" title="Nomor Meja" required type="number" min={1} value={formData.table_number} onChange={e => setFormData({...formData, table_number: parseInt(e.target.value)})} className="w-full px-4 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:border-primary text-text-light dark:text-text-dark text-center font-bold" />
                  </div>
                  <div className="flex-1">
                    <label htmlFor="tableCapacity" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">Kapasitas (Orang)</label>
                    <input id="tableCapacity" title="Kapasitas" required type="number" min={1} value={formData.capacity} onChange={e => setFormData({...formData, capacity: parseInt(e.target.value)})} className="w-full px-4 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:border-primary text-text-light dark:text-text-dark text-center" />
                  </div>
                </div>
                <div>
                  <label htmlFor="tableStatus" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">Status</label>
                  <select id="tableStatus" title="Status" aria-label="Status" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:border-primary text-text-light dark:text-text-dark">
                    <option value="available">Available (Tersedia)</option>
                    <option value="occupied">Occupied (Terisi)</option>
                    <option value="reserved">Reserved (Dipesan)</option>
                  </select>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-lg font-medium bg-gray-100 dark:bg-gray-800 text-text-light dark:text-text-dark hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Batal</button>
                  <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg font-bold bg-primary text-white hover:bg-primary-hover transition-colors flex justify-center items-center gap-2">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Meja'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {deleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteId(null)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-card-light dark:bg-card-dark w-full max-w-sm rounded-2xl shadow-xl overflow-hidden p-6 text-center space-y-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-lg text-text-light dark:text-text-dark">Hapus Meja?</h3>
                <p className="text-sm text-muted">Apakah Anda yakin ingin menghapus meja ini? Tindakan ini tidak dapat dibatalkan.</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl font-medium bg-gray-100 dark:bg-gray-800 text-text-light dark:text-text-dark hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Batal</button>
                <button type="button" onClick={executeDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white transition-colors flex justify-center items-center gap-2">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ya, Hapus"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
