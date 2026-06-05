"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, User, Lock, Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle, Clock, X, MessageSquare, CheckCircle, XCircle, Ban, RefreshCw, ShieldAlert, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import Script from "next/script";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suspendedParam, setSuspendedParam] = useState<string | null>(null);
  const [profileIdParam, setProfileIdParam] = useState<string | null>(null);
  const [isReactivated, setIsReactivated] = useState(false);

  const [suspendData, setSuspendData] = useState<any>(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [countdown, setCountdown] = useState<any>(null);
  const [appealData, setAppealData] = useState<any>(null);
  const [loadingAppeal, setLoadingAppeal] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!suspendData || !suspendData.suspend_until) return;

    let timer: any;

    const calculateCountdown = () => {
      const until = new Date(suspendData.suspend_until).getTime();
      const diff = until - Date.now();

      if (diff <= 0) {
        if (timer) clearInterval(timer);
        setCountdown(null);
        toast.success("Masa penangguhan Anda telah berakhir! Silakan coba masuk kembali.", { duration: 6000 });
        setShowSuspendModal(false);
        setSuspendData(null);
        
        supabase.from('profiles').update({
          status: 'active',
          suspend_reason: null,
          suspend_message: null,
          suspended_at: null,
          suspend_until: null,
          suspend_type: null,
          just_restored: true,
          is_active: true
        }).eq('id', suspendData.id).then();
      } else {
        let tempDiff = diff;
        const tahun = Math.floor(tempDiff / 31536000000);
        tempDiff -= tahun * 31536000000;

        const bulan = Math.floor(tempDiff / 2592000000);
        tempDiff -= bulan * 2592000000;

        const minggu = Math.floor(tempDiff / 604800000);
        tempDiff -= minggu * 604800000;

        const hari = Math.floor(tempDiff / 86400000);
        tempDiff -= hari * 86400000;

        const jam = Math.floor(tempDiff / 3600000);
        tempDiff -= jam * 3600000;

        const menit = Math.floor(tempDiff / 60000);
        tempDiff -= menit * 60000;

        const detik = Math.floor(tempDiff / 1000);

        setCountdown({ tahun, bulan, minggu, hari, jam, menit, detik });
      }
    };

    calculateCountdown();
    timer = setInterval(calculateCountdown, 1000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [suspendData]);

  const fetchLatestAppeal = async (userId: string, silent = false) => {
    if (!userId) return;
    if (!silent) setLoadingAppeal(true);
    try {
      const res = await fetch(`/api/admin/customers/appeal?user_id=${userId}`);
      const resData = await res.json();
      if (res.ok) {
        setAppealData(resData.appeal || null);
      } else {
        setAppealData(null);
      }
    } catch (err) {
      console.error("Gagal memuat data banding:", err);
      setAppealData(null);
    } finally {
      if (!silent) setLoadingAppeal(false);
    }
  };

  // Fetch latest appeal & realtime listener when suspendData is set
  useEffect(() => {
    if (!suspendData?.id) return;

    fetchLatestAppeal(suspendData.id);

    // Realtime: listen for changes to appeals for this user
    const appealChannel = supabase
      .channel(`appeal-status-${suspendData.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appeals',
        filter: `user_id=eq.${suspendData.id}`
      }, (payload: any) => {
        if (payload.new) {
          setAppealData(payload.new);
          if (payload.new.status === 'approved') {
            toast.success('Selamat! Banding Anda telah disetujui. Akun Anda sudah aktif kembali.', { duration: 8000 });
          } else if (payload.new.status === 'rejected') {
            toast.error('Banding Anda ditolak oleh administrator.', { duration: 6000 });
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(appealChannel); };
  }, [suspendData?.id]);

  const formatCountdown = (cd: any) => {
    if (!cd) return '';
    const parts = [];
    if (cd.tahun > 0) parts.push(`${cd.tahun} tahun`);
    if (cd.bulan > 0) parts.push(`${cd.bulan} bulan`);
    if (cd.minggu > 0) parts.push(`${cd.minggu} minggu`);
    if (cd.hari > 0) parts.push(`${cd.hari} hari`);
    if (cd.jam > 0) parts.push(`${cd.jam} jam`);
    if (cd.menit > 0) parts.push(`${cd.menit} menit`);
    if (cd.detik > 0) parts.push(`${cd.detik} detik`);
    return parts.join(' ');
  };

  const handleGoogleLogin = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "19550365120-jprrkrregfjsi65o8ct1gnakvebln2g2.apps.googleusercontent.com";
    if (!clientId) {
      toast.error("Google Client ID belum dikonfigurasi");
      return;
    }

    try {
      const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor !== undefined;
      if (isCapacitor) {
        // Direct fallback to standard Supabase Google OAuth redirect in Capacitor
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/api/auth/callback`,
            queryParams: {
              prompt: 'select_account'
            }
          }
        });
        if (error) {
          toast.error("Gagal memulai Login Google: " + error.message);
        }
        return;
      }

      const google = (window as any).google;
      if (!google?.accounts?.id) {
        // Fallback to standard Supabase Google OAuth redirect
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/api/auth/callback`,
            queryParams: {
              prompt: 'select_account'
            }
          }
        });
        if (error) {
          toast.error("Gagal memulai Login Google: " + error.message);
        }
        return;
      }

      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          if (!response.credential) {
            toast.error("Login Google dibatalkan");
            return;
          }
          try {
            const { data, error } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: response.credential,
            });
            if (error) throw error;

            if (data?.user) {
              // Trigger callback to handle profile provisioning & email notification
              await fetch(`/api/auth/callback?idtoken=true&userId=${data.user.id}`, {
                method: 'GET',
              });
              
              // Get full profile details
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, role, status_karyawan, status, suspend_reason, suspend_message, suspend_until, suspend_type, just_restored, scheduled_suspend_at, email, full_name, employee_id')
                .eq('user_id', data.user.id)
                .single();

              if (profileError) throw profileError;

              // Pengecekan Karyawan Nonaktif (Resign / Dipecat)
              const employeeStatus = profile?.status_karyawan || 'aktif';
              if (employeeStatus === 'resign') {
                await supabase.auth.signOut();
                setSuspendedParam('resign');
                if (profile?.id) setProfileIdParam(profile.id);
                toast.error("LOGIN DITANGGUHKAN: Status akun Anda tidak aktif di RestoBook.", { duration: 6000 });
                return;
              }
              if (employeeStatus === 'dipecat') {
                await supabase.auth.signOut();
                setSuspendedParam('dipecat');
                if (profile?.id) setProfileIdParam(profile.id);
                toast.error("LOGIN DITOLAK: Akun dinonaktifkan oleh manajemen.", { duration: 6000 });
                return;
              }

              // Pengecekan Jadwal Suspen Otomatis
              let userStatus = profile?.status || 'active';
              if (userStatus === 'active' && profile?.scheduled_suspend_at && new Date() >= new Date(profile.scheduled_suspend_at)) {
                const isPermanent = profile.suspend_type === 'permanent';
                userStatus = isPermanent ? 'banned' : 'suspended';
                
                await supabase.from('profiles').update({
                  status: userStatus,
                  scheduled_suspend_at: null,
                  is_active: false
                }).eq('id', profile.id);
                
                await supabase.from('suspend_logs').insert({
                  user_id: profile.id,
                  action: isPermanent ? 'banned' : 'suspended',
                  reason: profile.suspend_reason || 'Penangguhan terjadwal dimulai',
                  message: profile.suspend_message || 'Akun Anda telah ditangguhkan sesuai jadwal',
                  duration: isPermanent ? 'Permanen' : 'Terjadwal',
                  suspend_until: isPermanent ? null : profile.suspend_until,
                  acted_by: null
                });

                if (profile) {
                  profile.status = userStatus;
                  profile.scheduled_suspend_at = null;
                }
              }

              // Pengecekan Suspen/Ban untuk Pengguna
              if (userStatus === 'suspended') {
                const now = new Date();
                const suspendUntil = profile.suspend_until ? new Date(profile.suspend_until) : null;
                const isExpired = suspendUntil && suspendUntil.getTime() <= now.getTime();

                if (isExpired) {
                  // Auto-restore status
                  await supabase.from('profiles').update({
                    status: 'active',
                    suspend_reason: null,
                    suspend_message: null,
                    suspended_at: null,
                    suspend_until: null,
                    suspend_type: null,
                    just_restored: true,
                    is_active: true
                  }).eq('id', profile.id);
                } else {
                  // Masih tersuspen
                  await supabase.auth.signOut();
                  setSuspendData(profile);
                  setShowSuspendModal(true);
                  return;
                }
              } else if (userStatus === 'banned') {
                await supabase.auth.signOut();
                setSuspendData(profile);
                setShowSuspendModal(true);
                return;
              }

              // Jika akun normal/pulih
              if (profile?.just_restored) {
                toast.success("Akun Anda telah resmi diaktifkan kembali oleh manajemen.", { 
                  duration: 5000 
                });
                await supabase.from('profiles').update({ just_restored: false }).eq('id', profile.id);
              } else {
                toast.success("Berhasil masuk dengan Google!");
              }

              const role = profile?.role || 'customer';
              setTimeout(() => {
                window.location.href = `/${role}/dashboard`;
              }, 1500);
            }
          } catch (err: any) {
            toast.error(err.message || "Gagal masuk dengan Google");
          }
        },
      });

      // Show Google One Tap / popup
      google.accounts.id.prompt(async (notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback to standard Supabase Google OAuth redirect in restricted environments
          const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo: `${window.location.origin}/api/auth/callback`,
              queryParams: {
                prompt: 'select_account'
              }
            }
          });
          if (error) {
            toast.error("Gagal memulai Login Google: " + error.message);
          }
        }
      });
    } catch (err: any) {
      toast.error(err.message || "Gagal masuk dengan Google");
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const suspended = params.get("suspended");
      const pid = params.get("pid");
      setSuspendedParam(suspended);
      setProfileIdParam(pid);

      if ((suspended === "suspended" || suspended === "banned") && pid) {
        supabase
          .from("profiles")
          .select("id, role, status_karyawan, status, suspend_reason, suspend_message, suspend_until, suspend_type, just_restored, scheduled_suspend_at, email, full_name, employee_id")
          .eq("id", pid)
          .single()
          .then(({ data, error }) => {
            if (!error && data) {
              setSuspendData(data);
              setShowSuspendModal(true);
            }
          });
      }
    }
  }, []);

  // REAL-TIME REACTIVATION LISTENER
  useEffect(() => {
    if (!profileIdParam) return;

    const channel = supabase
      .channel(`auth-reactivate-listener-${profileIdParam}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profileIdParam}` },
        (payload) => {
          if (payload.new.status === 'active' || payload.new.status_karyawan === 'aktif') {
             setIsReactivated(true);
             toast.success("Akun Anda berhasil diaktifkan kembali.", { duration: 5000 });
             setShowSuspendModal(false);
             setSuspendData(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileIdParam]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!identifier) return toast.error("Email tidak boleh kosong");
    if (!password) return toast.error("Password tidak boleh kosong");

    setLoading(true);
    try {
      // Dapatkan CSRF token dari cookie
      const getCsrfToken = () => {
        if (typeof window === "undefined") return "";
        return document.cookie
          .split("; ")
          .find(row => row.startsWith("csrf-token="))
          ?.split("=")[1] || "";
      };

      // Panggil API Login internal
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        body: JSON.stringify({ identifier, password })
      });

      const resData = await res.json();

      if (!res.ok) {
        if (resData.suspended && resData.pid) {
          setSuspendedParam(resData.status);
          setProfileIdParam(resData.pid);
          
          if (resData.status === "suspended" || resData.status === "banned") {
            const { data: profileData, error: profileErr } = await supabase
              .from("profiles")
              .select("id, role, status_karyawan, status, suspend_reason, suspend_message, suspend_until, suspend_type, just_restored, scheduled_suspend_at, email, full_name, employee_id")
              .eq("id", resData.pid)
              .single();
              
            if (!profileErr && profileData) {
              setSuspendData(profileData);
              setShowSuspendModal(true);
            }
          }
          toast.error(resData.error || "Akses akun ditangguhkan.");
        } else {
          toast.error(resData.error || "Login gagal");
        }
        setLoading(false);
        return;
      }

      // Sinkronisasikan sesi ke client Supabase SDK
      if (resData.session) {
        const { error: sessionError } = await supabase.auth.setSession(resData.session);
        if (sessionError) throw sessionError;
      }

      const user = resData.user;

      // Ambil detail profil lengkap
      if (user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, role, status_karyawan, status, suspend_reason, suspend_message, suspend_until, suspend_type, just_restored, scheduled_suspend_at, email, full_name, employee_id')
          .eq('user_id', user.id)
          .single();

        if (profileError) throw profileError;

        // Pengecekan Karyawan Nonaktif (Resign / Dipecat)
        const employeeStatus = profile?.status_karyawan || 'aktif';
        if (employeeStatus === 'resign') {
          await supabase.auth.signOut();
          setSuspendedParam('resign');
          if (profile?.id) setProfileIdParam(profile.id);
          toast.error("LOGIN DITANGGUHKAN: Status akun Anda tidak aktif di RestoBook.", { duration: 6000 });
          setLoading(false);
          return;
        }
        if (employeeStatus === 'dipecat') {
          await supabase.auth.signOut();
          setSuspendedParam('dipecat');
          if (profile?.id) setProfileIdParam(profile.id);
          toast.error("LOGIN DITOLAK: Akun dinonaktifkan oleh manajemen.", { duration: 6000 });
          setLoading(false);
          return;
        }

        // Pengecekan Jadwal Suspen Otomatis
        let userStatus = profile?.status || 'active';
        if (userStatus === 'active' && profile?.scheduled_suspend_at && new Date() >= new Date(profile.scheduled_suspend_at)) {
          const isPermanent = profile.suspend_type === 'permanent';
          userStatus = isPermanent ? 'banned' : 'suspended';
          
          await supabase.from('profiles').update({
            status: userStatus,
            scheduled_suspend_at: null,
            is_active: false
          }).eq('id', profile.id);
          
          await supabase.from('suspend_logs').insert({
            user_id: profile.id,
            action: isPermanent ? 'banned' : 'suspended',
            reason: profile.suspend_reason || 'Penangguhan terjadwal dimulai',
            message: profile.suspend_message || 'Akun Anda telah ditangguhkan sesuai jadwal',
            duration: isPermanent ? 'Permanen' : 'Terjadwal',
            suspend_until: isPermanent ? null : profile.suspend_until,
            acted_by: null
          });

          if (profile) {
            profile.status = userStatus;
            profile.scheduled_suspend_at = null;
          }
        }

        // Pengecekan Suspen/Ban untuk Pengguna
        if (userStatus === 'suspended') {
          const now = new Date();
          const suspendUntil = profile.suspend_until ? new Date(profile.suspend_until) : null;
          const isExpired = suspendUntil && suspendUntil.getTime() <= now.getTime();

          if (isExpired) {
            // Auto-restore status
            await supabase.from('profiles').update({
              status: 'active',
              suspend_reason: null,
              suspend_message: null,
              suspended_at: null,
              suspend_until: null,
              suspend_type: null,
              just_restored: true,
              is_active: true
            }).eq('id', profile.id);
          } else {
            // Masih tersuspen
            await supabase.auth.signOut();
            setSuspendData(profile);
            setShowSuspendModal(true);
            setLoading(false);
            return;
          }
        } else if (userStatus === 'banned') {
          await supabase.auth.signOut();
          setSuspendData(profile);
          setShowSuspendModal(true);
          setLoading(false);
          return;
        }

        // --- LOGIKA PEMBERITAHUAN UNTUK AKUN YANG SEBELUMNYA DITANGGUHKAN / DIPULIHKAN ---
        if (profile?.just_restored) {
          toast.success("Akun Anda telah resmi diaktifkan kembali oleh manajemen.", { 
            duration: 5000 
          });
          // Reset just_restored flag
          await supabase.from('profiles').update({ just_restored: false }).eq('id', profile.id);
        } else {
          toast.success("Login berhasil diproses.");
        }

        const role = profile?.role || 'customer';
        
        // Let user savor the congratulatory celebration for 1.5s before teleporting!
        setTimeout(() => {
          router.push(`/${role}/dashboard`);
          router.refresh();
        }, 1500);
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan sistem");
      setLoading(false);
    }
  };

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="beforeInteractive" />
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4 safe-auth-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-card-light dark:bg-card-dark rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="bg-primary p-8 text-center relative">
          <Link href="/" className="absolute top-4 left-4 text-white/80 hover:text-white transition-colors" aria-label="Kembali ke Beranda" title="Kembali ke Beranda">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <LogIn className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">Selamat Datang</h1>
          <p className="text-white/80 mt-2 text-sm">Masuk untuk melanjutkan ke RestoBook</p>
        </div>

        {isReactivated ? (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }}
            className="mx-8 mt-6 p-5 bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-500/30 rounded-2xl shadow-lg shadow-emerald-500/10 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400 animate-pulse" />
            <div className="flex items-center gap-3 mb-2">
               <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-md shrink-0">
                 <CheckCircle2 className="w-5 h-5" />
               </div>
               <h3 className="text-emerald-700 dark:text-emerald-400 font-black text-sm uppercase tracking-tight">Akun Telah Diaktifkan!</h3>
            </div>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-bold leading-relaxed italic ml-11">
              Akun Anda telah resmi diaktifkan kembali oleh pihak manajemen RestoBook. Silakan melakukan proses login untuk melanjutkan akses Anda ke dalam sistem.
            </p>
          </motion.div>
        ) : suspendedParam && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className="mx-8 mt-6 p-4 bg-red-50 dark:bg-red-950/20 border border-red-500/20 rounded-2xl flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 dark:text-red-400 font-bold leading-relaxed">
              {suspendedParam === "resign" || suspendedParam === "resign_expired"
                ? "Akun Anda telah dinonaktifkan. Anda tidak lagi terdaftar sebagai karyawan aktif RestoBook. Jika ini merupakan kesalahan, silakan hubungi manajemen kami."
                : "Akun Anda telah dinonaktifkan oleh manajemen RestoBook. Untuk informasi lebih lanjut, silakan menghubungi HRD kami. Terima kasih."
              }
            </p>
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-light dark:text-text-dark">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-muted" />
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-text-light dark:text-text-dark"
                placeholder="Alamat email terdaftar"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-light dark:text-text-dark">Password</label>
              <Link href="/forgot-password" className="text-sm text-primary hover:text-primary-hover transition-colors">
                Lupa Password?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-muted" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-text-light dark:text-text-dark"
                placeholder="********"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-primary transition-colors"
                title={showPassword ? "Sembunyikan Password" : "Lihat Password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading}
            type="submit"
            className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Masuk Sekarang"}
          </motion.button>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-border-light dark:border-border-dark"></div>
            <span className="flex-shrink mx-4 text-xs text-muted font-bold uppercase tracking-wider">Atau</span>
            <div className="flex-grow border-t border-border-light dark:border-border-dark"></div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-3 bg-white dark:bg-gray-800 hover:bg-gray-55 dark:hover:bg-gray-700 text-text-light dark:text-text-dark border border-border-light dark:border-border-dark rounded-lg font-medium transition-colors flex items-center justify-center gap-3 shadow-sm"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Masuk dengan Google
          </motion.button>

          <p className="text-center text-sm text-muted">
            Belum punya akun?{" "}
            <Link href="/register" className="text-primary font-medium hover:text-primary-hover transition-colors">
              Daftar di sini
            </Link>
          </p>
        </form>
      </motion.div>

      {/* Suspend & Ban Modal */}
      <AnimatePresence>
        {showSuspendModal && suspendData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-6 sm:p-8 w-full max-w-lg shadow-2xl border border-border-light dark:border-border-dark flex flex-col relative max-h-[90vh] overflow-hidden"
            >
              <button 
                onClick={() => {
                  setShowSuspendModal(false);
                  setSuspendData(null);
                }}
                className="absolute top-6 right-6 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors z-10"
                title="Tutup"
              >
                <X className="w-5 h-5 text-muted" />
              </button>

              <div className="flex-1 overflow-y-auto pr-1 pt-2 text-center scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 space-y-6 hide-scrollbar">
                
                <div className="text-center space-y-4">
                  <div className={`w-16 h-16 ${suspendData.status === 'banned' ? 'bg-red-100 dark:bg-red-950/20 text-red-600' : 'bg-amber-100 dark:bg-amber-950/20 text-amber-600'} rounded-full flex items-center justify-center mx-auto shadow-md`}>
                    <AlertTriangle className="w-8 h-8 animate-pulse" />
                  </div>
                  <h2 className="text-2xl font-black text-text-light dark:text-text-dark tracking-tight uppercase">
                    {suspendData.status === 'banned' ? 'Akun Diblokir Permanen' : 'Akun Ditangguhkan Sementara'}
                  </h2>
                  <p className="text-muted text-sm font-medium">
                    {suspendData.status === 'banned' 
                      ? 'Akses akun Anda telah dinonaktifkan secara permanen karena pelanggaran kebijakan RestoBook.' 
                      : 'Akses akun Anda dibatasi untuk sementara waktu.'
                    }
                  </p>
                </div>

              {suspendData.status === 'suspended' && countdown && (
                <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-800/30 rounded-2xl p-5 text-center space-y-2 mb-6">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-500 flex items-center justify-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Sisa Waktu Penangguhan
                  </span>
                  <div className="text-lg font-black text-amber-800 dark:text-amber-400 font-mono tracking-wide">
                    {formatCountdown(countdown)}
                  </div>
                </div>
              )}

              <div className="space-y-4 mb-6 text-left">
                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-border-light dark:border-border-dark space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted mb-2">Detail Akun</p>
                  <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                    <span className="text-muted font-medium">Nama Lengkap:</span>
                    <span className="text-text-light dark:text-text-dark font-bold text-right">{suspendData.full_name || 'Pelanggan'}</span>
                    
                    <span className="text-muted font-medium">Email:</span>
                    <span className="text-text-light dark:text-text-dark font-bold text-right truncate" title={suspendData.email}>{suspendData.email || '-'}</span>
                    
                    {suspendData.employee_id && (
                      <>
                        <span className="text-muted font-medium">ID Karyawan:</span>
                        <span className="text-text-light dark:text-text-dark font-bold text-right">{suspendData.employee_id}</span>
                      </>
                    )}
                    
                    <span className="text-muted font-medium">Peran (Role):</span>
                    <span className="text-text-light dark:text-text-dark font-bold text-right uppercase tracking-wider text-[10px]">
                      {suspendData.role === 'customer' ? 'Pelanggan' : suspendData.role === 'kitchen' ? 'Dapur' : suspendData.role === 'cashier' ? 'Kasir' : suspendData.role}
                    </span>

                    <span className="text-muted font-medium">Status Akun:</span>
                    <span className={`font-black text-right uppercase tracking-wider text-[10px] ${suspendData.status === 'banned' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-500'}`}>
                      {suspendData.status === 'banned' ? 'Blokir Permanen' : 'Ditangguhkan'}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-border-light dark:border-border-dark">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted mb-1">Alasan Penangguhan / Pemblokiran</p>
                  <p className="text-sm font-semibold text-text-light dark:text-text-dark">{suspendData.suspend_reason || 'Tidak ada alasan khusus.'}</p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-border-light dark:border-border-dark">
                  <p className="text-[10px] font-black uppercase tracking-wider text-muted mb-1">Pesan Manajemen</p>
                  <p className="text-sm font-medium text-text-light dark:text-text-dark italic">&quot;{suspendData.suspend_message || 'Harap hubungi admin RestoBook.'}&quot;</p>
                </div>
              </div>

              {/* ======== APPEAL SECTION ======== */}
              <div className="border-t border-border-light dark:border-border-dark pt-6 space-y-4">

                {/* Loading appeal data */}
                {loadingAppeal && (
                  <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" /> Memuat status banding...
                  </div>
                )}

                {/* === CASE: BANDING DISETUJUI === */}
                {!loadingAppeal && appealData?.status === 'approved' && (
                  <div className="space-y-4">
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wide">Banding Disetujui!</p>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 leading-relaxed">
                            Selamat! Permohonan banding Anda telah <strong>disetujui</strong> oleh administrator RestoBook. Akun Anda telah diaktifkan kembali secara penuh dan siap untuk digunakan.
                          </p>
                          {appealData?.admin_message && (
                            <div className="mt-2 bg-white/70 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-200/50">
                              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1">Pesan Administrator</p>
                              <p className="text-xs text-emerald-800 dark:text-emerald-300 italic">&quot;{appealData.admin_message}&quot;</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSuspendModal(false);
                          setSuspendData(null);
                          setAppealData(null);
                          // Redirect to login to try again
                          window.location.href = '/login';
                        }}
                        className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 shadow-lg shadow-emerald-500/30 transition-all flex justify-center items-center gap-2 text-sm uppercase tracking-wider"
                      >
                        <LogIn className="w-4 h-4" /> Login Sekarang
                      </button>
                    </div>
                  </div>
                )}

                {/* === CASE: BANDING DITOLAK + SUSPENDED (bisa tunggu sampai habis) === */}
                {!loadingAppeal && appealData?.status === 'rejected' && suspendData?.status === 'suspended' && (
                  <div className="space-y-4">
                    <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-2xl p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-red-800 dark:text-red-300 uppercase tracking-wide">Banding Ditolak</p>
                          <p className="text-xs text-red-700 dark:text-red-400 mt-1 leading-relaxed">
                            Kami menyesal memberitahukan bahwa pengajuan banding Anda telah <strong>ditolak</strong> oleh tim manajemen. Namun, akun Anda masih dalam masa penangguhan <strong>sementara</strong> dan akan otomatis aktif kembali setelah sisa waktu penangguhan habis.
                          </p>
                          {appealData?.admin_message && (
                            <div className="mt-2 bg-white/70 dark:bg-red-900/20 p-3 rounded-xl border border-red-200/50">
                              <p className="text-[10px] font-black uppercase tracking-wider text-red-600 mb-1">Alasan Penolakan</p>
                              <p className="text-xs text-red-800 dark:text-red-300 italic">&quot;{appealData.admin_message}&quot;</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowSuspendModal(false); setSuspendData(null); setAppealData(null); }}
                      className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-text-light dark:text-text-dark rounded-xl font-bold hover:bg-gray-200 transition-colors text-xs uppercase tracking-wider"
                    >
                      Tutup
                    </button>
                  </div>
                )}

                {/* === CASE: BANDING DITOLAK + BANNED PERMANEN === */}
                {!loadingAppeal && appealData?.status === 'rejected' && suspendData?.status === 'banned' && (
                  <div className="space-y-4">
                    <div className="bg-gray-900 dark:bg-gray-950 border border-gray-700 rounded-2xl p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-red-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                          <Ban className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-red-400 uppercase tracking-wide">Banding Ditolak — Keputusan Final</p>
                          <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                            Dengan penuh penyesalan, kami harus memberitahukan bahwa pengajuan banding Anda untuk pemulihan akun yang <strong className="text-red-400">diblokir secara permanen</strong> telah ditolak oleh tim manajemen kami setelah melalui proses peninjauan yang menyeluruh.
                          </p>
                          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                            Keputusan ini bersifat <strong className="text-red-400">final dan tidak dapat diganggu gugat</strong>. Akun Anda tidak dapat diaktifkan kembali karena telah melanggar ketentuan penggunaan layanan RestoBook secara serius.
                          </p>
                          {appealData?.admin_message && (
                            <div className="mt-3 bg-gray-800 p-3 rounded-xl border border-gray-700">
                              <p className="text-[10px] font-black uppercase tracking-wider text-red-400 mb-1">Pesan Resmi Administrator</p>
                              <p className="text-xs text-gray-300 italic">&quot;{appealData.admin_message}&quot;</p>
                            </div>
                          )}
                          <div className="mt-3 bg-gray-800/50 p-3 rounded-xl border border-gray-700/50">
                            <p className="text-xs text-gray-400 leading-relaxed">
                              Kami memohon maaf atas ketidaknyamanan yang ditimbulkan. Jika Anda merasa ada kekeliruan atau ingin mengklarifikasi lebih lanjut, silakan hubungi tim dukungan RestoBook melalui email resmi kami.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowSuspendModal(false); setSuspendData(null); setAppealData(null); }}
                      className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-300 transition-colors text-xs uppercase tracking-wider"
                    >
                      Tutup
                    </button>
                  </div>
                )}

                {/* === CASE: BANDING SEDANG DITINJAU (PENDING) === */}
                {!loadingAppeal && appealData?.status === 'pending' && (
                  <div className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 rounded-2xl p-5">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                          <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-pulse" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-blue-800 dark:text-blue-300 uppercase tracking-wide">Banding Sedang Ditinjau</p>
                          <p className="text-xs text-blue-700 dark:text-blue-400 mt-1 leading-relaxed">
                            Pengajuan banding Anda <strong>sedang dalam proses peninjauan</strong> oleh tim manajemen RestoBook. Kami akan memberikan keputusan dalam waktu maksimal <strong>1×24 jam</strong>. Harap bersabar dan periksa email Anda secara berkala.
                          </p>
                          <div className="mt-2 flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'0ms'}}></div>
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'150ms'}}></div>
                            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:'300ms'}}></div>
                            <span className="text-[10px] text-blue-500 ml-1">Menunggu keputusan administrator...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          const toastId = toast.loading("Memperbarui status banding...");
                          await fetchLatestAppeal(suspendData.id, true);
                          toast.success("Status banding berhasil diperbarui", { id: toastId });
                        }}
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all text-xs uppercase tracking-wider flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20"
                      >
                        <RefreshCw className="w-4 h-4 animate-spin-slow" /> Perbarui Status
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowSuspendModal(false); setSuspendData(null); setAppealData(null); }}
                        className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-text-light dark:text-text-dark rounded-xl font-bold hover:bg-gray-200 transition-colors text-xs uppercase tracking-wider"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>
                )}

                {/* === CASE: BELUM ADA BANDING — Tampilkan Form === */}
                {!loadingAppeal && !appealData && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-wider text-text-light dark:text-text-dark text-left flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary" /> Ajukan Banding (Appeal Form)
                    </h4>
                    <p className="text-[11px] text-muted leading-relaxed">
                      Jika Anda merasa penangguhan ini tidak adil atau ada kekeliruan, Anda dapat mengajukan banding. Tuliskan argumen atau penjelasan Anda dengan jelas dan jujur.
                    </p>
                    <textarea
                      placeholder="Tuliskan argumen atau penjelasan Anda di sini untuk mengajukan banding pemulihan akun..."
                      value={appealText}
                      onChange={(e) => setAppealText(e.target.value)}
                      rows={3}
                      className="w-full p-4 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-primary rounded-2xl text-xs outline-none transition-all font-medium text-text-light dark:text-text-dark resize-none"
                    />
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => { setShowSuspendModal(false); setSuspendData(null); setAppealData(null); }}
                        className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-text-light dark:text-text-dark rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-xs uppercase tracking-wider"
                      >
                        Kembali
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!appealText.trim()) return toast.error("Tuliskan alasan banding Anda terlebih dahulu");
                          setSubmittingAppeal(true);
                          const toastId = toast.loading("Mengirim banding...");
                          try {
                            const res = await fetch('/api/admin/customers/appeal', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ user_id: suspendData.id, reason: appealText })
                            });
                            const resData = await res.json();
                            if (!res.ok) throw new Error(resData.error || "Gagal mengirim banding");
                            toast.success("Pengajuan banding Anda telah dikirim. Tim administrator kami akan meninjau secepatnya.", { id: toastId, duration: 6000 });
                            setAppealText("");
                             // Refresh appeal data to show pending status
                             await fetchLatestAppeal(suspendData.id);
                          } catch (err: any) {
                            toast.error(err.message, { id: toastId });
                          } finally {
                            setSubmittingAppeal(false);
                          }
                        }}
                        disabled={submittingAppeal}
                        className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all flex justify-center items-center gap-2 text-xs uppercase tracking-wider disabled:opacity-50"
                      >
                        {submittingAppeal ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kirim Banding"}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
