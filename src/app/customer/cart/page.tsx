"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Plus, Minus, ShoppingBag, UtensilsCrossed, ArrowRight, Loader2, Store, CreditCard, Banknote, Smartphone, Landmark, QrCode, CheckCircle, AlertTriangle, RefreshCw, X, Receipt, Sparkles, ChevronRight, HelpCircle, Clock, Globe, Ticket, Wallet, Lock, Search, ChevronDown, MapPin } from "lucide-react";
import { useCartStore } from "@/store/useCartStore";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import Image from "next/image";
import { generateQRISString, getEWalletDeepLink } from "@/utils/qris";
import { isRestaurantOpen, getOperationalStatus, getStoreStatus } from "@/utils/operationalHours";
import BaseModal from "@/components/BaseModal";


interface Table { id: string; table_number: number; capacity: number; status: string; }

const INDONESIAN_PROVINCES = [
  { id: "34", name: "DAERAH ISTIMEWA YOGYAKARTA" }
];

interface SearchableSelectProps {
  label: string;
  placeholder: string;
  options: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  align?: "left" | "right";
}

function SearchableSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled = false,
  loading = false,
  align = "left"
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedOption = options.find(opt => opt.name === value);

  return (
    <div className="relative w-full text-left" ref={dropdownRef}>
      <label className="text-[10px] font-semibold text-muted/80 uppercase block mb-1">{label}</label>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        className={`w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-3.5 py-2 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark flex items-center justify-between text-left transition-all ${
          disabled || loading ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50"
        }`}
      >
        <span className={selectedOption ? "text-text-light dark:text-text-dark font-semibold truncate pr-2 md:whitespace-normal md:overflow-visible" : "text-muted truncate pr-2 md:whitespace-normal md:overflow-visible"}>
          {loading ? "Memuat..." : selectedOption ? selectedOption.name : placeholder}
        </span>
        {loading ? (
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
        ) : (
          <ChevronDown className={`w-4 h-4 text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        )}
      </button>

      {isOpen && !disabled && !loading && (
        <div className={`absolute ${align === "right" ? "right-0" : "left-0"} mt-1.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl shadow-xl z-50 overflow-hidden max-h-60 flex flex-col w-max min-w-full max-w-[calc(100vw-2rem)] sm:max-w-[400px]`}>
          <div className="p-2 border-b border-border-light dark:border-border-dark bg-background-light/50 dark:bg-background-dark/50 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-muted shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari..."
              className="w-full bg-transparent border-0 text-xs outline-none text-text-light dark:text-text-dark font-medium placeholder-muted"
            />
          </div>
          <div className="overflow-y-auto flex-1 custom-scrollbar max-h-48 py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-xs text-muted text-center">Data tidak ditemukan</div>
            ) : (
              filteredOptions.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.name);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-primary/5 hover:text-primary transition-colors flex items-center justify-between ${
                    opt.name === value ? "bg-primary/10 text-primary" : "text-text-light dark:text-text-dark"
                  }`}
                >
                  <span className="whitespace-nowrap truncate pr-4 text-left" title={opt.name}>{opt.name}</span>
                  {opt.name === value && <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}



export default function CartPage() {
  const { items, removeItem, updateQuantity, updateNotes, getTotal, clearCart } = useCartStore();
  
  // Voucher States
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [isApplyingVoucher, setIsApplyingVoucher] = useState(false);
  const [availableVouchers, setAvailableVouchers] = useState<any[]>([]);
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway" | "delivery">("dine_in");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "non_cash" | "wallet">("non_cash");
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
      const { data: { session } } = await supabase.auth.getSession();
      let customerId = null;
      if (session?.user) {
        const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", session.user.id).single();
        if (profile) customerId = profile.id;
      }

      const response = await fetch("/api/customer/vouchers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code: voucherCodeInput,
          subtotal: subtotal,
          customerId: customerId,
          orderType: orderType
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal menerapkan voucher");
      }
      
      const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
      if (data.voucher?.code?.startsWith("FREEFOOD-") && totalItemsCount > 5) {
        throw new Error("Voucher makanan gratis hanya berlaku untuk maksimal 5 item di keranjang.");
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

  useEffect(() => {
    if (appliedVoucher && appliedVoucher.min_transaction && subtotal < appliedVoucher.min_transaction) {
      setAppliedVoucher(null);
      toast.error(`Voucher dilepas karena subtotal belanja kurang dari minimal transaksi Rp ${appliedVoucher.min_transaction.toLocaleString("id-ID")}`);
    }
  }, [subtotal, appliedVoucher]);

  useEffect(() => {
    if (appliedVoucher && appliedVoucher.voucher_type === 'shipping' && orderType !== 'delivery') {
      setAppliedVoucher(null);
      toast.error("Voucher diskon ongkir dilepas karena tipe pesanan diubah ke non-delivery");
    }
  }, [orderType, appliedVoucher]);



  // Restaurant shipping settings
  const [restoLat, setRestoLat] = useState<number>(-7.7829);
  const [restoLng, setRestoLng] = useState<number>(110.3323);
  const [shippingRate, setShippingRate] = useState<number>(2500);
  const [minShippingDistance, setMinShippingDistance] = useState<number>(1);
  const [maxShippingDistance, setMaxShippingDistance] = useState<number>(15);
  const [additionalZoneCharge, setAdditionalZoneCharge] = useState<number>(0);
  const [minOrderFreeShipping, setMinOrderFreeShipping] = useState<number>(100000);
  const [isShippingEnabled, setIsShippingEnabled] = useState<boolean>(true);

  // Delivery calculation states
  const [customerCoords, setCustomerCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);


  const shippingFee = (orderType === "delivery" && distanceKm !== null)
    ? Math.round(Math.max(distanceKm, minShippingDistance) * shippingRate) + additionalZoneCharge
    : 0;

  const shippingDiscount = (orderType === "delivery" && shippingFee > 0 && appliedVoucher && appliedVoucher.voucher_type === 'shipping')
    ? (appliedVoucher.discount_type === 'percent'
        ? Math.round(shippingFee * Number(appliedVoucher.discount_percent || 0) / 100)
        : Math.min(shippingFee, Number(appliedVoucher.discount_value || 0)))
    : 0;

  const discountAmount = (appliedVoucher && appliedVoucher.voucher_type !== 'shipping')
    ? (appliedVoucher.discount_type === 'percent'
        ? Math.round(subtotal * Number(appliedVoucher.discount_percent || 0) / 100)
        : Math.min(subtotal, Number(appliedVoucher.discount_value || 0)))
    : 0;

  const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee - shippingDiscount);



  const [profileData, setProfileData] = useState<any>(null);
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
  
  // Wallet Top Up States inside checkout
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [submittingTopUp, setSubmittingTopUp] = useState(false);

  // Wallet PIN payment states
  const [showPinPaymentModal, setShowPinPaymentModal] = useState(false);
  const [paymentPin, setPaymentPin] = useState("");
  const [pinRemainingAttempts, setPinRemainingAttempts] = useState<number | null>(null);

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

  const [loadingDistance, setLoadingDistance] = useState(false);

  // Geocode address in real-time using OSM Nominatim
  const geocodeAddressRealtime = async (address: string, village: string, district: string, regency: string, province: string) => {
    if (!address || !district || !regency || !province) return;
    setLoadingDistance(true);
    
    // We construct a query from the manual inputs
    const queryParts = [];
    if (address) queryParts.push(address);
    if (village) queryParts.push(village);
    if (district) queryParts.push(district);
    if (regency) queryParts.push(regency);
    if (province) queryParts.push(province);
    queryParts.push("Indonesia");
    
    const query = queryParts.join(", ");
    
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
        headers: {
          'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
          'User-Agent': 'RestoBook/1.0 (contact@restobookid.my.id)'
        }
      });
      if (!response.ok) throw new Error("Gagal melakukan request geocoding");
      const results = await response.json();
      
      if (results && results.length > 0) {
        const lat = Number(results[0].lat);
        const lng = Number(results[0].lon);
        setCustomerCoords({ lat, lng });
        const dist = calculateHaversineDistance(restoLat, restoLng, lat, lng);
        setDistanceKm(dist);
      } else {
        // Fallback: try search with village, district, regency, province (if detailed street address failed)
        const fallbackParts = [];
        if (village) fallbackParts.push(village);
        if (district) fallbackParts.push(district);
        if (regency) fallbackParts.push(regency);
        if (province) fallbackParts.push(province);
        fallbackParts.push("Indonesia");
        const fallbackQuery = fallbackParts.join(", ");
        
        const fallbackResponse = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fallbackQuery)}&format=json&limit=1`, {
          headers: {
            'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
            'User-Agent': 'RestoBook/1.0 (contact@restobookid.my.id)'
          }
        });
        
        if (fallbackResponse.ok) {
          const fallbackResults = await fallbackResponse.json();
          if (fallbackResults && fallbackResults.length > 0) {
            const lat = Number(fallbackResults[0].lat);
            const lng = Number(fallbackResults[0].lon);
            setCustomerCoords({ lat, lng });
            const dist = calculateHaversineDistance(restoLat, restoLng, lat, lng);
            setDistanceKm(dist);
            return;
          }
        }
        
        setDistanceKm(null);
        setCustomerCoords(null);
      }
    } catch (error) {
      console.error("OSM Nominatim error:", error);
    } finally {
      setLoadingDistance(false);
    }
  };

  useEffect(() => {
    if (orderType === "delivery" && deliveryAddress && deliveryDistrict && deliveryRegency && deliveryProvince) {
      const timer = setTimeout(() => {
        geocodeAddressRealtime(deliveryAddress, deliveryVillage, deliveryDistrict, deliveryRegency, deliveryProvince);
      }, 1000); // 1 second debounce
      return () => clearTimeout(timer);
    } else {
      setDistanceKm(null);
      setCustomerCoords(null);
    }
  }, [deliveryAddress, deliveryVillage, deliveryDistrict, deliveryRegency, deliveryProvince, orderType]);

  // Administrative regions select state
  const [regencies, setRegencies] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [villages, setVillages] = useState<any[]>([]);
  const [postalCodes, setPostalCodes] = useState<string[]>([]);
  const [postalCodeMapping, setPostalCodeMapping] = useState<any[]>([]);

  // Loading States
  const [loadingRegencies, setLoadingRegencies] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [loadingPostalCodes, setLoadingPostalCodes] = useState(false);

  // Dynamic Provinces State loaded from local JSON
  const [provincesList, setProvincesList] = useState<any[]>(INDONESIAN_PROVINCES);
  const [activeProvinceData, setActiveProvinceData] = useState<any>(null);

  useEffect(() => {
    fetch("/data/wilayah/provinces.json")
      .then(res => {
        if (!res.ok) throw new Error("Gagal mengambil data provinsi");
        return res.json();
      })
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setProvincesList(data);
        }
      })
      .catch(err => {
        console.error("Error loading local provinces, using fallback:", err);
      });
  }, []);

  const handleProvinceChange = async (provName: string) => {
    setDeliveryProvince(provName);
    setDeliveryRegency("");
    setDeliveryDistrict("");
    setDeliveryVillage("");
    setDeliveryPostalCode("");
    setRegencies([]);
    setDistricts([]);
    setVillages([]);
    setPostalCodes([]);
    setPostalCodeMapping([]);
    setActiveProvinceData(null);

    if (!provName) return;

    const foundProv = provincesList.find(p => p.name === provName);
    if (foundProv) {
      setLoadingRegencies(true);
      try {
        const res = await fetch(`/data/wilayah/provinces/${foundProv.id}.json`);
        if (!res.ok) throw new Error("Gagal mengambil data provinsi");
        const data = await res.json();
        if (data && Array.isArray(data.regencies)) {
          setActiveProvinceData(data);
          setRegencies(data.regencies);
        }
      } catch (err) {
        console.error("Error fetching regencies:", err);
        toast.error("Gagal memuat data kabupaten/kota. Silakan coba lagi.");
      } finally {
        setLoadingRegencies(false);
      }
    }
  };

  const handleRegencyChange = async (regName: string) => {
    setDeliveryRegency(regName);
    setDeliveryDistrict("");
    setDeliveryVillage("");
    setDeliveryPostalCode("");
    setDistricts([]);
    setVillages([]);
    setPostalCodes([]);
    setPostalCodeMapping([]);

    if (!regName) return;

    const foundReg = regencies.find(r => r.name === regName);
    if (foundReg && activeProvinceData) {
      setLoadingDistricts(true);
      try {
        const filteredDistricts = activeProvinceData.districts.filter(
          (d: any) => d.regency_id === foundReg.id
        );
        setDistricts(filteredDistricts);
      } catch (err) {
        console.error("Error filtering districts:", err);
      } finally {
        setLoadingDistricts(false);
      }
    }
  };

  const handleDistrictChange = async (distName: string) => {
    setDeliveryDistrict(distName);
    setDeliveryVillage("");
    setDeliveryPostalCode("");
    setVillages([]);
    setPostalCodes([]);
    setPostalCodeMapping([]);

    if (!distName) return;

    const foundDist = districts.find(d => d.name === distName);
    if (foundDist && activeProvinceData) {
      setLoadingVillages(true);
      setLoadingPostalCodes(true);

      // Filter villages locally
      try {
        const filteredVillages = activeProvinceData.villages.filter(
          (v: any) => v.district_id === foundDist.id
        );
        setVillages(filteredVillages);
      } catch (err) {
        console.error("Error filtering villages:", err);
      } finally {
        setLoadingVillages(false);
      }

      // Fetch postal codes
      const cleanReg = (name: string) => name.toLowerCase().replace(/^(kabupaten|kota)\s+/i, '').trim();
      const q = encodeURIComponent(distName);
      const fetchPostalCodesPromise = fetch(`https://kodepos.vercel.app/search?q=${q}`)
        .then(async (res) => {
          if (!res.ok) throw new Error("Gagal");
          const json = await res.json();
          if (json && Array.isArray(json.data)) {
            const filtered = json.data.filter((item: any) => {
              const matchProv = item.province.toLowerCase() === deliveryProvince.toLowerCase();
              const matchReg = cleanReg(item.regency) === cleanReg(deliveryRegency);
              const matchDist = item.district.toLowerCase() === distName.toLowerCase();
              return matchProv && matchReg && matchDist;
            });

            setPostalCodeMapping(filtered);
            const codes: string[] = Array.from(new Set(filtered.map((item: any) => String(item.code))));
            setPostalCodes(codes);
          }
        })
        .catch(err => {
          console.error("Error fetching postal codes:", err);
        })
        .finally(() => setLoadingPostalCodes(false));

      await fetchPostalCodesPromise;
    }
  };

  const handleVillageChange = (villageName: string) => {
    setDeliveryVillage(villageName);
    setDeliveryPostalCode("");

    // Try to auto-detect postal code from mapping
    const match = postalCodeMapping.find(
      item => item.village.toLowerCase() === villageName.toLowerCase()
    );
    if (match) {
      setDeliveryPostalCode(String(match.code));
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

  const fetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, wallet_balance, wallet_status")
        .eq("user_id", session.user.id)
        .single();
      if (data) {
        setProfileData(data);
      }
    }
  };

  const handleTopUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(topUpAmount);

    if (isNaN(amount) || amount <= 0) {
      toast.error("Nominal top up tidak valid");
      return;
    }

    if (amount < 10000) {
      toast.error("Minimal top up adalah Rp 10.000");
      return;
    }

    setSubmittingTopUp(true);
    const topupToast = toast.loading("Memproses request top up...");
    try {
      const res = await fetch("/api/customer/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gagal membuat invoice top up");

      toast.dismiss(topupToast);
      setShowTopUpModal(false);
      setTopUpAmount("");

      // Use Duitku Pop if available
      if (data.reference && typeof (window as any).checkout !== 'undefined') {
        (window as any).checkout.process(data.reference, {
          successEvent: function(result: any) {
            console.log("Duitku Wallet Topup Success:", result);
            toast.success("Top Up Berhasil! Saldo akan masuk dalam beberapa saat.");
            fetchProfile();
          },
          pendingEvent: function(result: any) {
            console.log("Duitku Wallet Topup Pending:", result);
            toast("Menunggu pembayaran...", { icon: <Loader2 className="w-4 h-4 animate-spin text-primary" /> });
            fetchProfile();
          },
          errorEvent: function(result: any) {
            console.error("Duitku Wallet Topup Error:", result);
            toast.error("Pembayaran dibatalkan.");
            fetchProfile();
          },
          closeEvent: function() {
            console.log("Duitku Pop Closed.");
            fetchProfile();
          }
        });
      } else if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("Gagal mengunduh tautan pembayaran.");
      }
    } catch (err: any) {
      toast.error(err.message, { id: topupToast });
    } finally {
      setSubmittingTopUp(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    const channel = supabase.channel("cart_profile_realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        fetchProfile();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
    if ((orderType === "dine_in" || orderType === "takeaway") && paymentMethod === "cash") {
      setPaymentMethod("non_cash");
    }
  }, [orderType, paymentMethod]);

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

  // Monitor FREEFOOD voucher item limit dynamically
  useEffect(() => {
    if (appliedVoucher && appliedVoucher.code?.startsWith("FREEFOOD-")) {
      const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
      if (totalItemsCount > 5) {
        setAppliedVoucher(null);
        toast((t) => (
          <div className="flex flex-col gap-1 p-1">
            <p className="font-extrabold text-sm text-red-605 text-red-600">Voucher Dilepas</p>
            <p className="text-xs text-text-light dark:text-text-dark">
              Voucher makanan gratis dilepas karena jumlah item di keranjang melebihi batas maksimal 5 item.
            </p>
          </div>
        ), { duration: 6000, position: "top-center" });
      }
    }
  }, [items, appliedVoucher]);

  // Realtime Operational Hours & Shipping Settings Sync
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
        if (data.resto_latitude !== undefined && data.resto_latitude !== null) setRestoLat(Number(data.resto_latitude));
        if (data.resto_longitude !== undefined && data.resto_longitude !== null) setRestoLng(Number(data.resto_longitude));
        if (data.shipping_rate_per_km !== undefined && data.shipping_rate_per_km !== null) setShippingRate(Number(data.shipping_rate_per_km));
        if (data.min_shipping_distance !== undefined && data.min_shipping_distance !== null) setMinShippingDistance(Number(data.min_shipping_distance));
        if (data.max_shipping_distance !== undefined && data.max_shipping_distance !== null) setMaxShippingDistance(Number(data.max_shipping_distance));
        if (data.additional_zone_charge !== undefined && data.additional_zone_charge !== null) setAdditionalZoneCharge(Number(data.additional_zone_charge));
        if (data.min_order_for_free_shipping !== undefined && data.min_order_for_free_shipping !== null) setMinOrderFreeShipping(Number(data.min_order_for_free_shipping));
        if (data.is_shipping_enabled !== undefined && data.is_shipping_enabled !== null) setIsShippingEnabled(!!data.is_shipping_enabled);
        setSettingsLoaded(true);
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
          if (payload.new.resto_latitude !== undefined && payload.new.resto_latitude !== null) setRestoLat(Number(payload.new.resto_latitude));
          if (payload.new.resto_longitude !== undefined && payload.new.resto_longitude !== null) setRestoLng(Number(payload.new.resto_longitude));
          if (payload.new.shipping_rate_per_km !== undefined && payload.new.shipping_rate_per_km !== null) setShippingRate(Number(payload.new.shipping_rate_per_km));
          if (payload.new.min_shipping_distance !== undefined && payload.new.min_shipping_distance !== null) setMinShippingDistance(Number(payload.new.min_shipping_distance));
          if (payload.new.max_shipping_distance !== undefined && payload.new.max_shipping_distance !== null) setMaxShippingDistance(Number(payload.new.max_shipping_distance));
          if (payload.new.additional_zone_charge !== undefined && payload.new.additional_zone_charge !== null) setAdditionalZoneCharge(Number(payload.new.additional_zone_charge));
          if (payload.new.min_order_for_free_shipping !== undefined && payload.new.min_order_for_free_shipping !== null) setMinOrderFreeShipping(Number(payload.new.min_order_for_free_shipping));
          if (payload.new.is_shipping_enabled !== undefined && payload.new.is_shipping_enabled !== null) setIsShippingEnabled(!!payload.new.is_shipping_enabled);
          setSettingsLoaded(true);
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
        await supabase.from("tables").update({ status: "available", occupied_at: null }).eq("id", prevTableId);
      }
      if (newTableId) {
        await supabase.from("tables").update({ status: "occupied", occupied_at: new Date().toISOString() }).eq("id", newTableId);
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

  const handleCheckoutClick = async (enteredPin?: string) => {
    if (items.length === 0) return toast.error("Keranjang kosong");
    const storeStatus = getStoreStatus(openingTime, closingTime, isTemporaryClosed, isHoliday, holidayReopenDate, temporaryClosedReopenTime, is24Hours);
    if (!storeStatus.isOpen) {
      toast.error(`Gagal Checkout! Mohon maaf, ${storeStatus.message}`, { duration: 6000 });
      return;
    }
    if (orderType === "dine_in" && !selectedTable) return toast.error("Silakan pilih meja");
    if (orderType === "delivery") {
      if (!isShippingEnabled) {
        return toast.error("Layanan pengantaran saat ini sedang dinonaktifkan");
      }
      if (!deliveryName || !deliveryPhone || !deliveryAddress || !deliveryProvince || !deliveryRegency || !deliveryDistrict || !deliveryVillage || !deliveryPostalCode) {
        return toast.error("Silakan lengkapi informasi pengiriman");
      }
      if (distanceKm === null) {
        return toast.error("Gagal mendeteksi lokasi dari alamat Anda. Pastikan alamat yang diisi benar.");
      }
      if (distanceKm > maxShippingDistance) {
        return toast.error(`Alamat pengantaran berada di luar batas jarak maksimal ${maxShippingDistance} km`);
      }
    }

    if (paymentMethod === "wallet" && !enteredPin) {
      setPinRemainingAttempts(null);
      setPaymentPin("");
      setShowPinPaymentModal(true);
      return;
    }
    
    setLoading(true);
    const loadingToast = toast.loading("Memproses pesanan...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Silakan login kembali");
      const { data: profile } = await supabase.from("profiles").select("id, full_name, email").eq("user_id", session.user.id).single();
      if (!profile) throw new Error("Profil tidak ditemukan");

      const detailedPaymentNotes = paymentMethod === "wallet" ? "[Pembayaran Saldo Dompet]" : paymentMethod === "non_cash" ? "[Pembayaran Online]" : paymentMethod === "cash" ? "[Tunai di Kasir]" : "[Voucher Reward]";
      const finalNotes = `${detailedPaymentNotes} ${orderNotes}`.trim();

      const orderDataPayload = {
        customer_id: profile.id,
        table_id: orderType === "dine_in" ? selectedTable : null,
        order_type: orderType,
        total_amount: totalAmount,
        notes: finalNotes,
        voucher_id: appliedVoucher ? appliedVoucher.id : null,
        discount: discountAmount,
        distance_km: orderType === "delivery" ? distanceKm : null,
        shipping_fee: orderType === "delivery" ? shippingFee : 0,
        shipping_discount: orderType === "delivery" ? shippingDiscount : 0,
        delivery_recipient_name: orderType === "delivery" ? deliveryName : null,
        delivery_phone: orderType === "delivery" ? deliveryPhone : null,
        delivery_address: orderType === "delivery" ? deliveryAddress : null,
        delivery_province: orderType === "delivery" ? deliveryProvince : null,
        delivery_regency: orderType === "delivery" ? deliveryRegency : null,
        delivery_district: orderType === "delivery" ? deliveryDistrict : null,
        delivery_village: orderType === "delivery" ? deliveryVillage : null,
        delivery_postal_code: orderType === "delivery" ? deliveryPostalCode : null,
      };

      const itemsDataPayload = items.map(item => ({
        menu_item_id: item.id,
        quantity: item.quantity,
        notes: item.notes || null,
      }));

      const paymentMethodParam = totalAmount === 0 ? "free" : paymentMethod;
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_customer_order',
          orderData: orderDataPayload,
          itemsData: itemsDataPayload,
          paymentMethod: paymentMethodParam,
          pin: enteredPin,
          customerLat: orderType === "delivery" && customerCoords ? customerCoords.lat : null,
          customerLng: orderType === "delivery" && customerCoords ? customerCoords.lng : null
        })
      });

      const result = await res.json();
      if (!res.ok) {
        if (result.code === 'WALLET_BLOCKED' || result.code === 'WALLET_BLOCKED_NOW') {
          setShowPinPaymentModal(false);
          toast.error(result.error || 'Akses Dompetku diblokir.', { id: loadingToast });
          router.push('/customer/wallet');
          return;
        }
        if (result.code === 'NO_PIN') {
          setShowPinPaymentModal(false);
          toast.error(result.error || 'Anda belum memiliki PIN.', { id: loadingToast });
          router.push('/customer/wallet');
          return;
        }
        if (result.code === 'WRONG_PIN') {
          toast.error(result.error || 'PIN salah.', { id: loadingToast });
          setPinRemainingAttempts(result.remaining);
          setPaymentPin("");
          return;
        }
        throw new Error(result.error || 'Gagal memproses pembuatan pesanan');
      }

      const createdOrder = result.order;

      isOrderCompleted.current = true;
      if (typeof window !== "undefined") localStorage.removeItem("selected_table");
      clearCart();
      setShowPinPaymentModal(false);

      if (paymentMethodParam === "free") {
        toast.success("Pesanan berhasil dibuat secara gratis!", { id: loadingToast });
        router.push(`/customer/orders/${createdOrder.id}`);
        return;
      }

      if (paymentMethodParam === "wallet") {
        toast.success("Pembayaran Berhasil via Saldo Dompet!", { id: loadingToast });
        router.push(`/customer/orders/${createdOrder.id}`);
        return;
      }

      if (paymentMethodParam === "cash") {
        try {
          await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: createdOrder.id, action: 'notify_created' }),
          });
        } catch (err) {
          console.error("Notification error:", err);
        }
        toast.success("Pesanan berhasil dibuat! Silakan bayar tunai.", { id: loadingToast });
        router.push(`/customer/orders/${createdOrder.id}`);
        return;
      }

      if (paymentMethodParam === "non_cash") {
        toast.loading("Membangun portal pembayaran aman...", { id: loadingToast });
        const invoiceRes = await fetch('/api/payment/create-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            orderId: createdOrder.id,
            paymentMethod: "", 
            returnUrl: `${window.location.origin}/customer/orders/${createdOrder.id}`,
            customer_name: profile.full_name,
            customer_email: profile.email
          })
        });
        const duitkuData = await invoiceRes.json();
        
        if (!invoiceRes.ok) throw new Error(duitkuData.error || 'Gagal memicu gateway pembayaran');
        
        if (duitkuData.reference && typeof (window as any).checkout !== 'undefined') {
          toast.dismiss(loadingToast);
          setLoading(false);
          
          (window as any).checkout.process(duitkuData.reference, {
             successEvent: async function() {
                try {
                  await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: createdOrder.id, action: 'notify_created' }),
                  });
                } catch (err) {
                  console.error(err);
                }
                toast.success("Pembayaran Berhasil!");
                router.push(`/customer/orders/${createdOrder.id}`);
             },
             pendingEvent: async function() {
                try {
                  await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: createdOrder.id, action: 'notify_created' }),
                  });
                } catch (err) {
                  console.error(err);
                }
                router.push(`/customer/orders/${createdOrder.id}?status=pending`);
             },
             errorEvent: async function() {
                toast.error("Pembayaran gagal. Pesanan disimpan sebagai Belum Bayar.");
                await fetch('/api/orders', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ orderId: createdOrder.id, action: 'notify_duitku_closed' })
                });
                router.push(`/customer/orders/${createdOrder.id}`);
             },
             closeEvent: async function() {
                toast.success("Pesanan disimpan. Silakan selesaikan pembayaran Anda.");
                const checkRes = await fetch('/api/payment/check-status', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ orderId: createdOrder.id })
                });
                const checkStatus = await checkRes.json();
                if (checkStatus.status !== 'paid') {
                   await fetch('/api/orders', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ orderId: createdOrder.id, action: 'notify_duitku_closed' })
                   });
                }
                router.push(`/customer/orders/${createdOrder.id}`);
             }
          });
          return;
        } else if (duitkuData.paymentUrl) {
          try {
            await fetch('/api/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: createdOrder.id, action: 'notify_created' }),
            });
          } catch (err) {
            console.error(err);
          }
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
        {/* Single sticky card wrapping everything on the right to prevent layout breaking */}
        <div className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-3xl p-6 lg:p-8 shadow-sm sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark mb-6">Ringkasan</h2>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-muted text-sm"><span>Subtotal</span><span className="font-semibold text-text-light dark:text-text-dark">Rp {subtotal.toLocaleString("id-ID")}</span></div>
              {discountAmount > 0 && appliedVoucher && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 text-sm">
                  <span>Diskon Voucher ({appliedVoucher.code})</span>
                  <span className="font-bold">-Rp {discountAmount.toLocaleString("id-ID")}</span>
                </div>
              )}
              {orderType === "delivery" && (
                <div className="flex justify-between text-muted text-sm">
                  <span>Ongkos Kirim {distanceKm !== null ? `(${distanceKm.toFixed(1)} km)` : ""}</span>
                  <span className="font-semibold text-text-light dark:text-text-dark">
                    {distanceKm !== null ? (
                      `Rp ${shippingFee.toLocaleString("id-ID")}`
                    ) : loadingDistance ? (
                      <span className="flex items-center gap-1 text-xs">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary inline" /> Menghitung...
                      </span>
                    ) : (
                      "Lengkapi Alamat..."
                    )}
                  </span>
                </div>
              )}
              {orderType === "delivery" && shippingDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 text-sm">
                  <span>Potongan Ongkir {appliedVoucher ? `(Voucher ${appliedVoucher.code})` : ""}</span>
                  <span className="font-bold">-Rp {shippingDiscount.toLocaleString("id-ID")}</span>
                </div>
              )}
              <div className="flex justify-between text-muted text-sm">
                <span>Pajak ({taxPercent}%)</span>
                <span className="font-semibold text-text-light dark:text-text-dark">
                  Rp {Math.round(subtotal * taxPercent / (100 + taxPercent)).toLocaleString("id-ID")} (Termasuk)
                </span>
              </div>
              
              {/* Input Kode Voucher */}
              <div className="pt-4 border-t border-border-light dark:border-border-dark space-y-3">
                <label className="text-[10px] font-black text-muted uppercase tracking-wider block">Kupon / Voucher Promo</label>
                {!appliedVoucher ? (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Masukkan kode voucher..."
                        value={voucherCodeInput}
                        onChange={e => setVoucherCodeInput(e.target.value)}
                        className="flex-1 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-text-light dark:text-text-dark uppercase font-mono"
                      />
                      <button
                        onClick={handleApplyVoucher}
                        disabled={isApplyingVoucher}
                        className="bg-primary hover:bg-primary/95 text-white px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center transition-all disabled:opacity-50"
                      >
                        {isApplyingVoucher ? "..." : "Gunakan"}
                      </button>
                    </div>
                    {availableVouchers.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[9px] text-muted font-bold block uppercase tracking-wider">Voucher Anda (Klik untuk gunakan):</span>
                        <div className="flex flex-wrap gap-1">
                          {availableVouchers.map((v: any) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => {
                                setVoucherCodeInput(v.code);
                                toast.success(`Kode ${v.code} dipilih! Klik Gunakan.`);
                              }}
                              className="text-[9px] font-mono font-black bg-primary/10 text-primary px-2.5 py-1 rounded-lg border border-primary/20 hover:bg-primary hover:text-white transition-all uppercase"
                            >
                              {v.code} ({v.voucher_type === 'shipping' ? "Ongkir " : ""}{v.discount_type === 'percent' ? `${v.discount_percent}%` : `Rp ${Number(v.discount_value || 0).toLocaleString("id-ID")}`})
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
                        <span className="block text-[9px] text-emerald-600 dark:text-emerald-400">
                          {appliedVoucher.voucher_type === 'shipping' ? 'Potongan Ongkir ' : 'Hemat '}
                          {appliedVoucher.discount_type === 'percent'
                            ? `${appliedVoucher.discount_percent}%`
                            : `Rp ${Number(appliedVoucher.discount_value || 0).toLocaleString("id-ID")}`}
                        </span>
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
                  <span>Rp {(discountAmount + shippingDiscount).toLocaleString("id-ID")}</span>
                </div>
              )}

              <div className="pt-4 border-t border-border-light dark:border-border-dark flex justify-between items-center">
                <span className="font-bold text-base text-text-light dark:text-text-dark">Total Tagihan</span>
                <span className="text-xl font-black text-primary">Rp {totalAmount.toLocaleString("id-ID")}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border-light dark:border-border-dark pt-6 space-y-6">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-muted mb-3">Tipe Pesanan</h3>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setOrderType("dine_in")} className={`py-3.5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${orderType === "dine_in" ? "border-primary bg-primary/5 text-primary" : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"}`}>
                  <UtensilsCrossed className="w-5 h-5" /><span className="font-bold text-[10px] uppercase">Dine In</span>
                </button>
                <button onClick={() => setOrderType("takeaway")} className={`py-3.5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${orderType === "takeaway" ? "border-primary bg-primary/5 text-primary" : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"}`}>
                  <Store className="w-5 h-5" /><span className="font-bold text-[10px] uppercase">Takeaway</span>
                </button>
                <button onClick={() => setOrderType("delivery")} className={`py-3.5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${orderType === "delivery" ? "border-primary bg-primary/5 text-primary" : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"}`}>
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
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pt-4 space-y-3 text-left">
                    <h4 className="text-xs font-bold text-primary uppercase tracking-widest block mb-2">Informasi Pengiriman</h4>
                    
                    {loadingDistance && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/40 border border-border-light dark:border-border-dark rounded-xl flex items-center justify-center gap-2 text-xs text-muted">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span>Sedang mengalkulasi jarak pengantaran...</span>
                      </div>
                    )}

                    {distanceKm !== null && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/40 border border-border-light dark:border-border-dark rounded-xl flex items-center justify-between text-xs">
                        <span className="text-muted font-bold">Jarak Pengantaran:</span>
                        <span className="font-extrabold text-primary">{distanceKm.toFixed(2)} km</span>
                      </div>
                    )}

                    {distanceKm !== null && distanceKm > maxShippingDistance && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-550 rounded-2xl flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                        <div>
                          <p className="text-xs font-bold text-red-600 dark:text-red-400">Jarak Pengiriman Terlalu Jauh</p>
                          <p className="text-[10px] text-muted leading-relaxed mt-0.5">
                            Jarak pengiriman ({distanceKm.toFixed(2)} km) melebihi batas layanan maksimal kami yaitu {maxShippingDistance} km. Silakan ganti alamat atau pilih opsi penjemputan lainnya.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-muted/80 uppercase block mb-1">Nama Penerima</label>
                        <input
                          type="text"
                          required
                          value={deliveryName}
                          onChange={e => setDeliveryName(e.target.value)}
                          placeholder="Nama Lengkap"
                          className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-3.5 py-2 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted/80 uppercase block mb-1">No. HP Penerima</label>
                        <input
                          type="tel"
                          required
                          value={deliveryPhone}
                          onChange={e => setDeliveryPhone(e.target.value)}
                          placeholder="Contoh: 08123456789"
                          className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-3.5 py-2 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <SearchableSelect
                        label="Provinsi"
                        placeholder="Pilih Provinsi"
                        options={provincesList.map(p => ({ id: p.id, name: p.name }))}
                        value={deliveryProvince}
                        onChange={handleProvinceChange}
                        align="left"
                      />
                      <SearchableSelect
                        label="Kabupaten / Kota"
                        placeholder="Pilih Kabupaten / Kota"
                        options={regencies.map(r => ({ id: r.id, name: r.name }))}
                        value={deliveryRegency}
                        onChange={handleRegencyChange}
                        disabled={!deliveryProvince}
                        loading={loadingRegencies}
                        align="right"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <SearchableSelect
                        label="Kecamatan"
                        placeholder="Pilih Kecamatan"
                        options={districts.map(d => ({ id: d.id, name: d.name }))}
                        value={deliveryDistrict}
                        onChange={handleDistrictChange}
                        disabled={!deliveryRegency}
                        loading={loadingDistricts}
                        align="left"
                      />
                      <SearchableSelect
                        label="Kelurahan / Desa"
                        placeholder="Pilih Kelurahan / Desa"
                        options={villages.map(v => ({ id: v.id, name: v.name }))}
                        value={deliveryVillage}
                        onChange={handleVillageChange}
                        disabled={!deliveryDistrict}
                        loading={loadingVillages}
                        align="right"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-semibold text-muted/80 uppercase block mb-1">Alamat Lengkap</label>
                        <input
                          type="text"
                          required
                          value={deliveryAddress}
                          onChange={e => setDeliveryAddress(e.target.value)}
                          placeholder="Nama Jalan, Blok, RT/RW, No. Rumah"
                          className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-3.5 py-2 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted/80 uppercase block mb-1">Kode Pos</label>
                        {loadingPostalCodes ? (
                          <div className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-muted">
                            <span>Memuat...</span>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                          </div>
                        ) : postalCodes.length > 0 ? (
                          <select
                            required
                            value={deliveryPostalCode}
                            title="Kode Pos"
                            onChange={e => setDeliveryPostalCode(e.target.value)}
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-3.5 py-2 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark"
                          >
                            <option value="">-- Pilih Kode Pos --</option>
                            {postalCodes.map(code => (
                              <option key={code} value={code}>{code}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            required
                            value={deliveryPostalCode}
                            onChange={e => setDeliveryPostalCode(e.target.value)}
                            placeholder="Kode Pos"
                            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-3.5 py-2 outline-none focus:ring-2 focus:ring-primary/20 text-xs text-text-light dark:text-text-dark"
                          />
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-muted mb-3">Metode Pembayaran</h3>
              {totalAmount === 0 ? (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 rounded-2xl text-xs text-emerald-800 dark:text-emerald-400 font-bold flex items-center gap-2.5">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Pembayaran Gratis (Diskon Voucher 100%)</span>
                </div>
              ) : orderType === "delivery" ? (
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setPaymentMethod("cash")} className={`py-3.5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${paymentMethod === "cash" ? "border-primary bg-primary/5 text-primary" : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"}`}>
                    <Banknote className="w-5 h-5" /><span className="font-bold text-[10px] uppercase">Tunai</span>
                  </button>
                  <button type="button" onClick={() => setPaymentMethod("non_cash")} className={`py-3.5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${paymentMethod === "non_cash" ? "border-primary bg-primary/5 text-primary" : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"}`}>
                    <CreditCard className="w-5 h-5" /><span className="font-bold text-[10px] uppercase">Non-Tunai</span>
                  </button>
                  <button type="button" onClick={() => setPaymentMethod("wallet")} className={`py-3.5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${paymentMethod === "wallet" ? "border-primary bg-primary/5 text-primary" : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"}`}>
                    <Wallet className="w-5 h-5" /><span className="font-bold text-[10px] uppercase">Dompet</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setPaymentMethod("non_cash")} className={`py-3.5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${paymentMethod === "non_cash" ? "border-primary bg-primary/5 text-primary" : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"}`}>
                    <CreditCard className="w-5 h-5" /><span className="font-bold text-[10px] uppercase">Non-Tunai</span>
                  </button>
                  <button type="button" onClick={() => setPaymentMethod("wallet")} className={`py-3.5 rounded-2xl flex flex-col items-center gap-2 border-2 transition-all ${paymentMethod === "wallet" ? "border-primary bg-primary/5 text-primary" : "border-border-light dark:border-border-dark text-muted hover:border-primary/50"}`}>
                    <Wallet className="w-5 h-5" /><span className="font-bold text-[10px] uppercase">Dompet</span>
                  </button>
                </div>
              )}
            </div>

            {totalAmount > 0 && paymentMethod === "wallet" && profileData && (
              <div className="space-y-3">
                {!['diterima', 'selesai', 'aktif'].includes(profileData.wallet_status) || profileData.is_wallet_blocked ? (
                  <div className="p-4 rounded-2xl border bg-red-50/60 border-red-200/60 text-red-800 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                      <div>
                        {profileData.is_wallet_blocked ? (
                          <>
                            <p className="text-xs font-bold uppercase tracking-wider">Akses Dompetku Diblokir</p>
                            <p className="text-xs mt-1 leading-relaxed text-muted font-medium">Akses transaksi Dompetku Anda telah ditangguhkan sementara oleh administrator. Alasan: {profileData.wallet_block_reason || "Kebijakan Keamanan Restoran"}. Silakan hubungi admin untuk informasi lebih lanjut.</p>
                          </>
                        ) : ['diajukan', 'diajukan_ulang', 'diproses'].includes(profileData.wallet_status) ? (
                          <>
                            <p className="text-xs font-bold uppercase tracking-wider">Aktivasi Sedang Ditinjau</p>
                            <p className="text-xs mt-1 leading-relaxed text-muted">Pengajuan aktivasi Dompetku Anda sedang diproses. Mohon tunggu hasil verifikasi dari admin.</p>
                          </>
                        ) : (
                          <>
                            <p className="text-xs font-bold uppercase tracking-wider">Dompetku Belum Aktif</p>
                            <p className="text-xs mt-1 leading-relaxed text-muted">Dompetku belum diaktifkan. Silakan lakukan aktivasi terlebih dahulu untuk menggunakan metode pembayaran ini.</p>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Tombol Aktivasi */}
                    {!profileData.is_wallet_blocked && !['diajukan', 'diajukan_ulang', 'diproses'].includes(profileData.wallet_status) && (
                      <button
                        type="button"
                        onClick={() => router.push("/customer/wallet/activation")}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all uppercase tracking-wider shadow-sm flex items-center justify-center gap-1"
                      >
                        Aktivasi Sekarang
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={`p-4 rounded-2xl border transition-all ${
                    profileData.wallet_balance >= totalAmount
                      ? "bg-green-50/60 border-green-200/60 text-green-800 dark:bg-green-950/20 dark:border-green-900/40 dark:text-green-400"
                      : "bg-red-50/60 border-red-200/60 text-red-800 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400"
                  }`}>
                    {/* Balance display and status indicator */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Wallet className="w-5 h-5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider opacity-75 leading-tight">Saldo Dompet Anda</p>
                          <p className="text-base font-black mt-0.5">Rp {Number(profileData.wallet_balance || 0).toLocaleString("id-ID")}</p>
                        </div>
                      </div>
                      {profileData.wallet_balance >= totalAmount ? (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-md shrink-0 whitespace-nowrap">Saldo Cukup</span>
                      ) : (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-md animate-pulse shrink-0 whitespace-nowrap">Saldo Kurang</span>
                      )}
                    </div>

                    {/* Insufficient balance warning and top up action button nested inside same container */}
                    {profileData.wallet_balance < totalAmount && (
                      <div className="mt-3 pt-3 border-t border-red-200/50 dark:border-red-900/30 space-y-3">
                        <p className="text-xs font-semibold leading-relaxed">
                          Saldo Anda kurang sebesar <span className="font-extrabold text-red-700 dark:text-red-300">Rp {(totalAmount - profileData.wallet_balance).toLocaleString("id-ID")}</span>. Isi saldo untuk melanjutkan pembayaran.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowTopUpModal(true)}
                          className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5"
                        >
                          Isi Saldo Sekarang
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="font-bold text-xs uppercase tracking-wider text-muted block ml-1">Catatan Pesanan</label>
              <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={2} className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 text-text-light dark:text-text-dark text-sm" placeholder="Contoh: Tanpa bawang, pedas sedang..." />
            </div>

            <motion.button 
              whileHover={isOpen && !(totalAmount > 0 && paymentMethod === "wallet" && profileData && (profileData.wallet_balance < totalAmount || !['diterima', 'selesai', 'aktif'].includes(profileData.wallet_status) || profileData.is_wallet_blocked)) && !(orderType === "delivery" && distanceKm !== null && distanceKm > maxShippingDistance) ? { scale: 1.02 } : {}} 
              whileTap={isOpen && !(totalAmount > 0 && paymentMethod === "wallet" && profileData && (profileData.wallet_balance < totalAmount || !['diterima', 'selesai', 'aktif'].includes(profileData.wallet_status) || profileData.is_wallet_blocked)) && !(orderType === "delivery" && distanceKm !== null && distanceKm > maxShippingDistance) ? { scale: 0.98 } : {}} 
              onClick={() => totalAmount > 0 && paymentMethod === "cash" ? setShowPaymentModal(true) : handleCheckoutClick()} 
              disabled={!isOpen || loading || (totalAmount > 0 && paymentMethod === "wallet" && profileData && (profileData.wallet_balance < totalAmount || !['diterima', 'selesai', 'aktif'].includes(profileData.wallet_status) || profileData.is_wallet_blocked)) || (orderType === "delivery" && distanceKm !== null && distanceKm > maxShippingDistance)}
              className={`w-full py-4 rounded-2xl font-black text-sm lg:text-xs xl:text-sm flex justify-center items-center gap-2 transition-all mt-4 uppercase tracking-wider ${
                !isOpen 
                  ? "bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed border border-gray-400/20 shadow-none"
                  : (totalAmount > 0 && paymentMethod === "wallet" && profileData && (profileData.wallet_balance < totalAmount || !['diterima', 'selesai', 'aktif'].includes(profileData.wallet_status) || profileData.is_wallet_blocked))
                  ? "bg-red-500/10 dark:bg-red-950/20 text-red-500 border border-red-200 dark:border-red-900/50 cursor-not-allowed shadow-none"
                  : (orderType === "delivery" && distanceKm !== null && distanceKm > maxShippingDistance)
                  ? "bg-red-500/10 dark:bg-red-950/20 text-red-500 border border-red-200 dark:border-red-900/50 cursor-not-allowed shadow-none"
                  : "bg-primary hover:bg-primary-hover text-white shadow-xl shadow-primary/30 cursor-pointer"
              }`}
            >
              {!isOpen && <Clock className="w-5 h-5 animate-pulse text-red-500" />}
              {totalAmount > 0 && paymentMethod === "wallet" && profileData && (!['diterima', 'selesai', 'aktif'].includes(profileData.wallet_status) || profileData.is_wallet_blocked) ? (
                profileData.is_wallet_blocked ? (
                  <><AlertTriangle className="w-4 h-4 shrink-0" /> Akses Dompet Diblokir</>
                ) : ['diajukan', 'diajukan_ulang', 'diproses'].includes(profileData.wallet_status) ? (
                  <><Clock className="w-4 h-4 shrink-0" /> Menunggu Verifikasi Admin</>
                ) : (
                  <><AlertTriangle className="w-4 h-4 shrink-0" /> Aktivasi Dompetku Diperlukan</>
                )
              ) : totalAmount > 0 && paymentMethod === "wallet" && profileData && profileData.wallet_balance < totalAmount ? (
                <><AlertTriangle className="w-4 h-4 shrink-0" /> Saldo Dompet Kurang</>
              ) : orderType === "delivery" && distanceKm !== null && distanceKm > maxShippingDistance ? (
                <><AlertTriangle className="w-4 h-4 shrink-0" /> Jarak Diluar Jangkauan</>
              ) : (
                <>{isOpen ? (totalAmount === 0 ? "Konfirmasi Pesanan Gratis" : "Lanjut ke Pembayaran") : "Restoran Tutup"} {isOpen && <ArrowRight className="w-6 h-6" />}</>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      <BaseModal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)} size="lg" noPadding={true} showCloseButton={false}>
        <div className="bg-primary p-6 md:p-7 text-white flex justify-between items-center relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="relative">
            <h2 className="text-lg md:text-xl font-bold uppercase tracking-tight text-white">Selesaikan Pembayaran</h2>
            <p className="text-white/90 text-xs md:text-sm mt-1 font-medium">
              Total Tagihan: <span className="font-extrabold text-white text-sm md:text-base">Rp {totalAmount.toLocaleString("id-ID")}</span>
            </p>
          </div>
          <button onClick={() => setShowPaymentModal(false)} title="Tutup" aria-label="Tutup" className="p-2 hover:bg-white/10 rounded-full text-white relative z-10"><X className="w-5 h-5 md:w-6 h-6" /></button>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          {paymentMethod === "cash" && (
            <div className="space-y-6 text-center py-4 md:py-6">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-md">
                <Banknote className="w-8 h-8 md:w-10 md:h-10" />
              </div>
              <div className="space-y-2 max-w-md mx-auto">
                <h3 className="font-bold text-lg md:text-xl text-text-light dark:text-text-dark">Pembayaran Tunai</h3>
                <p className="text-muted text-xs md:text-sm leading-relaxed px-2">
                  {orderType === "delivery" ? (
                    <>Pesanan Anda akan segera kami proses. Silakan siapkan pembayaran tunai untuk diberikan kepada kurir saat pesanan tiba di alamat Anda.</>
                  ) : orderType === "takeaway" ? (
                    <>Pesanan Anda akan segera kami teruskan ke dapur. Pembayaran dapat Anda lakukan secara tunai di kasir saat mengambil pesanan.</>
                  ) : (
                    <>Pesanan Anda akan segera kami teruskan ke dapur. Pembayaran dapat Anda lakukan secara tunai di kasir setelah selesai makan.</>
                  )}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 pt-4 border-t border-border-light/60 dark:border-border-dark/60">
                <button 
                  onClick={() => setShowPaymentModal(false)} 
                  className="w-full sm:flex-1 order-2 sm:order-1 py-2.5 sm:py-3 px-4 border border-border-light dark:border-border-dark rounded-xl font-bold text-muted hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-xs sm:text-sm md:text-base"
                >
                  Batal
                </button>
                <button 
                  onClick={() => handleCheckoutClick()} 
                  disabled={loading} 
                  className="w-full sm:flex-1 order-1 sm:order-2 py-2.5 sm:py-3 px-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all text-xs sm:text-sm md:text-base disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <><CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> Konfirmasi Pesanan</>}
                </button>
              </div>
            </div>
          )}
        </div>
      </BaseModal>

      <BaseModal isOpen={showTopUpModal} onClose={() => setShowTopUpModal(false)} size="md" noPadding={true} showCloseButton={false}>
        <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
          <h3 className="font-black text-lg text-text-light dark:text-text-dark flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Isi Saldo Dompetku
          </h3>
          <button type="button" onClick={() => setShowTopUpModal(false)} title="Tutup" className="p-2 hover:bg-gray-100 rounded-xl transition-all"><X className="w-5 h-5 text-muted" /></button>
        </div>

        <form onSubmit={handleTopUpSubmit} className="p-6 space-y-5">
          <div>
            <label htmlFor="checkoutTopUpAmountInput" className="text-[10px] font-black uppercase text-muted tracking-widest mb-1.5 block">Nominal Isi Saldo (Rp)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted text-sm">Rp</span>
              <input 
                id="checkoutTopUpAmountInput"
                type="number" 
                required 
                min={10000}
                value={topUpAmount} 
                onChange={e => setTopUpAmount(e.target.value)} 
                placeholder="Contoh: 50000" 
                title="Nominal Isi Saldo (Rp)"
                className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3.5 text-sm outline-none focus:ring-2 focus:ring-primary font-semibold text-text-light dark:text-text-dark" 
              />
            </div>
            <span className="text-[9px] text-muted font-medium mt-1 block">Minimal Rp 10.000</span>
          </div>

          {/* Quick Nominal Selectors */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase text-muted tracking-widest block">Pilih Cepat</span>
            <div className="grid grid-cols-3 gap-2">
              {[10000, 20000, 50000, 100000, 200000, 500000].map(nom => (
                <button
                  key={nom}
                  type="button"
                  onClick={() => setTopUpAmount(String(nom))}
                  className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all ${
                    topUpAmount === String(nom)
                      ? "bg-primary border-primary text-white shadow-md shadow-primary/10"
                      : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-muted hover:border-primary/50"
                  }`}
                >
                  Rp {nom.toLocaleString('id-ID').replace(',00', '')}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submittingTopUp}
            className="w-full py-4 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 hover:bg-primary-hover disabled:opacity-50 mt-4 uppercase tracking-wider text-xs"
          >
            {submittingTopUp ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Lanjut Pembayaran"}
          </button>
        </form>
      </BaseModal>

      {/* 4. PIN Payment Modal */}
      <BaseModal isOpen={showPinPaymentModal} onClose={() => setShowPinPaymentModal(false)} size="sm" noPadding={true} showCloseButton={false}>
        <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
          <h3 className="font-black text-lg text-text-light dark:text-text-dark flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" /> PIN Transaksi
          </h3>
          <button type="button" onClick={() => setShowPinPaymentModal(false)} title="Tutup" className="p-2 hover:bg-gray-100 rounded-xl transition-all"><X className="w-5 h-5 text-muted" /></button>
        </div>

        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleCheckoutClick(paymentPin);
          }} 
          className="p-6 space-y-4"
        >
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary">
              <Wallet className="w-6 h-6" />
            </div>
            <h4 className="font-extrabold text-sm text-text-light dark:text-text-dark">Masukkan PIN Dompetku</h4>
            <p className="text-xs text-muted max-w-xs mx-auto leading-relaxed">
              Demi keamanan, silakan masukkan 6 digit PIN transaksi Dompetku Anda untuk menyelesaikan pembayaran sebesar <strong>Rp {totalAmount.toLocaleString("id-ID")}</strong>.
            </p>
          </div>

          <div className="space-y-1.5">
            <input
              id="paymentPinInput"
              type="password"
              maxLength={6}
              required
              autoFocus
              value={paymentPin}
              onChange={e => setPaymentPin(e.target.value.replace(/\D/g, ""))}
              placeholder="Masukkan 6 Digit PIN"
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-250 dark:border-gray-700 rounded-xl px-4 py-3.5 text-lg outline-none focus:ring-2 focus:ring-primary font-mono tracking-widest text-center font-bold text-text-light dark:text-text-dark"
            />
            {pinRemainingAttempts !== null && (
              <span className="text-[10px] text-rose-500 font-extrabold text-center block mt-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 inline-block mr-1.5 shrink-0 align-text-bottom" /> Sisa percobaan PIN: {pinRemainingAttempts} kali lagi.
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || paymentPin.length !== 6}
            className="w-full py-4 bg-primary hover:bg-primary-hover text-white font-black rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 disabled:opacity-50 mt-4 uppercase tracking-wider text-xs"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verifikasi & Bayar Sekarang"}
          </button>
        </form>
      </BaseModal>
    </div>
  );
}
