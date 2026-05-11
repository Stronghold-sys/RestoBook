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
