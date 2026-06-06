"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { ShieldAlert, ShieldX, Loader2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [lockdown, setLockdown] = useState<{ active: boolean; type: 'blocked' | 'leave'; data?: any } | null>(null);
  const [hasOpenShift, setHasOpenShift] = useState(true);
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return setLoading(false);

        // 1. Cek Profil (Blokir)
        const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
        if (profile?.is_blocked) {
          setLockdown({ active: true, type: 'blocked' });
          return;
        }

        // 2. Cek Absensi (Izin/Sakit)
        const { data: attendance } = await supabase
          .from('attendance')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (attendance?.status === 'approved' && ['izin', 'sakit'].includes(attendance?.type)) {
          setLockdown({ active: true, type: 'leave', data: attendance });
        } else {
          setLockdown(null);
        }

        // 3. Cek Shift Aktif (Admin langsung diloloskan, Kasir didasarkan pada shift aktif atau absensi hari ini)
        if (profile?.role === 'admin') {
          setHasOpenShift(true);
        } else {
          const { data: shift } = await supabase
            .from('shifts')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'open')
            .maybeSingle();

          const todayStr = new Date().toISOString().split('T')[0];
          const { data: todayCheckIn } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', user.id)
            .eq('type', 'check_in')
            .gte('created_at', todayStr)
            .limit(1)
            .maybeSingle();
          
          setHasOpenShift(!!shift || !!todayCheckIn);
        }

      } catch (e) {
        console.error("Access check error:", e);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();

    // Realtime listener untuk perubahan akses mendadak
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase.channel(`cashier_access_sync_${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload: any) => {
          // Jika profil user ini berubah (misal is_blocked)
          if (payload.new?.user_id === user.id || payload.old?.user_id === user.id) {
            checkAccess();
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload: any) => {
          // Jika absensi user ini berubah (misal status jadi completed)
          if (payload.new?.user_id === user.id || payload.old?.user_id === user.id) {
            checkAccess();
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, (payload: any) => {
          if (payload.new?.user_id === user.id || payload.old?.user_id === user.id) {
            checkAccess();
          }
        })
        .subscribe();
      
      return channel;
    };

    const channelPromise = setupRealtime();
    return () => { channelPromise.then(ch => ch && supabase.removeChannel(ch)); };
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  if (lockdown?.active) {
    return (
      <div className="fixed inset-0 z-[9999] bg-amber-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-white dark:bg-gray-900 rounded-[3rem] p-10 shadow-2xl text-center border-4 border-amber-200 dark:border-amber-900/30"
        >
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 ${lockdown.type === 'blocked' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
            {lockdown.type === 'blocked' ? <ShieldX className="w-12 h-12" /> : <ShieldAlert className="w-12 h-12" />}
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tighter">
            {lockdown.type === 'blocked' ? 'Akun Ditangguhkan' : 'Akses Dibatasi'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium leading-relaxed">
            {lockdown.type === 'blocked' 
              ? 'Akun Anda telah diblokir sementara oleh Admin karena alasan kedisiplinan.' 
              : `Pengajuan ${lockdown.data.type} Anda telah disetujui Admin. Dashboard dikunci selama masa izin berlangsung.`}
          </p>
          <button 
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST' });
              } catch (e) {
                console.error('API logout failed', e);
              }
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl ${lockdown.type === 'blocked' ? 'bg-red-600 text-white' : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'}`}
          >
            Keluar dari Akun
          </button>
        </motion.div>
      </div>
    );
  }

  // Jika tidak ada shift aktif dan sedang mengakses halaman selain dashboard
  const allowedPaths = ['/cashier/dashboard', '/cashier/profile', '/cashier/attendance'];
  if (!hasOpenShift && !allowedPaths.includes(pathname)) {
    return (
      <DashboardLayout role="cashier">
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center p-6">
          <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
            <ShieldAlert className="w-12 h-12" />
          </div>
          <h2 className="text-3xl font-black text-text-light dark:text-text-dark mb-4">Akses Ditolak!</h2>
          <p className="text-muted max-w-md mb-8">Anda harus melakukan absensi dan membuka shift terlebih dahulu sebelum dapat mengakses menu ini.</p>
          <button 
            onClick={() => router.push('/cashier/dashboard')}
            className="px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/30"
          >
            Kembali ke Dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return <DashboardLayout role="cashier">{children}</DashboardLayout>;
}
