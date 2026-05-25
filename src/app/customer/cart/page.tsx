"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Plus, Minus, ShoppingBag, UtensilsCrossed, ArrowRight, Loader2, Store, CreditCard, Banknote, Smartphone, Landmark, QrCode, CheckCircle, AlertTriangle, RefreshCw, X, Receipt, Sparkles, ChevronRight, HelpCircle, Clock, Globe, Ticket } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Image from "next/image";
import { generateQRISString, getEWalletDeepLink } from "@/utils/qris";
import { isRestaurantOpen, getOperationalStatus, getStoreStatus } from "@/utils/operationalHours";

interface Table { id: string; table_number: number; capacity: number; status: string; }

const INDONESIAN_PROVINCES = [
  { id: "11", name: "ACEH" },
  { id: "12", name: "SUMATERA UTARA" },
  { id: "13", name: "SUMATERA BARAT" },
  { id: "14", name: "RIAU" },
  { id: "15", name: "JAMBI" },
  { id: "16", name: "SUMATERA SELATAN" },
  { id: "17", name: "BENGKULU" },
  { id: "18", name: "LAMPUNG" },
  { id: "19", name: "KEPULAUAN BANGKA BELITUNG" },
  { id: "21", name: "KEPULAUAN RIAU" },
  { id: "31", name: "DKI JAKARTA" },
  { id: "32", name: "JAWA BARAT" },
  { id: "33", name: "JAWA TENGAH" },
  { id: "34", name: "DI YOGYAKARTA" },
  { id: "35", name: "JAWA TIMUR" },
  { id: "36", name: "BANTEN" },
  { id: "51", name: "BALI" },
  { id: "52", name: "NUSA TENGGARA BARAT" },
  { id: "53", name: "NUSA TENGGARA TIMUR" },
  { id: "61", name: "KALIMANTAN BARAT" },
  { id: "62", name: "KALIMANTAN TENGAH" },
  { id: "63", name: "KALIMANTAN SELATAN" },
  { id: "64", name: "KALIMANTAN TIMUR" },
  { id: "65", name: "KALIMANTAN UTARA" },
  { id: "71", name: "SULAWESI UTARA" },
  { id: "72", name: "SULAWESI TENGAH" },
  { id: "73", name: "SULAWESI SELATAN" },
  { id: "74", name: "SULAWESI TENGGARA" },
  { id: "75", name: "GORONTALO" },
  { id: "76", name: "SULAWESI BARAT" },
  { id: "81", name: "MALUKU" },
  { id: "82", name: "MALUKU UTARA" },
  { id: "91", name: "PAPUA" },
  { id: "92", name: "PAPUA BARAT" },
  { id: "93", name: "PAPUA SELATAN" },
  { id: "94", name: "PAPUA TENGAH" },
  { id: "95", name: "PAPUA PEGUNUNGAN" },
  { id: "96", name: "PAPUA BARAT DAYA" }
];

