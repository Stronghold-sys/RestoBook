"use client";

import { motion, Variants } from "framer-motion";
import { ArrowRight, Utensils, Star, MapPin, Phone, Mail, Flame, Coffee, IceCream, Sparkles, ChevronRight, LogOut, User, RefreshCw, ShieldAlert, Tag } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useThemeStore } from "@/store/useThemeStore";
import { createClient } from "@/lib/supabase/client";
import { getStoreStatus, getMinutesUntilClose } from "@/utils/operationalHours";
import toast from "react-hot-toast";

const CATEGORY_STYLE_MAP: Record<string, { icon: any; color: string }> = {
  "makanan utama": { icon: Utensils, color: "from-orange-500 to-red-500" },
  "appetizer": { icon: Flame, color: "from-amber-400 to-orange-500" },
  "minuman": { icon: Coffee, color: "from-cyan-500 to-blue-500" },
  "dessert": { icon: IceCream, color: "from-pink-500 to-rose-500" },
  "promo spesial": { icon: Sparkles, color: "from-purple-500 to-violet-600" },
  "promo grand opening": { icon: Sparkles, color: "from-rose-500 to-orange-600" },
};

const getCategoryStyle = (name: string) => {
  const key = name.toLowerCase().trim();
  
  // 1. Direct match first
  if (CATEGORY_STYLE_MAP[key]) {
    return CATEGORY_STYLE_MAP[key];
  }

  // 2. Keyword-based matching helper
  const matches = (keywords: string[]) => keywords.some(kw => key.includes(kw));

  if (matches(["nasi", "goreng", "mie", "sate", "ayam", "daging", "steak", "pasta", "pizza", "burger", "roti", "makanan", "food", "lauk", "sayur", "soup", "sup", "bakso", "seafood", "utama", "main"])) {
    return { icon: Utensils, color: "from-orange-500 to-red-500" };
  }

  if (matches(["minum", "jus", "juice", "kopi", "coffee", "teh", "tea", "susu", "milk", "boba", "drink", "beverage", "es", "ice", "soda"])) {
    return { icon: Coffee, color: "from-cyan-500 to-blue-500" };
  }

  if (matches(["dessert", "kue", "cake", "ice cream", "es krim", "manis", "sweet", "puding", "pudding", "donat", "donut", "pastry", "buah"])) {
    return { icon: IceCream, color: "from-pink-500 to-rose-500" };
  }

  if (matches(["appetizer", "pembuka", "snack", "cemilan", "gorengan", "kentang", "french fries", "ring"])) {
    return { icon: Flame, color: "from-amber-400 to-orange-500" };
  }

  if (matches(["promo", "spesial", "special", "diskon", "murah", "hemat", "grand", "opening", "baru", "new"])) {
    return { icon: Sparkles, color: "from-purple-500 to-violet-600" };
  }

  // 3. Fallback pseudo-random gradient & icon using string hashing
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const fallbackIcons = [Utensils, Flame, Coffee, IceCream, Sparkles, Tag];
  const fallbackGradients = [
    "from-emerald-500 to-teal-600",
    "from-teal-400 to-cyan-500",
    "from-blue-600 to-indigo-700",
    "from-fuchsia-500 to-pink-600",
    "from-red-400 to-orange-500",
    "from-violet-500 to-purple-600",
    "from-pink-500 to-indigo-500"
  ];

  const selectedIcon = fallbackIcons[hash % fallbackIcons.length];
  const selectedGradient = fallbackGradients[hash % fallbackGradients.length];

  return { icon: selectedIcon, color: selectedGradient };
};

// Menu di-fetch dari database secara realtime
// export const MENU_ITEMS = [ ... ]

const fadeUp: Variants = { hidden: { opacity: 0, y: 40 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.5, type: "spring" as const, bounce: 0.3 } }) };
const stagger: Variants = { visible: { transition: { staggerChildren: 0.08 } } };

