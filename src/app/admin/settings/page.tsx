"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, Save, Loader2, Store, MapPin, Phone, Mail, Clock,
  Upload, ImageIcon, ShieldAlert, DollarSign, CalendarDays,
  Power, ToggleLeft, AlarmClock, Users, Banknote, AlertTriangle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import BaseModal from "@/components/BaseModal";
import { formatToIndonesianDate } from "@/utils/operationalHours";
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useRef } from "react";


const cleanLeadingZero = (val: string): string => {
  if (!val) return "";
  if (val.startsWith("0") && val.length > 1 && val[1] !== ".") {
    return val.replace(/^0+/, "") || "0";
  }
  return val;
};


export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>({
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
    auto_alpha_enabled: true,
    minutes_per_working_day: 480,
    payday_date: 28,
    cutoff_date: 27,
    tax_percent: 10.00,
    payment_expiry_minutes: 60,
    is_maintenance_active: false,
    maintenance_start_time: "",
    maintenance_end_time: "",
    maintenance_message: "Sistem sedang dalam perbaikan untuk meningkatkan layanan. Sementara ini, proses transaksi dan pembayaran belum dapat digunakan. Silakan coba kembali nanti.",
    maintenance_estimated_hours: "2 Jam",
    resto_latitude: -7.7829,
    resto_longitude: 110.3323,
    shipping_rate_per_km: 2500,
    min_shipping_distance: 1,
    max_shipping_distance: 15,
    additional_zone_charge: 0,
    min_order_for_free_shipping: 100000,
    is_shipping_enabled: true
  });

  const [estimationSettings, setEstimationSettings] = useState<any>({
    dine_in_default_minutes: 15,
    takeaway_default_minutes: 20,
    delivery_default_minutes: 30,
    pickup_default_minutes: 20,
    min_minutes: 5,
    max_minutes: 120,
    busy_multiplier_minutes: 10,
    per_item_addition_minutes: 2,
    delivery_per_km_minutes: 5,
    is_busy_active: false,
    is_auto_estimation_active: true,
    is_warning_active: true,
    is_auto_late_active: true,
    is_distance_estimation_active: true,
    is_item_addition_active: true
  });

  const [reservationSettings, setReservationSettings] = useState<any>({
    duration_minutes: 120,
    auto_release_enabled: true,
    late_tolerance_minutes: 15
  });
  const [initialReservationSettings, setInitialReservationSettings] = useState<any>(null);

  const [maintenanceLogs, setMaintenanceLogs] = useState<any[]>([]);
  const [expiryHoursInput, setExpiryHoursInput] = useState<string>("1");
  const [expiryMinutesInput, setExpiryMinutesInput] = useState<string>("0");
  const [expirySecondsInput, setExpirySecondsInput] = useState<string>("0");

  const supabase = createClient();

  const fetchMaintenanceLogs = async () => {
    try {
      const { data } = await supabase
        .from('maintenance_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setMaintenanceLogs(data);
    } catch (err) {
      console.error("Gagal memuat log maintenance:", err);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchMaintenanceLogs();

    const settingsChannel = supabase
      .channel('admin-settings-sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurant_settings' }, (payload: any) => {
        if (payload.new) {
          setSettings((prev: any) => ({
            ...prev,
            is_maintenance_active: !!payload.new.is_maintenance_active,
            maintenance_start_time: payload.new.maintenance_start_time ? new Date(payload.new.maintenance_start_time).toISOString().substring(0, 16) : "",
            maintenance_end_time: payload.new.maintenance_end_time ? new Date(payload.new.maintenance_end_time).toISOString().substring(0, 16) : "",
            maintenance_message: payload.new.maintenance_message || "",
            maintenance_estimated_hours: payload.new.maintenance_estimated_hours || "2 Jam",
          }));
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'maintenance_logs' }, () => {
        fetchMaintenanceLogs();
      })
      .subscribe();

    return () => { supabase.removeChannel(settingsChannel); };
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from("restaurant_settings").select("*").single();
      if (data) {
        const expiryMin = data.payment_expiry_minutes !== null && data.payment_expiry_minutes !== undefined ? Number(data.payment_expiry_minutes) : 60;
        setSettings({
          ...settings,
          ...data,
          is_24_hours: !!data.is_24_hours,
          close_warning_minutes: data.close_warning_minutes !== null ? Number(data.close_warning_minutes) : 10,
          customer_warning_minutes: data.customer_warning_minutes !== null ? Number(data.customer_warning_minutes) : 15,
          shift_closing_buffer_minutes: data.shift_closing_buffer_minutes !== null ? Number(data.shift_closing_buffer_minutes) : 30,
          is_auto_close_shift_enabled: data.is_auto_close_shift_enabled !== undefined && data.is_auto_close_shift_enabled !== null ? !!data.is_auto_close_shift_enabled : true,
          late_tolerance_minutes: data.late_tolerance_minutes !== null ? Number(data.late_tolerance_minutes) : 15,
          auto_deduct_late_salary: !!data.auto_deduct_late_salary,
          auto_alpha_enabled: data.auto_alpha_enabled !== undefined && data.auto_alpha_enabled !== null ? !!data.auto_alpha_enabled : true,
          minutes_per_working_day: data.minutes_per_working_day !== null ? Number(data.minutes_per_working_day) : 480,
          payday_date: data.payday_date !== null ? Number(data.payday_date) : 28,
          cutoff_date: data.cutoff_date !== null ? Number(data.cutoff_date) : 27,
          tax_percent: data.tax_percent !== null ? Number(data.tax_percent) : 10.00,
          payment_expiry_minutes: expiryMin,
          is_maintenance_active: !!data.is_maintenance_active,
          maintenance_start_time: data.maintenance_start_time ? new Date(data.maintenance_start_time).toISOString().substring(0, 16) : "",
          maintenance_end_time: data.maintenance_end_time ? new Date(data.maintenance_end_time).toISOString().substring(0, 16) : "",
          maintenance_message: data.maintenance_message || "Sistem sedang dalam perbaikan untuk meningkatkan layanan. Sementara ini, proses transaksi dan pembayaran belum dapat digunakan. Silakan coba kembali nanti.",
          maintenance_estimated_hours: data.maintenance_estimated_hours || "2 Jam",
          resto_latitude: data.resto_latitude !== null && data.resto_latitude !== undefined ? Number(data.resto_latitude) : -7.7829,
          resto_longitude: data.resto_longitude !== null && data.resto_longitude !== undefined ? Number(data.resto_longitude) : 110.3323,
          shipping_rate_per_km: data.shipping_rate_per_km !== null && data.shipping_rate_per_km !== undefined ? Number(data.shipping_rate_per_km) : 2500,
          min_shipping_distance: data.min_shipping_distance !== null && data.min_shipping_distance !== undefined ? Number(data.min_shipping_distance) : 1,
          max_shipping_distance: data.max_shipping_distance !== null && data.max_shipping_distance !== undefined ? Number(data.max_shipping_distance) : 15,
          additional_zone_charge: data.additional_zone_charge !== null && data.additional_zone_charge !== undefined ? Number(data.additional_zone_charge) : 0,
          min_order_for_free_shipping: data.min_order_for_free_shipping !== null && data.min_order_for_free_shipping !== undefined ? Number(data.min_order_for_free_shipping) : 100000,
          is_shipping_enabled: data.is_shipping_enabled !== undefined && data.is_shipping_enabled !== null ? !!data.is_shipping_enabled : true,
        });
        const totalSec = Math.round(expiryMin * 60);
        setExpiryHoursInput(Math.floor(totalSec / 3600).toString());
        setExpiryMinutesInput(Math.floor((totalSec % 3600) / 60).toString());
        setExpirySecondsInput((totalSec % 60).toString());

        if (data.reservation_settings) {
          const resSettings = typeof data.reservation_settings === "string"
            ? JSON.parse(data.reservation_settings)
            : data.reservation_settings;
          const resObj = {
            duration_minutes: resSettings?.duration_minutes !== undefined ? Number(resSettings.duration_minutes) : 120,
            auto_release_enabled: resSettings?.auto_release_enabled !== undefined ? !!resSettings.auto_release_enabled : true,
            late_tolerance_minutes: resSettings?.late_tolerance_minutes !== undefined ? Number(resSettings.late_tolerance_minutes) : 15
          };
          setReservationSettings(resObj);
          setInitialReservationSettings(resObj);
        }
      }

      const { data: estData } = await supabase
        .from("order_estimation_settings")
        .select("*")
        .eq("id", "88888888-8888-8888-8888-888888888888")
        .single();
      if (estData) {
        setEstimationSettings({
          dine_in_default_minutes: Number(estData.dine_in_default_minutes),
          takeaway_default_minutes: Number(estData.takeaway_default_minutes),
          delivery_default_minutes: Number(estData.delivery_default_minutes),
          pickup_default_minutes: Number(estData.pickup_default_minutes),
          min_minutes: Number(estData.min_minutes),
          max_minutes: Number(estData.max_minutes),
          busy_multiplier_minutes: Number(estData.busy_multiplier_minutes),
          per_item_addition_minutes: Number(estData.per_item_addition_minutes),
          delivery_per_km_minutes: Number(estData.delivery_per_km_minutes),
          is_busy_active: !!estData.is_busy_active,
          is_auto_estimation_active: !!estData.is_auto_estimation_active,
          is_warning_active: !!estData.is_warning_active,
          is_auto_late_active: !!estData.is_auto_late_active,
          is_distance_estimation_active: !!estData.is_distance_estimation_active,
          is_item_addition_active: !!estData.is_item_addition_active
        });
      }
    } catch (e: any) { console.error(e); } finally { setLoading(false); }
  };

  const [uploading, setUploading] = useState(false);
  const [upImg, setUpImg] = useState<any>();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: '%', width: 50, height: 50, x: 25, y: 25 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropTarget, setCropTarget] = useState<"logo" | "favicon">("logo");
  const [faviconVersion, setFaviconVersion] = useState<number>(Date.now());

  const onSelectLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCropTarget("logo");
      const reader = new FileReader();
      reader.addEventListener('load', () => setUpImg(reader.result));
      reader.readAsDataURL(e.target.files[0]);
      setShowCropModal(true);
      setCrop({ unit: '%', width: 50, height: 50, x: 25, y: 25 });
    }
  };

  const onSelectFaviconFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCropTarget("favicon");
      const reader = new FileReader();
      reader.addEventListener('load', () => setUpImg(reader.result));
      reader.readAsDataURL(e.target.files[0]);
      setShowCropModal(true);
      setCrop({ unit: '%', width: 50, height: 50, x: 25, y: 25 });
    }
  };

  const onLoad = (img: HTMLImageElement) => { imgRef.current = img; };

  const getCroppedImg = (image: HTMLImageElement, crop: PixelCrop, fileName: string): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject("No 2d context");
    ctx.drawImage(image, crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY, 0, 0, crop.width, crop.height);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Canvas is empty')); return; }
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
      const file = new File([croppedBlob], cropTarget === 'favicon' ? 'favicon.png' : `res_logo_${Date.now()}.png`, { type: 'image/png' });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "logos");
      if (cropTarget === 'favicon') formData.append("customFileName", "favicon.png");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `Gagal mengunggah ${cropTarget}`);
      if (cropTarget === 'logo') {
        if (settings.id) await supabase.from("restaurant_settings").update({ logo_url: result.url }).eq("id", settings.id);
        setSettings((prev: any) => ({ ...prev, logo_url: result.url }));
        toast.success("Logo berhasil diperbarui!");
      } else {
        if (settings.id) await supabase.from("restaurant_settings").update({ updated_at: new Date().toISOString() }).eq("id", settings.id);
        setFaviconVersion(Date.now());
        toast.success("Favicon berhasil diperbarui!");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      setUpImg(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: currentDbSettings } = await supabase.from("restaurant_settings").select("is_maintenance_active").eq("id", settings.id).single();
      const wasActive = currentDbSettings?.is_maintenance_active || false;
      const isNowActive = settings.is_maintenance_active;

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
        auto_alpha_enabled: settings.auto_alpha_enabled,
        minutes_per_working_day: Number(settings.minutes_per_working_day || 480),
        payday_date: Number(settings.payday_date || 28),
        cutoff_date: Number(settings.cutoff_date || 27),
        tax_percent: Number(settings.tax_percent !== undefined ? settings.tax_percent : 10.00),
        payment_expiry_minutes: Number(settings.payment_expiry_minutes || 60),
        is_maintenance_active: settings.is_maintenance_active,
        maintenance_start_time: settings.maintenance_start_time ? new Date(settings.maintenance_start_time).toISOString() : null,
        maintenance_end_time: settings.maintenance_end_time ? new Date(settings.maintenance_end_time).toISOString() : null,
        maintenance_message: settings.maintenance_message,
        maintenance_estimated_hours: settings.maintenance_estimated_hours,
        resto_latitude: Number(settings.resto_latitude || -7.7829),
        resto_longitude: Number(settings.resto_longitude || 110.3323),
        shipping_rate_per_km: Number(settings.shipping_rate_per_km || 0),
        min_shipping_distance: Number(settings.min_shipping_distance || 0),
        max_shipping_distance: Number(settings.max_shipping_distance || 0),
        additional_zone_charge: Number(settings.additional_zone_charge || 0),
        min_order_for_free_shipping: Number(settings.min_order_for_free_shipping || 0),
        is_shipping_enabled: settings.is_shipping_enabled,
        reservation_settings: reservationSettings,
      }).eq("id", settings.id);
      if (error) throw error;

      // Check if late_tolerance_minutes changed and log it
      const oldTolerance = initialReservationSettings?.late_tolerance_minutes !== undefined ? initialReservationSettings.late_tolerance_minutes : 15;
      const newTolerance = reservationSettings.late_tolerance_minutes !== undefined && reservationSettings.late_tolerance_minutes !== "" ? Number(reservationSettings.late_tolerance_minutes) : 15;
      
      if (oldTolerance !== newTolerance) {
        const { data: { user } } = await supabase.auth.getUser();
        let adminName = "Admin";
        let adminProfileId = null;
        if (user) {
          const { data: prof } = await supabase.from('profiles').select('id, full_name').eq('user_id', user.id).single();
          if (prof) {
            adminName = prof.full_name;
            adminProfileId = prof.id;
          }
        }
        await supabase.from('audit_logs').insert({
          action: 'update_reservation_tolerance',
          operator_id: adminProfileId,
          operator_name: adminName,
          target_id: settings.id,
          target_name: 'restaurant_settings',
          data_before: { late_tolerance_minutes: oldTolerance },
          data_after: { late_tolerance_minutes: newTolerance },
          browser: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server',
          device: 'Web Client'
        });
        setInitialReservationSettings((prev: any) => ({ ...prev, late_tolerance_minutes: newTolerance }));
      }

      const { error: estError } = await supabase
        .from("order_estimation_settings")
        .update({
          dine_in_default_minutes: Number(estimationSettings.dine_in_default_minutes),
          takeaway_default_minutes: Number(estimationSettings.takeaway_default_minutes),
          delivery_default_minutes: Number(estimationSettings.delivery_default_minutes),
          pickup_default_minutes: Number(estimationSettings.pickup_default_minutes),
          min_minutes: Number(estimationSettings.min_minutes),
          max_minutes: Number(estimationSettings.max_minutes),
          busy_multiplier_minutes: Number(estimationSettings.busy_multiplier_minutes),
          per_item_addition_minutes: Number(estimationSettings.per_item_addition_minutes),
          delivery_per_km_minutes: Number(estimationSettings.delivery_per_km_minutes),
          is_busy_active: !!estimationSettings.is_busy_active,
          is_auto_estimation_active: !!estimationSettings.is_auto_estimation_active,
          is_warning_active: !!estimationSettings.is_warning_active,
          is_auto_late_active: !!estimationSettings.is_auto_late_active,
          is_distance_estimation_active: !!estimationSettings.is_distance_estimation_active,
          is_item_addition_active: !!estimationSettings.is_item_addition_active,
          updated_at: new Date().toISOString()
        })
        .eq("id", "88888888-8888-8888-8888-888888888888");
      if (estError) throw estError;

      if (wasActive !== isNowActive) {
        const { data: { user } } = await supabase.auth.getUser();
        let actedByName = "Admin";
        let actedById = null;
        if (user) {
          actedById = user.id;
          const { data: prof } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).single();
          if (prof) actedByName = prof.full_name;
        }
        await supabase.from('maintenance_logs').insert({
          action: isNowActive ? 'activate' : 'deactivate',
          acted_by: actedById,
          acted_by_name: actedByName,
          message: settings.maintenance_message,
          scheduled_start: settings.maintenance_start_time ? new Date(settings.maintenance_start_time).toISOString() : null,
          scheduled_end: settings.maintenance_end_time ? new Date(settings.maintenance_end_time).toISOString() : null
        });
        fetchMaintenanceLogs();
      }

      const broadcastChannel = supabase.channel("settings-sync-channel");
      broadcastChannel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await broadcastChannel.send({ type: "broadcast", event: "settings_updated", payload: {} });
        }
      });

      toast.success("Pengaturan berhasil disimpan!");
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  // Toggle component helper
  const Toggle = ({ 
    checked, 
    onChange, 
    colorClass = "peer-checked:bg-primary", 
    title = "Aktifkan/Nonaktifkan" 
  }: { 
    checked: boolean; 
    onChange: (v: boolean) => void; 
    colorClass?: string; 
    title?: string;
  }) => (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={e => onChange(e.target.checked)} 
        className="sr-only peer" 
        title={title}
        aria-label={title}
      />
      <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${colorClass}`} />
    </label>
  );

  return (
    <div className="max-w-5xl mx-auto pb-24 p-4 sm:p-6 space-y-6">

      {/* PAGE HEADER */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-light dark:text-text-dark">Pengaturan</h1>
        <p className="text-muted mt-1 text-sm">Kelola informasi restoran & konfigurasi sistem</p>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ROW 1: Informasi Restoran + Mode Maintenance */}
      {/* ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Informasi Restoran ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-primary to-primary-hover p-5 flex items-center gap-3 text-white">
            <Settings className="w-6 h-6 shrink-0" />
            <div>
              <h2 className="text-lg font-bold">Informasi Restoran</h2>
              <p className="text-white/75 text-xs">Data yang tampil di halaman utama</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Logo & Favicon upload in one row */}
            <div className="flex gap-3 pb-4 border-b border-border-light dark:border-border-dark">
              {/* Logo */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-14 w-14 shrink-0 bg-background-light dark:bg-background-dark border-2 border-dashed border-muted/40 rounded-xl flex items-center justify-center overflow-hidden relative">
                  {settings.logo_url ? (
                    <img src={settings.logo_url} alt="Logo" className="h-full w-full object-contain p-1 bg-white" />
                  ) : (
                    <ImageIcon className="text-muted h-5 w-5 opacity-40" />
                  )}
                  {uploading && cropTarget === 'logo' && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="animate-spin text-white w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-text-light dark:text-text-dark truncate">Logo Bisnis</p>
                  <label className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg text-xs font-bold cursor-pointer hover:border-primary transition-all">
                    <Upload className="w-3 h-3 text-primary" />
                    {uploading && cropTarget === 'logo' ? "Proses..." : "Unggah"}
                    <input type="file" accept="image/*" className="hidden" onChange={onSelectLogoFile} disabled={uploading} />
                  </label>
                </div>
              </div>

              <div className="w-px bg-border-light dark:bg-border-dark" />

              {/* Favicon */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-14 w-14 shrink-0 bg-background-light dark:bg-background-dark border-2 border-dashed border-muted/40 rounded-xl flex items-center justify-center overflow-hidden relative">
                  {process.env.NEXT_PUBLIC_SUPABASE_URL ? (
                    <img
                      src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logos/favicon.png?v=${faviconVersion}`}
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                      alt="Favicon" className="h-full w-full object-contain p-2 bg-white"
                    />
                  ) : (
                    <ImageIcon className="text-muted h-5 w-5 opacity-40" />
                  )}
                  {uploading && cropTarget === 'favicon' && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="animate-spin text-white w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-xs text-text-light dark:text-text-dark truncate">Favicon Tab</p>
                  <label className="inline-flex items-center gap-1.5 mt-1.5 px-3 py-1.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg text-xs font-bold cursor-pointer hover:border-primary transition-all">
                    <Upload className="w-3 h-3 text-primary" />
                    {uploading && cropTarget === 'favicon' ? "Proses..." : "Unggah"}
                    <input type="file" accept="image/*" className="hidden" onChange={onSelectFaviconFile} disabled={uploading} />
                  </label>
                </div>
              </div>
            </div>

            {/* Name, Address, Phone, Email */}
            {[
              { id: "setName", label: "Nama Restoran", icon: Store, value: settings.name, key: "name", type: "text" },
              { id: "setAddr", label: "Alamat", icon: MapPin, value: settings.address, key: "address", type: "text" },
              { id: "setPhone", label: "No. Telepon", icon: Phone, value: settings.phone, key: "phone", type: "tel" },
              { id: "setEmail", label: "Email", icon: Mail, value: settings.email, key: "email", type: "email" },
            ].map(f => (
              <div key={f.id}>
                <label htmlFor={f.id} className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">{f.label}</label>
                <div className="relative">
                  <f.icon className="absolute left-3 top-3 h-4 w-4 text-muted" />
                  <input id={f.id} type={f.type} value={f.value || ""} onChange={e => setSettings({ ...settings, [f.key]: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark text-sm" />
                </div>
              </div>
            ))}

            {/* Tax */}
            <div>
              <label htmlFor="setTax" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Pajak Restoran (%)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted" />
                <input id="setTax" type="number" value={settings.tax_percent ?? ""} onChange={e => setSettings({ ...settings, tax_percent: cleanLeadingZero(e.target.value) })}
                  className="w-full pl-10 pr-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark text-sm" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Mode Maintenance ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-5 flex items-center gap-3 text-white">
            <ShieldAlert className="w-6 h-6 shrink-0 animate-pulse" />
            <div>
              <h2 className="text-lg font-bold">Mode Maintenance</h2>
              <p className="text-white/75 text-xs">Blokir transaksi pelanggan & kasir</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Main toggle */}
            <div className={`flex items-center justify-between gap-3 p-4 rounded-2xl border-2 transition-all ${settings.is_maintenance_active ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'}`}>
              <div className="min-w-0">
                <p className="font-bold text-sm text-text-light dark:text-text-dark">Status Maintenance</p>
                <p className="text-[11px] text-muted mt-0.5">Aktifkan untuk memblokir checkout, top-up & verifikasi transaksi</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${settings.is_maintenance_active ? "bg-red-500 text-white" : "bg-emerald-500 text-white"}`}>
                  {settings.is_maintenance_active ? "Aktif" : "Nonaktif"}
                </span>
                <Toggle
                  checked={settings.is_maintenance_active}
                  onChange={v => setSettings({ ...settings, is_maintenance_active: v })}
                  colorClass="peer-checked:bg-red-500"
                  title="Status Mode Maintenance"
                />
              </div>
            </div>

            {/* Estimated hours */}
            <div>
              <label htmlFor="maintEst" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Estimasi Durasi</label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted" />
                <input id="maintEst" type="text" value={settings.maintenance_estimated_hours}
                  onChange={e => setSettings({ ...settings, maintenance_estimated_hours: e.target.value })}
                  placeholder="Contoh: 2 Jam, 30 Menit"
                  className="w-full pl-10 pr-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-orange-400 outline-none text-text-light dark:text-text-dark text-sm" />
              </div>
            </div>

            {/* Custom message */}
            <div>
              <label htmlFor="maintMsg" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Pesan Kustom</label>
              <textarea id="maintMsg" rows={3} value={settings.maintenance_message}
                onChange={e => setSettings({ ...settings, maintenance_message: e.target.value })}
                placeholder="Pesan yang akan ditampilkan saat maintenance..."
                className="w-full p-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-orange-400 outline-none text-text-light dark:text-text-dark text-sm resize-none" />
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="maintStart" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Jadwal Mulai</label>
                <input id="maintStart" type="datetime-local" value={settings.maintenance_start_time}
                  onChange={e => setSettings({ ...settings, maintenance_start_time: e.target.value })}
                  className="w-full px-3 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-orange-400 text-text-light dark:text-text-dark text-xs" />
              </div>
              <div>
                <label htmlFor="maintEnd" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Jadwal Selesai</label>
                <input id="maintEnd" type="datetime-local" value={settings.maintenance_end_time}
                  onChange={e => setSettings({ ...settings, maintenance_end_time: e.target.value })}
                  className="w-full px-3 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-orange-400 text-text-light dark:text-text-dark text-xs" />
              </div>
            </div>

            {/* Info card */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/30 text-xs text-amber-800 dark:text-amber-300 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Ketentuan Pembatasan:</p>
              <p className="flex items-start gap-1.5"><span className="text-amber-500 font-bold mt-0.5">•</span><span>Admin tetap bisa mengakses semua menu pengaturan.</span></p>
              <p className="flex items-start gap-1.5"><span className="text-amber-500 font-bold mt-0.5">•</span><span>Pelanggan & Kasir diblokir dari checkout, dompet, poin & POS.</span></p>
            </div>

            {/* Audit log */}
            {maintenanceLogs.length > 0 && (
              <div className="border-t border-border-light dark:border-border-dark pt-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5 mb-2">
                  <CalendarDays className="w-3.5 h-3.5" /> Riwayat Terakhir
                </p>
                <div className="space-y-1.5">
                  {maintenanceLogs.slice(0, 3).map((log: any) => (
                    <div key={log.id} className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] shrink-0 ${log.action === "activate" ? "bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"}`}>
                        {log.action === "activate" ? "Aktif" : "Nonaktif"}
                      </span>
                      <span className="text-muted truncate">{log.acted_by_name || "Sistem"} — {new Date(log.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ROW 2: Jam Operasional + Status Override */}
      {/* ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Jam Operasional ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-sky-500 to-blue-600 p-5 flex items-center gap-3 text-white">
            <AlarmClock className="w-6 h-6 shrink-0" />
            <div>
              <h2 className="text-lg font-bold">Jam Operasional</h2>
              <p className="text-white/75 text-xs">Atur waktu buka & tutup restoran</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Jam Buka & Tutup */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="setOpen" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Jam Buka</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-4 w-4 text-muted" />
                  <input id="setOpen" type="time" value={settings.opening_time || "08:00"}
                    onChange={e => setSettings({ ...settings, opening_time: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-sky-400 outline-none text-text-light dark:text-text-dark text-sm" />
                </div>
              </div>
              <div>
                <label htmlFor="setClose" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Jam Tutup</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-4 w-4 text-muted" />
                  <input id="setClose" type="time" value={settings.closing_time || "22:00"}
                    onChange={e => setSettings({ ...settings, closing_time: e.target.value })}
                    className="w-full pl-10 pr-3 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-sky-400 outline-none text-text-light dark:text-text-dark text-sm" />
                </div>
              </div>
            </div>

            {/* Warning minutes */}
            <div>
              <label htmlFor="warningMinutes" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Peringatan Menjelang Tutup (Menit)</label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted" />
                <input id="warningMinutes" type="number" min="1" max="120"
                  value={settings.customer_warning_minutes ?? ""}
                  onChange={e => { const val = cleanLeadingZero(e.target.value); setSettings({ ...settings, close_warning_minutes: val, customer_warning_minutes: val }); }}
                  className="w-full pl-10 pr-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-sky-400 outline-none text-text-light dark:text-text-dark text-sm" />
              </div>
              <p className="text-[11px] text-muted mt-1">Banner peringatan muncul sekian menit sebelum jam tutup.</p>
            </div>

            {/* Tutup Shift Otomatis */}
            <div className="flex flex-col gap-3 p-4 bg-blue-50/50 dark:bg-blue-950/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-blue-900 dark:text-blue-300">Tutup Shift Otomatis</p>
                  <p className="text-[11px] text-blue-700/70 dark:text-blue-400/70">Hitung mundur paksa setelah jam operasional berakhir</p>
                </div>
                <Toggle
                  checked={settings.is_auto_close_shift_enabled}
                  onChange={v => setSettings({ ...settings, is_auto_close_shift_enabled: v })}
                  colorClass="peer-checked:bg-blue-600"
                  title="Tutup Shift Otomatis"
                />
              </div>
              <AnimatePresence>
                {settings.is_auto_close_shift_enabled && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden border-t border-blue-200/30 dark:border-blue-800/30 pt-3 mt-1 space-y-2">
                    <label htmlFor="shiftBuffer" className="text-xs font-bold text-text-light dark:text-text-dark block">Batas Waktu Rekap Kasir (Menit Setelah Tutup)</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                      <input id="shiftBuffer" type="number" min="1" max="240"
                        value={settings.shift_closing_buffer_minutes ?? ""}
                        onChange={e => setSettings({ ...settings, shift_closing_buffer_minutes: cleanLeadingZero(e.target.value) })}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900/30 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-text-light dark:text-text-dark" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* ── Status Operasional Override ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-violet-500 to-purple-700 p-5 flex items-center gap-3 text-white">
            <Power className="w-6 h-6 shrink-0" />
            <div>
              <h2 className="text-lg font-bold">Status Override</h2>
              <p className="text-white/75 text-xs">Override jam normal untuk kondisi khusus</p>
            </div>
          </div>

          <div className="p-5 space-y-3">
            {/* Buka 24 jam */}
            <div className="flex items-center justify-between gap-3 p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
              <div className="min-w-0">
                <p className="font-bold text-sm text-text-light dark:text-text-dark">Buka 24 Jam</p>
                <p className="text-[11px] text-muted">Abaikan jam operasional, toko selalu buka</p>
              </div>
              <Toggle checked={settings.is_24_hours || false} onChange={v => setSettings({ ...settings, is_24_hours: v })} title="Buka 24 Jam" />
            </div>

            {/* Tutup sementara */}
            <div className="flex flex-col gap-3 p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-text-light dark:text-text-dark">Tutup Sementara Hari Ini</p>
                  <p className="text-[11px] text-muted">Override jam normal untuk tutup sementara</p>
                </div>
                <Toggle checked={settings.is_temporary_closed || false} onChange={v => setSettings({ ...settings, is_temporary_closed: v })} title="Tutup Sementara Hari Ini" />
              </div>
              <AnimatePresence>
                {settings.is_temporary_closed && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="border-t border-border-light dark:border-border-dark pt-3 overflow-hidden space-y-2">
                    <label htmlFor="reopenTime" className="text-xs font-bold uppercase text-muted block">Jam Dibuka Kembali</label>
                    <input id="reopenTime" type="time" value={settings.temporary_closed_reopen_time || "12:00"}
                      onChange={e => setSettings({ ...settings, temporary_closed_reopen_time: e.target.value })}
                      className="w-full px-4 py-2.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm" />
                    <p className="text-xs text-primary font-bold bg-primary/5 p-2 rounded-xl border border-primary/10">
                      Banner: resto sedang tutup sementara. Dibuka kembali pukul {settings.temporary_closed_reopen_time || "12:00"}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Libur / Tutup Permanen */}
            <div className="flex flex-col gap-3 p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-text-light dark:text-text-dark">Libur / Tutup Hari Ini</p>
                  <p className="text-[11px] text-muted">Tandai hari libur atau tutup seharian</p>
                </div>
                <Toggle checked={settings.is_holiday || false} onChange={v => setSettings({ ...settings, is_holiday: v })} title="Libur / Tutup Hari Ini" />
              </div>
              <AnimatePresence>
                {settings.is_holiday && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="border-t border-border-light dark:border-border-dark pt-3 overflow-hidden space-y-2">
                    <label htmlFor="holidayDate" className="text-xs font-bold uppercase text-muted block">Tanggal Dibuka Kembali</label>
                    <input id="holidayDate" type="date"
                      value={(() => {
                        const raw = settings.holiday_reopen_date || "";
                        if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
                        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
                        return tomorrow.toISOString().split('T')[0];
                      })()}
                      onChange={e => setSettings({ ...settings, holiday_reopen_date: e.target.value })}
                      className="w-full px-4 py-2.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm" />
                    {settings.holiday_reopen_date && (
                      <p className="text-xs text-primary font-bold bg-primary/5 p-2 rounded-xl border border-primary/10">
                        Banner: {formatToIndonesianDate(settings.holiday_reopen_date || new Date().toISOString().split('T')[0])}
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ROW 3: Batas Waktu Pembayaran + Absensi */}
      {/* ═══════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Batas Waktu Pembayaran Online ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-5 flex items-center gap-3 text-white">
            <Clock className="w-6 h-6 shrink-0" />
            <div>
              <h2 className="text-lg font-bold">Batas Waktu Pembayaran</h2>
              <p className="text-white/75 text-xs">Durasi bagi pelanggan menyelesaikan pembayaran</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: "expiryHours", label: "Jam", value: expiryHoursInput, onChange: (val: string) => { const cleaned = cleanLeadingZero(val); setExpiryHoursInput(cleaned); const h = cleaned === "" ? 0 : Number(cleaned); const m = expiryMinutesInput === "" ? 0 : Number(expiryMinutesInput); const s = expirySecondsInput === "" ? 0 : Number(expirySecondsInput); setSettings((prev: any) => ({ ...prev, payment_expiry_minutes: (h * 60) + m + (s / 60) })); } },
                { id: "expiryMinutes", label: "Menit", value: expiryMinutesInput, onChange: (val: string) => { const cleaned = cleanLeadingZero(val); setExpiryMinutesInput(cleaned); const h = expiryHoursInput === "" ? 0 : Number(expiryHoursInput); const m = cleaned === "" ? 0 : Number(cleaned); const s = expirySecondsInput === "" ? 0 : Number(expirySecondsInput); setSettings((prev: any) => ({ ...prev, payment_expiry_minutes: (h * 60) + m + (s / 60) })); } },
                { id: "expirySeconds", label: "Detik", value: expirySecondsInput, onChange: (val: string) => { const cleaned = cleanLeadingZero(val); setExpirySecondsInput(cleaned); const h = expiryHoursInput === "" ? 0 : Number(expiryHoursInput); const m = expiryMinutesInput === "" ? 0 : Number(expiryMinutesInput); const s = cleaned === "" ? 0 : Number(cleaned); setSettings((prev: any) => ({ ...prev, payment_expiry_minutes: (h * 60) + m + (s / 60) })); } },
              ].map(field => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="text-[10px] text-muted font-bold block uppercase tracking-wider mb-1">{field.label}</label>
                  <div className="relative">
                    <Clock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted" />
                    <input id={field.id} type="number" min="0" max={field.label !== "Jam" ? "59" : undefined}
                      placeholder="0" value={field.value} onChange={e => field.onChange(e.target.value)}
                      className="w-full pl-8 pr-2 py-2 text-sm bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-teal-400 text-text-light dark:text-text-dark font-medium" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted">Batas waktu bagi pelanggan untuk menyelesaikan pembayaran non-tunai sebelum pesanan dibatalkan otomatis.</p>
          </div>
        </motion.div>

        {/* ── Absensi & Toleransi ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-rose-500 to-pink-700 p-5 flex items-center gap-3 text-white">
            <Users className="w-6 h-6 shrink-0" />
            <div>
              <h2 className="text-lg font-bold">Absensi & Toleransi</h2>
              <p className="text-white/75 text-xs">Atur toleransi keterlambatan karyawan</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Toleransi terlambat */}
            <div>
              <label htmlFor="lateTolerance" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Toleransi Keterlambatan (Menit)</label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted" />
                <input id="lateTolerance" type="number" min="0" value={settings.late_tolerance_minutes ?? ""}
                  onChange={e => setSettings({ ...settings, late_tolerance_minutes: cleanLeadingZero(e.target.value) })}
                  className="w-full pl-10 pr-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-rose-400 outline-none text-text-light dark:text-text-dark text-sm" />
              </div>
              <p className="text-[11px] text-muted mt-1">Menit maksimal sebelum absensi dicatat TERLAMBAT otomatis.</p>
            </div>

            {/* Auto Alpha Toggle */}
            <div className="flex flex-col gap-3 p-4 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/30">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-rose-800 dark:text-rose-400 flex items-center gap-1.5"><AlarmClock className="w-4 h-4" /> Tandai ALPHA Otomatis</p>
                  <p className="text-[11px] text-rose-700/70 dark:text-rose-500/70">Jika diaktifkan, karyawan yang tidak absen hingga akhir shift otomatis ditandai ALPHA</p>
                </div>
                <Toggle 
                  checked={settings.auto_alpha_enabled} 
                  onChange={v => setSettings({ ...settings, auto_alpha_enabled: v })} 
                  colorClass="peer-checked:bg-rose-500" 
                  title="Tandai ALPHA Otomatis" 
                />
              </div>
            </div>

            {/* Potong gaji otomatis */}
            <div className="flex flex-col gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900/30">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-amber-800 dark:text-amber-400 flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> Potong Gaji Otomatis</p>
                  <p className="text-[11px] text-amber-700/70 dark:text-amber-500/70">Kalkulasi pemotongan gaji berdasarkan menit terlambat</p>
                </div>
                <Toggle checked={settings.auto_deduct_late_salary} onChange={v => setSettings({ ...settings, auto_deduct_late_salary: v })} colorClass="peer-checked:bg-amber-500" title="Potong Gaji Otomatis" />
              </div>
              <AnimatePresence>
                {settings.auto_deduct_late_salary && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden pt-3 border-t border-amber-200 dark:border-amber-800 mt-1">
                    <label htmlFor="minutesPerWorkingDay" className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-500 block mb-1.5">Total Menit Kerja Per Hari</label>
                    <input id="minutesPerWorkingDay" type="number" value={settings.minutes_per_working_day ?? ""}
                      onChange={e => setSettings({ ...settings, minutes_per_working_day: cleanLeadingZero(e.target.value) })}
                      className="w-full bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 text-sm font-bold text-amber-900 dark:text-amber-200 focus:ring-2 focus:ring-amber-500 outline-none" />
                    <p className="text-[9px] text-amber-600 mt-1 italic font-medium">Standar: 8 Jam Kerja = 480 Menit</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* ROW 4: Siklus Penggajian (full width compact) */}
      {/* ═══════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-500 to-violet-700 p-5 flex items-center gap-3 text-white">
          <Banknote className="w-6 h-6 shrink-0" />
          <div>
            <h2 className="text-lg font-bold">Siklus Penggajian (Payroll)</h2>
            <p className="text-white/75 text-xs">Atur siklus bulanan penarikan data absensi & tanggal gaji</p>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cutoffDate" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Tanggal Cutoff (Tutup Buku)</label>
              <input id="cutoffDate" type="number" min="1" max="31" value={settings.cutoff_date ?? ""}
                onChange={e => setSettings({ ...settings, cutoff_date: cleanLeadingZero(e.target.value) })}
                className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none text-text-light dark:text-text-dark text-sm font-bold" />
              <p className="text-[11px] text-muted mt-1">Batas akhir data absensi dihitung setiap bulan.</p>
            </div>
            <div>
              <label htmlFor="paydayDate" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Tanggal Transfer Gaji</label>
              <input id="paydayDate" type="number" min="1" max="31" value={settings.payday_date ?? ""}
                onChange={e => setSettings({ ...settings, payday_date: cleanLeadingZero(e.target.value) })}
                className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none text-text-light dark:text-text-dark text-sm font-bold" />
              <p className="text-[11px] text-muted mt-1">Target tanggal distribusi upah karyawan.</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════ */}
      {/* SECTION: Pengaturan Pengiriman & Ongkir */}
      {/* ═══════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-5 flex items-center gap-3 text-white">
          <MapPin className="w-6 h-6 shrink-0" />
          <div>
            <h2 className="text-lg font-bold">Pengaturan Layanan Pengantaran & Ongkir</h2>
            <p className="text-white/75 text-xs">Kelola biaya pengiriman otomatis berdasarkan jarak Google Maps</p>
          </div>
        </div>

        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between gap-3 p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
            <div className="min-w-0">
              <p className="font-bold text-sm text-text-light dark:text-text-dark">Aktifkan Layanan Pengiriman (Delivery)</p>
              <p className="text-[11px] text-muted">Izinkan pelanggan memilih metode pengantaran makanan ke alamat tujuan saat checkout</p>
            </div>
            <Toggle checked={settings.is_shipping_enabled || false} onChange={v => setSettings({ ...settings, is_shipping_enabled: v })} title="Layanan Pengiriman" />
          </div>

          <AnimatePresence>
            {settings.is_shipping_enabled && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-border-light dark:border-border-dark pt-4">
                  <div>
                    <label htmlFor="shippingRate" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Tarif Ongkir Per KM (Rp)</label>
                    <input id="shippingRate" type="number" min="0" value={settings.shipping_rate_per_km ?? ""}
                      onChange={e => setSettings({ ...settings, shipping_rate_per_km: cleanLeadingZero(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" />
                  </div>
                  
                  <div>
                    <label htmlFor="minShippingDist" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Jarak Layanan Minimum (KM)</label>
                    <input id="minShippingDist" type="number" min="0" value={settings.min_shipping_distance ?? ""}
                      onChange={e => setSettings({ ...settings, min_shipping_distance: cleanLeadingZero(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" />
                    <p className="text-[10px] text-muted mt-1">Jarak minimum yang akan tetap dikenakan tarif minimum.</p>
                  </div>

                  <div>
                    <label htmlFor="maxShippingDist" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Jarak Layanan Maksimum (KM)</label>
                    <input id="maxShippingDist" type="number" min="0" value={settings.max_shipping_distance ?? ""}
                      onChange={e => setSettings({ ...settings, max_shipping_distance: cleanLeadingZero(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" />
                    <p className="text-[10px] text-muted mt-1">Batas terjauh jangkauan pengiriman restoran.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="additionalCharge" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Biaya Zona Tambahan (Rp)</label>
                    <input id="additionalCharge" type="number" min="0" value={settings.additional_zone_charge ?? ""}
                      onChange={e => setSettings({ ...settings, additional_zone_charge: cleanLeadingZero(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" />
                  </div>

                  <div>
                    <label htmlFor="minOrderFreeShipping" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Min. Belanja Gratis Ongkir (Rp)</label>
                    <input id="minOrderFreeShipping" type="number" min="0" value={settings.min_order_for_free_shipping ?? ""}
                      onChange={e => setSettings({ ...settings, min_order_for_free_shipping: cleanLeadingZero(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" />
                  </div>
                </div>

                <div className="border-t border-border-light dark:border-border-dark pt-4">
                  <h3 className="text-sm font-bold text-text-light dark:text-text-dark mb-3">Koordinat Lokasi Restoran</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="restoLatitude" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Latitude</label>
                      <input id="restoLatitude" type="number" step="any" value={settings.resto_latitude ?? ""}
                        onChange={e => setSettings({ ...settings, resto_latitude: e.target.value })}
                        className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" />
                    </div>
                    <div>
                      <label htmlFor="restoLongitude" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Longitude</label>
                      <input id="restoLongitude" type="number" step="any" value={settings.resto_longitude ?? ""}
                        onChange={e => setSettings({ ...settings, resto_longitude: e.target.value })}
                        className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" />
                    </div>
                  </div>

                  {/* PETA INTERAKTIF SEKARANG DIGANTI DENGAN KARTU INSTRUKSI STATIS */}
                  <div className="p-6 bg-gray-50 dark:bg-gray-800/40 border border-border-light dark:border-border-dark rounded-2xl space-y-3 text-left">
                    <div className="flex items-center gap-2 text-primary font-bold text-sm">
                      <MapPin className="w-5 h-5 text-primary" />
                      <span>Lokasi Titik Koordinat Restoran</span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      Titik koordinat (Latitude & Longitude) di atas digunakan sebagai titik pusat acuan (origin) untuk menghitung jarak pengiriman pesanan secara otomatis (Haversine distance).
                    </p>
                    <div className="p-3.5 bg-amber-500/10 border border-amber-550/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" /> Panduan Pengaturan Koordinat:
                      </p>
                      <ul className="list-disc list-inside pl-1 space-y-0.5 text-[11px] leading-relaxed text-muted">
                        <li>Gunakan format desimal lengkap (contoh Latitude: <code className="font-mono bg-amber-500/20 px-1 rounded">-7.7829</code>, Longitude: <code className="font-mono bg-amber-500/20 px-1 rounded">110.3323</code>).</li>
                        <li>Anda dapat menyalin koordinat lokasi restoran Anda langsung dari pencarian Google Maps atau OpenStreetMap untuk akurasi optimal.</li>
                        <li>Pastikan koordinat tersimpan dengan benar agar perhitungan ongkos kirim pelanggan tidak mengalami deviasi jarak.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════ */}
      {/* SECTION: Pengaturan Estimasi Waktu Pesanan */}
      {/* ═══════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-5 flex items-center gap-3 text-white">
          <Clock className="w-6 h-6 shrink-0" />
          <div>
            <h2 className="text-lg font-bold">Pengaturan Estimasi Waktu Pesanan</h2>
            <p className="text-white/75 text-xs">Kelola estimasi durasi persiapan hidangan & waktu pengiriman secara otomatis</p>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Toggles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between gap-3 p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
              <div className="min-w-0">
                <p className="font-bold text-sm text-text-light dark:text-text-dark">Estimasi Waktu Otomatis</p>
                <p className="text-[11px] text-muted">Aktifkan perhitungan waktu otomatis untuk setiap pesanan baru</p>
              </div>
              <Toggle checked={estimationSettings.is_auto_estimation_active} onChange={v => setEstimationSettings({ ...estimationSettings, is_auto_estimation_active: v })} title="Estimasi Otomatis" />
            </div>

            <div className="flex items-center justify-between gap-3 p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
              <div className="min-w-0">
                <p className="font-bold text-sm text-text-light dark:text-text-dark">Peringatan Hampir Habis</p>
                <p className="text-[11px] text-muted">Aktifkan peringatan visual saat sisa waktu kurang dari 5 menit</p>
              </div>
              <Toggle checked={estimationSettings.is_warning_active} onChange={v => setEstimationSettings({ ...estimationSettings, is_warning_active: v })} title="Peringatan Hampir Habis" />
            </div>

            <div className="flex items-center justify-between gap-3 p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
              <div className="min-w-0">
                <p className="font-bold text-sm text-text-light dark:text-text-dark">Keterlambatan Otomatis</p>
                <p className="text-[11px] text-muted">Ubah countdown menjadi counter keterlambatan saat melewati estimasi</p>
              </div>
              <Toggle checked={estimationSettings.is_auto_late_active} onChange={v => setEstimationSettings({ ...estimationSettings, is_auto_late_active: v })} title="Keterlambatan Otomatis" />
            </div>

            <div className="flex items-center justify-between gap-3 p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
              <div className="min-w-0">
                <p className="font-bold text-sm text-text-light dark:text-text-dark">Tambahan Waktu Jika Ramai</p>
                <p className="text-[11px] text-muted">Aktifkan tambahan waktu tetap apabila restoran dalam status ramai</p>
              </div>
              <Toggle checked={estimationSettings.is_busy_active} onChange={v => setEstimationSettings({ ...estimationSettings, is_busy_active: v })} title="Tambahan Ramai" />
            </div>
          </div>

          <div className="border-t border-border-light dark:border-border-dark pt-4">
            <h3 className="text-sm font-bold text-text-light dark:text-text-dark mb-4">Estimasi Default Per Tipe Pesanan (Menit)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label htmlFor="dineInDefault" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Dine In (Makan di Tempat)</label>
                <input id="dineInDefault" type="number" min="1" value={estimationSettings.dine_in_default_minutes}
                  onChange={e => setEstimationSettings({ ...estimationSettings, dine_in_default_minutes: cleanLeadingZero(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" />
              </div>
              <div>
                <label htmlFor="takeawayDefault" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Takeaway (Bawa Pulang)</label>
                <input id="takeawayDefault" type="number" min="1" value={estimationSettings.takeaway_default_minutes}
                  onChange={e => setEstimationSettings({ ...estimationSettings, takeaway_default_minutes: cleanLeadingZero(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" />
              </div>
              <div>
                <label htmlFor="deliveryDefault" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Delivery (Pengiriman)</label>
                <input id="deliveryDefault" type="number" min="1" value={estimationSettings.delivery_default_minutes}
                  onChange={e => setEstimationSettings({ ...estimationSettings, delivery_default_minutes: cleanLeadingZero(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" />
              </div>
              <div>
                <label htmlFor="pickupDefault" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Pickup (Ambil Sendiri)</label>
                <input id="pickupDefault" type="number" min="1" value={estimationSettings.pickup_default_minutes}
                  onChange={e => setEstimationSettings({ ...estimationSettings, pickup_default_minutes: cleanLeadingZero(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" />
              </div>
            </div>
          </div>

          <div className="border-t border-border-light dark:border-border-dark pt-4">
            <h3 className="text-sm font-bold text-text-light dark:text-text-dark mb-4">Tambahan Waktu Kustom & Batasan</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label htmlFor="minMinutes" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Batasan Waktu Minimum (Menit)</label>
                <input id="minMinutes" type="number" min="1" value={estimationSettings.min_minutes}
                  onChange={e => setEstimationSettings({ ...estimationSettings, min_minutes: cleanLeadingZero(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" />
              </div>
              <div>
                <label htmlFor="maxMinutes" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Batasan Waktu Maksimum (Menit)</label>
                <input id="maxMinutes" type="number" min="1" value={estimationSettings.max_minutes}
                  onChange={e => setEstimationSettings({ ...estimationSettings, max_minutes: cleanLeadingZero(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" />
              </div>
              <div>
                <label htmlFor="busyMultiplier" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Tambahan Jika Ramai (Menit)</label>
                <input id="busyMultiplier" type="number" min="0" value={estimationSettings.busy_multiplier_minutes}
                  onChange={e => setEstimationSettings({ ...estimationSettings, busy_multiplier_minutes: cleanLeadingZero(e.target.value) })}
                  className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-text-light dark:text-text-dark">Tambahan Per Item Menu</p>
                    <p className="text-[11px] text-muted">Tambahkan waktu ekstra berdasarkan jumlah item yang dipesan</p>
                  </div>
                  <Toggle checked={estimationSettings.is_item_addition_active} onChange={v => setEstimationSettings({ ...estimationSettings, is_item_addition_active: v })} title="Tambahan Per Item" />
                </div>
                {estimationSettings.is_item_addition_active && (
                  <div>
                    <label htmlFor="perItemAddition" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Tambahan Waktu Per Item (Menit)</label>
                    <input id="perItemAddition" type="number" min="0" value={estimationSettings.per_item_addition_minutes}
                      onChange={e => setEstimationSettings({ ...estimationSettings, per_item_addition_minutes: cleanLeadingZero(e.target.value) })}
                      className="w-full px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark font-bold" />
                  </div>
                )}
              </div>

              <div className="p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-sm text-text-light dark:text-text-dark">Tambahan Jarak Pengiriman (Delivery)</p>
                    <p className="text-[11px] text-muted">Tambahkan waktu ekstra berdasarkan jarak km alamat tujuan</p>
                  </div>
                  <Toggle checked={estimationSettings.is_distance_estimation_active} onChange={v => setEstimationSettings({ ...estimationSettings, is_distance_estimation_active: v })} title="Tambahan Jarak" />
                </div>
                {estimationSettings.is_distance_estimation_active && (
                  <div>
                    <label htmlFor="deliveryPerKm" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Tambahan Waktu Per KM (Menit)</label>
                    <input id="deliveryPerKm" type="number" min="0" value={estimationSettings.delivery_per_km_minutes}
                      onChange={e => setEstimationSettings({ ...estimationSettings, delivery_per_km_minutes: cleanLeadingZero(e.target.value) })}
                      className="w-full px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-lg outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark font-bold" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════ */}
      {/* SECTION: Pengaturan Reservasi Meja */}
      {/* ═══════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-5 flex items-center gap-3 text-white">
          <CalendarDays className="w-6 h-6 shrink-0" />
          <div>
            <h2 className="text-lg font-bold">Pengaturan Reservasi Meja</h2>
            <p className="text-white/75 text-xs">Kelola durasi reservasi default dan pelepasan meja otomatis</p>
          </div>
        </div>

        <div className="p-5 space-y-6">
          <div className="flex items-center justify-between gap-3 p-4 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
            <div className="min-w-0">
              <p className="font-bold text-sm text-text-light dark:text-text-dark">Pelepasan Meja Otomatis</p>
              <p className="text-[11px] text-muted">Secara otomatis mengembalikan meja ke status tersedia setelah reservasi selesai atau melewati toleransi waktu keterlambatan</p>
            </div>
            <Toggle 
              checked={reservationSettings.auto_release_enabled} 
              onChange={v => setReservationSettings({ ...reservationSettings, auto_release_enabled: v })} 
              title="Pelepasan Meja Otomatis" 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-border-light dark:border-border-dark pt-4">
            <div>
              <label htmlFor="resDuration" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Durasi Reservasi Default (Menit)</label>
              <div className="relative">
                <Clock className="absolute left-3 top-3 h-4 w-4 text-muted" />
                <input 
                  id="resDuration" 
                  type="number" 
                  min="1" 
                  value={reservationSettings.duration_minutes}
                  onChange={e => setReservationSettings({ ...reservationSettings, duration_minutes: cleanLeadingZero(e.target.value) === "" ? 0 : Number(cleanLeadingZero(e.target.value)) })}
                  className="w-full pl-10 pr-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" 
                />
              </div>
              <p className="text-[10px] text-muted mt-1">Estimasi durasi meja terpakai per sesi reservasi.</p>
            </div>

            <div>
              <label htmlFor="resLateTolerance" className="text-xs font-semibold text-muted mb-1 block uppercase tracking-wider">Batas Toleransi Check-in (Menit)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Clock className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
                  <input 
                    id="resLateTolerance" 
                    type="number" 
                    min="0" 
                    max="120"
                    value={reservationSettings.late_tolerance_minutes === "" ? "" : reservationSettings.late_tolerance_minutes}
                    onChange={e => {
                      let val = e.target.value;
                      if (val === "") {
                        setReservationSettings({ ...reservationSettings, late_tolerance_minutes: "" });
                        return;
                      }
                      const clean = cleanLeadingZero(val).replace(/[^0-9]/g, "");
                      if (clean === "") {
                        setReservationSettings({ ...reservationSettings, late_tolerance_minutes: 0 });
                        return;
                      }
                      let num = Number(clean);
                      if (num > 120) num = 120;
                      setReservationSettings({ ...reservationSettings, late_tolerance_minutes: num });
                    }}
                    className="w-full pl-10 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-text-light dark:text-text-dark text-sm font-bold" 
                  />
                </div>
                <button 
                  type="button" 
                  onClick={() => setReservationSettings({ ...reservationSettings, late_tolerance_minutes: 15 })} 
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-text-light dark:text-text-dark rounded-xl font-bold text-xs uppercase shadow-sm transition-all"
                >
                  Reset
                </button>
              </div>
              <p className="text-[10px] text-muted mt-1">Batas waktu keterlambatan pelanggan check-in setelah jam booking dimulai (maksimal 120 menit).</p>
              
              <div className="mt-2.5 p-3.5 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                <p className="text-[10.5px] text-amber-700 dark:text-amber-300 font-medium leading-relaxed italic">
                  <strong>Pratinjau Aturan Pelanggan:</strong> &quot;Pelanggan wajib melakukan check-in maksimal {reservationSettings.late_tolerance_minutes || 15} menit setelah jam booking dimulai. Jika melebihi batas tersebut dan pelanggan tidak kunjung hadir, maka reservasi dinyatakan hangus, dibatalkan, dan meja akan dibuka kembali untuk pelanggan lain.&quot;
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border-light dark:border-border-dark flex justify-end">
            <a 
              href="/admin/settings/calendar"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md shadow-primary/20 transition-all"
            >
              <CalendarDays className="w-4 h-4" /> Pengaturan Google Calendar & Sync
            </a>
          </div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════ */}
      {/* SAVE BUTTON */}
      {/* ═══════════════════════════════════════ */}
      <motion.button
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-base sm:text-lg flex items-center justify-center gap-2 shadow-xl shadow-primary/30 uppercase tracking-wider transition-all"
      >
        {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Menyimpan...</> : <><Save className="w-5 h-5" /> Simpan Semua Konfigurasi</>}
      </motion.button>

      {/* CROP MODAL */}
      <BaseModal
        isOpen={showCropModal && !!upImg}
        onClose={() => setShowCropModal(false)}
        size="lg"
        showCloseButton={false}
        noPadding={true}
      >
        <div className="bg-white dark:bg-gray-900 text-text-light dark:text-text-dark p-6 space-y-4">
          <h3 className="text-xl font-black mb-4 text-gray-900 dark:text-white uppercase tracking-wider">Potong {cropTarget === 'favicon' ? 'Favicon' : 'Logo'}</h3>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden flex items-center justify-center min-h-[300px] p-4">
            {upImg && (
              <ReactCrop crop={crop} onChange={(c) => setCrop(c)} onComplete={(c) => setCompletedCrop(c)} aspect={cropTarget === 'favicon' ? 1 : undefined}>
                <img src={upImg} onLoad={(e) => onLoad(e.currentTarget)} alt="Upload Preview" style={{ maxHeight: '60vh' }} />
              </ReactCrop>
            )}
          </div>
          <p className="text-xs text-muted mt-3 text-center">
            {cropTarget === 'favicon' ? "Gunakan aspek rasio 1:1 agar favicon terlihat jelas di tab browser." : "Gunakan crop box untuk menentukan batas logo Anda."}
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowCropModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
              Batal
            </button>
            <button onClick={handleUploadCroppedLogo} className="px-5 py-2.5 rounded-xl font-black text-sm text-white bg-primary hover:bg-primary-hover shadow-lg shadow-primary/30 transition-all flex items-center gap-2">
              <Upload className="w-4 h-4" /> Unggah & Simpan
            </button>
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
