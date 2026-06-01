"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, X, Loader2, Check, Search, Image as ImageIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import Image from "next/image";

export default function AdminMenu() {
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    category_id: "", 
    name: "", 
    description: "", 
    price: 0, 
    image_url: "", 
    is_active: true 
  });
  const [saving, setSaving] = useState(false);
  const [imageOption, setImageOption] = useState<"upload" | "url">("upload");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchData();

    const menuChannel = supabase.channel("admin-menu-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => {
        fetchData();
      })
      .subscribe();

    const categoriesChannel = supabase.channel("admin-menu-categories-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(categoriesChannel);
    };
  }, []);

  const fetchData = async () => {
    try {
      const [menuRes, catRes] = await Promise.all([
        supabase.from('menu_items').select('*, categories(name)').order('created_at', { ascending: false }),
        supabase.from('categories').select('id, name').eq('is_active', true).order('sort_order')
      ]);

      if (menuRes.error) throw menuRes.error;
      if (catRes.error) throw catRes.error;

      setMenuItems(menuRes.data || []);
      setCategories(catRes.data || []);
    } catch (error: any) {
      toast.error("Gagal memuat data menu: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item: any = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({ 
        category_id: item.category_id, 
        name: item.name, 
        description: item.description || "", 
        price: item.price,
        image_url: item.image_url || "",
        is_active: item.is_active
      });
      setImageOption(item.image_url ? "url" : "upload");
    } else {
      setEditingId(null);
      setFormData({ 
        category_id: categories.length > 0 ? categories[0].id : "", 
        name: "", 
        description: "", 
        price: 0, 
        image_url: "", 
        is_active: true 
      });
      setImageOption("upload");
    }
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    const uToast = toast.loading("Mengunggah gambar...");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("isProfile", "false");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal mengunggah gambar");

      setFormData((prev) => ({ ...prev, image_url: result.url }));
      toast.success("Gambar berhasil diunggah!", { id: uToast });
    } catch (err: any) {
      toast.error(err.message, { id: uToast });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category_id || formData.price <= 0) {
      return toast.error("Nama, Kategori, dan Harga (lebih dari 0) wajib diisi!");
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('menu_items').update(formData).eq('id', editingId);
        if (error) throw error;
        toast.success("Menu berhasil diperbarui");
      } else {
        const { error } = await supabase.from('menu_items').insert([formData]);
        if (error) throw error;
        toast.success("Menu berhasil ditambahkan");
      }
      setIsModalOpen(false);
      fetchData();
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
      const { error } = await supabase.from('menu_items').delete().eq('id', deleteId);
      if (error) throw error;
      toast.success("Menu berhasil dihapus");
      setDeleteId(null);
      fetchData();
    } catch (error: any) {
      toast.error("Gagal menghapus menu: " + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredMenu = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.categories?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Menu Makanan</h1>
          <p className="text-muted mt-1">Kelola daftar menu, harga, dan gambar</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari menu..." 
              className="w-full pl-10 pr-4 py-2 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleOpenModal()}
            className="bg-primary text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/30 shrink-0"
          >
            <Plus className="w-5 h-5" /> <span className="hidden sm:inline">Tambah Menu</span>
          </motion.button>
        </div>
      </div>

      <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark text-muted text-sm">
                <th className="p-4 font-medium w-16 text-center">Gambar</th>
                <th className="p-4 font-medium">Nama Menu</th>
                <th className="p-4 font-medium">Kategori</th>
                <th className="p-4 font-medium">Harga</th>
                <th className="p-4 font-medium text-center">Status</th>
                <th className="p-4 font-medium text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredMenu.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-muted">Belum ada menu ditemukan.</td></tr>
              ) : (
                filteredMenu.map(item => (
                  <tr key={item.id} className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="p-4 text-center">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 mx-auto">
                        {item.image_url ? (
                          <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-gray-400 absolute inset-0 m-auto" />
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-text-light dark:text-text-dark">{item.name}</p>
                      <p className="text-xs text-muted truncate max-w-[200px]">{item.description}</p>
                    </td>
                    <td className="p-4 text-sm text-text-light dark:text-text-dark">{item.categories?.name}</td>
                    <td className="p-4 font-bold text-primary">Rp {item.price.toLocaleString('id-ID')}</td>
                    <td className="p-4 text-center">
                      {item.is_active ? (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-md font-bold uppercase">Aktif</span>
                      ) : (
                        <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-md font-bold uppercase">Habis</span>
                      )}
                    </td>
                    <td className="p-4 text-center space-x-2 whitespace-nowrap">
                      <button onClick={() => handleOpenModal(item)} aria-label="Edit" title="Edit" className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors inline-block">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} aria-label="Hapus" title="Hapus" className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors inline-block">
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

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-card-light dark:bg-card-dark w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                <h3 className="font-bold text-xl text-text-light dark:text-text-dark">{editingId ? 'Edit Menu' : 'Tambah Menu Baru'}</h3>
                <button onClick={() => setIsModalOpen(false)} aria-label="Tutup" title="Tutup" className="text-muted hover:text-text-light dark:hover:text-text-dark"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="menuName" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">Nama Menu</label>
                    <input id="menuName" title="Nama Menu" required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:border-primary text-text-light dark:text-text-dark" placeholder="Contoh: Nasi Goreng Spesial" />
                  </div>
                  
                  <div>
                    <label htmlFor="menuCategory" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">Kategori</label>
                    <select id="menuCategory" title="Kategori" aria-label="Kategori" required value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})} className="w-full px-4 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:border-primary text-text-light dark:text-text-dark">
                      <option value="" disabled>-- Pilih Kategori --</option>
                      {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="menuPrice" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">Harga (Rp)</label>
                    <input id="menuPrice" title="Harga Menu" required type="number" min={0} value={formData.price} onChange={e => setFormData({...formData, price: parseInt(e.target.value) || 0})} className="w-full px-4 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:border-primary text-text-light dark:text-text-dark" placeholder="Contoh: 25000" />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="menuDesc" className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">Deskripsi</label>
                    <textarea id="menuDesc" title="Deskripsi Menu" rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:border-primary text-text-light dark:text-text-dark" placeholder="Deskripsi singkat menu..." />
                  </div>

                  <div className="sm:col-span-2 space-y-3">
                    <label className="block text-sm font-medium text-text-light dark:text-text-dark">Gambar Produk</label>
                    
                    {/* Tab Selector */}
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                      <button 
                        type="button" 
                        onClick={() => setImageOption("upload")} 
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                          imageOption === "upload" 
                            ? "bg-white dark:bg-gray-700 text-text-light dark:text-text-dark shadow-sm" 
                            : "text-muted hover:text-text-light dark:hover:text-text-dark"
                        }`}
                      >
                        Upload dari Perangkat
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setImageOption("url")} 
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                          imageOption === "url" 
                            ? "bg-white dark:bg-gray-700 text-text-light dark:text-text-dark shadow-sm" 
                            : "text-muted hover:text-text-light dark:hover:text-text-dark"
                        }`}
                      >
                        Gunakan Link URL
                      </button>
                    </div>

                    {imageOption === "upload" ? (
                      <div className="space-y-3">
                        {formData.image_url ? (
                          <div className="relative h-40 w-full rounded-xl overflow-hidden bg-gray-50 border border-border-light dark:border-border-dark flex items-center justify-center">
                            <Image src={formData.image_url} alt="Preview" fill className="object-cover" />
                            <button 
                              type="button" 
                              onClick={() => setFormData({ ...formData, image_url: "" })} 
                              className="absolute top-2 right-2 p-2 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-colors"
                              title="Hapus Gambar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border-light dark:border-border-dark rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all p-4 text-center">
                            {uploadingImage ? (
                              <Loader2 className="w-10 h-10 animate-spin text-primary" />
                            ) : (
                              <ImageIcon className="w-10 h-10 text-muted mb-2" />
                            )}
                            <span className="text-sm font-bold text-text-light dark:text-text-dark">
                              {uploadingImage ? "Mengunggah..." : "Klik untuk Pilih Gambar"}
                            </span>
                            <span className="text-xs text-muted mt-1">Format: JPG, PNG, WEBP (Maks 5MB)</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              disabled={uploadingImage} 
                              onChange={handleFileUpload} 
                              className="hidden" 
                            />
                          </label>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <input 
                          id="menuImage" 
                          title="URL Gambar" 
                          type="text" 
                          autoComplete="off"
                          value={formData.image_url} 
                          onChange={e => setFormData({...formData, image_url: e.target.value})} 
                          className="w-full px-4 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:border-primary text-text-light dark:text-text-dark text-sm" 
                          placeholder="Masukkan URL Gambar (https://...)" 
                        />
                        {formData.image_url && (
                          <div className="relative h-32 w-full rounded-xl overflow-hidden bg-gray-50 border border-border-light dark:border-border-dark">
                            <Image src={formData.image_url} alt="Link Preview" fill className="object-cover" />
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted leading-relaxed">Anda bisa membiarkan kosong untuk menggunakan gambar default otomatis dari sistem.</p>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">Status Tersedia</label>
                    <div className="flex gap-4">
                      <label htmlFor="statusActive" className="flex items-center gap-2 cursor-pointer">
                        <input id="statusActive" title="Aktif" aria-label="Aktif" type="radio" name="is_active" checked={formData.is_active} onChange={() => setFormData({...formData, is_active: true})} className="w-4 h-4 text-primary focus:ring-primary" />
                        <span className="text-sm text-text-light dark:text-text-dark">Aktif (Tersedia)</span>
                      </label>
                      <label htmlFor="statusInactive" className="flex items-center gap-2 cursor-pointer">
                        <input id="statusInactive" title="Tidak Aktif" aria-label="Tidak Aktif" type="radio" name="is_active" checked={!formData.is_active} onChange={() => setFormData({...formData, is_active: false})} className="w-4 h-4 text-red-500 focus:ring-red-500" />
                        <span className="text-sm text-text-light dark:text-text-dark">Tidak Aktif (Habis)</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl font-medium bg-gray-100 dark:bg-gray-800 text-text-light dark:text-text-dark hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Batal</button>
                  <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl font-bold bg-primary text-white hover:bg-primary-hover transition-colors flex justify-center items-center gap-2">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Simpan Menu'}
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
                <h3 className="font-bold text-lg text-text-light dark:text-text-dark">Hapus Menu?</h3>
                <p className="text-sm text-muted">Apakah Anda yakin ingin menghapus menu ini? Tindakan ini tidak dapat dibatalkan.</p>
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
