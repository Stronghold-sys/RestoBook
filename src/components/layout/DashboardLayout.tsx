"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Menu as MenuIcon, X, LogOut, Sun, Moon, 
  LayoutDashboard, ShoppingBag, ListOrdered, ClipboardList, 
  CalendarDays, Heart, Bell, User as UserIcon, Users, 
  Settings, Layers, UtensilsCrossed, Star, Receipt, Clock, ShoppingCart, Armchair, RotateCcw, Lock, ShieldAlert, TrendingUp, Zap, Power, Globe, Ticket, Gift, Wallet
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface DashboardLayoutProps {
  children: React.ReactNode;
  role?: string;
}

export default function DashboardLayout({ children, role: initialRole }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [role, setRole] = useState<string | null>(initialRole || null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [onlineOrderCount, setOnlineOrderCount] = useState(0);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Inisialisasi Audio Notifikasi
    // Inisialisasi Audio Notifikasi (Announcement Style)
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/951/951-preview.mp3");
    audioRef.current.volume = 1.0;
    audioRef.current.loop = false;
    
    checkUser();
    fetchOnlineOrderCount();
    
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .single();

    if (profile) {
      setRole(profile.role);
      setUserProfile(profile);
    }
  };

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
          { name: "Reviews", href: "/admin/reviews", icon: Star },
          { name: "Reward Point", href: "/admin/rewards", icon: Gift },
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
          { name: "Notifikasi", href: "/customer/notifications", icon: Bell },
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
            <div className="mb-10 flex items-center gap-3 px-2">
              <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <UtensilsCrossed className="text-white h-6 w-6" />
              </div>
              <span className="text-2xl font-black tracking-tight text-primary">RestoBook</span>
            </div>

            <nav className="flex-1 space-y-1.5 overflow-y-auto pr-2 custom-scrollbar">
              {getMenuLinks().map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group relative flex items-center justify-between rounded-2xl px-4 py-3.5 text-sm font-bold transition-all ${
                    pathname === link.href
                      ? "bg-primary text-white shadow-lg shadow-primary/20"
                      : "text-muted hover:bg-primary/5 hover:text-primary"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <link.icon className={`h-5 w-5 ${pathname === link.href ? "text-white" : "text-muted group-hover:text-primary"}`} />
                    {link.name}
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

            <div className="mt-6 border-t border-border-light dark:border-border-dark pt-6">
              <button
                onClick={handleLogout}
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
          <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-border-light dark:border-border-dark bg-background-light/80 dark:bg-background-dark/80 px-6 backdrop-blur-xl">
            <div className="flex items-center gap-4 lg:hidden">
              <button
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Buka Menu"
                title="Buka Menu"
                className="p-2.5 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-muted"
              >
                <MenuIcon className="h-6 w-6" />
              </button>
              <span className="text-xl font-black text-primary">RestoBook</span>
            </div>

            <div className="hidden lg:block">
               <h2 className="text-sm font-bold text-muted uppercase tracking-widest">
                  Selamat Datang, <span className="text-text-light dark:text-text-dark">{userProfile?.full_name || "User"}</span>
               </h2>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                aria-label={isDarkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
                title={isDarkMode ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
                className="p-2.5 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-muted hover:text-primary transition-all"
              >
                {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" /> }
              </button>
              <div className="h-10 w-10 rounded-xl overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black uppercase text-sm">
                {userProfile?.avatar_url ? (
                  <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  userProfile?.full_name?.charAt(0) || "U"
                )}
              </div>
            </div>
          </header>

          <main className="flex-1">
            {children}
          </main>
        </div>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed left-0 top-0 z-50 h-full w-80 bg-card-light dark:bg-card-dark p-6 lg:hidden"
              >
                <div className="mb-10 flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                      <UtensilsCrossed className="text-white h-6 w-6" />
                    </div>
                    <span className="text-2xl font-black tracking-tight text-primary">RestoBook</span>
                  </div>
                  <button 
                    onClick={() => setIsSidebarOpen(false)} 
                    aria-label="Tutup Menu"
                    title="Tutup Menu"
                    className="p-2 text-muted"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <nav className="space-y-1.5 overflow-y-auto custom-scrollbar h-[calc(100%-160px)]">
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
                        {link.name}
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

                <div className="absolute bottom-6 left-6 right-6">
                   <button
                    onClick={handleLogout}
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
      </div>
    </div>
  );
}
