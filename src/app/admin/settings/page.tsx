"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings, Save, Loader2, Store, MapPin, Phone, Mail, Clock, QrCode, Smartphone, CreditCard, Upload, ImageIcon, ShieldAlert, DollarSign, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast, { Toaster } from "react-hot-toast";
import { formatToIndonesianDate } from "@/utils/operationalHours";
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useRef } from "react";

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({ 
    id: "", 
    name: "", 
    address: "", 
    phone: "", 
    email: "", 
    opening_time: "08:00", 
    closing_time: "22:00",
    is_temporary_closed: false,
    is_holiday: false,
    holiday_reopen_date: "Besok",
    temporary_closed_reopen_time: "12:00",
    is_24_hours: false,
    close_warning_minutes: 10,
    customer_warning_minutes: 15,
    shift_closing_buffer_minutes: 30,
    is_auto_close_shift_enabled: true,
    logo_url: "",
    late_tolerance_minutes: 15,
    auto_deduct_late_salary: false,
    minutes_per_working_day: 480,
    payday_date: 28,
    cutoff_date: 27
  });
  
  // Merchant QRIS & E-Wallet configuration state
  const [merchantSettings, setMerchantSettings] = useState({
    merchantName: "RESTOBOOK POS",
    merchantId: "ID1020304050607",
    merchantCode: "93600002",
    city: "JAKARTA",
    postalCode: "12345",
    categoryCode: "5812",
    gopay: "08123456789",
    ovo: "08123456789",
    dana: "08123456789",
    shopeepay: "08123456789",
    linkaja: "08123456789"
  });

  const supabase = createClient();

  useEffect(() => {
    fetchSettings();
    // Load merchant settings from localStorage
    const savedMerchant = localStorage.getItem("restaurant_merchant_settings");
    if (savedMerchant) {
      try {
        setMerchantSettings(JSON.parse(savedMerchant));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from("restaurant_settings").select("*").single();
      if (data) setSettings({
        ...settings,
        ...data,
        is_24_hours: !!data.is_24_hours,
        close_warning_minutes: data.close_warning_minutes !== null && data.close_warning_minutes !== undefined ? Number(data.close_warning_minutes) : 10,
        customer_warning_minutes: data.customer_warning_minutes !== null && data.customer_warning_minutes !== undefined ? Number(data.customer_warning_minutes) : 15,
        shift_closing_buffer_minutes: data.shift_closing_buffer_minutes !== null && data.shift_closing_buffer_minutes !== undefined ? Number(data.shift_closing_buffer_minutes) : 30,
        is_auto_close_shift_enabled: data.is_auto_close_shift_enabled !== undefined && data.is_auto_close_shift_enabled !== null ? !!data.is_auto_close_shift_enabled : true,
        late_tolerance_minutes: data.late_tolerance_minutes !== null && data.late_tolerance_minutes !== undefined ? Number(data.late_tolerance_minutes) : 15,
        auto_deduct_late_salary: !!data.auto_deduct_late_salary,
        minutes_per_working_day: data.minutes_per_working_day !== null && data.minutes_per_working_day !== undefined ? Number(data.minutes_per_working_day) : 480,
        payday_date: data.payday_date !== null && data.payday_date !== undefined ? Number(data.payday_date) : 28,
        cutoff_date: data.cutoff_date !== null && data.cutoff_date !== undefined ? Number(data.cutoff_date) : 27
      });
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  };

  const [uploading, setUploading] = useState(false);
  
  // Crop States
  const [upImg, setUpImg] = useState<any>();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: '%', width: 50, height: 50, x: 25, y: 25 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setUpImg(reader.result));
      reader.readAsDataURL(e.target.files[0]);
      setShowCropModal(true);
      // Reset crop
      setCrop({ unit: '%', width: 50, height: 50, x: 25, y: 25 });
    }
  };

  const onLoad = (img: HTMLImageElement) => {
    imgRef.current = img;
  };

  const getCroppedImg = (image: HTMLImageElement, crop: PixelCrop, fileName: string): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return Promise.reject("No 2d context");

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/png');
    });
  };

  const handleUploadCroppedLogo = async () => {
    if (!completedCrop || !imgRef.current) return toast.error("Silakan potong gambar terlebih dahulu");
    
    setUploading(true);
    setShowCropModal(false);
    
    try {
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop, 'logo.png');
      const file = new File([croppedBlob], `res_logo_${Date.now()}.png`, { type: 'image/png' });
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "logos"); // Bypass RLS by using our server-side route
      
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal mengunggah logo");
      
      // Auto-save to database so it doesn't disappear on refresh
      if (settings.id) {
        await supabase.from("restaurant_settings").update({ logo_url: result.url }).eq("id", settings.id);
      }
      
      setSettings(prev => ({ ...prev, logo_url: result.url }));
      toast.success("Logo berhasil diperbarui dan disimpan!");
    } catch(err:any){ 
      toast.error(err.message); 
    } finally { 
      setUploading(false); 
      setUpImg(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save primary restaurant settings to Supabase
      const { error } = await supabase.from("restaurant_settings").update({
        name: settings.name, 
        address: settings.address, 
        phone: settings.phone, 
        email: settings.email, 
        opening_time: settings.opening_time, 
        closing_time: settings.closing_time,
        is_temporary_closed: settings.is_temporary_closed,
        is_holiday: settings.is_holiday,
        holiday_reopen_date: settings.holiday_reopen_date,
        temporary_closed_reopen_time: settings.temporary_closed_reopen_time,
        is_24_hours: settings.is_24_hours,
        close_warning_minutes: Number(settings.customer_warning_minutes || 10),
        customer_warning_minutes: Number(settings.customer_warning_minutes || 10),
        shift_closing_buffer_minutes: Number(settings.shift_closing_buffer_minutes || 30),
        is_auto_close_shift_enabled: settings.is_auto_close_shift_enabled,
        logo_url: settings.logo_url,
        late_tolerance_minutes: Number(settings.late_tolerance_minutes || 15),
        auto_deduct_late_salary: settings.auto_deduct_late_salary,
        minutes_per_working_day: Number(settings.minutes_per_working_day || 480),
        payday_date: Number(settings.payday_date || 28),
        cutoff_date: Number(settings.cutoff_date || 27),
      }).eq("id", settings.id);
      if (error) throw error;

      // Broadcast settings change background trigger
      const broadcastChannel = supabase.channel("settings-sync-channel");
      broadcastChannel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await broadcastChannel.send({
            type: "broadcast",
            event: "settings_updated",
            payload: {}
          });
        }
      });

      // Save merchant settings to localStorage
      localStorage.setItem("restaurant_merchant_settings", JSON.stringify(merchantSettings));

      toast.success("Pengaturan & Data Merchant berhasil disimpan!");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const fields = [
    { id: "setName", label: "Nama Restoran", icon: Store, value: settings.name, key: "name", type: "text" },
    { id: "setAddr", label: "Alamat", icon: MapPin, value: settings.address, key: "address", type: "text" },
    { id: "setPhone", label: "No Telepon", icon: Phone, value: settings.phone, key: "phone", type: "tel" },
    { id: "setEmail", label: "Email", icon: Mail, value: settings.email, key: "email", type: "email" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 p-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Pengaturan</h1>
        <p className="text-muted mt-1">Kelola informasi restoran & metode pembayaran Anda</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side - Restaurant Settings */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden h-fit">
          <div className="bg-gradient-to-br from-primary to-primary-hover p-6 flex items-center gap-3 text-white">
            <Settings className="w-8 h-8" />
            <div>
              <h2 className="text-xl font-bold">Informasi Restoran</h2>
              <p className="text-white/80 text-sm">Data ini akan ditampilkan di halaman utama</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* LOGO UPLOAD COMPONENT */}
            <div className="pb-4 border-b border-border-light dark:border-border-dark flex items-center gap-5">
              <div className="h-20 w-20 bg-background-light dark:bg-background-dark border-2 border-dashed border-muted/50 rounded-xl flex items-center justify-center overflow-hidden relative shadow-inner">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="h-full w-full object-contain p-1 bg-white" />
                ) : (
                  <ImageIcon className="text-muted h-7 w-7 opacity-40" />
                )}
                {uploading && <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center"><Loader2 className="animate-spin text-white w-5 h-5" /></div>}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm text-text-light dark:text-text-dark">Logo Resmi Bisnis</p>
                <p className="text-xs text-muted mb-3">Format PNG, JPG (Maks. 2MB)</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-xl text-xs font-black cursor-pointer hover:bg-border-light dark:hover:bg-border-dark transition-all">
                  <Upload className="w-3.5 h-3.5 text-primary" />
                  <span>{uploading ? "PROSES..." : "UNGGAH LOGO"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={onSelectFile} disabled={uploading} />
                </label>
              </div>
            </div>
            {fields.map(f => (
              <div key={f.id}>
                <label htmlFor={f.id} className="text-sm font-medium text-text-light dark:text-text-dark mb-1.5 block">{f.label}</label>
                <div className="relative">
                  <f.icon className="absolute left-3.5 top-3.5 h-5 w-5 text-muted" />
                  <input id={f.id} title={f.label} type={f.type} value={f.value || ""} onChange={e => setSettings({ ...settings, [f.key]: e.target.value })} className="w-full pl-11 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark" />
                </div>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="setOpen" className="text-sm font-medium text-text-light dark:text-text-dark mb-1.5 block">Jam Buka</label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-3.5 h-5 w-5 text-muted" />
                  <input id="setOpen" title="Jam Buka" type="time" value={settings.opening_time || "08:00"} onChange={e => setSettings({ ...settings, opening_time: e.target.value })} className="w-full pl-11 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark" />
                </div>
              </div>
              <div>
                <label htmlFor="setClose" className="text-sm font-medium text-text-light dark:text-text-dark mb-1.5 block">Jam Tutup</label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-3.5 h-5 w-5 text-muted" />
                  <input id="setClose" title="Jam Tutup" type="time" value={settings.closing_time || "22:00"} onChange={e => setSettings({ ...settings, closing_time: e.target.value })} className="w-full pl-11 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark" />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="warningMinutes" className="text-sm font-medium text-text-light dark:text-text-dark mb-1.5 block">
                Peringatan Menjelang Resto Tutup (Menit)
              </label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-3.5 h-5 w-5 text-muted" />
                <input 
                  id="warningMinutes" 
                  title="Peringatan Menjelang Resto Tutup" 
                  type="number" 
                  min="1" 
                  max="120"
                  value={settings.customer_warning_minutes || 10} 
                  onChange={e => {
                    const val = Number(e.target.value);
                    setSettings({ ...settings, close_warning_minutes: val, customer_warning_minutes: val });
                  }} 
                  className="w-full pl-11 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark font-medium" 
                />
              </div>
              <p className="text-[11px] text-muted mt-1">Mengatur kapan banner peringatan penutupan resto muncul di kasir dan pelanggan menjelang jam tutup operasional.</p>
            </div>

            <div className="flex flex-col gap-3 p-4 bg-blue-50/50 dark:bg-blue-950/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-sm text-blue-900 dark:text-blue-300">Tutup Shift Otomatis</p>
                  <p className="text-[11px] text-blue-700/70 dark:text-blue-400/70">Aktifkan hitung mundur paksa setelah jam operasional berakhir.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    title="Aktifkan Tutup Shift Otomatis"
                    aria-label="Aktifkan Tutup Shift Otomatis"
                    checked={settings.is_auto_close_shift_enabled} 
                    onChange={e => setSettings({ ...settings, is_auto_close_shift_enabled: e.target.checked })} 
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              <AnimatePresence>
                {settings.is_auto_close_shift_enabled && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden space-y-2 border-t border-blue-200/30 dark:border-blue-800/30 pt-3 mt-1"
                  >
                    <label htmlFor="shiftClosingBufferMinutes" className="text-xs font-bold text-text-light dark:text-text-dark mb-1.5 block">
                      Batas Waktu Rekap & Tutup Shift Kasir (Menit Setelah Tutup)
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3.5 top-3.5 h-5 w-5 text-muted" />
                      <input 
                        id="shiftClosingBufferMinutes" 
                        title="Batas Waktu Rekap Kasir" 
                        type="number" 
                        min="1" 
                        max="240"
                        value={settings.shift_closing_buffer_minutes || 30} 
                        onChange={e => setSettings({ ...settings, shift_closing_buffer_minutes: Number(e.target.value) })} 
                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900/30 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-text-light dark:text-text-dark font-medium shadow-sm" 
                      />
                    </div>
                    <p className="text-[11px] text-muted">Mengatur durasi hitung mundur dalam menit sebelum shift ditutup otomatis.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-border-light dark:border-border-dark pt-5 mt-5 space-y-4">
              <h3 className="font-black text-xs uppercase tracking-widest text-primary flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Manajemen Toleransi & Absensi
              </h3>

              <div>
                <label htmlFor="lateTolerance" className="text-sm font-medium text-text-light dark:text-text-dark mb-1.5 block">
                  Batas Toleransi Keterlambatan (Menit)
                </label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-3.5 h-5 w-5 text-muted" />
                  <input 
                    id="lateTolerance" 
                    title="Toleransi Keterlambatan"
                    type="number" 
                    min="0"
                    value={settings.late_tolerance_minutes} 
                    onChange={e => setSettings({ ...settings, late_tolerance_minutes: Number(e.target.value) })} 
                    className="w-full pl-11 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark font-black" 
                  />
                </div>
                <p className="text-[11px] text-muted mt-1">Maksimal menit keterlambatan sebelum status absensi dicatat sebagai TERLAMBAT secara otomatis.</p>
              </div>

              <div className="flex flex-col gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/30 mt-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-amber-800 dark:text-amber-400 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Potong Gaji Otomatis</p>
                    <p className="text-[11px] text-amber-700/70 dark:text-amber-500/70">Kalkulasi pemotongan nilai upah secara real-time berdasarkan akumulasi menit terlambat.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      aria-label="Aktifkan Potong Gaji"
                      checked={settings.auto_deduct_late_salary} 
                      onChange={e => setSettings({ ...settings, auto_deduct_late_salary: e.target.checked })} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
                {settings.auto_deduct_late_salary && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-3 border-t border-amber-200 dark:border-amber-800 mt-1 overflow-hidden">
                    <label className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-500 block mb-1.5">Total Menit Kerja Per Hari (Untuk Pembagi Gaji)</label>
                    <input 
                      type="number" 
                      value={settings.minutes_per_working_day} 
                      onChange={e => setSettings({ ...settings, minutes_per_working_day: Number(e.target.value) })} 
                      title="Total Menit Kerja Harian"
                      className="w-full bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5 text-sm font-bold text-amber-900 dark:text-amber-200 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <p className="text-[9px] text-amber-600 mt-1 italic font-medium">Standar industri: 8 Jam Kerja = 480 Menit.</p>
                  </motion.div>
                )}
              </div>
            </div>
            <div className="border-t border-border-light dark:border-border-dark pt-5 mt-5 space-y-4">
              <h3 className="font-black text-xs uppercase tracking-widest text-primary flex items-center gap-2">
                <CalendarDays className="w-4 h-4" /> Siklus Waktu Penggajian (Payroll)
              </h3>
              <p className="text-[11px] text-muted -mt-2">Mengatur siklus bulanan penarikan data absensi dan tanggal pembayaran gaji resmi.</p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="cutoffDate" className="text-xs font-black uppercase text-muted mb-1 block">Tanggal Tutup Buku (Cutoff)</label>
                  <div className="relative">
                    <input 
                      id="cutoffDate" 
                      type="number" 
                      min="1" max="31"
                      value={settings.cutoff_date} 
                      onChange={e => setSettings({ ...settings, cutoff_date: Number(e.target.value) })} 
                      title="Tanggal Tutup Buku Bulanan"
                      className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark font-black" 
                    />
                  </div>
                  <p className="text-[9px] text-muted mt-1">Batas akhir data absensi dihitung.</p>
                </div>

                <div>
                  <label htmlFor="paydayDate" className="text-xs font-black uppercase text-muted mb-1 block">Tanggal Transfer Gaji</label>
                  <div className="relative">
                    <input 
                      id="paydayDate" 
                      type="number" 
                      min="1" max="31"
                      value={settings.payday_date} 
                      onChange={e => setSettings({ ...settings, payday_date: Number(e.target.value) })} 
                      title="Tanggal Resmi Pencairan Gaji"
                      className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark font-black" 
                    />
                  </div>
                  <p className="text-[9px] text-muted mt-1">Target tanggal distribusi upah.</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border-light dark:border-border-dark pt-5 mt-5 space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-widest text-muted">Status Operasional (Override)</h3>

              <div className="flex flex-col gap-3 p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-text-light dark:text-text-dark">Buka 24 Jam Non-Stop</p>
                    <p className="text-[11px] text-muted">Abaikan jam operasional dan buka toko terus menerus</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      title="Buka 24 Jam Non-Stop"
                      aria-label="Buka 24 Jam Non-Stop"
                      checked={settings.is_24_hours || false} 
                      onChange={e => setSettings({ ...settings, is_24_hours: e.target.checked })} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>
              
              <div className="flex flex-col gap-3 p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-text-light dark:text-text-dark">Tutup Sementara Hari Ini</p>
                    <p className="text-[11px] text-muted">Override jam normal untuk menutup toko sementara</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      title="Tutup Sementara Hari Ini"
                      aria-label="Tutup Sementara Hari Ini"
                      checked={settings.is_temporary_closed || false} 
                      onChange={e => setSettings({ ...settings, is_temporary_closed: e.target.checked })} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {settings.is_temporary_closed && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: "auto" }} 
                    className="border-t border-border-light dark:border-border-dark pt-3 mt-1 space-y-2"
                  >
                    <label htmlFor="reopenTime" className="text-xs font-bold uppercase text-muted block">Pilih Jam Dibuka Kembali</label>
                    <input 
                      id="reopenTime"
                      type="time" 
                      value={settings.temporary_closed_reopen_time || "12:00"} 
                      onChange={e => setSettings({ ...settings, temporary_closed_reopen_time: e.target.value })} 
                      className="w-full px-4 py-2.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-medium" 
                    />
                    <p className="text-xs text-primary font-bold mt-1.5 bg-primary/5 p-2 rounded-xl border border-primary/10">
                      Tampilan di Banner: <span>resto sedang tutup sementara. Akan dibuka kembali pukul {settings.temporary_closed_reopen_time || "12:00"}</span>
                    </p>
                  </motion.div>
                )}
              </div>

              <div className="flex flex-col gap-3 p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-text-light dark:text-text-dark">Libur / Tutup Permanen Hari Ini</p>
                    <p className="text-[11px] text-muted">Menandai hari libur nasional atau tutup seharian penuh</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      title="Libur / Tutup Permanen Hari Ini"
                      aria-label="Libur / Tutup Permanen Hari Ini"
                      checked={settings.is_holiday || false} 
                      onChange={e => setSettings({ ...settings, is_holiday: e.target.checked })} 
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {settings.is_holiday && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: "auto" }} 
                    className="border-t border-border-light dark:border-border-dark pt-3 mt-1 space-y-2"
                  >
                    <label htmlFor="reopenDate" className="text-xs font-bold uppercase text-muted block">Pilih Tanggal Dibuka Kembali</label>
                    <input 
                      id="reopenDate"
                      type="date" 
                      value={(() => {
                        const raw = settings.holiday_reopen_date || "";
                        const isValidRawDate = /^\d{4}-\d{2}-\d{2}$/.test(raw);
                        if (isValidRawDate) return raw;
                        
                        // Default to tomorrow's date string (YYYY-MM-DD)
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        return tomorrow.toISOString().split('T')[0];
                      })()} 
                      onChange={e => setSettings({ ...settings, holiday_reopen_date: e.target.value })} 
                      className="w-full px-4 py-2.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-medium" 
                    />
                    {settings.holiday_reopen_date && (
                      <p className="text-xs text-primary font-bold mt-1.5 bg-primary/5 p-2 rounded-xl border border-primary/10">
                        Tampilan di Banner: <span className="underline">{formatToIndonesianDate(settings.holiday_reopen_date || new Date().toISOString().split('T')[0])}</span>
                      </p>
                    )}
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right Side - Merchant QRIS & E-Wallet Settings */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-cyan-600 to-blue-700 p-6 flex items-center gap-3 text-white">
            <QrCode className="w-8 h-8" />
            <div>
              <h2 className="text-xl font-bold">Kredensial Merchant Cashless</h2>
              <p className="text-white/80 text-sm">Konfigurasi generator kode QRIS & Deep Link E-Wallet</p>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <h3 className="font-bold text-xs uppercase tracking-widest text-muted border-b pb-2 mb-3">1. Data QRIS Bank Indonesia (EMVCo)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="merchName" className="text-xs font-bold uppercase text-muted mb-1 block">Nama Merchant</label>
                <input id="merchName" type="text" value={merchantSettings.merchantName} onChange={e => setMerchantSettings({ ...merchantSettings, merchantName: e.target.value })} className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" placeholder="RESTOBOOK POS" />
              </div>
              <div>
                <label htmlFor="merchCity" className="text-xs font-bold uppercase text-muted mb-1 block">Kota</label>
                <input id="merchCity" type="text" value={merchantSettings.city} onChange={e => setMerchantSettings({ ...merchantSettings, city: e.target.value })} className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" placeholder="JAKARTA" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="merchID" className="text-xs font-bold uppercase text-muted mb-1 block">Merchant ID (15 digit)</label>
                <input id="merchID" type="text" value={merchantSettings.merchantId} onChange={e => setMerchantSettings({ ...merchantSettings, merchantId: e.target.value })} className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" placeholder="ID1020304050607" />
              </div>
              <div>
                <label htmlFor="merchCode" className="text-xs font-bold uppercase text-muted mb-1 block">Merchant Code (GPN)</label>
                <input id="merchCode" type="text" value={merchantSettings.merchantCode} onChange={e => setMerchantSettings({ ...merchantSettings, merchantCode: e.target.value })} className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" placeholder="93600002" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="merchZip" className="text-xs font-bold uppercase text-muted mb-1 block">Kode Pos</label>
                <input id="merchZip" type="text" value={merchantSettings.postalCode} onChange={e => setMerchantSettings({ ...merchantSettings, postalCode: e.target.value })} className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" placeholder="12345" />
              </div>
              <div>
                <label htmlFor="merchCat" className="text-xs font-bold uppercase text-muted mb-1 block">Kategori (MCC - 4 digit)</label>
                <input id="merchCat" type="text" value={merchantSettings.categoryCode} onChange={e => setMerchantSettings({ ...merchantSettings, categoryCode: e.target.value })} className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" placeholder="5812" />
              </div>
            </div>

            <h3 className="font-bold text-xs uppercase tracking-widest text-muted border-b pb-2 mb-3 pt-4">2. Nomor Tujuan E-Wallet (Deep Link)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="gopayNum" className="text-xs font-bold uppercase text-muted mb-1 block">Nomor GoPay</label>
                <input id="gopayNum" type="tel" value={merchantSettings.gopay} onChange={e => setMerchantSettings({ ...merchantSettings, gopay: e.target.value })} className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" placeholder="08123456789" />
              </div>
              <div>
                <label htmlFor="ovoNum" className="text-xs font-bold uppercase text-muted mb-1 block">Nomor OVO</label>
                <input id="ovoNum" type="tel" value={merchantSettings.ovo} onChange={e => setMerchantSettings({ ...merchantSettings, ovo: e.target.value })} className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" placeholder="08123456789" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="danaNum" className="text-xs font-bold uppercase text-muted mb-1 block">Nomor Dana</label>
                <input id="danaNum" type="tel" value={merchantSettings.dana} onChange={e => setMerchantSettings({ ...merchantSettings, dana: e.target.value })} className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" placeholder="08123456789" />
              </div>
              <div>
                <label htmlFor="shopeeNum" className="text-xs font-bold uppercase text-muted mb-1 block">Nomor ShopeePay</label>
                <input id="shopeeNum" type="tel" value={merchantSettings.shopeepay} onChange={e => setMerchantSettings({ ...merchantSettings, shopeepay: e.target.value })} className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" placeholder="08123456789" />
              </div>
            </div>

            <div className="w-1/2">
              <label htmlFor="linkNum" className="text-xs font-bold uppercase text-muted mb-1 block">Nomor LinkAja</label>
              <input id="linkNum" type="tel" value={merchantSettings.linkaja} onChange={e => setMerchantSettings({ ...merchantSettings, linkaja: e.target.value })} className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-cyan-500" placeholder="08123456789" />
            </div>
          </div>
        </motion.div>
      </div>

      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving} className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-xl shadow-primary/30 mt-4 uppercase tracking-wider">
        {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Save className="w-6 h-6" /> Simpan Semua Konfigurasi</>}
      </motion.button>
      <Toaster position="top-center" />

      {/* CROP MODAL */}
      <AnimatePresence>
        {showCropModal && upImg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl max-w-lg w-full">
              <h3 className="text-xl font-black mb-4 text-gray-900 dark:text-white uppercase tracking-wider">Potong Logo</h3>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden flex items-center justify-center min-h-[300px] p-4">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                >
                  <img src={upImg} onLoad={(e) => onLoad(e.currentTarget)} alt="Upload Preview" style={{ maxHeight: '60vh' }} />
                </ReactCrop>
              </div>
              <p className="text-xs text-muted mt-3 text-center">Tarik ujung kotak untuk memotong gambar sesuka hati Anda.</p>
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowCropModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                  Batal
                </button>
                <button onClick={handleUploadCroppedLogo} className="px-5 py-2.5 rounded-xl font-black text-sm text-white bg-primary hover:bg-primary-hover shadow-lg shadow-primary/30 transition-all flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Unggah & Simpan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
