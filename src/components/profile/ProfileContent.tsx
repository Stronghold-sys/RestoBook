"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, Mail, Phone, Camera, Save, Loader2, Shield, Lock, Key, 
  CheckCircle, ClipboardList, Send, Calendar, AlertTriangle, Eye, EyeOff, 
  HelpCircle, Smartphone, Globe, ShieldAlert, ShieldCheck, Ban, Trash2, Home, Info,
  RefreshCw
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { useModalStore } from "@/store/useModalStore";
import { useActivityStore } from "@/store/useActivityStore";
import { useTutorialStore } from "@/store/useTutorialStore";

function ResignCountdownWidget({ req, profile }: { req: any, profile: any }) {
  const [timeLeft, setTimeLeft] = useState<{d:number, h:number, m:number, s:number} | null>(null);
  const [actioning, setActioning] = useState(false);
  
  useEffect(() => {
    if (!req.suspension_time) return;
    const target = new Date(req.suspension_time).getTime();
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
      } else {
        setTimeLeft({
          d: Math.floor(diff / (1000 * 60 * 60 * 24)),
          h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          s: Math.floor((diff % (1000 * 60)) / 1000),
        });
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [req.suspension_time]);

  const handleDecision = async (decision: string) => {
    if (actioning) return;
    setActioning(true);
    try {
      const res = await fetch("/api/admin/resign-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "employee_decision", requestId: req.id, decision })
      });
      if (!res.ok) throw new Error("Gagal menyimpan keputusan");
      toast.success("Keputusan berhasil dikonfirmasi!");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActioning(false);
    }
  };

  if (!req.suspension_time || req.status !== 'Disetujui') return null;
  
  const targetDate = new Date(req.suspension_time);
  const isDecided = req.employee_decision && req.employee_decision !== 'menunggu';

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 mt-4 border border-white/10 shadow-2xl relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="relative z-10 space-y-5">
        <div className="flex items-center gap-2 border-b border-white/10 pb-4">
          <div className="bg-amber-500 text-black p-1.5 rounded-lg"><AlertTriangle className="w-4 h-4" /></div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-wide text-amber-400">Konfirmasi Keputusan Akhir</h4>
            <p className="text-[10px] text-white/60 font-medium">Pilihan ini mengikat dan hanya dapat dikonfirmasi satu kali.</p>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-white/80">Halo <strong>{profile.full_name}</strong>,</p>
          <p className="text-xs text-white/70 leading-relaxed">Pengajuan pengunduran diri Anda telah diterima. Akun Anda akan dinonaktifkan secara otomatis pada:</p>
          <div className="bg-black/30 p-3 rounded-xl border border-white/5 mt-2">
            <p className="text-sm font-bold text-blue-300">
              {targetDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} | {targetDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase text-white/50 mb-2">Sisa Waktu Aktif Akun:</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'HARI', val: timeLeft?.d || 0 },
              { label: 'JAM', val: timeLeft?.h || 0 },
              { label: 'MENIT', val: timeLeft?.m || 0 },
              { label: 'DETIK', val: timeLeft?.s || 0 },
            ].map((unit, i) => (
              <div key={i} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-black font-mono leading-none">{String(unit.val).padStart(2, '0')}</p>
                <p className="text-[8px] font-bold text-white/40 mt-1">{unit.label}</p>
              </div>
            ))}
          </div>
        </div>

        {isDecided ? (
          <div className={`mt-2 p-4 rounded-2xl flex items-center gap-3 border ${req.employee_decision === 'lanjut_bekerja' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
            <CheckCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="text-xs font-black uppercase">Keputusan Terkunci</p>
              <p className="text-[10px] opacity-80 font-medium">{req.employee_decision === 'lanjut_bekerja' ? 'Anda telah memilih untuk lanjut bekerja.' : 'Anda telah mengonfirmasi untuk keluar.'}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button 
              disabled={actioning} 
              onClick={() => handleDecision('lanjut_keluar')}
              className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xs uppercase tracking-wide transition-all shadow-lg shadow-red-600/20 flex justify-center items-center gap-2"
            >
              {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Lanjutkan Proses Keluar
            </button>
            <button 
              disabled={actioning} 
              onClick={() => handleDecision('lanjut_bekerja')}
              className="flex-1 py-3.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xs uppercase tracking-wide transition-all shadow-lg shadow-green-600/20 flex justify-center items-center gap-2"
            >
              {actioning ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Saya Ingin Lanjut Bekerja
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProfileContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const openModal = useModalStore(state => state.openModal);
  const closeModal = useModalStore(state => state.closeModal);

  // Profile data state
  const [profile, setProfile] = useState({ 
    id: "", 
    full_name: "", 
    phone: "", 
    avatar_url: "", 
    email: "", 
    role: "", 
    employee_id: "", 
    email_unlocked: false,
    address: "",
    birthdate: "",
    auth_status: "",
    google_account_linked: false
  });
  const [originalProfile, setOriginalProfile] = useState<any>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState<"profile" | "resign" | "status" | "preferences" | "security">("profile");

  // Preferences State
  const [preferences, setPreferences] = useState({
    theme: "light",
    notif_booking: true,
    notif_payment: true,
    notif_promo: true,
    notif_security: true,
    notif_reminder: true,
    email_promo: true,
    email_booking: true,
    email_transaction: true,
    email_security: true,
    favorite_branch: "",
    favorite_payment_method: "",
    booking_default_guests: 2,
    booking_favorite_area: "",
    booking_smoking: false,
    booking_indoor: true,
    booking_notes: "",
    booking_calendar_view: "monthly",
    privacy_profile_visibility: "public",
    privacy_data_consent: true
  });

  // Devices & security logs states
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);

  // Password change state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // OTP Modal states
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpType, setOtpType] = useState<"email" | "phone" | "deactivate" | "delete">("email");
  const [otpTargetValue, setOtpTargetValue] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [confirmDeletePassword, setConfirmDeletePassword] = useState("");
  const [otpStep, setOtpStep] = useState<"credentials" | "otp">("credentials");

  // Resign Form State
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  // Resign Status Check State
  const [checkId, setCheckId] = useState("");
  const [checkPassword, setCheckPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkedRequests, setCheckedRequests] = useState<any[]>([]);
  const [hasChecked, setHasChecked] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Autosave Resign Form Draft
  useEffect(() => {
    if (typeof window !== "undefined") {
      const draftDate = localStorage.getItem("resign_draft_effectiveDate");
      const draftReason = localStorage.getItem("resign_draft_reason");
      const draftNotes = localStorage.getItem("resign_draft_additionalNotes");
      if (draftDate) setEffectiveDate(draftDate);
      if (draftReason) setReason(draftReason);
      if (draftNotes) setAdditionalNotes(draftNotes);
    }
  }, []);

  const handleEffectiveDateChange = (val: string) => {
    setEffectiveDate(val);
    localStorage.setItem("resign_draft_effectiveDate", val);
  };

  const handleReasonChange = (val: string) => {
    setReason(val);
    localStorage.setItem("resign_draft_reason", val);
  };

  const handleAdditionalNotesChange = (val: string) => {
    setAdditionalNotes(val);
    localStorage.setItem("resign_draft_additionalNotes", val);
  };

  useEffect(() => {
    fetchProfile();

    // Subscribe to profiles changes for realtime sync
    let channel: any;

    const setupProfileSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      channel = supabase
        .channel(`profile-realtime-sync-${session.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `user_id=eq.${session.user.id}`
          },
          (payload: any) => {
            if (payload.new) {
              setProfile((prev) => ({
                ...prev,
                full_name: payload.new.full_name || "",
                phone: payload.new.phone || "",
                avatar_url: payload.new.avatar_url || "",
                email: payload.new.email || "",
                role: payload.new.role || "customer",
                employee_id: payload.new.employee_id || "",
                email_unlocked: !!payload.new.email_unlocked,
                address: payload.new.address || "",
                birthdate: payload.new.birthdate || ""
              }));
            }
          }
        )
        .subscribe();
    };

    setupProfileSubscription();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!hasChecked || !checkId) return;

    const channel = supabase.channel(`profile-resign-sync-${checkId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "resign_requests",
        filter: `employee_id=eq.${checkId}`
      }, async () => {
        const { data } = await supabase
          .from("resign_requests")
          .select("*")
          .eq("employee_id", checkId)
          .order("created_at", { ascending: false });
        if (data) {
          setCheckedRequests(data);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasChecked, checkId]);

  // Realtime preferences sync
  useEffect(() => {
    if (!profile.id) return;

    const channel = supabase
      .channel(`profile-preferences-sync-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${profile.id}`
        },
        (payload: any) => {
          if (payload.new) {
            setPreferences({
              theme: payload.new.theme || "system",
              notif_booking: payload.new.notif_booking !== false,
              notif_payment: payload.new.notif_payment !== false,
              notif_promo: payload.new.notif_promo !== false,
              notif_security: payload.new.notif_security !== false,
              notif_reminder: payload.new.notif_reminder !== false,
              email_promo: payload.new.email_promo !== false,
              email_booking: payload.new.email_booking !== false,
              email_transaction: payload.new.email_transaction !== false,
              email_security: payload.new.email_security !== false,
              favorite_branch: payload.new.favorite_branch || "",
              favorite_payment_method: payload.new.favorite_payment_method || "",
              booking_default_guests: payload.new.booking_default_guests || 2,
              booking_favorite_area: payload.new.booking_favorite_area || "",
              booking_smoking: !!payload.new.booking_smoking,
              booking_indoor: payload.new.booking_indoor !== false,
              booking_notes: payload.new.booking_notes || "",
              booking_calendar_view: payload.new.booking_calendar_view || "monthly",
              privacy_profile_visibility: payload.new.privacy_profile_visibility || "public",
              privacy_data_consent: payload.new.privacy_data_consent !== false
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile.id]);

  // Devices & security logs loader
  const fetchDevicesAndLogs = async () => {
    setLoadingSessions(true);
    try {
      const devRes = await fetch('/api/profile/devices');
      const devData = await devRes.json();
      if (devRes.ok && devData.success) {
        setSessions(devData.sessions || []);
      }

      const { data: logs } = await supabase
        .from('security_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      setSecurityLogs(logs || []);
    } catch (e) {
      console.error("Error fetching devices/logs:", e);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (activeTab === "security") {
      fetchDevicesAndLogs();

      const sessionChannel = supabase
        .channel(`security-session-sync-${profile.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "security_user_sessions" },
          () => fetchDevicesAndLogs()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(sessionChannel);
      };
    }
  }, [activeTab, profile.id]);

  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .single();
        
      if (error) throw error;
      
      if (data) {
        const profileObj = {
          id: data.id,
          full_name: data.full_name || "",
          phone: data.phone || "",
          avatar_url: data.avatar_url || "",
          email: data.email || session.user.email || "",
          role: data.role || "customer",
          employee_id: data.employee_id || "",
          email_unlocked: !!data.email_unlocked,
          address: data.address || "",
          birthdate: data.birthdate || "",
          auth_status: data.auth_status || "",
          google_account_linked: !!data.google_account_linked
        };
        setProfile(profileObj);
        setOriginalProfile(profileObj);
        setPreviewUrl(data.avatar_url || "");

        // Set preferences values
        setPreferences({
          theme: data.theme || "light",
          notif_booking: data.notif_booking !== false,
          notif_payment: data.notif_payment !== false,
          notif_promo: data.notif_promo !== false,
          notif_security: data.notif_security !== false,
          notif_reminder: data.notif_reminder !== false,
          email_promo: data.email_promo !== false,
          email_booking: data.email_booking !== false,
          email_transaction: data.email_transaction !== false,
          email_security: data.email_security !== false,
          favorite_branch: data.favorite_branch || "",
          favorite_payment_method: data.favorite_payment_method || "",
          booking_default_guests: data.booking_default_guests || 2,
          booking_favorite_area: data.booking_favorite_area || "",
          booking_smoking: !!data.booking_smoking,
          booking_indoor: data.booking_indoor !== false,
          booking_notes: data.booking_notes || "",
          booking_calendar_view: data.booking_calendar_view || "monthly",
          privacy_profile_visibility: data.privacy_profile_visibility || "public",
          privacy_data_consent: data.privacy_data_consent !== false
        });

        if (data.employee_id) {
          setCheckId(data.employee_id);
        }
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Check if email or phone is changed to prevent saving directly
    if (profile.email !== originalProfile.email) {
      return handleStartOtpFlow("email", profile.email);
    }
    if (profile.phone !== originalProfile.phone) {
      return handleStartOtpFlow("phone", profile.phone);
    }

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session?.user.id,
          fullName: profile.full_name,
          phone: profile.phone,
          avatarUrl: profile.avatar_url,
          email: profile.email
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal menyimpan profil');

      // Save additional profile preferences (address & birthdate)
      await fetch('/api/profile/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: profile.address,
          birthdate: profile.birthdate || null
        })
      });

      toast.success("Profil diperbarui!");
      useActivityStore.getState().addLog(
        "Perbarui Profil",
        "Berhasil memperbarui data profil diri."
      );
      fetchProfile();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return toast.error("File harus berupa gambar");
    }

    if (file.size > 2 * 1024 * 1024) {
      return toast.error("Ukuran gambar maksimal 2MB");
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Sesi tidak ditemukan");

      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', session.user.id);
      formData.append('isProfile', 'true');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal mengunggah foto");

      const publicUrl = result.url;

      setProfile({ ...profile, avatar_url: publicUrl });
      setPreviewUrl(publicUrl);

      toast.success("Foto profil diperbarui!");
      useActivityStore.getState().addLog(
        "Unggah Foto Profil",
        "Berhasil memperbarui foto profil utama."
      );
    } catch (e: any) {
      console.error("Upload error:", e);
      toast.error(e.message || "Gagal mengunggah foto");
    } finally {
      setUploading(false);
    }
  };

  // Submit Resign Logic
  const handleSubmitResign = async () => {
    if (!effectiveDate) return toast.error("Tanggal Efektif Keluar wajib diisi");
    if (!reason.trim()) return toast.error("Alasan Resign wajib diisi");
    if (!profile.role) return toast.error("Data jabatan tidak ditemukan. Silakan hubungi admin.");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Sesi tidak valid / expired. Silakan login kembali.");

      const { error } = await supabase.from("resign_requests").insert({
        user_id: session.user.id,
        profile_id: profile.id,
        employee_id: profile.employee_id,
        full_name: profile.full_name,
        role: profile.role,
        division: profile.role === "cashier" ? "Kasir" : "Operasional",
        effective_date: effectiveDate,
        reason: reason,
        additional_notes: additionalNotes,
        status: "Menunggu Konfirmasi"
      });

      if (error) throw error;

      if (profile.phone) {
        fetch("/api/admin/resign-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "notify_submission",
            notes: {
              phone: profile.phone,
              fullName: profile.full_name,
              employeeId: profile.employee_id
            }
          })
        }).catch(err => console.error("WA notify_submission failed:", err));
      }

      toast.success("Pengajuan Anda telah berhasil dikirim. Silakan tunggu konfirmasi dari admin.");
      
      localStorage.removeItem("resign_draft_effectiveDate");
      localStorage.removeItem("resign_draft_reason");
      localStorage.removeItem("resign_draft_additionalNotes");

      setActiveTab("status");
      setEffectiveDate("");
      setReason("");
      setAdditionalNotes("");
      closeModal();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Check Resign Status Logic
  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkId.trim()) return toast.error("No. ID Karyawan wajib diisi");
    if (!checkPassword.trim()) return toast.error("Password wajib diisi");

    setChecking(true);
    try {
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("email")
        .eq("employee_id", checkId)
        .maybeSingle();

      if (profErr || !prof) {
        throw new Error("No. ID atau Password yang Anda masukkan tidak sesuai. Silakan coba kembali.");
      }

      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: prof.email,
        password: checkPassword
      });

      if (authErr) {
        throw new Error("No. ID atau Password yang Anda masukkan tidak sesuai. Silakan coba kembali.");
      }

      const { data: requests, error: reqErr } = await supabase
        .from("resign_requests")
        .select("*")
        .eq("employee_id", checkId)
        .order("created_at", { ascending: false });

      if (reqErr) throw reqErr;

      setCheckedRequests(requests || []);
      setHasChecked(true);
      toast.success("Data berhasil divalidasi!");
    } catch (e: any) {
      toast.error(e.message);
      setHasChecked(false);
    } finally {
      setChecking(false);
    }
  };

  // OTP Verification flows
  const handleStartOtpFlow = async (type: "email" | "phone", value: string) => {
    if (!value.trim()) {
      return toast.error(`${type === 'email' ? 'Email' : 'Nomor HP'} baru tidak boleh kosong`);
    }

    setOtpType(type);
    setOtpTargetValue(value);
    setSendingOtp(true);
    setShowOtpModal(true);
    setOtpStep("otp");
    setOtpCode("");

    try {
      const res = await fetch("/api/profile/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_otp",
          type,
          value
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal mengirim OTP");

      toast.success(`Kode OTP berhasil dikirim ke ${value}`);
    } catch (e: any) {
      toast.error(e.message);
      setShowOtpModal(false);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) return toast.error("Kode OTP wajib diisi");
    setVerifyingOtp(true);

    try {
      const res = await fetch("/api/profile/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_otp",
          type: otpType,
          value: otpTargetValue,
          code: otpCode
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Verifikasi OTP gagal");

      toast.success("Data berhasil diperbarui!");
      setShowOtpModal(false);
      fetchProfile();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Deactivate/Delete flows
  const handleStartDeactivateDeleteFlow = (action: "deactivate" | "delete") => {
    setOtpType(action);
    setOtpStep("credentials");
    setConfirmDeletePassword("");
    setOtpCode("");
    setShowOtpModal(true);
  };

  const handleDeactivateDeleteVerifyCredentials = async () => {
    if (!confirmDeletePassword) return toast.error("Password wajib diisi");
    setSendingOtp(true);

    try {
      const res = await fetch("/api/profile/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_otp"
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal mengirim kode verifikasi");

      toast.success("Kode verifikasi OTP berhasil dikirim!");
      setOtpStep("otp");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSendingOtp(false);
    }
  };

  const handleDeactivateDeleteVerifyOtp = async () => {
    if (!otpCode) return toast.error("Kode OTP wajib diisi");
    setVerifyingOtp(true);

    try {
      const res = await fetch("/api/profile/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: otpType,
          password: confirmDeletePassword,
          code: otpCode
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Proses verifikasi gagal");

      if (otpType === 'deactivate') {
        toast.success("Akun berhasil dinonaktifkan sementara!");
      } else {
        toast.success("Akun berhasil dihapus secara permanen!");
      }

      setShowOtpModal(false);
      
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (e) {}
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Preference save helper
  const handleSavePreferences = async (updatedPrefs?: any) => {
    setSaving(true);
    const prefsToSave = updatedPrefs || preferences;
    try {
      const res = await fetch('/api/profile/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefsToSave)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan preferensi");

      toast.success("Preferensi diperbarui!");
      fetchProfile();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Password update helper
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      return toast.error("Semua kolom password wajib diisi");
    }
    if (newPassword !== confirmPassword) {
      return toast.error("Password konfirmasi tidak cocok");
    }
    if (newPassword.length < 8) {
      return toast.error("Password baru minimal 8 karakter");
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/profile/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          oldPassword,
          newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah password");

      toast.success("Password berhasil diubah!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setChangingPassword(false);
    }
  };

  // Devices sessions revocation
  const handleRevokeSession = async (sessionId: string) => {
    try {
      const res = await fetch("/api/profile/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke",
          sessionId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mencabut sesi");
      toast.success("Sesi perangkat berhasil dicabut!");
      fetchDevicesAndLogs();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRevokeAllSessions = async () => {
    try {
      const res = await fetch("/api/profile/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke_all"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mencabut semua sesi");
      toast.success("Semua sesi perangkat lain berhasil dicabut!");
      fetchDevicesAndLogs();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleMarkSuspicious = async (sessionId: string, isSuspicious: boolean) => {
    try {
      const res = await fetch("/api/profile/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "suspicious",
          sessionId,
          isSuspicious
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memperbarui status");
      toast.success(isSuspicious ? "Perangkat ditandai mencurigakan!" : "Status perangkat diperbarui");
      fetchDevicesAndLogs();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-text-light dark:text-text-dark uppercase tracking-wide">Profil Saya</h1>
          <p className="text-muted mt-1">Kelola data diri, keamanan akun, dan status keanggotaan</p>
        </div>
      </div>

      {/* Tabs Navigation for Customer */}
      {profile.role === "customer" && (
        <div className="flex flex-wrap bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl gap-2 mb-8 shadow-inner max-w-xl">
          <button 
            onClick={() => setActiveTab("profile")}
            className={`flex-1 min-w-[100px] py-3.5 rounded-xl font-black text-xs transition-all uppercase tracking-wider ${activeTab === "profile" ? "bg-white dark:bg-gray-700 shadow text-primary" : "text-muted hover:text-text-light dark:hover:text-text-dark"}`}
          >
            Data Pribadi
          </button>
          <button 
            onClick={() => setActiveTab("preferences")}
            className={`flex-1 min-w-[100px] py-3.5 rounded-xl font-black text-xs transition-all uppercase tracking-wider ${activeTab === "preferences" ? "bg-white dark:bg-gray-700 shadow text-teal-605" : "text-muted hover:text-text-light dark:hover:text-text-dark"}`}
          >
            Notifikasi
          </button>
          <button 
            onClick={() => setActiveTab("security")}
            className={`flex-1 min-w-[100px] py-3.5 rounded-xl font-black text-xs transition-all uppercase tracking-wider ${activeTab === "security" ? "bg-white dark:bg-gray-700 shadow text-blue-600" : "text-muted hover:text-text-light dark:hover:text-text-dark"}`}
          >
            Perangkat & Keamanan
          </button>
        </div>
      )}

      {/* Tabs Navigation for Employees */}
      {profile.role !== "customer" && profile.role !== "admin" && (
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl gap-2 mb-8 shadow-inner max-w-lg">
          <button 
            onClick={() => setActiveTab("profile")}
            className={`flex-1 py-3.5 rounded-xl font-black text-xs transition-all uppercase tracking-wider ${activeTab === "profile" ? "bg-white dark:bg-gray-700 shadow text-primary" : "text-muted hover:text-text-light dark:hover:text-text-dark"}`}
          >
            Detail Profil
          </button>
          <button 
            onClick={() => setActiveTab("resign")}
            className={`flex-1 py-3.5 rounded-xl font-black text-xs transition-all uppercase tracking-wider ${activeTab === "resign" ? "bg-white dark:bg-gray-700 shadow text-teal-600" : "text-muted hover:text-text-light dark:hover:text-text-dark"}`}
          >
            Ajukan Resign
          </button>
          <button 
            onClick={() => setActiveTab("status")}
            className={`flex-1 py-3.5 rounded-xl font-black text-xs transition-all uppercase tracking-wider ${activeTab === "status" ? "bg-white dark:bg-gray-700 shadow text-blue-600" : "text-muted hover:text-text-light dark:hover:text-text-dark"}`}
          >
            Cek Status Resign
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Avatar & Mini Summary */}
        <div className="lg:col-span-1 space-y-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-8 text-center shadow-xl">
            <div className="relative inline-block">
              <div className="w-32 h-32 rounded-full overflow-hidden mx-auto border-4 border-white dark:border-gray-700 shadow-2xl bg-gray-100 relative">
                {previewUrl ? <img src={previewUrl} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><User className="w-16 h-16 text-muted" /></div>}
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2.5 bg-primary text-white rounded-full shadow-lg hover:scale-110 transition-transform" aria-label="Unggah Foto Profil" title="Unggah Foto Profil">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
            </div>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden" 
              title="Unggah Foto Profil" 
              aria-label="Unggah Foto Profil" 
            />
            
            <h2 className="font-black text-xl text-text-light dark:text-text-dark mt-6">{profile.full_name || "Nama Belum Diatur"}</h2>
            <div className="flex flex-col gap-2 mt-2">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase mx-auto flex items-center gap-1.5">
                <Shield className="w-3 h-3" /> {profile.role}
              </span>
              {profile.employee_id && (
                <span className="font-mono text-[10px] font-bold text-muted uppercase">ID: {profile.employee_id}</span>
              )}
            </div>

            <div className="mt-4 border-t border-border-light dark:border-border-dark pt-4 flex flex-col items-center gap-2 w-full">
              <span className="text-[10px] font-black uppercase text-muted">Panduan Interaktif</span>
              <button
                onClick={() => {
                  useTutorialStore.getState().resetTutorial();
                  useTutorialStore.getState().startTutorial(profile.role);
                  toast.success("Tutorial onboarding dimulai ulang!");
                }}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-orange-500 hover:from-primary-hover hover:to-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-primary/10 hover:scale-[1.02] w-full"
                title="Mulai Ulang Tour"
              >
                <HelpCircle className="w-4 h-4" /> Mulai Ulang Tour
              </button>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Tab Contents */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            
            {/* Tab: Data Pribadi (profile) */}
            {activeTab === "profile" && (
              <motion.div key="profile-tab" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-8 shadow-xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Nama Lengkap */}
                  <div className="space-y-2">
                    <label htmlFor="fullName" className="text-xs font-black uppercase text-muted ml-1">Nama Lengkap</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                      <input id="fullName" type="text" value={profile.full_name} onChange={e => setProfile({...profile, full_name: e.target.value})} className="w-full pl-12 pr-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 transition-all text-sm font-semibold" placeholder="Nama Lengkap" title="Nama Lengkap" />
                    </div>
                  </div>

                  {/* Tanggal Lahir */}
                  <div className="space-y-2">
                    <label htmlFor="birthdate" className="text-xs font-black uppercase text-muted ml-1">Tanggal Lahir</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                      <input id="birthdate" type="date" value={profile.birthdate} onChange={e => setProfile({...profile, birthdate: e.target.value})} className="w-full pl-12 pr-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 transition-all text-sm font-semibold" title="Tanggal Lahir" />
                    </div>
                  </div>

                  {/* Alamat Lengkap */}
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="address" className="text-xs font-black uppercase text-muted ml-1">Alamat Lengkap</label>
                    <div className="relative">
                      <Home className="absolute left-4 top-5 h-5 w-5 text-muted" />
                      <textarea id="address" value={profile.address} onChange={e => setProfile({...profile, address: e.target.value})} className="w-full pl-12 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 transition-all text-sm font-semibold" rows={2} placeholder="Tulis alamat rumah lengkap..." title="Alamat Lengkap" />
                    </div>
                  </div>

                  {/* Email (OTP Protected) */}
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="emailAddr" className="text-xs font-black uppercase text-muted ml-1">Alamat Email</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                        <input
                          id="emailAddr"
                          type="email"
                          value={profile.email}
                          onChange={e => setProfile({ ...profile, email: e.target.value })}
                          disabled={profile.role !== "admin" && !profile.email_unlocked}
                          className={`w-full pl-12 pr-4 py-3.5 border rounded-2xl outline-none transition-all text-sm font-semibold ${
                            profile.role === "admin" || profile.email_unlocked
                              ? "bg-background-light dark:bg-background-dark border-slate-300 focus:ring-2 focus:ring-slate-300/20 text-text-light dark:text-text-dark"
                              : "bg-gray-50 dark:bg-gray-800/50 border-border-light dark:border-border-dark text-muted cursor-not-allowed"
                          }`}
                          placeholder="email@contoh.com"
                          title="Alamat Email"
                        />
                      </div>
                      {profile.role === "customer" && profile.email !== originalProfile?.email && (
                        <button 
                          onClick={() => handleStartOtpFlow("email", profile.email)}
                          className="px-4 py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-2xl text-xs uppercase tracking-wider shrink-0 shadow-lg shadow-primary/10"
                        >
                          Verifikasi OTP
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Nomor HP (OTP Protected) */}
                  <div className="space-y-2 md:col-span-2">
                    <label htmlFor="phoneNumber" className="text-xs font-black uppercase text-muted ml-1">No. Telepon / WhatsApp HP</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                        <input 
                          id="phoneNumber" 
                          type="tel" 
                          value={profile.phone} 
                          onChange={e => setProfile({...profile, phone: e.target.value})} 
                          className="w-full pl-12 pr-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 transition-all text-sm font-semibold" 
                          placeholder="0812..." 
                          title="Nomor Telepon" 
                        />
                      </div>
                      {profile.role === "customer" && profile.phone !== originalProfile?.phone && (
                        <button 
                          onClick={() => handleStartOtpFlow("phone", profile.phone)}
                          className="px-4 py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-2xl text-xs uppercase tracking-wider shrink-0 shadow-lg shadow-primary/10"
                        >
                          Verifikasi OTP
                        </button>
                      )}
                    </div>
                  </div>

                </div>

                <button onClick={handleSave} disabled={saving} className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Simpan Perubahan</>}
                </button>
              </motion.div>
            )}

            {/* Tab: Preferensi & Notifikasi (preferences) */}
            {activeTab === "preferences" && (
              <motion.div key="preferences-tab" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-8 shadow-xl space-y-8">
                
                {/* 1. Notifikasi Toggles */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase text-muted tracking-wider pb-2 border-b border-border-light dark:border-border-dark">Notifikasi Aplikasi</h3>
                  <div className="space-y-3">
                    {[
                      { key: "notif_booking", label: "Notifikasi Booking", desc: "Dapatkan info persetujuan/pembatalan reservasi meja Anda" },
                      { key: "notif_payment", label: "Notifikasi Pembayaran", desc: "Konfirmasi pembayaran lunas & info tagihan" },
                      { key: "notif_promo", label: "Notifikasi Promo", desc: "Informasi diskon, reward loyalitas & voucher khusus untuk Anda" },
                      { key: "notif_security", label: "Notifikasi Keamanan", desc: "Peringatan login baru, perubahan data sensitif & ganti password" },
                      { key: "notif_reminder", label: "Reminder Reservasi", desc: "Pengingat otomatis H-1 dan beberapa jam sebelum booking meja" }
                    ].map(n => (
                      <div key={n.key} className="flex justify-between items-center gap-4 py-1.5">
                        <div>
                          <p className="text-sm font-bold">{n.label}</p>
                          <p className="text-[10px] text-muted">{n.desc}</p>
                        </div>
                        <button
                          onClick={() => {
                            const updated = { ...preferences, [n.key]: !((preferences as any)[n.key]) };
                            setPreferences(updated);
                            handleSavePreferences(updated);
                          }}
                          className={`w-11 h-6 rounded-full transition-all relative ${
                            (preferences as any)[n.key] ? "bg-primary" : "bg-gray-300 dark:bg-gray-750"
                          }`}
                          aria-label={`Toggle ${n.label}`}
                          title={`Toggle ${n.label}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                            (preferences as any)[n.key] ? "right-1" : "left-1"
                          }`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Email Toggles */}
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase text-muted tracking-wider pb-2 border-b border-border-light dark:border-border-dark">Notifikasi Email</h3>
                  <div className="space-y-3">
                    {[
                      { key: "email_booking", label: "Email Booking & Reservasi" },
                      { key: "email_transaction", label: "Email Transaksi & Invoice" },
                      { key: "email_promo", label: "Email Penawaran Promo & Event" },
                      { key: "email_security", label: "Email Keamanan Akun" }
                    ].map(e => (
                      <div key={e.key} className="flex justify-between items-center gap-4">
                        <span className="text-sm font-bold">{e.label}</span>
                        <button
                          onClick={() => {
                            const updated = { ...preferences, [e.key]: !((preferences as any)[e.key]) };
                            setPreferences(updated);
                            handleSavePreferences(updated);
                          }}
                          className={`w-11 h-6 rounded-full transition-all relative ${
                            (preferences as any)[e.key] ? "bg-primary" : "bg-gray-300 dark:bg-gray-750"
                          }`}
                          aria-label={`Toggle ${e.label}`}
                          title={`Toggle ${e.label}`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                            (preferences as any)[e.key] ? "right-1" : "left-1"
                          }`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button onClick={() => handleSavePreferences()} className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm">
                  <Save className="w-5 h-5" /> Simpan Pengaturan Notifikasi
                </button>

              </motion.div>
            )}

            {/* Tab: Perangkat & Keamanan (security) */}
            {activeTab === "security" && (
              <motion.div key="security-tab" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-8 shadow-xl space-y-8">
                
                {/* 1. Ganti Password */}
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <h3 className="text-sm font-black uppercase text-muted tracking-wider pb-2 border-b border-border-light dark:border-border-dark">Ubah Password Akun</h3>
                  
                  <div className="space-y-2">
                    <label htmlFor="security-old-password" className="text-xs font-bold text-muted ml-1">Password Lama</label>
                    <input 
                      id="security-old-password"
                      type="password"
                      value={oldPassword}
                      onChange={e => setOldPassword(e.target.value)}
                      placeholder="Masukkan password saat ini..."
                      className="w-full p-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 text-sm font-semibold"
                      title="Password Lama"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="security-new-password" className="text-xs font-bold text-muted ml-1">Password Baru</label>
                      <input 
                        id="security-new-password"
                        type="password"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        placeholder="Minimal 8 karakter..."
                        className="w-full p-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 text-sm font-semibold"
                        title="Password Baru"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="security-confirm-password" className="text-xs font-bold text-muted ml-1">Konfirmasi Password Baru</label>
                      <input 
                        id="security-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Ulangi password baru..."
                        className="w-full p-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 text-sm font-semibold"
                        title="Konfirmasi Password Baru"
                      />
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={changingPassword || !oldPassword || !newPassword}
                    className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-amber-500/10 flex justify-center items-center gap-1.5"
                  >
                    {changingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />} Perbarui Password Keamanan
                  </button>
                </form>

                {/* 2. Lihat Perangkat Login */}
                <div className="space-y-4 pt-4">
                  <div className="flex justify-between items-center pb-2 border-b border-border-light dark:border-border-dark">
                    <h3 className="text-sm font-black uppercase text-muted tracking-wider">Perangkat Login Aktif</h3>
                    <button 
                      onClick={fetchDevicesAndLogs}
                      disabled={loadingSessions}
                      className="p-1 text-muted hover:text-primary transition-all disabled:opacity-50"
                      title="Perbarui daftar"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingSessions ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {loadingSessions && sessions.length === 0 ? (
                    <div className="text-center py-6">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                    </div>
                  ) : sessions.length === 0 ? (
                    <p className="text-xs text-muted text-center py-4">Tidak ada data perangkat aktif.</p>
                  ) : (
                    <div className="space-y-4">
                      {sessions.map(s => (
                        <div key={s.id} className={`p-4 rounded-2xl border ${s.isSuspicious ? 'border-red-300 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/5' : 'border-border-light dark:border-border-dark'} flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs relative overflow-hidden`}>
                          
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <Smartphone className="w-4 h-4 text-primary shrink-0" />
                              <span className="font-bold text-sm">{s.deviceName}</span>
                              {s.isCurrent && (
                                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 text-[8px] font-black uppercase">Perangkat Ini</span>
                              )}
                              {s.isSuspicious && (
                                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-[8px] font-black uppercase">Mencurigakan</span>
                              )}
                            </div>
                            <div className="text-muted grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 leading-relaxed font-semibold">
                              <p>Browser: {s.browser} ({s.os})</p>
                              <p>IP Address: {s.ipAddress}</p>
                              <p>Lokasi: {s.city || 'Unknown'}, {s.country || 'Unknown'}</p>
                              <p>Aktivitas Terakhir: {new Date(s.lastActiveAt).toLocaleString('id-ID')}</p>
                            </div>
                          </div>

                          <div className="flex gap-2 self-end sm:self-center shrink-0 z-10">
                            {!s.isCurrent && (
                              <>
                                <button 
                                  onClick={() => handleMarkSuspicious(s.sessionId, !s.isSuspicious)}
                                  className={`px-3 py-2 rounded-xl font-bold uppercase text-[9px] border transition-all ${
                                    s.isSuspicious 
                                      ? 'bg-amber-500/10 text-amber-500 border-amber-500/25' 
                                      : 'bg-red-500/10 text-red-500 border-red-500/25'
                                  }`}
                                  title={s.isSuspicious ? "Hilangkan Tanda Mencurigakan" : "Tandai Mencurigakan"}
                                >
                                  {s.isSuspicious ? "Aman" : "Mencurigakan"}
                                </button>
                                <button 
                                  onClick={() => handleRevokeSession(s.sessionId)}
                                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black uppercase text-[9px] shadow-sm"
                                  title="Putuskan Koneksi"
                                >
                                  Logout
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}

                      {sessions.length > 1 && (
                        <button 
                          onClick={handleRevokeAllSessions}
                          className="w-full py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all"
                        >
                          Keluar dari Semua Perangkat Lain
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Log Keamanan Terkini */}
                {securityLogs.length > 0 && (
                  <div className="space-y-3 pt-4">
                    <h3 className="text-sm font-black uppercase text-muted tracking-wider pb-2 border-b border-border-light dark:border-border-dark">Riwayat Log Keamanan Akun</h3>
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar text-[10px]">
                      {securityLogs.map(l => (
                        <div key={l.id} className="flex justify-between items-start gap-4 p-2.5 rounded-xl bg-background-light dark:bg-background-dark/30 border border-border-light/40 dark:border-border-dark/40">
                          <div>
                            <p className="font-bold text-xs">{l.activity.replace(/_/g, ' ')}</p>
                            <p className="text-muted mt-0.5">IP: {l.ip_address} | {l.browser} ({l.device || 'PC'})</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`px-2 py-0.5 rounded font-black uppercase text-[8px] ${
                              l.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>{l.status}</span>
                            <p className="text-muted mt-1 text-[8px]">{new Date(l.created_at).toLocaleString('id-ID')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Zona Bahaya */}
                <div className="bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-200 dark:border-red-900/30 p-6 space-y-4">
                  <h3 className="text-lg font-black text-red-700 dark:text-red-400 uppercase tracking-wide">Zona Tindakan Berbahaya</h3>
                  <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed font-semibold">
                    Menonaktifkan akun akan mengeluarkan Anda secara otomatis dari semua perangkat dan menonaktifkan login sementara. Menghapus akun bersifat PERMANEN dan menghapus identitas pribadi Anda dari sistem secara total.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={() => handleStartDeactivateDeleteFlow("deactivate")}
                      className="px-5 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-amber-600/10"
                    >
                      Nonaktifkan Akun
                    </button>
                    <button 
                      onClick={() => handleStartDeactivateDeleteFlow("delete")}
                      className="px-5 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-red-600/10"
                    >
                      Hapus Akun Permanen
                    </button>
                  </div>
                </div>

              </motion.div>
            )}

            {/* Tab: Ajukan Resign (resign) */}
            {activeTab === "resign" && (
              <motion.div key="resign-tab" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-8 shadow-xl space-y-6">
                <div className="border-l-4 border-teal-500 pl-4 py-1">
                  <h3 className="text-lg font-black text-teal-600 dark:text-teal-400 uppercase tracking-wider">Form Pengajuan Resign</h3>
                  <p className="text-xs text-muted mt-0.5">Ajukan pengunduran diri secara resmi kepada manajemen</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center mr-1">
                      <label className="text-xs font-black uppercase text-muted ml-1">Nama Lengkap</label>
                      <span className="px-2 py-0.5 text-[8px] font-black uppercase bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-full">Auto & Locked</span>
                    </div>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-teal-500" />
                      <input type="text" readOnly value={profile.full_name} className="w-full pl-12 pr-4 py-3.5 bg-teal-500/5 dark:bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 rounded-2xl font-bold cursor-not-allowed outline-none" placeholder="Auto-Fill" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center mr-1">
                      <label className="text-xs font-black uppercase text-muted ml-1">No. ID Karyawan</label>
                      <span className="px-2 py-0.5 text-[8px] font-black uppercase bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-full">Auto & Locked</span>
                    </div>
                    <div className="relative">
                      <Shield className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-teal-500" />
                      <input type="text" readOnly value={profile.employee_id} className="w-full pl-12 pr-4 py-3.5 bg-teal-500/5 dark:bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 rounded-2xl font-mono font-bold cursor-not-allowed outline-none" placeholder="Auto-Fill" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center mr-1">
                      <label className="text-xs font-black uppercase text-muted ml-1">Jabatan / Role</label>
                      <span className="px-2 py-0.5 text-[8px] font-black uppercase bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-full">Auto & Locked</span>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-teal-500" />
                      <input type="text" readOnly value={profile.role.toUpperCase()} className="w-full pl-12 pr-4 py-3.5 bg-teal-500/5 dark:bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 rounded-2xl font-bold cursor-not-allowed outline-none" placeholder="Auto-Fill" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center mr-1">
                      <label className="text-xs font-black uppercase text-muted ml-1">Divisi</label>
                      <span className="px-2 py-0.5 text-[8px] font-black uppercase bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-full">Auto & Locked</span>
                    </div>
                    <div className="relative">
                      <ClipboardList className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-teal-500" />
                      <input type="text" readOnly value={profile.role === "cashier" ? "KASIR" : "OPERASIONAL"} className="w-full pl-12 pr-4 py-3.5 bg-teal-500/5 dark:bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 rounded-2xl font-bold cursor-not-allowed outline-none" placeholder="Auto-Fill" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="effectiveDate" className="text-xs font-black uppercase text-muted ml-1">Tanggal Efektif Keluar <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                    <input id="effectiveDate" type="date" value={effectiveDate} onChange={e => handleEffectiveDateChange(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 transition-all font-bold" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="resignReason" className="text-xs font-black uppercase text-muted ml-1">Alasan Resign <span className="text-red-500">*</span></label>
                  <textarea id="resignReason" rows={3} value={reason} onChange={e => handleReasonChange(e.target.value)} className="w-full p-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm font-semibold" placeholder="Sebutkan alasan utama Anda mengundurkan diri secara jelas..." />
                </div>

                <div className="space-y-2">
                  <label htmlFor="additionalNotes" className="text-xs font-black uppercase text-muted ml-1">Keterangan Tambahan (Opsional)</label>
                  <textarea id="additionalNotes" rows={2} value={additionalNotes} onChange={e => handleAdditionalNotesChange(e.target.value)} className="w-full p-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm font-semibold" placeholder="Keterangan pendukung atau pesan penutup lainnya..." />
                </div>

                <button 
                  type="button" 
                  disabled={!effectiveDate || !reason.trim()} 
                  onClick={() => openModal('profile_confirm_resign', { onConfirm: handleSubmitResign })} 
                  className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black shadow-xl shadow-teal-600/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" /> Ajukan Pengunduran Diri
                </button>
              </motion.div>
            )}

            {/* Tab: Cek Status Resign (status) */}
            {activeTab === "status" && (
              <motion.div key="status-tab" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-8 shadow-xl space-y-6">
                <div className="border-l-4 border-blue-500 pl-4 py-1">
                  <h3 className="text-lg font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Cek Status Resign</h3>
                  <p className="text-xs text-muted mt-0.5">Masukkan kredensial Anda untuk memantau status pengajuan</p>
                </div>

                {!hasChecked ? (
                  <form onSubmit={handleCheckStatus} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="checkId" className="text-xs font-black uppercase text-muted ml-1">No. ID Karyawan</label>
                      <input id="checkId" type="text" value={checkId} onChange={e => setCheckId(e.target.value)} className="w-full px-4 py-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" placeholder="KRY-..." />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="checkPass" className="text-xs font-black uppercase text-muted ml-1">Password</label>
                      <div className="relative">
                        <input id="checkPass" type={showPass ? "text" : "password"} value={checkPassword} onChange={e => setCheckPassword(e.target.value)} className="w-full pl-4 pr-12 py-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-mono" placeholder="********" />
                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-text-light dark:hover:text-text-dark">
                          {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <button type="submit" disabled={checking} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-xl shadow-blue-600/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs">
                      {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verifikasi & Cek Status"}
                    </button>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-500/10">
                      <div>
                        <p className="text-[10px] font-black uppercase text-blue-500">ID Karyawan Terpilih</p>
                        <p className="font-mono font-bold text-sm text-text-light dark:text-text-dark">{checkId}</p>
                      </div>
                      <button onClick={() => { setHasChecked(false); setCheckPassword(""); }} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-800 text-muted rounded-xl font-bold text-xs hover:bg-gray-300 transition-all">Ganti ID</button>
                    </div>

                    {checkedRequests.length === 0 ? (
                      <div className="text-center py-8 space-y-2 border border-dashed border-border-light dark:border-border-dark rounded-3xl">
                        <p className="text-sm font-bold text-muted">Belum ada pengajuan resign terdaftar untuk ID ini.</p>
                        <p className="text-xs text-muted/80">Silakan ajukan pengunduran diri terlebih dahulu di tab sebelah.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {checkedRequests.map((req, index) => (
                          <div key={req.id} className="bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark p-6 rounded-3xl space-y-4 shadow-sm relative overflow-hidden">
                            {index === 0 && <span className="absolute top-0 right-0 px-3 py-1 bg-blue-500 text-white text-[8px] font-black uppercase rounded-bl-xl tracking-wide">Terbaru</span>}
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <p className="text-[10px] font-black uppercase text-muted">Tanggal Efektif Keluar</p>
                                <p className="font-bold text-sm text-text-light dark:text-text-dark">{new Date(req.effective_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                              </div>
                              <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase ${
                                req.status === "Menunggu Konfirmasi" ? "bg-amber-100 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400" :
                                req.status === "Disetujui" ? "bg-green-100 text-green-600 dark:bg-green-950/30 dark:text-green-400" :
                                req.status === "Dibatalkan" ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" :
                                "bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400"
                              }`}>
                                {req.status}
                              </span>
                            </div>

                            <div className="space-y-1.5 pt-2 border-t border-border-light dark:border-border-dark">
                              <p className="text-[10px] font-black uppercase text-muted">Alasan Utama</p>
                              <p className="text-xs text-text-light dark:text-text-dark bg-gray-50 dark:bg-gray-800/40 p-3 rounded-xl italic">&ldquo;{req.reason}&rdquo;</p>
                            </div>

                            {req.additional_notes && (
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black uppercase text-muted">Keterangan Tambahan</p>
                                <p className="text-xs text-muted leading-relaxed">{req.additional_notes}</p>
                              </div>
                            )}

                            {req.admin_notes && (
                              <div className="mt-2 p-4 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 rounded-2xl space-y-1">
                                <p className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">Catatan Tanggapan Admin</p>
                                <p className="text-xs text-text-light dark:text-text-dark font-medium">{req.admin_notes}</p>
                              </div>
                            )}

                            {req.status === "Disetujui" && req.suspension_time && (
                              <ResignCountdownWidget req={req} profile={profile} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {profile.role === "customer" && activeTab === "profile" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-200 dark:border-red-900/30 p-8 shadow-xl mt-6">
              <h3 className="text-lg font-black text-red-700 dark:text-red-400 uppercase tracking-wide">Zona Bahaya</h3>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1 font-semibold leading-relaxed">
                Tindakan di bawah ini bersifat permanen dan akan menghapus seluruh data Anda dari database secara total.
              </p>
              <button 
                onClick={() => handleStartDeactivateDeleteFlow("delete")} 
                className="mt-4 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-600/20"
              >
                Hapus Akun Saya
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Layered Confirmation & OTP Modal */}
      <AnimatePresence>
        {showOtpModal && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-[2rem] p-6 w-full max-w-md shadow-2xl space-y-6 flex flex-col text-text-light dark:text-text-dark"
            >
              <div className="flex justify-between items-center pb-2 border-b border-border-light dark:border-border-dark">
                <h3 className="font-bold text-lg uppercase tracking-tight flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" /> Verifikasi Tindakan Akun
                </h3>
                <button onClick={() => setShowOtpModal(false)} className="text-muted hover:text-text-light dark:hover:text-text-dark">&times;</button>
              </div>

              {otpStep === "credentials" ? (
                <div className="space-y-4">
                  <p className="text-xs text-muted font-bold leading-relaxed">
                    Untuk melanjutkan tindakan ini, Anda wajib memverifikasi password keamanan akun RestoBook Anda terlebih dahulu.
                  </p>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted ml-1">Password Akun</label>
                    <input 
                      type="password"
                      value={confirmDeletePassword}
                      onChange={e => setConfirmDeletePassword(e.target.value)}
                      placeholder="Masukkan password Anda..."
                      className="w-full p-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 text-sm font-semibold"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setShowOtpModal(false)}
                      className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-muted rounded-xl font-bold text-xs uppercase"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={handleDeactivateDeleteVerifyCredentials}
                      disabled={sendingOtp || !confirmDeletePassword}
                      className="flex-2 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {sendingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Kirim OTP Verifikasi
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted font-bold leading-relaxed">
                    Kode verifikasi OTP sekali pakai telah dikirim. Masukkan 6 digit kode untuk melanjutkan tindakan.
                  </p>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted ml-1">Kode OTP</label>
                    <input 
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="Masukkan 6 digit kode OTP..."
                      className="w-full p-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-slate-300 focus:border-slate-400 text-center text-lg font-black tracking-[8px]"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setShowOtpModal(false)}
                      className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-muted rounded-xl font-bold text-xs uppercase"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={['deactivate', 'delete'].includes(otpType) ? handleDeactivateDeleteVerifyOtp : handleVerifyOtp}
                      disabled={verifyingOtp || otpCode.length < 6}
                      className="flex-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-1.5 disabled:opacity-50 shadow-md shadow-red-600/10"
                    >
                      {verifyingOtp ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Konfirmasi & Jalankan
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
