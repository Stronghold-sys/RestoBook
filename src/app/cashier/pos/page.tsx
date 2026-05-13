"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Loader, ExternalLink, Plus, Minus, Trash2, CreditCard, Banknote, Receipt as ReceiptIcon, X, CheckCircle, Clock, Utensils, UtensilsCrossed, MonitorSmartphone, Printer, Ban, QrCode, Smartphone, Check, AlertTriangle, Globe, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import Receipt from "@/components/Receipt";
import { generateQRISString, getEWalletDeepLink } from "@/utils/qris";
import { isRestaurantOpen as originalIsRestaurantOpen, getOperationalStatus } from "@/utils/operationalHours";

export default function POSPage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Cart State
  const [cart, setCart] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [cashierName, setCashierName] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [discount, setDiscount] = useState<{ type: "percent" | "nominal", value: number, code: string } | null>(null);
  const [discountInput, setDiscountInput] = useState("");
  
  // Session State
  const [isOrderSessionActive, setIsOrderSessionActive] = useState(false);
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway" | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [tables, setTables] = useState<any[]>([]);
  
  // Online Order Search
  const [onlineSearchMode, setOnlineSearchMode] = useState<"dine_in" | "takeaway">("dine_in");
  const [searchOrderNo, setSearchOrderNo] = useState("");
  const [searchTableNo, setSearchTableNo] = useState("");
  const [foundOrder, setFoundOrder] = useState<any>(null);
  const [searchingOrder, setSearchingOrder] = useState(false);
  const [outOfStockItem, setOutOfStockItem] = useState<any | null>(null);
  
  // Payment State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "non_cash">("cash");
  const [cashAmount, setCashAmount] = useState<number | "">("");
  const [processing, setProcessing] = useState(false);
  
  // Non-Cash State
  const [verificationStep, setVerificationStep] = useState<"select_method" | "instructions" | "verify" | "duitku_waiting" | "duitku_pop_active" | "duitku_embedded">("select_method");
  const [nonCashType, setNonCashType] = useState<"ewallet" | "transfer" | "qris" | "other" | "online_duitku" | "">("online_duitku");
  const [nonCashProvider, setNonCashProvider] = useState<string>("");
  const [duitkuMethod, setDuitkuMethod] = useState("");
  const [activeDuitkuUrl, setActiveDuitkuUrl] = useState<string>("");
  
  // Dynamic Merchant & Transaction state
  const [merchant, setMerchant] = useState({
    merchantName: "RESTOBOOK POS",
    merchantId: "ID1020304050607",
    merchantCode: "93600002",
    city: "JAKARTA",
    postalCode: "12345",
    categoryCode: "5812",
    gopay: "08123456789",
    ovo: "08123456789",
    dana: "08123456789",
    shopeepay: "08123456789",
    linkaja: "08123456789"
  });
  const [txId, setTxId] = useState("");
  const [qrisTimer, setQrisTimer] = useState(600);
  const [qrisExpired, setQrisExpired] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (showPaymentModal) {
      setTxId(`TX${Date.now().toString().slice(-8)}`);
      setQrisTimer(600);
      setQrisExpired(false);
      
      const saved = localStorage.getItem("restaurant_merchant_settings");
      if (saved) {
        try {
          setMerchant(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [showPaymentModal]);

  // Timer countdown for cashier QRIS
  useEffect(() => {
    if (showPaymentModal && paymentMethod === "non_cash" && (nonCashType === "qris" || nonCashType === "ewallet")) {
      setQrisTimer(600);
      setQrisExpired(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setQrisTimer(prev => {
          if (prev <= 1) {
            setQrisExpired(true);
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [showPaymentModal, paymentMethod, nonCashType]);

  // Polling for Duitku Payment Status
  useEffect(() => {
    let pollingTimer: NodeJS.Timeout;
    if (verificationStep === "duitku_waiting" && foundOrder?.id) {
      pollingTimer = setInterval(async () => {
        const { data } = await supabase.from('orders').select('payment_status').eq('id', foundOrder.id).single();
        if (data && data.payment_status === 'paid') {
          clearInterval(pollingTimer);
          toast.success("Pembayaran online berhasil dikonfirmasi!");
          processPayment(true, "Pembayaran Online");
        }
      }, 3000);
    }
    return () => {
      if (pollingTimer) clearInterval(pollingTimer);
    };
  }, [verificationStep, foundOrder]);

  const forceCloseDuitku = () => {
    const iframes = document.getElementsByTagName('iframe');
    for (let i = 0; i < iframes.length; i++) {
      const src = iframes[i].getAttribute('src') || '';
      if (src.includes('duitku')) {
        const wrapper = iframes[i].parentElement;
        if (wrapper && wrapper !== document.body) {
          wrapper.remove();
        } else {
          iframes[i].remove();
        }
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };
  
  // Receipt State
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [showReceipts, setShowReceipts] = useState(false);
  const receiptKasirRef = useRef<HTMLDivElement>(null);
  const receiptPelangganRef = useRef<HTMLDivElement>(null);
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [openingTime, setOpeningTime] = useState<string | null>(null);
  const [closingTime, setClosingTime] = useState<string | null>(null);
  const [is24Hours, setIs24Hours] = useState<boolean>(false);

  const isRestaurantOpen = (openTime?: string | null, closeTime?: string | null) => {
    return is24Hours || originalIsRestaurantOpen(openTime, closeTime);
  };

  const supabase = createClient();

  useEffect(() => {
    fetchInitialData();
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Realtime Settings Subscription
    const settingsChannel = supabase.channel("pos_settings")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_settings" }, (payload: any) => {
        if (payload.new) {
          setOpeningTime(payload.new.opening_time);
          setClosingTime(payload.new.closing_time);
          setIs24Hours(!!payload.new.is_24_hours);
        }
      })
      .subscribe();
    
    const broadcastChannel = supabase.channel("settings-sync-channel")
      .on("broadcast", { event: "settings_updated" }, async () => {
        const { data } = await supabase.from("restaurant_settings").select("*").single();
        if (data) {
          setOpeningTime(data.opening_time);
          setClosingTime(data.closing_time);
          setIs24Hours(!!data.is_24_hours);
        }
      })
      .subscribe();
    
    // Realtime Tables
    const tablesChannel = supabase.channel("pos_tables")
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, (payload) => {
        setTables(prev => {
          if (payload.eventType === "INSERT") return [...prev, payload.new].sort((a,b)=>a.table_number - b.table_number);
          if (payload.eventType === "UPDATE") return prev.map(t => t.id === payload.new.id ? payload.new : t);
          if (payload.eventType === "DELETE") return prev.filter(t => t.id !== payload.old.id);
          return prev;
        });
      })
      .subscribe();

    const menuChannel = supabase.channel("pos_menu")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_items" }, (payload) => {
        setMenuItems(prev => {
          if (payload.eventType === "INSERT") return [...prev, payload.new].sort((a,b)=>a.name.localeCompare(b.name));
          if (payload.eventType === "UPDATE") return prev.map(m => m.id === payload.new.id ? payload.new : m);
          if (payload.eventType === "DELETE") return prev.filter(m => m.id !== payload.old.id);
          return prev;
        });
      })
      .subscribe();

    const categoriesChannel = supabase.channel("pos_categories")
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, (payload) => {
        setCategories(prev => {
          if (payload.eventType === "INSERT") return [...prev, payload.new].sort((a,b)=>a.name.localeCompare(b.name));
          if (payload.eventType === "UPDATE") return prev.map(c => c.id === payload.new.id ? payload.new : c);
          if (payload.eventType === "DELETE") return prev.filter(c => c.id !== payload.old.id);
          return prev;
        });
      })
      .subscribe();

    // Fast backup sync poll (every 3 seconds) for bulletproof realtime experience
    const backupInterval = setInterval(() => {
      fetchMenuItemsOnly();
      fetchTablesOnly();
    }, 3000);

    return () => {
      clearInterval(timer);
      clearInterval(backupInterval);
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(categoriesChannel);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(broadcastChannel);
    };
  }, []);

  const fetchMenuItemsOnly = async () => {
    try {
      const { data } = await supabase.from("menu_items").select("*").order("name");
      if (data) setMenuItems(data);
    } catch (e) {
      console.error("POS menu poll error:", e);
    }
  };

  const fetchTablesOnly = async () => {
    try {
      const { data } = await supabase.from("tables").select("*").order("table_number");
      if (data) setTables(data);
    } catch (e) {
      console.error("POS table poll error:", e);
    }
  };

  const fetchInitialData = async () => {
    try {
      // Get Cashier Info
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase.from("profiles").select("id, full_name").eq("user_id", session.user.id).single();
        if (profile) {
          setCashierName(profile.full_name);
          setCashierId(profile.id);
        }
      }

      // Fetch Categories, Menu, Tables, Settings
      const [catRes, menuRes, tableRes, settingsRes] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("menu_items").select("*").order("name"),
        supabase.from("tables").select("*").order("table_number"),
        supabase.from("restaurant_settings").select("*").single()
      ]);
      
      setCategories(catRes.data || []);
      setMenuItems(menuRes.data || []);
      setTables(tableRes.data || []);
      if (settingsRes.data) {
        setOpeningTime(settingsRes.data.opening_time);
        setClosingTime(settingsRes.data.closing_time);
        setIs24Hours(!!settingsRes.data.is_24_hours);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMenuAvailability = async (item: any) => {
    const newStatus = !item.is_active;
    try {
      const { error } = await supabase.from("menu_items").update({ is_active: newStatus }).eq("id", item.id);
      if (error) throw error;
      
      toast.success(`${item.name} berhasil ditandai ${newStatus ? 'Tersedia' : 'Habis'}`);
      
      // Log to notifications table as audit log for Admin
      await supabase.from("notifications").insert({
        user_id: cashierId,
        title: "Log Aktivitas Kasir",
        message: `Kasir ${cashierName} menandai menu ${item.name} menjadi ${newStatus ? 'TERSEDIA' : 'HABIS'}.`,
        type: 'audit_log'
      });

      // FITUR 2: NOTIFIKASI STOK MENIPIS KE ADMIN
      if (!newStatus) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const { data: logs } = await supabase.from("notifications")
          .select("id")
          .eq("type", "audit_log")
          .gte("created_at", today.toISOString())
          .ilike("message", `%menandai menu ${item.name} menjadi HABIS%`);
          
        if (logs && logs.length >= 2) { // Termasuk log yang baru saja dibuat di atas
          await supabase.from("notifications").insert({
            user_id: null, // Broadcast to admin
            title: "Peringatan Stok Menipis",
            message: `Menu ${item.name} telah ditandai HABIS lebih dari 3 kali hari ini. Stok perlu segera ditambah!`,
            type: 'system_alert'
          });
        }
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // --- POS CART LOGIC ---
  const addToCart = (item: any) => {
    if (!isRestaurantOpen(openingTime, closingTime)) {
      return toast.error("Transaksi ditolak! Jam operasional restoran sudah habis.", {
        id: "addToCart-closed-error"
      });
    }
    if (!item.is_active) {
      setOutOfStockItem(item);
      return;
    }
    if (!isOrderSessionActive && !foundOrder) return toast.error("Silakan mulai sesi pesanan baru terlebih dahulu!");
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    if (delta > 0 && !isRestaurantOpen(openingTime, closingTime)) {
      return toast.error("Transaksi ditolak! Jam operasional restoran sudah habis.", {
        id: "updateQty-closed-error"
      });
    }
    setCart(prev => prev.map(i => {
      if (i.id === id) {
        const newQty = Math.max(1, i.qty + delta);
        return { ...i, qty: newQty };
      }
      return i;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName("");
    setFoundOrder(null);
    setIsOrderSessionActive(false);
    setOrderType(null);
    setSelectedTableId(null);
    setDiscount(null);
    setDiscountInput("");
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discountAmount = discount 
    ? (discount.type === "percent" ? (cartSubtotal * discount.value / 100) : discount.value) 
    : 0;
  const cartTotal = Math.max(0, cartSubtotal - discountAmount);

  // --- ONLINE ORDER SEARCH LOGIC ---
  const handleSearchOrder = async () => {
    if (!searchOrderNo) return toast.error("Masukkan No. Pesanan");
    
    setSearchingOrder(true);
    try {
      const cleanSearchTerm = searchOrderNo.replace(/^#/, '').trim().toLowerCase();
      
      // To avoid PostgreSQL UUID type errors with partial matches, we fetch recent order IDs
      // and filter them in JavaScript. This is robust and avoids casting issues.
      const { data: recentOrders, error: fetchError } = await supabase.from("orders")
        .select('id')
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1000); // Check the last 1000 orders
      
      if (fetchError) throw fetchError;
      
      const matchedOrder = recentOrders?.find(o => o.id.toLowerCase().startsWith(cleanSearchTerm));
      
      if (!matchedOrder) throw new Error("Pesanan tidak ditemukan");

      // Fetch the full details for the specific matched order
      const { data, error } = await supabase.from("orders").select(`
        *, 
        profiles!orders_customer_id_fkey(full_name),
        tables(table_number),
        order_items(quantity, price, notes, menu_items(*))
      `)
      .eq('id', matchedOrder.id)
      .single();
      
      if (error || !data) throw new Error("Pesanan tidak ditemukan");
      
      setFoundOrder(data);
      
    } catch (e: any) {
      toast.error(e.message || "Pesanan tidak ditemukan");
      setFoundOrder(null);
    } finally {
      setSearchingOrder(false);
    }
  };

  const loadOrderToCart = () => {
    if (!foundOrder) return;
    
    // Map order items to cart
    const newCart = foundOrder.order_items.map((oi: any) => ({
      ...oi.menu_items,
      qty: oi.quantity,
      cart_notes: oi.notes
    }));
    
    setCart(newCart);
    
    // Robustly parse name, checking for profiles array, object, and metadata fallback in notes
    const rawProfile = foundOrder.profiles;
    const profile = Array.isArray(rawProfile) ? rawProfile[0] : rawProfile;
    let extractedName = profile?.full_name;
    
    if (!extractedName && foundOrder.notes?.includes("[NAMA: ")) {
      extractedName = foundOrder.notes.split("[NAMA: ")[1]?.split("]")[0]?.trim();
    }
    
    setCustomerName(extractedName || "Guest");
    toast.success("Pesanan dimuat ke keranjang!");
  };

  const handleDirectProcessOrder = async () => {
    if (!foundOrder) return;
    if (!isRestaurantOpen(openingTime, closingTime)) {
      return toast.error("Transaksi ditolak! Jam operasional restoran sudah habis.", {
        id: "direct-process-closed-error"
      });
    }
    setSearchingOrder(true);
    try {
      // Proses Langsung = selalu tandai lunas dan mulai diproses
      const newPaymentStatus = "paid";
      const newStatus = "processing";

      // Send update status API trigger to notify customer via real-time channels & notifications table
      // We also use this to update payment status and bypass RLS
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: foundOrder.id, 
          action: 'process_pos_payment', 
          status: newStatus,
          paymentStatus: newPaymentStatus,
          paymentMethod: foundOrder.payment_method || 'cash',
          cashierId: cashierId || null,
          totalAmount: foundOrder.total_amount,
          notes: foundOrder.notes
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal memproses pesanan langsung");

      // Update local state
      setFoundOrder((prev: any) => ({
        ...prev,
        status: newStatus,
        payment_status: newPaymentStatus
      }));

      toast.success("Pesanan online berhasil diproses secara REALTIME!");
    } catch (e: any) {
      toast.error("Gagal memproses pesanan: " + e.message);
    } finally {
      setSearchingOrder(false);
    }
  };

  const handleCancelOnlineOrder = async () => {
    if (!foundOrder) return;
    const confirmCancel = window.confirm("Apakah Anda yakin ingin membatalkan pesanan ini?");
    if (!confirmCancel) return;

    setSearchingOrder(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: foundOrder.id, 
          action: 'update_status', 
          status: 'cancelled',
          reason: 'Dibatalkan oleh Kasir POS'
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Gagal membatalkan pesanan");

      toast.success("Pesanan online berhasil dibatalkan.");
      setFoundOrder(null);
    } catch (e: any) {
      toast.error("Gagal: " + e.message);
    } finally {
      setSearchingOrder(false);
    }
  };

  // --- PAYMENT LOGIC ---
  const handleCheckout = () => {
    if (!isRestaurantOpen(openingTime, closingTime)) {
      return toast.error("Transaksi ditolak! Kasir tidak dapat melakukan transaksi di luar jam operasional.", {
        duration: 5000,
        id: "cashier-closed-checkout-error"
      });
    }
    if (cart.length === 0) return toast.error("Keranjang kosong!");
    // Selalu default ke cash agar kasir bisa memilih metode pembayaran
    // Kasir bisa ganti ke non-tunai lewat UI jika diinginkan
    setPaymentMethod("cash");
    setCashAmount("");
    setShowPaymentModal(true);
  };

  const handleGenerateDuitkuPOS = async () => {
    setProcessing(true);
    const loadingToast = toast.loading("Menyiapkan pembayaran online...");
    try {
      let orderId = foundOrder?.id;
      let notesStr = `[METODE: Pembayaran Online] Kasir: ${cashierName}`;
      
      if (!orderId) {
        // Walk-in order
        const walkinNotes = `${notesStr} ${customerName ? `[NAMA: ${customerName}]` : '[NAMA: Guest]'}`;
        const orderData = {
          order_type: orderType || "takeaway",
          table_id: selectedTableId || null,
          status: "pending",
          payment_status: "unpaid",
          payment_method: "non_cash",
          total_amount: cartTotal,
          cashier_id: cashierId,
          notes: walkinNotes
        };

        const itemsData = cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.qty,
          price: item.price,
          subtotal: item.price * item.qty
        }));

        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_walkin', orderData, itemsData })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Gagal menyimpan pesanan');
        orderId = result.order.id;
        setFoundOrder(result.order);
      } else {
        // Update existing order
        const { error } = await supabase.from("orders").update({
          payment_status: "unpaid",
          payment_method: "non_cash",
          notes: notesStr
        }).eq("id", orderId);
        if (error) throw error;
      }

      const res = await fetch('/api/payment/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId,
          paymentMethod: "", // Kosongkan untuk membiarkan Duitku Pop menampilkan semua pilihan metode
          returnUrl: window.location.href
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat tagihan pembayaran');

      if (data.reference) {
        toast.dismiss(loadingToast);
        setProcessing(false);

        // Setup handler for finalized resolution logic shared by SDK and Pollers
        let pollInterval: NodeJS.Timeout | null = null;
        let isHandled = false;

        const handleFinalSuccess = async (methodName = "Duitku Pop") => {
          if (isHandled) return;
          isHandled = true;
          if (pollInterval) clearInterval(pollInterval);
          toast.success("Pembayaran Terkonfirmasi!", { duration: 3000 });
          
          // Send manual check verification to finalize in internal DB
          await fetch('/api/payment/check-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId, duitkuOrderId: data.merchantOrderId })
          });
          
          // Core state cleanup (clear cart + order confirm)
          processPayment(true, methodName);
        };

        // Parallel Background Listener to maintain UI state integrity
        pollInterval = setInterval(async () => {
          try {
            const checkRes = await fetch('/api/payment/check-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId, duitkuOrderId: data.merchantOrderId })
            });
            const checkData = await checkRes.json();
            if (checkData.status === 'paid') {
              handleFinalSuccess("Duitku Pop (Background Poll)");
            }
          } catch(err) {}
        }, 3000);

        // ⚡ VENDOR SDK INTEGRATION: Fire Duitku Pop overlay system
        if (typeof (window as any).checkout !== 'undefined') {
           (window as any).checkout.process(data.reference, {
             successEvent: function(result: any) {
               handleFinalSuccess("Duitku Pop SDK");
             },
             pendingEvent: function(result: any) {
               toast("Status: Menunggu Konfirmasi Pelanggan...", { icon: "⏳" });
             },
             errorEvent: function(result: any) {
               toast.error("Transaksi gagal atau dibatalkan oleh pelanggan.");
               if (pollInterval) clearInterval(pollInterval);
             },
             closeEvent: async function() {
               // Safe double check triggered when modal is exited manually
               try {
                 const finalCheck = await fetch('/api/payment/check-status', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ orderId, duitkuOrderId: data.merchantOrderId })
                 });
                 const checkResData = await finalCheck.json();
                 if (checkResData.status === 'paid') {
                   handleFinalSuccess("Duitku Pop (Close Event Verify)");
                 } else {
                   // Grace period cleanup to save CPU cycle if confirmed idle
                   setTimeout(() => { if(!isHandled && pollInterval) clearInterval(pollInterval); }, 15000);
                 }
               } catch(e){}
             }
           });
        } else {
           // 🚨 ROBUST FAILOVER: Standard secure window pop in case SDK load yields timing race error
           const wWidth = 520, wHeight = 780;
           const wLeft = (window.screen.width / 2) - (wWidth / 2);
           const wTop = (window.screen.height / 2) - (wHeight / 2);
           const win = window.open(data.paymentUrl, `DuitkuPayment_${Date.now()}`, `width=${wWidth},height=${wHeight},top=${wTop},left=${wLeft},scrollbars=yes`);
           
           if (win) {
             setActiveDuitkuUrl(data.paymentUrl);
             setVerificationStep("duitku_embedded");
             setShowPaymentModal(true);
           } else {
             toast.error("Browser memblokir popup. Mohon izinkan popup untuk pembayaran ini.");
           }
        }
      } else {
        toast.error("Gagal generate link pembayaran.", { id: loadingToast });
        setProcessing(false);
      }
    } catch (e: any) {
      toast.error(e.message, { id: loadingToast });
      setProcessing(false);
    }
  };

  const processPayment = async (isPaid = true, paymentDetails = "") => {
    if (!isRestaurantOpen(openingTime, closingTime)) {
      toast.error("Gagal memproses pembayaran! Restoran saat ini sudah tutup.");
      setShowPaymentModal(false);
      return;
    }
    setProcessing(true);
    try {
      if (paymentMethod === "cash") {
        if (Number(cashAmount) < cartTotal) {
          setProcessing(false);
          return toast.error("Uang tunai kurang dari total tagihan!");
        }
      }

      const pStatus = isPaid ? "paid" : "unpaid";
      let finalNotes = paymentMethod === "cash" 
        ? `[WALK-IN] Kasir: ${cashierName}` 
        : `[METODE: ${paymentDetails || 'Non-Tunai'}] Kasir: ${cashierName}`;

      if (discount) {
        finalNotes += ` [DISKON: ${discountAmount}]`;
      }

      if (foundOrder) {
        const oStatus = isPaid ? (foundOrder.status === "pending" ? "processing" : foundOrder.status) : foundOrder.status;
        
        // Use API to bypass RLS silently failing
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: foundOrder.id,
            action: 'process_pos_payment',
            paymentStatus: pStatus,
            status: oStatus,
            paymentMethod: paymentMethod,
            cashierId: cashierId,
            totalAmount: cartTotal,
            notes: finalNotes,
            tableId: foundOrder.table_id
          })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Gagal memproses pembayaran');

        toast.success(`Transaksi Online ${isPaid ? 'Lunas' : 'Pending'}!`);
        
        if (isPaid) {
          const completed = { 
            ...foundOrder, 
            payment_status: "paid", 
            cashier: { full_name: cashierName }, 
            cash_received: paymentMethod === 'cash' ? Number(cashAmount) : cartTotal, 
            notes: finalNotes,
            discount: discountAmount
          };
          setCompletedOrder(completed);
          setShowPaymentModal(false);
          setVerificationStep("select_method");
          setShowReceipts(true);
        } else {
          setShowPaymentModal(false);
          setVerificationStep("select_method");
          clearCart();
        }
        
      } else {
        // Walk-in order
        const walkinNotes = `${finalNotes} ${customerName ? `[NAMA: ${customerName}]` : '[NAMA: Guest]'}`;
        const orderData = {
          order_type: orderType || "takeaway",
          table_id: selectedTableId || null,
          status: isPaid ? "processing" : "pending",
          payment_status: pStatus,
          payment_method: paymentMethod,
          total_amount: cartTotal,
          cashier_id: cashierId,
          notes: walkinNotes
        };

        const itemsData = cart.map(item => ({
          menu_item_id: item.id,
          quantity: item.qty,
          price: item.price,
          subtotal: item.price * item.qty
        }));

        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create_walkin', orderData, itemsData })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Gagal menyimpan pesanan walk-in');
        
        const newOrder = result.order;
        toast.success(`Pesanan Walk-In ${isPaid ? 'Lunas' : 'Pending'}!`);
        
        if (isPaid) {
          const completed = { 
            ...newOrder, 
            profiles: { full_name: customerName || "Walk-In Customer" },
            order_items: cart.map(i => ({ menu_items: i, quantity: i.qty, subtotal: i.price * i.qty })),
            cashier: { full_name: cashierName },
            cash_received: paymentMethod === 'cash' ? Number(cashAmount) : cartTotal,
            notes: finalNotes,
            discount: discountAmount
          };
          setCompletedOrder(completed);
          setShowPaymentModal(false);
          setVerificationStep("select_method");
          setShowReceipts(true);
        } else {
          setShowPaymentModal(false);
          setVerificationStep("select_method");
          clearCart();
        }
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = (ref: React.RefObject<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const win = window.open("", "_blank", "width=450,height=700");
    if (!win) return;
    win.document.write(`<html><head><title>Kwitansi</title><style>body{margin:0;padding:20px;font-family:'Courier New',monospace;font-size:13px}*{box-sizing:border-box}.text-center{text-align:center}.font-bold{font-weight:bold}.font-extrabold{font-weight:800}.text-xs{font-size:11px}.text-sm{font-size:12px}.text-base{font-size:14px}.text-2xl{font-size:22px}.mb-2{margin-bottom:8px}.mb-4{margin-bottom:16px}.mb-6{margin-bottom:24px}.mt-1{margin-top:4px}.mt-2{margin-top:8px}.mt-3{margin-top:12px}.pt-2{padding-top:8px}.pt-4{padding-top:16px}.pb-4{padding-bottom:16px}.pb-6{padding-bottom:24px}.p-8{padding:20px}.space-y-1>*+*{margin-top:4px}.border-dashed{border-style:dashed}.border-b{border-bottom:1px dashed #ccc}.border-t{border-top:1px dashed #ccc}.flex{display:flex}.justify-between{justify-content:space-between}.items-center{align-items:center}.gap-2{gap:8px}.uppercase{text-transform:uppercase}.tracking-wider{letter-spacing:2px}.text-gray-400{color:#999}.text-gray-500{color:#777}.text-gray-600{color:#555}.text-green-700{color:#15803d}.text-red-700{color:#b91c1c}.bg-green-100{background:#dcfce7;padding:4px 12px;border-radius:12px;border:1px solid #86efac}.bg-red-100{background:#fee2e2;padding:4px 12px;border-radius:12px;border:1px solid #fca5a5}@media print{body{padding:10px}}</style></head><body>`);
    win.document.write(el.innerHTML);
    win.document.write("</body></html>");
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const filteredMenu = menuItems.filter(item => {
    const matchesCat = activeCategory === "all" || item.category_id === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col -mt-4">
      {/* Header POS */}
      <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-4 flex justify-between items-center shrink-0 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center">
            <MonitorSmartphone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-text-light dark:text-text-dark leading-tight">POS Kasir</h1>
            <p className="text-[10px] text-muted font-bold uppercase tracking-widest">{cashierName || "Kasir"}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="font-mono font-black text-xl text-primary">{format(currentTime, "HH:mm:ss")}</p>
            <p className="text-xs text-muted font-bold">{format(currentTime, "EEEE, dd MMM yyyy", { locale: localeId })}</p>
          </div>
        </div>
      </div>

      {/* Operational Warning Banner */}
      {!is24Hours && !isRestaurantOpen(openingTime, closingTime) && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }} 
          animate={{ opacity: 1, height: "auto" }} 
          className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-center gap-3 mb-4 shrink-0 shadow-sm"
        >
          <div className="bg-red-500 text-white p-2.5 rounded-xl animate-pulse shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <p className="font-extrabold text-sm uppercase">SISTEM LOCK OUT: RESTORAN TUTUP ({openingTime || "08:00"} - {closingTime || "22:00"})</p>
            <p className="opacity-90 font-medium mt-0.5">Semua proses transaksi baru, pembukaan sesi meja walk-in, dan pemrosesan pesanan online diblokir sementara waktu demi mematuhi kebijakan jam operasional restoran.</p>
          </div>
        </motion.div>
      )}

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* PANEL KIRI - MENU & SEARCH */}
        <div className="w-2/3 flex flex-col gap-4 overflow-hidden">
          {/* Pencarian Pesanan Online */}
          <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-4 shrink-0">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-text-light dark:text-text-dark flex items-center gap-2">
                    <Search className="w-4 h-4 text-primary" /> Cari Pesanan Online
                  </h3>
                </div>
                
                <div className="flex gap-2">
                  <input type="text" value={searchOrderNo} onChange={e => setSearchOrderNo(e.target.value)} placeholder="No. Pesanan" className="flex-1 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary" />
                  <button onClick={handleSearchOrder} disabled={searchingOrder} className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm transition-all shadow-md shadow-primary/20 disabled:opacity-70">
                    {searchingOrder ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Cari
                  </button>
                </div>
              </div>

              {foundOrder && (
                <div className="flex-1 bg-primary/5 border border-primary/20 rounded-xl p-3 flex flex-col justify-center">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-text-light dark:text-text-dark">
                          {Array.isArray(foundOrder.profiles) ? foundOrder.profiles[0]?.full_name : foundOrder.profiles?.full_name || "Pelanggan"}
                        </span>
                        <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-wider">{foundOrder.order_type === "dine_in" ? `Dine In (Meja ${foundOrder.tables?.table_number})` : foundOrder.order_type === "takeaway" ? "Take Away" : "Delivery"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span>#{foundOrder.id.split("-")[0]}</span>
                        <span>-</span>
                        <span className={`font-bold uppercase ${foundOrder.payment_status === "paid" ? "text-green-600" : "text-red-500"}`}>{foundOrder.payment_status === "paid" ? "Lunas" : "Belum Bayar"}</span>
                        <span>-</span>
                        <span className="font-bold uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[9px]">{foundOrder.status}</span>
                      </div>
                    </div>
                  </div>
                  
                  {foundOrder.payment_status === "unpaid" ? (
                    foundOrder.payment_method === "cash" ? (
                      <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 mb-2 leading-tight">
                        <span className="font-bold text-red-500 block mb-0.5">Pesanan Belum Dibayar!</span>
                        Pesanan ini dikonfigurasi menggunakan metode pembayaran TUNAI. Anda dapat meneruskan pesanan ini ke POS Kasir untuk memproses pembayarannya (Metode pembayaran dapat diubah di POS jika pelanggan berubah pikiran).
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 mb-2 leading-tight">
                        <span className="font-bold text-amber-500 block mb-0.5">Menunggu Pembayaran Online!</span>
                        Pesanan ini menggunakan metode NON TUNAI. Pelanggan belum menyelesaikan pembayaran melalui aplikasi/gateway Duitku. Mohon tunggu hingga status berubah menjadi LUNAS.
                      </div>
                    )
                  ) : (
                    foundOrder.payment_method === "cash" ? (
                      <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 mb-2 leading-tight">
                        <span className="font-bold text-green-600 block mb-0.5">Pesanan Lunas (Tunai Kasir)!</span>
                        Pesanan ini telah dibayar lunas secara TUNAI melalui Kasir. Anda tidak perlu memuat ulang pesanan ini ke POS lagi. Silakan proses pesanan melalui menu Pesanan Online di sidebar.
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 mb-2 leading-tight">
                        <span className="font-bold text-green-600 block mb-0.5">Pesanan Lunas (Online/Non-Tunai)!</span>
                        Pesanan ini telah dibayar lunas melalui metode pembayaran NON TUNAI (Online). Anda tidak perlu (dan tidak dapat) memuat ulang pesanan ini ke POS Kasir untuk proses pembayaran lagi.
                      </div>
                    )
                  )}

                  <div className="flex gap-2 mt-auto">
                    {foundOrder.payment_status === "unpaid" && foundOrder.payment_method === "cash" && foundOrder.status !== "completed" && (
                      <button 
                        onClick={() => {
                          if (!isRestaurantOpen(openingTime, closingTime)) {
                            return toast.error("Tidak dapat memuat pesanan ke kasir! Restoran sedang TUTUP.");
                          }
                          loadOrderToCart();
                        }} 
                        disabled={!isRestaurantOpen(openingTime, closingTime)}
                        className={`border px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex-1 ${
                          isRestaurantOpen(openingTime, closingTime)
                            ? "bg-white dark:bg-gray-800 border-border-light dark:border-border-dark text-primary hover:border-primary"
                            : "bg-gray-300 dark:bg-gray-800 border-transparent text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        Teruskan Ke Kasir
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Menu Grid atau Form Mulai Sesi */}
          <div className="bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark flex flex-col flex-1 overflow-hidden relative">
            {!isOrderSessionActive && !foundOrder ? (
              <div className="flex-1 flex items-center justify-center p-4 md:p-8 bg-gray-50/50 dark:bg-gray-800/20 overflow-y-auto">
                <div className="max-w-md w-full bg-white dark:bg-card-dark p-6 rounded-3xl shadow-xl border border-border-light dark:border-border-dark my-auto">
                  <h3 className="text-xl font-black mb-6 text-center text-text-light dark:text-text-dark">Mulai Pesanan Baru</h3>
                  
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-muted uppercase tracking-widest mb-2 block">Nama Pelanggan</label>
                      <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Contoh: Budi (Opsional)" className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-primary transition-all" />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-muted uppercase tracking-widest mb-2 block">Jenis Pesanan</label>
                      <div className="flex gap-3">
                        <button onClick={() => {setOrderType("dine_in"); setSelectedTableId(null);}} className={`flex-1 py-4 rounded-xl font-bold flex flex-col items-center gap-2 border-2 transition-all ${orderType === "dine_in" ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-gray-200 dark:border-gray-700 text-muted hover:border-blue-200"}`}>
                          <UtensilsCrossed className="w-6 h-6" /> Dine In
                        </button>
                        <button onClick={() => {setOrderType("takeaway"); setSelectedTableId(null);}} className={`flex-1 py-4 rounded-xl font-bold flex flex-col items-center gap-2 border-2 transition-all ${orderType === "takeaway" ? "border-primary bg-primary/10 text-primary shadow-sm" : "border-gray-200 dark:border-gray-700 text-muted hover:border-blue-200"}`}>
                          <ReceiptIcon className="w-6 h-6" /> Takeaway
                        </button>
                      </div>
                    </div>

                    {orderType === "dine_in" && (
                      <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest mb-3 block">Pilih Meja (Hijau = Tersedia)</label>
                        <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1 pb-2 scrollbar-hide">
                          {tables.map(table => (
                            <button 
                              key={table.id}
                              disabled={table.status !== "available" && selectedTableId !== table.id}
                              onClick={() => setSelectedTableId(table.id)}
                              className={`p-3 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                                selectedTableId === table.id ? "border-primary bg-primary text-white shadow-md scale-105" :
                                table.status === "available" ? "border-green-200 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:border-green-400" :
                                table.status === "occupied" ? "border-red-200 bg-red-50 dark:bg-red-900/20 text-red-500 cursor-not-allowed opacity-50" :
                                "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 cursor-not-allowed opacity-50"
                              }`}
                            >
                              <span className="text-xl font-black leading-none">{table.table_number}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <button 
                      onClick={async () => {
                        if (!isRestaurantOpen(openingTime, closingTime)) {
                          return toast.error("Tidak dapat memulai pesanan! Restoran saat ini sedang TUTUP.");
                        }
                        if (orderType === "dine_in" && !selectedTableId) return toast.error("Silakan pilih meja untuk Dine In!");
                        if (!customerName.trim()) setCustomerName("Guest");
                        if (orderType === "dine_in" && selectedTableId) {
                           await supabase.from("tables").update({status: "occupied"}).eq("id", selectedTableId);
                        }
                        setIsOrderSessionActive(true);
                      }}
                      disabled={!orderType || !isRestaurantOpen(openingTime, closingTime)}
                      className={`w-full mt-2 py-4 font-black rounded-2xl transition-all uppercase tracking-wider ${
                        isRestaurantOpen(openingTime, closingTime)
                          ? "bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/30"
                          : "bg-gray-300 dark:bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-400/20 shadow-none"
                      }`}
                    >
                      {isRestaurantOpen(openingTime, closingTime) ? "Mulai Pesanan" : "Restoran Tutup"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full p-4">
                <div className="flex justify-between items-center mb-4 shrink-0">
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    <button onClick={() => setActiveCategory("all")} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeCategory === "all" ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-gray-100 dark:bg-gray-800 text-muted"}`}>Semua</button>
                    {categories.map(c => (
                      <button key={c.id} onClick={() => setActiveCategory(c.id)} className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeCategory === c.id ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-gray-100 dark:bg-gray-800 text-muted"}`}>{c.name}</button>
                    ))}
                  </div>
                  <div className="relative w-48 shrink-0">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cari menu..." className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-primary" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredMenu.map(item => (
                      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: item.is_active ? 0.98 : 1 }} key={item.id} onClick={() => addToCart(item)} className={`relative bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl overflow-hidden cursor-pointer shadow-sm transition-all flex flex-col ${item.is_active ? 'hover:border-primary' : 'opacity-60 grayscale'}`}>
                        <div className="h-28 w-full bg-gray-200 relative overflow-hidden group">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted"><UtensilsCrossed className="w-8 h-8 opacity-20" /></div>
                          )}
                          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-lg">Rp {item.price.toLocaleString("id-ID")}</div>
                        </div>
                        <div className="p-3 flex-1 flex flex-col justify-between relative">
                          <h4 className="font-bold text-xs text-text-light dark:text-text-dark line-clamp-2">{item.name}</h4>
                          {!item.is_active && (
                            <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-[1px] flex items-center justify-center">
                              <span className="bg-red-600 text-white font-black px-3 py-1 text-[10px] rounded-full uppercase tracking-widest shadow-lg transform -rotate-12 border-2 border-white">Habis</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PANEL KANAN - CART */}
        <div className="w-1/3 bg-white dark:bg-card-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/20 shrink-0">
            <h2 className="font-black text-lg text-text-light dark:text-text-dark">Keranjang</h2>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                <Trash2 className="w-3 h-3" /> Pesanan Baru
              </button>
            )}
          </div>

          {isOrderSessionActive && !foundOrder && (
            <div className="p-4 border-b border-border-light dark:border-border-dark shrink-0 bg-primary/5 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-0.5">Pelanggan</p>
                <p className="font-black text-primary text-sm line-clamp-1">{customerName}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted font-bold uppercase tracking-widest mb-0.5">Tipe</p>
                <p className="font-bold text-xs bg-white dark:bg-card-dark px-2 py-1 rounded-lg border border-border-light dark:border-border-dark shadow-sm">
                  {orderType === "dine_in" ? `Dine In - Meja ${tables.find(t=>t.id===selectedTableId)?.table_number || "-"}` : "Takeaway"}
                </p>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted opacity-50">
                <ReceiptIcon className="w-16 h-16 mb-4" />
                <p className="font-bold">Keranjang Kosong</p>
                <p className="text-xs text-center mt-2 px-6">Pilih menu dari panel kiri atau muat pesanan online.</p>
              </div>
            ) : (
              <AnimatePresence>
                {cart.map((item) => (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} key={item.id} className="flex gap-3 bg-background-light dark:bg-background-dark p-3 rounded-xl border border-border-light dark:border-border-dark">
                    <div className="flex-1">
                      <p className="font-bold text-sm text-text-light dark:text-text-dark leading-tight line-clamp-1">{item.name}</p>
                      <p className="text-xs text-muted mt-1 font-mono">Rp {item.price.toLocaleString("id-ID")}</p>
                      {item.cart_notes && <p className="text-[10px] text-primary mt-1 uppercase font-bold">Note: {item.cart_notes}</p>}
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <p className="font-black text-sm text-primary mb-2">Rp {(item.price * item.qty).toLocaleString("id-ID")}</p>
                      <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        <button aria-label="Kurangi Jumlah" title="Kurangi Jumlah" onClick={() => item.qty > 1 ? updateQty(item.id, -1) : removeFromCart(item.id)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-700 rounded-md text-text-light dark:text-text-dark shadow-sm hover:text-red-500 transition-colors">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-black w-4 text-center">{item.qty}</span>
                        <button aria-label="Tambah Jumlah" title="Tambah Jumlah" onClick={() => updateQty(item.id, 1)} className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-700 rounded-md text-text-light dark:text-text-dark shadow-sm hover:text-primary transition-colors">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Summary & Pay Button */}
          <div className="p-4 bg-gray-50/80 dark:bg-gray-800/50 border-t border-border-light dark:border-border-dark shrink-0">
            {/* Discount Section */}
            <div className="mb-4 space-y-2">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={discountInput}
                  onChange={e => setDiscountInput(e.target.value)}
                  placeholder="Kode / Nominal Diskon" 
                  className="flex-1 px-3 py-2 text-sm bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:border-primary"
                />
                <button 
                  onClick={() => {
                    if (!discountInput) return;
                    if (discountInput.toUpperCase() === "MEMBER10") {
                      setDiscount({ type: "percent", value: 10, code: "MEMBER10" });
                      toast.success("Diskon 10% Member Diterapkan!");
                    } else if (!isNaN(Number(discountInput))) {
                      setDiscount({ type: "nominal", value: Number(discountInput), code: "NOMINAL" });
                      toast.success(`Diskon Rp ${Number(discountInput).toLocaleString("id-ID")} Diterapkan!`);
                    } else {
                      toast.error("Kode diskon tidak valid");
                    }
                  }}
                  className="px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs font-bold rounded-xl"
                >
                  Terapkan
                </button>
              </div>
              {discount && (
                <div className="flex justify-between items-center px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 border border-green-200 rounded-xl text-xs font-bold">
                  <span>Diskon {discount.type === 'percent' ? `(${discount.value}%)` : ''} applied</span>
                  <button onClick={() => setDiscount(null)} title="Hapus Diskon" aria-label="Hapus Diskon" className="text-red-500 hover:text-red-700 p-1"><X className="w-3 h-3" /></button>
                </div>
              )}
            </div>

            <div className="space-y-1 mb-4">
              <div className="flex justify-between items-center text-xs font-medium text-muted">
                <span>Subtotal</span>
                <span>Rp {cartSubtotal.toLocaleString("id-ID")}</span>
              </div>
              {discount && (
                <div className="flex justify-between items-center text-xs font-bold text-green-600">
                  <span>Diskon</span>
                  <span>-Rp {discountAmount.toLocaleString("id-ID")}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2 mt-2 border-t border-border-light dark:border-border-dark">
                <span className="text-sm font-bold text-muted uppercase tracking-widest">Total Tagihan</span>
                <span className="text-2xl font-black text-text-light dark:text-text-dark">Rp {cartTotal.toLocaleString("id-ID")}</span>
              </div>
            </div>
            
            <button 
              onClick={handleCheckout} 
              disabled={cart.length === 0 || !isRestaurantOpen(openingTime, closingTime)} 
              className={`w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 ${
                isRestaurantOpen(openingTime, closingTime)
                  ? "bg-primary text-white hover:bg-primary-hover shadow-lg shadow-primary/30 disabled:opacity-50 disabled:shadow-none"
                  : "bg-gray-300 dark:bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-400/20"
              }`}
            >
              <Banknote className="w-5 h-5" /> {isRestaurantOpen(openingTime, closingTime) ? "Bayar / Proses" : "Transaksi Diblokir"}
            </button>
          </div>
        </div>
      </div>

      {/* Modal Pembayaran */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {verificationStep === "duitku_embedded" ? (
              <div className="fixed inset-0 z-[150] overflow-hidden bg-white/20 dark:bg-slate-900/20 backdrop-blur-[30px] flex items-center justify-center">
                {/* Floating Background Aesthetic Details (matching design requirements) */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-50">
                   <div className="absolute top-12 -left-24 w-[500px] h-[500px] bg-orange-100/40 dark:bg-orange-900/10 rounded-full blur-3xl"></div>
                   <div className="absolute bottom-12 -right-24 w-[600px] h-[600px] bg-orange-50/40 dark:bg-orange-900/10 rounded-full blur-3xl"></div>
                   <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:16px_16px] dark:opacity-[0.1] dark:invert"></div>
                </div>

                <div className="relative w-full h-full flex flex-col lg:flex-row items-center justify-center gap-12 xl:gap-32 p-8">
                  {/* LEFT: Recreating visual box design from user reference */}
                  <motion.div 
                    initial={{ x: -100, opacity: 0 }} 
                    animate={{ x: 0, opacity: 1 }} 
                    transition={{ type: "spring", damping: 25, stiffness: 120 }}
                    className="hidden lg:flex flex-col items-center"
                  >
                    <div className="w-56 h-56 xl:w-72 xl:h-72 bg-white/60 dark:bg-gray-800/60 border-[12px] border-white/90 dark:border-gray-700/90 rounded-[3.5rem] shadow-[0_40px_80px_-20px_rgba(234,88,12,0.25)] backdrop-blur-sm flex items-center justify-center text-primary">
                      <Utensils className="w-32 h-32 xl:w-40 xl:h-40 stroke-[1.5]" />
                    </div>
                  </motion.div>

                  {/* CENTER: Embedded Duitku Frame in standardized width for optimal mobile gateway scale */}
                  <motion.div 
                    initial={{ y: 50, opacity: 0, scale: 0.95 }} 
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.2, type: "spring" }}
                    className="relative z-10"
                  >
                    <div className="w-[90vw] max-w-[440px] bg-white dark:bg-gray-900 rounded-[3.5rem] shadow-[0_40px_100px_-20px_rgba(234,88,12,0.4)] border-[12px] border-white dark:border-gray-800 relative overflow-hidden transition-all">
                       <div className="p-10 md:p-12 flex flex-col items-center text-center">
                          {/* STUNNING ANIMATED PULSER */}
                          <div className="relative w-48 h-48 mb-10 flex items-center justify-center">
                             <div className="absolute inset-0 bg-orange-500/10 rounded-full animate-ping opacity-40"></div>
                             <div className="absolute inset-6 bg-orange-500/20 rounded-full animate-pulse"></div>
                             <div className="relative z-10 w-28 h-28 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center shadow-[0_15px_35px_-5px_rgba(234,88,12,0.6)]">
                                <Loader className="w-12 h-12 text-white animate-spin stroke-[3]" style={{ animationDuration: '3s' }} />
                             </div>
                          </div>

                          {/* DYNAMIC TEXT BLOCK */}
                          <div className="space-y-2">
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
                              Menunggu Pembayaran
                            </h2>
                            <p className="font-bold text-gray-500 dark:text-gray-400 text-xs tracking-widest uppercase italic">
                              Waiting For Payment
                            </p>
                          </div>

                          {/* INVOICE PILL */}
                          <div className="mt-8 bg-orange-50 dark:bg-orange-900/20 px-8 py-4 rounded-3xl flex flex-col items-center shadow-inner border border-orange-100/50 dark:border-orange-800/30 w-full max-w-[280px]">
                             <span className="text-[10px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-widest mb-1">Total Tagihan</span>
                             <span className="text-3xl font-black text-gray-900 dark:text-white">
                                Rp {cartTotal.toLocaleString("id-ID")}
                             </span>
                          </div>

                          {/* RE-OPEN ACTION BUTTON */}
                          <button 
                            onClick={() => {
                               const wWidth = 520, wHeight = 780;
                               const wLeft = (window.screen.width / 2) - (wWidth / 2);
                               const wTop = (window.screen.height / 2) - (wHeight / 2);
                               window.open(activeDuitkuUrl, `DuitkuPayment_${Date.now()}`, `width=${wWidth},height=${wHeight},top=${wTop},left=${wLeft},scrollbars=yes,status=no,menubar=no`);
                            }}
                            className="mt-10 w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-black py-5 px-8 rounded-2xl shadow-[0_20px_40px_-10px_rgba(234,88,12,0.5)] hover:shadow-[0_25px_50px_-10px_rgba(234,88,12,0.6)] transition-all active:scale-[0.96] flex items-center justify-center gap-3 uppercase tracking-wider text-sm group"
                          >
                            <ExternalLink className="w-5 h-5 group-hover:scale-110 transition-transform" /> Buka Portal Pembayaran
                          </button>

                          <p className="mt-6 text-[11px] text-gray-400 dark:text-gray-500 font-medium leading-relaxed max-w-[300px]">
                             Sebuah jendela pembayaran telah dibuka. Tekan tombol di atas jika Anda tidak melihat jendela tersebut.
                          </p>
                       </div>
                    </div>
                  </motion.div>

                  {/* RIGHT: Giant "Book" typography visual anchor */}
                  <motion.div 
                    initial={{ x: 100, opacity: 0 }} 
                    animate={{ x: 0, opacity: 1 }} 
                    transition={{ type: "spring", damping: 25, stiffness: 120, delay: 0.1 }}
                    className="hidden lg:block"
                  >
                     <h1 className="text-[9rem] xl:text-[13rem] font-black text-primary leading-none tracking-tighter select-none drop-shadow-[0_25px_50px_rgba(234,88,12,0.3)]">
                       Book
                     </h1>
                  </motion.div>
                </div>

                {/* FLOATING ACTION ROW (Bilingual) */}
                <div className="absolute top-6 right-6 z-[200] flex items-center gap-4">
                  {/* Manual Sync Visual Button */}
                  <button 
                    onClick={() => processPayment(true)}
                    className="px-5 py-3 bg-emerald-600 text-white font-black rounded-2xl shadow-xl hover:bg-emerald-700 transition-all uppercase text-xs tracking-wider flex items-center gap-2 border border-emerald-500"
                  >
                    <CheckCircle className="w-4 h-4" /> Konfirmasi / Confirm
                  </button>

                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setVerificationStep("select_method");
                      setActiveDuitkuUrl("");
                    }}
                    className="px-6 py-3 bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 font-black rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950 transition-all uppercase text-xs tracking-wider"
                  >
                    <X className="w-5 h-5 font-black" /> Batal / Cancel
                  </motion.button>
                </div>
              </div>
            ) : (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPaymentModal(false)} className="absolute inset-0 bg-black/70 backdrop-blur-md" />
                
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-card-light dark:bg-card-dark w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-xl text-text-light dark:text-text-dark">Proses Pembayaran</h3>
                    <button aria-label="Tutup" title="Tutup" onClick={() => setShowPaymentModal(false)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 transition-colors"><X className="w-4 h-4" /></button>
                  </div>

                  {verificationStep === "select_method" && (
                    <>
                      <div className="mb-6">
                        <p className="text-xs font-bold uppercase text-muted tracking-widest mb-2">Metode Pembayaran</p>
                        <div className="flex gap-3">
                          <button onClick={() => setPaymentMethod("cash")} className={`flex-1 py-3 rounded-xl font-bold flex flex-col items-center gap-2 border-2 transition-all ${paymentMethod === "cash" ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-muted"}`}>
                            <Banknote className="w-6 h-6" /> Tunai
                          </button>
                          <button onClick={() => { setPaymentMethod("non_cash"); setNonCashType("online_duitku"); setNonCashProvider(""); }} className={`flex-1 py-3 rounded-xl font-bold flex flex-col items-center gap-2 border-2 transition-all ${paymentMethod === "non_cash" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-muted"}`}>
                            <CreditCard className="w-6 h-6" /> Non-Tunai
                          </button>
                        </div>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 mb-6 text-center border border-border-light dark:border-border-dark">
                        <p className="text-xs font-bold uppercase text-muted tracking-widest mb-1">Total Tagihan</p>
                        <p className="text-3xl font-black text-primary">Rp {cartTotal.toLocaleString("id-ID")}</p>
                      </div>

                      {paymentMethod === "cash" ? (
                        <div className="space-y-4 mb-6">
                          <div>
                            <label className="text-xs font-bold uppercase text-muted tracking-widest mb-2 block">Uang Diterima (Rp)</label>
                            <input type="number" value={cashAmount} onChange={e => setCashAmount(Number(e.target.value) || "")} className="w-full text-2xl font-black p-4 bg-background-light dark:bg-background-dark border-2 border-border-light dark:border-border-dark focus:border-green-500 rounded-2xl outline-none" placeholder="0" />
                          </div>
                          
                          {Number(cashAmount) > 0 && (
                            <div className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                              <span className="font-bold text-green-700 dark:text-green-400">Kembalian</span>
                              <span className="font-black text-xl text-green-700 dark:text-green-400">Rp {Math.max(0, Number(cashAmount) - cartTotal).toLocaleString("id-ID")}</span>
                            </div>
                          )}
                          
                          <button 
                            onClick={() => processPayment(true)} 
                            disabled={processing || Number(cashAmount) < cartTotal} 
                            className="w-full py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary-hover transition-all shadow-xl shadow-primary/30 disabled:opacity-50 disabled:shadow-none uppercase tracking-wider flex justify-center items-center gap-2"
                          >
                            {processing ? <Loader2 className="w-6 h-6 animate-spin" /> : "Konfirmasi Pembayaran"}
                          </button>
                        </div>
                      ) : (
                        <div className="mb-6 space-y-6">
                          <div className="p-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-100 dark:border-blue-800 rounded-3xl flex items-start gap-4 shadow-sm">
                            <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30 text-white">
                              <QrCode className="w-6 h-6" />
                            </div>
                            <div>
                              <h4 className="font-black text-blue-900 dark:text-blue-200 uppercase tracking-tight">Pembayaran Online</h4>
                              <p className="text-xs font-medium text-blue-700 dark:text-blue-400 mt-1 leading-relaxed">
                                Pelanggan dapat memilih E-Wallet (ShopeePay, OVO, Dana), QRIS, Virtual Account, atau gerai retail langsung di jendela pembayaran Duitku Pop yang akan muncul.
                              </p>
                            </div>
                          </div>

                          <button 
                            onClick={handleGenerateDuitkuPOS} 
                            disabled={processing} 
                            className="w-full py-5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black rounded-2xl transition-all uppercase tracking-wider flex justify-center items-center gap-3 shadow-xl shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-[0.98]"
                          >
                            {processing ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CreditCard className="w-6 h-6" /> Mulai Pembayaran Pop</>}
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  {verificationStep === "duitku_waiting" && (
                    <div className="space-y-6 text-center py-8">
                      <div className="relative mx-auto w-24 h-24 mb-4">
                        <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <CreditCard className="w-8 h-8 text-blue-500 animate-pulse" />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-black text-xl text-text-light dark:text-text-dark mb-2">Menunggu Pembayaran</h3>
                        <p className="text-sm text-muted mb-4">Sebuah jendela pembayaran terpisah telah dibuka. Silakan minta pelanggan untuk menyelesaikan pembayaran disana.</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-border-light dark:border-border-dark inline-block w-full">
                        <p className="text-xs font-bold uppercase text-muted tracking-widest mb-1">Total Tagihan</p>
                        <p className="text-2xl font-black text-primary">Rp {cartTotal.toLocaleString("id-ID")}</p>
                      </div>
                      <div className="pt-4 flex gap-3">
                        <button 
                          onClick={() => setVerificationStep("select_method")} 
                          className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-text-light dark:text-text-dark font-bold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                        >
                          Batal / Ganti Metode
                        </button>
                        <button 
                          onClick={() => processPayment(true)} 
                          className="flex-1 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-all"
                        >
                          Verifikasi Manual
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </>
            )}
          </div>
        )}
      </AnimatePresence>

      {/* Modal Cetak Struk */}
      <AnimatePresence>
        {showReceipts && completedOrder && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="relative w-full max-w-md">
              
              {/* Struk Pelanggan (Satu saja sesuai request) */}
              <div className="bg-white rounded-3xl p-6 shadow-2xl relative">
                <div className="absolute -top-4 -right-4 bg-emerald-500 text-white text-xs font-black uppercase px-4 py-1.5 rounded-full shadow-lg">Untuk Pelanggan</div>
                <div className="h-[60vh] overflow-y-auto mb-4 border border-gray-200 rounded-xl">
                  <Receipt ref={receiptPelangganRef} order={completedOrder} orderItems={completedOrder.order_items.map((i:any)=>({...i.menu_items, quantity: i.quantity, subtotal: i.subtotal}))} customerName={completedOrder.profiles?.full_name} cashierName={completedOrder.cashier?.full_name} cashReceived={completedOrder.cash_received} isKasirCopy={false} />
                </div>
                <button onClick={() => handlePrint(receiptPelangganRef)} className="w-full py-3 bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600">
                  <Printer className="w-4 h-4" /> Cetak Struk Pelanggan
                </button>
              </div>

            </motion.div>
            
            <button onClick={() => { setShowReceipts(false); clearCart(); }} className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white text-gray-900 px-8 py-3 rounded-full font-black uppercase text-sm shadow-2xl hover:scale-105 transition-all">Selesai & Tutup</button>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Peringatan Menu Habis */}
      <AnimatePresence>
        {outOfStockItem && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setOutOfStockItem(null)} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-card-light dark:bg-card-dark rounded-3xl p-8 max-w-md w-full border border-border-light dark:border-border-dark shadow-2xl space-y-6 relative z-10 text-center"
            >
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Ban className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-black text-xl text-text-light dark:text-text-dark">Menu Sudah Habis</h3>
                <p className="text-muted text-sm leading-relaxed">
                  Menu <span className="font-bold text-primary">{outOfStockItem.name}</span> sudah habis dan tidak dapat diproses. Silakan pilih menu lain yang tersedia.
                </p>
              </div>
              <button 
                onClick={() => setOutOfStockItem(null)} 
                className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl transition-colors uppercase tracking-wider shadow-lg shadow-red-500/20 text-xs"
              >
                Tutup
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