const DUMMY_REVIEWS = [
  {
    id: "dummy-1",
    rating: 5,
    comment: "Makanannya sangat lezat! Nasi Goreng Spesialnya benar-benar juara. Bumbu meresap sempurna dan porsinya mengenyangkan. Pelayanan ramah dan cepat!",
    is_published: true,
    profiles: {
      full_name: "Budi Santoso"
    }
  },
  {
    id: "dummy-2",
    rating: 5,
    comment: "Suasana restoran sangat nyaman dan bersih. Cocok sekali untuk makan malam bersama keluarga. Jus Alpukatnya sangat kental dan segar, porsi ayam bakar juga empuk sekali.",
    is_published: true,
    profiles: {
      full_name: "Siti Rahma"
    }
  },
  {
    id: "dummy-3",
    rating: 4,
    comment: "Pelayanannya cepat sekali walaupun dalam keadaan ramai di akhir pekan. Sop Buntutnya gurih dan dagingnya empuk. Sangat direkomendasikan untuk pecinta kuliner!",
    is_published: true,
    profiles: {
      full_name: "Andi Wijaya"
    }
  }
];

export default function LandingPage() {
  const initTheme = useThemeStore(state => state.initTheme);
  const [activeCat, setActiveCat] = useState("all");
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [openingTime, setOpeningTime] = useState<string | null>(null);
  const [closingTime, setClosingTime] = useState<string | null>(null);

  const [isTemporaryClosed, setIsTemporaryClosed] = useState<boolean>(false);
  const [isHoliday, setIsHoliday] = useState<boolean>(false);
  const [holidayReopenDate, setHolidayReopenDate] = useState<string>("");
  const [temporaryClosedReopenTime, setTemporaryClosedReopenTime] = useState<string>("");
  const [is24Hours, setIs24Hours] = useState<boolean>(false);
  const [customerWarningMinutes, setCustomerWarningMinutes] = useState<number>(15);
  const [isMaintenance, setIsMaintenance] = useState<boolean>(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>("Restoran sedang dalam perbaikan sistem. Layanan transaksi belum tersedia sementara waktu. Silakan kembali nanti.");

  // DYNAMIC CONTACT & ADDRESS IDENTITY
  const [resName, setResName] = useState<string>("RestoBook");
  const [resAddr, setResAddr] = useState<string>("Jl. Contoh No. 123, Jakarta");
  const [resPhone, setResPhone] = useState<string>("021-12345678");
  const [resEmail, setResEmail] = useState<string>("info@restobook.com");

  const [user, setUser] = useState<any>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Pull to Refresh State
  const [pullDistance, setPullDistance] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const supabase = createClient();

  // Fetch functions declared in component scope
  const fetchMenu = async () => {
    const { data } = await supabase.from('menu_items').select('*, categories(name)').order('name');
    if (data) setMenuItems(data.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description || "",
      price: item.price,
      image: item.image_url || "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop",
      cat: item.categories?.name || "Lainnya",
      is_active: item.is_active
    })));
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('sort_order', { ascending: true });
    if (data) setCategories(data);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from("restaurant_settings").select("*").single();
    if (data) {
      setOpeningTime(data.opening_time);
      setClosingTime(data.closing_time);
      setIsTemporaryClosed(!!data.is_temporary_closed);
      setIsHoliday(!!data.is_holiday);
      setHolidayReopenDate(data.holiday_reopen_date || "Besok");
      setTemporaryClosedReopenTime(data.temporary_closed_reopen_time || "12:00");
      setIs24Hours(!!data.is_24_hours);
      setCustomerWarningMinutes(data.customer_warning_minutes !== null && data.customer_warning_minutes !== undefined ? Number(data.customer_warning_minutes) : 15);
      setIsMaintenance(!!data.is_maintenance_active);
      if (data.maintenance_message) setMaintenanceMessage(data.maintenance_message);
      
      // Hydrate identity fields
      if (data.name) setResName(data.name);
      if (data.address) setResAddr(data.address);
      if (data.phone) setResPhone(data.phone);
      if (data.email) setResEmail(data.email);
    }
  };

  const fetchPublishedReviews = async () => {
    try {
      const res = await fetch(`/api/reviews?t=${Date.now()}`, { cache: 'no-store' });
      const json = await res.json();
      const liveReviews = (json.data || []) as any[];

      // Ulasan asli: SELALU percaya database, JANGAN pakai localStorage
      const publishedLive = liveReviews.filter((r: any) => r.is_published === true);

      // Ulasan dummy: pakai localStorage untuk toggle
      const storedStates = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("review-publish-states") || "{}") : {};
      const publishedDummies = DUMMY_REVIEWS
        .map(d => ({ ...d, is_published: storedStates[d.id] !== undefined ? storedStates[d.id] : d.is_published }))
        .filter(d => d.is_published);

      setReviews([...publishedLive, ...publishedDummies.filter(d => !publishedLive.some((r: any) => r.id === d.id))]);
    } catch (e) {
      console.error("Error fetching reviews:", e);
    }
  };

  // Touch event handlers for Pull-to-Refresh
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing) {
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && touchStart > 0 && !isRefreshing) {
      const currentY = e.touches[0].clientY;
      const distance = currentY - touchStart;
      if (distance > 0) {
        // Pulling down - apply resistance
        const pull = Math.min(80, distance * 0.4);
        setPullDistance(pull);
      }
    }
  };

  const handleTouchEnd = async () => {
    setTouchStart(0);
    if (pullDistance >= 50 && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(0);
      try {
        await Promise.all([
          fetchMenu(),
          fetchCategories(),
          fetchSettings(),
          fetchPublishedReviews()
        ]);
        // Delay to show the skeleton animation clearly
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } catch (err) {
        console.error("Refresh failed:", err);
      } finally {
        setIsRefreshing(false);
        toast.success("Halaman berhasil diperbarui!");
      }
    } else {
      setPullDistance(0);
    }
  };

  useEffect(() => { 
    initTheme(); 
    
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', session.user.id).single();
        if (profile) {
          setUser({ ...session.user, ...profile });
        }
      }
    };
    checkSession();
    
    fetchMenu();
    fetchCategories();
    fetchSettings();
    fetchPublishedReviews();

    // Realtime Sync
    const channel = supabase.channel("public_menu")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, () => {
        fetchMenu();
      })
      .subscribe();

    const categoriesChannel = supabase.channel("public_categories")
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => {
        fetchCategories();
      })
      .subscribe();

    const reviewsChannel = supabase.channel("public_reviews")
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, () => {
        fetchPublishedReviews();
      })
      .subscribe();

    // Subscribe to settings changes
    const settingsChannel = supabase.channel("public_settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_settings" }, (payload: any) => {
        if (payload.new) {
          setOpeningTime(payload.new.opening_time);
          setClosingTime(payload.new.closing_time);
          setIsTemporaryClosed(!!payload.new.is_temporary_closed);
          setIsHoliday(!!payload.new.is_holiday);
          setHolidayReopenDate(payload.new.holiday_reopen_date || "Besok");
          setTemporaryClosedReopenTime(payload.new.temporary_closed_reopen_time || "12:00");
          setIs24Hours(!!payload.new.is_24_hours);
          setCustomerWarningMinutes(payload.new.customer_warning_minutes !== null && payload.new.customer_warning_minutes !== undefined ? Number(payload.new.customer_warning_minutes) : 15);
          setIsMaintenance(!!payload.new.is_maintenance_active);
          if (payload.new.maintenance_message) setMaintenanceMessage(payload.new.maintenance_message);
          
          if (payload.new.name) setResName(payload.new.name);
          if (payload.new.address) setResAddr(payload.new.address);
          if (payload.new.phone) setResPhone(payload.new.phone);
          if (payload.new.email) setResEmail(payload.new.email);
        }
      })
      .subscribe();

    const syncChannel = supabase.channel('reviews-sync-signal')
      .on('broadcast', { event: 'refresh' }, () => {
        fetchPublishedReviews();
      })
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
      supabase.removeChannel(categoriesChannel);
      supabase.removeChannel(reviewsChannel);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(syncChannel);
    };
  }, [initTheme]);

  const filtered = activeCat === "all" ? menuItems : menuItems.filter(i => i.cat === activeCat);
  const storeStatus = getStoreStatus(openingTime, closingTime, isTemporaryClosed, isHoliday, holidayReopenDate, temporaryClosedReopenTime, is24Hours);
  const isOpen = storeStatus.isOpen;
  const statusMessage = storeStatus.message;
  const minsUntilClose = closingTime ? getMinutesUntilClose(closingTime) : 999;
  const isClosingSoon = isOpen && minsUntilClose <= customerWarningMinutes && minsUntilClose > 0;

  return (
    <div 
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-screen bg-background-light dark:bg-background-dark overflow-hidden transition-colors duration-300"
    >
      {/* Pull to Refresh Indicator */}
      {pullDistance > 0 && (
        <div 
          style={{ transform: `translateY(${pullDistance}px)` }} 
          className="fixed top-0 left-0 right-0 z-[100] flex justify-center pointer-events-none transition-transform duration-75"
        >
          <div className="bg-white dark:bg-card-dark p-2.5 rounded-full shadow-lg border border-border-light dark:border-border-dark flex items-center justify-center mt-4">
            <motion.div
              animate={{ rotate: pullDistance * 4 }}
              className="text-primary"
            >
              <RefreshCw className="w-5 h-5" />
            </motion.div>
          </div>
        </div>
      )}

      {isRefreshing && (
        <div className="fixed top-24 left-0 right-0 z-[100] flex justify-center pointer-events-none">
          <div className="bg-primary text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold animate-bounce">
            <RefreshCw className="w-4 h-4 animate-spin" /> Memperbarui...
          </div>
        </div>
      )}
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-card-dark/80 backdrop-blur-md border-b border-border-light dark:border-border-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-all focus:outline-none"
            >
              <div className="p-2 bg-primary/10 rounded-xl"><Utensils className="w-6 h-6 text-primary" /></div>
              <span className="text-xl font-bold text-text-light dark:text-text-dark whitespace-nowrap">Resto<span className="text-primary">Book</span></span>
            </button>
            <div className="flex gap-4 items-center">
              {user ? (
                <div className="relative">
                  <button 
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark p-1 pr-4 rounded-full hover:shadow-md transition-all"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center border border-primary/20">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-primary" />
                      )}
                    </div>
                    <span className="font-bold text-sm text-text-light dark:text-text-dark truncate max-w-[100px] capitalize">{user.full_name?.split(' ')[0] || "User"}</span>
                  </button>
                  
                  {/* Dropdown */}
                  {showDropdown && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute right-0 mt-2 w-52 bg-white dark:bg-card-dark rounded-2xl shadow-xl border border-border-light dark:border-border-dark py-2 z-50 overflow-hidden"
                    >
                      <Link href={`/${user.role === 'customer' ? 'customer/menu' : user.role === 'kitchen' ? 'kitchen/queue' : user.role === 'cashier' ? 'cashier/transactions' : 'admin/dashboard'}`}>
                        <button className="w-full text-left px-4 py-3 text-sm font-bold text-text-light dark:text-text-dark hover:bg-primary/5 hover:text-primary transition-colors flex items-center gap-3">
                          <Utensils className="w-4 h-4" /> Masuk Dashboard
                        </button>
                      </Link>
                      <button 
                        onClick={async () => {
                          try {
                            await fetch('/api/auth/logout', { method: 'POST' });
                          } catch (e) {
                            console.error('API logout failed', e);
                          }
                          await supabase.auth.signOut();
                          setUser(null);
                          setShowDropdown(false);
                          window.location.href = "/";
                        }}
                        className="w-full text-left px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3"
                      >
                        <LogOut className="w-4 h-4" /> Keluar
                      </button>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="flex gap-2 sm:gap-4 items-center shrink-0">
                  <Link href="/login" className="text-text-light dark:text-text-dark hover:text-primary transition-colors font-semibold text-sm sm:text-base px-2 sm:px-4">Masuk</Link>
                  <Link href="/register">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-primary text-white px-3 py-2 sm:px-5 sm:py-2.5 rounded-full font-semibold text-xs sm:text-base shadow-lg hover:shadow-primary/30 transition-all">
                      <span className="hidden sm:inline">Daftar Sekarang</span>
                      <span className="sm:hidden">Daftar</span>
                    </motion.button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Operational Hours Banner - Maintenance overrides normal status */}
      {isMaintenance ? (
        <div className="fixed safe-top-banner w-full z-40 py-2.5 px-4 text-center text-sm font-bold transition-all duration-300 border-b shadow-sm backdrop-blur-md bg-orange-500/15 dark:bg-orange-500/25 text-orange-700 dark:text-orange-400 border-orange-500/25">
          <div className="flex items-center justify-center gap-2">
            <ShieldAlert className="h-4 w-4 animate-pulse flex-shrink-0" />
            <span>Restoran Sementara <strong>TUTUP</strong> — Sistem sedang dalam maintenance. Kami akan segera kembali!</span>
          </div>
        </div>
      ) : (
        <div className={`fixed safe-top-banner w-full z-40 py-2.5 px-4 text-center text-sm font-semibold transition-all duration-300 border-b shadow-sm backdrop-blur-md ${
          isClosingSoon
            ? "bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20"
            : isOpen 
              ? "bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" 
              : "bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20"
        }`}>
          <div className="flex items-center justify-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isClosingSoon ? "bg-amber-500 animate-pulse" : isOpen ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <span>
              {isClosingSoon 
                ? `Pemberitahuan: Resto segera tutup dalam ${minsUntilClose} menit! Silakan segera selesaikan pemesanan Anda.`
                : statusMessage
              }
            </span>
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="relative safe-top-hero pb-20 lg:pt-48 lg:pb-28 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, type: "spring", bounce: 0.4 }} className="text-center lg:text-left">
            {isMaintenance ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold text-sm mb-6 border border-orange-500/25">
                <ShieldAlert className="w-4 h-4 animate-pulse" /> Sedang Maintenance — Sementara Tutup
              </motion.div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm mb-6">
                <Star className="w-4 h-4 fill-primary" /> Restoran Pilihan No. 1
              </motion.div>
            )}
            <h1 className="text-5xl lg:text-6xl font-extrabold text-text-light dark:text-text-dark leading-tight mb-6">
              {isMaintenance ? (
                <>Kami Sedang <span className="text-orange-500">Maintenance.</span></>
              ) : (
                <>Nikmati Hidangan Spesial, <span className="text-primary">Tanpa Antre.</span></>
              )}
            </h1>
            <p className="text-lg text-muted mb-8 max-w-xl mx-auto lg:mx-0">
              {isMaintenance
                ? maintenanceMessage
                : "Pesan makanan favorit Anda atau reservasi meja secara online dengan mudah dan cepat."
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              {isMaintenance ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 px-6 py-4 bg-orange-500/10 border border-orange-500/25 rounded-full text-orange-700 dark:text-orange-400 font-bold text-sm"
                >
                  <ShieldAlert className="w-5 h-5 animate-pulse" />
                  Transaksi tidak tersedia saat ini
                </motion.div>
              ) : (
                <>
                  <Link href={user ? `/${user.role === 'customer' ? 'customer/menu' : user.role === 'kitchen' ? 'kitchen/queue' : user.role === 'cashier' ? 'cashier/transactions' : 'admin/dashboard'}` : "/login"}>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto bg-primary text-white px-8 py-4 rounded-full font-bold shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-all flex items-center justify-center gap-2">
                      {user ? "Masuk Dashboard" : "Pesan Sekarang"} <ArrowRight className="w-5 h-5" />
                    </motion.button>
                  </Link>
                  <a href="#menu">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="w-full sm:w-auto bg-white dark:bg-card-dark text-text-light dark:text-text-dark border border-border-light dark:border-border-dark px-8 py-4 rounded-full font-bold shadow-sm hover:border-primary transition-colors flex items-center justify-center">
                      Lihat Menu
                    </motion.button>
                  </a>
                </>
              )}
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2, type: "spring" }} className="relative h-[400px] lg:h-[550px] rounded-[2rem] overflow-hidden shadow-2xl">
            <Image src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=1200" alt="Restaurant Interior" fill className="object-cover transition-transform duration-700 hover:scale-105" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-8 left-8 right-8 text-white">
              <div className="flex gap-1 text-accent mb-3">{[1,2,3,4,5].map(i => <Star key={i} className="w-5 h-5 fill-current" />)}</div>
              <p className="font-medium text-lg leading-snug">&quot;Suasana yang luar biasa elegan dan makanan yang sangat lezat!&quot;</p>
              <p className="text-white/70 text-sm mt-2">- Sarah Johnson, Food Critic</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Promo Banner */}
      <section className="px-4 pb-16">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div whileHover={{ scale: 1.02 }} className="relative h-56 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
              <Image src="https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=400&fit=crop" alt="Promo Keluarga" fill className="object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-transparent" />
              <div className="absolute inset-0 p-8 flex flex-col justify-center text-white">
                <span className="text-xs font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full w-fit mb-3">Promo Spesial</span>
                <h3 className="text-2xl font-bold mb-1">Paket Hemat Keluarga</h3>
                <p className="text-white/90 text-sm">Hemat hingga 30% untuk makan bersama keluarga!</p>
                <p className="text-3xl font-extrabold mt-3">Rp 120.000</p>
              </div>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} className="relative h-56 rounded-2xl overflow-hidden shadow-xl cursor-pointer group">
              <Image src="https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=400&fit=crop" alt="Combo Steak" fill className="object-cover group-hover:scale-110 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-r from-violet-700/90 to-transparent" />
              <div className="absolute inset-0 p-8 flex flex-col justify-center text-white">
                <span className="text-xs font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full w-fit mb-3">Best Seller</span>
                <h3 className="text-2xl font-bold mb-1">Combo Steak &amp; Wine</h3>
                <p className="text-white/90 text-sm">Steak tenderloin premium + salad + dessert + minuman</p>
                <p className="text-3xl font-extrabold mt-3">Rp 150.000</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="px-4 pb-12">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-10">
            <h2 className="text-3xl lg:text-4xl font-extrabold text-text-light dark:text-text-dark">Kategori <span className="text-primary">Menu</span></h2>
            <p className="text-muted mt-3">Pilih kategori untuk melihat hidangan favorit Anda</p>
          </motion.div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {categories.length === 0 ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <div key={`cat-skeleton-${idx}`} className="bg-gray-200/10 dark:bg-gray-800/10 rounded-2xl p-6 h-32 animate-pulse flex flex-col justify-between border border-border-light dark:border-border-dark">
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full" />
                  <div className="w-3/4 h-5 bg-gray-200 dark:bg-gray-700 rounded-md" />
                  <div className="w-1/2 h-4 bg-gray-200 dark:bg-gray-700 rounded-md" />
                </div>
              ))
            ) : (
              categories.map((cat, i) => {
                const { icon: Icon, color } = getCategoryStyle(cat.name);
                const count = menuItems.filter(item => item.cat === cat.name).length;
                return (
                  <motion.div key={cat.id || cat.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} whileHover={{ y: -8, scale: 1.03 }} onClick={() => { setActiveCat(cat.name === activeCat ? "all" : cat.name); document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" }); }} className={`relative bg-gradient-to-br ${color} rounded-2xl p-6 text-white cursor-pointer shadow-lg overflow-hidden group ${activeCat === cat.name ? "ring-4 ring-white/60 scale-105" : ""}`}>
                    <div className="absolute -right-3 -bottom-3 opacity-10 group-hover:opacity-20 transition-opacity"><Icon className="w-24 h-24" /></div>
                    <Icon className="w-8 h-8 mb-3" />
                    <h3 className="font-bold text-lg">{cat.name}</h3>
                    <p className="text-white/80 text-sm mt-1">{count} Menu</p>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </section>

      {/* Menu Grid */}
      <section id="menu" className="px-4 pb-20">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-text-light dark:text-text-dark">Menu <span className="text-primary">Populer</span></h2>
              <p className="text-muted mt-2">{filtered.length} hidangan tersedia {activeCat !== "all" ? `di ${activeCat}` : ""}</p>
            </div>
            {activeCat !== "all" && <button onClick={() => setActiveCat("all")} className="text-primary font-medium hover:underline text-sm flex items-center gap-1">Lihat Semua <ChevronRight className="w-4 h-4" /></button>}
          </motion.div>

          <motion.div layout initial="hidden" animate="visible" variants={stagger} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {isRefreshing ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <div key={`menu-skeleton-${idx}`} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark p-5 flex flex-col gap-4">
                  <div className="skeleton skeleton-image h-48 w-full" />
                  <div className="skeleton skeleton-title w-3/4 h-6 mt-2" />
                  <div className="skeleton skeleton-text w-full h-4" />
                  <div className="skeleton skeleton-text w-5/6 h-4" />
                  <div className="flex justify-between items-center mt-auto pt-3 border-t border-border-light/50 dark:border-border-dark/50">
                    <div className="skeleton skeleton-badge w-24 h-6" />
                    <div className="skeleton skeleton-btn w-16 h-8" />
                  </div>
                </div>
              ))
            ) : (
              filtered.map((item, i) => (
                <motion.div key={item.id || item.name} layout custom={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} whileHover={{ y: item.is_active ? -10 : 0, boxShadow: item.is_active ? "0 25px 50px -12px rgba(0,0,0,0.15)" : "none" }} className={`bg-card-light dark:bg-card-dark rounded-2xl overflow-hidden border border-border-light dark:border-border-dark group relative flex flex-col ${!item.is_active ? 'opacity-70 grayscale' : ''}`}>
                  <div className="relative h-48 w-full overflow-hidden">
                    <Image src={item.image} alt={item.name} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute top-3 left-3"><span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-white/90 dark:bg-black/60 text-primary backdrop-blur-sm">{item.cat}</span></div>
                    
                    {!item.is_active && (
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                        <span className="bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-black uppercase tracking-widest transform -rotate-12 border-2 border-white shadow-xl">Habis</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className={`font-bold text-lg text-text-light dark:text-text-dark mb-1 ${!item.is_active ? 'line-through text-muted' : ''}`}>{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-muted line-clamp-2 mb-3 leading-relaxed flex-1">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-auto pt-3">
                      <span className="font-extrabold text-xl text-primary">Rp {item.price.toLocaleString("id-ID")}</span>
                      {item.is_active ? (
                        <Link href="/login">
                          <motion.button whileTap={{ scale: 0.9 }} className="px-4 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-sm font-medium transition-colors">Pesan</motion.button>
                        </Link>
                      ) : (
                        <button disabled className="px-4 py-2 bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded-xl text-sm font-medium cursor-not-allowed border border-gray-300 dark:border-gray-700">Habis</button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mt-12">
            {user ? (
              <Link href={`/${user.role === 'customer' ? 'customer/menu' : user.role === 'kitchen' ? 'kitchen/queue' : user.role === 'cashier' ? 'cashier/transactions' : 'admin/dashboard'}`}>
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-primary text-white px-10 py-4 rounded-full font-bold text-lg shadow-xl shadow-primary/30 inline-flex items-center gap-2">
                  Lanjut Pesan Sekarang <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
            ) : (
              <Link href="/register">
                <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="bg-primary text-white px-10 py-4 rounded-full font-bold text-lg shadow-xl shadow-primary/30 inline-flex items-center gap-2">
                  Daftar & Pesan Sekarang <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* Testimonials / Reviews Section */}
      <section className="px-4 pb-24 bg-gray-50/50 dark:bg-card-dark/30 py-20 border-t border-b border-border-light dark:border-border-dark">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <span className="text-xs font-black uppercase tracking-wider text-primary bg-primary/10 px-3 py-1.5 rounded-full">Testimoni Pelanggan</span>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-text-light dark:text-text-dark mt-4">Apa Kata <span className="text-primary">Pelanggan Kami?</span></h2>
            <p className="text-muted mt-3">Ulasan jujur langsung dari pelanggan setia RestoBook</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {isRefreshing ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={`rev-skeleton-${idx}`} className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark p-6 shadow-md flex flex-col gap-4">
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <div key={s} className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700" />
                    ))}
                  </div>
                  <div className="skeleton skeleton-text w-full h-4 mt-2" />
                  <div className="skeleton skeleton-text w-5/6 h-4" />
                  <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border-light dark:border-border-dark">
                    <div className="skeleton skeleton-avatar w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton skeleton-text w-20 h-4" />
                      <div className="skeleton skeleton-text w-16 h-3" />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              reviews.slice(0, 6).map((rev, i) => (
                <motion.div 
                  key={rev.id} 
                  initial={{ opacity: 0, y: 20 }} 
                  whileInView={{ opacity: 1, y: 0 }} 
                  viewport={{ once: true }} 
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -8 }}
                  className="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark p-6 shadow-md flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star key={star} className={`w-5 h-5 ${star <= rev.rating ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"}`} />
                      ))}
                    </div>
                    <p className="text-sm text-text-light dark:text-text-dark leading-relaxed italic font-medium">&quot;{rev.comment}&quot;</p>
                  </div>
                  <div className="flex items-center gap-3 mt-6 pt-4 border-t border-border-light dark:border-border-dark">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {rev.profiles?.full_name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-text-light dark:text-text-dark">{rev.profiles?.full_name || "Anonim"}</h4>
                      <p className="text-xs text-muted">Pelanggan Terverifikasi</p>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Lokasi / Google Maps Section */}
      <section className="px-4 py-20 bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Side: Address Info */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }} 
              whileInView={{ opacity: 1, x: 0 }} 
              viewport={{ once: true }} 
              className="space-y-6"
            >
              <span className="text-xs font-black uppercase tracking-wider text-primary bg-primary/10 px-3 py-1.5 rounded-full">Lokasi Restoran</span>
              <h2 className="text-3xl lg:text-4xl font-extrabold text-text-light dark:text-text-dark">Kunjungi <span className="text-primary">{resName}</span></h2>
              <p className="text-muted leading-relaxed">
                Kami berlokasi di tempat yang strategis dan mudah dijangkau. Datang dan nikmati hidangan lezat kami bersama teman atau keluarga Anda.
              </p>
              
              <div className="space-y-4 pt-4 border-t border-border-light dark:border-border-dark">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl text-primary shrink-0"><MapPin className="w-6 h-6" /></div>
                  <div>
                    <h4 className="font-bold text-text-light dark:text-text-dark text-base">Alamat Lengkap</h4>
                    <p className="text-sm text-muted mt-1 leading-relaxed">{resAddr}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl text-primary shrink-0"><Phone className="w-6 h-6" /></div>
                  <div>
                    <h4 className="font-bold text-text-light dark:text-text-dark text-base">Hubungi Kami</h4>
                    <p className="text-sm text-muted mt-1">{resPhone}</p>
                  </div>
                </div>
                {resEmail && (
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl text-primary shrink-0"><Mail className="w-6 h-6" /></div>
                    <div>
                      <h4 className="font-bold text-text-light dark:text-text-dark text-base">Email Dukungan</h4>
                      <p className="text-sm text-muted mt-1">{resEmail}</p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Right Side: Google Maps Frame */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }} 
              whileInView={{ opacity: 1, x: 0 }} 
              viewport={{ once: true }} 
              className="relative w-full h-[400px] rounded-3xl overflow-hidden shadow-2xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark"
            >
              {resAddr && (
                <iframe
                  title="Google Maps"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(resAddr)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                  className="filter dark:brightness-90 dark:contrast-105"
                />
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card-light dark:bg-card-dark border-t border-border-light dark:border-border-dark py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-muted">
          &copy; {new Date().getFullYear()} RestoBook. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
