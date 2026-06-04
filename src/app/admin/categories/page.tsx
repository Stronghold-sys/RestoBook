"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, X, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import BaseModal from "@/components/BaseModal";

export default function AdminCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", is_active: true, sort_order: 0 });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchCategories();

    const channel = supabase.channel("admin-categories-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => {
        fetchCategories();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat kategori: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (category: any = null) => {
    if (category) {
      setEditingId(category.id);
      setFormData({ 
        name: category.name, 
        description: category.description || "", 
        is_active: category.is_active, 
        sort_order: category.sort_order || 0 
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", description: "", is_active: true, sort_order: categories.length + 1 });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Nama kategori wajib diisi");

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('categories').update(formData).eq('id', editingId);
        if (error) throw error;
        toast.success("Kategori berhasil diperbarui");
      } else {
        const { error } = await supabase.from('categories').insert([formData]);
        if (error) throw error;
        toast.success("Kategori berhasil ditambahkan");
      }
      setIsModalOpen(false);
      fetchCategories();
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
      const { error } = await supabase.from('categories').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success("Kategori berhasil dihapus");
      setDeleteId(null);
      fetchCategories();
    } catch (error: any) {
      toast.error("Gagal menghapus kategori: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Kategori Menu</h1>
          <p className="text-muted mt-1">Kelola kategori makanan dan minuman</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => handleOpenModal()}
          className="bg-primary text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/30"
        >
          <Plus className="w-5 h-5" /> Tambah Kategori
        </motion.button>
      </div>

      <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: '800px' }}>
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark text-muted text-sm">
                <th className="p-4 font-medium w-16 text-center whitespace-nowrap">Urutan</th>
                <th className="p-4 font-medium whitespace-nowrap">Nama Kategori</th>
                <th className="p-4 font-medium whitespace-nowrap">Deskripsi</th>
                <th className="p-4 font-medium whitespace-nowrap">Status</th>
                <th className="p-4 font-medium text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-muted">Belum ada kategori.</td></tr>
              ) : (
                categories.map(cat => (
                  <tr key={cat.id} className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="p-4 text-center font-bold text-text-light dark:text-text-dark whitespace-nowrap">{cat.sort_order}</td>
                    <td className="p-4 font-bold text-text-light dark:text-text-dark whitespace-nowrap">{cat.name}</td>
                    <td className="p-4 text-sm text-muted max-w-xs truncate whitespace-nowrap">{cat.description || '-'}</td>
                    <td className="p-4 whitespace-nowrap">
                      {cat.is_active ? (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1 w-max whitespace-nowrap"><Check className="w-3 h-3" /> Aktif</span>
                      ) : (
                        <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-md font-bold flex items-center gap-1 w-max whitespace-nowrap"><X className="w-3 h-3" /> Tidak Aktif</span>
                      )}
                    </td>
                    <td className="p-4 text-center space-x-2 whitespace-nowrap">
                      <button onClick={() => handleOpenModal(cat)} aria-label="Edit" title="Edit" className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors inline-block">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(cat.id)} aria-label="Hapus" title="Hapus" className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors inline-block">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BaseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="md" title={editingId ? 'Edit Kategori' : 'Tambah Kategori'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="catName" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">Nama Kategori</label>
            <input id="catName" title="Nama Kategori" required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:border-primary text-text-light dark:text-text-dark" placeholder="Contoh: Minuman Dingin" />
          </div>
          <div>
            <label htmlFor="catDesc" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">Deskripsi (Opsional)</label>
            <textarea id="catDesc" title="Deskripsi Kategori" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:border-primary text-text-light dark:text-text-dark" placeholder="Keterangan kategori..." />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="sortOrder" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">Urutan Tampil</label>
              <input id="sortOrder" title="Urutan Tampil" type="number" min={1} value={formData.sort_order} onChange={e => setFormData({...formData, sort_order: parseInt(e.target.value)})} className="w-full px-4 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:border-primary text-text-light dark:text-text-dark" />
            </div>
            <div className="flex-1">
              <label htmlFor="isActive" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">Status Aktif</label>
              <select id="isActive" title="Status Aktif" aria-label="Status Aktif" value={formData.is_active ? 'true' : 'false'} onChange={e => setFormData({...formData, is_active: e.target.value === 'true'})} className="w-full px-4 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:border-primary text-text-light dark:text-text-dark">
                <option value="true">Aktif</option>
                <option value="false">Tidak Aktif</option>
              </select>
            </div>
          </div>
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 rounded-lg font-medium bg-gray-100 dark:bg-gray-800 text-text-light dark:text-text-dark hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Batal</button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg font-bold bg-primary text-white hover:bg-primary-hover transition-colors flex justify-center items-center gap-2">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Kategori'}
            </button>
          </div>
        </form>
      </BaseModal>

      <BaseModal isOpen={!!deleteId} onClose={() => setDeleteId(null)} size="sm">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <Trash2 className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="font-bold text-lg text-text-light dark:text-text-dark">Hapus Kategori?</h3>
            <p className="text-sm text-muted">Apakah Anda yakin ingin menghapus kategori ini? Tindakan ini tidak dapat dibatalkan.</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl font-medium bg-gray-100 dark:bg-gray-800 text-text-light dark:text-text-dark hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Batal</button>
            <button type="button" onClick={executeDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white transition-colors flex justify-center items-center gap-2">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ya, Hapus"}
            </button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
