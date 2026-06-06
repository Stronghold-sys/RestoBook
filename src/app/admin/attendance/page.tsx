"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BaseModal from "@/components/BaseModal";
import { 
  Clock, Camera, DollarSign, AlertTriangle, CheckCircle2, 
  Search, Calendar, Filter, User, Smartphone, MoreVertical,
  ShieldAlert, ShieldX, ShieldCheck, TrendingDown, TrendingUp,
  FileText, Check, X, Eye, ArrowLeft, Info, Users, Loader2, Trash2, Shuffle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { id } from "date-fns/locale";
import toast from "react-hot-toast";

export default function AdminAttendancePage() {
  const [activeTab, setActiveTab] = useState<"employees" | "shifts" | "requests" | "work_shifts">("employees");
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // ACTIVATE MASTER UNLOCK THEN LOAD DATA IN ORDER (BYPASS CACHE)
    fetch(`/api/fix-rls?t=${Date.now()}`)
      .catch(e => console.error(e))
      .finally(() => {
        fetchData();
      });

    // Setup Realtime Listener untuk Admin (Mendukung sinkronisasi senyap secara instan)
    const channel = supabase
      .channel('admin_attendance_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => fetchData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      if (activeTab === "employees") {
        // Gunakan API server-side yang bypass RLS dengan supabaseAdmin
        // Query langsung via client terkena RLS sehingga data kosong
        const res = await fetch(`/api/admin/employees?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
        });
        const result = await res.json();

        if (!res.ok) throw new Error(result.error || 'Gagal memuat data karyawan');
        setEmployees(result.employees || []);

      } else if (activeTab === "shifts") {
        const res = await fetch(`/api/admin/cashier-shifts?t=${Date.now()}`);
        const result = await res.json();
        if (result.success) {
          setShifts(result.shifts || []);
        } else {
          throw new Error(result.error || 'Gagal memuat data shift kasir');
        }
      } else if (activeTab === "requests") {
        const { data } = await supabase
          .from('attendance')
          .select('*, profiles(full_name, employee_id, avatar_url)')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        setRequests(data || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLeave = async (id: string, status: 'approved' | 'rejected' | 'completed', onSuccess?: () => void) => {
    try {
      const res = await fetch('/api/attendance/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal memperbarui status");

      toast.success(status === 'approved' ? "Izin disetujui" : status === 'completed' ? "Masa izin diakhiri" : "Izin ditolak");
      
      // Update parent data
      fetchData();
      
      // Update local data if callback provided
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (selectedEmployee) {
    return <EmployeeDetail 
      employeeId={selectedEmployee.id} 
      onClose={() => setSelectedEmployee(null)} 
      handleApproveLeave={handleApproveLeave}
      onUpdate={fetchData}
    />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <button onClick={() => window.history.back()} className="flex items-center gap-2 text-sm font-bold text-muted hover:text-primary transition-all">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Sebelumnya
      </button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-text-light dark:text-text-dark tracking-tight">SDM & Operasional</h1>
          <p className="text-muted mt-1">Manajemen absensi, izin, dan performa karyawan</p>
        </div>
        
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl w-full md:w-auto gap-1 overflow-x-auto whitespace-nowrap scrollbar-none pb-1.5 sm:pb-1.5">
          <button onClick={() => setActiveTab("employees")} className={`px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${activeTab === "employees" ? "bg-white dark:bg-gray-700 shadow-md text-primary" : "text-muted"}`}>
            <Users className="w-4 h-4" /> Karyawan
          </button>
          <button onClick={() => setActiveTab("work_shifts")} className={`px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${activeTab === "work_shifts" ? "bg-white dark:bg-gray-700 shadow-md text-emerald-600" : "text-muted"}`}>
            <Calendar className="w-4 h-4" /> Pengaturan Shift
          </button>
          <button onClick={() => setActiveTab("requests")} className={`px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${activeTab === "requests" ? "bg-white dark:bg-gray-700 shadow-md text-amber-500" : "text-muted"}`}>
            <FileText className="w-4 h-4" /> Izin {requests.length > 0 && <span className="bg-red-500 text-white w-4 h-4 rounded-full text-[8px] flex items-center justify-center animate-pulse">{requests.length}</span>}
          </button>
          <button onClick={() => setActiveTab("shifts")} className={`px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 whitespace-nowrap ${activeTab === "shifts" ? "bg-white dark:bg-gray-700 shadow-md text-blue-500" : "text-muted"}`}>
            <DollarSign className="w-4 h-4" /> Kasir
          </button>
        </div>
      </div>
      {activeTab === "employees" && (() => {
        const hasScheduleToday = (emp: any) => {
          const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
          const today = new Date();
          const nowJakarta = new Date(today.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
          const todayStr = nowJakarta.getFullYear() + '-' + 
            String(nowJakarta.getMonth() + 1).padStart(2, '0') + '-' + 
            String(nowJakarta.getDate()).padStart(2, '0');
          const todayIndoName = dayNames[nowJakarta.getDay()];

          const assigns = emp.work_shift_assignments || [];
          const subAssignment = assigns.find(
            (a: any) => a.substitute_date === todayStr && a.is_substitute === true
          );
          const regAssignment = assigns.find(
            (a: any) => a.substitute_date === null && a.work_shifts?.days?.includes(todayIndoName)
          );
          const isReplaced = assigns.some(
            (a: any) => a.substitute_for_profile_id === emp.id && a.substitute_date === todayStr
          );

          return !!(subAssignment || (regAssignment && !isReplaced));
        };

        if (loading) {
          return (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted text-sm font-bold">Memuat data karyawan...</p>
            </div>
          );
        }

        if (employees.length === 0) {
          return (
            <div className="bg-card-light dark:bg-card-dark p-20 rounded-3xl border border-dashed border-border-light dark:border-border-dark text-center">
              <Users className="w-12 h-12 text-muted mx-auto mb-4 opacity-20" />
              <p className="text-muted font-bold">Belum ada data karyawan.</p>
              <p className="text-muted text-xs mt-1">Tambahkan karyawan di halaman Manajemen Karyawan terlebih dahulu.</p>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {employees.map((emp) => {
              const latest = emp.attendance?.[0];
              return (
                <motion.div layout key={emp.id} className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-6 shadow-xl hover:shadow-2xl transition-all group">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-100 relative shadow-inner">
                      {emp.avatar_url ? (
                        <img 
                          src={emp.avatar_url} 
                          alt={`Foto profil ${emp.full_name}`} 
                          title={`Foto profil ${emp.full_name}`}
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <User className="w-8 h-8 text-muted m-auto absolute inset-0" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-black text-lg leading-tight">{emp.full_name}</h3>
                      <p className="text-[10px] font-black text-muted uppercase tracking-widest">{emp.employee_id} - {emp.role}</p>
                    </div>
                    <button 
                      onClick={() => setSelectedEmployee(emp)} 
                      className="ml-auto p-3 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-all"
                      title="Lihat Detail Karyawan"
                      aria-label="Lihat Detail Karyawan"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                      <span className="text-[10px] font-black uppercase text-muted">Status Hari Ini</span>
                      {latest ? (
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
                          latest.type === 'check_in' ? 'bg-green-100 text-green-600' :
                          latest.type === 'check_out' ? 'bg-blue-100 text-blue-600' :
                          latest.type === 'alpha' ? 'bg-red-100 text-red-600' :
                          latest.type === 'izin' ? 'bg-amber-100 text-amber-700' :
                          latest.type === 'sakit' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-650'
                        }`}>
                          {latest.type === 'check_in' ? 'Sudah Masuk' :
                           latest.type === 'check_out' ? 'Sudah Pulang' :
                           latest.type === 'alpha' ? 'Alpha' :
                           latest.type === 'izin' ? 'Izin' :
                           latest.type === 'sakit' ? 'Sakit' :
                           latest.type}
                        </span>
                      ) : (
                        hasScheduleToday(emp) ? (
                          <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-red-100 text-red-600 tracking-wider">Tanpa Keterangan</span>
                        ) : (
                          <span className="px-2 py-1 rounded-lg text-[9px] font-black uppercase bg-gray-100 text-gray-500 tracking-wider">Libur</span>
                        )
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        );
      })()}


      {activeTab === "requests" && (
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="bg-card-light dark:bg-card-dark p-20 rounded-3xl border border-dashed border-border-light dark:border-border-dark text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4 opacity-20" />
              <p className="text-muted font-bold">Tidak ada permintaan izin pending</p>
            </div>
          ) : (
            requests.map(req => (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} key={req.id} className="bg-card-light dark:bg-card-dark p-6 rounded-3xl border border-border-light dark:border-border-dark flex flex-col md:flex-row items-center gap-6 shadow-xl">
                <div className="flex items-center gap-4 flex-1">
                   <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><FileText className="w-6 h-6" /></div>
                   <div>
                     <h4 className="font-black text-text-light dark:text-text-dark">{req.profiles?.full_name}</h4>
                     <p className="text-xs font-bold text-muted uppercase">{req.profiles?.employee_id} - Mengajukan {req.type}</p>
                   </div>
                </div>
                
                <div className="flex-1 text-center md:text-left">
                  <p className="text-[10px] font-black text-muted uppercase mb-1">Alasan / Catatan</p>
                  <p className="text-sm font-medium italic">&quot;{req.notes || 'Tidak ada catatan'}&quot;</p>
                </div>

                <div className="flex items-center gap-3">
                  {req.attachment_url && (
                    <button 
                      onClick={() => setActivePhotoUrl(req.attachment_url)} 
                      className="p-3 bg-gray-100 dark:bg-gray-800 rounded-xl text-muted hover:text-primary transition-all" 
                      title="Lihat Bukti"
                    >
                      <Camera className="w-5 h-5" />
                    </button>
                  )}
                  <button 
                    onClick={() => handleApproveLeave(req.id, 'approved')} 
                    className="p-3 bg-green-500 text-white rounded-xl shadow-lg shadow-green-500/20 hover:scale-105 transition-all"
                    title="Setujui Izin"
                    aria-label="Setujui Izin"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleApproveLeave(req.id, 'rejected')} 
                    className="p-3 bg-red-500 text-white rounded-xl shadow-lg shadow-red-500/20 hover:scale-105 transition-all"
                    title="Tolak Izin"
                    aria-label="Tolak Izin"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Tab Shifts tetap sama namun dalam tampilan tabel yang lebih rapi */}
      {activeTab === "shifts" && <ShiftsTable shifts={shifts} onReopenSuccess={() => fetchData(true)} />}

      {/* MODUL BARU: MANAJER SHIFT KERJA */}
      {activeTab === "work_shifts" && <WorkShiftsManager />}

      {/* Modal Pratinjau Foto */}
      <BaseModal isOpen={!!activePhotoUrl} onClose={() => setActivePhotoUrl(null)} size="lg" title="Pratinjau Bukti Foto">
        {activePhotoUrl && (
          <div className="w-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-border-light dark:border-border-dark flex items-center justify-center">
            <img 
              src={activePhotoUrl} 
              alt="Bukti Foto Absensi" 
              className="w-full h-auto max-h-[70vh] object-contain"
            />
          </div>
        )}
      </BaseModal>
    </div>
  );
}

