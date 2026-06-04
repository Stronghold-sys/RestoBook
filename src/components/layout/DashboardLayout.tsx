"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Menu as MenuIcon, X, LogOut, Sun, Moon, 
  LayoutDashboard, ShoppingBag, ListOrdered, ClipboardList, 
  CalendarDays, Heart, Bell, User as UserIcon, Users, 
  Settings, Layers, UtensilsCrossed, Star, Receipt, Clock, ShoppingCart, Armchair, RotateCcw, Lock, ShieldAlert, TrendingUp, Zap, Power, Globe, Ticket, Gift, Wallet, LifeBuoy, MessageSquare
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import MaintenanceBlockPage from "@/components/MaintenanceBlockPage";
import { useAudioStore } from "@/store/useAudioStore";
import NotificationCenterDrawer from "@/components/layout/NotificationCenterDrawer";
import { useTutorialStore } from "@/store/useTutorialStore";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role?: string;
}

export default function DashboardLayout({ children, role: initialRole }: DashboardLayoutProps) {
  const isTutorialActive = useTutorialStore((state) => state.isTutorialActive);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [role, setRole] = useState<string | null>(initialRole || null);

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
  const [isNotifCenterOpen, setIsNotifCenterOpen] = useState(false);
  const [onlineOrderCount, setOnlineOrderCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [pendingTicketCount, setPendingTicketCount] = useState(0);
  const [unreadLiveChatCount, setUnreadLiveChatCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(maintChannel);
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

  // Real-time listener untuk notifikasi pelanggan
  useEffect(() => {
    if (!userProfile?.id || role !== "customer") return;

    // Fetch count awal
    fetchUnreadNotifCount();

    const channel = supabase
      .channel(`customer-notifications-${userProfile.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userProfile.id}`
        },
        (payload: any) => {
          fetchUnreadNotifCount();

          if (payload.eventType === "INSERT") {
            playSingleNotifSound();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.id, role]);

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
    } catch (e) {}
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
    } catch (e) {}
  };

  const playSingleNotifSound = () => {
    const isEnabled = useAudioStore.getState().isCustomerSoundEnabled;
    if (!isEnabled) {
      console.log("Customer notifications sound is muted.");
      return;
    }
    try {
      const notifAudio = new Audio("/notification.mp3");
      notifAudio.volume = 0.7;
      notifAudio.play().catch(() => {
        playSingleFallbackBeep();
      });
    } catch (e) {
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
        <aside className="fixed left-0 top-0 hidden h-full w-72 bg-card-light dark:bg-card-dark border-r border-border-light dark:border-border-dark lg:block z-40">
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
              {getMenuLinks().map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  data-tour={`nav-${link.name}`}
                  className={`group relative flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-bold transition-all ${
                    pathname === link.href
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : "text-muted hover:bg-primary/5 hover:text-primary"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <link.icon className={`h-5 w-5 ${pathname === link.href ? "text-white" : "text-muted group-hover:text-primary"}`} />
                    <span>{link.name}</span>
                    {isTransactionRoute(link.href) && maintenanceSettings.is_maintenance_active && role !== "admin" && (
                      <span className="text-[9px] font-black uppercase text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">Maintenance</span>
                    )}
                  </div>
                  {link.badge !== undefined && link.badge > 0 && (
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
              ))}
            </nav>

            <div className={`mt-6 border-t border-border-light dark:border-border-dark pt-6 ${isTutorialActive ? "pointer-events-none" : ""}`}>
              <button
                onClick={handleLogout}
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
        <div className="lg:pl-72 min-h-screen flex flex-col">
          {/* Header */}
          <header className={`sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border-light dark:border-border-dark bg-background-light/80 dark:bg-background-dark/80 px-6 backdrop-blur-xl ${isTutorialActive ? "pointer-events-none" : ""}`}>
            <div className="flex items-center gap-4 lg:hidden">
              <button
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Buka Menu"
                title="Buka Menu"
                className="p-2.5 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-muted"
              >
                <MenuIcon className="h-6 w-6" />
              </button>
              <button
                onClick={handleLogoClick}
                className="text-xl font-black text-primary hover:opacity-80 transition-all focus:outline-none"
              >
                RestoBook
              </button>
            </div>

            <div className="hidden lg:block">
               <h2 className="text-sm font-bold text-muted uppercase tracking-widest">
                  Selamat Datang, <span className="text-text-light dark:text-text-dark">{userProfile?.full_name || "User"}</span>
               </h2>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                data-tour="theme-toggle"
                aria-label={isDarkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
                title={isDarkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
                className="p-2.5 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-muted hover:text-primary transition-all"
              >
                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" /> }
              </button>
              <button
                onClick={() => setIsNotifCenterOpen(true)}
                data-tour="header-notifications"
                className="p-2.5 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-muted hover:text-primary transition-all relative"
                title="Pusat Informasi"
                aria-label="Pusat Informasi"
              >
                <Bell className="h-5 w-5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white">
                    {unreadNotifCount}
                  </span>
                )}
              </button>
              <div data-tour="profile-avatar" className="h-10 w-10 rounded-xl overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black uppercase text-sm">
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  userProfile?.full_name?.charAt(0) || "U"
                )}
              </div>
            </div>
          </header>

          {maintenanceSettings.is_maintenance_active && (
            <div className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white py-3.5 px-6 font-bold text-xs sm:text-sm flex items-center justify-between gap-4 shadow-md border-b border-orange-500/25 z-20">
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

        <NotificationCenterDrawer
          isOpen={isNotifCenterOpen}
          onClose={() => setIsNotifCenterOpen(false)}
          userId={userProfile?.user_id || ""}
          profileId={userProfile?.id || ""}
          role={role || ""}
        />

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm lg:hidden"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed left-0 top-0 z-[9999] h-full w-80 bg-card-light dark:bg-card-dark p-6 lg:hidden"
              >
                <div className="mb-10 flex items-center justify-between px-2">
                  <button
                    onClick={handleLogoClick}
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

                <nav className={`space-y-1.5 overflow-y-auto custom-scrollbar h-[calc(100%-160px)] ${isTutorialActive ? "pointer-events-none" : ""}`}>
                  {getMenuLinks().map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-bold transition-all ${
                        pathname === link.href
                          ? "bg-primary text-white shadow-lg shadow-primary/20"
                          : "text-muted hover:bg-primary/5 hover:text-primary"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <link.icon className="h-5 w-5" />
                        <span>{link.name}</span>
                        {isTransactionRoute(link.href) && maintenanceSettings.is_maintenance_active && role !== "admin" && (
                          <span className="text-[9px] font-black uppercase text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">Maintenance</span>
                        )}
                      </div>
                      {link.badge !== undefined && link.badge > 0 && (
                        <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-black ${
                          pathname === link.href ? "bg-white text-primary" : "bg-rose-500 text-white"
                        }`}>
                          {link.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </nav>

                <div className={`absolute bottom-6 left-6 right-6 ${isTutorialActive ? "pointer-events-none" : ""}`}>
                   <button
                    onClick={handleLogout}
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
