"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { ShieldAlert, ShieldX, Loader2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";

export default function CashierLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [lockdown, setLockdown] = useState<{ active: boolean; type: 'blocked' | 'leave' | 'replaced'; data?: any } | null>(null);
  const [shiftState, setShiftState] = useState<'open' | 'closed' | 'standby'>('standby');
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
          return;
        }

        // 2.5 Cek status penggantian shift (lock status)
        if (profile?.role !== 'admin') {
          try {
            const lockRes = await fetch(`/api/cashier/lock-status?userId=${user.id}`);
            const lockData = await lockRes.json();
            if (lockData.isReplaced) {
              if (pathname !== "/cashier/dashboard") {
                setLockdown({ active: true, type: 'replaced', data: { substituteName: lockData.substituteName } });
                return;
              } else {
                setLockdown(null); // Buka akses dashboard
              }
            } else {
              setLockdown(null);
            }
          } catch (lockErr) {
            console.error("Gagal mengambil lock status:", lockErr);
          }
        } else {
          setLockdown(null);
        }

        // 3. Cek Shift Aktif (Admin langsung diloloskan, Kasir didasarkan pada shifts table)
        if (profile?.role === 'admin') {
          setShiftState('open');
        } else {
          const { data: openShift } = await supabase
            .from('shifts')
            .select('*')
            .eq('user_id', user.id)
            .eq('status', 'open')
            .maybeSingle();

          if (openShift) {
            setShiftState('open');
          } else {
            // Cek apakah ada shift closed hari ini
            const todayStr = new Date().toISOString().split('T')[0];
            const { data: closedShift } = await supabase
              .from('shifts')
              .select('*')
              .eq('user_id', user.id)
              .eq('status', 'closed')
              .gte('created_at', todayStr)
              .limit(1)
              .maybeSingle();

            if (closedShift) {
              setShiftState('closed');
            } else {
              setShiftState('standby');
            }
          }
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'work_shift_assignments' }, (payload: any) => {
          // Memicu re-evaluasi ketika status penugasan pengganti diubah (setuju/tolak/selesai)
          checkAccess();
        })
        .subscribe();
      
      return channel;
    };

    const channelPromise = setupRealtime();
    return () => { channelPromise.then(ch => ch && supabase.removeChannel(ch)); };
  }, [pathname]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  if (lockdown?.active) {
    const isReplaced = lockdown.type === 'replaced';
    return (
      <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-6 ${isReplaced ? 'bg-indigo-50 dark:bg-gray-950' : 'bg-amber-50 dark:bg-gray-950'}`}>
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }} 
          animate={{ scale: 1, opacity: 1 }}
          className={`max-w-md w-full bg-white dark:bg-gray-900 rounded-[3rem] p-10 shadow-2xl text-center border-4 ${isReplaced ? 'border-indigo-200 dark:border-indigo-900/30' : 'border-amber-200 dark:border-amber-900/30'}`}
        >
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 ${lockdown.type === 'blocked' ? 'bg-red-100 text-red-600' : isReplaced ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
            {lockdown.type === 'blocked' ? <ShieldX className="w-12 h-12" /> : <ShieldAlert className="w-12 h-12" />}
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tighter">
            {lockdown.type === 'blocked' ? 'Akun Ditangguhkan' : isReplaced ? 'Shift Digantikan' : 'Akses Dibatasi'}
          </h1>
          <div className="text-gray-500 dark:text-gray-400 mb-8 font-medium leading-relaxed text-sm">
            {lockdown.type === 'blocked' && (
              <p>Akun Anda telah diblokir sementara oleh Admin karena alasan kedisiplinan.</p>
            )}
            {lockdown.type === 'leave' && (
              <p>Pengajuan {lockdown.data.type} Anda telah disetujui Admin. Dashboard dikunci selama masa izin berlangsung.</p>
            )}
            {isReplaced && (
              <div className="space-y-3">
                <p className="font-bold text-gray-800 dark:text-gray-200 text-base">
                  Saat ini Anda sedang digantikan oleh <span className="text-indigo-600 dark:text-indigo-400">{lockdown.data?.substituteName}</span>.
                </p>
                <p>Seluruh fitur operasional sementara dikunci selama masa penggantian shift.</p>
                <p>Anda tetap dapat mengakses dashboard untuk melihat informasi status.</p>
                <p>Status penggantian shift Anda sedang aktif dan terhubung realtime dengan admin.</p>
                <p className="text-xs text-muted mt-2">Silakan hubungi admin jika ada kendala terkait penugasan ini.</p>
              </div>
            )}
          </div>
          {isReplaced ? (
            <button 
              onClick={() => {
                router.push('/cashier/dashboard');
              }}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-indigo-600/20"
            >
              Buka Dashboard
            </button>
          ) : (
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
          )}
        </motion.div>
      </div>
    );
  }



  return <DashboardLayout role="cashier">{children}</DashboardLayout>;
}
