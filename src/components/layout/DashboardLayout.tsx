"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Menu as MenuIcon, X, LogOut, Sun, Moon, Volume2, VolumeX,
  LayoutDashboard, ShoppingBag, ListOrdered, ClipboardList, 
  CalendarDays, Heart, Bell, User as UserIcon, Users, 
  Settings, Layers, UtensilsCrossed, Star, Receipt, Clock, ShoppingCart, Armchair, RotateCcw, ShieldAlert, Power, Globe, Ticket, Gift, Wallet, LifeBuoy, MessageSquare,
  Lock, AlertTriangle, QrCode, History
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { createAuditLog } from "@/lib/audit";
import MaintenanceBlockPage from "@/components/MaintenanceBlockPage";
import { useAudioStore } from "@/store/useAudioStore";
import NotificationCenterDrawer from "@/components/layout/NotificationCenterDrawer";
import { useTutorialStore } from "@/store/useTutorialStore";
import { useActivityTimeout } from "@/hooks/useActivityTimeout";
import PingMonitor from "@/components/PingMonitor";
import { useAdaptiveAnimation } from "@/hooks/useAdaptiveAnimation";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role?: string;
}

export default function DashboardLayout({ children, role: initialRole }: DashboardLayoutProps) {
  const isTutorialActive = useTutorialStore((state) => state.isTutorialActive);
  const { spring, duration, durationFast, reducedMotion } = useAdaptiveAnimation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [role, setRole] = useState<string | null>(initialRole || null);

  const isSoundEnabled = useAudioStore((state) => state.isCustomerSoundEnabled);
  const toggleCustomerSound = useAudioStore((state) => state.toggleCustomerSound);

  const handleToggleSound = () => {
    const uId = userProfile?.user_id;
    if (uId) {
      toggleCustomerSound(uId);
      const isEnabledNow = useAudioStore.getState().isCustomerSoundEnabled;
      toast.success(
        isEnabledNow
          ? "Suara notifikasi diaktifkan!"
          : "Suara notifikasi dimatikan."
      );
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.id) {
          toggleCustomerSound(session.user.id);
          const isEnabledNow = useAudioStore.getState().isCustomerSoundEnabled;
          toast.success(
            isEnabledNow
              ? "Suara notifikasi diaktifkan!"
              : "Suara notifikasi dimatikan."
          );
        }
      });
    }
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSidebarOpen(false);
    setIsTransitioning(true);
    setTimeout(() => {
      window.location.href = "/";
    }, 1500);
  };
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Sync theme realtime with profile settings
  useEffect(() => {
    if (!userProfile?.user_id) return;

    applyThemePreference(userProfile.theme);

    const channel = supabase
      .channel(`layout-profile-theme-${userProfile.user_id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${userProfile.user_id}`
        },
        (payload: any) => {
          if (payload.new) {
            setUserProfile(payload.new);
            applyThemePreference(payload.new.theme);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.user_id]);

  const applyThemePreference = (pref: string) => {
    if (pref === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else if (pref === 'light') {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    } else {
      const systemPref = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(!!systemPref);
      if (systemPref) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const handleToggleTheme = async () => {
    const nextTheme = isDarkMode ? 'light' : 'dark';
    setIsDarkMode(!isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
    
    try {
      await fetch('/api/profile/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: nextTheme })
      });
    } catch (e) {
      console.error("Gagal menyimpan preferensi tema:", e);
    }
  };

  const [isNotifCenterOpen, setIsNotifCenterOpen] = useState(false);
  const [onlineOrderCount, setOnlineOrderCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [pendingTicketCount, setPendingTicketCount] = useState(0);
  const [unreadLiveChatCount, setUnreadLiveChatCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { warningActive, secondsLeft } = useActivityTimeout({
    role: userProfile?.role || role,
    onLogout: () => {
      handleLogout();
    }
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [shiftState, setShiftState] = useState<'open' | 'closed' | 'standby'>('standby');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [lockModal, setLockModal] = useState<{ isOpen: boolean; type: 'closed' | 'standby' }>({ isOpen: false, type: 'standby' });

  const fetchShiftState = async (profileId: string) => {
    try {
      const { data: openShift } = await supabase
        .from('shifts')
        .select('id')
        .eq('profile_id', profileId)
        .eq('status', 'open')
        .maybeSingle();

      if (openShift) {
        setShiftState('open');
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const { data: closedShift } = await supabase
        .from('shifts')
        .select('id')
        .eq('profile_id', profileId)
        .eq('status', 'closed')
        .gte('created_at', todayStr)
        .limit(1)
        .maybeSingle();

      if (closedShift) {
        setShiftState('closed');
      } else {
        setShiftState('standby');
      }
    } catch (e) {
      console.error("Error fetching shift state in layout:", e);
    }
  };

  useEffect(() => {
    if (!userProfile?.id || role !== "cashier") return;

    fetchShiftState(userProfile.id);

    const channel = supabase
      .channel(`layout-shifts-${userProfile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shifts"
        },
        (payload: any) => {
          if (payload.new?.profile_id === userProfile.id || payload.old?.profile_id === userProfile.id) {
            fetchShiftState(userProfile.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.id, role]);

  const isLinkAllowed = (href: string): boolean => {
    if (role !== "cashier") return true;
    
    // Profil and Absen are always allowed
    if (href === "/cashier/profile" || href === "/cashier/attendance") return true;

    if (shiftState === "open") {
      return true;
    } else if (shiftState === "closed") {
      return href === "/cashier/transactions" || href === "/cashier/dashboard";
    } else {
      // standby
      return href === "/cashier/dashboard";
    }
  };


  const [maintenanceSettings, setMaintenanceSettings] = useState({
    is_maintenance_active: false,
    maintenance_message: "Sistem sedang dalam perbaikan untuk meningkatkan layanan. Sementara ini, proses transaksi dan pembayaran belum dapat digunakan. Silakan coba kembali nanti.",
    maintenance_estimated_hours: "2 Jam"
  });

  const isTransactionRoute = (path: string): boolean => {
    const p = path.toLowerCase();
    return (
      p.includes("/customer/cart") ||
      p.includes("/customer/wallet") ||
      p.includes("/customer/rewards") ||
      p.includes("/cashier/pos") ||
      p.includes("/cashier/online-orders")
    );
  };

  const fetchMaintenanceSettings = async () => {
    try {
      const { data } = await supabase
        .from("restaurant_settings")
        .select("is_maintenance_active, maintenance_message, maintenance_estimated_hours")
        .single();
      if (data) {
        setMaintenanceSettings({
          is_maintenance_active: !!data.is_maintenance_active,
          maintenance_message: data.maintenance_message || "Sistem sedang dalam perbaikan untuk meningkatkan layanan. Sementara ini, proses transaksi dan pembayaran belum dapat digunakan. Silakan coba kembali nanti.",
          maintenance_estimated_hours: data.maintenance_estimated_hours || "2 Jam"
        });
      }
    } catch (e) {
      console.error("Error fetching maintenance settings in layout:", e);
    }
  };

  useEffect(() => {
    // Inisialisasi Audio Notifikasi
    // Inisialisasi Audio Notifikasi (Announcement Style)
    audioRef.current = new Audio("/notification.mp3");
    audioRef.current.volume = 1.0;
    audioRef.current.loop = false;
    
    checkUser();
    fetchOnlineOrderCount();
    fetchMaintenanceSettings();
    
    // Real-time Listener untuk Pesanan Online Baru & Update Badge
    const channel = supabase
      .channel('sidebar-online-orders')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders'
      }, (payload: any) => {
        // Only process online orders (delivery/takeaway)
        const order = payload.new;
        if (!order || !['delivery', 'takeaway', 'dine_in'].includes(order.order_type)) return;

        // ALWAYS fetch the new count on any change (insert, update, delete)
        fetchOnlineOrderCount();

        if (payload.eventType === 'INSERT') {
          const isActionable = order.status === 'pending' && (order.payment_status === 'paid' || order.payment_method === 'cash');
          if (isActionable) {
            if (window.location.pathname.includes('/cashier')) {
              playNotifSound();
              toast.success("Ada pesanan online baru masuk!", { icon: '', duration: 8000, position: 'top-right' });
            }
          }
        } else if (payload.eventType === 'UPDATE') {
          // Jika pesanan baru saja LUNAS (Paid) dan masih Pending
          const becamePaid = order.status === 'pending' && order.payment_status === 'paid' && payload.old?.payment_status !== 'paid';
          if (becamePaid) {
            if (window.location.pathname.includes('/cashier')) {
              playNotifSound();
              toast.success("Pesanan Online Baru (Lunas)!", { icon: '', duration: 8000, position: 'top-right' });
            }
          }
        }
      })
      .subscribe();

    // Real-time Listener untuk status mode maintenance
    const maintChannel = supabase
      .channel('layout-maintenance-sync')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'restaurant_settings'
      }, (payload: any) => {
        if (payload.new) {
          setMaintenanceSettings({
            is_maintenance_active: !!payload.new.is_maintenance_active,
            maintenance_message: payload.new.maintenance_message || "Sistem sedang dalam perbaikan untuk meningkatkan layanan. Sementara ini, proses transaksi dan pembayaran belum dapat digunakan. Silakan coba kembali nanti.",
            maintenance_estimated_hours: payload.new.maintenance_estimated_hours || "2 Jam"
          });
        }
      })
      .subscribe();

    // Background scheduler for checking expired reservations
    const expiryInterval = setInterval(() => {
      fetch('/api/reservations/check-expiry')
        .then(res => res.json())
        .then(data => {
          if (data.processedCount > 0) {
            console.log(`Auto-expiry: Berhasil membatalkan ${data.processedCount} reservasi.`);
          }
        })
        .catch(err => console.error("Gagal menjalankan auto-expiry check:", err));
    }, 120000); // 2 menit

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(maintChannel);
      clearInterval(expiryInterval);
    };
  }, []);

  // Efek untuk mengaktifkan (unlock) audio pada interaksi pertama pengguna (mengikuti kebijakan browser)
  useEffect(() => {
    const unlockAudio = () => {
      if (audioRef.current) {
        audioRef.current.play()
          .then(() => {
            audioRef.current?.pause();
            if (audioRef.current) audioRef.current.currentTime = 0;
            window.removeEventListener("click", unlockAudio);
            window.removeEventListener("touchstart", unlockAudio);
          })
          .catch(() => {});
      }
    };
    window.addEventListener("click", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);
    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  // Real-time listener untuk notifikasi semua role (Customer, Cashier, Admin) dengan popup toast
  useEffect(() => {
    if (!userProfile?.id) return;

    // Fetch count awal
    fetchUnreadNotifCount();

    const channel = supabase
      .channel(`global-user-notifications-${userProfile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userProfile.id}`
        },
        (payload: any) => {
          fetchUnreadNotifCount();

          if (payload.new) {
            toast(
              (t) => (
                <div className="flex flex-col gap-1">
                  <span className="font-extrabold text-sm text-primary uppercase tracking-wider">
                    {payload.new.title || "Notifikasi Baru"}
                  </span>
                  <span className="text-xs text-muted leading-relaxed font-semibold">
                    {payload.new.message}
                  </span>
                </div>
              ),
              {
                duration: 5000,
                icon: "🔔",
                style: {
                  borderRadius: '1rem',
                  background: isDarkMode ? '#1e1b4b' : '#fff',
                  color: isDarkMode ? '#fff' : '#000',
                  border: '1px solid ' + (isDarkMode ? '#312e81' : '#e5e7eb'),
                }
              }
            );
            playSingleNotifSound();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userProfile.id}`
        },
        () => {
          fetchUnreadNotifCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.id, role, isDarkMode]);

  const playFallbackBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          gain.gain.setValueAtTime(0.5, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
        }, i * 300);
      }
    } catch {}
  };

  const playNotifSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Fallback to synthetic beep if audio file is blocked or 404
        playFallbackBeep();
      });
      
      // Ulangi suara
      let count = 0;
      const interval = setInterval(() => {
        if (audioRef.current && count < 2) { 
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => playFallbackBeep());
          count++;
        } else {
          clearInterval(interval);
        }
      }, 2500);
    } else {
      playFallbackBeep();
    }
  };

  const playSingleFallbackBeep = () => {
    const isEnabled = useAudioStore.getState().isCustomerSoundEnabled;
    if (!isEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  const playSingleNotifSound = () => {
    const isEnabled = useAudioStore.getState().isCustomerSoundEnabled;
    if (!isEnabled) {
      return;
    }
    try {
      const notifAudio = new Audio("/notification.mp3");
      notifAudio.volume = 0.7;
      notifAudio.play().catch(() => {
        playSingleFallbackBeep();
      });
    } catch {
      playSingleFallbackBeep();
    }
  };

  const fetchUnreadNotifCount = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;
      const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", session.session.user.id).single();
      if (!profile) return;

      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("is_read", false);

      setUnreadNotifCount(count || 0);
    } catch (e) {
      console.error("Error fetching unread notification count:", e);
    }
  };



  const fetchOnlineOrderCount = async () => {
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('order_type', ['delivery', 'takeaway', 'dine_in'])
      .eq('status', 'pending')
      .or('payment_status.eq.paid,payment_method.eq.cash');
    
    setOnlineOrderCount(count || 0);
  };

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }

    useAudioStore.getState().initAudioSettings(session.user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .single();

    if (profile) {
      setRole(profile.role);
      setUserProfile(profile);

      // Onboarding Tutorial Initialization & Direct Forced Activation
      const tutorialStore = useTutorialStore.getState();
      tutorialStore.initTutorialStatus(session.user.id, profile.role || 'customer');
      const currentStatus = useTutorialStore.getState().status;

      if (currentStatus && !currentStatus.tour_completed && !currentStatus.skipped_tour) {
        // Automatically start the onboarding tutorial for new users/first login without any toast invite
        setTimeout(() => {
          tutorialStore.startTutorial(profile.role || 'customer');
        }, 1200);

        if (currentStatus.first_login) {
          // Insert database notification via async IIFE
          (async () => {
            try {
              await supabase.from("notifications").insert({
                user_id: profile.id,
                title: "Selamat datang di RestoBook!",
                message: "Halo! Panduan onboarding interaktif telah dimulai otomatis untuk memperkenalkan seluruh fitur kami.",
                is_read: false,
                type: "system"
              });
              if (tutorialStore.status) {
                const updated = { ...tutorialStore.status, first_login: false };
                localStorage.setItem(`restobook_tutorial_status_${session.user.id}`, JSON.stringify(updated));
                useTutorialStore.setState({ status: updated });
              }
            } catch (err) {
              console.error("Welcome notif failed:", err);
            }
          })();
        }
      }

      if (profile.role === "customer") {
        const { count } = await supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .eq("is_read", false);
        setUnreadNotifCount(count || 0);
      } else if (profile.role === "admin") {
        const { count } = await supabase
          .from('support_tickets')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');
        setPendingTicketCount(count || 0);
        fetchUnreadLiveChatCount();
      } else if (profile.role === "cashier") {
        fetchUnreadLiveChatCount();
      }
    }
  };

  const fetchPendingTicketCount = async () => {
    try {
      const { count: supportPending } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: escalatedChats } = await supabase
        .from('order_chats')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'need_admin');

      setPendingTicketCount((supportPending || 0) + (escalatedChats || 0));
    } catch (e) {
      console.error("Error fetching pending ticket count:", e);
    }
  };

  const fetchUnreadLiveChatCount = async () => {
    try {
      const { count } = await supabase
        .from("order_chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false)
        .eq("sender_role", "customer");
      setUnreadLiveChatCount(count || 0);
    } catch (e) {
      console.error("Error fetching unread live chat count:", e);
    }
  };

  useEffect(() => {
    if (!userProfile?.id || role !== "admin") return;

    fetchPendingTicketCount();

    const channel = supabase
      .channel('admin-support-tickets-badge')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'support_tickets'
      }, () => {
        fetchPendingTicketCount();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_chats'
      }, () => {
        fetchPendingTicketCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.id, role]);

  useEffect(() => {
    if (!userProfile?.id || !['cashier', 'admin'].includes(role || '')) return;

    fetchUnreadLiveChatCount();

    const channel = supabase
      .channel('cashier-live-chat-badge')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'order_chat_messages'
      }, () => {
        fetchUnreadLiveChatCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.id, role]);

  useEffect(() => {
    const handleOpen = () => setIsSidebarOpen(true);
    const handleClose = () => setIsSidebarOpen(false);

    window.addEventListener('open-mobile-sidebar', handleOpen);
    window.addEventListener('close-mobile-sidebar', handleClose);

    return () => {
      window.removeEventListener('open-mobile-sidebar', handleOpen);
      window.removeEventListener('close-mobile-sidebar', handleClose);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('API logout failed', e);
    }
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const getMenuLinks = (): any[] => {
    switch (role) {
      case "admin":
        return [
          { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
          { name: "Menu Makanan", href: "/admin/menu", icon: UtensilsCrossed },
          { name: "Kategori", href: "/admin/categories", icon: Layers },
          { name: "Pesanan", href: "/admin/orders", icon: ShoppingBag },
          { name: "Meja", href: "/admin/tables", icon: Armchair },
          { name: "Pelanggan", href: "/admin/customers", icon: Users },
          { name: "Karyawan", href: "/admin/users", icon: UserIcon },
          { name: "Voucher", href: "/admin/vouchers", icon: Ticket },
          { name: "Absensi", href: "/admin/attendance", icon: ClipboardList },
          { name: "Payroll", href: "/admin/payroll", icon: Receipt },
          { name: "Transaksi", href: "/admin/transactions", icon: Receipt },
          { name: "Resign", href: "/admin/resign", icon: Power },
          { name: "Refund", href: "/admin/refunds", icon: RotateCcw },
          { name: "Fitur Dompetku", href: "/admin/wallet", icon: Wallet },
          { name: "Aktivasi Dompetku", href: "/admin/wallet-activations", icon: Wallet },
          { name: "Reviews", href: "/admin/reviews", icon: Star },
          { name: "Reward Point", href: "/admin/rewards", icon: Gift },
          { name: "Pengaduan & Bantuan", href: "/admin/support", icon: LifeBuoy, badge: pendingTicketCount },
          { name: "Keamanan Sistem", href: "/admin/security", icon: ShieldAlert },
          { name: "Settings", href: "/admin/settings", icon: Settings },
          { name: "Profil", href: "/admin/profile", icon: UserIcon },
        ];
      case "cashier":
        return [
          { name: "Dashboard", href: "/cashier/dashboard", icon: LayoutDashboard },
          { name: "Point of Sale", href: "/cashier/pos", icon: ShoppingCart },
          { name: "Status Meja", href: "/cashier/tables", icon: Armchair },
          { name: "Pesanan", href: "/cashier/orders", icon: ShoppingBag },
          { 
            name: "Pesanan Online", 
            href: "/cashier/online-orders", 
            icon: Globe,
            badge: onlineOrderCount 
          },
          { name: "Antrian Dapur", href: "/cashier/queue", icon: ListOrdered },
          { name: "Reservasi", href: "/cashier/reservations", icon: CalendarDays },
          { name: "Pindai QR Booking", href: "/cashier/scan", icon: QrCode },
          { name: "Live Chat", href: "/cashier/chat", icon: MessageSquare, badge: unreadLiveChatCount },
          { name: "Transaksi", href: "/cashier/transactions", icon: Receipt },
          { name: "Absensi", href: "/cashier/attendance", icon: ClipboardList },
          { name: "Profil", href: "/cashier/profile", icon: UserIcon },
        ];
      case "customer":
        return [
          { name: "Home", href: "/customer/dashboard", icon: LayoutDashboard },
          { name: "Menu", href: "/customer/menu", icon: UtensilsCrossed },
          { name: "Keranjang", href: "/customer/cart", icon: ShoppingBag },
          { name: "Dompetku", href: "/customer/wallet", icon: Wallet },
          { name: "Voucher Saya", href: "/customer/vouchers", icon: Ticket },
          { name: "Tukar Point", href: "/customer/rewards", icon: Gift },
          { name: "Pesanan Saya", href: "/customer/orders", icon: Clock },
          { name: "Favorit", href: "/customer/favorites", icon: Heart },
          { name: "Reservasi", href: "/customer/reservations", icon: CalendarDays },
          { name: "Pengaduan & Bantuan", href: "/customer/support", icon: LifeBuoy },
          { name: "Profil", href: "/customer/profile", icon: UserIcon },
        ];
      default:
        return [];
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? "dark" : ""}`}>
      <div className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark min-h-screen transition-colors duration-300">
        
        {/* Desktop Sidebar */}
        <aside className="fixed left-0 top-0 hidden h-full w-72 bg-card-light dark:bg-card-dark border-r border-border-light dark:border-border-dark lg:block z-40 print:hidden smooth-gpu">
          <div className="flex h-full flex-col p-6">
            <button
              onClick={handleLogoClick}
              data-tour="logo"
              className="mb-10 flex items-center gap-3 px-2 text-left hover:opacity-80 transition-all focus:outline-none w-fit"
            >
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <UtensilsCrossed className="text-white h-6 w-6" />
              </div>
              <span className="text-2xl font-black tracking-tight text-primary">RestoBook</span>
            </button>

            <nav className={`flex-1 space-y-1.5 overflow-y-auto pr-2 custom-scrollbar ${isTutorialActive ? "pointer-events-none" : ""}`}>
              {getMenuLinks().map((link) => {
                const allowed = isLinkAllowed(link.href);
                return (
                  <Link
                    key={link.href}
                    href={allowed ? link.href : "#"}
                    prefetch={false}
                    data-tour={`nav-${link.name}`}
                    onClick={(e) => {
                      if (!allowed) {
                        e.preventDefault();
                        setLockModal({ isOpen: true, type: shiftState === 'closed' ? 'closed' : 'standby' });
                        createAuditLog("attempt_locked_access", {
                          href: link.href,
                          menuName: link.name,
                          shiftState
                        });
                      }
                    }}
                    className={`group relative flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-bold transition-all ${
                      !allowed
                        ? "opacity-50 cursor-not-allowed text-muted/50 hover:bg-transparent"
                        : pathname === link.href
                          ? "bg-primary text-white shadow-lg shadow-primary/20"
                          : "text-muted hover:bg-primary/5 hover:text-primary"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <link.icon className={`h-5 w-5 ${!allowed ? "text-muted/40" : pathname === link.href ? "text-white" : "text-muted group-hover:text-primary"}`} />
                      <span>{link.name}</span>
                      {isTransactionRoute(link.href) && maintenanceSettings.is_maintenance_active && role !== "admin" && (
                        <span className="text-[9px] font-black uppercase text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">Maintenance</span>
                      )}
                    </div>
                    {!allowed && (
                      <Lock className="w-3.5 h-3.5 text-muted/40 shrink-0" />
                    )}
                    {allowed && link.badge !== undefined && link.badge > 0 && (
                      <motion.span 
                        initial={{ scale: 0 }} 
                        animate={{ scale: 1 }} 
                        className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black ${
                          pathname === link.href ? "bg-white text-primary" : "bg-rose-500 text-white"
                        }`}
                      >
                        {link.badge}
                      </motion.span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className={`mt-6 border-t border-border-light dark:border-border-dark pt-6 ${isTutorialActive ? "pointer-events-none" : ""}`}>
              <button
                onClick={() => setShowLogoutModal(true)}
                data-tour="logout-button"
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold text-rose-500 transition-all hover:bg-rose-50 border border-transparent hover:border-rose-100"
              >
                <LogOut className="h-5 w-5" />
                Keluar Akun
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="lg:pl-72 print:pl-0 min-h-screen flex flex-col">
          {/* Header */}
          <header className={`sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border-light dark:border-border-dark bg-background-light/80 dark:bg-background-dark/80 px-3 sm:px-6 backdrop-blur-xl print:hidden smooth-gpu ${isTutorialActive ? "pointer-events-none" : ""}`}>
            <div className="flex items-center gap-1.5 sm:gap-4 lg:hidden">
              <button
                onClick={() => setIsSidebarOpen(true)}
                data-tour="mobile-hamburger"
                aria-label="Buka Menu"
                title="Buka Menu"
                className="p-1.5 sm:p-2.5 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-muted"
              >
                <MenuIcon className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
              <button
                onClick={handleLogoClick}
                data-tour="logo"
                className="text-base sm:text-xl font-black text-primary hover:opacity-80 transition-all focus:outline-none"
              >
                RestoBook
              </button>
            </div>

            <div className="hidden lg:block">
               <h2 className="text-sm font-bold text-muted uppercase tracking-widest">
                  Selamat Datang, <span className="text-text-light dark:text-text-dark">{userProfile?.full_name || "User"}</span>
               </h2>
            </div>

            <div className="flex items-center gap-1 sm:gap-3">
              {/* Ping Monitor badge */}
              <PingMonitor size="sm" />
              <button
                onClick={handleToggleSound}
                aria-label={isSoundEnabled ? "Matikan Suara Notifikasi" : "Aktifkan Suara Notifikasi"}
                title={isSoundEnabled ? "Matikan Suara Notifikasi" : "Aktifkan Suara Notifikasi"}
                className={`hidden lg:flex p-2.5 rounded-xl border transition-all ${
                  isSoundEnabled
                    ? "bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark text-emerald-500 hover:text-emerald-600"
                    : "bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark text-rose-500 hover:text-rose-600"
                }`}
              >
                {isSoundEnabled ? <Volume2 className="h-5 w-5 animate-pulse" /> : <VolumeX className="h-5 w-5" />}
              </button>
              <button
                onClick={handleToggleTheme}
                data-tour="theme-toggle"
                aria-label={isDarkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
                title={isDarkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
                className="hidden lg:flex p-2.5 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-muted hover:text-primary transition-all"
              >
                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" /> }
              </button>
              <button
                onClick={() => setIsNotifCenterOpen(true)}
                data-tour="header-notifications"
                className="p-1.5 sm:p-2.5 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-muted hover:text-primary transition-all relative"
                title="Pusat Informasi"
                aria-label="Pusat Informasi"
              >
                <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] sm:h-5 sm:min-w-[20px] px-1 items-center justify-center rounded-full bg-rose-500 text-[8px] sm:text-[9px] font-black text-white shadow-sm">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
              <div data-tour="profile-avatar" className="hidden lg:flex h-10 w-10 rounded-xl overflow-hidden bg-primary/10 border border-primary/20 items-center justify-center text-primary font-black uppercase text-sm">
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  userProfile?.full_name?.charAt(0) || "U"
                )}
              </div>
            </div>
          </header>

          {maintenanceSettings.is_maintenance_active && (
            <div className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3.5 px-6 font-bold text-xs sm:text-sm flex items-center justify-between gap-4 shadow-md border-b border-orange-500/25 z-20 print:hidden">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 animate-pulse flex-shrink-0" />
                <span>
                  <strong>Info Penting:</strong> Saat ini sistem sedang maintenance. Beberapa layanan transaksi sedang tidak tersedia untuk sementara.
                </span>
              </div>
              {role === "admin" && (
                <span className="bg-white/20 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Admin Bypass
                </span>
              )}
            </div>
          )}

          <main className={`flex-1 relative ${isTutorialActive ? "pointer-events-none" : ""}`}>
            {maintenanceSettings.is_maintenance_active && role !== "admin" && isTransactionRoute(pathname) ? (
              <MaintenanceBlockPage 
                message={maintenanceSettings.maintenance_message} 
                estimatedHours={maintenanceSettings.maintenance_estimated_hours}
                role={role || "customer"}
              />
            ) : (
              children
            )}
          </main>
        </div>

        {/* Activity Warning Timeout Modal */}
        <AnimatePresence>
          {warningActive && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: durationFast }}
              className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            >
              <motion.div
                initial={reducedMotion ? { opacity: 0 } : { scale: 0.95, opacity: 0, y: 8 }}
                animate={reducedMotion ? { opacity: 1 } : { scale: 1, opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { scale: 0.97, opacity: 0, y: 4 }}
                transition={spring}
                className="bg-card-light dark:bg-card-dark rounded-[2rem] p-8 w-full max-w-md shadow-2xl border border-border-light dark:border-border-dark text-center space-y-6 text-text-light dark:text-text-dark"
              >
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-950/30 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                  <Clock className="w-8 h-8 animate-pulse" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black tracking-tight">
                    Sesi Anda Akan Berakhir
                  </h3>
                  <p className="text-muted text-sm leading-relaxed">
                    Karena tidak ada aktivitas selama beberapa waktu, sistem akan mengeluarkan Anda secara otomatis demi keamanan data.
                  </p>
                </div>
                <div className="bg-rose-50 dark:bg-rose-950/10 border border-rose-200/50 dark:border-rose-800/30 rounded-2xl p-4">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-500 block mb-1">
                    Sisa Waktu
                  </span>
                  <span className="text-3xl font-black text-rose-600 dark:text-rose-400 font-mono">
                    00:{secondsLeft < 10 ? `0${secondsLeft}` : secondsLeft}
                  </span>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      const now = Date.now();
                      document.cookie = `last_active_timestamp=${now}; path=/; secure; samesite=strict`;
                      toast.success("Sesi Anda diperpanjang!");
                    }}
                    className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20"
                  >
                    Lanjutkan Sesi Saya
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <NotificationCenterDrawer
          isOpen={isNotifCenterOpen}
          onClose={() => setIsNotifCenterOpen(false)}
          profileId={userProfile?.id || ""}
        />

        {/* Logout Confirmation Modal */}
        <AnimatePresence>
          {showLogoutModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.97, opacity: 0, y: 4 }}
                transition={spring}
                className="bg-card-light dark:bg-card-dark rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-border-light dark:border-border-dark space-y-6 text-text-light dark:text-text-dark"
              >
                <div className="w-16 h-16 bg-red-100 dark:bg-red-950/30 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                  <LogOut className="w-8 h-8" />
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-black tracking-tight">
                    Konfirmasi Keluar
                  </h3>
                  <p className="text-muted text-sm">
                    Apakah Anda yakin ingin keluar dari akun Anda?
                  </p>
                </div>                {/* WARNING ZONE */}
                {(() => {
                  const isCashierActiveShift = role === 'cashier' && shiftState === 'open';

                  if (!isCashierActiveShift) return null;

                  return (
                    <div className="space-y-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-2xl text-left">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-500 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Perhatian Penting
                      </span>
                      <ul className="text-xs text-amber-850 dark:text-amber-400 space-y-1.5 list-disc list-inside font-medium leading-relaxed">
                        <li className="font-bold text-red-600 dark:text-red-400">
                          Shift Kerja Kasir Anda masih aktif! Keluar dari akun tidak akan menutup shift kerja Anda secara otomatis. Pastikan Anda telah melakukan penutupan shift terlebih dahulu.
                        </li>
                      </ul>
                    </div>
                  );
                })()}

                <div className="flex gap-4 pt-2">
                  <button
                    onClick={() => setShowLogoutModal(false)}
                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-muted rounded-2xl font-black text-xs uppercase hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    onClick={async () => {
                      await createAuditLog('logout', {
                        role: role || 'unknown',
                        shiftState: role === 'cashier' ? shiftState : null,
                        name: userProfile?.full_name || 'unknown'
                      });
                      setShowLogoutModal(false);
                      handleLogout();
                    }}
                    className="flex-[2] py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-600/20 transition-all"
                  >
                    Keluar Akun
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cashier Lock Warning Modal */}
        <AnimatePresence>
          {lockModal.isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={spring}
                className="bg-card-light dark:bg-card-dark rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl border border-border-light dark:border-border-dark space-y-6 text-center text-text-light dark:text-text-dark"
              >
                {/* Padlock Icon Area */}
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.05, 1],
                      rotate: [0, -5, 5, -5, 5, 0]
                    }}
                    transition={{
                      duration: 0.6,
                      ease: "easeInOut",
                      repeat: Infinity,
                      repeatDelay: 2.5
                    }}
                    className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-lg ${
                      lockModal.type === 'closed' 
                        ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400' 
                        : 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    <Lock className="w-10 h-10" />
                  </motion.div>
                  {/* Floating Notification Dot */}
                  <span className="absolute top-2 right-2 flex h-4 w-4">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      lockModal.type === 'closed' ? 'bg-rose-400' : 'bg-amber-400'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-4 w-4 ${
                      lockModal.type === 'closed' ? 'bg-rose-500' : 'bg-amber-500'
                    }`}></span>
                  </span>
                </div>

                <div className="space-y-3">
                  <h3 className="text-2xl font-black uppercase tracking-tight">
                    {lockModal.type === 'closed' ? 'Shift Sudah Ditutup' : 'Akses Dibatasi'}
                  </h3>
                  <p className="text-muted text-sm leading-relaxed font-semibold">
                    {lockModal.type === 'closed' 
                      ? 'Shift kerja Anda untuk hari ini telah berakhir dan ditutup. Akses ke menu transaksi telah dikunci secara otomatis demi keamanan finansial. Hubungi Administrator jika perlu membuka kembali shift.'
                      : 'Halo! Fitur kasir ini masih terkunci. Anda harus melakukan absensi masuk dan menginput modal kasir awal terlebih dahulu di Dashboard utama sebelum dapat menggunakannya.'
                    }
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-3">
                  {lockModal.type === 'standby' ? (
                    <button
                      onClick={() => {
                        setLockModal({ isOpen: false, type: 'standby' });
                        router.push('/cashier/dashboard');
                      }}
                      className="w-full py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-102 transition-all shadow-xl shadow-primary/20"
                    >
                      Buka Dashboard Absensi
                    </button>
                  ) : null}
                  <button
                    onClick={() => setLockModal({ isOpen: false, type: lockModal.type })}
                    className="w-full py-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-muted rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    Tutup Peringatan
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: durationFast }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm lg:hidden"
              />
              <motion.aside
                initial={{ x: "-100%", opacity: 0.8 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "-100%", opacity: 0.8 }}
                transition={reducedMotion
                  ? { duration: 0.01 }
                  : { type: "spring", stiffness: spring.stiffness, damping: spring.damping, mass: spring.mass }
                }
                className="fixed left-0 top-0 z-[9999] h-full w-80 bg-card-light dark:bg-card-dark p-6 lg:hidden print:hidden flex flex-col"
              >
                <div className="mb-10 flex items-center justify-between px-2">
                  <button
                    onClick={handleLogoClick}
                    data-tour="logo"
                    className="flex items-center gap-3 text-left hover:opacity-80 transition-all focus:outline-none"
                  >
                    <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                      <UtensilsCrossed className="text-white h-6 w-6" />
                    </div>
                    <span className="text-2xl font-black tracking-tight text-primary">RestoBook</span>
                  </button>
                  <button 
                    onClick={() => setIsSidebarOpen(false)} 
                    aria-label="Tutup Menu"
                    title="Tutup Menu"
                    className="p-2 text-muted"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <nav className={`space-y-1.5 overflow-y-auto custom-scrollbar flex-1 min-h-0 ${isTutorialActive ? "pointer-events-none" : ""}`}>
                  {getMenuLinks().map((link) => {
                    const allowed = isLinkAllowed(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={allowed ? link.href : "#"}
                        data-tour={`nav-${link.name}`}
                        onClick={(e) => {
                          if (!allowed) {
                            e.preventDefault();
                            setLockModal({ isOpen: true, type: shiftState === 'closed' ? 'closed' : 'standby' });
                            createAuditLog("attempt_locked_access", {
                              href: link.href,
                              menuName: link.name,
                              shiftState
                            });
                          } else if (!isTutorialActive) {
                            setIsSidebarOpen(false);
                          }
                        }}
                        className={`flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-bold transition-all ${
                          !allowed
                            ? "opacity-50 cursor-not-allowed text-muted/50 hover:bg-transparent"
                            : pathname === link.href
                              ? "bg-primary text-white shadow-lg shadow-primary/20"
                              : "text-muted hover:bg-primary/5 hover:text-primary"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <link.icon className={`h-5 w-5 ${!allowed ? "text-muted/40" : ""}`} />
                          <span>{link.name}</span>
                          {isTransactionRoute(link.href) && maintenanceSettings.is_maintenance_active && role !== "admin" && (
                            <span className="text-[9px] font-black uppercase text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">Maintenance</span>
                          )}
                        </div>
                        {!allowed && (
                          <Lock className="w-3.5 h-3.5 text-muted/40 shrink-0" />
                        )}
                        {allowed && link.badge !== undefined && link.badge > 0 && (
                          <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black ${
                            pathname === link.href ? "bg-white text-primary" : "bg-rose-500 text-white"
                          }`}>
                            {link.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>

                <div className={`mt-4 shrink-0 ${isTutorialActive ? "pointer-events-none" : ""}`}>
                   {/* Sound & Theme toggles for mobile viewports */}
                   <div className="flex items-center gap-3 mb-4">
                     <button
                       onClick={handleToggleSound}
                       className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border text-xs font-bold transition-all ${
                         isSoundEnabled
                           ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400"
                           : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/30 text-rose-600 dark:text-rose-400"
                       }`}
                     >
                       {isSoundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                       <span>{isSoundEnabled ? "Suara On" : "Suara Off"}</span>
                     </button>
                     <button
                       onClick={handleToggleTheme}
                       className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-xs font-bold text-muted hover:text-primary transition-all"
                     >
                       {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                       <span>{isDarkMode ? "Mode Terang" : "Mode Gelap"}</span>
                     </button>
                   </div>

                   <button
                     onClick={() => setShowLogoutModal(true)}
                     data-tour="logout-button"
                     className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold text-rose-500 transition-all hover:bg-rose-50"
                   >
                    <LogOut className="h-5 w-5" />
                    Keluar Akun
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Full Screen Loading Transition & Landing Page Skeleton */}
        <AnimatePresence>
          {isTransitioning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration }}
              className="fixed inset-0 z-[99999] bg-background-light dark:bg-background-dark overflow-y-auto"
            >
              {/* Navbar Skeleton */}
              <div className="h-16 border-b border-border-light dark:border-border-dark flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-white dark:bg-card-dark">
                <div className="flex items-center gap-2">
                  <div className="skeleton w-8 h-8 rounded-xl" />
                  <div className="skeleton w-24 h-6" />
                </div>
                <div className="skeleton w-28 h-8 rounded-full" />
              </div>

              {/* Banner Skeleton */}
              <div className="w-full py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 flex items-center justify-center">
                <div className="skeleton w-64 h-4" />
              </div>

              {/* Hero Section Skeleton */}
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <div className="skeleton w-40 h-6 rounded-full" />
                  <div className="skeleton w-full h-12 rounded-xl" />
                  <div className="skeleton w-5/6 h-12 rounded-xl" />
                  <div className="skeleton w-2/3 h-6 mt-4" />
                  <div className="flex gap-4 pt-2">
                    <div className="skeleton w-36 h-12 rounded-full" />
                    <div className="skeleton w-28 h-12 rounded-full" />
                  </div>
                </div>
                <div className="skeleton w-full h-[350px] lg:h-[480px] rounded-[2rem] relative overflow-hidden bg-card-light dark:bg-card-dark">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                </div>
              </div>

              {/* Promo Banners Skeleton */}
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="skeleton w-full h-56 rounded-2xl" />
                <div className="skeleton w-full h-56 rounded-2xl" />
              </div>

              {/* Categories Skeleton */}
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <div className="flex flex-col items-center mb-8">
                  <div className="skeleton w-48 h-8" />
                  <div className="skeleton w-64 h-4 mt-2" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="skeleton w-full h-32 rounded-2xl" />
                  ))}
                </div>
              </div>

              {/* Menu Grid Skeleton */}
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <div className="skeleton w-48 h-8" />
                    <div className="skeleton w-32 h-4 mt-2" />
                  </div>
                  <div className="skeleton w-24 h-6" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark flex flex-col gap-4">
                      <div className="skeleton w-full h-48 rounded-xl" />
                      <div className="skeleton w-3/4 h-6" />
                      <div className="skeleton w-full h-4" />
                      <div className="skeleton w-5/6 h-4" />
                      <div className="flex justify-between items-center mt-auto pt-3 border-t border-border-light/50">
                        <div className="skeleton w-24 h-6" />
                        <div className="skeleton w-16 h-8 rounded-xl" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