function EmployeeDetail({ employeeId, onClose, handleApproveLeave, onUpdate, onViewPhoto }: { 
  employeeId: string, 
  onClose: () => void,
  handleApproveLeave: (id: string, status: 'approved' | 'rejected' | 'completed', onSuccess?: () => void) => Promise<void>,
  onUpdate: () => void,
  onViewPhoto?: (url: string) => void
}) {
  const [employee, setEmployee] = useState<any>(null);
  const [stats, setStats] = useState<any[]>([]);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchEmployeeData = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', employeeId)
      .single();
    setEmployee(data);
  };

  const fetchStats = async () => {
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('profile_id', employeeId)
      .order('created_at', { ascending: false });
    setStats(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchEmployeeData();
    fetchStats();

    // Realtime listener yang lebih luas untuk memastikan sinkronisasi
    const channel = supabase
      .channel(`admin_employee_sync_${employeeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload: any) => {
        if (payload.new?.profile_id === employeeId || payload.old?.profile_id === employeeId) {
          fetchStats();
          onUpdate();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${employeeId}` }, () => {
        fetchEmployeeData();
        onUpdate();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employeeId]);

  const updateAttendanceType = async (id: string, newType: string) => {
    try {
      const res = await fetch('/api/attendance/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'approved', type: newType })
      });
      
      if (!res.ok) throw new Error("Gagal memperbarui jenis absensi");
      toast.success("Absensi diperbarui");
      
      await fetchStats();
      onUpdate();
    } catch (e: any) { 
      toast.error(e.message); 
    }
  }

  const handleBlockUser = async (userId: string, isBlocked: boolean) => {
    console.log("Attempting to block/unblock user:", userId, "to status:", isBlocked);
    try {
      const res = await fetch('/api/profiles/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, profileId: employeeId, isBlocked })
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal memproses permintaan");
      
      toast.success(isBlocked ? "Akun telah diblokir" : "Akun telah diaktifkan kembali");
      
      // Update local & global
      await fetchEmployeeData();
      onUpdate();
    } catch (e: any) {
      console.error("Block User Error:", e);
      toast.error(e.message);
    }
  }

  if (loading || !employee) return <div className="flex justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <button onClick={onClose} className="flex items-center gap-2 text-muted hover:text-primary transition-all font-black text-xs uppercase tracking-widest">
        <ArrowLeft className="w-4 h-4" /> Kembali
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card-light dark:bg-card-dark rounded-3xl p-8 border border-border-light dark:border-border-dark text-center shadow-2xl">
             <div className="w-32 h-32 rounded-[2rem] overflow-hidden mx-auto mb-6 shadow-2xl ring-4 ring-white dark:ring-gray-800">
               {employee.avatar_url ? (
                 <img 
                   src={employee.avatar_url} 
                   alt={`Foto profil ${employee.full_name}`} 
                   title={`Foto profil ${employee.full_name}`}
                   className="w-full h-full object-cover" 
                 />
               ) : (
                 <div className="w-full h-full flex bg-gray-100 text-muted"><Users className="w-12 h-12 m-auto" /></div>
               )}
             </div>
             <h2 className="text-2xl font-black">{employee.full_name}</h2>
             <p className="text-xs font-black text-muted uppercase tracking-widest mt-1">{employee.employee_id} - {employee.role}</p>
             
             <div className="grid grid-cols-4 gap-2 mt-8">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl">
                  <p className="text-[8px] font-black uppercase text-green-600 mb-1">Masuk</p>
                  <p className="text-base font-black text-green-700 dark:text-green-400">{stats.filter(s => s.type === 'check_in').length}</p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-2xl">
                  <p className="text-[8px] font-black uppercase text-amber-600 mb-1">Izin</p>
                  <p className="text-base font-black text-amber-700 dark:text-amber-400">{stats.filter(s => ['izin', 'sakit'].includes(s.type)).length}</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-2xl">
                  <p className="text-[8px] font-black uppercase text-red-600 mb-1">Alpha</p>
                  <p className="text-base font-black text-red-700 dark:text-red-400">{stats.filter(s => s.type === 'alpha').length}</p>
                </div>
                <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-2xl relative group">
                  <p className="text-[8px] font-black uppercase text-rose-600 mb-1">Telat</p>
                  <p className="text-base font-black text-rose-700 dark:text-rose-400">{stats.filter(s => s.type === 'check_in' && s.late_minutes > 0).length}</p>
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all bg-gray-900 text-white text-[8px] px-2 py-0.5 rounded pointer-events-none whitespace-nowrap font-bold">{stats.reduce((sum, s) => sum + (s.late_minutes || 0), 0)} Menit</span>
                </div>
             </div>

             {/* Fitur Blokir Akun (Khusus Alpha) */}
             {stats.some(s => s.type === 'alpha') && (
               <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30">
                 <div className="flex items-center gap-3 mb-3">
                   <ShieldAlert className="w-5 h-5 text-red-600" />
                   <div>
                     <p className="text-[10px] font-black uppercase text-red-700">Tindakan Disiplin</p>
                     <p className="text-[9px] text-red-600">Karyawan memiliki riwayat Alpha.</p>
                   </div>
                 </div>
                 <button 
                   onClick={() => handleBlockUser(employee.user_id, !employee.is_blocked)}
                   className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg ${
                     employee.is_blocked 
                     ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/30' 
                     : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
                   }`}
                 >
                   {employee.is_blocked ? 'Aktifkan Kembali Akun' : 'Blokir Sementara Akun'}
                 </button>
               </div>
             )}

             {/* Fitur Akhiri Masa Izin */}
             {stats[0]?.status === 'approved' && ['izin', 'sakit'].includes(stats[0]?.type) && (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }} 
                 animate={{ opacity: 1, y: 0 }}
                 className="mt-6 p-4 bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-200 dark:border-amber-800 rounded-3xl flex flex-col items-center gap-3 text-center"
               >
                 <ShieldAlert className="w-8 h-8 text-amber-600" />
                 <div>
                   <p className="text-xs font-black uppercase text-amber-700">Karyawan Sedang Izin/Sakit</p>
                   <p className="text-[10px] text-amber-600">Dashboard kasir saat ini terkunci untuk karyawan ini.</p>
                 </div>
                 <button 
                   onClick={() => handleApproveLeave(stats[0].id, 'completed', () => fetchStats())}
                   className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-500/30 transition-all"
                 >
                   Akhiri Masa Izin Sekarang
                 </button>
               </motion.div>
             )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark overflow-hidden shadow-xl">
             <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center">
               <h3 className="font-black uppercase text-xs tracking-widest flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Riwayat Absensi</h3>
             </div>
             <div className="divide-y divide-border-light dark:divide-border-dark">
                {stats.length === 0 ? (
                  <div className="p-8 text-center text-muted font-bold text-sm bg-gray-50/50 dark:bg-gray-800/20">
                    Belum ada riwayat absensi untuk karyawan ini.
                  </div>
                ) : (
                  stats.map(s => (
                    <div key={s.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-all">
                      <div>
                        <p className="text-sm font-black">{format(new Date(s.created_at), 'eeee, d MMMM yyyy', { locale: id })}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[10px] text-muted font-bold uppercase whitespace-nowrap">{format(new Date(s.created_at), 'HH:mm')} - {s.type}</p>
                          {s.type === 'check_in' && s.late_minutes > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[8px] font-black uppercase tracking-widest animate-pulse border border-red-200 dark:border-red-900 whitespace-nowrap">
                              Terlambat {s.late_minutes} Menit
                            </span>
                          )}
                          {s.type === 'check_in' && (!s.late_minutes || s.late_minutes === 0) && (
                            <span className="px-2 py-0.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[8px] font-black uppercase tracking-widest border border-green-200 dark:border-green-900 whitespace-nowrap">
                              Tepat Waktu
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 justify-start sm:justify-end w-full sm:w-auto flex-wrap">
                        {(s.type === 'izin' || s.type === 'sakit') && (
                          <div className="flex gap-2 items-center mr-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              s.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                              s.status === 'approved' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {s.status}
                            </span>
                            {s.status === 'pending' && (
                              <>
                                <button onClick={() => handleApproveLeave(s.id, 'approved', fetchStats)} className="px-3 py-1 bg-green-500 text-white rounded-full text-[10px] font-black uppercase hover:scale-105 transition-transform" title="Terima Izin">Terima</button>
                                <button onClick={() => handleApproveLeave(s.id, 'rejected', fetchStats)} className="px-3 py-1 bg-red-500 text-white rounded-full text-[10px] font-black uppercase hover:scale-105 transition-transform" title="Tolak Izin">Tolak</button>
                              </>
                            )}
                            {s.status === 'approved' && (
                              <button 
                                onClick={() => handleApproveLeave(s.id, 'completed', fetchStats)} 
                                className="px-3 py-1 bg-blue-500 text-white rounded-full text-[10px] font-black uppercase hover:scale-105 transition-transform shadow-lg shadow-blue-500/20"
                                title="Akhiri masa izin karyawan ini agar bisa kembali bekerja"
                              >
                                Akhiri Masa Izin
                              </button>
                            )}
                          </div>
                        )}
                        
                        {s.photo_url && (
                          <button 
                            onClick={() => setActivePhotoUrl(s.photo_url)} 
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-primary hover:text-white transition-all"
                            title="Lihat Bukti Foto"
                          >
                            <Camera className="w-3.5 h-3.5" /> Bukti Foto
                          </button>
                        )}
                        <select 
                          value={s.type} 
                          onChange={(e) => updateAttendanceType(s.id, e.target.value)}
                          className="bg-transparent text-[10px] font-black uppercase outline-none cursor-pointer text-primary border-b-2 border-primary/20 pb-1"
                          title="Ubah Status Absensi"
                          aria-label="Ubah Status Absensi"
                        >
                          <option value="check_in">Masuk</option>
                          <option value="check_out">Pulang</option>
                          <option value="sakit">Sakit</option>
                          <option value="izin">Izin</option>
                          <option value="alpha">Alpha</option>
                        </select>
                      </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      </div>
      <BaseModal isOpen={!!activePhotoUrl} onClose={() => setActivePhotoUrl(null)} size="lg" title="Pratinjau Bukti Foto">
        {activePhotoUrl && (
          <div className="w-full rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-900 border border-border-light dark:border-border-dark flex items-center justify-center">
            <img 
              src={activePhotoUrl} 
              alt="Bukti Foto Absensi" 
              className="w-full h-auto max-h-[70vh] object-contain"
            />
          </div>
        )}
      </BaseModal>
    </motion.div>
  );
}

function ShiftsTable({ shifts, onReopenSuccess }: { shifts: any[]; onReopenSuccess: () => void }) {
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  const handleReopen = async (shiftId: string, cashierName: string) => {
    if (!confirm(`Apakah Anda yakin ingin membuka kembali shift untuk ${cashierName}? Data rekap penutupan shift akan direset dan absensi keluar hari ini juga akan dihapus agar kasir dapat masuk kembali.`)) return;
    
    setReopeningId(shiftId);
    try {
      const res = await fetch('/api/admin/reopen-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal membuka kembali shift');
      toast.success(result.message || 'Shift berhasil dibuka kembali!');
      onReopenSuccess();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setReopeningId(null);
    }
  };

  return (
    <div className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left" style={{ minWidth: '900px' }}>
          <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-border-light dark:border-border-dark">
            <tr className="text-[10px] font-black uppercase text-muted tracking-widest">
              <th className="px-6 py-4 whitespace-nowrap">Karyawan</th>
              <th className="px-6 py-4 whitespace-nowrap">Status</th>
              <th className="px-6 py-4 whitespace-nowrap">Durasi</th>
              <th className="px-6 py-4 whitespace-nowrap">Modal</th>
              <th className="px-6 py-4 whitespace-nowrap">Sistem</th>
              <th className="px-6 py-4 whitespace-nowrap">Fisik</th>
              <th className="px-6 py-4 whitespace-nowrap">Selisih</th>
              <th className="px-6 py-4 whitespace-nowrap text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
            {shifts.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center bg-gray-50/50 dark:bg-gray-800/10">
                  <div className="flex flex-col items-center gap-3 max-w-sm mx-auto">
                    <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <DollarSign className="w-8 h-8 text-blue-400" />
                    </div>
                    <p className="font-black text-text-light dark:text-text-dark">Belum ada riwayat shift kasir</p>
                    <p className="text-xs text-muted font-medium text-center">
                      Data shift akan muncul otomatis setelah kasir melakukan <strong>absensi masuk (Buka Shift)</strong> dari halaman <em>Absensi</em> di panel kasir.
                    </p>
                    <div className="mt-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-2xl text-xs text-amber-700 dark:text-amber-400 font-medium text-left">
                      <p className="font-black mb-1">Cara mengisi data:</p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Login sebagai kasir</li>
                        <li>Buka halaman <strong>Absensi</strong></li>
                        <li>Klik tombol <strong>Buka Shift / Absen Masuk</strong></li>
                        <li>Data shift akan muncul di sini secara realtime</li>
                      </ol>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              shifts.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/20">
                  <td className="px-6 py-4 font-bold whitespace-nowrap">
                    {s.profiles?.full_name || <span className="text-muted italic text-xs">Kasir #{s.user_id?.slice(0,6)}</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase whitespace-nowrap ${s.status === 'open' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-650'}`}>{s.status === 'open' ? 'Berjalan' : 'Selesai'}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs whitespace-nowrap">
                    {s.status === 'closed' && s.end_time ? (
                      (() => {
                        const diff = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
                        const h = Math.floor(diff / 3600000);
                        const m = Math.floor((diff % 3600000) / 60000);
                        return `${h} jam ${m} menit`;
                      })()
                    ) : (
                      <span className="text-green-500 animate-pulse font-bold whitespace-nowrap">Sedang Berjalan...</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">Rp {(s.initial_cash || 0).toLocaleString('id-ID')}</td>
                  <td className="px-6 py-4 whitespace-nowrap">Rp {s.final_cash_system?.toLocaleString('id-ID') || '0'}</td>
                  <td className="px-6 py-4 font-black whitespace-nowrap">Rp {s.final_cash_actual?.toLocaleString('id-ID') || '0'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {s.status === 'closed' && (
                      <span className={`font-black whitespace-nowrap ${(s.difference || 0) < 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {(s.difference || 0) < 0 ? '-' : '+'} Rp {Math.abs(s.difference || 0).toLocaleString('id-ID')}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    {s.status === 'closed' && (
                      <button
                        disabled={reopeningId === s.id}
                        onClick={() => handleReopen(s.id, s.profiles?.full_name || 'Kasir')}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-amber-500/20"
                      >
                        {reopeningId === s.id ? 'Memproses...' : 'Buka Kembali'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkShiftsManager() {
  const [workShifts, setWorkShifts] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<any>(null);
  const [isManualName, setIsManualName] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- LOGIC SISTEM PENGGANTI ---
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subSelectedShift, setSubSelectedShift] = useState<any>(null);
  const [subSelectedEmployee, setSubSelectedEmployee] = useState("");
  const [subForEmployee, setSubForEmployee] = useState("");
  const [submittingSub, setSubmittingSub] = useState(false);

  const handleOpenSubstituteModal = (shift?: any) => {
     setSubSelectedShift(shift || null);
     setSubSelectedEmployee("");
     setSubForEmployee("");
     setIsSubModalOpen(true);
  };

  const handleSaveSubstitute = async () => {
     if (!subSelectedShift) return toast.error("Mohon pilih shift yang ingin diganti!");
     if (!subSelectedEmployee) return toast.error("Mohon pilih karyawan pengganti terlebih dahulu!");
     
     // Validasi 1: Pengganti tidak boleh sama dengan yang digantikan
     if (subForEmployee && subSelectedEmployee === subForEmployee) {
       return toast.error("Karyawan pengganti tidak boleh orang yang sama dengan yang digantikan!");
     }

     // Validasi 2: Pengganti tidak boleh karyawan yang memang sudah dijadwalkan secara reguler di shift tersebut
     const isAlreadyAssignedReg = (subSelectedShift.work_shift_assignments || []).some(
       (a: any) => a.profile_id === subSelectedEmployee
     );
     if (isAlreadyAssignedReg) {
       return toast.error("Karyawan tersebut sudah dijadwalkan secara reguler pada shift ini!");
     }

     setSubmittingSub(true);
     try {
       const todayISOStr = new Date().toLocaleDateString('sv-SE'); // Format YYYY-MM-DD aman
       const { error } = await supabase.from('work_shift_assignments').insert([{
          work_shift_id: subSelectedShift.id,
          profile_id: subSelectedEmployee,
          is_substitute: true,
          substitute_date: todayISOStr,
          substitute_for_profile_id: subForEmployee || null
       }]);

       if (error) throw error;
       toast.success(" Berhasil! Pahlawan Pengganti telah ditugaskan untuk hari ini.");
       setIsSubModalOpen(false);
       fetchData();
     } catch (e: any) {
       console.error(e);
       toast.error("Gagal menugaskan pengganti: " + e.message);
     } finally {
       setSubmittingSub(false);
     }
  };
  
  // Form State
  const [formData, setFormData] = useState({
    name: "",
    start_time: "08:00",
    end_time: "17:00",
    days: [] as string[],
    assignedProfileIds: [] as string[]
  });

  const daysOfWeek = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const supabase = createClient();

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Ambil semua shift & relasi via SECURE API BYPASS (ANTI-RLS BLOCK)
      const res = await fetch(`/api/admin/get-all-shifts?t=${Date.now()}`);
      const resData = await res.json();
      
      if (resData.success) {
        setWorkShifts(resData.data || []);
      } else {
        console.error("Secure fetch failed, falling back to direct select:", resData.error);
        // Fallback jika API gagal (safety net) dengan Relasi Ambigu yang Terpecahkan
        const { data: fbShifts } = await supabase
          .from('work_shifts')
          .select('*, work_shift_assignments(*, profiles:profiles!work_shift_assignments_profile_id_fkey(*))')
          .order('created_at', {ascending:false});
        setWorkShifts(fbShifts || []);
      }

      // 2. Ambil list seluruh karyawan aktif
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role, employee_id')
        .eq('status_karyawan', 'aktif')
        .in('role', ['cashier'])
        .order('full_name');
      setAllEmployees(profiles || []);

    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    // FORCE UNLOCK THEN FETCH DATA SEQUENTIALLY (BYPASS CACHE)
    fetch(`/api/fix-rls?t=${Date.now()}`)
      .catch(e => console.error(e))
      .finally(() => {
        fetchData();
      });

    // Reatime listener untuk refresh otomatis saat admin lain mengubah shift
    const chan = supabase.channel('work_shifts_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_shifts' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_shift_assignments' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, []);

  const handleOpenModal = (shift?: any) => {
    const defaults = ["Shift Pagi", "Shift Sore", "Shift Malam"];
    if (shift) {
      setEditingShift(shift);
      setIsManualName(!defaults.includes(shift.name));
      setFormData({
        name: shift.name,
        start_time: shift.start_time.slice(0, 5),
        end_time: shift.end_time.slice(0, 5),
        days: shift.days || [],
        assignedProfileIds: (shift.work_shift_assignments || []).map((a: any) => a.profile_id)
      });
    } else {
      setEditingShift(null);
      setIsManualName(false);
      setFormData({ name: "Shift Pagi", start_time: "08:00", end_time: "17:00", days: [], assignedProfileIds: [] });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return toast.error("Nama Shift harus diisi!");
    if (formData.days.length === 0) return toast.error("Pilih minimal satu hari kerja!");

    try {
      let shiftId = editingShift?.id;

      // A. UPSERT MASTER SHIFT
      if (editingShift) {
        const { error } = await supabase.from('work_shifts').update({
          name: formData.name,
          start_time: formData.start_time,
          end_time: formData.end_time,
          days: formData.days
        }).eq('id', editingShift.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('work_shifts').insert([{
          name: formData.name,
          start_time: formData.start_time,
          end_time: formData.end_time,
          days: formData.days
        }]).select().single();
        if (error) throw error;
        shiftId = data.id;
      }

      // B. SYNC ASSIGNMENTS - HANYA DIJALANKAN SAAT MEMBUAT SHIFT BARU SESUAI PERMINTAAN USER
      if (!editingShift) {
        // Langkah paling aman: hapus seluruh relasi sebelumnya untuk Shift ID ini
        const { error: delErr } = await supabase
          .from('work_shift_assignments')
          .delete()
          .eq('work_shift_id', shiftId);
        if (delErr) throw delErr;

        // Masukkan relasi baru
        if (formData.assignedProfileIds.length > 0) {
          const insertPayload = formData.assignedProfileIds.map(pid => ({
            work_shift_id: shiftId,
            profile_id: pid
          }));
          const { error: insErr } = await supabase.from('work_shift_assignments').insert(insertPayload);
          if (insErr) throw insErr;
        }
      }

      toast.success(editingShift ? "Shift diperbarui!" : "Shift baru berhasil dibuat!");
      setIsModalOpen(false);
      fetchData();
      // Trigger cron agar alpha orphan langsung dibersihkan secara realtime (chatboot.md)
      fetch('/api/attendance/cron').catch((e: any) => console.error('Cron trigger error:', e));
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    setIsDeleting(true);
    try {
      if (confirmDeleteId === 'ALL') {
        // MODE: HAPUS MASSAL
        const { error } = await supabase.from('work_shifts').delete().gte('created_at', '1970-01-01T00:00:00Z');
        if (error) throw error;
        toast.success("SEMUA SHIFT BERHASIL DIMUSNAHKAN TOTAL!");
      } else {
        // MODE: HAPUS SATUAN
        const { error } = await supabase.from('work_shifts').delete().eq('id', confirmDeleteId);
        if (error) throw error;
        toast.success("Shift berhasil dihapus secara permanen!");
      }
      
      fetchData(); // Realtime refresh
      setConfirmDeleteId(null);
      // Trigger cron agar alpha orphan yang jadwalnya dihapus langsung dibersihkan (chatboot.md)
      fetch('/api/attendance/cron').catch((e: any) => console.error('Cron trigger error:', e));
    } catch (err: any) { 
      toast.error(err.message); 
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = () => {
    // Memicu modal mewah existing dengan mode khusus 'ALL'
    setConfirmDeleteId('ALL');
  };


  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day]
    }));
  };

  const toggleEmployee = (pid: string) => {
    setFormData(prev => ({
      ...prev,
      assignedProfileIds: prev.assignedProfileIds.includes(pid) 
        ? prev.assignedProfileIds.filter(id => id !== pid) 
        : [...prev.assignedProfileIds, pid]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card-light dark:bg-card-dark p-6 rounded-3xl shadow-xl border border-border-light dark:border-border-dark">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2"><Calendar className="w-5 h-5 text-primary" /> Manajemen Shift</h2>
          <p className="text-muted text-xs font-medium mt-0.5">Buat skema jam kerja dan tugaskan ke karyawan</p>
        </div>
        <div className="flex items-center gap-3">
          {workShifts.length > 0 && (
            <button 
              onClick={handleDeleteAll}
              disabled={loading}
              className="px-6 py-3 bg-rose-100 text-rose-700 hover:bg-rose-600 hover:text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-md hover:shadow-lg hover:shadow-rose-200 transition-all flex items-center gap-2 border border-rose-200 dark:border-rose-900/30"
            >
              <Trash2 className="w-4 h-4" /> Hapus Semua
            </button>
          )}
          <button 
            onClick={() => handleOpenSubstituteModal()}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-500/30 hover:scale-105 transition-transform flex items-center gap-2 border border-emerald-500"
            title="Tunjuk Karyawan Pengganti Untuk Hari Ini"
          >
            <Shuffle className="w-4 h-4" /> Ganti Shift
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="px-6 py-3 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/30 hover:scale-105 transition-transform flex items-center gap-2"
          >
            <Users className="w-4 h-4" /> Tambah Shift Baru
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
      ) : workShifts.length === 0 ? (
        <div className="bg-card-light dark:bg-card-dark p-20 rounded-3xl border border-dashed border-border-light dark:border-border-dark text-center">
           <Clock className="w-12 h-12 text-muted mx-auto mb-4 opacity-30" />
           <p className="text-muted font-bold">Belum ada Shift Kerja. Silakan buat yang pertama.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {workShifts.map(shift => (
            <motion.div layout key={shift.id} className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-6 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-500" />
              
              <div className="flex justify-between items-start relative">
                <div>
                  <h3 className="font-black text-xl tracking-tight text-primary">{shift.name}</h3>
                  <div className="flex items-center gap-2 mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <Clock className="w-4 h-4 text-muted" />
                    <span className="font-mono font-black text-sm">{shift.start_time.slice(0,5)} - {shift.end_time.slice(0,5)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenModal(shift)} title="Kelola Detail Shift" className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all"><Eye className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(shift.id)} title="Hapus Jadwal Shift" className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all"><X className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="mt-6 space-y-4 relative">
                 <div>
                    <p className="text-[10px] font-black text-muted uppercase mb-1.5 tracking-widest">Hari Kerja</p>
                    <div className="flex flex-wrap gap-1">
                       {daysOfWeek.map(d => {
                         const isActive = shift.days?.includes(d);
                         return (
                           <span key={d} className={`px-2 py-0.5 text-[9px] font-black rounded ${isActive ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-gray-50 dark:bg-gray-800 text-muted opacity-50'}`}>{d.slice(0,3)}</span>
                         )
                       })}
                    </div>
                 </div>

                 <div>
                    <p className="text-[10px] font-black text-muted uppercase mb-1.5 tracking-widest">Karyawan Ditugaskan ({shift.work_shift_assignments?.length || 0})</p>
                    <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-2">
                       {shift.work_shift_assignments?.map((assign: any) => (
                         <div key={assign.id} className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded-lg border border-border-light dark:border-border-dark">
                            <div className="w-4 h-4 bg-primary/20 rounded-full flex items-center justify-center"><User className="w-2 h-2 text-primary" /></div>
                            <span className="text-[10px] font-bold truncate max-w-[80px]">{assign.profiles?.full_name}</span>
                         </div>
                       ))}
                       {(!shift.work_shift_assignments || shift.work_shift_assignments.length === 0) && (
                         <p className="text-[10px] italic text-red-400 font-medium">Belum ada penugasan</p>
                       )}
                    </div>
                 </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* MODAL CREATE / EDIT SHIFT */}
      <BaseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="2xl" title={editingShift ? 'Edit Shift Kerja' : 'Buat Shift Kerja Baru'}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black uppercase text-muted flex items-center gap-2">
                  <Clock className="w-3 h-3 text-muted" /> Nama Shift
                </label>
                <button 
                  type="button"
                  onClick={() => {
                    const isNowManual = !isManualName;
                    setIsManualName(isNowManual);
                    if (isNowManual) {
                      setFormData(prev => ({ ...prev, name: "" }));
                    } else {
                      setFormData(prev => ({ ...prev, name: "Shift Pagi" }));
                    }
                  }}
                  className="text-[9px] font-black tracking-wider uppercase text-primary hover:bg-primary/10 border border-primary/20 bg-primary/5 px-2 py-1 rounded-lg transition-all active:scale-95"
                >
                  {isManualName ? "← Opsi Cepat" : " Tulis Manual"}
                </button>
              </div>
              
              {!isManualName ? (
                <div className="relative">
                   <select
                     value={formData.name}
                     onChange={(e) => {
                       if (e.target.value === "__CUSTOM__") {
                         setIsManualName(true);
                         setFormData(prev => ({ ...prev, name: "" }));
                       } else {
                         setFormData(prev => ({ ...prev, name: e.target.value }));
                       }
                     }}
                     aria-label="Pilih Nama Shift"
                     title="Pilih Nama Shift"
                     className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl px-4 py-3.5 font-bold outline-none focus:ring-2 focus:ring-primary transition-all shadow-inner cursor-pointer appearance-none pr-10 text-slate-900 dark:text-white"
                   >
                     <option value="Shift Pagi">Shift Pagi</option>
                     <option value="Shift Sore">Shift Sore</option>
                     <option value="Shift Malam">Shift Malam</option>
                     <option value="__CUSTOM__">+ Kustom / Nama Baru...</option>
                   </select>
                   <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted opacity-50">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                   </div>
                </div>
              ) : (
                <input 
                  type="text" 
                  autoFocus
                  aria-label="Ketik Nama Shift Kustom"
                  title="Ketik Nama Shift Kustom"
                  value={formData.name} 
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ketik nama shift baru..."
                  className="w-full bg-white dark:bg-gray-850 border-2 border-primary/30 rounded-xl px-4 py-3.5 font-bold outline-none focus:ring-2 focus:ring-primary transition-all shadow-lg shadow-primary/5 ring-offset-2 placeholder:font-normal animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-white"
                />
              )}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-muted">Jam Mulai</label>
              <input 
                type="time" 
                value={formData.start_time} 
                onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                title="Jam Mulai Tugas"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl px-4 py-3 font-bold font-mono outline-none text-slate-900 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-muted">Jam Selesai</label>
              <input 
                type="time" 
                value={formData.end_time} 
                onChange={e => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                title="Jam Selesai Tugas"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl px-4 py-3 font-bold font-mono outline-none text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-black uppercase text-muted block mb-3">Hari Kerja Berlaku</label>
            <div className="flex flex-wrap gap-2">
              {daysOfWeek.map(day => {
                const isSel = formData.days.includes(day);
                return (
                  <button 
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${
                      isSel ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-105' : 'bg-gray-100 dark:bg-gray-800 text-muted border border-transparent hover:border-primary'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>

          {!editingShift && (
            <div>
              <label className="text-xs font-black uppercase text-muted block mb-3">Tugaskan Karyawan</label>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 border border-border-light dark:border-border-dark grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                {allEmployees.map(emp => {
                  const isAssigned = formData.assignedProfileIds.includes(emp.id);
                  return (
                    <button 
                      key={emp.id}
                      type="button"
                      onClick={() => toggleEmployee(emp.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all border ${
                        isAssigned ? 'bg-white dark:bg-gray-700 border-primary shadow-md' : 'bg-transparent border-transparent hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isAssigned ? 'bg-primary border-primary' : 'border-muted'}`}>
                        {isAssigned && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="min-w-0">
                         <p className={`text-xs font-black truncate ${isAssigned ? 'text-primary' : ''}`}>{emp.full_name}</p>
                         <p className="text-[9px] text-muted uppercase font-bold">{emp.employee_id}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-border-light dark:border-border-dark flex gap-4">
            <button 
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-6 py-3 bg-gray-100 dark:bg-gray-800 text-muted rounded-xl font-bold text-sm flex-1"
            >
              Batal
            </button>
            <button 
              type="submit"
              className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-black text-sm uppercase tracking-widest flex-1 shadow-lg shadow-primary/20 transition-all"
            >
              Simpan Shift
            </button>
          </div>
        </form>
      </BaseModal>

      {/* MODAL SUBSTITUTE / GANTI SHIFT */}
      <BaseModal isOpen={isSubModalOpen} onClose={() => setIsSubModalOpen(false)} size="md" title="Tunjuk Pahlawan Pengganti">
         <div className="relative">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-6">
               <Shuffle className="w-8 h-8" />
            </div>

            <p className="text-muted text-xs font-medium mb-8">
               Menugaskan pahlawan pengganti darurat untuk hari ini.
            </p>

            <div className="space-y-5">
               <div>
                  <label htmlFor="masterShiftSelect" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-2">0. Pilih Jadwal Shift</label>
                  <select 
                    id="masterShiftSelect"
                    value={subSelectedShift?.id || ""} 
                    onChange={e => {
                       const sFound = workShifts.find(s => s.id === e.target.value);
                       setSubSelectedShift(sFound || null);
                       setSubForEmployee("");
                    }}
                    className="w-full bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-border-light dark:border-border-dark rounded-xl px-4 py-3 font-black text-sm outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner text-slate-900 dark:text-white"
                  >
                     <option value="">-- Pilih Shift --</option>
                     {workShifts.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.start_time.slice(0,5)} - {s.end_time.slice(0,5)})</option>
                     ))}
                  </select>
               </div>
               <div>
                  <label htmlFor="subForEmployeeSelect" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-2">1. Siapa yang digantikan? (Opsional)</label>
                  <select 
                    id="subForEmployeeSelect"
                    value={subForEmployee} 
                    onChange={e => setSubForEmployee(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                  >
                    <option value="">-- Tidak Tahu / Umum --</option>
                    {subSelectedShift?.work_shift_assignments?.map((a: any) => (
                       <option key={a.id} value={a.profile_id}>{a.profiles?.full_name}</option>
                    ))}
                  </select>
               </div>

               <div>
                  <label htmlFor="subSelectedEmployeeSelect" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-2">2. Siapa Penggantinya? (Pahlawan Hari Ini)</label>
                  <select 
                    id="subSelectedEmployeeSelect"
                    value={subSelectedEmployee} 
                    onChange={e => setSubSelectedEmployee(e.target.value)}
                    className="w-full bg-white dark:bg-gray-700 border-2 border-emerald-500/30 rounded-xl px-4 py-3 font-black text-sm outline-none focus:ring-2 focus:ring-emerald-500 shadow-lg shadow-emerald-500/5 text-slate-900 dark:text-white"
                  >
                    <option value="">-- Pilih Karyawan Pengganti --</option>
                    {allEmployees.map(emp => (
                       <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </select>
               </div>
            </div>

            <div className="mt-8 flex flex-col gap-3">
               <button 
                 disabled={submittingSub}
                 onClick={handleSaveSubstitute}
                 className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
               >
                  {submittingSub ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-white" />}
                  {submittingSub ? "Menyimpan..." : "Tugaskan Hari Ini"}
               </button>
               <button 
                 disabled={submittingSub}
                 onClick={() => setIsSubModalOpen(false)}
                 className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-muted rounded-xl font-bold text-xs uppercase transition-all hover:bg-gray-200"
               >
                  Batal
               </button>
            </div>
         </div>
      </BaseModal>

      {/* MODAL CONFIRM DELETE SHIFT */}
      <BaseModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} size="sm" showCloseButton={false}>
         <div className="text-center">
            <div className="w-20 h-20 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 transform rotate-3 shadow-inner">
              <Trash2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight mb-2">
              {confirmDeleteId === 'ALL' ? 'Musnahkan Semua?' : 'Yakin Hapus?'}
            </h3>
            <p className="text-muted text-xs font-medium mb-8 px-4">
              {confirmDeleteId === 'ALL' 
                ? 'PERINGATAN: Seluruh jadwal shift akan dihapus total dan permanen. Tindakan ini mustahil untuk dibatalkan!' 
                : 'Data ini akan dihapus permanen dari server. Tindakan ini tidak dapat dikembalikan.'
              }
            </p>
            <div className="flex flex-col gap-3">
               <button 
                 onClick={executeDelete}
                 disabled={isDeleting}
                 className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs active:scale-95 disabled:opacity-50"
               >
                 {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Hapus Sekarang"}
               </button>
               <button 
                 onClick={() => setConfirmDeleteId(null)}
                 disabled={isDeleting}
                 className="w-full py-4 bg-gray-100 dark:bg-gray-800 text-muted hover:text-primary hover:bg-gray-200 dark:hover:bg-gray-700 rounded-2xl font-black transition-all uppercase tracking-widest text-xs active:scale-95"
               >
                 Batal
               </button>
            </div>
         </div>
      </BaseModal>
    </div>
  );
}
