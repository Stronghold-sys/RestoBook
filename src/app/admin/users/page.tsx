"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, UserPlus, Search, Mail, Shield, Trash2, Loader2, X, Check, Key, FileText, Send, Eye, EyeOff, Lock, User as UserIcon, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import jsPDF from "jspdf";

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [showPassUser, setShowPassUser] = useState<any | null>(null);
  const [resetting, setResetting] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "cashier" as "admin" | "cashier",
  });

  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'primary';
  }>({
    show: false,
    title: "",
    message: "",
    onConfirm: () => {},
    type: 'primary'
  });

  const supabase = createClient();

  useEffect(() => {
    fetchUsers();

    // Real-time: Listen for changes in profiles (employees)
    const channel = supabase.channel('admin-users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['admin', 'cashier'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat data pengguna");
    } finally {
      setLoading(false);
    }
  };

  const generateEmployeeId = () => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `RB-${year}${month}-${random}`;
  };

  const generateTempPassword = () => {
    return Math.random().toString(36).slice(-8).toUpperCase();
  };

  const getCredentialBase64 = (emp: any) => {
    const doc = new jsPDF();
    doc.setFillColor(232, 93, 4);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("RestoBook - Akun Karyawan", 14, 25);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Selamat bergabung, ${emp.full_name}!`, 14, 55);
    doc.text("Berikut adalah data akun Anda untuk mengakses sistem RestoBook:", 14, 62);
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 70, 182, 50, 'F');
    doc.setFont("helvetica", "bold");
    doc.text("NO. ID KARYAWAN :", 20, 85);
    doc.text(emp.employee_id, 80, 85);
    doc.text("EMAIL LOGIN      :", 20, 95);
    doc.text(emp.email, 80, 95);
    doc.text("PASSWORD AWAL    :", 20, 105);
    doc.setTextColor(232, 93, 4);
    doc.text(emp.password, 80, 105);
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("*Harap segera ganti password Anda di menu profil setelah login.", 14, 130);
    doc.text("*Gunakan No. ID Karyawan atau Email Anda untuk masuk ke sistem.", 14, 136);
    return doc.output('datauristring').split(',')[1];
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    const tempPassword = generateTempPassword();
    const empId = generateEmployeeId();

    try {
      const pdfBase64 = getCredentialBase64({ 
        full_name: formData.fullName, 
        email: formData.email, 
        employee_id: empId, 
        password: tempPassword 
      });

      // 1. Create User via API
      const response = await fetch('/api/admin/create-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          employeeId: empId,
          password: tempPassword,
          pdfBase64: pdfBase64
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal membuat akun');

      toast.success("Karyawan berhasil ditambahkan & PDF dikirim ke email!");
      setShowAddModal(false);
      setFormData({ fullName: "", email: "", phone: "", role: "cashier" });
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };



  const generateCredentialPDF = (emp: any) => {
    const doc = new jsPDF();
    
    // Design
    doc.setFillColor(232, 93, 4);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("RestoBook - Akun Karyawan", 14, 25);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Selamat bergabung, ${emp.full_name}!`, 14, 55);
    doc.text("Berikut adalah data akun Anda untuk mengakses sistem RestoBook:", 14, 62);
    
    doc.setFillColor(245, 245, 245);
    doc.rect(14, 70, 182, 50, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.text("NO. ID KARYAWAN :", 20, 85);
    doc.text(emp.employee_id, 80, 85);
    
    doc.text("EMAIL LOGIN      :", 20, 95);
    doc.text(emp.email, 80, 95);
    
    doc.text("PASSWORD AWAL    :", 20, 105);
    doc.setTextColor(232, 93, 4);
    doc.text(emp.password, 80, 105);
    
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("*Harap segera ganti password Anda di menu profil setelah login.", 14, 130);
    doc.text("*Gunakan No. ID Karyawan atau Email Anda untuk masuk ke sistem.", 14, 136);

    doc.save(`Akun_${emp.employee_id}.pdf`);
  };

  const deleteEmployee = async (id: string) => {
    setConfirmModal({
      show: true,
      title: "Hapus Karyawan",
      message: "Apakah Anda yakin ingin menghapus karyawan ini? Seluruh data profil dan akun login akan dihapus permanen. Data transaksi akan tetap disimpan sebagai arsip tanpa nama kasir.",
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setLoading(true);
        try {
          const response = await fetch('/api/admin/delete-employee', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: id }),
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Gagal menghapus karyawan');

          toast.success("Karyawan berhasil dihapus secara permanen!");
          fetchUsers();
        } catch (e: any) {
          toast.error(e.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleResetPassword = async (user: any) => {
    setConfirmModal({
      show: true,
      title: "Reset Password",
      message: `Apakah Anda yakin ingin me-reset password untuk ${user.full_name}? Password baru akan otomatis dikirimkan ke WhatsApp karyawan tersebut.`,
      type: 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setResetting(true);
        const newPassword = generateTempPassword();

        try {
          const response = await fetch('/api/admin/reset-employee-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.user_id || user.id,
              newPassword
            }),
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Gagal reset password');

          toast.success("Password berhasil di-reset & dikirim ke WA!");
          // Update local state
          setUsers(prev => prev.map(u => u.id === user.id ? { ...u, temp_password: newPassword } : u));
          setShowPassUser({ ...user, temp_password: newPassword });
        } catch (error: any) {
          toast.error(error.message);
        } finally {
          setResetting(false);
        }
      }
    });
  };

  const filtered = users.filter(u => 
    u.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    u.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Manajemen Karyawan</h1>
          <p className="text-muted mt-1">Kelola akses admin dan kasir RestoBook</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowAddModal(true)}
          className="bg-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-primary/20"
        >
          <UserPlus className="w-5 h-5" /> Tambah Karyawan
        </motion.button>
      </div>

      <div className="bg-card-light dark:bg-card-dark rounded-3xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark flex flex-col md:flex-row justify-between gap-4 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
            <input 
              type="text" 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama atau ID..." 
              className="w-full pl-12 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: '900px' }}>
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-muted text-xs uppercase tracking-widest font-bold border-b border-border-light dark:border-border-dark">
                <th className="p-6 whitespace-nowrap">Identitas Karyawan</th>
                <th className="p-6 whitespace-nowrap">Role / Jabatan</th>
                <th className="p-6 whitespace-nowrap">Kontak</th>
                <th className="p-6 whitespace-nowrap">Tgl Bergabung</th>
                <th className="p-6 text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center text-muted">Tidak ada data karyawan ditemukan.</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id} className="border-b border-border-light dark:border-border-dark hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="p-6 whitespace-nowrap">
                    <div className="flex items-center gap-4 whitespace-nowrap">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-border-light dark:border-border-dark flex items-center justify-center shadow-sm flex-shrink-0">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-primary font-black text-lg">{u.full_name?.[0] || "?"}</span>
                        )}
                      </div>
                      <div className="whitespace-nowrap">
                        <p className="font-black text-text-light dark:text-text-dark whitespace-nowrap">{u.full_name}</p>
                        <p className="font-mono text-[10px] text-primary font-bold whitespace-nowrap">{u.employee_id || "GUEST-USER"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-6 whitespace-nowrap">
                    <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 w-fit whitespace-nowrap ${
                      u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                      u.role === 'cashier' ? 'bg-blue-100 text-blue-700' : 
                      'bg-green-100 text-green-700'
                    }`}>
                      {u.role === 'customer' ? <UserIcon className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                      {u.role}
                    </span>
                  </td>
                  <td className="p-6 whitespace-nowrap">
                    <div className="flex flex-col gap-1 whitespace-nowrap">
                      <p className="text-xs flex items-center gap-1.5 text-muted whitespace-nowrap"><Mail className="w-3 h-3" /> {u.email || "-"}</p>
                      <p className="text-xs text-muted whitespace-nowrap">{u.phone || "-"}</p>
                    </div>
                  </td>
                  <td className="p-6 text-sm text-muted whitespace-nowrap">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : "-"}
                  </td>
                  <td className="p-6 text-center whitespace-nowrap">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => setShowPassUser(u)}
                        className="p-2.5 bg-gray-100 dark:bg-gray-800 text-muted hover:bg-primary hover:text-white rounded-xl transition-all"
                        title="Lihat Kredensial"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleResetPassword(u)}
                        disabled={resetting}
                        className="p-2.5 bg-gray-100 dark:bg-gray-800 text-purple-600 hover:bg-purple-600 hover:text-white rounded-xl transition-all"
                        title="Reset Password"
                      >
                        {resetting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
                      </button>
                      <button onClick={() => deleteEmployee(u.id)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Hapus Karyawan">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-card-light dark:bg-card-dark w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
                <h3 className="font-black text-xl text-text-light dark:text-text-dark">Tambah Karyawan Baru</h3>
                <button onClick={() => setShowAddModal(false)} aria-label="Tutup" title="Tutup" className="p-2 text-muted hover:bg-gray-100 rounded-xl">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleAddEmployee} className="p-8 space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="empFullName" className="text-xs font-black uppercase text-muted ml-1">Nama Lengkap</label>
                  <input id="empFullName" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} type="text" className="w-full px-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all" placeholder="Contoh: Budi Santoso" title="Nama Lengkap" />
                </div>
 
                <div className="space-y-1.5">
                  <label htmlFor="empEmail" className="text-xs font-black uppercase text-muted ml-1">Alamat Email</label>
                  <input id="empEmail" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} type="email" className="w-full px-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all" placeholder="budi@email.com" title="Alamat Email" />
                </div>
 
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="roleSelect" className="text-xs font-black uppercase text-muted ml-1">Jabatan</label>
                    <select id="roleSelect" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})} className="w-full px-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all">
                      <option value="cashier">Kasir</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="empPhone" className="text-xs font-black uppercase text-muted ml-1">No. Telepon</label>
                    <input id="empPhone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} type="tel" className="w-full px-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all" placeholder="0812..." title="Nomor Telepon" />
                  </div>
                </div>
 
                <div className="bg-primary/5 p-5 rounded-2xl border border-primary/20 space-y-2">
                  <div className="flex items-center gap-2 text-primary">
                    <Key className="w-4 h-4" />
                    <p className="text-[10px] font-black uppercase tracking-wider">Info Keamanan Otomatis</p>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">Sistem akan secara otomatis membuatkan <b>ID Karyawan</b> dan <b>Password Sementara</b>. Setelah berhasil, Anda akan mengunduh file PDF data login untuk diberikan kepada karyawan.</p>
                </div>
 
                <button disabled={submitting} type="submit" className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm">
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Buat Akun Karyawan</>}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Credentials Modal */}
      <AnimatePresence>
        {showPassUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPassUser(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-card-light dark:bg-card-dark w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden">
              <div className="bg-primary p-6 text-white text-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="font-black text-xl uppercase">Akses Karyawan</h3>
                <p className="text-white/70 text-xs mt-1">{showPassUser.full_name}</p>
              </div>
              
              <div className="p-8 space-y-5">
                {/* Data Karyawan */}
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-border-light dark:border-border-dark">
                    <Mail className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-[9px] font-bold text-muted uppercase">Email</p>
                      <p className="text-xs font-bold text-text-light dark:text-text-dark">{showPassUser.email || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-border-light dark:border-border-dark">
                    <UserIcon className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-[9px] font-bold text-muted uppercase">Jabatan</p>
                      <p className="text-xs font-bold text-text-light dark:text-text-dark capitalize">{showPassUser.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-border-light dark:border-border-dark">
                    <Mail className="w-4 h-4 text-primary" /> {/* Replace with Phone icon if available */}
                    <div>
                      <p className="text-[9px] font-bold text-muted uppercase">No. Telepon</p>
                      <p className="text-xs font-bold text-text-light dark:text-text-dark">{showPassUser.phone || "-"}</p>
                    </div>
                  </div>
                </div>

                <hr className="border-dashed border-border-light dark:border-border-dark" />

                {/* Akses Login */}
                <div className="space-y-3">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-border-light dark:border-border-dark">
                    <p className="text-[10px] font-black uppercase text-muted mb-1 tracking-widest">No. ID Karyawan</p>
                    <p className="text-lg font-black font-mono text-text-light dark:text-text-dark">{showPassUser.employee_id || "-"}</p>
                  </div>
                  
                  <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 relative group">
                    <p className="text-[10px] font-black uppercase text-primary mb-1 tracking-widest">Password Sementara</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-lg font-black font-mono text-primary">
                        {showPassUser.temp_password || (
                          showPassUser.employee_id === "GUEST-USER" ? 
                          <span className="text-xs font-normal italic text-muted">Akses Admin Utama</span> :
                          <span className="text-xs font-normal italic text-green-500">Sudah diganti / Tidak tersedia</span>
                        )}
                      </p>
                      {(!showPassUser.temp_password && showPassUser.employee_id !== "GUEST-USER") && (
                        <button 
                          onClick={() => handleResetPassword(showPassUser)}
                          disabled={resetting}
                          className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary hover:text-white transition-all"
                          title="Reset Password"
                        >
                          {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setShowPassUser(null)}
                      className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-muted rounded-xl font-bold hover:bg-gray-200 transition-all text-sm"
                    >
                      Tutup
                    </button>
                    <button 
                      onClick={() => {
                        const text = `Data Akses Karyawan:\nNama: ${showPassUser.full_name}\nID: ${showPassUser.employee_id}\nEmail: ${showPassUser.email}\nPass: ${showPassUser.temp_password || 'Sudah diganti'}`;
                        navigator.clipboard.writeText(text);
                        toast.success("Info kredensial disalin!");
                      }}
                      className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-muted rounded-xl font-bold hover:bg-gray-200 transition-all text-sm"
                    >
                      Salin Teks
                    </button>
                  </div>
                  
                  <button 
                    onClick={async () => {
                      setSubmitting(true);
                      try {
                        const FONNTE_TOKEN = "CpJ7L8M8TfwCVy2k2m6C";
                        const cleanPhone = showPassUser.phone.replace(/[^0-9]/g, '');
                        const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('8') ? '62' + cleanPhone : cleanPhone);
                        
                        const waMessage = `*INFO AKSES LOGIN RESTOBOOK*\n\nHalo *${showPassUser.full_name}*,\n\nBerikut adalah pengingat data login Anda:\n\n*No. ID:* ${showPassUser.employee_id}\n*Email:* ${showPassUser.email}\n${showPassUser.temp_password ? `*Password:* ${showPassUser.temp_password}` : '*Password:* (Sudah Anda ubah)'}\n\nSilakan login kembali melalui aplikasi RestoBook.\n\nTerima kasih,\n*Admin RestoBook*`;

                        const response = await fetch('https://api.fonnte.com/send', {
                          method: 'POST',
                          headers: { 'Authorization': FONNTE_TOKEN },
                          body: new URLSearchParams({
                            'target': formattedPhone,
                            'message': waMessage,
                            'countryCode': '62'
                          })
                        });
                        const res = await response.json();
                        if (res.status) toast.success("Info login terkirim ke WhatsApp!");
                        else throw new Error(res.reason);
                      } catch (err: any) {
                        toast.error("Gagal kirim WA: " + err.message);
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                    disabled={submitting || !showPassUser.phone}
                    className="w-full py-4 bg-green-600 text-white rounded-2xl font-black shadow-xl shadow-green-600/20 hover:bg-green-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> Kirim Info Login ke WA</>}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Premium Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))} 
              className="absolute inset-0 bg-black/40 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative bg-white dark:bg-gray-900 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-white/20"
            >
              <div className={`p-8 text-center ${
                confirmModal.type === 'danger' ? 'bg-red-50 dark:bg-red-900/10' : 
                confirmModal.type === 'warning' ? 'bg-orange-50 dark:bg-orange-900/10' : 
                'bg-primary/5'
              }`}>
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg ${
                  confirmModal.type === 'danger' ? 'bg-red-500 text-white shadow-red-500/30' : 
                  confirmModal.type === 'warning' ? 'bg-orange-500 text-white shadow-orange-500/30' : 
                  'bg-primary text-white shadow-primary/30'
                }`}>
                  {confirmModal.type === 'danger' ? <Trash2 className="w-10 h-10" /> : 
                   confirmModal.type === 'warning' ? <RefreshCw className="w-10 h-10" /> : 
                   <Check className="w-10 h-10" />}
                </div>
                <h3 className="text-2xl font-black text-gray-900 dark:text-white leading-tight mb-2">{confirmModal.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed px-2">
                  {confirmModal.message}
                </p>
              </div>

              <div className="p-6 flex gap-3 bg-gray-50/50 dark:bg-gray-800/50">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 py-4 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-700 text-sm"
                >
                  Batal
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className={`flex-1 py-4 text-white rounded-2xl font-bold transition-all shadow-lg text-sm ${
                    confirmModal.type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 
                    confirmModal.type === 'warning' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 
                    'bg-primary hover:bg-primary-hover shadow-primary/20'
                  }`}
                >
                  Ya, Lanjutkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
