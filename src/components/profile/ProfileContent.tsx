"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Mail, Phone, Camera, Save, Loader2, Shield, Lock, Key, CheckCircle, X, MessageSquare, ClipboardList, Send, Calendar, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

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
  const [profile, setProfile] = useState({ id: "", full_name: "", phone: "", avatar_url: "", email: "", role: "", employee_id: "", email_unlocked: false });
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  // Tab State
  const [activeTab, setActiveTab] = useState<"profile" | "resign" | "status">("profile");

  // Resign Form State
  const [effectiveDate, setEffectiveDate] = useState("");
  const [reason, setReason] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [showConfirmResign, setShowConfirmResign] = useState(false);
  const [submittingResign, setSubmittingResign] = useState(false);

  // Resign Status Check State
  const [checkId, setCheckId] = useState("");
  const [checkPassword, setCheckPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkedRequests, setCheckedRequests] = useState<any[]>([]);
  const [hasChecked, setHasChecked] = useState(false);
  const [showPass, setShowPass] = useState(false);

  // Password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [step, setStep] = useState<"request" | "verify">("request");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [otpMethod, setOtpMethod] = useState<"email" | "whatsapp">("email");
  const [submittingPass, setSubmittingPass] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [waCountdown, setWaCountdown] = useState(0);

  // Delete account state & function
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Sesi tidak ditemukan");

      const response = await fetch('/api/profile/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal menghapus akun");

      toast.success("Akun Anda berhasil dihapus sepenuhnya!");
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (e) {
        console.error('API logout failed', e);
      }
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (waCountdown > 0) {
      timer = setInterval(() => setWaCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [waCountdown]);

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
                email_unlocked: !!payload.new.email_unlocked
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
        setProfile({
          id: data.id,
          full_name: data.full_name || "",
          phone: data.phone || "",
          avatar_url: data.avatar_url || "",
          email: data.email || session.user.email || "",
          role: data.role || "customer",
          employee_id: data.employee_id || "",
          email_unlocked: !!data.email_unlocked
        });
        setPreviewUrl(data.avatar_url || "");
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

      if (result.data) {
        setProfile(prev => ({
          ...prev,
          email: result.data.email || prev.email,
          email_unlocked: false // lock field immediately
        }));
      }

      toast.success("Profil diperbarui!");
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
    } catch (e: any) {
      console.error("Upload error:", e);
      toast.error(e.message || "Gagal mengunggah foto");
    } finally {
      setUploading(false);
    }
  };

  const handleSendOTP = async () => {
    if (!oldPassword.trim()) return toast.error("Masukkan password lama Anda terlebih dahulu");
    setSubmittingPass(true);
    try {
      // Verify old password first via Supabase signIn
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: oldPassword
      });
      if (signInError) throw new Error("Password lama tidak sesuai. Silakan coba kembali.");

      // Bypass OTP send if user is admin
      if (profile.role === "admin") {
        toast.success("Password lama terverifikasi! Masukkan password baru Anda.");
        setStep("verify");
        return;
      }

      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: profile.email,
          phone: profile.phone,
          method: otpMethod,
          type: "change_password",
          name: profile.full_name
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengirim OTP");
      
      toast.success(`Kode OTP dikirim via ${otpMethod === 'email' ? 'Email' : 'WhatsApp'}!`);
      setStep("verify");
      if (otpMethod === 'email') setCountdown(60);
      else setWaCountdown(60);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmittingPass(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) return toast.error("Password baru minimal 6 karakter");
    if (profile.role !== "admin" && otp.length < 6) return toast.error("Masukkan kode OTP 6 digit");
    setSubmittingPass(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email,
          otp: profile.role === "admin" ? undefined : otp,
          newPassword,
          userId: session?.user.id,
          isAdminBypass: profile.role === "admin"
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal ganti password");
      
      toast.success("Password berhasil diubah!");
      setShowPasswordModal(false);
      setStep("request");
      setOtp("");
      setNewPassword("");
      setOldPassword("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmittingPass(false);
    }
  };

  // Submit Resign Logic
  const handleSubmitResign = async () => {
    if (!effectiveDate) return toast.error("Tanggal Efektif Keluar wajib diisi");
    if (!reason.trim()) return toast.error("Alasan Resign wajib diisi");
    if (!profile.role) return toast.error("Data jabatan tidak ditemukan. Silakan hubungi admin.");

    setSubmittingResign(true);
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
        status: "Menunggu Konfirmasi" // Pastikan ini sesuai dengan CONSTRAINT di DB
      });

      if (error) throw error;

      // Trigger automatic polite WhatsApp notification via Fonnte API
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
      setActiveTab("status");
      setEffectiveDate("");
      setReason("");
      setAdditionalNotes("");
      setShowConfirmResign(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmittingResign(false);
    }
  };

  // Check Resign Status Logic
  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkId.trim()) return toast.error("No. ID Karyawan wajib diisi");
    if (!checkPassword.trim()) return toast.error("Password wajib diisi");

    setChecking(true);
    try {
      // 1. Get profile by employee_id
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("email")
        .eq("employee_id", checkId)
        .maybeSingle();

      if (profErr || !prof) {
        throw new Error("No. ID atau Password yang Anda masukkan tidak sesuai. Silakan coba kembali.");
      }

      // 2. Validate password via Supabase Auth SignIn
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: prof.email,
        password: checkPassword
      });

      if (authErr) {
        throw new Error("No. ID atau Password yang Anda masukkan tidak sesuai. Silakan coba kembali.");
      }

      // 3. Password correct! Fetch resign requests
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

  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-text-light dark:text-text-dark uppercase tracking-wide">Profil Saya</h1>
          <p className="text-muted mt-1">Kelola data diri, keamanan akun, dan status keanggotaan</p>
        </div>
        <button onClick={() => setShowPasswordModal(true)} className="flex items-center justify-center gap-2 px-5 py-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl font-black hover:bg-amber-500 hover:text-white transition-all text-sm uppercase tracking-wider shadow-lg shadow-amber-500/5">
          <Key className="w-4 h-4" /> Ganti Password
        </button>
      </div>

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
              <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2.5 bg-primary text-white rounded-full shadow-lg hover:scale-110 transition-transform">
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
          </motion.div>
        </div>

        {/* Right Column: Tab Contents */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {activeTab === "profile" && (
              <motion.div key="profile-tab" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-8 shadow-xl space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label htmlFor="fullName" className="text-xs font-black uppercase text-muted ml-1">Nama Lengkap</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                      <input id="fullName" type="text" value={profile.full_name} onChange={e => setProfile({...profile, full_name: e.target.value})} className="w-full pl-12 pr-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all" placeholder="Nama Lengkap" title="Nama Lengkap" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="phoneNumber" className="text-xs font-black uppercase text-muted ml-1">No. Telepon</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                      <input id="phoneNumber" type="tel" value={profile.phone} onChange={e => setProfile({...profile, phone: e.target.value})} className="w-full pl-12 pr-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all" placeholder="0812..." title="Nomor Telepon" />
                    </div>
                  </div>
                </div>
                {profile.email_unlocked && (
                  <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-2xl text-xs font-bold leading-relaxed mb-4">
                    Beberapa kolom yang terkait telah dibuka sementara agar Anda dapat melanjutkan proses pembaruan sesuai persetujuan admin.
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="emailAddr" className="text-xs font-black uppercase text-muted ml-1">Alamat Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                    <input
                      id="emailAddr"
                      type="email"
                      value={profile.email}
                      disabled={profile.role !== "admin" && !profile.email_unlocked}
                      onChange={e => setProfile({ ...profile, email: e.target.value })}
                      className={`w-full pl-12 pr-4 py-3.5 border rounded-2xl outline-none transition-all ${
                        profile.role === "admin" || profile.email_unlocked
                          ? "bg-background-light dark:bg-background-dark border-primary focus:ring-2 focus:ring-primary/20 text-text-light dark:text-text-dark"
                          : "bg-gray-50 dark:bg-gray-800/50 border-border-light dark:border-border-dark text-muted cursor-not-allowed"
                      }`}
                      placeholder="email@contoh.com"
                      title="Alamat Email"
                    />
                  </div>
                </div>
                
                <button onClick={handleSave} disabled={saving} className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Simpan Perubahan</>}
                </button>
              </motion.div>
            )}

            {activeTab === "resign" && (
              <motion.div key="resign-tab" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-8 shadow-xl space-y-6">
                <div className="border-l-4 border-teal-500 pl-4 py-1">
                  <h3 className="text-lg font-black text-teal-600 dark:text-teal-400 uppercase tracking-wider">Form Pengajuan Resign</h3>
                  <p className="text-xs text-muted mt-0.5">Ajukan pengunduran diri secara resmi kepada manajemen</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Auto-detect Full Name */}
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

                  {/* Auto-detect Employee ID */}
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

                  {/* Auto-detect Job Role */}
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

                  {/* Auto-detect Division */}
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

                {/* Input 1: Tanggal Efektif */}
                <div className="space-y-2">
                  <label htmlFor="effectiveDate" className="text-xs font-black uppercase text-muted ml-1">Tanggal Efektif Keluar <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                    <input id="effectiveDate" type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className="w-full pl-12 pr-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 transition-all font-bold" />
                  </div>
                </div>

                {/* Input 2: Alasan Resign */}
                <div className="space-y-2">
                  <label htmlFor="resignReason" className="text-xs font-black uppercase text-muted ml-1">Alasan Resign <span className="text-red-500">*</span></label>
                  <textarea id="resignReason" rows={3} value={reason} onChange={e => setReason(e.target.value)} className="w-full p-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm" placeholder="Sebutkan alasan utama Anda mengundurkan diri secara jelas..." />
                </div>

                {/* Input 3: Keterangan Tambahan */}
                <div className="space-y-2">
                  <label htmlFor="additionalNotes" className="text-xs font-black uppercase text-muted ml-1">Keterangan Tambahan (Opsional)</label>
                  <textarea id="additionalNotes" rows={2} value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} className="w-full p-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-teal-500 transition-all text-sm" placeholder="Keterangan pendukung atau pesan penutup lainnya..." />
                </div>

                <button 
                  type="button" 
                  disabled={!effectiveDate || !reason.trim()} 
                  onClick={() => setShowConfirmResign(true)} 
                  className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black shadow-xl shadow-teal-600/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" /> Ajukan Pengunduran Diri
                </button>
              </motion.div>
            )}

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

                            {/* Countdown & Final Decision Widget */}
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

          {profile.role === "customer" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-200 dark:border-red-900/30 p-8 shadow-xl mt-6">
              <h3 className="text-lg font-black text-red-700 dark:text-red-400 uppercase tracking-wide">Zona Bahaya</h3>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">Tindakan di bawah ini bersifat permanen dan akan menghapus seluruh data Anda dari database tanpa sisa.</p>
              <button 
                onClick={() => setShowDeleteModal(true)} 
                className="mt-4 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-red-600/20"
              >
                Hapus Akun Saya
              </button>
            </motion.div>
          )}
        </div>
      </div>

      {/* Confirm Resign Modal */}
      <AnimatePresence>
        {showConfirmResign && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowConfirmResign(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-card-light dark:bg-card-dark w-full max-w-md rounded-3xl shadow-2xl p-8 border border-teal-500/20">
              <button onClick={() => setShowConfirmResign(false)} aria-label="Tutup" title="Tutup" className="absolute top-6 right-6 p-2 text-muted hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><AlertTriangle className="w-8 h-8" /></div>
                <h3 className="text-2xl font-black text-text-light dark:text-text-dark uppercase">Kirim Pengajuan?</h3>
                <p className="text-sm text-muted mt-2">Pastikan semua data yang Anda masukkan sudah benar dan sesuai dengan kesepakatan internal.</p>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-teal-600 bg-teal-50 dark:bg-teal-950/30 p-4 rounded-2xl text-center leading-relaxed">
                  Pengajuan akan diteruskan langsung ke Panel Manajemen Admin RestoBook secara real-time.
                </p>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setShowConfirmResign(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-muted rounded-2xl font-black text-xs uppercase">Batal</button>
                  <button 
                    type="button"
                    onClick={handleSubmitResign} 
                    disabled={submittingResign} 
                    className="flex-1 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2"
                  >
                    {submittingResign ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ya, Kirim"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Account Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowDeleteModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-card-light dark:bg-card-dark w-full max-w-md rounded-3xl shadow-2xl p-8 border border-red-500/20">
              <button onClick={() => setShowDeleteModal(false)} aria-label="Tutup" title="Tutup" className="absolute top-6 right-6 p-2 text-muted hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><Shield className="w-8 h-8" /></div>
                <h3 className="text-2xl font-black text-text-light dark:text-text-dark">Hapus Akun Anda?</h3>
                <p className="text-sm text-muted mt-2">Semua data diri, transaksi, ulasan, keranjang belanja, dan pesanan Anda akan <strong className="font-bold text-text-light dark:text-text-dark">dibersihkan sepenuhnya tanpa sisa</strong> dari database.</p>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/30 p-4 rounded-2xl text-center leading-relaxed">
                  Tindakan ini bersifat PERMANEN dan tidak dapat dibatalkan dengan cara apa pun. Anda akan otomatis keluar dari aplikasi.
                </p>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setShowDeleteModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-muted rounded-2xl font-black text-xs uppercase">Batal</button>
                  <button 
                    type="button"
                    onClick={handleDeleteAccount} 
                    disabled={deleting} 
                    className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                  >
                    {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ya, Hapus Permanen"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowPasswordModal(false); setStep("request"); setOldPassword(""); setOtp(""); setNewPassword(""); }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-card-light dark:bg-card-dark w-full max-w-md rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
              <button onClick={() => { setShowPasswordModal(false); setStep("request"); setOldPassword(""); setOtp(""); setNewPassword(""); }} aria-label="Tutup" title="Tutup" className="absolute top-6 right-6 p-2 text-muted hover:bg-gray-100 rounded-xl"><X className="w-5 h-5" /></button>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4"><Lock className="w-8 h-8" /></div>
                <h3 className="text-2xl font-black text-text-light dark:text-text-dark">Ganti Password</h3>
                <p className="text-sm text-muted mt-2">
                  {step === "request" ? "Masukkan password lama dan pilih metode OTP" : "Masukkan kode OTP yang diterima & password baru"}
                </p>
              </div>

              {/* Step indicators */}
              <div className="flex items-center gap-2 mb-6">
                <div className={`flex-1 h-1.5 rounded-full transition-all ${step === "request" ? "bg-primary" : "bg-primary"}`} />
                <div className={`flex-1 h-1.5 rounded-full transition-all ${step === "verify" ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"}`} />
              </div>

              {step === "request" ? (
                <div className="space-y-5">
                  {/* Old Password Field */}
                  <div className="space-y-1.5">
                    <label htmlFor="oldPasswordInput" className="text-xs font-black uppercase text-muted ml-1">Password Lama</label>
                    <div className="relative">
                      <input
                        id="oldPasswordInput"
                        type={showOldPass ? "text" : "password"}
                        value={oldPassword}
                        onChange={e => setOldPassword(e.target.value)}
                        className="w-full pl-4 pr-12 py-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-primary font-mono"
                        placeholder="Masukkan password saat ini..."
                        title="Password Lama"
                      />
                      <button type="button" onClick={() => setShowOldPass(!showOldPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-text-light dark:hover:text-text-dark">
                        {showOldPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* OTP Method Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase text-muted ml-1">Kirim OTP Ke</label>
                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl gap-2">
                      <button 
                        type="button"
                        onClick={() => setOtpMethod("email")}
                        className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${otpMethod === "email" ? "bg-white dark:bg-gray-700 shadow-sm text-primary" : "text-muted"}`}
                      >
                        <Mail className="w-4 h-4" /> Email
                      </button>
                      <button 
                        type="button"
                        onClick={() => setOtpMethod("whatsapp")}
                        className={`flex-1 py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${otpMethod === "whatsapp" ? "bg-white dark:bg-gray-700 shadow-sm text-green-500" : "text-muted"}`}
                      >
                        <Phone className="w-4 h-4" /> WhatsApp
                      </button>
                    </div>
                  </div>
                  
                  <button onClick={handleSendOTP} disabled={submittingPass || !oldPassword.trim()} className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-2 uppercase text-xs disabled:opacity-50">
                    {submittingPass ? <Loader2 className="w-5 h-5 animate-spin" /> : profile.role === "admin" ? "Verifikasi Password" : "Verifikasi & Kirim OTP"}
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {profile.role !== "admin" && (
                    <div className="space-y-1.5">
                      <label htmlFor="otpInput" className="text-xs font-black uppercase text-muted ml-1">Kode OTP</label>
                      <input id="otpInput" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} type="text" inputMode="numeric" className="w-full px-4 py-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-primary text-center text-2xl font-black tracking-[10px]" placeholder="000000" title="Masukkan Kode OTP" />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label htmlFor="newPasswordInput" className="text-xs font-black uppercase text-muted ml-1">Password Baru</label>
                    <div className="relative">
                      <input
                        id="newPasswordInput"
                        type={showNewPass ? "text" : "password"}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full pl-4 pr-12 py-4 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-primary font-mono"
                        placeholder="Minimal 6 karakter..."
                        title="Password Baru"
                      />
                      <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-text-light dark:hover:text-text-dark">
                        {showNewPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <button onClick={handleChangePassword} disabled={submittingPass} className="w-full py-4 bg-green-500 text-white rounded-2xl font-black shadow-xl shadow-green-500/20 hover:bg-green-600 transition-all flex items-center justify-center gap-2 uppercase text-xs">
                    {submittingPass ? <Loader2 className="w-5 h-5 animate-spin" /> : "Konfirmasi Ganti Password"}
                  </button>
                  
                  <div className="text-center space-y-2 mt-4">
                    {profile.role !== "admin" && (
                      <>
                        <p className="text-[10px] font-black uppercase text-muted">Belum menerima kode?</p>
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => { setOtpMethod("email"); handleSendOTP(); }} 
                            disabled={countdown > 0 || submittingPass}
                            className="text-[11px] font-bold text-primary hover:underline disabled:text-muted flex items-center justify-center gap-2 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl"
                          >
                            <Mail className="w-3.5 h-3.5" /> {countdown > 0 ? `Kirim Ulang Email (${countdown}s)` : "Kirim Ulang via Email"}
                          </button>
                          <button 
                            onClick={() => { setOtpMethod("whatsapp"); handleSendOTP(); }} 
                            disabled={waCountdown > 0 || submittingPass}
                            className="text-[11px] font-bold text-green-600 hover:underline disabled:text-muted flex items-center justify-center gap-2 py-2 bg-green-50 dark:bg-green-900/20 rounded-xl"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> {waCountdown > 0 ? `Kirim via WhatsApp (${waCountdown}s)` : "Kirim via WhatsApp Saja"}
                          </button>
                        </div>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => { setStep("request"); setOtp(""); setNewPassword(""); }}
                      className="text-[11px] font-bold text-muted hover:text-text-light dark:hover:text-text-dark py-2"
                    >
                      ← Kembali
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
