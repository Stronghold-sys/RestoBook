"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Menu as MenuIcon, X, LogOut, Sun, Moon, 
  LayoutDashboard, ShoppingBag, ListOrdered, ClipboardList, 
  CalendarDays, Heart, Bell, User as UserIcon, Users, 
  Settings, Layers, UtensilsCrossed, Star, Receipt, Clock, ShoppingCart, Armchair, RotateCcw, Lock, ShieldAlert, TrendingUp, Zap, Power
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useThemeStore } from "@/store/useThemeStore";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { isRestaurantOpen, getStoreStatus, getMinutesUntilClose } from "@/utils/operationalHours";

type Role = "customer" | "cashier" | "admin";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: Role;
}

const getMenuLinks = (role: Role) => {
  switch (role) {
    case "admin":
      return [
        { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
        { name: "Kategori", href: "/admin/categories", icon: Layers },
        { name: "Menu Makanan", href: "/admin/menu", icon: UtensilsCrossed },
        { name: "Log Stok Menu", href: "/admin/menu-logs", icon: ClipboardList },
        { name: "Meja", href: "/admin/tables", icon: ClipboardList },
        { name: "Pesanan", href: "/admin/orders", icon: ShoppingBag },
        { name: "Reservasi", href: "/admin/reservations", icon: CalendarDays },
        { name: "Laporan", href: "/admin/transactions", icon: Receipt },
        { name: "Kelola Refund", href: "/admin/refunds", icon: RotateCcw },
        { name: "Absensi & Shift", href: "/admin/attendance", icon: Clock },
        { name: "Manajemen Gaji", href: "/admin/payroll", icon: Receipt },
        { name: "Karyawan", href: "/admin/users", icon: Users },
        { name: "Resign & Pemecatan", href: "/admin/resign", icon: ShieldAlert },
        { name: "Pelanggan", href: "/admin/customers", icon: Users },
        { name: "Ulasan", href: "/admin/reviews", icon: Star },
        { name: "Pengaturan", href: "/admin/settings", icon: Settings },
        { name: "Profil", href: "/admin/profile", icon: UserIcon },
      ];
    case "cashier":
      return [
        { name: "Dashboard", href: "/cashier/dashboard", icon: LayoutDashboard },
        { name: "POS Kasir", href: "/cashier/pos", icon: ShoppingCart },
        { name: "Status Menu", href: "/cashier/menu", icon: UtensilsCrossed },
        { name: "Status Meja", href: "/cashier/tables", icon: Armchair },
        { name: "Pesanan", href: "/cashier/orders", icon: ShoppingBag },
        { name: "Pesanan Online", href: "/cashier/online-orders", icon: Globe },
        { name: "Antrian Dapur", href: "/cashier/queue", icon: ListOrdered },
        { name: "Reservasi", href: "/cashier/reservations", icon: CalendarDays },
        { name: "Transaksi", href: "/cashier/transactions", icon: Receipt },
        { name: "Absensi & Shift", href: "/cashier/attendance", icon: Clock },
        { name: "Profil", href: "/cashier/profile", icon: UserIcon },
      ];
    case "customer":
    default:
      return [
        { name: "Ringkasan", href: "/customer/dashboard", icon: LayoutDashboard },
        { name: "Eksplor Menu", href: "/customer/menu", icon: UtensilsCrossed },
        { name: "Keranjang", href: "/customer/cart", icon: ShoppingBag },
        { name: "Pesanan Saya", href: "/customer/orders", icon: ListOrdered },
        { name: "Reservasi Meja", href: "/customer/reservations", icon: CalendarDays },
        { name: "Menu Favorit", href: "/customer/favorites", icon: Heart },
        { name: "Notifikasi", href: "/customer/notifications", icon: Bell },
        { name: "Profil", href: "/customer/profile", icon: UserIcon },
      ];
  }
};

export default function DashboardLayout({ children, role }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { isDark, toggleTheme, initTheme } = useThemeStore();
  const supabase = createClient();
  const [hasOpenShift, setHasOpenShift] = useState(true);
  const [activeShiftEndTime, setActiveShiftEndTime] = useState<string | null>(null);
  const [isShiftExpired, setIsShiftExpired] = useState(false);

  // Real-time Operational Settings States
  const [openingTime, setOpeningTime] = useState<string | null>(null);
  const [closingTime, setClosingTime] = useState<string | null>(null);
  const [isTemporaryClosed, setIsTemporaryClosed] = useState<boolean>(false);
  const [isHoliday, setIsHoliday] = useState<boolean>(false);
  const [holidayReopenDate, setHolidayReopenDate] = useState<string>("");
  const [temporaryClosedReopenTime, setTemporaryClosedReopenTime] = useState<string>("");
  const [is24Hours, setIs24Hours] = useState<boolean>(false);
  const [closeWarningMinutes, setCloseWarningMinutes] = useState<number>(10);
  const [customerWarningMinutes, setCustomerWarningMinutes] = useState<number>(15);
  const [shiftClosingBufferMinutes, setShiftClosingBufferMinutes] = useState<number>(30);
  const [isAutoCloseShiftEnabled, setIsAutoCloseShiftEnabled] = useState<boolean>(true);
  const [remainingShiftSeconds, setRemainingShiftSeconds] = useState<number>(0);
  const [minutesUntilClose, setMinutesUntilClose] = useState<number>(999);
  const [storeOpen, setStoreOpen] = useState<boolean>(true);
  const [bannerMessage, setBannerMessage] = useState<string>("");
  const [statusType, setStatusType] = useState<string>("open");
  const [isOvertimeMode, setIsOvertimeMode] = useState<boolean>(false);
  const [overtimeDurationSeconds, setOvertimeDurationSeconds] = useState<number>(0);

  const getRemainingShiftSeconds = (closingStr: string | null, bufferMins: number) => {
    if (!closingStr) return 0;
    const now = new Date();
    
    const [closeHours, closeMinutes] = closingStr.split(":").map(Number);
    if (isNaN(closeHours) || isNaN(closeMinutes)) return 0;

    const closingDate = new Date();
    closingDate.setHours(closeHours, closeMinutes, 0, 0);

    let diffMs = closingDate.getTime() + (bufferMins * 60 * 1000) - now.getTime();
    
    if (diffMs < -12 * 3600 * 1000) {
      diffMs += 24 * 3600 * 1000;
    } else if (diffMs > 12 * 3600 * 1000) {
      diffMs -= 24 * 3600 * 1000;
    }

    return Math.max(0, Math.floor(diffMs / 1000));
  };

  // Warnings & auto-close popup states
  const [hasShownCloseAlert, setHasShownCloseAlert] = useState<boolean>(false);
  const [showCloseWarningModal, setShowCloseWarningModal] = useState<boolean>(false);
  const [showAutoShiftEndModal, setShowAutoShiftEndModal] = useState<boolean>(false);
  const [autoShiftTime, setAutoShiftTime] = useState<string>("");



  const handleStartOvertime = () => {
    let startTimeStamp = Date.now();

    //  CONTINUITY ENGINE: Jika shift sudah lewat, setel awal waktu lembur 
    // mundur ke detik persis saat shift berakhir agar hitungan berlanjut sempurna!
    if (activeShiftEndTime) {
       const nowT = new Date();
       const [h, m] = activeShiftEndTime.split(':').map(Number);
       const target = new Date(nowT);
       target.setHours(h, m, 0, 0);

       // Midnight cross fix
       if (nowT.getTime() - target.getTime() > 12 * 60 * 60 * 1000) {
         target.setDate(target.getDate() + 1);
       }

       // Jika shift sudah berakhir di masa lampau, gunakan masa lampau tersebut sebagai START!
       if (nowT.getTime() > target.getTime()) {
          startTimeStamp = target.getTime();
       }
    }

    localStorage.setItem("overtime_start_timestamp", String(startTimeStamp));
    setIsOvertimeMode(true);
    setRemainingShiftSeconds(0);
    localStorage.removeItem("shift_end_target_timestamp");
    toast.success("Mode Lembur Aktif! Hitungan dilanjutkan dari waktu berakhirnya shift.");
  };

  const handleEndOvertimeAndShift = async () => {
    try {
      const otStart = localStorage.getItem("overtime_start_timestamp");
      const finalSecs = overtimeDurationSeconds;
      localStorage.removeItem("overtime_start_timestamp");
      setIsOvertimeMode(false);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data: shift } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle();
        
      if (shift) {
         // ENCODE SECURE OVERTIME JSON METADATA IN EXISTING NOTES FIELD
         await supabase.from('attendance').insert({
           user_id: user.id,
           profile_id: shift.profile_id,
           type: 'check_out',
           status: 'completed',
           notes: `OVERTIME_LOG:${JSON.stringify({ seconds: finalSecs, date: new Date().toISOString() })}`
         });
      }

      toast.loading("Menutup lembur dan shift...", { duration: 1500 });
      await handleAutoCloseShiftInDb();
      toast.success(`Lembur Berhasil Diakhiri! (${String(Math.floor(finalSecs / 3600)).padStart(2, "0")}:${String(Math.floor((finalSecs % 3600) / 60)).padStart(2, "0")})`);
      window.location.reload(); // Refresh page to clear open shifts state locally completely
    } catch (e: any) {
      toast.error("Gagal menyimpan data lembur.");
    }
  };

  const handleAutoCloseShiftInDb = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: shift } = await supabase
        .from('shifts')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .maybeSingle();

      if (shift) {
        const { data: orders } = await supabase
          .from('orders')
          .select('total_amount')
          .eq('payment_status', 'paid')
          .gte('created_at', shift.start_time);

        const systemRevenue = orders?.reduce((sum, o) => sum + o.total_amount, 0) || 0;
        const initial = Number(shift.initial_cash);
        const expectedCash = initial + systemRevenue;

        await supabase
          .from('shifts')
          .update({
            end_time: new Date().toISOString(),
            final_cash_system: systemRevenue,
            final_cash_actual: expectedCash,
            difference: 0,
            status: 'closed'
          })
          .eq('id', shift.id);

        setHasOpenShift(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (role !== "cashier") return;

    const checkShiftStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Gunakan API Sakti /api/cashier/lock-status agar tidak terhalang batasan database (RLS)
        const res = await fetch(`/api/cashier/lock-status?userId=${user.id}&t=${Date.now()}`, {
          cache: 'no-store'
        });
        const resData = await res.json();
        
        setHasOpenShift(!!resData.hasOpenShift);
        setActiveShiftEndTime(resData.endTime || null);
      } catch (e) {
        console.error("Layout Check Failed:", e);
        setHasOpenShift(false); 
        setActiveShiftEndTime(null);
      }
    };

    checkShiftStatus();

    const channel = supabase.channel('sidebar-shifts-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, () => {
        checkShiftStatus();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        checkShiftStatus();
      })
      .subscribe();

    // ️‍️ RADAR NINJA LAYOUT (Silent Sync Controller):
    // Memaksa Sidebar mengintip data server setiap 3 detik secara senyap 
    // demi menjamin real-time 100% meskipun Web Socket database sedang mati.
    const layoutPulse = setInterval(() => {
      checkShiftStatus();
    }, 3000); 

    return () => {
      supabase.removeChannel(channel);
      clearInterval(layoutPulse);
    };
  }, [role, pathname]);

  // Enterprise Security Sync: Real-time Suspension Kick & Auto-Locking
  useEffect(() => {
    let securityInterval: NodeJS.Timeout;

    const setupSecuritySync = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. LISTEN TO REAL-TIME PROFILE UPDATES FOR INSTANT FORCED KICK
      const profileChan = supabase.channel(`security-sync-${user.id}`)
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles',
          filter: `user_id=eq.${user.id}` 
        }, (payload) => {
          if (payload.new.status_karyawan && payload.new.status_karyawan !== 'aktif') {
            supabase.auth.signOut().then(() => {
                window.location.href = `/login?suspended=${payload.new.status_karyawan}&pid=${payload.new.id}`;
            });
          }
        })
        .subscribe();

      // 2. REDUNDANCY WATCHER: POLL FOR AUTO-SUSPENSION EXPIRY
      const checkExpiration = async () => {
        try {
          const { data: prof } = await supabase.from('profiles').select('id, role, status_karyawan').eq('user_id', user.id).single();
          if (!prof || prof.role === 'admin' || prof.status_karyawan !== 'aktif') return;

          const { data: activeResign } = await supabase
            .from('resign_requests')
            .select('id, suspension_time, employee_decision')
            .eq('profile_id', prof.id)
            .eq('status', 'Disetujui')
            .maybeSingle();

          if (activeResign?.suspension_time && activeResign?.employee_decision !== 'lanjut_bekerja') {
            const now = new Date().getTime();
            const deadline = new Date(activeResign.suspension_time).getTime();
            
            if (now >= deadline) {
              // TIME EXPIRED! Automatically fire the API backend to mark resigned and send goodbye WA
              await fetch("/api/admin/resign-action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "mark_out", profileId: prof.id })
              });
              
              // Instant kick locally
              supabase.auth.signOut().then(() => {
                 window.location.href = `/login?suspended=resign_expired&pid=${prof.id}`;
              });
            }
          }
        } catch (e) { /* silent fail for layout background */ }
      };

      checkExpiration();
      securityInterval = setInterval(checkExpiration, 30000); // Verify every 30s
      return profileChan;
    };

    const secPromise = setupSecuritySync();

    return () => {
      secPromise.then(ch => ch && supabase.removeChannel(ch));
      if (securityInterval) clearInterval(securityInterval);
    };
  }, []);

  useEffect(() => {
    initTheme();

    // Real-time Notifications Global Listener
    const setupNotifications = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const channel = supabase.channel(`global-notifications-${session.user.id}`)
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}` 
        }, (payload) => {
          toast((t) => (
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-full text-primary shrink-0"><Bell className="w-4 h-4" /></div>
              <div>
                <p className="font-bold text-[10px] uppercase text-primary">Notifikasi Baru</p>
                <p className="font-bold text-xs text-text-light dark:text-text-dark">{payload.new.title}</p>
                <p className="text-[10px] text-muted line-clamp-1">{payload.new.message}</p>
              </div>
            </div>
          ), { duration: 5000, position: 'top-right' });
        })
        .subscribe();

      return channel;
    };

    const notifPromise = setupNotifications();
    return () => { notifPromise.then(ch => ch && supabase.removeChannel(ch)); };
  }, [initTheme]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase.from("restaurant_settings").select("*").single();
        if (data) {
          setOpeningTime(data.opening_time);
          setClosingTime(data.closing_time);
          setIsTemporaryClosed(!!data.is_temporary_closed);
          setIsHoliday(!!data.is_holiday);
          setHolidayReopenDate(data.holiday_reopen_date || "Besok");
          setTemporaryClosedReopenTime(data.temporary_closed_reopen_time || "12:00");
          setIs24Hours(!!data.is_24_hours);
          setCloseWarningMinutes(data.close_warning_minutes !== null && data.close_warning_minutes !== undefined ? Number(data.close_warning_minutes) : 10);
          setCustomerWarningMinutes(data.customer_warning_minutes !== null && data.customer_warning_minutes !== undefined ? Number(data.customer_warning_minutes) : 15);
          setShiftClosingBufferMinutes(data.shift_closing_buffer_minutes !== null && data.shift_closing_buffer_minutes !== undefined ? Number(data.shift_closing_buffer_minutes) : 30);
          setIsAutoCloseShiftEnabled(data.is_auto_close_shift_enabled !== undefined && data.is_auto_close_shift_enabled !== null ? !!data.is_auto_close_shift_enabled : true);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchSettings();

    const channel = supabase.channel("dashboard_settings_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_settings" }, (payload: any) => {
        if (payload.new) {
          setOpeningTime(payload.new.opening_time);
          setClosingTime(payload.new.closing_time);
          setIsTemporaryClosed(!!payload.new.is_temporary_closed);
          setIsHoliday(!!payload.new.is_holiday);
          setHolidayReopenDate(payload.new.holiday_reopen_date || "Besok");
          setTemporaryClosedReopenTime(payload.new.temporary_closed_reopen_time || "12:00");
          setIs24Hours(!!payload.new.is_24_hours);
          setCloseWarningMinutes(payload.new.close_warning_minutes !== null && payload.new.close_warning_minutes !== undefined ? Number(payload.new.close_warning_minutes) : 10);
          setCustomerWarningMinutes(payload.new.customer_warning_minutes !== null && payload.new.customer_warning_minutes !== undefined ? Number(payload.new.customer_warning_minutes) : 15);
          setShiftClosingBufferMinutes(payload.new.shift_closing_buffer_minutes !== null && payload.new.shift_closing_buffer_minutes !== undefined ? Number(payload.new.shift_closing_buffer_minutes) : 30);
          setIsAutoCloseShiftEnabled(payload.new.is_auto_close_shift_enabled !== undefined && payload.new.is_auto_close_shift_enabled !== null ? !!payload.new.is_auto_close_shift_enabled : true);
        }
      })
      .subscribe();

    const broadcastChannel = supabase.channel("settings-sync-channel")
      .on("broadcast", { event: "settings_updated" }, () => {
        fetchSettings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (openingTime === null || closingTime === null) return;

      const status = getStoreStatus(openingTime, closingTime, isTemporaryClosed, isHoliday, holidayReopenDate, temporaryClosedReopenTime, is24Hours);
      setStoreOpen(status.isOpen);
      setBannerMessage(status.message);
      setStatusType(status.statusType);

      //  KECERDASAN WAKTU SHIFT INDIVIDU (Midnight Aware)
      let isPastIndividualShift = false;
      if (activeShiftEndTime) {
        const nowTime = new Date();
        const [endH, endM] = activeShiftEndTime.split(':').map(Number);
        const targetEndDate = new Date(nowTime);
        targetEndDate.setHours(endH, endM, 0, 0);

        // Penanganan Lintas Tengah Malam (Midnight Crossing)
        // Jika jam target tercatat > 12 jam lalu (misal jam keluar 01:00 pagi, tapi sekarang jam 22:00 malam)
        // Itu berarti ia merujuk ke Dini Hari ESOK. Majukan target 1 hari.
        if (nowTime.getTime() - targetEndDate.getTime() > 12 * 60 * 60 * 1000) {
          targetEndDate.setDate(targetEndDate.getDate() + 1);
        }

        // Jika Waktu Sekarang > Waktu Selesai Target -> Berarti SHIFT TELAH BERAKHIR (Trigger Mode Lembur)
        if (nowTime.getTime() > targetEndDate.getTime()) {
          isPastIndividualShift = true;
        }
      }
      setIsShiftExpired(isPastIndividualShift);

      // Trigger Mode Akhir Shift/Lembur jika Resto Tutup ATAU Waktu Shift Pribadi Habis
      if (status.isOpen && !isPastIndividualShift) {
        const mins = getMinutesUntilClose(closingTime);
        setMinutesUntilClose(mins);

        setRemainingShiftSeconds(0);
        localStorage.removeItem("shift_end_target_timestamp");
        const limit = role === "customer" ? customerWarningMinutes : closeWarningMinutes;
        if (mins <= limit && mins > 0) {
          if (!hasShownCloseAlert) {
            setHasShownCloseAlert(true);
            if (role === "customer") {
              setShowCloseWarningModal(true);
            }
          }
        } else {
          setHasShownCloseAlert(false);
        }
      } else {
        setMinutesUntilClose(0);
        if (role === "cashier") {
          if (!hasOpenShift) {
            localStorage.removeItem("shift_end_target_timestamp");
            localStorage.removeItem("overtime_start_timestamp");
            setRemainingShiftSeconds(0);
            setIsOvertimeMode(false);
          } else {
            //  INTELLIGENCE UPGRADE: OTOMATISASI PERHITUNGAN LEMBUR DI LATAR BELAKANG
            // Sistem tidak lagi menunggu klik! Ia menghitung mandiri sejak jam shift berakhir.
            const otStart = localStorage.getItem("overtime_start_timestamp");
            
            if (otStart) {
               setIsOvertimeMode(true);
               setRemainingShiftSeconds(0);
               const elapsedMs = Date.now() - Number(otStart);
               setOvertimeDurationSeconds(Math.max(0, Math.floor(elapsedMs / 1000)));
            } else if (activeShiftEndTime) {
               // JIKA KASIR LUPA KLIK LEMBUR:
               // Hitung manual waktu yang telah terlampaui sejak targetEndDate!
               const nowTime = new Date();
               const [endH, endM] = activeShiftEndTime.split(':').map(Number);
               const targetEndDate = new Date(nowTime);
               targetEndDate.setHours(endH, endM, 0, 0);

               // Lintas Tengah Malam (Midnight Cross Correcting)
               if (nowTime.getTime() - targetEndDate.getTime() > 12 * 60 * 60 * 1000) {
                 targetEndDate.setDate(targetEndDate.getDate() + 1);
               }

               const diffPassedMs = nowTime.getTime() - targetEndDate.getTime();
               
               // Jika sudah lewat, catat di state overtimeDurationSeconds secara real-time (Latar Belakang)
               if (diffPassedMs > 0) {
                 setOvertimeDurationSeconds(Math.floor(diffPassedMs / 1000));
               } else {
                 setOvertimeDurationSeconds(0);
               }

               // Tampilkan banner peringatan normal
               setIsOvertimeMode(false);

               if (isAutoCloseShiftEnabled) {
                 let targetTimestamp = localStorage.getItem("shift_end_target_timestamp");
                 if (!targetTimestamp) {
                   const target = Date.now() + (shiftClosingBufferMinutes * 60 * 1000);
                   localStorage.setItem("shift_end_target_timestamp", String(target));
                   targetTimestamp = String(target);
                 }
                 
                 const diffMs = Number(targetTimestamp) - Date.now();
                 const remainingSecs = Math.max(0, Math.floor(diffMs / 1000));
                 setRemainingShiftSeconds(remainingSecs);

                 if (remainingSecs <= 0 && !showAutoShiftEndModal) {
                   setAutoShiftTime(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
                   setShowAutoShiftEndModal(true);
                   handleAutoCloseShiftInDb();
                   localStorage.removeItem("shift_end_target_timestamp");
                 }
               } else {
                 // Jika dinonaktifkan, bersihkan sisa waktu agar logic timer idle aman
                 localStorage.removeItem("shift_end_target_timestamp");
                 setRemainingShiftSeconds(0);
               }
            } else {
               // Normal fallback
               setIsOvertimeMode(false);
               setOvertimeDurationSeconds(0);
            }
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [openingTime, closingTime, isTemporaryClosed, isHoliday, holidayReopenDate, temporaryClosedReopenTime, is24Hours, closeWarningMinutes, customerWarningMinutes, shiftClosingBufferMinutes, isAutoCloseShiftEnabled, hasOpenShift, hasShownCloseAlert, showAutoShiftEndModal, activeShiftEndTime]);

  const links = getMenuLinks(role);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Berhasil logout");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex transition-colors duration-300">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -300 }}
        animate={{ x: sidebarOpen || (typeof window !== 'undefined' && window.innerWidth >= 1024) ? 0 : -300 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className="fixed lg:sticky top-0 left-0 h-screen w-64 bg-card-light dark:bg-card-dark border-r border-border-light dark:border-border-dark z-50 flex flex-col shadow-xl lg:shadow-none print:hidden"
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-border-light dark:border-border-dark">
          <span className="text-xl font-bold text-text-light dark:text-text-dark">
            Resto<span className="text-primary">Book</span>
          </span>
          <button onClick={() => setSidebarOpen(false)} aria-label="Tutup Menu" title="Tutup Menu" className="lg:hidden text-muted hover:text-text-light dark:hover:text-text-dark">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1 scrollbar-hide">
          <div className="mb-6 px-2">
            <p className="text-xs font-bold text-muted uppercase tracking-wider">Menu {role}</p>
          </div>
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);
            const Icon = link.icon;
            const isRestricted = role === "cashier" && !hasOpenShift && !["/cashier/dashboard", "/cashier/profile", "/cashier/attendance"].includes(link.href);

            if (isRestricted) {
              return (
                <div 
                  key={link.href}
                  onClick={() => {
                    toast.error(`Akses Terkunci! Anda wajib melakukan absensi harian dan membuka shift terlebih dahulu di halaman Dashboard sebelum dapat mengakses menu ${link.name}.`, {
                      id: "restricted-toast",
                    });
                  }}
                  className="flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium text-muted/50 bg-gray-50/50 dark:bg-gray-800/10 cursor-not-allowed border border-dashed border-border-light/50 dark:border-border-dark/30 transition-all select-none hover:bg-red-50/10"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-muted/30" />
                    <span>{link.name}</span>
                  </div>
                  <Lock className="w-4 h-4 text-muted/40" />
                </div>
              );
            }

            return (
              <Link key={link.href} href={link.href} onClick={() => setSidebarOpen(false)}>
                <motion.div
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive 
                      ? "bg-primary text-white shadow-md shadow-primary/20" 
                      : "text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-muted"}`} />
                  {link.name}
                </motion.div>
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-border-light dark:border-border-dark">
          <motion.button
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </motion.button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden print:h-auto print:overflow-visible">
        {/* Banner Status Resto */}
        {(role === "customer" || pathname === "/") && (
          <div 
            className={`w-full py-3 px-4 text-center text-xs font-black tracking-wide uppercase transition-all duration-300 z-50 shrink-0 shadow-md flex items-center justify-center gap-2 ${
              storeOpen 
                ? "bg-emerald-950 text-emerald-200 border-b border-emerald-800/50" 
                : "bg-red-950 text-red-200 border-b border-red-900/50"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${storeOpen ? "bg-emerald-400 animate-pulse" : "bg-red-500 animate-ping"}`} />
            <span>{bannerMessage}</span>
          </div>
        )}

        {/* Cashier Closing Alert Banner */}
        {role === "cashier" && storeOpen && minutesUntilClose <= closeWarningMinutes && minutesUntilClose > 0 && (
          <div className="bg-gradient-to-r from-amber-500/10 via-red-500/15 to-amber-500/10 backdrop-blur-md border-b border-red-500/30 text-text-light dark:text-text-dark p-4 text-xs font-medium z-40 shrink-0 shadow-lg flex items-center gap-3 animate-fade-in">
            <div className="bg-red-500/25 p-2.5 rounded-2xl shrink-0 animate-pulse border border-red-500/30">
              <Clock className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-extrabold text-sm uppercase tracking-wide text-red-600 dark:text-red-400">PERSIAPAN PENUTUPAN SHIFT KASIR</p>
              <p className="text-muted dark:text-text-dark/80 mt-0.5 leading-relaxed font-semibold">
                Resto akan segera tutup dalam <span className="font-mono font-black text-sm text-red-600 dark:text-red-400 underline decoration-2">{minutesUntilClose} menit</span>. Mohon bersiap untuk mengunduh laporan transaksi harian, menghitung selisih kas (plus/minus), membersihkan area kasir, dan melakukan penutupan shift.
              </p>
            </div>
          </div>
        )}

        {/* Customer Closing Alert Banner */}
        {role === "customer" && storeOpen && minutesUntilClose <= customerWarningMinutes && minutesUntilClose > 0 && (
          <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 backdrop-blur-md border-b border-amber-500/30 text-text-light dark:text-text-dark p-4 text-xs font-medium z-40 shrink-0 shadow-lg flex items-center gap-3 animate-fade-in">
            <div className="bg-amber-500/25 p-2.5 rounded-2xl shrink-0 animate-pulse border border-amber-500/30">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-extrabold text-sm uppercase tracking-wide text-amber-600 dark:text-amber-400">Pemberitahuan - Resto Segera Tutup</p>
              <p className="text-muted dark:text-text-dark/80 mt-0.5 leading-relaxed font-semibold">
                Mohon perhatian, resto akan tutup dalam <span className="font-mono font-black text-sm text-amber-600 dark:text-amber-400 underline decoration-2">{minutesUntilClose} menit</span>. 
                Silakan selesaikan pemesanan dan pembayaran Anda sebelum waktu operasional berakhir agar pesanan dapat segera diproses oleh dapur kami. Terima kasih!
              </p>
            </div>
          </div>
        )}

        {/* Cashier Closing Buffer Countdown Banner */}
        {role === "cashier" && (!storeOpen || isShiftExpired) && hasOpenShift && !isOvertimeMode && (isAutoCloseShiftEnabled ? remainingShiftSeconds > 0 : true) && (
          <div className="bg-gradient-to-r from-rose-500/10 via-red-500/15 to-rose-500/10 backdrop-blur-md border-b border-red-500/30 text-text-light dark:text-text-dark p-4 text-xs font-medium z-40 shrink-0 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-3 w-full">
              <div className="bg-red-500/25 p-2.5 rounded-2xl shrink-0 animate-pulse border border-red-500/30">
                <Clock className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <p className="font-extrabold text-sm uppercase tracking-wide text-red-600 dark:text-red-400">WAKTU REKAP & TUTUP SHIFT BERJALAN</p>
                <p className="text-muted dark:text-text-dark/80 mt-0.5 leading-relaxed font-semibold">
                  Waktu bertugas Anda telah selesai. Segera unduh laporan, hitung kas, dan tutup shift. Ingin kerja lembur? Klik tombol lembur di samping.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
               <button 
                  onClick={handleStartOvertime}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg transition-all flex items-center gap-2 whitespace-nowrap active:scale-95"
               >
                  <TrendingUp className="w-4 h-4" /> Lembur
               </button>

               {isAutoCloseShiftEnabled && (
                 <div className="bg-red-500/15 border border-red-500/30 px-4 py-2 rounded-2xl flex flex-col items-center shrink-0 shadow-inner min-w-[90px]">
                   <span className="text-[10px] uppercase font-bold tracking-widest text-red-600 dark:text-red-400 leading-none mb-1">Auto Close</span>
                   <span className="font-mono text-lg font-black tracking-wider text-red-600 dark:text-red-400 animate-pulse">
                     {String(Math.floor(remainingShiftSeconds / 3600)).padStart(2, "0")}:
                     {String(Math.floor((remainingShiftSeconds % 3600) / 60)).padStart(2, "0")}:
                     {String(remainingShiftSeconds % 60).padStart(2, "0")}
                   </span>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* OVERTIME (LEMBUR) ACTIVE BANNER */}
        {role === "cashier" && isOvertimeMode && (
          <div className="bg-gradient-to-r from-blue-600/20 via-cyan-500/10 to-blue-600/20 backdrop-blur-md border-b border-blue-500/30 text-text-light dark:text-text-dark p-4 z-40 shrink-0 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 animate-fade-in">
            <div className="flex items-center gap-4 w-full">
              <div className="bg-blue-600 p-3 rounded-2xl shrink-0 border border-blue-400/50 shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                <Zap className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="font-black text-sm uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-2">
                   <span>MODE LEMBUR SEDANG BERJALAN</span>
                </p>
                <p className="text-slate-700 dark:text-blue-100/80 mt-0.5 font-bold text-xs leading-relaxed">
                  Semangat bertugas Kak! Durasi lembur dicatat otomatis di latar belakang, dan akan otomatis terhenti & tersimpan saat Anda mengklik tombol <span className="font-black text-blue-900 dark:text-white bg-blue-400/20 dark:bg-white/20 px-1.5 py-0.5 rounded">Tutup Shift</span> di Dashboard utama.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 w-full md:w-auto justify-end">
               <div className="bg-blue-950/80 dark:bg-blue-950 border border-blue-500/50 px-5 py-2.5 rounded-2xl flex flex-col items-center shadow-inner min-w-[120px]">
                 <span className="text-[9px] uppercase font-black tracking-widest text-blue-400 leading-none mb-1">Durasi Lembur</span>
                 <span className="font-mono text-xl font-black tracking-wider text-white flex items-center gap-1">
                   {String(Math.floor(overtimeDurationSeconds / 3600)).padStart(2, "0")}:
                   {String(Math.floor((overtimeDurationSeconds % 3600) / 60)).padStart(2, "0")}:
                   {String(overtimeDurationSeconds % 60).padStart(2, "0")}
                 </span>
               </div>
            </div>
          </div>
        )}

        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark z-30 shrink-0 print:hidden">
          <button onClick={() => setSidebarOpen(true)} aria-label="Buka Menu" title="Buka Menu" className="lg:hidden p-2 -ml-2 text-text-light dark:text-text-dark rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
            <MenuIcon className="w-6 h-6" />
          </button>
          
          <div className="ml-auto flex items-center gap-4">
            {role === 'customer' && (
              <Link href="/customer/cart">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  aria-label="Keranjang"
                  title="Keranjang"
                  className="relative p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-text-light dark:text-text-dark"
                >
                  <ShoppingBag className="w-5 h-5" />
                </motion.button>
              </Link>
            )}
            <motion.button
              whileHover={{ scale: 1.1, rotate: 15 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleTheme}
              aria-label="Ubah Tema"
              title="Ubah Tema"
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-text-light dark:text-text-dark"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </motion.button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 scrollbar-hide print:h-auto print:overflow-visible print:p-0">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Customer Closing Soon Dismissible Alert */}
      <AnimatePresence>
        {showCloseWarningModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card-light dark:bg-card-dark max-w-md w-full rounded-[2rem] p-6 shadow-2xl border border-border-light dark:border-border-dark text-center space-y-4"
            >
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto animate-pulse">
                <Clock className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-text-light dark:text-text-dark">Segera Tutup!</h3>
              <p className="text-sm text-muted leading-relaxed">
                resto akan tutup dalam <span className="text-amber-500 font-bold">{minutesUntilClose} menit</span> lagi. <br />
                Yuk segera selesaikan pesananmu sebelum kami tutup!
              </p>
              <button 
                onClick={() => setShowCloseWarningModal(false)}
                className="w-full py-3.5 bg-primary text-white font-black rounded-xl hover:bg-primary-hover transition-colors text-xs uppercase tracking-wider"
              >
                Baik, Mengerti
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cashier Auto Shift End Modal */}
      <AnimatePresence>
        {showAutoShiftEndModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              className="bg-card-light dark:bg-card-dark max-w-md w-full rounded-[2.5rem] overflow-hidden shadow-2xl border border-red-500/20 text-center"
            >
              <div className="bg-red-600 p-8 text-white flex flex-col items-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
                  <LogOut className="w-8 h-8" />
                </div>
                <h3 className="font-black text-2xl uppercase tracking-tight">Shift Berakhir</h3>
              </div>
              <div className="p-8 space-y-6">
                <p className="text-sm text-muted leading-relaxed">
                  Jam operasional telah berakhir. <br />
                  Shift kasir Anda otomatis ditutup oleh sistem pada pukul <span className="font-black text-red-500">{autoShiftTime}</span>. <br />
                  Pastikan semua transaksi sudah selesai sebelum logout.
                </p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      setShowAutoShiftEndModal(false);
                      router.push("/cashier/transactions");
                    }}
                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-muted rounded-2xl font-black text-xs uppercase"
                  >
                    Tinjau Transaksi Terakhir
                  </button>
                  <button 
                    onClick={async () => {
                      await supabase.auth.signOut();
                      toast.success("Berhasil logout");
                      router.push("/login");
                    }}
                    className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase hover:bg-red-700 transition-colors"
                  >
                    Tutup Shift & Logout
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
