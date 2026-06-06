"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Clock, Loader2, CalendarDays } from "lucide-react";

export default function CashierAttendancePage() {
  const [loading, setLoading] = useState(true);
  const [attendanceStats, setAttendanceStats] = useState<any[]>([]);
  const [shiftHistory, setShiftHistory] = useState<any[]>([]);
  const supabase = createClient();

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id);
      
      if (attendance) setAttendanceStats(attendance);

      const { data: shifts } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false });
        
      if (shifts) setShiftHistory(shifts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase.channel(`cashier_attendance_sync_${user.id}`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'attendance', filter: `user_id=eq.${user.id}` }, 
          () => fetchData()
        )
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'shifts', filter: `user_id=eq.${user.id}` }, 
          () => fetchData()
        )
        .subscribe();
      return channel;
    };

    const channelPromise = setupRealtime();
    return () => { channelPromise.then(ch => ch && supabase.removeChannel(ch)); };
  }, []);

  if (loading) return <div className="flex justify-center items-center h-[80vh]"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-primary/20 text-primary rounded-2xl flex items-center justify-center">
          <Clock className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-text-light dark:text-text-dark tracking-tight">Absensi & Shift</h1>
          <p className="text-muted text-sm mt-1 font-medium">Ringkasan kehadiran harian dan riwayat shift kerja Anda.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <div className="p-8 bg-green-50 dark:bg-green-900/10 rounded-3xl border border-green-100 dark:border-green-900/30 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-green-600 mb-2">Masuk</p>
          <p className="text-5xl font-black text-green-700 dark:text-green-400">{attendanceStats.filter(s => s.type === 'check_in').length}</p>
        </div>
        <div className="p-8 bg-amber-50 dark:bg-amber-900/10 rounded-3xl border border-amber-100 dark:border-amber-900/30 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-amber-600 mb-2">Izin/Sakit</p>
          <p className="text-5xl font-black text-amber-700 dark:text-amber-400">{attendanceStats.filter(s => ['izin', 'sakit'].includes(s.type)).length}</p>
        </div>
        <div className="p-8 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-red-600 mb-2">Alpha</p>
          <p className="text-5xl font-black text-red-700 dark:text-red-400">{attendanceStats.filter(s => s.type === 'alpha').length}</p>
        </div>
        <div className="p-8 bg-rose-50 dark:bg-rose-900/10 rounded-3xl border border-rose-100 dark:border-rose-900/30 text-center shadow-sm">
          <p className="text-xs font-black uppercase tracking-widest text-rose-600 mb-2">Terlambat</p>
          <p className="text-5xl font-black text-rose-700 dark:text-rose-400">
            {attendanceStats.filter(s => s.type === 'check_in' && s.late_minutes > 0).length}
          </p>
          <p className="text-[10px] font-bold text-rose-600 mt-2 bg-rose-100 dark:bg-rose-900/50 inline-block px-2 py-1 rounded-lg">
            Total {attendanceStats.reduce((sum, s) => sum + (s.late_minutes || 0), 0)} Menit
          </p>
        </div>
      </div>

      <div className="bg-card-light dark:bg-card-dark rounded-3xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/20">
          <h2 className="text-lg font-bold text-text-light dark:text-text-dark flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" /> Riwayat Shift Anda
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" style={{ minWidth: '800px' }}>
            <thead>
              <tr className="border-b border-border-light dark:border-border-dark text-muted text-sm bg-gray-50/30 dark:bg-gray-800/10">
                <th className="py-4 px-6 font-semibold min-w-[120px] whitespace-nowrap">Tanggal</th>
                <th className="py-4 px-6 font-semibold min-w-[150px] whitespace-nowrap">Mulai - Selesai</th>
                <th className="py-4 px-6 font-semibold whitespace-nowrap">Durasi</th>
                <th className="py-4 px-6 font-semibold whitespace-nowrap">Modal Awal</th>
                <th className="py-4 px-6 font-semibold whitespace-nowrap">Uang Fisik</th>
                <th className="py-4 px-6 font-semibold whitespace-nowrap">Selisih</th>
                <th className="py-4 px-6 font-semibold whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {shiftHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted">Belum ada riwayat shift.</td>
                </tr>
              ) : (
                shiftHistory.map(shift => {
                  let diffLabel = "Sesuai";
                  let diffColor = "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400";
                  if (shift.difference < 0) { diffLabel = "Minus"; diffColor = "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400"; }
                  if (shift.difference > 0) { diffLabel = "Lebih"; diffColor = "text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400"; }
                  
                  return (
                    <tr key={shift.id} className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-4 px-6 font-medium text-text-light dark:text-text-dark whitespace-nowrap">{format(new Date(shift.start_time), 'dd MMM yyyy')}</td>
                      <td className="py-4 px-6 text-sm text-text-light dark:text-text-dark font-bold whitespace-nowrap">
                        {format(new Date(shift.start_time), 'HH:mm')} - {shift.end_time ? format(new Date(shift.end_time), 'HH:mm') : 'Sekarang'}
                      </td>
                      <td className="py-4 px-6 text-sm font-medium text-muted whitespace-nowrap">
                         {shift.end_time 
                           ? `${Math.floor((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) / 3600000)}j ${Math.floor(((new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) % 3600000) / 60000)}m`
                           : '-'}
                      </td>
                      <td className="py-4 px-6 text-sm font-medium text-muted whitespace-nowrap">Rp {(shift.initial_cash || 0).toLocaleString('id-ID')}</td>
                      <td className="py-4 px-6 text-sm font-medium text-muted whitespace-nowrap">{shift.final_cash_actual != null ? `Rp ${shift.final_cash_actual.toLocaleString('id-ID')}` : '-'}</td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        {shift.difference != null ? (
                          <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase whitespace-nowrap ${diffColor}`}>
                            {diffLabel} {Math.abs(shift.difference).toLocaleString('id-ID')}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full whitespace-nowrap ${
                          shift.status === 'open' ? 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:border-amber-900/50 dark:text-amber-400' : 'bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:border-green-900/50 dark:text-green-400'
                        }`}>
                          {shift.status === 'open' ? 'Berjalan' : 'Selesai'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
