"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Menu as MenuIcon, X, LogOut, Sun, Moon, 
  LayoutDashboard, ShoppingBag, ListOrdered, ClipboardList, 
  CalendarDays, Heart, Bell, User as UserIcon, Users, 
  Settings, Layers, UtensilsCrossed, Star, Receipt, Clock, ShoppingCart, Armchair, RotateCcw, Lock, ShieldAlert, TrendingUp, Zap, Power, Globe
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
    audioRef.current = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    
    checkUser();
    fetchOnlineOrderCount();
    
    // Real-time Listener untuk Pesanan Online Baru
    const channel = supabase
      .channel('sidebar-online-orders')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'orders',
        filter: "order_type=in.(delivery,takeaway)" 
      }, (payload) => {
        // Hanya notif jika (Lunas) ATAU (Tunai)
        const isActionable = payload.new.status === 'pending' && (payload.new.payment_status === 'paid' || payload.new.payment_method === 'cash');
        if (isActionable) {
          playNotifSound();
          toast.success("Ada pesanan online baru masuk!", {
            icon: '🔔',
            duration: 5000,
            position: 'top-right'
          });
          fetchOnlineOrderCount();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: "order_type=eq.delivery"
      }, () => {
        fetchOnlineOrderCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const playNotifSound = () => {
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log("Audio play blocked by browser"));
    }
  };

  const fetchOnlineOrderCount = async () => {
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('order_type', ['delivery', 'takeaway'])
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
    await supabase.auth.signOut();
    router.push("/login");
  };

  const getMenuLinks = () => {
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
          { name: "Absensi", href: "/admin/attendance", icon: ClipboardList },
          { name: "Payroll", href: "/admin/payroll", icon: Receipt },
          { name: "Resign", href: "/admin/resign", icon: Power },
          { name: "Refund", href: "/admin/refunds", icon: RotateCcw },
          { name: "Reviews", href: "/admin/reviews", icon: Star },
          { name: "Settings", href: "/admin/settings", icon: Settings },
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
        ];
      case "customer":
        return [
          { name: "Home", href: "/customer/dashboard", icon: LayoutDashboard },
          { name: "Menu", href: "/customer/menu", icon: UtensilsCrossed },
          { name: "Keranjang", href: "/customer/cart", icon: ShoppingBag },
          { name: "Pesanan Saya", href: "/customer/orders", icon: Clock },
          { name: "Favorit", href: "/customer/favorites", icon: Heart },
          { name: "Reservasi", href: "/customer/reservations", icon: CalendarDays },
          { name: "Notifikasi", href: "/customer/notifications", icon: Bell },
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
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black uppercase text-sm">
                {userProfile?.full_name?.charAt(0) || "U"}
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