export default function CartPage() {
  const { items, removeItem, updateQuantity, updateNotes, getTotal, clearCart } = useCartStore();
  
  // Voucher States
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);
  const [availableVouchers, setAvailableVouchers] = useState<any[]>([]);

  useEffect(() => {
    const fetchAvailableVouchers = async () => {
      try {
        const response = await fetch("/api/customer/vouchers");
        const data = await response.json();
        if (response.ok) {
          setAvailableVouchers(data.active || []);
        }
      } catch (e) {
        console.error("Error loading available vouchers:", e);
      }
    };
    fetchAvailableVouchers();

    const channel = supabase
      .channel("cart_vouchers_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vouchers" },
        () => {
          fetchAvailableVouchers();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "customer_vouchers" },
        () => {
          fetchAvailableVouchers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleApplyVoucher = async () => {
    if (!voucherCodeInput) return toast.error("Masukkan kode voucher terlebih dahulu");
    setIsApplyingVoucher(true);
    try {
      const response = await fetch("/api/customer/vouchers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: voucherCodeInput })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal menerapkan voucher");
      }
      
      setAppliedVoucher(data.voucher);
      toast.success(data.message || "Voucher berhasil diterapkan!");
      setVoucherCodeInput("");
    } catch (error: any) {
      toast.error(error.message || "Voucher tidak valid!");
    } finally {
      setIsApplyingVoucher(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    toast.success("Voucher berhasil dihapus");
  };

  const subtotal = getTotal();
  const discountAmount = appliedVoucher ? Math.round(subtotal * appliedVoucher.discount_percent / 100) : 0;
  const totalAmount = Math.max(0, subtotal - discountAmount);

  const [orderType, setOrderType] = useState<"dine_in" | "takeaway" | "delivery">("dine_in");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "non_cash">("non_cash");
  const [duitkuMethod, setDuitkuMethod] = useState("");
  const [openingTime, setOpeningTime] = useState<string | null>(null);
  const [closingTime, setClosingTime] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isTemporaryClosed, setIsTemporaryClosed] = useState<boolean>(false);
  const [isHoliday, setIsHoliday] = useState<boolean>(false);
  const [holidayReopenDate, setHolidayReopenDate] = useState<string>("");
  const [is24Hours, setIs24Hours] = useState<boolean>(false);
  const [temporaryClosedReopenTime, setTemporaryClosedReopenTime] = useState<string>("");
  
  // Cashless flow states
  const [nonCashCategory, setNonCashCategory] = useState<"ewallet" | "transfer" | "qris" | "others">("qris");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("selected_table") || "";
    }
    return "";
  });
  const [orderNotes, setOrderNotes] = useState("");
  const [loading, setLoading] = useState(false);
  
  // QRIS Timer
  const [qrisTimer, setQrisTimer] = useState(600); // 10 minutes in seconds
  const [qrisExpired, setQrisExpired] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isOrderCompleted = useRef(false);
  const selectedTableRef = useRef("");

  // Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Delivery Form States
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryProvince, setDeliveryProvince] = useState("");
  const [deliveryRegency, setDeliveryRegency] = useState("");
  const [deliveryDistrict, setDeliveryDistrict] = useState("");
  const [deliveryVillage, setDeliveryVillage] = useState("");
  const [deliveryPostalCode, setDeliveryPostalCode] = useState("");
  const [taxPercent, setTaxPercent] = useState<number>(10.00);

  // Administrative regions select state
  const [regencies, setRegencies] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);

  const [regencyMode, setRegencyMode] = useState<"select" | "manual">("select");
  const [districtMode, setDistrictMode] = useState<"select" | "manual">("select");
  const [villageMode, setVillageMode] = useState<"select" | "manual">("select");

  const handleProvinceChange = async (provName: string) => {
    setDeliveryProvince(provName);
    setDeliveryRegency("");
    setDeliveryDistrict("");
    setDeliveryVillage("");
    setRegencies([]);
    setDistricts([]);
    setVillages([]);
    setRegencyMode("select");
    setDistrictMode("select");
    setVillageMode("select");

    if (!provName) return;

    const foundProv = INDONESIAN_PROVINCES.find(p => p.name === provName);
    if (foundProv) {
      try {
        const res = await fetch(`https://emsifa.github.io/api-wilayah-indonesia/api/regencies/${foundProv.id}.json`);
        if (!res.ok) throw new Error("Gagal mengambil data kabupaten/kota");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setRegencies(data);
          setRegencyMode("select");
        } else {
          setRegencyMode("manual");
        }
      } catch (err) {
        console.error("Error fetching regencies, switching to manual input:", err);
        setRegencyMode("manual");
      }
    } else {
      setRegencyMode("manual");
    }
  };

  const handleRegencyChange = async (regName: string) => {
    setDeliveryRegency(regName);

    if (regencyMode === "manual") {
      setDistrictMode("manual");
      setVillageMode("manual");
      return;
    }

    setDeliveryDistrict("");
    setDeliveryVillage("");
    setDistricts([]);
    setVillages([]);
    setDistrictMode("select");
    setVillageMode("select");

    if (!regName) return;

    const foundReg = regencies.find(r => r.name === regName);
    if (foundReg) {
      try {
        const res = await fetch(`https://emsifa.github.io/api-wilayah-indonesia/api/districts/${foundReg.id}.json`);
        if (!res.ok) throw new Error("Gagal mengambil data kecamatan");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setDistricts(data);
          setDistrictMode("select");
        } else {
          setDistrictMode("manual");
        }
      } catch (err) {
        console.error("Error fetching districts, switching to manual input:", err);
        setDistrictMode("manual");
      }
    } else {
      setDistrictMode("manual");
    }
  };

  const handleDistrictChange = async (distName: string) => {
    setDeliveryDistrict(distName);

    if (districtMode === "manual") {
      setVillageMode("manual");
      return;
    }

    setDeliveryVillage("");
    setVillages([]);
    setVillageMode("select");

    if (!distName) return;

    const foundDist = districts.find(d => d.name === distName);
    if (foundDist) {
      try {
        const res = await fetch(`https://emsifa.github.io/api-wilayah-indonesia/api/villages/${foundDist.id}.json`);
        if (!res.ok) throw new Error("Gagal mengambil data kelurahan");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setVillages(data);
          setVillageMode("select");
        } else {
          setVillageMode("manual");
        }
      } catch (err) {
        console.error("Error fetching villages, switching to manual input:", err);
        setVillageMode("manual");
      }
    } else {
      setVillageMode("manual");
    }
  };
  
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

  useEffect(() => {
    if (showPaymentModal) {
      setTxId(`TX${Date.now().toString().slice(-8)}`);
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

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    selectedTableRef.current = selectedTable;
    if (typeof window !== "undefined") {
      if (selectedTable) {
        localStorage.setItem("selected_table", selectedTable);
      } else {
        localStorage.removeItem("selected_table");
      }
    }
  }, [selectedTable]);

  useEffect(() => {
    if (orderType === "dine_in") {
      fetchTables();
      
      const tablesChannel = supabase.channel("cart_tables_realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => {
          fetchTables();
        })
        .subscribe();

      const interval = setInterval(() => {
        fetchTables();
      }, 3000);

      return () => {
        supabase.removeChannel(tablesChannel);
        clearInterval(interval);
      };
    }
  }, [orderType]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!isOrderCompleted.current && selectedTableRef.current) {
        supabase.from("tables").update({ status: "available" }).eq("id", selectedTableRef.current);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (!isOrderCompleted.current && selectedTableRef.current) {
        supabase.from("tables").update({ status: "available" }).eq("id", selectedTableRef.current);
      }
    };
  }, []);

  // Realtime Out of Stock Sync for Cart items
  useEffect(() => {
    const channel = supabase.channel("cart_items_realtime_stock_sync")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "menu_items" }, (payload) => {
        if (payload.new.is_active === false) {
          const itemInCart = items.find(i => i.id === payload.new.id);
          if (itemInCart) {
            removeItem(payload.new.id);
            toast((t) => (
              <div className="flex flex-col gap-1.5 p-1">
                <p className="font-extrabold text-sm text-red-600">Peringatan Stok Habis!</p>
                <p className="text-xs text-text-light dark:text-text-dark leading-relaxed">
                  Perhatian, menu <span className="font-bold text-primary">{payload.new.name}</span> dalam keranjang Anda sudah habis dan telah dihapus secara otomatis. Silakan lanjutkan pesanan dengan menu yang masih tersedia.
                </p>
              </div>
            ), { duration: 8000, position: "top-center" });
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [items, removeItem]);

  // Realtime Operational Hours Sync
  useEffect(() => {
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
        if (data.tax_percent !== undefined && data.tax_percent !== null) {
          setTaxPercent(Number(data.tax_percent));
        }
      }
    };
    fetchSettings();

    const channel = supabase.channel("cart_operational_hours_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_settings" }, (payload: any) => {
        if (payload.new) {
          setOpeningTime(payload.new.opening_time);
          setClosingTime(payload.new.closing_time);
          setIsTemporaryClosed(!!payload.new.is_temporary_closed);
          setIsHoliday(!!payload.new.is_holiday);
          setHolidayReopenDate(payload.new.holiday_reopen_date || "Besok");
          setTemporaryClosedReopenTime(payload.new.temporary_closed_reopen_time || "12:00");
          setIs24Hours(!!payload.new.is_24_hours);
          if (payload.new.tax_percent !== undefined && payload.new.tax_percent !== null) {
            setTaxPercent(Number(payload.new.tax_percent));
          }
        }
      })
      .subscribe();

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // 1-second interval to guarantee instantaneous auto-reopen response

    return () => {
      supabase.removeChannel(channel);
      clearInterval(timer);
    };
  }, []);

  // QRIS Countdown Timer
  useEffect(() => {
    if (showPaymentModal && paymentMethod === "non_cash" && nonCashCategory === "qris") {
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
  }, [showPaymentModal, paymentMethod, nonCashCategory]);

  const fetchTables = async () => {
    const { data } = await supabase.from("tables").select("*").order("table_number");
    if (data) setTables(data);
  };

  const handleTableChange = async (newTableId: string) => {
    if (!newTableId) {
      const prevTableId = selectedTable;
      setSelectedTable("");
      if (prevTableId) {
        setTables(prev => prev.map(t => t.id === prevTableId ? { ...t, status: "available" } : t));
        await supabase.from("tables").update({ status: "available" }).eq("id", prevTableId);
      }
      return;
    }

    const chosenTable = tables.find(t => t.id === newTableId);
    if (chosenTable && chosenTable.status === "occupied" && newTableId !== selectedTable) {
      toast.error(`Meja ${chosenTable.table_number} sedang digunakan/terisi oleh pelanggan lain!`);
      return;
    }

    const prevTableId = selectedTable;
    setSelectedTable(newTableId);

    // Update local tables array state immediately for 100% lag-free UI!
    setTables(prev => prev.map(t => {
      if (t.id === prevTableId) return { ...t, status: "available" };
      if (t.id === newTableId) return { ...t, status: "occupied" };
      return t;
    }));

    try {
      if (prevTableId) {
        await supabase.from("tables").update({ status: "available" }).eq("id", prevTableId);
      }
      if (newTableId) {
        await supabase.from("tables").update({ status: "occupied" }).eq("id", newTableId);
      }
    } catch (e) {
      console.error("Error updating table lock:", e);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleProcessPayment = () => handleCheckoutClick();

  const handleCheckoutClick = async () => {
    if (items.length === 0) return toast.error("Keranjang kosong");
    const storeStatus = getStoreStatus(openingTime, closingTime, isTemporaryClosed, isHoliday, holidayReopenDate, temporaryClosedReopenTime, is24Hours);
    if (!storeStatus.isOpen) {
      toast.error(`Gagal Checkout! Mohon maaf, ${storeStatus.message}`, { duration: 6000 });
      return;
    }
    if (orderType === "dine_in" && !selectedTable) return toast.error("Silakan pilih meja");
    if (orderType === "delivery") {
      if (!deliveryName || !deliveryPhone || !deliveryAddress || !deliveryProvince || !deliveryRegency || !deliveryDistrict || !deliveryVillage || !deliveryPostalCode) {
        return toast.error("Silakan lengkapi informasi pengiriman");
      }
    }
    
    setLoading(true);
    const loadingToast = toast.loading("Memproses pesanan...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Silakan login kembali");
      const { data: profile } = await supabase.from("profiles").select("id, full_name, email").eq("user_id", session.user.id).single();
      if (!profile) throw new Error("Profil tidak ditemukan");

      const dbPaymentMethod = paymentMethod === "cash" ? "cash" : "non_cash";
      
      const detailedPaymentNotes = paymentMethod === "non_cash" ? "[Pembayaran Online]" : "[Tunai di Kasir]";
      const finalNotes = `${detailedPaymentNotes} ${orderNotes}`.trim();

      const { data: orderData, error: orderError } = await supabase.from("orders").insert({
        customer_id: profile.id, 
        table_id: orderType === "dine_in" ? selectedTable : null,
        order_type: orderType, 
        total_amount: totalAmount, 
        notes: finalNotes,
        status: "pending", 
        payment_method: dbPaymentMethod, 
        payment_status: 'unpaid',
        voucher_id: appliedVoucher ? appliedVoucher.id : null,
        discount: discountAmount,
        delivery_recipient_name: orderType === "delivery" ? deliveryName : null,
        delivery_phone: orderType === "delivery" ? deliveryPhone : null,
        delivery_address: orderType === "delivery" ? deliveryAddress : null,
        delivery_province: orderType === "delivery" ? deliveryProvince : null,
        delivery_regency: orderType === "delivery" ? deliveryRegency : null,
        delivery_district: orderType === "delivery" ? deliveryDistrict : null,
        delivery_village: orderType === "delivery" ? deliveryVillage : null,
        delivery_postal_code: orderType === "delivery" ? deliveryPostalCode : null,
      }).select().single();

      if (orderError) throw orderError;

      const orderItems = items.map(item => ({
        order_id: orderData.id, 
        menu_item_id: item.id, 
        quantity: item.quantity,
        price: item.price, 
        subtotal: item.price * item.quantity, 
        notes: item.notes || null,
      }));
      
      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) throw itemsError;

      if (orderType === "dine_in") {
        await supabase.from("tables").update({ status: "occupied" }).eq("id", selectedTable);
      }

      if (paymentMethod === "cash") {
        isOrderCompleted.current = true;
        if (typeof window !== "undefined") localStorage.removeItem("selected_table");
        clearCart();

        // Trigger Notification
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: orderData.id, action: 'notify_created' }),
        });

        toast.success("Pesanan berhasil dibuat! Silakan bayar tunai di kasir.", { id: loadingToast });
        router.push(`/customer/orders/${orderData.id}`);
        return;
      }

      if (paymentMethod === "non_cash") {
        toast.loading("Membangun portal pembayaran aman...", { id: loadingToast });
        const res = await fetch('/api/payment/create-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            orderId: orderData.id,
            paymentMethod: "", 
            returnUrl: `${window.location.origin}/customer/orders/${orderData.id}`,
            customer_name: profile.full_name,
            customer_email: profile.email
          })
        });
        const duitkuData = await res.json();
        
        if (!res.ok) throw new Error(duitkuData.error || 'Gagal memicu gateway pembayaran');
        
        if (duitkuData.reference && typeof (window as any).checkout !== 'undefined') {
          toast.dismiss(loadingToast);
          setLoading(false);
          
          // INJECT DUITKU POP SDK OVERLAY
          (window as any).checkout.process(duitkuData.reference, {
             successEvent: async function() {
               isOrderCompleted.current = true;
               if (typeof window !== "undefined") localStorage.removeItem("selected_table");
               clearCart();
               
               // Trigger Notification
               await fetch('/api/orders', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ orderId: orderData.id, action: 'notify_created' }),
               });

               toast.success("Pembayaran Berhasil!");
               router.push(`/customer/orders/${orderData.id}`);
             },
             pendingEvent: async function() {
               isOrderCompleted.current = true;
               if (typeof window !== "undefined") localStorage.removeItem("selected_table");
               clearCart();
               
               // Trigger Notification
               await fetch('/api/orders', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ orderId: orderData.id, action: 'notify_created' }),
               });

               router.push(`/customer/orders/${orderData.id}?status=pending`);
             },
             errorEvent: async function() {
               isOrderCompleted.current = true;
               if (typeof window !== "undefined") localStorage.removeItem("selected_table");
               clearCart();
               toast.error("Pembayaran gagal. Pesanan disimpan sebagai Belum Bayar.");
               router.push(`/customer/orders/${orderData.id}`);
             },
             closeEvent: async function() {
               isOrderCompleted.current = true;
               if (typeof window !== "undefined") localStorage.removeItem("selected_table");
               clearCart();
               toast.success("Pesanan disimpan. Silakan selesaikan pembayaran Anda.");
               router.push(`/customer/orders/${orderData.id}`);
             }
          });
          return;
        } else if (duitkuData.paymentUrl) {
          isOrderCompleted.current = true;
          if (typeof window !== "undefined") localStorage.removeItem("selected_table");
          clearCart();
          
          await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: orderData.id, action: 'notify_created' }),
          });

          toast.success("Mengalihkan ke halaman pembayaran...", { id: loadingToast });
          window.location.href = duitkuData.paymentUrl;
          return;
        } else {
          throw new Error("Parameter pembayaran ditolak gateway.");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Gagal membuat pesanan", { id: loadingToast });
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="w-12 h-12 text-primary" />
        </motion.div>
        <h2 className="text-2xl font-bold text-text-light dark:text-text-dark mb-2">Keranjang Kosong</h2>
        <p className="text-muted mb-8">Anda belum menambahkan hidangan apapun.</p>
        <button onClick={() => router.push("/customer/menu")} className="bg-primary text-white px-8 py-3 rounded-full font-medium hover:bg-primary-hover transition-colors">Eksplor Menu Sekarang</button>
      </div>
    );
  }

  const storeStatus = getStoreStatus(openingTime, closingTime, isTemporaryClosed, isHoliday, holidayReopenDate, temporaryClosedReopenTime, is24Hours);
  const isOpen = storeStatus.isOpen;

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20 p-4">
      <div className="lg:col-span-2 space-y-6">
        <h1 className="text-3xl font-bold text-text-light dark:text-text-dark mb-6">Keranjang Anda</h1>
        <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl overflow-hidden shadow-sm">
          <AnimatePresence>
            {items.map((item, index) => (
              <motion.div layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} key={item.id} className={`p-6 flex flex-col sm:flex-row gap-6 sm:items-center ${index !== items.length - 1 ? "border-b border-border-light dark:border-border-dark" : ""}`}>
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-border-light dark:border-border-dark">
                  <Image src={item.image_url || "https://placehold.co/100x100"} alt={item.name} fill className="object-cover" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-xl text-text-light dark:text-text-dark">{item.name}</h3>
                    <button onClick={() => removeItem(item.id)} title="Hapus Item" aria-label="Hapus Item" className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-xl transition-colors"><Trash2 className="w-5 h-5" /></button>
                  </div>
                  <p className="text-primary font-bold text-lg mt-1">Rp {item.price.toLocaleString("id-ID")}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 bg-background-light dark:bg-background-dark p-1.5 rounded-xl border border-border-light dark:border-border-dark">
                      <button onClick={() => updateQuantity(item.id, item.quantity - 1)} title="Kurangi Jumlah" aria-label="Kurangi Jumlah" className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Minus className="w-4 h-4 text-text-light dark:text-text-dark" /></button>
                      <span className="font-bold w-6 text-center text-text-light dark:text-text-dark">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)} title="Tambah Jumlah" aria-label="Tambah Jumlah" className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Plus className="w-4 h-4 text-text-light dark:text-text-dark" /></button>
                    </div>
                    <input type="text" placeholder="Catatan khusus..." value={item.notes || ""} onChange={e => updateNotes(item.id, e.target.value)} className="flex-1 text-sm bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-text-light dark:text-text-dark" title="Catatan Item" />
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-8 shadow-sm sticky top-24">
          <h2 className="text-2xl font-bold text-text-light dark:text-text-dark mb-6">Ringkasan</h2>
          
          <div className="space-y-4 mb-8">
            <div className="flex justify-between text-muted"><span>Subtotal</span><span className="font-semibold text-text-light dark:text-text-dark">Rp {subtotal.toLocaleString("id-ID")}</span></div>
            {appliedVoucher && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Diskon ({appliedVoucher.discount_percent}%)</span>
                <span className="font-bold">-Rp {discountAmount.toLocaleString("id-ID")}</span>
              </div>
            )}
            <div className="flex justify-between text-muted">
              <span>Pajak ({taxPercent}%)</span>
              <span className="font-semibold text-text-light dark:text-text-dark">
                Rp {Math.round(subtotal * taxPercent / (100 + taxPercent)).toLocaleString("id-ID")} (Termasuk)
              </span>
            </div>
            
            {/* Input Kode Voucher */}
            <div className="pt-4 border-t border-border-light dark:border-border-dark space-y-3">
              <label className="text-xs font-bold text-muted uppercase tracking-wider block">Kupon / Voucher Promo</label>
              {!appliedVoucher ? (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Masukkan kode voucher..."
                      value={voucherCodeInput}
                      onChange={e => setVoucherCodeInput(e.target.value)}
                      className="flex-1 text-sm bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-text-light dark:text-text-dark uppercase font-mono"
                    />
                    <button
                      onClick={handleApplyVoucher}
                      disabled={isApplyingVoucher}
                      className="bg-primary hover:bg-primary/95 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center transition-all disabled:opacity-50"
                    >
                      {isApplyingVoucher ? "..." : "Gunakan"}
                    </button>
                  </div>
                  {availableVouchers.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] text-muted font-bold block uppercase tracking-wider">Voucher Anda (Klik untuk gunakan):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {availableVouchers.map((v: any) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => {
                              setVoucherCodeInput(v.code);
                              toast.success(`Kode ${v.code} dipilih! Klik Gunakan.`);
                            }}
                            className="text-[10px] font-mono font-black bg-primary/10 text-primary px-2.5 py-1 rounded-lg border border-primary/20 hover:bg-primary hover:text-white transition-all uppercase"
                          >
                            {v.code} ({v.discount_percent}%)
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/30 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <span className="font-mono font-black text-xs text-emerald-700 dark:text-emerald-300 uppercase">{appliedVoucher.code}</span>
                      <span className="block text-[10px] text-emerald-600 dark:text-emerald-400">Hemat {appliedVoucher.discount_percent}%</span>
                    </div>
                  </div>
                  <button
                    onClick={handleRemoveVoucher}
                    className="text-red-500 hover:text-red-700 text-xs font-bold p-1"
                  >
                    Hapus
                  </button>
                </div>
              )}
            </div>

            {appliedVoucher && (
              <div className="bg-emerald-50 dark:bg-emerald-950/10 rounded-xl p-3 border border-emerald-100/10 text-xs text-emerald-700 dark:text-emerald-300 flex justify-between font-bold">
                <span>Total Anda Hemat</span>
                <span>Rp {discountAmount.toLocaleString("id-ID")}</span>
              </div>
            )}

            <div className="pt-4 border-t border-border-light dark:border-border-dark flex justify-between items-center">
              <span className="font-bold text-lg text-text-light dark:text-text-dark">Total Tagihan</span>
              <span className="text-2xl font-black text-primary">Rp {totalAmount.toLocaleString("id-ID")}</span>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted mb-4">Tipe Pesanan</h3>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => setOrderType("dine_in")} className={`py-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${orderType === "dine_in" ? "border-primary bg-primary/5 text-primary" : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"}`}>
                  <UtensilsCrossed className="w-5 h-5" /><span className="font-bold text-[10px] uppercase">Dine In</span>
                </button>
                <button onClick={() => setOrderType("takeaway")} className={`py-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${orderType === "takeaway" ? "border-primary bg-primary/5 text-primary" : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"}`}>
                  <Store className="w-5 h-5" /><span className="font-bold text-[10px] uppercase">Takeaway</span>
                </button>
                <button onClick={() => setOrderType("delivery")} className={`py-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${orderType === "delivery" ? "border-primary bg-primary/5 text-primary" : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"}`}>
                  <Globe className="w-5 h-5" /><span className="font-bold text-[10px] uppercase">Delivery</span>
                </button>
              </div>
              <AnimatePresence>
                {orderType === "dine_in" && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pt-4 overflow-hidden">
                    <select value={selectedTable} onChange={e => handleTableChange(e.target.value)} className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-primary/20 text-text-light dark:text-text-dark font-medium" title="Pilih Meja">
                      <option value="">-- Pilih Meja --</option>
                      {tables.map(t => (
                        <option key={t.id} value={t.id}>
                          Meja {t.table_number} ({t.capacity} Orang) {t.status === "occupied" ? (t.id === selectedTable ? "- [MEJA ANDA]" : "- [TERISI]") : ""}
                        </option>
                      ))}
                    </select>
                  </motion.div>
                )}
                {orderType === "delivery" && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pt-4 space-y-3 overflow-hidden text-left">
                    <h4 className="text-[11px] font-black text-primary uppercase tracking-widest block mb-2">Informasi Pengiriman</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-muted uppercase block mb-1">Nama Penerima</label>
                        <input
                          type="text"
                          required
                          value={deliveryName}
                          onChange={e => setDeliveryName(e.target.value)}
                          placeholder="Nama Lengkap"
                          className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-muted uppercase block mb-1">No. HP Penerima</label>
                        <input
                          type="tel"
                          required
                          value={deliveryPhone}
                          onChange={e => setDeliveryPhone(e.target.value)}
                          placeholder="Contoh: 08123456789"
                          className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-muted uppercase block mb-1">Provinsi</label>
                        <select
                          required
                          value={deliveryProvince}
                          title="Provinsi"
                          onChange={e => handleProvinceChange(e.target.value)}
                          className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark"
                        >
                          <option value="">-- Pilih Provinsi --</option>
                          {INDONESIAN_PROVINCES.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-muted uppercase block mb-1">Kabupaten / Kota</label>
                        {regencyMode === "select" ? (
                          <select
                            required
                            disabled={!deliveryProvince}
                            value={deliveryRegency}
                            title="Kabupaten / Kota"
                            onChange={e => handleRegencyChange(e.target.value)}
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark disabled:opacity-50"
                          >
                            <option value="">-- Pilih Kabupaten --</option>
                            {regencies.map(r => (
                              <option key={r.id} value={r.name}>{r.name}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            required
                            value={deliveryRegency}
                            onChange={e => handleRegencyChange(e.target.value)}
                            placeholder="Ketik Kabupaten/Kota..."
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[9px] font-black text-muted uppercase block mb-1">Kecamatan</label>
                        {districtMode === "select" ? (
                          <select
                            required
                            disabled={!deliveryRegency}
                            value={deliveryDistrict}
                            title="Kecamatan"
                            onChange={e => handleDistrictChange(e.target.value)}
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark disabled:opacity-50"
                          >
                            <option value="">-- Pilih Kecamatan --</option>
                            {districts.map(d => (
                              <option key={d.id} value={d.name}>{d.name}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            required
                            value={deliveryDistrict}
                            onChange={e => handleDistrictChange(e.target.value)}
                            placeholder="Ketik Kecamatan..."
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark"
                          />
                        )}
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-muted uppercase block mb-1">Kelurahan / Desa</label>
                        {villageMode === "select" ? (
                          <select
                            required
                            disabled={!deliveryDistrict}
                            value={deliveryVillage}
                            title="Kelurahan / Desa"
                            onChange={e => setDeliveryVillage(e.target.value)}
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark disabled:opacity-50"
                          >
                            <option value="">-- Pilih Kelurahan --</option>
                            {villages.map(v => (
                              <option key={v.id} value={v.name}>{v.name}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            required
                            value={deliveryVillage}
                            onChange={e => setDeliveryVillage(e.target.value)}
                            placeholder="Ketik Kelurahan/Desa..."
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="text-[9px] font-black text-muted uppercase block mb-1">Alamat Lengkap</label>
                        <input
                          type="text"
                          required
                          value={deliveryAddress}
                          onChange={e => setDeliveryAddress(e.target.value)}
                          placeholder="Nama Jalan, Blok, RT/RW, No. Rumah"
                          className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black text-muted uppercase block mb-1">Kode Pos</label>
                        <input
                          type="text"
                          required
                          value={deliveryPostalCode}
                          onChange={e => setDeliveryPostalCode(e.target.value)}
                          placeholder="Kode Pos"
                          className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div>
              <h3 className="font-bold text-sm uppercase tracking-wider text-muted mb-4">Metode Pembayaran</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => setPaymentMethod("cash")} className={`py-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${paymentMethod === "cash" ? "border-primary bg-primary/5 text-primary" : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"}`}>
                  <Banknote className="w-6 h-6" /><span className="font-bold text-xs uppercase">Tunai</span>
                </button>
                <button onClick={() => setPaymentMethod("non_cash")} className={`py-4 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${paymentMethod === "non_cash" ? "border-primary bg-primary/5 text-primary" : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"}`}>
                  <CreditCard className="w-6 h-6" /><span className="font-bold text-xs uppercase">Non-Tunai</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="font-bold text-sm uppercase tracking-wider text-muted block ml-1">Catatan Pesanan</label>
              <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2} className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl px-4 py-3.5 outline-none focus:ring-2 focus:ring-primary/20 text-text-light dark:text-text-dark" placeholder="Contoh: Tanpa bawang, pedas sedang..." />
            </div>

            <motion.button 
              whileHover={isOpen ? { scale: 1.02 } : {}} 
              whileTap={isOpen ? { scale: 0.98 } : {}} 
              onClick={() => paymentMethod === "cash" ? setShowPaymentModal(true) : handleCheckoutClick()} 
              disabled={!isOpen || loading}
              className={`w-full py-4 rounded-2xl font-black text-lg flex justify-center items-center gap-2 transition-all mt-4 uppercase tracking-wider ${
                isOpen 
                  ? "bg-primary hover:bg-primary-hover text-white shadow-xl shadow-primary/30 cursor-pointer" 
                  : "bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed border border-gray-400/20 shadow-none"
              }`}
            >
              {!isOpen && <Clock className="w-5 h-5 animate-pulse text-red-500" />}
              {isOpen ? "Lanjut ke Pembayaran" : "Restoran Tutup"} {isOpen && <ArrowRight className="w-6 h-6" />}
            </motion.button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPaymentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => setShowPaymentModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} onClick={e => e.stopPropagation()} className="bg-card-light dark:bg-card-dark rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden border border-border-light dark:border-border-dark my-8">
              <div className="bg-primary p-8 text-white flex justify-between items-center relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                <div className="relative">
                  <h2 className="text-2xl font-black uppercase tracking-tight">Selesaikan Pembayaran</h2>
                  <p className="text-white/80 text-sm mt-1">Total Tagihan: <span className="font-extrabold text-white text-base">Rp {totalAmount.toLocaleString("id-ID")}</span></p>
                </div>
                <button onClick={() => setShowPaymentModal(false)} title="Tutup" aria-label="Tutup" className="p-2 hover:bg-white/10 rounded-full text-white relative z-10"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {paymentMethod === "cash" && (
                  <div className="space-y-6 text-center py-6">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                      <Banknote className="w-10 h-10" />
                    </div>
                    <div className="space-y-2 max-w-md mx-auto">
                      <h3 className="font-black text-xl text-text-light dark:text-text-dark">Pembayaran Tunai</h3>
                      <p className="text-muted text-sm leading-relaxed">
                        Pesanan Anda akan dikirim ke dapur. Pembayaran dilakukan secara tunai kepada kasir saat pesanan selesai atau ketika Anda mengambil makanan.
                      </p>
                    </div>
                    <div className="flex gap-4 pt-4 border-t border-border-light dark:border-border-dark">
                      <button onClick={() => setShowPaymentModal(false)} className="flex-1 py-4 border border-border-light dark:border-border-dark rounded-2xl font-bold text-muted hover:bg-gray-50 transition-colors">Batal</button>
                      <button onClick={handleCheckoutClick} disabled={loading} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Konfirmasi Pesanan</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
