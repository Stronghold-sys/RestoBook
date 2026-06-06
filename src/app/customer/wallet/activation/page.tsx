"use client";

export const runtime = 'edge';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  Wallet, ShieldCheck, Upload, Camera, AlertTriangle, 
  CheckCircle, Loader2, ArrowLeft, RefreshCw, Eye, Trash2
} from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import CameraCaptureModal from "@/components/CameraCaptureModal";

export default function WalletActivationPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingActivation, setExistingActivation] = useState<any>(null);
  
  // Modals
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<"ktp_front" | "additional_doc" | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Pribadi
    full_name: "",
    nik: "",
    birth_place: "",
    birth_date: "",
    gender: "Laki-laki",
    marital_status: "Belum Kawin",
    nationality: "WNI",
    religion: "Islam",
    occupation: "",
    mother_name: "",

    // Kontak
    phone: "",
    email: "",
    address: "",
    rt_rw: "",
    village: "",
    district: "",
    city: "",
    province: "",
    postal_code: "",

    // Identitas
    ktp_name: "",
    ktp_number: "",
    ktp_front_url: "",
    ktp_back_url: "",
    additional_doc_url: "",

    // Dompet
    purpose: "Transaksi Makanan & Reservasi",
    source_of_funds: "Gaji/Pendapatan Usaha",
    statement_true: false,
    terms_accepted: false,
    privacy_accepted: false,
    verify_accepted: false
  });

  // Files State for UI display
  const [filesState, setFilesState] = useState<Record<string, {
    status: "belum_pilih" | "berhasil" | "gagal" | "mengunggah";
    name: string;
    preview: string;
  }>>({
    ktp_front: { status: "belum_pilih", name: "", preview: "" },
    ktp_back: { status: "belum_pilih", name: "", preview: "" },
    additional_doc: { status: "belum_pilih", name: "", preview: "" }
  });

  // Rejection/Invalid Fields status from Admin
  const [invalidFields, setInvalidFields] = useState<string[]>([]);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  useEffect(() => {
    fetchActivationData();
  }, []);

  const fetchActivationData = async () => {
    try {
      const res = await fetch("/api/customer/wallet/activation");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat status aktivasi");

      if (data.activation) {
        setExistingActivation(data.activation);
        
        // Redirect jika status aktif atau sedang proses
        if (['diajukan', 'diajukan_ulang', 'diproses', 'diterima', 'selesai'].includes(data.activation.status)) {
          router.push("/customer/wallet");
          return;
        }

        // Jika status ditolak, load data pengajuan sebelumnya untuk diperbaiki
        if (data.activation.status === 'ditolak') {
          setRejectionReason(data.activation.rejection_reason || "");
          const fields = Array.isArray(data.activation.invalid_fields) 
            ? data.activation.invalid_fields 
            : JSON.parse(data.activation.invalid_fields || "[]");
          setInvalidFields(fields);

          // Populate form data
          setFormData({
            full_name: data.activation.full_name || "",
            nik: data.activation.nik || "",
            birth_place: data.activation.birth_place || "",
            birth_date: data.activation.birth_date ? data.activation.birth_date.split("T")[0] : "",
            gender: data.activation.gender || "Laki-laki",
            marital_status: data.activation.marital_status || "Belum Kawin",
            nationality: data.activation.nationality || "WNI",
            religion: data.activation.religion || "Islam",
            occupation: data.activation.occupation || "",
            mother_name: data.activation.mother_name || "",
            phone: data.activation.phone || "",
            email: data.activation.email || "",
            address: data.activation.address || "",
            rt_rw: data.activation.rt_rw || "",
            village: data.activation.village || "",
            district: data.activation.district || "",
            city: data.activation.city || "",
            province: data.activation.province || "",
            postal_code: data.activation.postal_code || "",
            ktp_name: data.activation.ktp_name || "",
            ktp_number: data.activation.ktp_number || "",
            ktp_front_url: data.activation.ktp_front_url || "",
            ktp_back_url: data.activation.ktp_back_url || "",
            additional_doc_url: data.activation.additional_doc_url || "",
            purpose: data.activation.purpose || "Transaksi Makanan & Reservasi",
            source_of_funds: data.activation.source_of_funds || "Gaji/Pendapatan Usaha",
            statement_true: false,
            terms_accepted: false,
            privacy_accepted: false,
            verify_accepted: false
          });

          // Set file previews
          setFilesState({
            ktp_front: data.activation.ktp_front_url ? { status: "berhasil", name: "KTP_Front.jpg", preview: data.activation.ktp_front_url } : { status: "belum_pilih", name: "", preview: "" },
            ktp_back: data.activation.ktp_back_url ? { status: "berhasil", name: "KTP_Back.jpg", preview: data.activation.ktp_back_url } : { status: "belum_pilih", name: "", preview: "" },
            additional_doc: data.activation.additional_doc_url ? { status: "berhasil", name: "Doc_Pendukung.jpg", preview: data.activation.additional_doc_url } : { status: "belum_pilih", name: "", preview: "" }
          });
        }
      } else {
        // Prapopulasi email dan HP dari profil utama jika ada
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase.from("profiles").select("full_name, email, phone").eq("user_id", session.user.id).single();
          if (profile) {
            setFormData(prev => ({
              ...prev,
              full_name: profile.full_name || "",
              email: profile.email || "",
              phone: profile.phone || "",
              ktp_name: profile.full_name || ""
            }));
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isFieldDisabled = (fieldName: string) => {
    // Jika ditolak, pelanggan hanya bisa mengedit field yang ditandai salah oleh admin
    if (existingActivation && existingActivation.status === 'ditolak') {
      return !invalidFields.includes(fieldName);
    }
    return false;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleFileUpload = async (file: File, target: "ktp_front" | "ktp_back" | "additional_doc") => {
    // Validasi Ukuran File (Max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file tidak boleh melebihi 5MB");
      setFilesState(prev => ({
        ...prev,
        [target]: { ...prev[target], status: "gagal", name: file.name }
      }));
      return;
    }

    // Validasi Format File
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Format file harus berupa gambar (JPG, JPEG, PNG)");
      setFilesState(prev => ({
        ...prev,
        [target]: { ...prev[target], status: "gagal", name: file.name }
      }));
      return;
    }

    setFilesState(prev => ({
      ...prev,
      [target]: { status: "mengunggah", name: file.name, preview: URL.createObjectURL(file) }
    }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const uId = session?.user?.id || "customer";

      const fileData = new FormData();
      fileData.append("file", file);
      fileData.append("userId", uId);
      fileData.append("bucket", "profiles");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fileData
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal mengunggah file");

      // Update Form Data URL
      setFormData(prev => ({ ...prev, [`${target}_url`]: result.url }));
      setFilesState(prev => ({
        ...prev,
        [target]: { status: "berhasil", name: file.name, preview: result.url }
      }));
      toast.success("Dokumen berhasil diunggah");

    } catch (err: any) {
      console.error(err);
      toast.error("Gagal mengunggah file. Silakan coba kembali.");
      setFilesState(prev => ({
        ...prev,
        [target]: { status: "gagal", name: file.name, preview: "" }
      }));
    }
  };

  const handleCapturePhoto = (target: "ktp_front" | "additional_doc") => {
    setCameraTarget(target);
    setIsCameraOpen(true);
  };

  const handleCameraCapture = (file: File) => {
    if (cameraTarget) {
      handleFileUpload(file, cameraTarget);
    }
  };

  const handleRemoveFile = (target: "ktp_front" | "ktp_back" | "additional_doc") => {
    setFormData(prev => ({ ...prev, [`${target}_url`]: "" }));
    setFilesState(prev => ({
      ...prev,
      [target]: { status: "belum_pilih", name: "", preview: "" }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validasi input minimal sebelum kirim
    if (!formData.ktp_front_url) {
      toast.error("Foto KTP depan wajib diunggah");
      return;
    }

    setSubmitting(true);
    const saveToast = toast.loading("Mengirim pengajuan aktivasi Dompetku...");
    try {
      const res = await fetch("/api/customer/wallet/activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim data");

      toast.success(data.message || "Pengajuan berhasil dikirim!", { id: saveToast });
      router.push("/customer/wallet");
    } catch (err: any) {
      toast.error(err.message, { id: saveToast });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
        <span>Memuat formulir aktivasi...</span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/customer/wallet")}
          className="p-2 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl text-muted hover:text-primary transition-all"
          title="Kembali ke Dompetku"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black text-primary">Aktivasi Dompetku</h1>
          <p className="text-xs text-muted">Lengkapi data identitas pribadi Anda untuk mengaktifkan dompet digital internal.</p>
        </div>
      </div>

      {/* Banner ditolak */}
      {existingActivation && existingActivation.status === 'ditolak' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 space-y-2"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-extrabold text-red-600 dark:text-red-400">Pengajuan Sebelumnya Ditolak</h3>
              <p className="text-xs text-muted leading-relaxed mt-1">
                Akses aktivasi Dompetku ditolak karena data tidak sesuai. Silakan perbaiki hanya data/dokumen yang ditandai warna merah di bawah ini sesuai instruksi admin.
              </p>
              <div className="mt-2.5 p-3 bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-900/50 text-xs">
                <span className="font-bold text-red-500">Catatan Admin:</span> &quot;{rejectionReason}&quot;
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Form Utama */}
      <form onSubmit={handleSubmit} className="space-y-8 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 sm:p-8 shadow-sm">
        
        {/* SECTION 1: DATA PRIBADI */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-primary uppercase tracking-widest border-b border-border-light dark:border-border-dark pb-2">1. Data Pribadi Sesuai Identitas</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="full_name" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Nama Lengkap Sesuai KTP</label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                disabled={isFieldDisabled("full_name")}
                value={formData.full_name}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("full_name") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"} ${invalidFields.includes("full_name") ? "border-red-500 focus:ring-red-500/20" : ""}`}
              />
              {invalidFields.includes("full_name") && <span className="text-[9px] text-red-500 font-bold mt-1 block">Revisi: Nama salah / tidak sesuai</span>}
            </div>

            <div>
              <label htmlFor="nik" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Nomor Induk Kependudukan (NIK)</label>
              <input
                id="nik"
                name="nik"
                type="text"
                required
                maxLength={16}
                disabled={isFieldDisabled("nik")}
                value={formData.nik}
                onChange={handleInputChange}
                placeholder="16 digit angka"
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("nik") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"} ${invalidFields.includes("nik") ? "border-red-500 focus:ring-red-500/20" : ""}`}
              />
              {invalidFields.includes("nik") && <span className="text-[9px] text-red-500 font-bold mt-1 block">Revisi: NIK tidak valid / tidak terdaftar</span>}
            </div>

            <div>
              <label htmlFor="birth_place" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Tempat Lahir</label>
              <input
                id="birth_place"
                name="birth_place"
                type="text"
                required
                disabled={isFieldDisabled("birth_place")}
                value={formData.birth_place}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("birth_place") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"} ${invalidFields.includes("birth_place") ? "border-red-500 focus:ring-red-500/20" : ""}`}
              />
            </div>

            <div>
              <label htmlFor="birth_date" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Tanggal Lahir</label>
              <input
                id="birth_date"
                name="birth_date"
                type="date"
                required
                disabled={isFieldDisabled("birth_date")}
                value={formData.birth_date}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("birth_date") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"} ${invalidFields.includes("birth_date") ? "border-red-500 focus:ring-red-500/20" : ""}`}
              />
            </div>

            <div>
              <label htmlFor="gender" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Jenis Kelamin</label>
              <select
                id="gender"
                name="gender"
                disabled={isFieldDisabled("gender")}
                value={formData.gender}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("gender") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"}`}
              >
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>

            <div>
              <label htmlFor="marital_status" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Status Perkawinan</label>
              <select
                id="marital_status"
                name="marital_status"
                disabled={isFieldDisabled("marital_status")}
                value={formData.marital_status}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("marital_status") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"}`}
              >
                <option value="Belum Kawin">Belum Kawin</option>
                <option value="Kawin">Kawin</option>
                <option value="Cerai Hidup">Cerai Hidup</option>
                <option value="Cerai Mati">Cerai Mati</option>
              </select>
            </div>

            <div>
              <label htmlFor="nationality" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Kewarganegaraan</label>
              <input
                id="nationality"
                name="nationality"
                type="text"
                required
                disabled={isFieldDisabled("nationality")}
                value={formData.nationality}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("nationality") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"}`}
              />
            </div>

            <div>
              <label htmlFor="religion" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Agama</label>
              <select
                id="religion"
                name="religion"
                disabled={isFieldDisabled("religion")}
                value={formData.religion}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("religion") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"}`}
              >
                <option value="Islam">Islam</option>
                <option value="Kristen Protestan">Kristen Protestan</option>
                <option value="Kristen Katolik">Kristen Katolik</option>
                <option value="Hindu">Hindu</option>
                <option value="Buddha">Buddha</option>
                <option value="Konghucu">Konghucu</option>
              </select>
            </div>

            <div>
              <label htmlFor="occupation" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Pekerjaan</label>
              <input
                id="occupation"
                name="occupation"
                type="text"
                required
                disabled={isFieldDisabled("occupation")}
                value={formData.occupation}
                onChange={handleInputChange}
                placeholder="Contoh: Karyawan Swasta"
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("occupation") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"}`}
              />
            </div>

            <div>
              <label htmlFor="mother_name" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Nama Ibu Kandung</label>
              <input
                id="mother_name"
                name="mother_name"
                type="text"
                required
                disabled={isFieldDisabled("mother_name")}
                value={formData.mother_name}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("mother_name") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"} ${invalidFields.includes("mother_name") ? "border-red-500 focus:ring-red-500/20" : ""}`}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: KONTAK */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-primary uppercase tracking-widest border-b border-border-light dark:border-border-dark pb-2">2. Data Kontak & Alamat Lengkap</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Nomor HP Aktif</label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                disabled={isFieldDisabled("phone")}
                value={formData.phone}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("phone") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"} ${invalidFields.includes("phone") ? "border-red-500 focus:ring-red-500/20" : ""}`}
              />
            </div>

            <div>
              <label htmlFor="email" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Email Aktif</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                disabled={isFieldDisabled("email")}
                value={formData.email}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("email") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"} ${invalidFields.includes("email") ? "border-red-500 focus:ring-red-500/20" : ""}`}
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="address" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Alamat Lengkap Sesuai KTP (Jalan/Dusun/No)</label>
              <textarea
                id="address"
                name="address"
                required
                rows={2}
                disabled={isFieldDisabled("address")}
                value={formData.address}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("address") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"} ${invalidFields.includes("address") ? "border-red-500 focus:ring-red-500/20" : ""}`}
              />
            </div>

            <div>
              <label htmlFor="rt_rw" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">RT/RW</label>
              <input
                id="rt_rw"
                name="rt_rw"
                type="text"
                required
                disabled={isFieldDisabled("rt_rw")}
                value={formData.rt_rw}
                onChange={handleInputChange}
                placeholder="Contoh: 002/005"
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("rt_rw") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"}`}
              />
            </div>

            <div>
              <label htmlFor="village" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Kelurahan / Desa</label>
              <input
                id="village"
                name="village"
                type="text"
                required
                disabled={isFieldDisabled("village")}
                value={formData.village}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("village") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"}`}
              />
            </div>

            <div>
              <label htmlFor="district" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Kecamatan</label>
              <input
                id="district"
                name="district"
                type="text"
                required
                disabled={isFieldDisabled("district")}
                value={formData.district}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("district") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"}`}
              />
            </div>

            <div>
              <label htmlFor="city" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Kota / Kabupaten</label>
              <input
                id="city"
                name="city"
                type="text"
                required
                disabled={isFieldDisabled("city")}
                value={formData.city}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("city") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"}`}
              />
            </div>

            <div>
              <label htmlFor="province" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Provinsi</label>
              <input
                id="province"
                name="province"
                type="text"
                required
                disabled={isFieldDisabled("province")}
                value={formData.province}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("province") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"}`}
              />
            </div>

            <div>
              <label htmlFor="postal_code" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Kode Pos</label>
              <input
                id="postal_code"
                name="postal_code"
                type="text"
                required
                disabled={isFieldDisabled("postal_code")}
                value={formData.postal_code}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("postal_code") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"}`}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: DOKUMEN IDENTITAS TAMBAHAN */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-primary uppercase tracking-widest border-b border-border-light dark:border-border-dark pb-2">3. Data KTP & Dokumen Upload</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ktp_name" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Nama Sesuai KTP</label>
              <input
                id="ktp_name"
                name="ktp_name"
                type="text"
                required
                disabled={isFieldDisabled("ktp_name")}
                value={formData.ktp_name}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("ktp_name") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"} ${invalidFields.includes("ktp_name") ? "border-red-500 focus:ring-red-500/20" : ""}`}
              />
            </div>

            <div>
              <label htmlFor="ktp_number" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Nomor KTP</label>
              <input
                id="ktp_number"
                name="ktp_number"
                type="text"
                required
                maxLength={16}
                disabled={isFieldDisabled("ktp_number")}
                value={formData.ktp_number}
                onChange={handleInputChange}
                placeholder="16 digit angka"
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("ktp_number") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"} ${invalidFields.includes("ktp_number") ? "border-red-500 focus:ring-red-500/20" : ""}`}
              />
            </div>
          </div>

          {/* UPLOAD AREA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            
            {/* Foto KTP Depan */}
            <div className={`p-5 border-2 border-dashed rounded-2xl flex flex-col justify-between min-h-[220px] transition-colors ${invalidFields.includes("ktp_front_url") ? "border-red-500 bg-red-50/20 dark:bg-red-950/5" : "border-border-light dark:border-border-dark"}`}>
              <div>
                <span className="text-xs font-black uppercase text-text-light dark:text-text-dark block">Foto KTP Depan *</span>
                <span className="text-[10px] text-muted leading-tight mt-1 block">Unggah foto bagian depan kartu identitas KTP Anda secara jelas.</span>
                
                {/* Indikator Status File */}
                <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider">
                  {filesState.ktp_front.status === "belum_pilih" && <span className="text-muted bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">Belum dipilih</span>}
                  {filesState.ktp_front.status === "mengunggah" && <span className="text-primary bg-primary/10 px-2 py-0.5 rounded animate-pulse">Sedang mengunggah...</span>}
                  {filesState.ktp_front.status === "gagal" && <span className="text-red-600 bg-red-100 dark:bg-red-950/20 px-2 py-0.5 rounded">Gagal / Perlu diulang</span>}
                  {filesState.ktp_front.status === "berhasil" && <span className="text-green-600 bg-green-100 dark:bg-green-950/20 px-2 py-0.5 rounded">Berhasil diunggah</span>}
                </div>
              </div>

              {filesState.ktp_front.preview ? (
                <div className="relative rounded-xl overflow-hidden h-28 w-full mt-3 group border border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800">
                  <img src={filesState.ktp_front.preview} alt="KTP Depan Preview" className="w-full h-full object-contain" />
                  {!isFieldDisabled("ktp_front_url") && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                      <button type="button" onClick={() => handleCapturePhoto("ktp_front")} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white" title="Foto Ulang"><Camera className="w-4 h-4" /></button>
                      <button type="button" onClick={() => handleRemoveFile("ktp_front")} className="p-2 bg-red-600/80 hover:bg-red-600 rounded-full text-white" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-2.5 mt-4">
                  <label className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gray-50 hover:bg-gray-100 dark:bg-gray-850 dark:hover:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl text-xs font-black text-muted hover:text-primary transition-all cursor-pointer">
                    <Upload className="w-4 h-4 text-primary" />
                    Pilih File
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isFieldDisabled("ktp_front_url")}
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "ktp_front")}
                      className="hidden"
                    />
                  </label>
                  {!isFieldDisabled("ktp_front_url") && (
                    <button
                      type="button"
                      onClick={() => handleCapturePhoto("ktp_front")}
                      className="flex items-center justify-center p-3 bg-primary hover:bg-primary-hover text-white rounded-xl transition-all"
                      title="Ambil dari Kamera"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Dokumen Pendukung Opsional */}
            <div className={`p-5 border-2 border-dashed rounded-2xl flex flex-col justify-between min-h-[220px] transition-colors ${invalidFields.includes("additional_doc_url") ? "border-red-500 bg-red-50/20 dark:bg-red-950/5" : "border-border-light dark:border-border-dark"}`}>
              <div>
                <span className="text-xs font-black uppercase text-text-light dark:text-text-dark block">Dokumen Pendukung (Opsional)</span>
                <span className="text-[10px] text-muted leading-tight mt-1 block">Unggah foto dokumen tambahan (seperti SIM, NPWP, atau KK) jika diperlukan.</span>
                
                {/* Indikator Status File */}
                <div className="mt-2 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider">
                  {filesState.additional_doc.status === "belum_pilih" && <span className="text-muted bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">Belum dipilih</span>}
                  {filesState.additional_doc.status === "mengunggah" && <span className="text-primary bg-primary/10 px-2 py-0.5 rounded animate-pulse">Sedang mengunggah...</span>}
                  {filesState.additional_doc.status === "gagal" && <span className="text-red-600 bg-red-100 dark:bg-red-950/20 px-2 py-0.5 rounded">Gagal / Perlu diulang</span>}
                  {filesState.additional_doc.status === "berhasil" && <span className="text-green-600 bg-green-100 dark:bg-green-950/20 px-2 py-0.5 rounded">Berhasil diunggah</span>}
                </div>
              </div>

              {filesState.additional_doc.preview ? (
                <div className="relative rounded-xl overflow-hidden h-28 w-full mt-3 group border border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800">
                  <img src={filesState.additional_doc.preview} alt="Dokumen Pendukung Preview" className="w-full h-full object-contain" />
                  {!isFieldDisabled("additional_doc_url") && (
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                      <button type="button" onClick={() => handleCapturePhoto("additional_doc")} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white" title="Foto Ulang"><Camera className="w-4 h-4" /></button>
                      <button type="button" onClick={() => handleRemoveFile("additional_doc")} className="p-2 bg-red-600/80 hover:bg-red-600 rounded-full text-white" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-2.5 mt-4">
                  <label className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-gray-50 hover:bg-gray-100 dark:bg-gray-850 dark:hover:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl text-xs font-black text-muted hover:text-primary transition-all cursor-pointer">
                    <Upload className="w-4 h-4 text-primary" />
                    Pilih File
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isFieldDisabled("additional_doc_url")}
                      onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], "additional_doc")}
                      className="hidden"
                    />
                  </label>
                  {!isFieldDisabled("additional_doc_url") && (
                    <button
                      type="button"
                      onClick={() => handleCapturePhoto("additional_doc")}
                      className="flex items-center justify-center p-3 bg-primary hover:bg-primary-hover text-white rounded-xl transition-all"
                      title="Ambil dari Kamera"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* SECTION 4: DATA DOMPET */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-primary uppercase tracking-widest border-b border-border-light dark:border-border-dark pb-2">4. Informasi Keuangan & Dompet</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="purpose" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Tujuan Penggunaan E-Wallet</label>
              <select
                id="purpose"
                name="purpose"
                disabled={isFieldDisabled("purpose")}
                value={formData.purpose}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("purpose") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"}`}
              >
                <option value="Transaksi Makanan & Reservasi">Pembayaran Transaksi Makanan & Reservasi</option>
                <option value="Tabungan Internal">Penyimpanan Saldo / Tabungan</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div>
              <label htmlFor="source_of_funds" className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Sumber Dana Utama</label>
              <select
                id="source_of_funds"
                name="source_of_funds"
                disabled={isFieldDisabled("source_of_funds")}
                value={formData.source_of_funds}
                onChange={handleInputChange}
                className={`w-full bg-background-light dark:bg-background-dark border rounded-xl px-4 py-3 text-xs outline-none focus:ring-2 focus:ring-primary/20 ${isFieldDisabled("source_of_funds") ? "opacity-60 bg-gray-100 dark:bg-gray-850 cursor-not-allowed" : "border-border-light dark:border-border-dark"}`}
              >
                <option value="Gaji/Pendapatan Usaha">Gaji / Pendapatan Usaha pribadi</option>
                <option value="Uang Saku/Pemberian">Uang Saku / Pemberian Orangtua</option>
                <option value="Tabungan/Warisan">Tabungan / Investasi / Warisan</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>
          </div>
        </div>

        {/* SECTION 5: KETENTUAN KEAMANAN & CHECKBOXES */}
        <div className="space-y-6 pt-4 border-t border-border-light dark:border-border-dark">
          {/* Disclaimer Keamanan Data */}
          <div className="bg-emerald-500/5 dark:bg-emerald-950/5 border border-emerald-500/20 rounded-2xl p-5 space-y-2.5">
            <h4 className="font-extrabold text-xs text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              Kerahasiaan Data Terjamin
            </h4>
            <p className="text-[11px] text-muted leading-relaxed">
              Seluruh data dan dokumen yang Anda kirimkan dijamin aman, terlindungi, dan hanya digunakan untuk proses verifikasi aktivasi Dompetku. Kami menjaga kerahasiaan data Anda sesuai kebijakan privasi yang berlaku.
            </p>
            <p className="text-[11px] text-muted leading-relaxed">
              Data Anda tidak dibagikan kepada pihak yang tidak berwenang dan hanya dapat diakses oleh tim terkait untuk keperluan verifikasi.
            </p>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3.5">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="statement_true"
                required
                checked={formData.statement_true}
                onChange={handleCheckboxChange}
                className="mt-1 accent-primary rounded cursor-pointer"
              />
              <span className="text-[11px] text-muted font-semibold leading-relaxed">
                Saya menyatakan dengan sadar bahwa seluruh data pribadi dan informasi identitas yang saya isi pada formulir ini adalah benar, akurat, dan sesuai dengan dokumen identitas resmi yang saya miliki.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="terms_accepted"
                required
                checked={formData.terms_accepted}
                onChange={handleCheckboxChange}
                className="mt-1 accent-primary rounded cursor-pointer"
              />
              <span className="text-[11px] text-muted font-semibold leading-relaxed">
                Saya menyetujui seluruh Syarat dan Ketentuan layanan penggunaan fitur Dompetku yang ditetapkan oleh pihak manajemen restoran.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="privacy_accepted"
                required
                checked={formData.privacy_accepted}
                onChange={handleCheckboxChange}
                className="mt-1 accent-primary rounded cursor-pointer"
              />
              <span className="text-[11px] text-muted font-semibold leading-relaxed">
                Saya menyetujui Kebijakan Privasi serta pengelolaan data pribadi secara aman untuk tujuan kepatuhan regulasi verifikasi pengguna.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="verify_accepted"
                required
                checked={formData.verify_accepted}
                onChange={handleCheckboxChange}
                className="mt-1 accent-primary rounded cursor-pointer"
              />
              <span className="text-[11px] text-muted font-semibold leading-relaxed">
                Saya memberikan izin kepada tim verifikator admin terkait untuk melakukan verifikasi, validasi berkas, dan pencocokan identitas pribadi demi keamanan akun Dompetku.
              </span>
            </label>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="submit"
          disabled={submitting || !formData.ktp_front_url}
          className="w-full py-4 bg-primary hover:bg-primary-hover text-white font-black text-xs rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim data pengajuan...</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> Ajukan Aktivasi Dompetku</>
          )}
        </button>

      </form>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => {
          setIsCameraOpen(false);
          setCameraTarget(null);
        }}
        onCapture={handleCameraCapture}
      />
    </div>
  );
}
