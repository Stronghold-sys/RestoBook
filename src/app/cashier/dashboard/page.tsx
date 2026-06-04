"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Loader2, DollarSign, Clock, CheckCircle2, TrendingUp, AlertCircle, LogOut, ShieldX, ShieldAlert, ShieldCheck, Users, Hand, Heart, Sparkles, Flame, Star, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import AttendanceModal from "@/components/cashier/AttendanceModal";
import toast from "react-hot-toast";
import BaseModal from "@/components/BaseModal";

export default function CashierDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    revenue: 0
  });
  const [advancedStats, setAdvancedStats] = useState({
    topPaymentMethod: "-",
    dineInPercent: 0,
    takeawayPercent: 0,
    deliveryPercent: 0,
    activeTable: "-",
    topItem: "-"
  });
  const [tables, setTables] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);
  const [openShiftData, setOpenShiftData] = useState<any>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [actualCash, setActualCash] = useState("");
  const [closing, setClosing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  // New States
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [latestAttendance, setLatestAttendance] = useState<any>(null);
  
  // Leave Request State
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveType, setLeaveType] = useState<"sakit" | "izin">("sakit");
  const [leaveNotes, setLeaveNotes] = useState("");
  const [leaveFile, setLeaveFile] = useState<File | null>(null);
  const [submittingLeave, setSubmittingLeave] = useState(false);
  const [leaveDuration, setLeaveDuration] = useState("1");
  const [leaveDurationUnit, setLeaveDurationUnit] = useState<"hari" | "minggu" | "bulan">("hari");
  
  // Timer State
  const [shiftTimer, setShiftTimer] = useState("00:00:00");
  
  // Resign Tracking State
  const [activeResign, setActiveResign] = useState<any>(null);
  const [countdown, setCountdown] = useState({ d: 0, h: 0, m: 0, s: 0 });
  const [decisionProcessing, setDecisionProcessing] = useState(false);

  // --- CORE SHIFT INTELLIGENCE STATE ---
  const [todayShift, setTodayShift] = useState<any>(null);
  const [lateTolerance, setLateTolerance] = useState(15);
  const [curTime, setCurTime] = useState(new Date());
  const [shiftStatus, setShiftStatus] = useState<'loading' | 'future' | 'now' | 'late' | 'none'>('loading');
  const [shiftCountdown, setShiftCountdown] = useState({ h:0, m:0, s:0 });
  const [lateMinutes, setLateMinutes] = useState(0);
  const [assignedTeam, setAssignedTeam] = useState<any[]>([]);
  const [isCompletedToday, setIsCompletedToday] = useState(false);
  const [subDetails, setSubDetails] = useState<{isSubstitute: boolean, substituteFor: string | null} | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Bersihkan channel lama jika ada untuk mencegah error 'after subscribe'
      await supabase.removeChannel(supabase.channel(`cashier_sync_${user.id}`));

      const channel = supabase.channel(`cashier_sync_${user.id}`)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'resign_requests'
          }, 
          () => fetchActiveResign()
        )
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'attendance',
            filter: `user_id=eq.${user.id}`
          }, 
          () => {
            fetchLatestAttendance();
            checkShift();
          }
        )
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'shifts',
            filter: `user_id=eq.${user.id}`
          }, 
          () => checkShift()
        )
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'work_shift_assignments'
          }, 
          () => checkShift()
        )
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'work_shifts'
          }, 
          () => checkShift()
        )
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'profiles',
            filter: `user_id=eq.${user.id}`
          }, 
          () => fetchProfile()
        )
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'tables'
          }, 
          () => fetchTables()
        )
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'orders'
          }, 
          () => fetchDashboardData()
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log("Realtime subscribed successfully");
          }
        });

      return channel;
    };

    checkShift();
    fetchProfile();
    fetchDashboardData();
    fetchTables();
    fetchLatestAttendance();
    
    const channelPromise = setupRealtime();

    return () => {
      channelPromise.then((ch) => {
        if (ch) supabase.removeChannel(ch);
      });
    };
  }, [hasOpenShift, openShiftData]);

  // useEffect khusus untuk Jam Digital agar berjalan lancar & Sync State Waktu Real-time
  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = new Date();
      setCurTime(now); // Trigger rerender for shift calculation
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      setShiftTimer(new Intl.DateTimeFormat('id-ID', options).format(now));
    }, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  // ️‍️ DETAK JANTUNG SILUMAN NINJA (Silent Real-Time Recon):
  // Berjalan sangat cepat (3 detik) namun TOTAL DIAM dan ANTI-KEDIP karena diproteksi State Guard.
  useEffect(() => {
    const stealthPulse = setInterval(() => {
      // Hanya polling jika kasir belum mulai tugas (dalam mode standby melihat jadwal)
      if (!hasOpenShift) {
        checkShift(); 
      }
    }, 3000); // Periksa super cepat setiap 3 detik
    return () => clearInterval(stealthPulse);
  }, [hasOpenShift]);

  const fetchLatestAttendance = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      setLatestAttendance(data);
    } catch (e) { console.error(e); }
  };

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();
      setProfile(data);
      if (data?.id) fetchActiveResign(data.id);
    } catch (e) { console.error(e); }
  };

  const fetchActiveResign = async (profileId?: string) => {
    try {
      let targetId = profileId;
      if (!targetId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: p } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();
        targetId = p?.id;
      }
      if (!targetId) return;

      const { data } = await supabase
        .from('resign_requests')
        .select('*')
        .eq('profile_id', targetId)
        .in('status', ['Disetujui', 'Menunggu Konfirmasi'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveResign(data);
    } catch (e) { console.error("Resign fetch err:", e); }
  };

  const fetchTables = async () => {
    try {
      const { data } = await supabase.from('tables').select('*').order('table_number');
      setTables(data || []);
    } catch (error) {
      console.error(error);
    }
  };

  const checkShift = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch Data Profil & Tolerance Sistem
      const [profRes, setRes] = await Promise.all([
        supabase.from('profiles').select('id, role').eq('user_id', user.id).single(),
        supabase.from('restaurant_settings').select('late_tolerance_minutes').single()
      ]);

      const profileData = profRes.data;
      if (setRes.data?.late_tolerance_minutes != null) {
        setLateTolerance(Number(setRes.data.late_tolerance_minutes));
      }

      // Jika Admin, bebas dari pengecekan jadwal shift kerja
      if (profileData?.role === 'admin') {
        setHasOpenShift(true);
        return;
      }

      // 2. Ambil Jadwal Shift Kerja via Secure API (SELALU LOAD GUNA PERHITUNGAN LEMBUR/OVERTIME)
      const shiftRes = await fetch(`/api/cashier/active-shift?userId=${user.id}&t=${Date.now()}`, { 
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      });
      const shiftData = await shiftRes.json();

      if (shiftData.success && shiftData.todayShift) {
        setTodayShift((prev: any) => {
          const newVal = shiftData.todayShift;
          if (JSON.stringify(prev) === JSON.stringify(newVal)) return prev; 
          return newVal;
        });
        setAssignedTeam((prev: any[]) => {
          const newVal = shiftData.assignedEmployees || [];
          if (JSON.stringify(prev) === JSON.stringify(newVal)) return prev; 
          return newVal;
        });
        // SIMPAN DETAIL PENUGASAN (NORMAL / PENGGANTI)
        setSubDetails(shiftData.assignmentDetails || null);
      } else {
        // Reset jika tidak ada shift
        setTodayShift(null);
        setSubDetails(null);
      }

      // 3. Cek Shift Kasir Aktif (Fisik mesin kasir sedang terbuka?)
      const { data: shift } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let todayCheckIn = null;
      let todayCheckOut = null;

      //  VALIDASI HANYA JIKA ADA JADWAL AKTIF
      if (shiftData?.todayShift?.id) {
         // A. Cek apakah sudah absen masuk UNTUK SHIFT INI?
         const { data: inData } = await supabase
           .from('attendance')
           .select('*')
           .eq('user_id', user.id)
           .eq('work_shift_id', shiftData.todayShift.id)
           .eq('type', 'check_in')
           .gte('created_at', today.toISOString())
           .limit(1)
           .maybeSingle();
         todayCheckIn = inData;

         // B. Cek apakah sudah absen keluar UNTUK SHIFT INI?
         const { data: outData } = await supabase
           .from('attendance')
           .select('*')
           .eq('user_id', user.id)
           .eq('work_shift_id', shiftData.todayShift.id)
           .eq('type', 'check_out')
           .gte('created_at', today.toISOString())
           .limit(1)
           .maybeSingle();
         todayCheckOut = outData;
      }

      //  SET STATUS AKHIR: SELESAI jika ADA checkout hari ini DAN TIDAK ADA shift aktif berikutnya
      const { data: globalTodayCheckOut } = await supabase.from('attendance').select('id').eq('user_id', user.id).eq('type', 'check_out').gte('created_at', today.toISOString()).limit(1).maybeSingle();
      
      setIsCompletedToday(!!globalTodayCheckOut && !shiftData?.todayShift);

      //  BUKA AKSES JIKA: SEDANG ADA SHIFT TERBUKA, ATAU SUDAH ABSEN MASUK SHIFT INI TAPI BELUM KELUAR!
      if (shift || (todayCheckIn && !todayCheckOut)) {
        setHasOpenShift(true);
        setOpenShiftData((prev: any) => {
          const newVal = shift || null;
          if (JSON.stringify(prev) === JSON.stringify(newVal)) return prev;
          return newVal;
        });
        return;
      }
      
      // Jika tidak lolos verifikasi akses, matikan dashboard aktif
      setHasOpenShift(false);
      setOpenShiftData(null);

      setHasOpenShift(false);
      setOpenShiftData(null);

      if (!shiftData.success || !shiftData.todayShift) {
        setShiftStatus('none');
        return;
      }

    } catch (error) {
      console.error(error);
      setHasOpenShift(false);
    }
  };

  // === REALTIME SHIFT CALCULATOR ENGINE ===
  useEffect(() => {
    if (hasOpenShift) return; // Abaikan jika sudah masuk
    if (!todayShift) {
      setShiftStatus('none');
      return;
    }

    // Buat objek Date target (Hari ini jam X)
    const [targetH, targetM] = todayShift.start_time.split(':').map(Number);
    const targetTime = new Date(curTime);
    targetTime.setHours(targetH, targetM, 0, 0);

    //  PENYEMBUH BUG SHIFT MALAM (Midnight Cross Fix):
    // Jika selisih waktu jatuh > 12 jam yang lalu, berarti target merujuk ke Dini Hari ESOK PAGI/NANTI.
    // Kita tambahkan 1 hari ke target agar kalkulasi valid (Masa Depan/Hitung Mundur).
    if (curTime.getTime() - targetTime.getTime() > 12 * 60 * 60 * 1000) {
       targetTime.setDate(targetTime.getDate() + 1);
    }

    const diffMs = targetTime.getTime() - curTime.getTime();
    
    if (diffMs > 0) {
      // KASUS: Shift di Masa Depan (BELUM MULAI)
      setShiftStatus('future');
      const totSeconds = Math.floor(diffMs / 1000);
      setShiftCountdown({
        h: Math.floor(totSeconds / 3600),
        m: Math.floor((totSeconds % 3600) / 60),
        s: totSeconds % 60
      });
      setLateMinutes(0);
    } else {
      // KASUS: Sudah masuk jam kerja, cek toleransi
      const elapsedMin = Math.abs(diffMs) / (1000 * 60);
      
      if (elapsedMin <= lateTolerance) {
        setShiftStatus('now'); // TEPAT WAKTU
        setLateMinutes(0);
      } else {
        setShiftStatus('late'); // TERLAMBAT
        setLateMinutes(Math.floor(elapsedMin));
      }
    }

  }, [curTime, todayShift, lateTolerance, hasOpenShift]);

  const handleCloseShift = async () => {
    if (!actualCash) return toast.error("Masukkan uang fisik akhir");
    setClosing(true);
    
    try {
      // 1. Hitung total pendapatan dari pesanan yang LUNAS selama shift ini
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount')
        .eq('payment_status', 'paid')
        .gte('created_at', openShiftData.start_time);

      const systemRevenue = orders?.reduce((sum, o) => sum + o.total_amount, 0) || 0;
      const initial = Number(openShiftData.initial_cash);
      const actual = Number(actualCash);
      
      // Saldo yang seharusnya ada = Modal Awal + Pendapatan Sistem
      const expectedCash = initial + systemRevenue;
      const diff = actual - expectedCash;

      //  KECERDASAN LEMBUR OTOMATIS: Hitung detik lembur diam-diam demi payroll!
      let finalOtSecs = 0;
      if (todayShift?.end_time) {
         const nowTime = new Date();
         const [eH, eM] = todayShift.end_time.split(':').map(Number);
         const limitTime = new Date(nowTime);
         limitTime.setHours(eH, eM, 0, 0);

         // Midnight cross handling
         if (nowTime.getTime() - limitTime.getTime() > 12 * 60 * 60 * 1000) {
            limitTime.setDate(limitTime.getDate() + 1);
         }

         const timeDiff = nowTime.getTime() - limitTime.getTime();
         if (timeDiff > 0) {
            finalOtSecs = Math.floor(timeDiff / 1000);
         }
      }

      // 2. Update Shift ke database
      const { error } = await supabase
        .from('shifts')
        .update({
          end_time: new Date().toISOString(),
          final_cash_system: systemRevenue,
          final_cash_actual: actual,
          difference: diff,
          status: 'closed'
        })
        .eq('id', openShiftData.id);

      if (error) throw error;

      //  LOG KEHADIRAN: Masukkan absen KELUAR resmi berisi data jam lembur untuk Payroll Admin
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
         await supabase.from('attendance').insert({
           user_id: user.id,
           profile_id: openShiftData.profile_id,
           type: 'check_out',
           status: 'completed',
           notes: `OVERTIME_LOG:${JSON.stringify({ seconds: finalOtSecs, date: new Date().toISOString() })}`
         });

         //  BERSIHKAN SAMPAH LOKAL: Hilangkan trigger lembur & timer agar kembali normal untuk login berikutnya
         localStorage.removeItem("overtime_start_timestamp");
         localStorage.removeItem("shift_end_target_timestamp");
      }



      toast.success(diff < 0 
        ? `Shift Ditutup. Ada selisih MINUS Rp ${Math.abs(diff).toLocaleString('id-ID')}`
        : diff > 0 
          ? `Shift Ditutup. Ada selisih PLUS Rp ${diff.toLocaleString('id-ID')}`
          : "Shift Ditutup. Saldo Sesuai!"
      );
      setShowCloseModal(false);
      setHasOpenShift(false);
      setOpenShiftData(null);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setClosing(false);
    }
  };

  const handleEmergencyCheckout = async () => {
    try {
      setClosing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi user hilang.");

      // Ambil detail profile ID
      const { data: p } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();

      // Rekam Absen Keluar Darurat
      await supabase.from('attendance').insert({
        user_id: user.id,
        profile_id: p?.id || null,
        type: 'check_out',
        status: 'completed',
        work_shift_id: todayShift?.id || null,
        notes: `TUTUP_SHIF_MANUAL_DARURAT: ${new Date().toISOString()}`
      });

      toast.success("Sesi Darurat Berhasil Ditutup!");
      setHasOpenShift(false);
      setOpenShiftData(null);
      
      // Panggil sinkronisasi ulang agar UI kembali normal
      checkShift();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setClosing(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [ordersRes, allOrdersRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*, order_items(quantity, menu_items(name)), tables(table_number)')
          .gte('created_at', today.toISOString())
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('*, order_items(quantity, menu_items(name)), tables(table_number)')
          .order('created_at', { ascending: false })
      ]);

      const orders = (ordersRes.data || []).filter((o: any) => !(o.payment_method === 'non_cash' && o.payment_status === 'unpaid'));
      const allOrders = (allOrdersRes.data || []).filter((o: any) => !(o.payment_method === 'non_cash' && o.payment_status === 'unpaid'));

      // Today's Stats
      setStats({
        totalOrders: orders.length,
        pendingOrders: orders.filter(o => o.status === 'pending').length,
        completedOrders: orders.filter(o => o.status === 'completed').length,
        revenue: orders.filter(o => o.payment_status === 'paid').reduce((sum, o) => sum + o.total_amount, 0)
      });
      setRecentOrders(orders.slice(0, 5));

      // Advanced Stats Calculation from all-time history so they never reset on a new day!
      if (allOrders && allOrders.length > 0) {
        const methodCounts: any = {};
        const tableCounts: any = {};
        const itemCounts: any = {};
        let dineIn = 0;
        let takeaway = 0;
        let delivery = 0;

        allOrders.forEach(o => {
          // Payment method count
          const method = o.payment_method === 'cash' ? 'Tunai' : (o.notes?.includes('[METODE:') ? o.notes.split('[METODE:')[1].split(']')[0].trim() : 'Non-Tunai');
          methodCounts[method] = (methodCounts[method] || 0) + 1;
          
          // Order type
          if (o.order_type === 'dine_in') dineIn++;
          else if (o.order_type === 'delivery') delivery++;
          else takeaway++;

          // Table active
          if (o.tables?.table_number) {
            tableCounts[o.tables.table_number] = (tableCounts[o.tables.table_number] || 0) + 1;
          }

          // Top Item
          o.order_items?.forEach((i: any) => {
            if (i.menu_items?.name) {
              itemCounts[i.menu_items.name] = (itemCounts[i.menu_items.name] || 0) + i.quantity;
            }
          });
        });

        const topMethod = Object.keys(methodCounts).sort((a,b) => methodCounts[b] - methodCounts[a])[0] || "-";
        const topTable = Object.keys(tableCounts).sort((a,b) => tableCounts[b] - tableCounts[a])[0] || "-";
        const topMenu = Object.keys(itemCounts).sort((a,b) => itemCounts[b] - itemCounts[a])[0] || "-";

        setAdvancedStats({
          topPaymentMethod: topMethod,
          dineInPercent: Math.round((dineIn / allOrders.length) * 100) || 0,
          takeawayPercent: Math.round((takeaway / allOrders.length) * 100) || 0,
          deliveryPercent: Math.round((delivery / allOrders.length) * 100) || 0,
          activeTable: topTable !== "-" ? `Meja ${topTable}` : "-",
          topItem: topMenu
        });
      } else {
        setAdvancedStats({
          topPaymentMethod: "-", dineInPercent: 0, takeawayPercent: 0, deliveryPercent: 0, activeTable: "-", topItem: "-"
        });
      }

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveNotes) return toast.error("Alasan atau keterangan wajib diisi agar Admin bisa memproses izin Anda.");
    setSubmittingLeave(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sesi login berakhir. Silakan login kembali.");

      const { data: userProfile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single();

      let attachmentUrl = null;
      if (leaveFile) {
        const formData = new FormData();
        formData.append('file', leaveFile);
        formData.append('userId', user.id);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        const uploadResult = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadResult.error || "Gagal mengunggah bukti");
        
        attachmentUrl = uploadResult.url;
      }

      // Gunakan API khusus untuk insert agar bypass RLS
      const res = await fetch('/api/attendance/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          profileId: userProfile?.id,
          type: leaveType,
          notes: `${leaveNotes} (${leaveDuration} ${leaveDurationUnit})`,
          attachmentUrl: attachmentUrl,
          duration: leaveDuration,
          durationUnit: leaveDurationUnit
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal mengirim pengajuan");

      toast.success("Pengajuan Anda telah terkirim! Admin akan segera meninjau dan memberikan keputusan.");
      setShowLeaveModal(false);
      setLeaveNotes("");
      setLeaveFile(null);
      fetchLatestAttendance();
    } catch (error: any) {
      console.error("Leave error:", error);
      toast.error(error.message || "Gagal mengirim pengajuan izin.");
    } finally {
      setSubmittingLeave(false);
    }
  };

  // === RESIGN COUNTDOWN & DECISION LOGIC ===
  useEffect(() => {
    if (!activeResign?.suspension_time || activeResign.status !== 'Disetujui' || activeResign.employee_decision === 'lanjut_bekerja') {
      return;
    }

    const tick = () => {
      const now = new Date().getTime();
      const target = new Date(activeResign.suspension_time).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setCountdown({ d: 0, h: 0, m: 0, s: 0 });
        if (profile?.status_karyawan === 'aktif') {
          handleAutoSuspend();
        }
        return;
      }

      setCountdown({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        s: Math.floor((diff % (1000 * 60)) / 1000)
      });
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [activeResign, profile]);

  const handleAutoSuspend = async () => {
    if (!profile?.id) return;
    try {
      await fetch("/api/admin/resign-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_out", profileId: profile.id })
      });
      toast.success("Waktu penangguhan habis. Sesi Anda berakhir.", { duration: 5000 });
      setTimeout(async () => {
         try {
            await fetch('/api/auth/logout', { method: 'POST' });
         } catch (e) {
            console.error('API logout failed', e);
         }
         await supabase.auth.signOut();
         window.location.href = "/login";
      }, 2000);
    } catch (e) { console.error(e); }
  };

  const handleEmployeeDecision = async (decision: 'lanjut_keluar' | 'lanjut_bekerja') => {
    if (!activeResign?.id) return;
    setDecisionProcessing(true);
    try {
      const res = await fetch("/api/admin/resign-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "employee_decision", 
          requestId: activeResign.id,
          decision 
        })
      });
      if (!res.ok) throw new Error("Gagal menyimpan keputusan");
      toast.success(decision === 'lanjut_bekerja' 
        ? "Pilihan tercatat! Status kembali aktif. Selamat bekerja!" 
        : "Keputusan dikonfirmasi. Silakan melanjutkan persiapan akhir Anda."
      );
      fetchActiveResign(profile?.id);
      fetchProfile();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDecisionProcessing(false);
    }
  };

  const getSpiritedMessage = () => {
    if (latestAttendance?.status !== 'completed') return null;
    
    switch (latestAttendance.type) {
      case 'sakit':
        return {
          title: "Selamat Datang Kembali!",
          msg: "Senang melihat Anda sehat kembali! Selamat kembali berjuang bersama tim, kesehatan Anda adalah prioritas kami!",
          color: "bg-gradient-to-r from-emerald-500 to-teal-500",
          icon: <Heart className="w-8 h-8 text-white" />
        };
      case 'izin':
        return {
          title: "Senang Anda Kembali!",
          msg: "Semoga urusan Anda lancar! Sekarang, mari kita buat hari ini luar biasa dengan semangat baru!",
          color: "bg-gradient-to-r from-blue-500 to-indigo-600",
          icon: <Sparkles className="w-8 h-8 text-white" />
        };
      case 'alpha':
        return {
          title: "Ayo Semangat Lagi!",
          msg: "Selamat kembali! Ayo kita kejar ketertinggalan dan berikan performa terbaik Anda hari ini! Fokus & Maju!",
          color: "bg-gradient-to-r from-orange-500 to-red-500",
          icon: <Flame className="w-8 h-8 text-white" />
        };
      default:
        return {
          title: "Selamat Bekerja!",
          msg: "Senang melihat Anda kembali di tim. Mari berikan layanan terbaik untuk pelanggan kita hari ini!",
          color: "bg-gradient-to-r from-orange-600 via-orange-500 to-amber-600",
          icon: <Star className="w-8 h-8 text-white" />
        };
    }
  };

  const renderResignWidget = () => {
    if (!activeResign || activeResign.status !== 'Disetujui') return null;
    
    const formatDateTime = (dStr: string) => {
      try {
        return format(new Date(dStr), "EEEE, dd MMMM yyyy '-' HH:mm:ss", { locale: id });
      } catch (e) { return dStr; }
    };

    const isDecided = !!activeResign.employee_decision;

    return (
      <motion.div 
        initial={{ y: -20, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        className="mb-8 w-full max-w-4xl mx-auto text-left"
      >
        <div className={`relative overflow-hidden rounded-[2.5rem] shadow-2xl border-2 ${!isDecided ? 'border-red-500/30 bg-red-50/50 dark:bg-red-950/20' : 'border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20'} p-1`}>
           <div className="bg-card-light dark:bg-card-dark rounded-[2.3rem] p-8">
              
              <div className="flex flex-col md:flex-row justify-between gap-8 items-start">
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-2xl ${!isDecided ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'} shadow-lg`}>
                       <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className={`text-[10px] font-black uppercase tracking-widest ${!isDecided ? 'text-red-600' : 'text-amber-600'}`}>STATUS PENGUNDURAN DIRI</h3>
                      <h2 className="text-xl font-black tracking-tight text-text-light dark:text-text-dark">
                        {!isDecided ? "Konfirmasi Keputusan Akhir Anda" : "Rangkuman Pengajuan Resign"}
                      </h2>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <p className="text-sm text-muted leading-relaxed">
                      Halo <b>{profile?.full_name}</b>,<br/>
                      {!isDecided 
                        ? "Pengajuan pengunduran diri Anda telah disetujui. Silakan konfirmasi keputusan final Anda di bawah ini. Tindakan ini hanya dapat dipilih SATU KALI." 
                        : "Keputusan Anda telah tercatat secara permanen. Sistem akan menghitung mundur penonaktifan akun."}
                    </p>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-border-light dark:border-border-dark mt-4">
                       <p className="text-[10px] font-black uppercase text-muted mb-1">Tanggal Penonaktifan Akun:</p>
                       <p className="font-bold text-text-light dark:text-text-dark text-sm">{formatDateTime(activeResign.suspension_time)}</p>
                    </div>
                  </div>
                </div>

                <div className={`p-6 rounded-3xl ${!isDecided ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'} shadow-xl min-w-[260px] text-center relative overflow-hidden flex-shrink-0 mx-auto md:mx-0`}>
                   <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent opacity-50" />
                   <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-3">Sisa Waktu Aktif</p>
                   <div className="grid grid-cols-4 gap-2 relative z-10">
                      <div className="flex flex-col items-center">
                         <span className="text-2xl font-black leading-none">{String(countdown.d).padStart(2, '0')}</span>
                         <span className="text-[8px] font-bold uppercase mt-1 opacity-70">Hari</span>
                      </div>
                      <div className="flex flex-col items-center">
                         <span className="text-2xl font-black leading-none">{String(countdown.h).padStart(2, '0')}</span>
                         <span className="text-[8px] font-bold uppercase mt-1 opacity-70">Jam</span>
                      </div>
                      <div className="flex flex-col items-center">
                         <span className="text-2xl font-black leading-none">{String(countdown.m).padStart(2, '0')}</span>
                         <span className="text-[8px] font-bold uppercase mt-1 opacity-70">Menit</span>
                      </div>
                      <div className="flex flex-col items-center">
                         <span className="text-2xl font-black leading-none">{String(countdown.s).padStart(2, '0')}</span>
                         <span className="text-[8px] font-bold uppercase mt-1 opacity-70">Detik</span>
                      </div>
                   </div>
                   <div className="mt-4 pt-3 border-t border-white/20">
                      <p className="text-[9px] font-black uppercase tracking-widest">Status Pilihan:</p>
                      <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-[9px] font-black mt-1 backdrop-blur-sm">
                         {!isDecided ? "MENUNGGU KONFIRMASI" : activeResign.employee_decision === 'lanjut_keluar' ? "LANJUT KELUAR" : "LANJUT BEKERJA"}
                      </span>
                   </div>
                </div>
              </div>

              {!isDecided && (
                <div className="mt-8 pt-6 border-t border-dashed border-border-light dark:border-border-dark">
                   <p className="text-xs font-bold text-muted mb-4 text-center md:text-left">Apakah Anda yakin ingin melanjutkan proses pengunduran diri?</p>
                   <div className="flex flex-col sm:flex-row gap-4">
                      <button 
                        disabled={decisionProcessing}
                        onClick={() => handleEmployeeDecision('lanjut_bekerja')}
                        className="flex-1 py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 transition-all"
                      >
                        {decisionProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />} Saya Ingin Lanjut Bekerja
                      </button>
                      <button 
                        disabled={decisionProcessing}
                        onClick={() => handleEmployeeDecision('lanjut_keluar')}
                        className="flex-1 py-4 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 transition-all"
                      >
                        {decisionProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldX className="w-4 h-4" />} Lanjutkan Proses Keluar
                      </button>
                   </div>
                </div>
              )}

              {isDecided && activeResign.employee_decision === 'lanjut_keluar' && (
                 <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 border border-dashed border-border-light dark:border-border-dark rounded-2xl flex items-center gap-3 text-muted">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <span className="text-xs font-bold">Keputusan telah terkunci & dikonfirmasi oleh Anda.</span>
                 </div>
              )}

           </div>
        </div>
      </motion.div>
    );
  };

  const spirited = getSpiritedMessage();

  if (loading || hasOpenShift === null) return <div className="flex justify-center items-center h-screen bg-background-light dark:bg-background-dark"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  
  // Fungsi untuk merender Modal Izin agar bisa dipakai di 2 tempat
  const renderLeaveModal = () => {
    return (
      <BaseModal isOpen={showLeaveModal} onClose={() => setShowLeaveModal(false)} size="md" noPadding={true} showCloseButton={false}>
        <div className="bg-amber-500 p-8 text-white text-center relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="font-black text-2xl uppercase tracking-tight text-white">Formulir Pengajuan</h3>
          <p className="text-white/70 text-xs mt-1">Sakit atau Izin akan diverifikasi oleh Admin</p>
        </div>
        <form onSubmit={handleLeaveRequest} className="p-8 space-y-6">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-2xl">
            <button type="button" onClick={() => { setLeaveType("sakit"); setLeaveDuration("1"); setLeaveDurationUnit("hari"); }} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${leaveType === "sakit" ? "bg-white dark:bg-gray-700 shadow-md text-amber-600" : "text-muted"}`}>Sakit</button>
            <button type="button" onClick={() => { setLeaveType("izin"); setLeaveDuration("1"); setLeaveDurationUnit("hari"); setLeaveNotes(""); }} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${leaveType === "izin" ? "bg-white dark:bg-gray-700 shadow-md text-amber-600" : "text-muted"}`}>Izin</button>
          </div>
 
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="leaveDurationInput" className="text-[10px] font-black uppercase text-muted ml-2">Durasi</label>
              <input 
                id="leaveDurationInput"
                type="number" 
                min="1"
                value={leaveDuration} 
                onChange={(e) => setLeaveDuration(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-amber-500 rounded-2xl outline-none transition-all font-bold text-text-light dark:text-text-dark"
                placeholder="Contoh: 1"
                title="Durasi Izin"
                required
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="leaveUnitSelect" className="text-[10px] font-black uppercase text-muted ml-2">Satuan</label>
              <select 
                id="leaveUnitSelect"
                value={leaveDurationUnit}
                onChange={(e) => setLeaveDurationUnit(e.target.value as any)}
                className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-amber-500 rounded-2xl outline-none transition-all font-bold text-text-light dark:text-text-dark"
                title="Satuan Waktu Izin"
                aria-label="Satuan Waktu Izin"
              >
                <option value="hari">Hari</option>
                <option value="minggu">Minggu</option>
                <option value="bulan">Bulan</option>
              </select>
            </div>
          </div>
 
          <div className="space-y-1">
            <label htmlFor="leaveNotesInput" className="text-[10px] font-black uppercase text-muted ml-2">Keterangan</label>
            <textarea 
              id="leaveNotesInput"
              value={leaveNotes}
              onChange={(e) => setLeaveNotes(e.target.value)}
              className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-800 border-2 border-transparent focus:border-amber-500 rounded-2xl outline-none transition-all text-sm min-h-[80px] text-text-light dark:text-text-dark"
              placeholder="Berikan alasan yang jelas..."
              title="Keterangan Izin"
              required
            />
          </div>
 
          {/* Upload Bukti */}
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase text-muted ml-2">Unggah Bukti (Opsional)</span>
            <div className="relative border-2 border-dashed border-border-light dark:border-border-dark rounded-2xl p-4 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer group">
              <input 
                type="file" 
                accept="image/*,application/pdf"
                onChange={(e) => setLeaveFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Pilih berkas bukti"
              />
              <Upload className="w-6 h-6 text-muted mb-2 group-hover:text-amber-500 transition-all" />
              <p className="text-xs font-bold text-muted text-center leading-normal">
                {leaveFile ? leaveFile.name : "Ketuk untuk memilih foto atau berkas pdf"}
              </p>
              <p className="text-[9px] text-muted/60 mt-1">Maksimal ukuran file: 5MB</p>
            </div>
          </div>
 
          <div className="flex gap-4 pt-2">
            <button type="button" onClick={() => setShowLeaveModal(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-muted rounded-2xl font-black text-xs uppercase">Batal</button>
            <button 
              type="submit"
              disabled={submittingLeave}
              className="flex-[2] py-4 bg-amber-500 text-white rounded-2xl font-black text-xs flex items-center justify-center gap-2 uppercase animate-none"
            >
              {submittingLeave ? <Loader2 className="w-5 h-5 animate-spin" /> : "Kirim Pengajuan"}
            </button>
          </div>
        </form>
      </BaseModal>
    );
  };

  // 1. Tampilan awal jika BELUM Absensi/Buka Shift

  // === TRANSFORMASI VISUAL REAKTIF KONDISIONAL ===
  if (!hasOpenShift) {
    return (
      <div className="max-w-4xl mx-auto min-h-[80vh] flex flex-col items-center justify-center space-y-8 p-6 text-center pt-10 pb-20 relative">
        {/* Background Ambient Glow Effect */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 opacity-30">
           <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full blur-[120px] transition-colors duration-1000 ${
             shiftStatus === 'loading' ? 'bg-gray-500' : 
             shiftStatus === 'future' ? 'bg-blue-500' : 
             shiftStatus === 'now' ? 'bg-emerald-500' : 
             shiftStatus === 'late' ? 'bg-red-500' : 'bg-slate-400'
           }`} />
        </div>

        {renderResignWidget()}
        {spirited && (
          <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`p-6 rounded-3xl text-white shadow-xl flex items-center gap-6 relative overflow-hidden w-full max-w-2xl ${spirited.color}`}>
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-2xl -mr-16 -mt-16" />
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shrink-0 shadow-lg">{spirited.icon}</div>
            <div className="text-left relative z-10">
              <h2 className="text-lg font-black uppercase tracking-tighter">{spirited.title}</h2>
              <p className="text-xs font-medium opacity-90">{spirited.msg}</p>
            </div>
          </motion.div>
        )}

        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-2xl">
           {shiftStatus === 'loading' ? (
              <div className="p-20 flex flex-col items-center"><Loader2 className="w-12 h-12 animate-spin text-primary" /><p className="mt-4 text-muted font-bold tracking-widest text-xs animate-pulse">MENYINKRONKAN JADWAL...</p></div>
           ) : shiftStatus === 'none' ? (
              <div className="bg-card-light dark:bg-card-dark p-12 rounded-[3rem] border-2 border-dashed border-border-light dark:border-border-dark shadow-xl">
                 <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6"><ShieldX className="w-10 h-10 text-muted" /></div>
                 <h2 className="text-2xl font-black text-text-light dark:text-text-dark uppercase tracking-tight">Tidak Ada Jadwal Aktif</h2>
                 <p className="text-muted text-sm mt-3 max-w-md mx-auto">Hari ini Anda tidak memiliki shift yang terdaftar di sistem. Silakan bersantai atau hubungi Admin jika merasa ini adalah kekeliruan.</p>
              </div>
           ) : (
              <div className="space-y-8 w-full">
                  {/* SHIFT CARD HEADER */}
                  <div className="bg-card-light dark:bg-card-dark p-8 rounded-[3rem] shadow-2xl border border-border-light dark:border-border-dark relative overflow-hidden text-left group hover:shadow-primary/10 transition-shadow duration-500">
                     <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-gradient-to-br from-primary/5 to-transparent blur-3xl" />
                     
                     <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative">
                        <div>
                           <p className="text-[10px] font-black tracking-[0.2em] uppercase text-primary mb-1 flex items-center gap-2">
                              <Flame className="w-3.5 h-3.5 animate-pulse" /> INFORMASI SHIFT HARI INI
                           </p>
                           <h3 className="text-2xl font-black text-text-light dark:text-text-dark tracking-tight">{todayShift?.name}</h3>
                        </div>
                        <div className="px-5 py-2.5 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center gap-3 border border-border-light dark:border-border-dark shadow-inner">
                           <Clock className="w-5 h-5 text-muted" />
                           <span className="font-mono text-lg font-black text-text-light dark:text-text-dark tracking-wider">{todayShift?.start_time.slice(0,5)} - {todayShift?.end_time.slice(0,5)}</span>
                        </div>
                     </div>
                     
                     <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                        <div>
                           <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted mb-2.5">Hari Kerja</p>
                           <div className="flex flex-wrap gap-1.5">
                              {["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map(d => {
                                 const isActive = todayShift?.days?.includes(d) || todayShift?.days?.includes(d.slice(0,3));
                                 return (
                                    <span key={d} className={`px-2 py-1 text-[9px] font-black rounded-lg transition-all border ${
                                       isActive 
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/50 shadow-sm' 
                                          : 'bg-gray-50 dark:bg-gray-800/50 text-muted/40 border-transparent'
                                    }`}>
                                       {d.slice(0,3)}
                                    </span>
                                 );
                              })}
                           </div>
                        </div>
                        <div>
                           <p className="text-[9px] font-black uppercase tracking-[0.15em] text-muted mb-2.5">Karyawan Ditugaskan ({assignedTeam.length})</p>
                           <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto no-scrollbar">
                              {assignedTeam.length === 0 ? (
                                 <span className="text-[10px] font-medium italic text-muted opacity-70">Memuat daftar tim...</span>
                              ) : (
                                 assignedTeam.map((m, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-white dark:bg-gray-800/70 px-3 py-1.5 rounded-xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-all cursor-default">
                                       <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                                          {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : <Users className="w-2.5 h-2.5 text-primary" />}
                                       </div>
                                       <span className="text-[10px] font-bold text-text-light dark:text-text-dark whitespace-nowrap">{m.full_name}</span>
                                    </div>
                                 ))
                              )}
                           </div>
                        </div>
                     </div>

                     {/* DYNAMIC STATUS BANNER */}
                     <div className="mt-6 border-t border-border-light dark:border-border-dark pt-6">
                        {!isCompletedToday && (
                          <>
                            {subDetails?.isSubstitute && (
                               <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mb-6 flex items-center gap-6 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-[2rem] p-7 shadow-xl shadow-violet-500/30 border border-violet-400/30 relative overflow-hidden">
                                  <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-pulse" />
                                  <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 shadow-lg border border-white/30 animate-bounce-slow"><Sparkles className="w-8 h-8 text-white" /></div>
                                  <div className="relative z-10">
                                     <h4 className="font-black text-lg leading-tight uppercase tracking-wider mb-1">MISI PENGGANTI AKTIF</h4>
                                     <p className="text-white/90 text-xs font-medium leading-relaxed max-w-lg">
                                        Terima kasih atas kerelaan Anda! Hari ini Anda bertugas sebagai <strong>Karyawan Pengganti</strong> {subDetails.substituteFor ? `menggantikan ${subDetails.substituteFor}` : ""}. Seluruh jam kerja sesi ini akan dihitung full sebagai <strong>Jam Lembur</strong>. Tetap semangat memberikan pelayanan terbaik!
                                     </p>
                                  </div>
                               </motion.div>
                             )}
                            {shiftStatus === 'future' && (
                           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-3xl p-8 text-center">
                              <p className="text-xs font-black text-blue-600 dark:text-blue-400 tracking-widest uppercase mb-4">Shift Belum Dimulai</p>
                              <div className="flex gap-4 items-center">
                                 <div className="flex flex-col"><span className="text-5xl font-black font-mono text-blue-700 dark:text-blue-300 leading-none">{String(shiftCountdown.h).padStart(2,'0')}</span><span className="text-[9px] font-black uppercase text-blue-500 mt-2">Jam</span></div>
                                 <span className="text-3xl font-black text-blue-300 animate-pulse">:</span>
                                 <div className="flex flex-col"><span className="text-5xl font-black font-mono text-blue-700 dark:text-blue-300 leading-none">{String(shiftCountdown.m).padStart(2,'0')}</span><span className="text-[9px] font-black uppercase text-blue-500 mt-2">Menit</span></div>
                                 <span className="text-3xl font-black text-blue-300 animate-pulse">:</span>
                                 <div className="flex flex-col"><span className="text-5xl font-black font-mono text-blue-700 dark:text-blue-300 leading-none">{String(shiftCountdown.s).padStart(2,'0')}</span><span className="text-[9px] font-black uppercase text-blue-500 mt-2">Detik</span></div>
                              </div>
                              <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-5 font-medium italic">Harap bersiap, tombol absensi akan aktif tepat saat jam masuk tiba.</p>
                           </motion.div>
                        )}

                        {shiftStatus === 'now' && (
                           <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="flex items-center gap-6 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-3xl p-6 shadow-lg shadow-emerald-500/20">
                              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0"><ShieldCheck className="w-7 h-7 animate-bounce" /></div>
                              <div>
                                 <h4 className="font-black text-lg leading-tight uppercase tracking-tight">Tugas Siap Dimulai!</h4>
                                 <p className="text-white/80 text-xs mt-1 font-medium">Anda berada dalam jendela waktu yang tepat. Silakan absen masuk sekarang.</p>
                              </div>
                           </motion.div>
                        )}

                        {shiftStatus === 'late' && (
                           <motion.div 
                             animate={{ boxShadow: ["0 0 0 rgba(239,68,68,0)", "0 0 20px rgba(239,68,68,0.3)", "0 0 0 rgba(239,68,68,0)"] }}
                             transition={{ repeat: Infinity, duration: 2 }}
                             className="flex items-center gap-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-3xl p-6"
                           >
                              <div className="w-14 h-14 bg-red-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-red-500/30 animate-pulse"><AlertCircle className="w-7 h-7" /></div>
                              <div>
                                 <h4 className="font-black text-lg leading-tight text-red-600 dark:text-red-400 uppercase">PERHATIAN: ANDA TERLAMBAT!</h4>
                                 <p className="text-sm font-bold text-red-500/80 mt-0.5">Keterlambatan: <span className="underline decoration-double">{lateMinutes} Menit</span>.</p>
                                 <p className="text-[10px] text-red-500/60 mt-1.5 font-medium italic leading-snug">Pemotongan gaji otomatis mungkin diberlakukan sesuai kebijakan resto.</p>
                              </div>
                           </motion.div>
                        )}
                           </>
                        )}
                     </div>
                  </div>

                  {/* ACTION BUTTONS GRID */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {latestAttendance?.status === 'approved' && ['izin', 'sakit'].includes(latestAttendance?.type) ? (
                        <div className="col-span-full p-8 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-500/30 rounded-[2.5rem] text-center">
                           <p className="font-black text-emerald-700 dark:text-emerald-400">Masa Izin Aktif Disetujui Admin</p>
                        </div>
                      ) : isCompletedToday ? (
                        <motion.div 
                          initial={{ scale: 0.95, opacity: 0 }} 
                          animate={{ scale: 1, opacity: 1 }} 
                          className="col-span-full p-10 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-[3rem] text-center shadow-2xl shadow-emerald-500/30 relative overflow-hidden"
                        >
                           <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
                           <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-xl border border-white/30 animate-bounce-slow">
                              <Sparkles className="w-10 h-10 text-white" />
                           </div>
                           <h3 className="text-2xl font-black uppercase tracking-tight mb-3"> Shift Selesai Bertugas!</h3>
                           <p className="text-emerald-50 font-medium max-w-md mx-auto text-sm leading-relaxed mb-6">
                              Laporan kerja dan data keuangan Anda telah berhasil tersimpan secara aman di sistem. Terima kasih atas kontribusi luar biasa Anda hari ini!
                           </p>
                           <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700/30 backdrop-blur-sm rounded-2xl border border-emerald-400/30 font-black text-xs uppercase tracking-widest">
                              Sampai Jumpa Besok 
                           </div>
                        </motion.div>
                      ) : (
                        <>
                           <motion.button 
                              whileHover={shiftStatus === 'future' ? {} : { scale: 1.02 }}
                              onClick={() => setShowAttendanceModal(true)}
                              disabled={shiftStatus === 'future' || latestAttendance?.status === 'pending'}
                              className={`group p-8 rounded-[2.5rem] flex flex-col items-center text-left gap-4 transition-all duration-500 relative overflow-hidden ${
                                 shiftStatus === 'future' 
                                    ? 'bg-gray-100 dark:bg-gray-800 text-muted border border-dashed border-border-light dark:border-border-dark cursor-not-allowed' 
                                    : shiftStatus === 'late'
                                       ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-2xl'
                                       : 'bg-primary text-white shadow-2xl shadow-primary/30 hover:bg-primary-hover'
                              }`}
                           >
                              {shiftStatus !== 'future' && <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />}
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform ${
                                 shiftStatus === 'future' ? 'bg-gray-200 dark:bg-gray-700' : 'bg-white/20 backdrop-blur-md group-hover:scale-110'
                              }`}>
                                 {shiftStatus === 'future' ? <Clock className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                              </div>
                              <div className="w-full">
                                 <h3 className="text-lg font-black uppercase leading-tight">Absensi Masuk</h3>
                                 <p className={`text-xs mt-1 font-medium ${shiftStatus === 'future' ? 'text-muted' : 'opacity-70'}`}>
                                    {shiftStatus === 'future' ? 'Menunggu Waktu...' : 'Klik untuk buka shift'}
                                 </p>
                              </div>
                           </motion.button>

                           <motion.button 
                              whileHover={{ scale: 1.02 }}
                              onClick={() => setShowLeaveModal(true)}
                              disabled={latestAttendance?.status === 'pending'}
                              className="group p-8 bg-white dark:bg-card-dark border-2 border-amber-500/20 text-amber-600 dark:text-amber-500 rounded-[2.5rem] shadow-xl flex flex-col items-center text-left gap-4 transition-all"
                           >
                              <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform"><AlertCircle className="w-6 h-6" /></div>
                              <div className="w-full">
                                 <h3 className="text-lg font-black uppercase leading-tight">Izin / Sakit</h3>
                                 <p className="text-amber-600/60 dark:text-amber-500/60 text-xs mt-1 font-medium">Jika berhalangan kerja hari ini</p>
                              </div>
                           </motion.button>
                        </>
                      )}
                  </div>
              </div>
           )}
        </motion.div>

        {/* Status Alerts (Pending/Rejected) */}
        {latestAttendance?.status === 'pending' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 p-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl w-full max-w-md">
             <div className="w-10 h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shrink-0 animate-bounce"><Clock className="w-5 h-5" /></div>
             <div className="text-left"><h4 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase">Menunggu Konfirmasi</h4><p className="text-[10px] text-amber-600/70 italic">Admin sedang meninjau pengajuan Anda.</p></div>
          </motion.div>
        )}

        {latestAttendance?.status === 'rejected' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 p-5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl w-full max-w-md">
             <div className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center shrink-0"><AlertCircle className="w-5 h-5" /></div>
             <div className="text-left"><h4 className="text-xs font-black text-red-600 uppercase">Pengajuan Ditolak</h4><p className="text-[10px] text-red-500/70 font-medium">Silakan absen untuk segera mulai bekerja.</p></div>
          </motion.div>
        )}

        <AnimatePresence>
          {showAttendanceModal && (
            <AttendanceModal 
              substituteDetails={subDetails}
              workShiftId={todayShift?.id}
              onSuccess={() => {
                setShowAttendanceModal(false);
                checkShift();
                fetchDashboardData();
              }} 
            />
          )}
        </AnimatePresence>
        {renderLeaveModal()}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Modal Izin/Sakit */}
      <AnimatePresence>
        {renderLeaveModal()}
      </AnimatePresence>

      {renderResignWidget()}


      {/* Spirited Welcome Banner */}
      {spirited && (
        <motion.div 
          initial={{ y: -20, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }}
          className={`p-6 rounded-[2.5rem] text-white shadow-2xl flex items-center gap-6 relative overflow-hidden group mb-8 ${spirited.color}`}
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24" />
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
            {spirited.icon}
          </div>
          <div className="relative z-10">
            <h2 className="text-lg font-black uppercase tracking-tighter mb-1">{spirited.title}</h2>
            <p className="text-xs font-medium opacity-90 leading-relaxed">{spirited.msg}</p>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">Dashboard Kasir</h1>
          <p className="text-muted mt-1">Ringkasan aktivitas dan transaksi hari ini.</p>
        </div>
        {openShiftData ? (
          <div className="flex items-center gap-3 shrink-0">
            <div className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-xs font-black flex items-center gap-3 border border-green-500/20 whitespace-nowrap shrink-0">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
              <span className="font-mono text-sm tracking-wider whitespace-nowrap shrink-0">{shiftTimer}</span>
              <span className="opacity-50">|</span>
              <span className="whitespace-nowrap">SHIFT AKTIF</span>
            </div>

            <button 
              onClick={() => setShowCloseModal(true)}
              className="px-4 py-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-full text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <LogOut className="w-4 h-4 shrink-0" /> <span className="whitespace-nowrap">Tutup Shift</span>
            </button>
          </div>
        ) : profile?.role === "admin" ? (
          <div className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-xs font-black flex items-center gap-3 border border-indigo-500/20 whitespace-nowrap shrink-0">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shrink-0" />
            <span className="font-mono text-sm tracking-wider whitespace-nowrap shrink-0">{shiftTimer}</span>
            <span className="opacity-50">|</span>
            <span className="whitespace-nowrap">MODE ADMIN</span>
          </div>
        ) : hasOpenShift ? (
          <div className="flex items-center gap-3 shrink-0">
            <div className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-xs font-black flex items-center gap-3 border border-emerald-500/20 whitespace-nowrap shrink-0">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
              <span className="font-mono text-sm tracking-wider whitespace-nowrap shrink-0">{shiftTimer}</span>
              <span className="opacity-50">|</span>
              <span className="whitespace-nowrap">SHIFT AKTIF</span>
            </div>
            <button 
              onClick={() => setShowCloseModal(true)}
              className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-full text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
              title="Tutup sesi ini secara manual melalui layar perhitungan"
            >
              <LogOut className="w-4 h-4 shrink-0" /> <span className="whitespace-nowrap">Tutup Shift</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Close Shift Modal */}
      {(() => {
         // SISTEM FALLBACK ANTI-CRASH (Disaster Recovery Helper)
         const effectiveStartTime = openShiftData?.start_time || latestAttendance?.created_at || new Date().toISOString();
         const effectiveInitialCash = Number(openShiftData?.initial_cash || 0);

         return (
           <BaseModal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} size="md" noPadding={true} showCloseButton={false}>
             <div className="bg-secondary p-6 text-white text-center relative">
               <h3 className="font-black text-xl text-white">Tutup Shift Kasir</h3>
               <p className="text-white/70 text-xs mt-1">Hitung uang laci dan setoran akhir</p>
             </div>
             <div className="p-8 space-y-6">
               <div className="space-y-4 text-text-light dark:text-text-dark">
                 <div className="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-border-light dark:border-border-dark">
                   <div className="flex justify-between text-xs">
                     <span className="text-muted font-bold uppercase tracking-widest">Mulai Shift</span>
                     <span className="font-black text-primary">{format(new Date(effectiveStartTime), 'HH:mm:ss')} WIB</span>
                   </div>
                   <div className="flex justify-between text-xs">
                     <span className="text-muted font-bold uppercase tracking-widest">Selesai Shift</span>
                     <span className="font-black text-secondary">{format(new Date(), 'HH:mm:ss')} WIB</span>
                   </div>
                   
                   {/* Tampilkan Durasi Lembur Real-Time Jika Ada */}
                   {(() => {
                     const nowT = new Date();
                     let isOvertime = false;
                     let diff = 0;
                     let titleLabel = "Waktu Lembur";

                     if (subDetails?.isSubstitute) {
                        // KHUSUS PENGGANTI: Lembur dihitung sejak menit ke-1 absensi!
                        isOvertime = true;
                        diff = nowT.getTime() - new Date(effectiveStartTime).getTime();
                        titleLabel = "Lembur Penuh (Pengganti)";
                     } else if (todayShift?.end_time) {
                        // KARYAWAN NORMAL: Lembur dihitung setelah jam shift berakhir
                        const [h, m] = todayShift.end_time.split(':').map(Number);
                        const targetEnd = new Date(nowT);
                        targetEnd.setHours(h, m, 0, 0);
                        if (nowT.getTime() - targetEnd.getTime() > 12 * 60 * 60 * 1000) targetEnd.setDate(targetEnd.getDate() + 1);
                        
                        diff = nowT.getTime() - targetEnd.getTime();
                        isOvertime = diff > 0;
                     }

                     if (!isOvertime || diff <= 0) return null;

                     const oh = Math.floor(diff / 3600000);
                     const om = Math.floor((diff % 3600000) / 60000);
                     return (
                       <div className="flex flex-col gap-1 bg-gradient-to-r from-red-500/10 to-orange-500/10 dark:from-red-900/30 dark:to-orange-900/30 p-3 rounded-xl border border-red-200 dark:border-red-900/50 animate-pulse">
                         <span className="text-[9px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 flex items-center gap-1.5">
                            <Flame className="w-3 h-3 animate-bounce" /> {titleLabel}
                         </span>
                         <div className="flex justify-between items-baseline">
                           <span className="text-xs font-bold text-muted">Total Akumulasi</span>
                           <span className="font-black text-lg text-red-600 dark:text-red-400">{oh} jam {om} menit</span>
                         </div>
                       </div>
                     );
                   })()}

                   <div className="h-px bg-border-light dark:bg-border-dark my-1" />
                   <div className="flex justify-between text-xs">
                     <span className="text-muted font-bold uppercase tracking-widest">Durasi Kerja</span>
                     <span className="font-black">
                       {(() => {
                         const timeDiff = new Date().getTime() - new Date(effectiveStartTime).getTime();
                         const h = Math.floor(timeDiff / 3600000);
                         const m = Math.floor((timeDiff % 3600000) / 60000);
                         return `${h} jam ${m} menit`;
                       })()}
                     </span>
                   </div>
                 </div>
                 <div className="flex justify-between text-sm">
                   <span className="text-muted font-bold uppercase text-[10px]">Modal Awal</span>
                   <span className="font-bold">Rp {effectiveInitialCash.toLocaleString('id-ID')}</span>
                 </div>
               </div>

               <div className="space-y-3">
                   <label className="text-[10px] font-black uppercase text-muted">Uang Fisik di Laci</label>
                   <div className="relative">
                     <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-primary">Rp</span>
                     <input 
                       type="number" 
                       value={actualCash}
                       onChange={(e) => setActualCash(e.target.value)}
                       placeholder="Contoh: 500000"
                       className="w-full pl-12 pr-4 py-4 bg-primary/5 dark:bg-primary/10 border-2 border-primary/20 rounded-2xl outline-none focus:border-primary font-black text-2xl transition-all text-text-light dark:text-text-dark"
                     />
                   </div>

                   {actualCash && (
                     <div className={`p-4 rounded-2xl border-2 flex justify-between items-center transition-all ${
                       Number(actualCash) - effectiveInitialCash >= 0 
                         ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-900/30' 
                         : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-900/30'
                     }`}>
                       <div className="flex flex-col">
                         <span className="text-[10px] font-black uppercase opacity-70">Selisih Uang</span>
                         <span className="text-xs font-bold">
                           {Number(actualCash) - effectiveInitialCash >= 0 ? 'Kelebihan (Plus)' : 'Kekurangan (Minus)'}
                         </span>
                       </div>
                       <span className="font-black text-2xl">
                         {Number(actualCash) - effectiveInitialCash >= 0 ? '+' : ''}
                         {(Number(actualCash) - effectiveInitialCash).toLocaleString('id-ID')}
                       </span>
                     </div>
                   )}
                 </div>

               <div className="flex gap-3">
                 <button onClick={() => setShowCloseModal(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-muted rounded-xl font-bold text-xs uppercase">Batal</button>
                 <button 
                   onClick={openShiftData ? handleCloseShift : handleEmergencyCheckout}
                   disabled={closing}
                   className="flex-2 py-3 bg-secondary hover:bg-secondary-hover text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg text-xs uppercase animate-none"
                 >
                   {closing ? <Loader2 className="w-5 h-5 animate-spin" /> : openShiftData ? "Tutup & Simpan Shift" : "Tutup Sesi Darurat"}
                 </button>
               </div>
             </div>
           </BaseModal>
         );
      })()}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div whileHover={{ y: -4 }} className="bg-card-light dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-border-light dark:border-border-dark flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-muted mb-1">Total Pesanan</p>
            <h3 className="text-2xl font-bold text-text-light dark:text-text-dark">{stats.totalOrders}</h3>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} className="bg-card-light dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-border-light dark:border-border-dark flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 flex items-center justify-center shrink-0">
            <Clock className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-muted mb-1">Pesanan Menunggu</p>
            <h3 className="text-2xl font-bold text-text-light dark:text-text-dark">{stats.pendingOrders}</h3>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} className="bg-card-light dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-border-light dark:border-border-dark flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-muted mb-1">Pesanan Selesai</p>
            <h3 className="text-2xl font-bold text-text-light dark:text-text-dark">{stats.completedOrders}</h3>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} className="bg-card-light dark:bg-card-dark p-6 rounded-2xl shadow-sm border border-border-light dark:border-border-dark flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <DollarSign className="w-7 h-7" />
          </div>
          <div>
            <p className="text-sm text-muted mb-1">Pendapatan</p>
            <h3 className="text-2xl font-bold text-text-light dark:text-text-dark">Rp {(stats.revenue/1000).toFixed(0)}k</h3>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-2xl shadow-lg text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-white/80 mb-1 uppercase font-bold tracking-wider">Metode Terfavorit</p>
            <h3 className="text-xl font-black">{advancedStats.topPaymentMethod}</h3>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-orange-400 to-red-500 p-6 rounded-2xl shadow-lg text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-white/80 mb-1 uppercase font-bold tracking-wider">Rasio Pesanan</p>
            <div className="flex items-center gap-2 text-xs sm:text-sm font-bold flex-wrap">
              <span>{advancedStats.dineInPercent}% Dine In</span>
              <span className="opacity-50">|</span>
              <span>{advancedStats.takeawayPercent}% Takeaway</span>
              <span className="opacity-50">|</span>
              <span>{advancedStats.deliveryPercent}% Delivery</span>
            </div>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-emerald-400 to-teal-500 p-6 rounded-2xl shadow-lg text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-white/80 mb-1 uppercase font-bold tracking-wider">Meja Teraktif</p>
            <h3 className="text-xl font-black">{advancedStats.activeTable}</h3>
          </div>
        </motion.div>

        <motion.div whileHover={{ y: -4 }} className="bg-gradient-to-br from-rose-400 to-pink-500 p-6 rounded-2xl shadow-lg text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-white/80 mb-1 uppercase font-bold tracking-wider">Menu Terlaris</p>
            <h3 className="text-xl font-black truncate max-w-[140px]" title={advancedStats.topItem}>{advancedStats.topItem}</h3>
          </div>
        </motion.div>
      </div>

      <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-6 mt-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-text-light dark:text-text-dark flex items-center gap-2">
            Status Meja Terkini
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {tables.map((t) => (
            <div key={t.id} className={`p-4 rounded-xl flex flex-col items-center justify-center text-center border-2 transition-all ${
              t.status === "available" ? "bg-green-50 border-green-200 text-green-700" :
              t.status === "occupied" ? "bg-red-50 border-red-200 text-red-700" :
              "bg-yellow-50 border-yellow-200 text-yellow-700"
            }`}>
              <span className="font-black text-2xl">{t.table_number}</span>
              <span className="text-[10px] font-bold uppercase mt-1">{t.status === "available" ? "Tersedia" : t.status === "occupied" ? "Terisi" : "Dipesan"}</span>
            </div>
          ))}
          {tables.length === 0 && <p className="col-span-full text-muted text-center py-4">Memuat data meja...</p>}
        </div>
      </div>

      <div className="bg-card-light dark:bg-card-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-6 mt-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-text-light dark:text-text-dark flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Pesanan Terbaru
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border-light dark:border-border-dark text-muted text-sm">
                <th className="pb-3 pr-4 font-medium whitespace-nowrap">No. Pesanan</th>
                <th className="pb-3 px-4 font-medium whitespace-nowrap">Waktu</th>
                <th className="pb-3 px-4 font-medium whitespace-nowrap">Tipe</th>
                <th className="pb-3 px-4 font-medium whitespace-nowrap">Total</th>
                <th className="pb-3 pl-4 font-medium whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">Belum ada pesanan hari ini.</td>
                </tr>
              ) : (
                recentOrders.map(order => (
                  <tr key={order.id} className="border-b border-border-light dark:border-border-dark last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-4 pr-4 font-medium text-text-light dark:text-text-dark whitespace-nowrap">#{order.id.split('-')[0]}</td>
                    <td className="py-4 px-4 text-sm text-muted whitespace-nowrap">{format(new Date(order.created_at), 'HH:mm')}</td>
                    <td className="py-4 px-4 text-sm text-text-light dark:text-text-dark capitalize whitespace-nowrap">{order.order_type.replace('_', ' ')}</td>
                    <td className="py-4 px-4 font-bold text-text-light dark:text-text-dark whitespace-nowrap">Rp {order.total_amount.toLocaleString('id-ID')}</td>
                    <td className="py-4 pl-4 whitespace-nowrap">
                      <span className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-md whitespace-nowrap inline-block ${
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'completed' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
