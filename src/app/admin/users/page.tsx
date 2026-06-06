"use client";

export const runtime = 'edge';

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, UserPlus, Search, Mail, Shield, Trash2, Loader2, X, Check, 
  Key, FileText, Send, Eye, Lock, User as UserIcon, RefreshCw, 
  Upload, RotateCw, ZoomIn, Heart, BookOpen, MapPin, DollarSign, 
  Briefcase, Calendar, Info, Edit, CheckCircle, Ban
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import BaseModal from "@/components/BaseModal";
import { downloadFile } from "@/utils/downloadHelper";

export default function AdminUsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [showPassUser, setShowPassUser] = useState<any | null>(null);
  const [resetting, setResetting] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  
  // Form navigation tab
  const [activeFormTab, setActiveFormTab] = useState<'pribadi' | 'pekerjaan' | 'akun' | 'darurat' | 'pendidikan'>('pribadi');

  // Form State
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    role: "cashier" as "admin" | "cashier",
    nickname: "",
    gender: "Laki-laki",
    birthPlace: "",
    birthDate: "",
    religion: "Islam",
    maritalStatus: "Belum Kawin",
    nik: "",
    noKk: "",
    whatsapp: "",
    address: "",
    rt: "",
    rw: "",
    village: "",
    district: "",
    city: "",
    province: "",
    postalCode: "",
    jobTitle: "",
    division: "",
    department: "",
    workShift: "Pagi",
    placementLocation: "",
    directManager: "",
    basicSalary: "",
    allowances: "",
    workStatus: "aktif" as "aktif" | "resign" | "dipecat",
    username: "",
    accessRights: [] as string[],
    accountStatus: "aktif" as "aktif" | "nonaktif",
    emergencyName: "",
    emergencyRelation: "",
    emergencyPhone: "",
    emergencyAddress: "",
    lastEducation: "SMA/SMK",
    schoolName: "",
    major: "",
    graduationYear: "",
    certifications: "",
    skills: "",
    additionalNotes: "",
    avatarUrl: ""
  });

  // Image upload and crop states
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [croppedImageBase64, setCroppedImageBase64] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  const handleEditClick = (user: any) => {
    setEditingUserId(user.user_id || user.id);
    setFormData({
      fullName: user.full_name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || "cashier",
      nickname: user.nickname || "",
      gender: user.gender || "Laki-laki",
      birthPlace: user.birth_place || "",
      birthDate: user.birth_date ? user.birth_date.split('T')[0] : "",
      religion: user.religion || "Islam",
      maritalStatus: user.marital_status || "Belum Kawin",
      nik: user.nik || "",
      noKk: user.no_kk || "",
      whatsapp: user.whatsapp || "",
      address: user.address || "",
      rt: user.rt || "",
      rw: user.rw || "",
      village: user.village || "",
      district: user.district || "",
      city: user.city || "",
      province: user.province || "",
      postalCode: user.postal_code || "",
      jobTitle: user.job_title || "",
      division: user.division || "",
      department: user.department || "",
      workShift: user.work_shift || "Pagi",
      placementLocation: user.placement_location || "",
      directManager: user.direct_manager || "",
      basicSalary: String(user.basic_salary || ""),
      allowances: String(user.allowances || ""),
      workStatus: (user.work_status || "aktif") as any,
      username: user.username || "",
      accessRights: user.access_rights || [],
      accountStatus: (user.account_status || "aktif") as any,
      emergencyName: user.emergency_name || "",
      emergencyRelation: user.emergency_relation || "",
      emergencyPhone: user.emergency_phone || "",
      emergencyAddress: user.emergency_address || "",
      lastEducation: user.last_education || "SMA/SMK",
      schoolName: user.school_name || "",
      major: user.major || "",
      graduationYear: user.graduation_year || "",
      certifications: user.certifications || "",
      skills: user.skills || "",
      additionalNotes: user.additional_notes || "",
      avatarUrl: user.avatar_url || ""
    });
    setPreviewUrl(user.avatar_url || "");
    setCroppedImageBase64(null);
    setActiveFormTab('pribadi');
    setShowAddModal(true);
  };

  const handleOpenAddModal = () => {
    setEditingUserId(null);
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      role: "cashier",
      nickname: "",
      gender: "Laki-laki",
      birthPlace: "",
      birthDate: "",
      religion: "Islam",
      maritalStatus: "Belum Kawin",
      nik: "",
      noKk: "",
      whatsapp: "",
      address: "",
      rt: "",
      rw: "",
      village: "",
      district: "",
      city: "",
      province: "",
      postalCode: "",
      jobTitle: "",
      division: "",
      department: "",
      workShift: "Pagi",
      placementLocation: "",
      directManager: "",
      basicSalary: "",
      allowances: "",
      workStatus: "aktif",
      username: "",
      accessRights: [],
      accountStatus: "aktif",
      emergencyName: "",
      emergencyRelation: "",
      emergencyPhone: "",
      emergencyAddress: "",
      lastEducation: "SMA/SMK",
      schoolName: "",
      major: "",
      graduationYear: "",
      certifications: "",
      skills: "",
      additionalNotes: "",
      avatarUrl: ""
    });
    setPreviewUrl("");
    setCroppedImageBase64(null);
    setActiveFormTab('pribadi');
    setShowAddModal(true);
  };

  // Canvas Image Cropping Logic
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Ukuran file tidak boleh lebih dari 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setRawImageSrc(reader.result as string);
        setZoom(1);
        setRotation(0);
        setIsEditingImage(true);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (isEditingImage && rawImageSrc) {
      drawCanvas();
    }
  }, [isEditingImage, rawImageSrc, zoom, rotation]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !rawImageSrc) return;

    const img = new Image();
    img.src = rawImageSrc;
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;

      ctx.clearRect(0, 0, 300, 300);
      
      // Draw standard circle mask for crop helper
      ctx.save();
      ctx.beginPath();
      ctx.arc(150, 150, 140, 0, Math.PI * 2);
      ctx.clip();

      ctx.translate(150, 150);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(zoom, zoom);

      const size = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - size) / 2,
        (img.height - size) / 2,
        size,
        size,
        -150,
        -150,
        300,
        300
      );
      
      ctx.restore();
    };
  };

  const handleApplyCrop = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);
      setPreviewUrl(croppedBase64);
      setCroppedImageBase64(croppedBase64);
      setIsEditingImage(false);
      toast.success("Foto berhasil disunting!");
    }
  };

  // Convert Base64 dataURL to Blob File
  const dataURLtoFile = (dataurl: string, filename: string) => {
    let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)![1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const toastId = toast.loading(editingUserId ? "Sedang memperbarui karyawan..." : "Sedang membuat karyawan...");
    
    try {
      let finalAvatarUrl = previewUrl;

      // 1. Upload cropped photo if new image exists
      if (croppedImageBase64) {
        const fileToUpload = dataURLtoFile(croppedImageBase64, 'avatar.jpg');
        const uploadForm = new FormData();
        uploadForm.append('file', fileToUpload);
        uploadForm.append('isProfile', 'true');
        uploadForm.append('bucket', 'profiles');
        uploadForm.append('userId', editingUserId || 'temp_' + Date.now());

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: uploadForm
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "Gagal mengunggah foto");
        finalAvatarUrl = uploadData.url;
      }

      const bodyData = {
        ...formData,
        userId: editingUserId,
        avatarUrl: finalAvatarUrl,
        basicSalary: formData.basicSalary ? Number(formData.basicSalary) : 0,
        allowances: formData.allowances ? Number(formData.allowances) : 0,
      };

      const url = editingUserId ? '/api/admin/update-employee' : '/api/admin/create-employee';
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal menyimpan data');

      toast.success(editingUserId ? "Data karyawan berhasil diperbarui!" : "Akun karyawan berhasil dibuat!", { id: toastId });
      setShowAddModal(false);
      
      // If creating new employee, download credential PDF and show details popup
      if (!editingUserId && result.employee) {
        setShowPassUser(result.employee);
        if (result.employee.pdfBase64) {
          try {
            await downloadFile({
              dataBase64: result.employee.pdfBase64,
              filename: `Akun_${result.employee.employee_id}.pdf`,
              mimeType: 'application/pdf'
            });
            toast.success("PDF Kredensial diunduh otomatis.");
          } catch (pdfErr) {
            console.error(pdfErr);
            toast.error("Gagal mengunduh PDF");
          }
        }
      }

      fetchUsers();
    } catch (error: any) {
      toast.error(error.message, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const deleteEmployee = async (id: string) => {
    const userToDel = users.find(u => u.id === id);
    setConfirmModal({
      show: true,
      title: "Hapus Karyawan",
      message: `Apakah Anda yakin ingin menghapus karyawan ${userToDel?.full_name}? Seluruh data profil dan akun login akan dihapus permanen. Data transaksi akan tetap disimpan sebagai arsip tanpa nama kasir.`,
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setLoading(true);
        const toastId = toast.loading("Sedang menghapus karyawan...");
        try {
          const response = await fetch('/api/admin/delete-employee', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: id }),
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Gagal menghapus karyawan');

          toast.success("Karyawan berhasil dihapus secara permanen!", { id: toastId });
          fetchUsers();
        } catch (e: any) {
          toast.error(e.message, { id: toastId });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleResetPassword = async (user: any) => {
    setConfirmModal({
      show: true,
      title: "Reset Password Karyawan",
      message: `Apakah Anda yakin ingin me-reset password untuk ${user.full_name}? Password baru yang acak dan aman akan otomatis dikirimkan ke WhatsApp/Email karyawan tersebut.`,
      type: 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, show: false }));
        setResetting(true);
        const toastId = toast.loading("Sedang mereset sandi...");

        // Generate password following logic constraints (upper, lower, num, symbol)
        const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const lower = "abcdefghijklmnopqrstuvwxyz";
        const numbers = "0123456789";
        const symbols = "!@#$%^&*";
        
        let newPassword = "";
        newPassword += upper[Math.floor(Math.random() * upper.length)];
        newPassword += lower[Math.floor(Math.random() * lower.length)];
        newPassword += numbers[Math.floor(Math.random() * numbers.length)];
        newPassword += symbols[Math.floor(Math.random() * symbols.length)];
        
        const allChars = upper + lower + numbers + symbols;
        for (let i = 0; i < 6; i++) {
          newPassword += allChars[Math.floor(Math.random() * allChars.length)];
        }
        newPassword = newPassword.split('').sort(() => 0.5 - Math.random()).join('');

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

          toast.success("Password berhasil di-reset & dikirim!", { id: toastId });
          setUsers(prev => prev.map(u => u.id === user.id ? { ...u, temp_password: newPassword } : u));
          setShowPassUser({ ...user, temp_password: newPassword });
        } catch (error: any) {
          toast.error(error.message, { id: toastId });
        } finally {
          setResetting(false);
        }
      }
    });
  };

  const filtered = users.filter(u => 
    u.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    u.employee_id?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase()) ||
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-gray-800 p-8 rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-black text-text-light dark:text-text-dark tracking-tight">Manajemen Karyawan</h1>
          </div>
          <p className="text-muted text-sm font-medium">Kelola data profil, jabatan, hak akses, dan notifikasi akun karyawan RestoBook secara real-time</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleOpenAddModal}
          className="bg-primary text-white px-6 py-3.5 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-primary/20 text-sm"
        >
          <UserPlus className="w-5 h-5" /> Tambah Karyawan
        </motion.button>
      </div>

      {/* Main Table */}
      <div className="bg-card-light dark:bg-card-dark rounded-[2.5rem] shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark flex flex-col md:flex-row justify-between gap-4 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
            <input 
              type="text" 
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama, ID, username..." 
              className="w-full pl-12 pr-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm font-medium"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: '1000px' }}>
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-muted text-xs uppercase tracking-widest font-black border-b border-border-light dark:border-border-dark">
                <th className="p-6 whitespace-nowrap">Identitas Karyawan</th>
                <th className="p-6 whitespace-nowrap">Role & Jabatan</th>
                <th className="p-6 whitespace-nowrap">Kontak</th>
                <th className="p-6 whitespace-nowrap">Status Kerja</th>
                <th className="p-6 text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-20 text-center text-muted font-bold">Tidak ada data karyawan ditemukan.</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id} className="border-b border-border-light dark:border-border-dark hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors">
                  <td className="p-6 whitespace-nowrap">
                    <div className="flex items-center gap-4 whitespace-nowrap">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-border-light dark:border-border-dark flex items-center justify-center shadow-inner flex-shrink-0">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-primary font-black text-xl">{u.full_name?.[0] || "?"}</span>
                        )}
                      </div>
                      <div className="whitespace-nowrap">
                        <p className="font-black text-text-light dark:text-text-dark text-base whitespace-nowrap">{u.full_name}</p>
                        <div className="flex gap-2 items-center mt-0.5">
                          <span className="font-mono text-[10px] text-primary font-bold whitespace-nowrap">{u.employee_id || "KRY-GUEST"}</span>
                          <span className="text-muted text-[10px] whitespace-nowrap">@{u.username || "tanpa_username"}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-6 whitespace-nowrap">
                    <div className="space-y-1">
                      <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 w-fit whitespace-nowrap ${
                        u.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 
                        'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>
                        <Shield className="w-3.5 h-3.5" />
                        {u.role}
                      </span>
                      {u.job_title && (
                        <p className="text-xs font-bold text-muted capitalize">{u.job_title}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-6 whitespace-nowrap">
                    <div className="flex flex-col gap-1 whitespace-nowrap text-xs">
                      <p className="flex items-center gap-1.5 text-muted font-bold whitespace-nowrap"><Mail className="w-3.5 h-3.5 text-primary" /> {u.email || "-"}</p>
                      <p className="text-muted font-medium whitespace-nowrap">{u.phone || "-"}</p>
                    </div>
                  </td>
                  <td className="p-6 whitespace-nowrap">
                    <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 w-fit whitespace-nowrap ${
                      u.work_status === 'aktif' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 
                      u.work_status === 'resign' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 
                      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {u.work_status === 'aktif' ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                      {u.work_status || "aktif"}
                    </span>
                  </td>
                  <td className="p-6 text-center whitespace-nowrap">
                    {u.role === 'admin' ? (
                      // Aksi disembunyikan untuk role admin demi keamanan sistem
                      <span className="text-[10px] text-muted font-bold uppercase tracking-widest opacity-40">—</span>
                    ) : (
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => handleEditClick(u)}
                          className="p-3 bg-gray-100 dark:bg-gray-800 text-muted hover:bg-primary hover:text-white rounded-xl transition-all"
                          title="Sunting Karyawan"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setShowPassUser(u)}
                          className="p-3 bg-gray-100 dark:bg-gray-800 text-muted hover:bg-emerald-600 hover:text-white rounded-xl transition-all"
                          title="Lihat Kredensial"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleResetPassword(u)}
                          disabled={resetting}
                          className="p-3 bg-gray-100 dark:bg-gray-800 text-purple-600 hover:bg-purple-600 hover:text-white rounded-xl transition-all"
                          title="Reset Password"
                        >
                          {resetting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Key className="w-5 h-5" />}
                        </button>
                        <button onClick={() => deleteEmployee(u.id)} className="p-3 bg-gray-100 dark:bg-gray-800 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all" title="Hapus Karyawan">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Employee Modal (Add / Edit) */}
      <BaseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        size="lg"
        showCloseButton={false}
        noPadding={true}
      >
        <div className="bg-card-light dark:bg-card-dark text-text-light dark:text-text-dark">
          {/* Header */}
          <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/30">
            <h3 className="font-black text-xl text-text-light dark:text-text-dark">
              {editingUserId ? "Sunting Profil Karyawan" : "Tambah Karyawan Baru"}
            </h3>
            <button onClick={() => setShowAddModal(false)} aria-label="Tutup" title="Tutup" className="p-2 text-muted hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Tabs */}
          <div className="flex bg-gray-50 dark:bg-gray-900 border-b border-border-light dark:border-border-dark px-6 py-2 gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
            {[
              { key: 'pribadi', label: 'Data Pribadi', icon: UserIcon },
              { key: 'pekerjaan', label: 'Pekerjaan', icon: Briefcase },
              { key: 'akun', label: 'Akun & Hak Akses', icon: Shield },
              { key: 'darurat', label: 'Kontak Darurat', icon: Heart },
              { key: 'pendidikan', label: 'Pendidikan & Skill', icon: BookOpen }
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveFormTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border shrink-0 whitespace-nowrap ${
                  activeFormTab === tab.key
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                    : "bg-transparent text-muted border-transparent hover:text-text-light dark:hover:text-text-dark"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSaveEmployee} className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
            
            {/* 1. DATA PRIBADI */}
            {activeFormTab === 'pribadi' && (
              <div className="space-y-5">
                {/* Photo Upload Section */}
                <div className="flex flex-col sm:flex-row items-center gap-6 p-5 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-border-light dark:border-border-dark">
                  <div className="relative w-28 h-28 rounded-2xl overflow-hidden border border-border-light dark:border-border-dark bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-inner group">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Foto Profil" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-12 h-12 text-muted" />
                    )}
                    <label className="absolute inset-0 bg-black/40 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      Ganti Foto
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".jpg,.jpeg,.png,.webp" className="hidden" title="Ganti Foto" />
                    </label>
                  </div>
                  
                  <div className="flex-1 text-center sm:text-left space-y-2">
                    <h4 className="font-black text-sm uppercase text-text-light dark:text-text-dark">Foto Profil Karyawan</h4>
                    <p className="text-xs text-muted leading-relaxed">Pilih file JPG, JPEG, PNG, atau WEBP. Maksimum ukuran file adalah 2MB.</p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 text-xs font-bold bg-white dark:bg-gray-800 text-primary border border-border-light dark:border-border-dark hover:bg-gray-100 dark:hover:bg-gray-700 transition-all rounded-xl shadow-sm inline-flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" /> Unggah Foto
                    </button>
                  </div>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="fullName" className="text-xs font-black uppercase text-muted ml-1">Nama Lengkap *</label>
                    <input id="fullName" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Contoh: Budi Santoso" title="Nama Lengkap" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="nickname" className="text-xs font-black uppercase text-muted ml-1">Nama Panggilan</label>
                    <input id="nickname" value={formData.nickname} onChange={e => setFormData({...formData, nickname: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Budi" title="Nama Panggilan" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="gender" className="text-xs font-black uppercase text-muted ml-1">Jenis Kelamin</label>
                    <select id="gender" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium">
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label htmlFor="birthPlace" className="block text-xs font-black uppercase text-muted ml-1 whitespace-nowrap">Tempat Lahir</label>
                      <input id="birthPlace" value={formData.birthPlace} onChange={e => setFormData({...formData, birthPlace: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Yogyakarta" title="Tempat Lahir" />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="birthDate" className="block text-xs font-black uppercase text-muted ml-1 whitespace-nowrap">Tgl Lahir</label>
                      <input id="birthDate" value={formData.birthDate} onChange={e => setFormData({...formData, birthDate: e.target.value})} type="date" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" title="Tanggal Lahir" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="religion" className="text-xs font-black uppercase text-muted ml-1">Agama</label>
                    <select id="religion" value={formData.religion} onChange={e => setFormData({...formData, religion: e.target.value})} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium">
                      <option value="Islam">Islam</option>
                      <option value="Kristen">Kristen</option>
                      <option value="Katolik">Katolik</option>
                      <option value="Hindu">Hindu</option>
                      <option value="Budha">Budha</option>
                      <option value="Konghucu">Konghucu</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="maritalStatus" className="text-xs font-black uppercase text-muted ml-1">Status Pernikahan</label>
                    <select id="maritalStatus" value={formData.maritalStatus} onChange={e => setFormData({...formData, maritalStatus: e.target.value})} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium">
                      <option value="Belum Kawin">Belum Kawin</option>
                      <option value="Kawin">Kawin</option>
                      <option value="Cerai Hidup">Cerai Hidup</option>
                      <option value="Cerai Mati">Cerai Mati</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="nik" className="text-xs font-black uppercase text-muted ml-1">No. KTP / NIK</label>
                    <input id="nik" value={formData.nik} onChange={e => setFormData({...formData, nik: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="3404XXXXXXXXXXXX" title="NIK" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="noKk" className="text-xs font-black uppercase text-muted ml-1">No. Kartu Keluarga (KK)</label>
                    <input id="noKk" value={formData.noKk} onChange={e => setFormData({...formData, noKk: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="3404XXXXXXXXXXXX" title="Nomor KK" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="phone" className="text-xs font-black uppercase text-muted ml-1">No. Telepon / HP *</label>
                    <input id="phone" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} type="tel" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="0812XXXXXXXX" title="Nomor Telepon" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="whatsapp" className="text-xs font-black uppercase text-muted ml-1">No. WhatsApp</label>
                    <input id="whatsapp" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} type="tel" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="0812XXXXXXXX" title="Nomor WhatsApp" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="address" className="text-xs font-black uppercase text-muted ml-1">Alamat Lengkap</label>
                  <textarea id="address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium h-20 resize-none" placeholder="Nama Jalan, Blok, No. Rumah..." title="Alamat Lengkap"></textarea>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="rt" className="block text-xs font-black uppercase text-muted ml-1 whitespace-nowrap">RT</label>
                    <input id="rt" value={formData.rt} onChange={e => setFormData({...formData, rt: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="001" title="RT" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="rw" className="block text-xs font-black uppercase text-muted ml-1 whitespace-nowrap">RW</label>
                    <input id="rw" value={formData.rw} onChange={e => setFormData({...formData, rw: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="002" title="RW" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="village" className="block text-xs font-black uppercase text-muted ml-1 whitespace-nowrap">Kelurahan / Desa</label>
                    <input id="village" value={formData.village} onChange={e => setFormData({...formData, village: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Condongcatur" title="Kelurahan" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="district" className="block text-xs font-black uppercase text-muted ml-1 whitespace-nowrap">Kecamatan</label>
                    <input id="district" value={formData.district} onChange={e => setFormData({...formData, district: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Depok" title="Kecamatan" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="city" className="block text-xs font-black uppercase text-muted ml-1 whitespace-nowrap">Kota / Kabupaten</label>
                    <input id="city" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Sleman" title="Kota" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="province" className="block text-xs font-black uppercase text-muted ml-1 whitespace-nowrap">Provinsi</label>
                    <input id="province" value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="DIY" title="Provinsi" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="postalCode" className="block text-xs font-black uppercase text-muted ml-1 whitespace-nowrap">Kode Pos</label>
                    <input id="postalCode" value={formData.postalCode} onChange={e => setFormData({...formData, postalCode: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="55283" title="Kode Pos" />
                  </div>
                </div>
              </div>
            )}

            {/* 2. DATA PEKERJAAN */}
            {activeFormTab === 'pekerjaan' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="jobTitle" className="text-xs font-black uppercase text-muted ml-1">Jabatan Spesifik</label>
                    <input id="jobTitle" value={formData.jobTitle} onChange={e => setFormData({...formData, jobTitle: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Contoh: Staff Senior / Supervisor / Koordinator" title="Jabatan Spesifik" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="division" className="text-xs font-black uppercase text-muted ml-1">Divisi</label>
                    <input id="division" value={formData.division} onChange={e => setFormData({...formData, division: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Operasional Restoran" title="Divisi" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="department" className="text-xs font-black uppercase text-muted ml-1">Departemen</label>
                    <input id="department" value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Pelayanan Depan" title="Departemen" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="workShift" className="text-xs font-black uppercase text-muted ml-1">Shift Kerja</label>
                    <select id="workShift" value={formData.workShift} onChange={e => setFormData({...formData, workShift: e.target.value})} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium">
                      <option value="Pagi">Shift Pagi</option>
                      <option value="Sore">Shift Sore</option>
                      <option value="Malam">Shift Malam</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="placementLocation" className="text-xs font-black uppercase text-muted ml-1">Lokasi Penempatan</label>
                    <input id="placementLocation" value={formData.placementLocation} onChange={e => setFormData({...formData, placementLocation: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Cabang Condongcatur" title="Lokasi Penempatan" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="directManager" className="text-xs font-black uppercase text-muted ml-1">Atasan Langsung</label>
                    <input id="directManager" value={formData.directManager} onChange={e => setFormData({...formData, directManager: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Manager Operasional" title="Atasan Langsung" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="basicSalary" className="text-xs font-black uppercase text-muted ml-1">Gaji Pokok (Angka saja)</label>
                    <input id="basicSalary" value={formData.basicSalary} onChange={e => setFormData({...formData, basicSalary: e.target.value.replace(/[^0-9]/g, '')})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="2500000" title="Gaji Pokok" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="allowances" className="text-xs font-black uppercase text-muted ml-1">Tunjangan</label>
                    <input id="allowances" value={formData.allowances} onChange={e => setFormData({...formData, allowances: e.target.value.replace(/[^0-9]/g, '')})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="500000" title="Tunjangan" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="workStatus" className="text-xs font-black uppercase text-muted ml-1">Status Keaktifan Kerja</label>
                    <select id="workStatus" value={formData.workStatus} onChange={e => setFormData({...formData, workStatus: e.target.value as any})} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium">
                      <option value="aktif">Aktif Kerja</option>
                      <option value="resign">Resign / Keluar</option>
                      <option value="dipecat">Diberhentikan (Dipecat)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 3. DATA AKUN & HAK AKSES */}
            {activeFormTab === 'akun' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="roleSelect" className="text-xs font-black uppercase text-muted ml-1">Role Akun Utama *</label>
                    <select id="roleSelect" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium">
                      <option value="cashier">Karyawan (Akses Front-desk POS & Chat)</option>
                      <option value="admin">Admin (Akses Panel Pengelolaan Restoran)</option>
                    </select>
                  </div>
                  
                  <div className="space-y-1.5">
                    <label htmlFor="usernameInput" className="text-xs font-black uppercase text-muted ml-1">Username Kustom (Opsional)</label>
                    <input id="usernameInput" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '')})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="budisantoso.resto" title="Username Kustom" />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="emailInput" className="text-xs font-black uppercase text-muted ml-1">Email Login / Notifikasi *</label>
                    <input id="emailInput" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} type="email" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="budi@restobook.com" title="Email" />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="accountStatus" className="text-xs font-black uppercase text-muted ml-1">Status Akses Login</label>
                    <select id="accountStatus" value={formData.accountStatus} onChange={e => setFormData({...formData, accountStatus: e.target.value as any})} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium">
                      <option value="aktif">Aktif (Bisa Login & Mengakses Menu)</option>
                      <option value="nonaktif">Ditangguhkan / Blokir Sementara</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-black uppercase text-muted ml-1">Batasan Hak Akses (Multi-Selection)</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-border-light dark:border-border-dark">
                    {[
                      { key: 'pos', label: 'Buka POS Kasir' },
                      { key: 'payroll', label: 'Kelola Payroll' },
                      { key: 'support', label: 'Pusat Bantuan' },
                      { key: 'reports', label: 'Laporan Keuangan' },
                      { key: 'menu', label: 'Ubah Data Menu' },
                      { key: 'users', label: 'Kelola Karyawan' }
                    ].map(right => {
                      const isChecked = formData.accessRights.includes(right.key);
                      return (
                        <label key={right.key} className="flex items-center gap-2 text-xs font-bold cursor-pointer hover:text-primary transition-all">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, accessRights: [...formData.accessRights, right.key] });
                              } else {
                                setFormData({ ...formData, accessRights: formData.accessRights.filter(r => r !== right.key) });
                              }
                            }}
                            className="w-4 h-4 rounded text-primary focus:ring-primary border-border-light dark:border-border-dark"
                          />
                          <span>{right.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 4. KONTAK DARURAT */}
            {activeFormTab === 'darurat' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="emergencyName" className="text-xs font-black uppercase text-muted ml-1">Nama Kontak Darurat</label>
                    <input id="emergencyName" value={formData.emergencyName} onChange={e => setFormData({...formData, emergencyName: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Siti Aminah" title="Nama Kontak Darurat" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="emergencyRelation" className="text-xs font-black uppercase text-muted ml-1">Hubungan</label>
                    <input id="emergencyRelation" value={formData.emergencyRelation} onChange={e => setFormData({...formData, emergencyRelation: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Ibu Kandung / Istri" title="Hubungan" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="emergencyPhone" className="text-xs font-black uppercase text-muted ml-1">Nomor Telepon Darurat</label>
                    <input id="emergencyPhone" value={formData.emergencyPhone} onChange={e => setFormData({...formData, emergencyPhone: e.target.value})} type="tel" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="0812XXXXXXXX" title="Nomor Telepon Darurat" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="emergencyAddress" className="text-xs font-black uppercase text-muted ml-1">Alamat Kontak Darurat</label>
                  <textarea id="emergencyAddress" value={formData.emergencyAddress} onChange={e => setFormData({...formData, emergencyAddress: e.target.value})} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium h-20 resize-none" placeholder="Alamat tinggal penanggung jawab saat darurat..." title="Alamat Kontak Darurat"></textarea>
                </div>
              </div>
            )}

            {/* 5. PENDIDIKAN & SKILL */}
            {activeFormTab === 'pendidikan' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="lastEducation" className="text-xs font-black uppercase text-muted ml-1">Pendidikan Terakhir</label>
                    <select id="lastEducation" value={formData.lastEducation} onChange={e => setFormData({...formData, lastEducation: e.target.value})} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium">
                      <option value="SD">SD</option>
                      <option value="SMP">SMP</option>
                      <option value="SMA/SMK">SMA / SMK</option>
                      <option value="D3">Diploma 3 (D3)</option>
                      <option value="S1">Sarjana (S1)</option>
                      <option value="S2">Magister (S2)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="schoolName" className="text-xs font-black uppercase text-muted ml-1">Nama Sekolah / Kampus</label>
                    <input id="schoolName" value={formData.schoolName} onChange={e => setFormData({...formData, schoolName: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="SMK Negeri 1 Yogyakarta" title="Nama Sekolah" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="major" className="text-xs font-black uppercase text-muted ml-1">Jurusan</label>
                    <input id="major" value={formData.major} onChange={e => setFormData({...formData, major: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Tata Boga / Akuntansi" title="Jurusan" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="graduationYear" className="text-xs font-black uppercase text-muted ml-1">Tahun Lulus</label>
                    <input id="graduationYear" value={formData.graduationYear} onChange={e => setFormData({...formData, graduationYear: e.target.value.replace(/[^0-9]/g, '')})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="2020" title="Tahun Lulus" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="skills" className="text-xs font-black uppercase text-muted ml-1">Skill / Keahlian Utama</label>
                  <input id="skills" value={formData.skills} onChange={e => setFormData({...formData, skills: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Microsoft Office, Komunikasi, Pelayanan POS, dll" title="Keahlian" />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="certifications" className="text-xs font-black uppercase text-muted ml-1">Sertifikasi Kompetensi</label>
                  <input id="certifications" value={formData.certifications} onChange={e => setFormData({...formData, certifications: e.target.value})} type="text" className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium" placeholder="Sertifikat BNSP / Barista" title="Sertifikasi" />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="additionalNotes" className="text-xs font-black uppercase text-muted ml-1">Catatan Internal Admin / HR</label>
                  <textarea id="additionalNotes" value={formData.additionalNotes} onChange={e => setFormData({...formData, additionalNotes: e.target.value})} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-sm font-medium h-20 resize-none" placeholder="Catatan kepribadian, hasil interview..." title="Catatan Tambahan"></textarea>
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="pt-6 border-t border-border-light dark:border-border-dark flex justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  if (activeFormTab === 'pekerjaan') setActiveFormTab('pribadi');
                  else if (activeFormTab === 'akun') setActiveFormTab('pekerjaan');
                  else if (activeFormTab === 'darurat') setActiveFormTab('akun');
                  else if (activeFormTab === 'pendidikan') setActiveFormTab('darurat');
                }}
                disabled={activeFormTab === 'pribadi'}
                className="px-6 py-3.5 bg-gray-100 dark:bg-gray-800 text-muted rounded-xl font-bold hover:bg-gray-200 transition-all text-xs uppercase disabled:opacity-50 disabled:pointer-events-none"
              >
                Sebelumnya
              </button>

              {activeFormTab !== 'pendidikan' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (activeFormTab === 'pribadi') setActiveFormTab('pekerjaan');
                    else if (activeFormTab === 'pekerjaan') setActiveFormTab('akun');
                    else if (activeFormTab === 'akun') setActiveFormTab('darurat');
                    else if (activeFormTab === 'darurat') setActiveFormTab('pendidikan');
                  }}
                  className="px-6 py-3.5 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-all text-xs uppercase tracking-wider"
                >
                  Selanjutnya
                </button>
              ) : (
                <button
                  disabled={submitting}
                  type="submit"
                  className="px-8 py-3.5 bg-primary text-white rounded-xl font-black shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Simpan Data</>}
                </button>
              )}
            </div>
          </form>
        </div>
      </BaseModal>

      {/* Image Cropping Editor Modal */}
      <BaseModal
        isOpen={isEditingImage}
        onClose={() => setIsEditingImage(false)}
        size="sm"
        showCloseButton={false}
        noPadding={true}
      >
        <div className="bg-white dark:bg-gray-900 text-text-light dark:text-text-dark p-6 space-y-6">
          <h3 className="font-black text-lg text-center uppercase tracking-wider">Sesuaikan Foto Karyawan</h3>
          
          <div className="flex justify-center bg-gray-50 dark:bg-gray-950 p-4 rounded-3xl border border-border-light dark:border-border-dark overflow-hidden">
            <canvas ref={canvasRef} className="w-[200px] h-[200px] sm:w-[240px] sm:h-[240px] rounded-2xl bg-white shadow-md border" />
          </div>

          <div className="space-y-4">
            {/* Zoom Slider */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-muted">
                <span>Perbesar / Perkecil</span>
                <span>{Math.round(zoom * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
                title="Skala Zoom"
              />
            </div>

            {/* Rotation Controls */}
            <div className="flex justify-between items-center gap-3">
              <button
                type="button"
                onClick={() => setRotation(r => (r + 90) % 360)}
                className="flex-1 py-3 border border-border-light dark:border-border-dark text-muted font-bold text-xs rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all flex items-center justify-center gap-1.5"
              >
                <RotateCw className="w-4 h-4" /> Putar 90°
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setIsEditingImage(false)}
              className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-muted rounded-xl font-bold hover:bg-gray-200 transition-all text-xs uppercase"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover transition-all text-xs uppercase tracking-wider shadow-md"
            >
              Potong & Simpan
            </button>
          </div>
        </div>
      </BaseModal>

      {/* View Credentials Popup */}
      <BaseModal
        isOpen={!!showPassUser}
        onClose={() => setShowPassUser(null)}
        size="sm"
        showCloseButton={false}
        noPadding={true}
      >
        {showPassUser && (
          <div className="bg-card-light dark:bg-card-dark text-text-light dark:text-text-dark">
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
                  <div className="overflow-hidden">
                    <p className="text-[9px] font-bold text-muted uppercase">Email Login</p>
                    <p className="text-xs font-bold text-text-light dark:text-text-dark truncate">{showPassUser.email || "-"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-border-light dark:border-border-dark">
                  <UserIcon className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-[9px] font-bold text-muted uppercase">Jabatan / Role</p>
                    <p className="text-xs font-bold text-text-light dark:text-text-dark capitalize">{showPassUser.role}</p>
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
                    <p className="text-lg font-black font-mono text-primary truncate">
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
                    className="flex-1 py-3.5 bg-gray-150 dark:bg-gray-800 text-muted rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all text-xs uppercase"
                  >
                    Tutup
                  </button>
                  <button 
                    onClick={() => {
                      const text = `RestoBook - Data Akses Karyawan:\nNama: ${showPassUser.full_name}\nID: ${showPassUser.employee_id}\nUsername: ${showPassUser.username || ''}\nEmail: ${showPassUser.email}\nSandi: ${showPassUser.temp_password || 'Sudah diganti'}`;
                      navigator.clipboard.writeText(text);
                      toast.success("Kredensial disalin ke papan klip!");
                    }}
                    className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-muted rounded-xl font-bold hover:bg-gray-200 transition-all text-xs uppercase"
                  >
                    Salin Info
                  </button>
                </div>
                
                {showPassUser.pdfBase64 && (
                  <button 
                    onClick={async () => {
                      try {
                        await downloadFile({
                          dataBase64: showPassUser.pdfBase64,
                          filename: `Akun_${showPassUser.employee_id}.pdf`,
                          mimeType: 'application/pdf'
                        });
                        toast.success("PDF berhasil diunduh.");
                      } catch (e) {
                        toast.error("Gagal mengunduh PDF");
                      }
                    }}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                  >
                    <FileText className="w-5 h-5" /> Download PDF Data Login
                  </button>
                )}

                <button 
                  onClick={async () => {
                    setSubmitting(true);
                    try {
                      const FONNTE_TOKEN = "CpJ7L8M8TfwCVy2k2m6C";
                      const cleanPhone = showPassUser.phone.replace(/[^0-9]/g, '');
                      const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : (cleanPhone.startsWith('8') ? '62' + cleanPhone : cleanPhone);
                      
                      const waMessage = `*INFO AKSES LOGIN RESTOBOOK*\n\nHalo *${showPassUser.full_name}*,\n\nBerikut adalah pengingat data login Anda:\n\n*No. ID:* ${showPassUser.employee_id}\n*Username:* ${showPassUser.username || ''}\n*Email:* ${showPassUser.email}\n${showPassUser.temp_password ? `*Password:* ${showPassUser.temp_password}` : '*Password:* (Sudah Anda ubah)'}\n\nSilakan login kembali melalui aplikasi RestoBook.\n\nTerima kasih,\n*Admin RestoBook*`;

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
                  className="w-full py-4 bg-green-600 text-white rounded-2xl font-black shadow-xl shadow-green-600/20 hover:bg-green-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> Kirim Info Login ke WA</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </BaseModal>

      {/* Confirmation Dialog Modal */}
      <BaseModal
        isOpen={confirmModal.show}
        onClose={() => setConfirmModal(prev => ({ ...prev, show: false }))}
        size="sm"
        showCloseButton={false}
        noPadding={true}
      >
        <div className="bg-white dark:bg-gray-900 text-text-light dark:text-text-dark">
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
              className="flex-1 py-4 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all border border-gray-200 dark:border-gray-700 text-xs uppercase"
            >
              Batal
            </button>
            <button 
              onClick={confirmModal.onConfirm}
              className={`flex-1 py-4 text-white rounded-2xl font-bold transition-all shadow-lg text-xs uppercase ${
                confirmModal.type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 
                confirmModal.type === 'warning' ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' : 
                'bg-primary hover:bg-primary-hover shadow-primary/20'
              }`}
            >
              Ya, Lanjutkan
            </button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
