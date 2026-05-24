"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { LogIn, User, Lock, Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suspendedParam, setSuspendedParam] = useState<string | null>(null);
  const [profileIdParam, setProfileIdParam] = useState<string | null>(null);
  const [isReactivated, setIsReactivated] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "19550365120-jprrkrregfjsi65o8ct1gnakvebln2g2.apps.googleusercontent.com";
    if (!clientId) {
      toast.error("Google Client ID belum dikonfigurasi");
      return;
    }

    try {
      const google = (window as any).google;
      if (!google?.accounts?.id) {
        toast.error("Google Sign-In belum siap, silakan refresh halaman");
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
              const callbackRes = await fetch(`/api/auth/callback?idtoken=true&userId=${data.user.id}`, {
                method: 'GET',
              });
              
              // Get user role from profile
              const { data: profile } = await supabase.from('profiles').select('role').eq('user_id', data.user.id).maybeSingle();
              const role = profile?.role || 'customer';
              
              toast.success("Berhasil masuk dengan Google!");
              window.location.href = `/${role}/dashboard`;
            }
          } catch (err: any) {
            toast.error(err.message || "Gagal masuk dengan Google");
          }
        },
      });

      // Show Google One Tap / popup
      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback: render a hidden Google Sign-In button and click it
          const btnDiv = document.createElement('div');
          btnDiv.id = 'g_id_signin_fallback';
          btnDiv.style.position = 'fixed';
          btnDiv.style.top = '-9999px';
          document.body.appendChild(btnDiv);
          
          google.accounts.id.renderButton(btnDiv, {
            type: 'standard',
            size: 'large',
          });
          
          const btn = btnDiv.querySelector('div[role="button"]') as HTMLElement;
          if (btn) btn.click();
          
          setTimeout(() => btnDiv.remove(), 1000);
        }
      });
    } catch (err: any) {
      toast.error(err.message || "Gagal masuk dengan Google");
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setSuspendedParam(params.get("suspended"));
      setProfileIdParam(params.get("pid"));
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
          if (payload.new.status_karyawan === 'aktif') {
             setIsReactivated(true);
             toast.success("Akun Anda berhasil diaktifkan kembali.", { duration: 5000 });
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
    
    if (!identifier) return toast.error("Email atau ID Karyawan tidak boleh kosong");
    if (!password) return toast.error("Password tidak boleh kosong");

    setLoading(true);
    try {
      let emailToLogin = identifier;

      // Check if it's an Employee ID (RB- format)
      if (identifier.startsWith('RB-')) {
        const { data: profile, error: findError } = await supabase
          .from('profiles')
          .select('email')
          .eq('employee_id', identifier)
          .single();
        
        if (findError || !profile?.email) {
          toast.error("ID Karyawan tidak ditemukan");
          setLoading(false);
          return;
        }
        emailToLogin = profile.email;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToLogin,
        password,
      });

      if (error) {
        toast.error(error.message === "Invalid login credentials" ? "Email/ID atau password salah" : error.message);
        setLoading(false);
        return;
      }

      // Ambil role dari profile
      if (data.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, role, status_karyawan')
          .eq('user_id', data.user.id)
          .single();

        if (profileError) throw profileError;

        const status = profile?.status_karyawan || 'aktif';

        if (status === 'resign') {
          await supabase.auth.signOut();
          // FORCE DYNAMIC REALTIME STATES: Mounts red box & activates live listener!
          setSuspendedParam('resign');
          if (profile?.id) setProfileIdParam(profile.id);
          toast.error("LOGIN DITANGGUHKAN: Status akun Anda tidak aktif di RestoBook.", { duration: 6000 });
          setLoading(false);
          return;
        }

        if (status === 'dipecat') {
          await supabase.auth.signOut();
          setSuspendedParam('dipecat');
          if (profile?.id) setProfileIdParam(profile.id);
          toast.error("LOGIN DITOLAK: Akun dinonaktifkan oleh manajemen.", { duration: 6000 });
          setLoading(false);
          return;
        }

        // --- LOGIKA PEMBERITAHUAN UNTUK AKUN YANG SEBELUMNYA DITANGGUHKAN ---
        if (suspendedParam || profileIdParam || isReactivated) {
          toast.success("Akun Anda telah resmi diaktifkan kembali oleh manajemen.", { 
            duration: 5000 
          });
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
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-card-light dark:bg-card-dark rounded-2xl shadow-xl overflow-hidden"
      >
        <div className="bg-primary p-8 text-center">
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
            <label className="text-sm font-medium text-text-light dark:text-text-dark">Email atau ID Karyawan</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-muted" />
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-text-light dark:text-text-dark"
                placeholder="Email atau ID Karyawan"
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
    </div>
  );
}
