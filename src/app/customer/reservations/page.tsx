"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Clock, Users, Plus, Loader2, X, MapPin, CheckCircle, Phone, User, History, Sparkles, AlertCircle, Ban, Trash2, QrCode, Search, ShoppingBag, CreditCard, ChevronRight, FileText, Check, DollarSign, Wallet, FileSpreadsheet, Eye, RotateCcw, Info, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { SkeletonOrderItem } from "@/components/Skeleton";
import BaseModal from "@/components/BaseModal";

interface Reservation {
  id: string;
  table_id: string;
  reservation_date: string;
  reservation_time: string;
  guest_count: number;
  status: string;
  notes: string;
  tables: { table_number: number; capacity: number } | null;
  created_at: string;
  updated_at?: string;
  qr_token?: string;
  menu_items?: any;
  menu_total?: number;
  payment_method?: string;
  payment_status?: string;
  dp_percent?: number;
  dp_amount?: number;
  remaining_amount?: number;
  refund_status?: string;
  refund_method?: string;
  refund_amount?: number;
  refund_proof?: string;
  refund_bank_account?: string;
  refund_reason?: string;
  cancellation_charge_percent?: number;
}

interface Table {
  id: string;
  table_number: number;
  capacity: number;
  status: string;
}

const ACTIVE_STATUSES = ["pending", "confirmed", "arrived", "seated"];
const HISTORY_STATUSES = ["cancelled", "completed", "rejected"];

export default function CustomerReservationsPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [profileId, setProfileId] = useState<string>("");
  const [form, setForm] = useState({
    date: "",
    time: "12:00",
    guests: 2,
    notes: "",
    atasNama: "",
    telepon: ""
  });
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  // New States for Pre-order & Payment settings
  const [categories, setCategories] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [menuSearch, setMenuSearch] = useState<string>("");
  const [selectedMenu, setSelectedMenu] = useState<Record<string, { quantity: number; notes: string; name: string; price: number; image_url: string; stock: number }>>({});
  const [paymentMethod, setPaymentMethod] = useState<"tunai" | "dompetku" | "non_cash" | "dp">("tunai");
  const [dpPercent, setDpPercent] = useState<number>(30);
  const [dpSource, setDpSource] = useState<"dompetku" | "non_cash">("non_cash");
  const [pin, setPin] = useState<string>("");
  const [walletInfo, setWalletInfo] = useState<any>(null);
  const [isDuitkuOpen, setIsDuitkuOpen] = useState(false);
  const [duitkuUrl, setDuitkuUrl] = useState<string>("");

  // Restaurant Settings
  const [minimalDp, setMinimalDp] = useState<number>(30);
  const [chargeCancel, setChargeCancel] = useState<number>(20);
  const [refundPolicy, setRefundPolicy] = useState<string>("manual");
  const [toleranceMinutes, setToleranceMinutes] = useState<number>(15);

  // Rules Modal & Cancellation Form
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [pendingReservation, setPendingReservation] = useState<any>(null);

  // Cancellation details
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelRefundMethod, setCancelRefundMethod] = useState<"transfer" | "dompetku">("transfer");
  const [cancelRefundBankAccount, setCancelRefundBankAccount] = useState<string>("");
  const [cancelRefundProof, setCancelRefundProof] = useState<string>("");
  const [cancelRefundNotes, setCancelRefundNotes] = useState<string>("");

  // Refund Request States
  const [showRefundWarning, setShowRefundWarning] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundReservation, setRefundReservation] = useState<Reservation | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"dompetku" | "transfer">("transfer");
  const [refundBankName, setRefundBankName] = useState("");
  const [refundAccountName, setRefundAccountName] = useState("");
  const [refundAccountNumber, setRefundAccountNumber] = useState("");
  const [refundBranch, setRefundBranch] = useState("");
  const [refundNotes, setRefundNotes] = useState("");
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  const [rulesChecked, setRulesChecked] = useState(false);
  const [dataChecked, setDataChecked] = useState(false);

  const [selectedQrRes, setSelectedQrRes] = useState<Reservation | null>(null);

  // States for advanced history filtering
  const [historyTab, setHistoryTab] = useState<string>("all");
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [historyRefundMethodFilter, setHistoryRefundMethodFilter] = useState<string>("all");
  const [historyRefundTypeFilter, setHistoryRefundTypeFilter] = useState<string>("all");
  const [historySearchResNo, setHistorySearchResNo] = useState("");
  const [selectedDetailRes, setSelectedDetailRes] = useState<Reservation | null>(null);

  const supabase = createClient();

  const getTodayStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [durationMinutes, setDurationMinutes] = useState<number>(120);
  const [bookedTablesInfo, setBookedTablesInfo] = useState<Record<string, "pending" | "confirmed">>({});

  useEffect(() => { 
    fetchData(); 

    const channel = supabase.channel("customer-reservations-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const isTimeOverlapping = (t1: string, t2: string, duration: number) => {
    const parseToMinutes = (timeStr: string) => {
      const parts = timeStr.split(":");
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      return hours * 60 + minutes;
    };
    const m1 = parseToMinutes(t1);
    const m2 = parseToMinutes(t2);
    return m1 < m2 + duration && m2 < m1 + duration;
  };

  const fetchData = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;
      const { data: profile } = await supabase.from("profiles").select("id, full_name, phone").eq("user_id", session.session.user.id).single();
      if (!profile) return;
      setProfileId(profile.id);
      setForm(f => ({ ...f, atasNama: profile.full_name || "", telepon: profile.phone || "" }));

      const { data } = await supabase.from("reservations").select("*, tables(table_number, capacity)").eq("customer_id", profile.id).order("reservation_date", { ascending: false });
      setReservations(data || []);

      // Fetch all tables so that tables occupied right now can still be reserved for tomorrow/future dates
      const { data: tbl } = await supabase.from("tables").select("*").order("table_number");
      setTables(tbl || []);

      // Fetch categories
      const { data: catData } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setCategories(catData || []);

      // Fetch menu items
      const { data: menuData } = await supabase
        .from("menu_items")
        .select("*")
        .eq("is_deleted", false)
        .eq("is_active", true)
        .order("name");
      setMenuItems(menuData || []);

      // Fetch wallet info
      try {
        const walletRes = await fetch("/api/customer/wallet");
        if (walletRes.ok) {
          const walletData = await walletRes.json();
          if (walletData.success) {
            setWalletInfo(walletData.wallet);
          }
        }
      } catch (err) {
        console.error("Gagal memuat saldo DompetKu:", err);
      }

      // Fetch reservation settings
      const { data: settingsData } = await supabase
        .from("restaurant_settings")
        .select("reservation_settings, minimal_dp, charge_cancel, refund_policy")
        .single();
      if (settingsData) {
        if (settingsData.minimal_dp !== null && settingsData.minimal_dp !== undefined) {
          const minDp = Number(settingsData.minimal_dp);
          setMinimalDp(minDp);
          setDpPercent(minDp);
        }
        if (settingsData.charge_cancel !== null && settingsData.charge_cancel !== undefined) {
          setChargeCancel(Number(settingsData.charge_cancel));
        }
        if (settingsData.refund_policy) {
          setRefundPolicy(settingsData.refund_policy);
        }
        if (settingsData.reservation_settings) {
          const resSettings = typeof settingsData.reservation_settings === "string"
            ? JSON.parse(settingsData.reservation_settings)
            : settingsData.reservation_settings;
          if (resSettings?.duration_minutes) {
            setDurationMinutes(Number(resSettings.duration_minutes));
          }
          if (resSettings?.late_tolerance_minutes !== undefined) {
            setToleranceMinutes(Number(resSettings.late_tolerance_minutes));
          }
        }
      }
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  // Real-time table availability check based on selected date & time
  useEffect(() => {
    if (!showModal || !form.date || !form.time) return;

    const fetchBookedTables = async () => {
      try {
        const { data: resList, error } = await supabase
          .from("reservations")
          .select("id, table_id, notes, status, reservation_time")
          .eq("reservation_date", form.date)
          .in("status", ["pending", "confirmed"]);

        if (error) throw error;

        const bookedInfo: Record<string, "pending" | "confirmed"> = {};
        resList?.forEach(res => {
          if (res.reservation_time && isTimeOverlapping(res.reservation_time, form.time, durationMinutes)) {
            const status = res.status as "pending" | "confirmed";
            if (res.table_id) {
              bookedInfo[res.table_id] = status;
            }
            try {
              const parsedNotes = JSON.parse(res.notes);
              if (parsedNotes && Array.isArray(parsedNotes.meja_ids)) {
                parsedNotes.meja_ids.forEach((id: string) => {
                  bookedInfo[id] = status;
                });
              }
            } catch (e) {}
          }
        });
        setBookedTablesInfo(bookedInfo);
      } catch (err: any) {
        console.error("Gagal memeriksa ketersediaan meja:", err.message);
      }
    };

    fetchBookedTables();

    const channel = supabase.channel("modal-reservations-realtime-check")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        fetchBookedTables();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [form.date, form.time, showModal, durationMinutes]);

  // Clear selected tables if they become booked/conflicting due to date/time changes
  useEffect(() => {
    if (selectedTableIds.length > 0 && Object.keys(bookedTablesInfo).length > 0) {
      setSelectedTableIds(prev => prev.filter(id => !bookedTablesInfo[id]));
    }
  }, [bookedTablesInfo]);

  const handleTableToggle = (id: string) => {
    setSelectedTableIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const calculateMenuTotal = () => {
    return Object.values(selectedMenu).reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleAddMenuItem = (item: any) => {
    setSelectedMenu(prev => {
      const existing = prev[item.id];
      if (existing) {
        return {
          ...prev,
          [item.id]: {
            ...existing,
            quantity: Math.min(item.stock || 99, existing.quantity + 1)
          }
        };
      }
      return {
        ...prev,
        [item.id]: {
          quantity: 1,
          notes: "",
          name: item.name,
          price: item.price,
          image_url: item.image_url || "",
          stock: item.stock || 0
        }
      };
    });
  };

  const handleUpdateQuantity = (itemId: string, qty: number) => {
    setSelectedMenu(prev => {
      const existing = prev[itemId];
      if (!existing) return prev;
      if (qty <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: {
          ...existing,
          quantity: Math.min(existing.stock || 99, qty)
        }
      };
    });
  };

  const handleUpdateNotes = (itemId: string, notes: string) => {
    setSelectedMenu(prev => {
      const existing = prev[itemId];
      if (!existing) return prev;
      return {
        ...prev,
        [itemId]: {
          ...existing,
          notes
        }
      };
    });
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date) return toast.error("Pilih tanggal reservasi");
    if (selectedTableIds.length === 0) return toast.error("Pilih setidaknya satu meja");
    if (!form.atasNama) return toast.error("Masukkan nama lengkap atas nama");
    if (!form.telepon) return toast.error("Masukkan nomor telepon");

    // Validate past Date & Time (WIB)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const dateObj = new Date(form.date + "T00:00:00");
    const formattedDate = format(dateObj, "d MMMM yyyy", { locale: localeId });

    if (form.date < todayStr) {
      return toast.error(`Tanggal reservasi yang Anda pilih (${formattedDate}) sudah terlewat. Silakan pilih tanggal hari ini atau tanggal lainnya.`);
    }

    if (form.date === todayStr) {
      const currentHours = today.getHours();
      const currentMinutes = today.getMinutes();
      const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;
      if (form.time < currentTimeStr) {
        return toast.error(`Waktu reservasi yang Anda pilih (${form.time} WIB) untuk tanggal hari ini (${formattedDate}) sudah terlewat. Silakan masukkan jam yang lain atau ganti tanggal.`);
      }
    }

    const selectedTables = tables.filter(t => selectedTableIds.includes(t.id));
    const totalCapacity = selectedTables.reduce((sum, t) => sum + t.capacity, 0);
    if (totalCapacity < form.guests) {
      return toast.error(`Kapasitas meja terpilih (${totalCapacity} orang) tidak mencukupi untuk jumlah tamu (${form.guests} orang). Silakan pilih meja tambahan.`);
    }

    // Check DP percentage
    if (paymentMethod === "dp" && dpPercent < minimalDp) {
      return toast.error(`Minimal DP yang berlaku saat ini adalah ${minimalDp}% dari total harga.`);
    }

    // Check DompetKu activation & balance if selected as paymentMethod
    if (paymentMethod === "dompetku") {
      if (!walletInfo || !["diterima", "selesai", "aktif"].includes(walletInfo.walletStatus)) {
        return toast.error("DompetKu belum aktif. Silakan aktifkan terlebih dahulu atau gunakan metode pembayaran lain.");
      }
      if (walletInfo.isBlocked) {
        return toast.error(walletInfo.blockReason || "DompetKu Anda diblokir.");
      }
      const totalMenuPrice = calculateMenuTotal();
      if (walletInfo.balance < totalMenuPrice) {
        return toast.error(`Saldo DompetKu tidak mencukupi (Saldo: Rp ${walletInfo.balance.toLocaleString('id-ID')}, Tagihan: Rp ${totalMenuPrice.toLocaleString('id-ID')}). Silakan pilih metode lain.`);
      }
      if (!pin) {
        return toast.error("Masukkan PIN DompetKu Anda terlebih dahulu.");
      }
    }

    // Check DompetKu activation & balance if selected as DP source
    if (paymentMethod === "dp" && dpSource === "dompetku") {
      if (!walletInfo || !["diterima", "selesai", "aktif"].includes(walletInfo.walletStatus)) {
        return toast.error("DompetKu belum aktif. Silakan aktifkan terlebih dahulu atau gunakan metode pembayaran lain.");
      }
      if (walletInfo.isBlocked) {
        return toast.error(walletInfo.blockReason || "DompetKu Anda diblokir.");
      }
      const totalMenuPrice = calculateMenuTotal();
      const dpAmt = (totalMenuPrice * dpPercent) / 100;
      if (walletInfo.balance < dpAmt) {
        return toast.error(`Saldo DompetKu tidak mencukupi untuk membayar DP (Saldo: Rp ${walletInfo.balance.toLocaleString('id-ID')}, DP: Rp ${dpAmt.toLocaleString('id-ID')}). Silakan pilih metode lain.`);
      }
      if (!pin) {
        return toast.error("Masukkan PIN DompetKu Anda terlebih dahulu.");
      }
    }

    // Show rules modal
    setRulesChecked(false);
    setDataChecked(false);
    setShowRulesModal(true);
  };

  const handleSubmit = async () => {
    setShowRulesModal(false);
    setSubmitting(true);
    try {
      // Atomic double-check to avoid race condition/double-booking
      const { data: resList, error: checkError } = await supabase
        .from("reservations")
        .select("id, table_id, notes, status, reservation_time")
        .eq("reservation_date", form.date)
        .in("status", ["pending", "confirmed"]);

      if (checkError) throw checkError;

      const currentlyBookedIds: string[] = [];
      resList?.forEach(res => {
        if (res.reservation_time && isTimeOverlapping(res.reservation_time, form.time, durationMinutes)) {
          if (res.table_id) currentlyBookedIds.push(res.table_id);
          try {
            const parsedNotes = JSON.parse(res.notes);
            if (parsedNotes && Array.isArray(parsedNotes.meja_ids)) {
              parsedNotes.meja_ids.forEach((id: string) => {
                if (!currentlyBookedIds.includes(id)) {
                  currentlyBookedIds.push(id);
                }
              });
            }
          } catch (err) {}
        }
      });

      const hasConflict = selectedTableIds.some(id => currentlyBookedIds.includes(id));
      if (hasConflict) {
        const conflictTables = tables.filter(t => selectedTableIds.includes(t.id) && currentlyBookedIds.includes(t.id));
        const conflictNumbers = conflictTables.map(t => `Meja ${t.table_number}`).join(", ");
        throw new Error(`Maaf, ${conflictNumbers} sudah dibooking pada tanggal dan jam tersebut. Silakan pilih meja lain yang masih tersedia.`);
      }

      const selectedTables = tables.filter(t => selectedTableIds.includes(t.id));
      const totalMenuPrice = calculateMenuTotal();
      const dpAmt = paymentMethod === "dp" ? (totalMenuPrice * dpPercent) / 100 : 0;
      const remainingAmt = paymentMethod === "dp" ? totalMenuPrice - dpAmt : (paymentMethod === "dompetku" ? 0 : totalMenuPrice);

      const structuredNotes = JSON.stringify({
        atas_nama: form.atasNama,
        telepon: form.telepon,
        meja_tambahan: selectedTables.map(t => t.table_number),
        meja_ids: selectedTableIds,
        catatan: form.notes,
        rules_approved: true,
        rules_approved_at: new Date().toISOString()
      });

      // Prepare menu items list for API
      const menuItemsList = Object.entries(selectedMenu).map(([id, item]) => ({
        id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes,
        image_url: item.image_url
      }));

      // Call reservations API
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          customerId: profileId,
          tableIds: selectedTableIds,
          reservationDate: form.date,
          reservationTime: form.time,
          guestCount: form.guests,
          notes: structuredNotes,
          paymentMethod,
          dpPercent: paymentMethod === "dp" ? dpPercent : 0,
          dpAmount: dpAmt,
          remainingAmount: remainingAmt,
          menuItems: menuItemsList,
          menuTotal: totalMenuPrice,
          pin: (paymentMethod === "dompetku" || (paymentMethod === "dp" && dpSource === "dompetku")) ? pin : undefined,
          dpSource: paymentMethod === "dp" ? dpSource : undefined,
          rules_approved_at: new Date().toISOString(),
          data_checked_at: new Date().toISOString(),
          data_checked: true
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Gagal membuat reservasi");
      }

      toast.success("Reservasi berhasil diajukan!");

      setShowModal(false);
      const isNonCash = paymentMethod === "non_cash";
      const isDpNonCash = paymentMethod === "dp" && dpSource === "non_cash";

      if ((isNonCash || isDpNonCash) && totalMenuPrice > 0) {
        const pToast = toast.loading("Menyiapkan portal pembayaran aman...");
        try {
          const invRes = await fetch('/api/payment/create-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              orderId: resData.reservation.id,
              type: 'reservation',
              paymentMethod: "",
              returnUrl: window.location.href
            })
          });
          const invData = await invRes.json();
          toast.dismiss(pToast);
          
          if (!invRes.ok) throw new Error(invData.error || 'Gagal menyiapkan tagihan');
          
          if (invData.reference && typeof (window as any).checkout !== 'undefined') {
            (window as any).checkout.process(invData.reference, {
              successEvent: async function(result: any) {
                toast.success("Pembayaran Reservasi Berhasil!");
                await fetch('/api/payment/check-status', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    orderId: resData.reservation.id,
                    type: 'reservation',
                    duitkuOrderId: result?.merchantOrderId || resData.reservation.id 
                  })
                });
                fetchData();
              },
              pendingEvent: function(result: any) {
                toast("Menunggu konfirmasi pembayaran...", { icon: <Loader2 className="w-4 h-4 animate-spin text-primary" /> });
                fetchData();
              },
              errorEvent: function(result: any) {
                toast.error("Pembayaran dibatalkan.");
                fetchData();
              },
              closeEvent: function() {
                fetchData();
              }
            });
          } else if (invData.paymentUrl) {
            window.location.href = invData.paymentUrl;
          } else {
            throw new Error("Gagal memuat portal pembayaran.");
          }
        } catch (payErr: any) {
          toast.error("Gagal membuka gerbang pembayaran: " + payErr.message);
        }
      }

      setForm({ date: "", time: "12:00", guests: 2, notes: "", atasNama: form.atasNama, telepon: form.telepon });
      setSelectedTableIds([]);
      setSelectedMenu({});
      setPaymentMethod("tunai");
      setPin("");
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundReservation) return;
    if (!refundReason.trim()) return toast.error("Masukkan alasan refund");

    if (refundMethod === "transfer") {
      if (!refundBankName.trim() || !refundAccountName.trim() || !refundAccountNumber.trim()) {
        return toast.error("Lengkapi seluruh data rekening bank");
      }
      const isNumeric = /^[0-9]+$/.test(refundAccountNumber);
      if (!isNumeric) {
        return toast.error("Nomor rekening bank harus berupa angka saja");
      }
      if (refundAccountNumber.length < 5) {
        return toast.error("Panjang nomor rekening bank tidak valid");
      }
    } else {
      if (!walletInfo || !["diterima", "selesai", "aktif"].includes(walletInfo.walletStatus)) {
        return toast.error("DompetKu Anda belum aktif. Silakan gunakan Transfer Bank.");
      }
    }

    setRefundSubmitting(true);
    try {
      const bankAccountDetail = refundMethod === "transfer"
        ? `${refundBankName} - ${refundAccountNumber} - a/n ${refundAccountName}${refundBranch ? ` (Cabang: ${refundBranch})` : ""}${refundNotes ? ` (Catatan: ${refundNotes})` : ""}`
        : walletInfo.id || profileId;

      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_refund",
          reservationId: refundReservation.id,
          refundMethod: refundMethod === "dompetku" ? "dompetku" : "transfer",
          refundBankAccount: bankAccountDetail,
          refundReason: refundReason,
          refundAmount: refundReservation.payment_status === 'paid' ? refundReservation.menu_total : refundReservation.dp_amount
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Gagal mengajukan refund");
      }

      toast.success("Pengajuan refund berhasil dikirim!");
      setShowRefundForm(false);
      setRefundReservation(null);
      fetchData();
    } catch (err: any) {
      toast.error("Gagal: " + err.message);
    } finally {
      setRefundSubmitting(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingId) return;
    if (!cancelReason.trim()) return toast.error("Masukkan alasan pembatalan");

    setCancelling(true);
    try {
      const res = reservations.find(r => r.id === cancellingId);
      if (!res) throw new Error("Reservasi tidak ditemukan");

      // Call API cancel
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          reservationId: cancellingId,
          reason: cancelReason,
          refundMethod: cancelRefundMethod,
          refundBankAccount: cancelRefundMethod === "transfer" ? cancelRefundBankAccount : walletInfo?.id,
          refundReason: cancelReason,
          refundProof: cancelRefundProof || null
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Gagal membatalkan reservasi");
      }

      toast.success(resData.message || "Reservasi berhasil dibatalkan");

      // Trigger Email Notification (realtime, async)
      fetch("/api/reservations/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: cancellingId, status: "cancelled" })
      }).catch(err => console.error("Gagal mengirim email reservasi:", err));

      // Trigger Google Calendar sync (async)
      fetch("/api/reservations/sync-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationId: cancellingId, action: "delete" })
      }).catch(err => console.error("Gagal sinkronisasi pembatalan kalender:", err));

      setCancellingId(null);
      setCancelReason("");
      setCancelRefundBankAccount("");
      setCancelRefundProof("");
      fetchData();
    } catch (err: any) {
      toast.error("Gagal membatalkan: " + err.message);
    } finally {
      setCancelling(false);
    }
  };




  const getParsedNotes = (notesStr: string) => {
    if (!notesStr) return { atas_nama: "", telepon: "", catatan: "", meja_tambahan: [], meja_ids: [] };
    try {
      const parsed = JSON.parse(notesStr);
      if (parsed && typeof parsed === "object") {
        const note = parsed.catatan || parsed.catatan_batal || "";
        const cleanNote = note.trim();
        const finalNote = (cleanNote === "-" || cleanNote === "_" || cleanNote === "") ? "" : cleanNote;
        return {
          ...parsed,
          atas_nama: parsed.atas_nama || "",
          telepon: parsed.telepon || "",
          meja_tambahan: parsed.meja_tambahan || [],
          meja_ids: parsed.meja_ids || [],
          catatan: finalNote
        };
      }
    } catch (e) {}
    const cleanStr = notesStr.trim();
    const finalStr = (cleanStr === "-" || cleanStr === "_" || cleanStr === "") ? "" : cleanStr;
    return { atas_nama: "", telepon: "", catatan: finalStr, meja_tambahan: [], meja_ids: [] };
  };

  const getStatusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      arrived: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
      seated: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      rejected: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    };
    return map[s] || "bg-gray-100 text-gray-800";
  };

  const getStatusText = (s: string) => {
    const map: Record<string, string> = { 
      pending: "Menunggu", 
      confirmed: "Aktif & Belum Check-In", 
      arrived: "Sudah Check-In & Proses Sedang Berjalan",
      seated: "Sudah Check-In & Proses Sedang Berjalan",
      cancelled: "Dibatalkan", 
      completed: "Selesai",
      rejected: "Ditolak"
    };
    return map[s] || s;
  };

  const getCancelledByLabel = (parsedNotes: any) => {
    let dibatalkanOleh = parsedNotes?.dibatalkan_oleh;
    if (!dibatalkanOleh) {
      if (parsedNotes?.catatan_tolak) {
        dibatalkanOleh = "kasir";
      } else if (parsedNotes?.catatan_batal) {
        dibatalkanOleh = "pelanggan";
      } else {
        return null;
      }
    }
    const byMap: Record<string, { label: string; color: string }> = {
      pelanggan: { label: "Dibatalkan oleh Anda", color: "text-orange-600 dark:text-orange-400" },
      kasir: { label: "Dibatalkan oleh Kasir", color: "text-red-600 dark:text-red-400" },
      admin: { label: "Dibatalkan oleh Admin", color: "text-red-700 dark:text-red-500" },
    };
    return byMap[dibatalkanOleh] || { label: `Dibatalkan oleh ${dibatalkanOleh}`, color: "text-red-600 dark:text-red-400" };
  };

  const activeReservations = reservations.filter(r => ACTIVE_STATUSES.includes(r.status));
  
  const getRefundStatusText = (status: string | null | undefined) => {
    switch (status) {
      case "pengajuan_refund":
      case "waiting_review":
      case "menunggu_peninjauan":
        return "Pengajuan Refund";
      case "menunggu_verifikasi":
        return "Menunggu Verifikasi";
      case "disetujui":
        return "Disetujui";
      case "ditolak":
      case "rejected":
        return "Ditolak";
      case "dana_dikirim":
        return "Dana Dikirim";
      case "refund_selesai":
      case "completed":
        return "Refund Selesai";
      default:
        return status || "Tidak Ada Refund";
    }
  };

  const filteredHistory = reservations.filter(res => {
    // 1. Tab Filter
    if (historyTab === "active" && !ACTIVE_STATUSES.includes(res.status)) return false;
    if (historyTab === "completed" && res.status !== "completed") return false;
    if (historyTab === "cancelled" && res.status !== "cancelled") return false;
    
    if (historyTab === "refund_pending" && !["pengajuan_refund", "waiting_review", "menunggu_peninjauan", "menunggu_verifikasi"].includes(res.refund_status || "")) return false;
    if (historyTab === "refund_approved" && res.refund_status !== "disetujui") return false;
    if (historyTab === "refund_rejected" && !["ditolak", "rejected"].includes(res.refund_status || "")) return false;
    if (historyTab === "refund_completed" && !["refund_selesai", "completed", "dana_dikirim"].includes(res.refund_status || "")) return false;

    // 2. Search Query (Nomor Reservasi / Catatan / Status)
    const notesParsed = getParsedNotes(res.notes);
    const searchLower = historySearchQuery.toLowerCase();
    const matchesSearch = 
      res.id.toLowerCase().includes(searchLower) ||
      notesParsed.catatan.toLowerCase().includes(searchLower) ||
      notesParsed.atas_nama.toLowerCase().includes(searchLower) ||
      getStatusText(res.status).toLowerCase().includes(searchLower) ||
      (res.refund_status && getRefundStatusText(res.refund_status).toLowerCase().includes(searchLower));
    
    if (!matchesSearch) return false;

    // 3. Date Range Filter
    if (historyStartDate && res.reservation_date < historyStartDate) return false;
    if (historyEndDate && res.reservation_date > historyEndDate) return false;

    // 4. Refund Method Filter
    if (historyRefundMethodFilter !== "all") {
      if (historyRefundMethodFilter === "dompetku" && res.refund_method !== "dompetku") return false;
      if (historyRefundMethodFilter === "bank" && res.refund_method !== "transfer") return false;
    }

    // 5. Jenis Refund Filter (Reservasi vs Pesanan vs Gabungan)
    if (historyRefundTypeFilter !== "all") {
      const hasMenu = Number(res.menu_total || 0) > 0;
      if (historyRefundTypeFilter === "reservation" && hasMenu) return false;
      if (historyRefundTypeFilter === "order" && !hasMenu) return false;
      if (historyRefundTypeFilter === "combined" && !hasMenu) return false;
    }

    // 6. Reservation Number Specific Filter
    if (historySearchResNo && !res.id.toLowerCase().includes(historySearchResNo.toLowerCase())) return false;

    return true;
  });

  const displayedReservations = filteredHistory;

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-center mb-8 animate-pulse">
          <div className="space-y-2.5 w-64">
            <div className="h-8 bg-gray-250 dark:bg-gray-750 rounded-xl w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded-xl w-1/2" />
          </div>
          <div className="h-11 bg-gray-250 dark:bg-gray-750 rounded-xl w-32" />
        </div>
        <div className="space-y-4">
          <SkeletonOrderItem />
          <SkeletonOrderItem />
          <SkeletonOrderItem />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-text-light dark:text-text-dark leading-tight">Reservasi Meja</h1>
          <p className="text-muted mt-1 text-sm sm:text-base">Ajukan dan pantau reservasi meja Anda</p>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-xl font-medium shadow-lg shadow-primary/20 shrink-0 self-start sm:self-auto">
          <Plus className="w-5 h-5" /> Ajukan Reservasi
        </motion.button>
      </div>

      <div className="space-y-6">
        {/* Sub-Tabs */}
        <div className="flex overflow-x-auto scrollbar-hide border-b border-border-light dark:border-border-dark pb-1 gap-2">
          {[
            { key: "all", label: "Semua" },
            { key: "active", label: "Reservasi Aktif" },
            { key: "completed", label: "Reservasi Selesai" },
            { key: "cancelled", label: "Reservasi Dibatalkan" },
            { key: "refund_pending", label: "Pengajuan Refund" },
            { key: "refund_approved", label: "Refund Disetujui" },
            { key: "refund_rejected", label: "Refund Ditolak" },
            { key: "refund_completed", label: "Refund Selesai" }
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setHistoryTab(tab.key)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border-none outline-none ${
                historyTab === tab.key 
                  ? "bg-primary text-white shadow-md shadow-primary/15" 
                  : "bg-gray-50 dark:bg-gray-800/50 text-muted hover:bg-gray-100 dark:hover:bg-gray-850"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters Box */}
        <div className="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search Input */}
          <div className="relative col-span-1 sm:col-span-2">
            <label htmlFor="historyQuickSearch" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1.5 ml-1">Pencarian Cepat</label>
            <div className="relative">
              <Search className="w-4 h-4 text-muted absolute left-3 top-3.5" />
              <input
                id="historyQuickSearch"
                type="text"
                value={historySearchQuery}
                onChange={e => setHistorySearchQuery(e.target.value)}
                placeholder="Cari kata kunci status, nama, atau catatan..."
                className="w-full pl-9 pr-4 py-2.5 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-1 focus:ring-primary text-text-light dark:text-text-dark"
              />
            </div>
          </div>

          {/* Date Filter */}
          <div>
            <label htmlFor="historyStartDateInput" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1.5 ml-1">Mulai Tanggal</label>
            <input
              id="historyStartDateInput"
              type="date"
              value={historyStartDate}
              onChange={e => setHistoryStartDate(e.target.value)}
              className="w-full px-3 py-2.5 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none text-text-light dark:text-text-dark font-medium"
            />
          </div>

          <div>
            <label htmlFor="historyEndDateInput" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1.5 ml-1">Sampai Tanggal</label>
            <input
              id="historyEndDateInput"
              type="date"
              value={historyEndDate}
              onChange={e => setHistoryEndDate(e.target.value)}
              className="w-full px-3 py-2.5 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none text-text-light dark:text-text-dark font-medium"
            />
          </div>

          {/* Refund Method Filter */}
          <div>
            <label htmlFor="historyRefMethodSelect" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1.5 ml-1">Metode Refund</label>
            <select
              id="historyRefMethodSelect"
              value={historyRefundMethodFilter}
              onChange={e => setHistoryRefundMethodFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none text-text-light dark:text-text-dark font-bold"
            >
              <option value="all">Semua Metode</option>
              <option value="dompetku">DompetKu</option>
              <option value="bank">Transfer Bank</option>
            </select>
          </div>

          {/* Refund Type Filter */}
          <div>
            <label htmlFor="historyRefTypeSelect" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1.5 ml-1">Jenis Pengajuan</label>
            <select
              id="historyRefTypeSelect"
              value={historyRefundTypeFilter}
              onChange={e => setHistoryRefundTypeFilter(e.target.value)}
              className="w-full px-3 py-2.5 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none text-text-light dark:text-text-dark font-bold"
            >
              <option value="all">Semua Jenis</option>
              <option value="reservation">Reservasi Meja Saja</option>
              <option value="order">Reservasi + Pre-Order Menu</option>
            </select>
          </div>

          {/* Reservation ID Specific Search */}
          <div>
            <label htmlFor="historyResNoSearch" className="text-[10px] font-black uppercase text-muted tracking-widest block mb-1.5 ml-1">Nomor Reservasi</label>
            <input
              id="historyResNoSearch"
              type="text"
              value={historySearchResNo}
              onChange={e => setHistorySearchResNo(e.target.value)}
              placeholder="No. Reservasi..."
              className="w-full px-3 py-2.5 text-xs bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none text-text-light dark:text-text-dark"
            />
          </div>

          {/* Actions Panel */}
          <div className="flex gap-2 items-end">
            <button
              type="button"
              onClick={() => {
                setHistorySearchQuery("");
                setHistoryStartDate("");
                setHistoryEndDate("");
                setHistoryRefundMethodFilter("all");
                setHistoryRefundTypeFilter("all");
                setHistorySearchResNo("");
              }}
              className="w-full py-2.5 border border-dashed border-red-300 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl text-[10px] font-bold transition-all uppercase flex items-center justify-center gap-1"
              title="Hapus Semua Filter"
            >
              <X className="w-3.5 h-3.5" /> Hapus Filter
            </button>
          </div>
        </div>
      </div>

      {/* Reservation Cards */}
      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {displayedReservations.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-center py-20">
              <History className="w-16 h-16 text-muted mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-medium text-text-light dark:text-text-dark">Tidak Ada Transaksi Ditemukan</h3>
              <p className="text-muted mt-2">Belum ada riwayat transaksi atau coba sesuaikan kata kunci pencarian Anda.</p>
            </motion.div>
          ) : (
            <motion.div key="history-list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              {displayedReservations.map((res, i) => {
                const parsedNotes = getParsedNotes(res.notes);
                const displayNotes = parsedNotes.catatan;
                const displayAtasNama = parsedNotes.atas_nama || null;
                const displayMejaList = parsedNotes.meja_tambahan && parsedNotes.meja_tambahan.length > 0 
                  ? parsedNotes.meja_tambahan.join(", ") 
                  : res.tables?.table_number;
                const cancelledByInfo = getCancelledByLabel(parsedNotes);
                const isHistory = HISTORY_STATUSES.includes(res.status);

                return (
                  <motion.div 
                    key={res.id} 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: i * 0.05 }} 
                    className={`bg-card-light dark:bg-card-dark rounded-2xl border p-5 sm:p-6 shadow-sm ${
                      isHistory 
                        ? "border-border-light dark:border-border-dark opacity-80" 
                        : "border-border-light dark:border-border-dark"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`p-4 rounded-xl text-center min-w-[70px] shrink-0 ${isHistory ? "bg-gray-100 dark:bg-gray-800" : "bg-primary/10"}`}>
                          <p className={`text-xs font-medium uppercase ${isHistory ? "text-muted" : "text-primary"}`}>{format(new Date(res.reservation_date), "MMM", { locale: localeId })}</p>
                          <p className={`text-2xl font-bold ${isHistory ? "text-muted" : "text-primary"}`}>{format(new Date(res.reservation_date), "dd")}</p>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-text-light dark:text-text-dark text-lg truncate">
                            {displayAtasNama ? `Atas Nama: ${displayAtasNama}` : format(new Date(res.reservation_date), "EEEE, dd MMMM yyyy", { locale: localeId })}
                          </p>
                          {displayAtasNama && (
                            <p className="text-sm text-muted mb-1">{format(new Date(res.reservation_date), "EEEE, dd MMMM yyyy", { locale: localeId })}</p>
                          )}
                          <div className="flex flex-wrap gap-3 text-sm text-muted">
                            <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {res.reservation_time?.substring(0, 5)}</span>
                            <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {res.guest_count} Orang</span>
                            <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> Meja: {displayMejaList}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {["confirmed", "arrived", "seated"].includes(res.status) && (
                          <motion.button 
                            whileHover={{ scale: 1.05 }} 
                            whileTap={{ scale: 0.95 }} 
                            onClick={() => setSelectedQrRes(res)} 
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-white hover:bg-primary-hover rounded-xl font-bold text-xs shadow-md shadow-primary/10 transition-all"
                            title="Tampilkan QR Code Check-In"
                          >
                            <QrCode className="w-4 h-4" /> Tampilkan QR
                          </motion.button>
                        )}
                        <span className={`text-xs uppercase font-bold px-3 py-1.5 rounded-lg ${getStatusBadge(res.status)}`}>{getStatusText(res.status)}</span>
                        <motion.button 
                          whileTap={{ scale: 0.9 }} 
                          onClick={() => setSelectedDetailRes(res)} 
                          className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-xs font-bold text-primary rounded-xl flex items-center gap-1 transition-all border border-border-light dark:border-border-dark"
                          title="Detail Transaksi"
                        >
                          <Eye className="w-3.5 h-3.5" /> Detail
                        </motion.button>
                        {["pending", "confirmed"].includes(res.status) && (
                          <motion.button 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }} 
                            onClick={() => { setCancellingId(res.id); setCancelReason(""); }} 
                            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-xs font-bold text-rose-600 dark:text-rose-400 rounded-xl flex items-center gap-1.5 transition-all border border-rose-250 dark:border-rose-900/30"
                            title="Batalkan Pesanan"
                          >
                            <Ban className="w-3.5 h-3.5" /> Batalkan Pesanan
                          </motion.button>
                        )}
                      </div>
                    </div>
                    
                    {displayNotes && (
                      <p className="mt-3 text-sm text-muted bg-background-light dark:bg-background-dark p-3 rounded-lg">
                        <span className="font-bold">Catatan:</span> {displayNotes}
                      </p>
                    )}

                    {/* Pre-order menu details */}
                    {res.menu_items && Array.isArray(res.menu_items) && res.menu_items.length > 0 && (
                      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl space-y-2">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-muted flex items-center gap-1.5">
                          <ShoppingBag className="w-3.5 h-3.5 text-primary" /> Pre-Order Menu ({res.menu_items.length} Item)
                        </h4>
                        <div className="space-y-1.5 divide-y divide-border-light dark:divide-border-dark max-h-[150px] overflow-y-auto pr-1">
                          {res.menu_items.map((item: any, idx: number) => (
                            <div key={idx} className={`pt-1.5 ${idx === 0 ? "pt-0" : ""} flex justify-between text-xs text-text-light dark:text-text-dark`}>
                              <div>
                                <span className="font-semibold">{item.name}</span>
                                <span className="text-muted ml-1">x{item.quantity}</span>
                                {item.notes && (
                                  <span className="block text-[10px] text-primary italic">Catatan: &ldquo;{item.notes}&rdquo;</span>
                                )}
                              </div>
                              <span className="font-bold">Rp {(item.price * item.quantity).toLocaleString("id-ID")}</span>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-border-light dark:border-border-dark pt-2 flex justify-between font-bold text-xs text-text-light dark:text-text-dark">
                          <span>Subtotal Menu:</span>
                          <span>Rp {Number(res.menu_total || 0).toLocaleString("id-ID")}</span>
                        </div>
                      </div>
                    )}

                    {/* Payment Summary */}
                    <div className="mt-3 p-3 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/10 text-xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-muted flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5 text-primary" /> Pembayaran:
                        </span>
                        <div className="flex gap-2">
                          <span className="font-bold uppercase bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px]">
                            {res.payment_method}
                          </span>
                          <span className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                            res.payment_status === "paid"
                              ? "bg-green-100 text-green-850"
                              : res.payment_status === "dp_paid"
                              ? "bg-amber-100 text-amber-850"
                              : "bg-red-100 text-red-850"
                          }`}>
                            {res.payment_status === "paid" ? "Lunas" : res.payment_status === "dp_paid" ? "DP Dibayar" : res.payment_status === "failed" ? "Gagal Bayar" : "Menunggu Pembayaran"}
                          </span>
                        </div>
                      </div>
                      
                      {res.payment_method === "dp" && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-dashed border-primary/20 pt-2 mt-1.5 text-muted">
                          <div>
                            <p className="text-[10px] font-medium uppercase">DP ({res.dp_percent}%)</p>
                            <p className="font-semibold text-text-light dark:text-text-dark">Rp {Number(res.dp_amount || 0).toLocaleString("id-ID")}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-medium uppercase">Sisa Tagihan</p>
                            <p className="font-bold text-primary">Rp {Number(res.remaining_amount || 0).toLocaleString("id-ID")}</p>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[10px] font-medium uppercase">Total</p>
                            <p className="font-semibold text-text-light dark:text-text-dark">Rp {Number(res.menu_total || 0).toLocaleString("id-ID")}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Refund info */}
                    {res.refund_status && (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 dark:border-amber-900 rounded-xl text-xs space-y-1.5">
                        <p className="font-bold text-amber-800 dark:text-amber-400 uppercase text-[10px] tracking-wider">
                          Status Refund Pembatalan
                        </p>
                        <div className="flex justify-between">
                          <span>Metode Refund:</span>
                          <span className="font-semibold uppercase">{res.refund_method}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Jumlah Refund:</span>
                          <span className="font-bold text-amber-700 dark:text-amber-400">Rp {Number(res.refund_amount || 0).toLocaleString("id-ID")}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Status Refund:</span>
                          <span className="font-black uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px]">
                            {res.refund_status === "waiting_review" || res.refund_status === "pengajuan_refund" ? "Menunggu Review" : res.refund_status === "waiting_proof" ? "Menunggu Bukti" : res.refund_status === "approved" || res.refund_status === "disetujui" ? "Disetujui" : res.refund_status === "rejected" || res.refund_status === "ditolak" ? "Ditolak" : res.refund_status === "processed" || res.refund_status === "dana_dikirim" ? "Diproses / Dana Dikirim" : res.refund_status === "completed" || res.refund_status === "refund_selesai" ? "Selesai" : res.refund_status}
                          </span>
                        </div>
                      </div>
                    )}

                    {res.status === 'cancelled' && (res.payment_status === 'paid' || res.payment_status === 'dp_paid') && !res.refund_status && (
                      <div className="mt-3 pt-3 border-t border-dashed border-border-light dark:border-border-dark flex justify-between items-center">
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted font-medium">Pembayaran Anda dapat dikembalikan.</p>
                          <p className="font-semibold text-text-light dark:text-text-dark text-xs mt-0.5">Estimasi Refund: Rp {(res.payment_status === 'paid' ? (res.menu_total || 0) : (res.dp_amount || 0)).toLocaleString('id-ID')}</p>
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setRefundReservation(res);
                            setRefundReason("");
                            setRefundMethod("transfer");
                            setRefundBankName("");
                            setRefundAccountName("");
                            setRefundAccountNumber("");
                            setRefundBranch("");
                            setRefundNotes("");
                            setShowRefundWarning(true);
                          }}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-500/10 transition-all shrink-0"
                        >
                          Ajukan Refund
                        </motion.button>
                      </div>
                    )}
                    
                    {/* Cancelled by info */}
                    {res.status === "cancelled" && cancelledByInfo && (
                      <div className="mt-2 flex items-center gap-2 text-xs font-semibold">
                        <Ban className={`w-3.5 h-3.5 ${cancelledByInfo.color}`} />
                        <span className={cancelledByInfo.color}>{cancelledByInfo.label}</span>
                      </div>
                    )}

                    {parsedNotes?.catatan_batal && (
                      <p className="mt-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                        <span className="font-bold">Alasan Pembatalan:</span> {parsedNotes.catatan_batal}
                      </p>
                    )}
                    {parsedNotes?.catatan_tolak && (
                      <p className="mt-2 text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                        <span className="font-bold">Alasan Penolakan:</span> {parsedNotes.catatan_tolak}
                      </p>
                    )}
                    {parsedNotes?.telepon && <p className="mt-2 text-xs text-muted">No. Telepon: {parsedNotes.telepon}</p>}

                    {/* Status label for history */}
                    {isHistory && (
                      <div className="mt-3 pt-3 border-t border-border-light dark:border-border-dark flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 text-muted shrink-0" />
                        <p className="text-xs text-muted">
                          {res.status === "completed" && "Reservasi ini telah selesai."}
                          {res.status === "cancelled" && "Reservasi ini telah dibatalkan."}
                          {res.status === "rejected" && "Reservasi ini ditolak oleh kasir."}
                        </p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modal Ajukan Reservasi */}
      <BaseModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        showCloseButton={false}
        size="lg"
        noPadding
      >
        <div className="bg-primary p-6 text-white flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold">Ajukan Reservasi Meja</h2>
            <p className="text-white/80 text-sm mt-1">Lengkapi informasi diri & pilih meja bebas</p>
          </div>
          <button onClick={() => setShowModal(false)} title="Tutup" aria-label="Tutup" className="p-1 hover:bg-white/10 rounded-full text-white"><X className="w-6 h-6" /></button>
        </div>
        <form onSubmit={handlePreSubmit} className="p-6 sm:p-8 pt-0 sm:pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="atasNama" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Atas Nama</label>
              <div className="relative">
                <User className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
                <input id="atasNama" type="text" value={form.atasNama} onChange={e => setForm({ ...form, atasNama: e.target.value })} placeholder="Masukkan nama pemesan..." className="w-full pl-9 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none text-text-light dark:text-text-dark" required />
              </div>
            </div>
            <div>
              <label htmlFor="telepon" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Nomor Telepon</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3.5 h-4 w-4 text-muted" />
                <input id="telepon" type="tel" value={form.telepon} onChange={e => setForm({ ...form, telepon: e.target.value })} placeholder="Contoh: 08123456789" className="w-full pl-9 pr-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none text-text-light dark:text-text-dark" required />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="resDate" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Tanggal</label>
              <input id="resDate" title="Tanggal Reservasi" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} min={getTodayStr()} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none text-text-light dark:text-text-dark" required />
            </div>
            <div>
              <label htmlFor="resTime" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Waktu</label>
              <input id="resTime" title="Waktu Reservasi" type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none text-text-light dark:text-text-dark" required />
            </div>
          </div>

          <div>
            <label htmlFor="resGuests" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Jumlah Tamu</label>
            <input id="resGuests" title="Jumlah Tamu" type="number" value={form.guests} onChange={e => setForm({ ...form, guests: parseInt(e.target.value) })} min={1} max={50} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none text-text-light dark:text-text-dark" required />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-text-light dark:text-text-dark">Pilih Meja (Bisa pilih lebih dari satu)</label>
              {form.date && form.time && (
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                  tables.filter(t => selectedTableIds.includes(t.id)).reduce((sum, t) => sum + t.capacity, 0) >= form.guests
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                }`}>
                  Kapasitas Terpilih: {tables.filter(t => selectedTableIds.includes(t.id)).reduce((sum, t) => sum + t.capacity, 0)} / {form.guests} Orang
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {tables.map(t => {
                const bookedStatus = bookedTablesInfo[t.id];
                const isBooked = !!bookedStatus;
                const isSelected = selectedTableIds.includes(t.id);
                
                let borderClass = "border-border-light dark:border-border-dark text-muted hover:border-gray-300";
                let bgClass = "bg-background-light dark:bg-background-dark";
                let statusText = `Cap: ${t.capacity} org`;
                let textClass = "";

                if (isSelected) {
                  borderClass = "border-primary text-primary";
                  bgClass = "bg-primary/10";
                  textClass = "text-primary font-bold";
                } else if (isBooked) {
                  if (bookedStatus === "confirmed") {
                    borderClass = "border-red-500/50 text-red-500 opacity-60 cursor-not-allowed";
                    bgClass = "bg-red-500/5";
                    statusText = "Dibooking";
                    textClass = "text-red-500 font-bold";
                  } else {
                    borderClass = "border-amber-500/50 text-amber-500 opacity-60 cursor-not-allowed";
                    bgClass = "bg-amber-500/5";
                    statusText = "Menunggu";
                    textClass = "text-amber-550 font-bold";
                  }
                }

                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => {
                      if (!isBooked) {
                        handleTableToggle(t.id);
                      }
                    }}
                    disabled={isBooked}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${bgClass} ${borderClass}`}
                  >
                    <span className={`font-black text-lg ${textClass || "text-text-light dark:text-text-dark"}`}>Meja {t.table_number}</span>
                    <span className={`text-[10px] font-bold mt-1 ${textClass || "text-muted"}`}>{statusText}</span>
                  </button>
                );
              })}
            </div>
            {tables.length === 0 && <p className="text-sm text-red-500">Tidak ada meja tersedia saat ini.</p>}
          </div>

          {/* SECTION: Pilih Menu Pesanan */}
          <div className="border-t border-border-light dark:border-border-dark pt-6 mt-6">
            <h3 className="text-lg font-bold text-text-light dark:text-text-dark mb-1 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" /> Pilih Menu Pesanan (Pre-Order)
            </h3>
            <p className="text-xs text-muted mb-4">
              Menu yang Anda pilih akan disiapkan 30 menit sebelum jam booking dimulai. Pastikan pesanan sudah sesuai karena pesanan akan diproses bersamaan dengan reservasi.
            </p>

            {/* Category Pills & Search */}
            <div className="flex flex-col gap-3 mb-4 w-full">
              <div className="relative w-full">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
                <input
                  type="text"
                  placeholder="Cari menu makanan/minuman..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-slate-300 outline-none text-text-light dark:text-text-dark text-sm"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1.5 w-full scrollbar-thin">
                <button
                  type="button"
                  onClick={() => setActiveCategory("all")}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    activeCategory === "all"
                      ? "bg-primary text-white"
                      : "bg-gray-150 dark:bg-gray-800 text-muted hover:text-text-light dark:hover:text-text-dark"
                  }`}
                >
                  Semua
                </button>
                {categories.map((cat) => (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      activeCategory === cat.id
                        ? "bg-primary text-white"
                        : "bg-gray-150 dark:bg-gray-800 text-muted hover:text-text-light dark:hover:text-text-dark"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
              {menuItems
                .filter((item) => {
                  const matchesCategory = activeCategory === "all" || item.category_id === activeCategory;
                  const matchesSearch = item.name.toLowerCase().includes(menuSearch.toLowerCase());
                  return matchesCategory && matchesSearch;
                })
                .map((item) => {
                  const qty = selectedMenu[item.id]?.quantity || 0;
                  const isOutOfStock = (item.stock || 0) <= 0;
                  return (
                    <div
                      key={item.id}
                      className="flex gap-3 p-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl items-center min-w-0"
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-16 h-16 rounded-lg object-cover shrink-0 bg-gray-100"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                          <ShoppingBag className="w-6 h-6 text-muted" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 pr-1">
                        <h4 className="font-bold text-sm text-text-light dark:text-text-dark line-clamp-2 break-words leading-tight" title={item.name}>
                          {item.name}
                        </h4>
                        <p className="text-xs text-primary font-bold mt-1 whitespace-nowrap">
                          Rp {item.price.toLocaleString("id-ID")}
                        </p>
                        <p className="text-[10px] text-muted mt-0.5 whitespace-nowrap">
                          Stok: {item.stock || 0}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {qty > 0 ? (
                          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.id, qty - 1)}
                              className="w-6 h-6 bg-white dark:bg-gray-750 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center justify-center font-bold text-sm text-text-light dark:text-text-dark border-none outline-none shrink-0"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold w-4 text-center text-text-light dark:text-text-dark shrink-0">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.id, qty + 1)}
                              disabled={qty >= (item.stock || 0)}
                              className="w-6 h-6 bg-white dark:bg-gray-750 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center justify-center font-bold text-sm text-text-light dark:text-text-dark disabled:opacity-50 border-none outline-none shrink-0"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddMenuItem(item)}
                            disabled={isOutOfStock}
                            className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold shadow-md shadow-primary/15 hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:bg-gray-300 shrink-0 whitespace-nowrap"
                          >
                            {isOutOfStock ? "Habis" : "Tambah"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Selected Menu Details / Notes input */}
            {Object.keys(selectedMenu).length > 0 && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted">
                  Detail Menu Terpilih & Catatan Khusus
                </h4>
                <div className="space-y-3 divide-y divide-border-light dark:divide-border-dark max-h-[200px] overflow-y-auto pr-1">
                  {Object.entries(selectedMenu).map(([id, item], idx) => (
                    <div key={id} className={`pt-2 ${idx === 0 ? "pt-0" : ""}`}>
                      <div className="flex justify-between text-sm font-semibold text-text-light dark:text-text-dark">
                        <span>
                          {item.name} <span className="text-xs text-muted">x{item.quantity}</span>
                        </span>
                        <span>Rp {(item.price * item.quantity).toLocaleString("id-ID")}</span>
                      </div>
                      <input
                        type="text"
                        placeholder="Catatan khusus (misal: pedas sedang, es sedikit)..."
                        value={item.notes}
                        onChange={(e) => handleUpdateNotes(id, e.target.value)}
                        className="w-full mt-1.5 px-3 py-1.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg outline-none text-xs text-text-light dark:text-text-dark"
                      />
                    </div>
                  ))}
                </div>
                <div className="border-t border-border-light dark:border-border-dark pt-3 flex justify-between font-bold text-sm text-text-light dark:text-text-dark">
                  <span>Subtotal Menu:</span>
                  <span>Rp {calculateMenuTotal().toLocaleString("id-ID")}</span>
                </div>
              </div>
            )}
          </div>

          {/* SECTION: Metode Pembayaran */}
          <div className="border-t border-border-light dark:border-border-dark pt-6">
            <h3 className="text-lg font-bold text-text-light dark:text-text-dark mb-2 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" /> Metode Pembayaran
            </h3>
            <p className="text-xs text-muted mb-4">
              Pilih bagaimana Anda ingin menyelesaikan pembayaran pesanan pre-order ini.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Tunai */}
              <label className={`p-3 rounded-xl border-2 flex items-center gap-3 cursor-pointer transition-all ${
                paymentMethod === "tunai"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border-light dark:border-border-dark hover:border-gray-300 text-muted"
              }`}>
                <input
                  type="radio"
                  name="payment_method"
                  value="tunai"
                  checked={paymentMethod === "tunai"}
                  onChange={() => setPaymentMethod("tunai")}
                  className="accent-primary h-4 w-4"
                />
                <div className="text-left">
                  <p className="font-bold text-sm text-text-light dark:text-text-dark">Tunai</p>
                  <p className="text-[10px]">Bayar penuh di kasir</p>
                </div>
              </label>

              {/* DompetKu */}
              <label className={`p-3 rounded-xl border-2 flex items-center gap-3 cursor-pointer transition-all ${
                paymentMethod === "dompetku"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border-light dark:border-border-dark hover:border-gray-300 text-muted"
              }`}>
                <input
                  type="radio"
                  name="payment_method"
                  value="dompetku"
                  checked={paymentMethod === "dompetku"}
                  onChange={() => setPaymentMethod("dompetku")}
                  className="accent-primary h-4 w-4"
                />
                <div className="text-left">
                  <p className="font-bold text-sm text-text-light dark:text-text-dark">DompetKu</p>
                  <p className="text-[10px]">
                    Saldo: Rp {walletInfo ? walletInfo.balance.toLocaleString("id-ID") : "0"}
                  </p>
                </div>
              </label>

              {/* Non Tunai */}
              <label className={`p-3 rounded-xl border-2 flex items-center gap-3 cursor-pointer transition-all ${
                paymentMethod === "non_cash"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border-light dark:border-border-dark hover:border-gray-300 text-muted"
              }`}>
                <input
                  type="radio"
                  name="payment_method"
                  value="non_cash"
                  checked={paymentMethod === "non_cash"}
                  onChange={() => setPaymentMethod("non_cash")}
                  className="accent-primary h-4 w-4"
                />
                <div className="text-left">
                  <p className="font-bold text-sm text-text-light dark:text-text-dark">Non Tunai</p>
                  <p className="text-[10px]">Bayar instan secara online</p>
                </div>
              </label>

              {/* Bayar Sebagian / DP */}
              <label className={`p-3 rounded-xl border-2 flex items-center gap-3 cursor-pointer transition-all ${
                paymentMethod === "dp"
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border-light dark:border-border-dark hover:border-gray-300 text-muted"
              }`}>
                <input
                  type="radio"
                  name="payment_method"
                  value="dp"
                  checked={paymentMethod === "dp"}
                  onChange={() => setPaymentMethod("dp")}
                  className="accent-primary h-4 w-4"
                />
                <div className="text-left">
                  <p className="font-bold text-sm text-text-light dark:text-text-dark">Bayar DP</p>
                  <p className="text-[10px]">Bayar sebagian dahulu</p>
                </div>
              </label>
            </div>

            {/* DOMPETKU WARNINGS */}
            {((paymentMethod === "dompetku") || (paymentMethod === "dp" && dpSource === "dompetku")) && (
              <div className="space-y-2.5 mb-4">
                {(!walletInfo || !["diterima", "selesai", "aktif"].includes(walletInfo.walletStatus)) ? (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="font-semibold">DompetKu Anda belum aktif. Silakan lakukan aktivasi terlebih dahulu sebelum menggunakannya.</span>
                  </div>
                ) : (walletInfo && walletInfo.balance < (paymentMethod === "dp" ? (calculateMenuTotal() * dpPercent) / 100 : calculateMenuTotal())) ? (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-250 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-400 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span className="font-semibold">Saldo DompetKu Anda tidak mencukupi untuk melakukan pembayaran ini.</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => router.push("/customer/wallet")}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg shadow transition-all uppercase tracking-wider flex items-center gap-1.5"
                      >
                        <Wallet className="w-3.5 h-3.5" /> Isi Ulang Saldo
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* DP Configuration Panel */}
            {paymentMethod === "dp" && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-border-light dark:border-border-dark space-y-4 mb-4">
                <div className="flex justify-between items-center text-xs font-bold text-muted uppercase">
                  <span>Persentase DP</span>
                  <span className="text-primary">{dpPercent}%</span>
                </div>
                <input
                  type="range"
                  id="dp-range-slider"
                  title="Persentase DP"
                  aria-label="Persentase DP"
                  min={minimalDp}
                  max={100}
                  step={5}
                  value={dpPercent}
                  onChange={(e) => setDpPercent(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-xs text-muted">
                  <span>Min DP: {minimalDp}%</span>
                  <span>Max DP: 100%</span>
                </div>

                {/* DP Source Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted uppercase block">Bayar DP Menggunakan</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDpSource("dompetku")}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border-2 transition-all ${
                        dpSource === "dompetku"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border-light dark:border-border-dark hover:border-gray-300 text-muted"
                      }`}
                    >
                      DompetKu
                    </button>
                    <button
                      type="button"
                      onClick={() => setDpSource("non_cash")}
                      className={`px-3 py-2 rounded-lg text-xs font-bold border-2 transition-all ${
                        dpSource === "non_cash"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border-light dark:border-border-dark hover:border-gray-300 text-muted"
                      }`}
                    >
                      Non Tunai
                    </button>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed mt-2 bg-gray-100/50 dark:bg-gray-800/50 p-2.5 rounded-lg border border-border-light dark:border-border-dark">
                    Pembayaran Uang Muka (DP) wajib diselesaikan secara elektronik (DompetKu atau Non Tunai/Online Payment Gateway) untuk menjamin slot reservasi Anda secara instan. Pembayaran tunai tidak didukung untuk DP.
                  </p>
                </div>

                {dpSource === "dompetku" && (!walletInfo || !["diterima", "selesai", "aktif"].includes(walletInfo.walletStatus)) && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>DompetKu Anda belum aktif. Silakan pilih sumber pembayaran DP yang lain.</span>
                  </div>
                )}
              </div>
            )}

            {/* PIN INPUT FOR DOMPETKU */}
            {((paymentMethod === "dompetku" && walletInfo && ["diterima", "selesai", "aktif"].includes(walletInfo.walletStatus)) ||
              (paymentMethod === "dp" && dpSource === "dompetku" && walletInfo && ["diterima", "selesai", "aktif"].includes(walletInfo.walletStatus))) && (
              <div className="mb-4">
                <label htmlFor="walletPin" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">
                  PIN DompetKu
                </label>
                <input
                  id="walletPin"
                  type="password"
                  placeholder="Masukkan PIN DompetKu"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none text-text-light dark:text-text-dark font-mono text-center tracking-widest text-lg"
                  required
                />
              </div>
            )}

            {/* RINGKASAN PEMBAYARAN */}
            <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20 space-y-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-primary mb-2">
                Ringkasan Pembayaran Reservasi & Pre-Order
              </h4>
              <div className="flex justify-between text-xs text-text-light dark:text-text-dark">
                <span>Total Harga Menu:</span>
                <span className="font-semibold">Rp {calculateMenuTotal().toLocaleString("id-ID")}</span>
              </div>
              <div className="flex justify-between text-xs text-text-light dark:text-text-dark">
                <span>Metode Pembayaran Utama:</span>
                <span className="font-semibold uppercase text-primary">{paymentMethod}</span>
              </div>
              {paymentMethod === "dp" && (
                <>
                  <div className="flex justify-between text-xs text-text-light dark:text-text-dark">
                    <span>DP Dibayar ({dpPercent}%):</span>
                    <span className="font-semibold text-primary">
                      Rp {((calculateMenuTotal() * dpPercent) / 100).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-text-light dark:text-text-dark">
                    <span>Sumber Pembayaran DP:</span>
                    <span className="font-semibold uppercase text-primary">{dpSource}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-text-light dark:text-text-dark border-t border-dashed border-primary/20 pt-2 mt-1">
                    <span>Sisa Pembayaran di Kasir:</span>
                    <span className="text-primary">
                      Rp {(calculateMenuTotal() - (calculateMenuTotal() * dpPercent) / 100).toLocaleString("id-ID")}
                    </span>
                  </div>
                </>
              )}
              {paymentMethod !== "dp" && (
                <div className="flex justify-between text-sm font-bold text-text-light dark:text-text-dark border-t border-dashed border-primary/20 pt-2 mt-1">
                  <span>Total Tagihan:</span>
                  <span className="text-primary">Rp {calculateMenuTotal().toLocaleString("id-ID")}</span>
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted italic mt-3 leading-relaxed text-center">
              Dengan melanjutkan pemesanan, Anda menyetujui aturan reservasi, pembayaran, DP minimal, charge pembatalan, dan tanggung jawab atas pesanan yang telah disiapkan.
              {paymentMethod === "dp" && ` Jika Anda memilih DP, maka minimal DP yang wajib dibayarkan adalah ${minimalDp}% dari total pesanan.`}
              {" Pesanan akan disiapkan 30 menit sebelum jadwal booking dimulai."}
              {` Pembatalan sepihak dapat dikenakan charge sebesar ${chargeCancel}% dari total pesanan yang sudah diproses.`}
            </p>
          </div>

          <div>
            <label htmlFor="resNotes" className="text-sm font-medium text-text-light dark:text-text-dark mb-1 block">Catatan Tambahan (Opsional)</label>
            <textarea id="resNotes" title="Catatan" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none text-text-light dark:text-text-dark" rows={2} placeholder="Contoh: Butuh colokan listrik, AC dingin, dll" />
          </div>

          <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 border border-border-light dark:border-border-dark rounded-xl font-medium text-text-light dark:text-text-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Batal</button>
            <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={submitting} className="flex-1 py-3 bg-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Ajukan Sekarang</>}
            </motion.button>
          </div>
        </form>
      </BaseModal>

      {/* Modal Aturan Reservasi */}
      <BaseModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        showCloseButton={false}
        size="lg"
        noPadding
      >
        <div className="bg-primary p-6 text-white flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Aturan Reservasi Meja</h2>
            <p className="text-white/80 text-sm mt-1">Mohon baca dan setujui aturan resto sebelum melanjutkan</p>
          </div>
          <button onClick={() => setShowRulesModal(false)} type="button" title="Tutup" aria-label="Tutup" className="p-1 hover:bg-white/10 rounded-full text-white"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6 sm:p-8 space-y-6 text-text-light dark:text-text-dark max-h-[550px] overflow-y-auto pr-2">
          {/* Section I: Ketentuan Umum */}
          <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-primary border-b border-border-light dark:border-border-dark pb-2">
              I. Ketentuan Umum &amp; Kehadiran
            </h3>
            <ol className="list-decimal pl-6 space-y-2.5 text-xs sm:text-sm leading-relaxed">
              <li>Reservasi hanya berlaku sesuai tanggal, jam, dan meja yang dipilih saat pemesanan.</li>
              <li>Pelanggan wajib hadir dan melakukan check-in pada jam booking yang telah ditentukan.</li>
              <li>Pelanggan memiliki toleransi check-in selama <span className="font-bold text-primary">{toleranceMinutes} menit</span> setelah jam booking dimulai.</li>
              <li>Jika pelanggan tidak check-in sampai batas toleransi habis, reservasi akan dianggap hangus, dibatalkan, dan meja akan dibuka kembali untuk pelanggan lain.</li>
              <li>Resto tidak bertanggung jawab atas kehilangan hak reservasi jika pelanggan terlambat datang dan tidak segera check-in.</li>
              <li>Pelanggan wajib menjaga kebersihan, ketertiban, dan kenyamanan area resto.</li>
              <li>Pelanggan dilarang merusak, mencoret, mematahkan, membawa pulang, atau menyalahgunakan properti resto dalam bentuk apa pun.</li>
              <li>Jika terjadi kerusakan, kehilangan, atau penyalahgunaan fasilitas akibat pelanggan atau rombongan, pelanggan wajib mengganti kerugian sesuai penilaian pihak resto.</li>
              <li>Resto berhak memberikan denda tambahan jika kerusakan menimbulkan biaya perbaikan, kehilangan barang, atau gangguan operasional.</li>
              <li>Resto tidak bertanggung jawab atas kejadian yang timbul akibat kelalaian pelanggan dalam mematuhi aturan, termasuk keterlambatan check-in.</li>
              <li>Pelanggan wajib mengikuti arahan staf resto terkait penempatan meja, keamanan, dan kenyamanan bersama.</li>
              <li>Reservasi dapat dibatalkan secara sepihak jika pelanggan melanggar aturan, membuat keributan, merusak fasilitas, atau mengganggu pengunjung lain.</li>
              <li>Dengan menekan tombol &ldquo;Setuju &amp; Ajukan Sekarang&rdquo;, pelanggan menyatakan telah membaca, memahami, dan menyetujui seluruh aturan yang berlaku.</li>
            </ol>
          </div>

          {/* Section II: Ketentuan Pre-Order & Pembayaran */}
          <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-primary border-b border-border-light dark:border-border-dark pb-2">
              II. Ketentuan Pre-Order &amp; Pembayaran
            </h3>
            <ol className="list-decimal pl-6 space-y-2.5 text-xs sm:text-sm leading-relaxed">
              <li>Pesanan menu yang dipilih akan disiapkan 30 menit sebelum waktu booking dimulai.</li>
              <li>Pelanggan wajib memastikan pesanan yang dipilih sudah benar sebelum mengajukan reservasi.</li>
              <li>Jika memilih pembayaran DP, pelanggan wajib membayar minimal <span className="font-bold text-primary">{minimalDp}%</span> dari total harga sesuai ketentuan resto.</li>
              <li>Jika DP belum memenuhi batas minimal, sistem tidak boleh melanjutkan pemesanan.</li>
              <li>Sisa pembayaran wajib dilunasi pada kasir saat check-in atau saat transaksi lanjutan sesuai aturan resto.</li>
              <li>Jika pelanggan membatalkan sepihak setelah pesanan disiapkan, maka akan dikenakan charge pembatalan sebesar <span className="font-bold text-red-500">{chargeCancel}%</span> dari total harga pesanan yang sudah disiapkan.</li>
              <li>Nominal refund akan dihitung setelah dipotong charge pembatalan sesuai ketentuan resto.</li>
              <li>Jika reservasi belum dikonfirmasi oleh resto lalu pelanggan membatalkan, maka pembatalan dapat diproses otomatis dan refund dikembalikan penuh sesuai status pembayaran dan kebijakan sistem.</li>
              <li>Jika reservasi sudah dikonfirmasi, pembatalan wajib mengikuti proses verifikasi dan pengisian data pembatalan/refund dari resto.</li>
              <li>Resto tidak bertanggung jawab atas keterlambatan check-in atau pembatalan yang dilakukan setelah pesanan diproses sesuai jadwal.</li>
            </ol>
          </div>

          {/* Section III: Verifikasi Data Reservasi */}
          <div className="bg-amber-50 dark:bg-amber-950/20 p-5 rounded-2xl border border-amber-250 dark:border-amber-900/40 shadow-sm space-y-4 text-text-light dark:text-text-dark">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-amber-800 dark:text-amber-400 border-b border-amber-250 dark:border-amber-900 pb-2">
              III. Ringkasan &amp; Verifikasi Data Reservasi
            </h3>
            <p className="text-xs text-red-600 dark:text-red-400 font-bold">
              Mohon periksa kembali seluruh data reservasi Anda sebelum melanjutkan.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold leading-relaxed">
              <div>
                <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Atas Nama / Telepon</p>
                <p className="font-black text-sm text-text-light dark:text-text-dark">{form.atasNama} ({form.telepon})</p>
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Tanggal &amp; Waktu</p>
                <p className="font-bold text-text-light dark:text-text-dark">{form.date ? format(new Date(form.date + "T00:00:00"), "dd MMMM yyyy", { locale: localeId }) : "-"} Pukul {form.time} WIB</p>
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Jumlah Tamu &amp; Meja</p>
                <p className="font-bold text-text-light dark:text-text-dark">{form.guests} Orang (Meja: {tables.filter(t => selectedTableIds.includes(t.id)).map(t => t.table_number).join(", ")})</p>
              </div>
              <div>
                <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Metode Pembayaran</p>
                <p className="font-black text-sm text-primary uppercase">{paymentMethod === "dp" ? `DP (${dpPercent}% via ${dpSource})` : paymentMethod}</p>
              </div>
              {calculateMenuTotal() > 0 && (
                <div className="col-span-2 space-y-1 p-3 bg-white dark:bg-gray-800 rounded-xl border border-border-light dark:border-border-dark">
                  <p className="text-[10px] text-muted uppercase font-bold tracking-wider">Daftar Menu Pre-Order</p>
                  {Object.values(selectedMenu).map((menuItem: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-[11px] font-medium">
                      <span>{menuItem.name} (x{menuItem.quantity})</span>
                      <span>Rp {(menuItem.price * menuItem.quantity).toLocaleString("id-ID")}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-xs pt-1.5 border-t border-dashed border-border-light dark:border-border-dark">
                    <span>Total Subtotal Menu:</span>
                    <span>Rp {calculateMenuTotal().toLocaleString("id-ID")}</span>
                  </div>
                  {paymentMethod === "dp" && (
                    <div className="flex justify-between font-bold text-xs text-primary">
                      <span>Nominal DP ({dpPercent}%):</span>
                      <span>Rp {((calculateMenuTotal() * dpPercent) / 100).toLocaleString("id-ID")}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Penegasan Ketentuan Resto Card */}
          <div className="p-4 bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl text-xs space-y-2">
            <p className="font-bold text-primary uppercase tracking-wider text-[11px]">Penegasan Ketentuan Utama Resto:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-text-light dark:text-text-dark font-medium">
              <p>&bull; Toleransi check-in: <span className="font-bold text-amber-600 dark:text-amber-400">{toleranceMinutes} menit</span></p>
              <p>&bull; Minimal DP: <span className="font-bold text-primary">{minimalDp}%</span></p>
              <p>&bull; Denda pembatalan: <span className="font-bold text-red-500">{chargeCancel}%</span></p>
              <p>&bull; Persiapan dapur: <span className="font-bold text-emerald-600 dark:text-emerald-400">30 menit sebelum mulai</span></p>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3 pt-2">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={rulesChecked} 
                onChange={(e) => setRulesChecked(e.target.checked)} 
                className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary border-gray-300" 
              />
              <span className="text-xs font-bold text-text-light dark:text-text-dark leading-relaxed">
                Saya menyetujui seluruh ketentuan dan aturan reservasi meja yang berlaku di resto.
              </span>
            </label>
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={dataChecked} 
                onChange={(e) => setDataChecked(e.target.checked)} 
                className="mt-1 w-4 h-4 rounded text-primary focus:ring-primary border-gray-300" 
              />
              <span className="text-xs font-bold text-text-light dark:text-text-dark leading-relaxed">
                Saya telah memeriksa kembali seluruh data reservasi dan pesanan saya.
              </span>
            </label>
          </div>
          
          <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
            <button type="button" onClick={() => setShowRulesModal(false)} className="flex-1 py-3 border border-border-light dark:border-border-dark rounded-xl font-medium text-text-light dark:text-text-dark hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Batal</button>
            <button 
              type="button" 
              onClick={handleSubmit} 
              disabled={!rulesChecked || !dataChecked}
              className="flex-1 py-3 bg-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Setuju &amp; Ajukan Sekarang
            </button>
          </div>
        </div>
      </BaseModal>

      {/* Modal Pembatalan */}
      <BaseModal
        isOpen={!!cancellingId}
        onClose={() => setCancellingId(null)}
        showCloseButton={false}
        size="md"
        noPadding
      >
        {(() => {
          const cancellingRes = reservations.find(r => r.id === cancellingId);
          if (!cancellingRes) return null;

          let totalPaid = 0;
          if (cancellingRes.payment_status === "paid") {
            totalPaid = Number(cancellingRes.menu_total || 0);
          } else if (cancellingRes.payment_status === "dp_paid") {
            totalPaid = Number(cancellingRes.dp_amount || 0);
          }

          let chargePercent = 0;
          let chargeAmount = 0;
          let estimatedRefund = totalPaid;
          let isPrepared = false;

          if (cancellingRes.status !== "pending") {
            // Confirmed reservation
            const bookingDateTimeStr = `${cancellingRes.reservation_date}T${cancellingRes.reservation_time}`;
            const bookingTime = new Date(bookingDateTimeStr).getTime();
            const curTime = Date.now();
            const minutesDiff = (bookingTime - curTime) / (60 * 1000);
            if (minutesDiff <= 30) {
              chargePercent = Number(cancellingRes.cancellation_charge_percent || chargeCancel);
              chargeAmount = Number(cancellingRes.menu_total || 0) * chargePercent / 100;
              estimatedRefund = Math.max(0, totalPaid - chargeAmount);
              isPrepared = true;
            }
          }

          const hasPayment = totalPaid > 0;

          return (
            <>
              {/* Header Modal */}
              <div className="p-6 pb-2 flex justify-between items-start border-b border-border-light dark:border-border-dark">
                <div className="flex gap-3.5 items-center">
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 text-red-500 rounded-2xl border border-red-100 dark:border-red-900/50">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-text-light dark:text-text-dark uppercase tracking-tight">Batalkan Reservasi</h3>
                    <p className="text-muted text-[11px] mt-0.5">ID Reservasi: <span className="font-mono font-bold text-text-light dark:text-text-dark">#{cancellingRes.id.substring(0, 8).toUpperCase()}</span></p>
                  </div>
                </div>
                <button type="button" onClick={() => setCancellingId(null)} title="Tutup" aria-label="Tutup" className="p-2 hover:bg-gray-150 dark:hover:bg-gray-800 rounded-xl transition-all text-muted"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleCancelSubmit} className="p-6 sm:p-8 pt-4 sm:pt-4 space-y-5">
                {hasPayment && (
                  <div className="p-4 bg-red-50/50 dark:bg-red-950/10 border border-red-200/50 dark:border-red-900/30 rounded-2xl space-y-2.5 text-xs text-text-light dark:text-text-dark">
                    <p className="font-bold text-red-700 dark:text-red-400 uppercase text-[10px] tracking-wider">
                      Ketentuan Refund &amp; Biaya Pembatalan
                    </p>
                    <div className="flex justify-between text-muted">
                      <span>Total Telah Dibayar:</span>
                      <span className="font-semibold text-text-light dark:text-text-dark">Rp {totalPaid.toLocaleString("id-ID")}</span>
                    </div>
                    {isPrepared ? (
                      <>
                        <div className="flex justify-between text-red-500">
                          <span>Biaya Pembatalan ({chargePercent}%):</span>
                          <span className="font-semibold">-Rp {chargeAmount.toLocaleString("id-ID")}</span>
                        </div>
                        <p className="text-[10px] text-muted italic leading-normal">
                          * Dikenakan biaya pembatalan sebesar {chargePercent}% karena pembatalan dilakukan kurang dari 30 menit sebelum jam reservasi dimulai.
                        </p>
                      </>
                    ) : (
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-450 italic">
                        * Reservasi dibatalkan sebelum pesanan diproses (bebas biaya pembatalan).
                      </p>
                    )}
                    <div className="flex justify-between font-bold text-sm border-t border-dashed border-red-200 dark:border-red-900/30 pt-2.5 mt-1">
                      <span>Estimasi Pengembalian Dana:</span>
                      <span className="text-red-650 dark:text-red-400">Rp {estimatedRefund.toLocaleString("id-ID")}</span>
                    </div>
                  </div>
                )}

                {/* DP Wording / Explanation */}
                {cancellingRes.payment_status === "dp_paid" && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl text-xs text-amber-800 dark:text-amber-400 space-y-1">
                    <p className="font-bold uppercase text-[10px] tracking-wider">Informasi Down Payment (DP)</p>
                    <p className="leading-relaxed">
                      Reservasi ini menggunakan sistem Uang Muka (DP) sebesar {cancellingRes.dp_percent}%. Uang yang telah lunas terbayar adalah Rp {Number(cancellingRes.dp_amount || 0).toLocaleString("id-ID")}. Sisa pembayaran sebesar Rp {Number(cancellingRes.remaining_amount || 0).toLocaleString("id-ID")} dibatalkan otomatis dan tidak perlu dilunasi. Pengembalian dana (refund) akan dihitung dari jumlah DP yang telah lunas tersebut.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="cancelReason" className="text-xs font-bold text-muted uppercase tracking-wider block">Alasan Pembatalan</label>
                  <textarea
                    id="cancelReason"
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    placeholder="Masukkan alasan pembatalan Anda..."
                    className="w-full px-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-red-500 outline-none text-text-light dark:text-text-dark min-h-[90px] text-sm transition-all focus:border-red-500"
                    required
                  />
                </div>

                {hasPayment && (
                  <>
                    <div className="space-y-2.5">
                      <label className="text-xs font-bold text-muted uppercase tracking-wider block">Metode Refund</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setCancelRefundMethod("transfer")}
                          className={`px-3 py-3 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center justify-center gap-1.5 ${
                            cancelRefundMethod === "transfer"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border-light dark:border-border-dark hover:border-gray-300 text-muted"
                          }`}
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>Transfer Bank</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelRefundMethod("dompetku")}
                          disabled={!walletInfo || !["diterima", "selesai", "aktif"].includes(walletInfo.walletStatus)}
                          className={`px-3 py-3 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                            cancelRefundMethod === "dompetku"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border-light dark:border-border-dark hover:border-gray-300 text-muted"
                          }`}
                        >
                          <Wallet className="w-4 h-4" />
                          <span>DompetKu</span>
                        </button>
                      </div>
                      {cancelRefundMethod === "dompetku" && (!walletInfo || !["diterima", "selesai", "aktif"].includes(walletInfo.walletStatus)) && (
                        <p className="text-[10px] text-red-500 font-semibold mt-1">
                          DompetKu Anda belum aktif. Silakan pilih transfer bank.
                        </p>
                      )}
                    </div>

                    {cancelRefundMethod === "transfer" ? (
                      <>
                        <div className="space-y-1.5">
                          <label htmlFor="refundAccount" className="text-xs font-bold text-muted uppercase tracking-wider block">
                            Detail Rekening Bank (Nama Bank, No Rek, Atas Nama)
                          </label>
                          <input
                            id="refundAccount"
                            type="text"
                            placeholder="BCA - 123456789 - John Doe"
                            value={cancelRefundBankAccount}
                            onChange={e => setCancelRefundBankAccount(e.target.value)}
                            className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark text-sm"
                            required={cancelRefundMethod === "transfer"}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label htmlFor="refundProof" className="text-xs font-bold text-muted uppercase tracking-wider block">
                            Link Bukti Pendukung / Foto KTP / Resi Pembayaran
                          </label>
                          <input
                            id="refundProof"
                            type="text"
                            placeholder="http://example.com/bukti.jpg"
                            value={cancelRefundProof}
                            onChange={e => setCancelRefundProof(e.target.value)}
                            className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl focus:ring-2 focus:ring-primary outline-none text-text-light dark:text-text-dark text-sm"
                            required={cancelRefundMethod === "transfer"}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-800 dark:text-blue-400">
                        <p className="font-bold uppercase text-[10px] tracking-wider">Refund via DompetKu</p>
                        <p className="leading-relaxed mt-0.5">
                          Dana refund sebesar Rp {estimatedRefund.toLocaleString("id-ID")} akan langsung masuk ke saldo DompetKu Anda secara otomatis setelah pengajuan disetujui.
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
                  <button type="button" onClick={() => setCancellingId(null)} className="flex-1 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider text-text-light dark:text-text-dark hover:bg-gray-150 dark:hover:bg-gray-800 transition-colors bg-gray-50 dark:bg-gray-800 border border-border-light dark:border-border-dark">Batal</button>
                  <motion.button whileTap={{ scale: 0.98 }} type="submit" disabled={cancelling || !cancelReason.trim() || (hasPayment && cancelRefundMethod === "transfer" && (!cancelRefundBankAccount.trim() || !cancelRefundProof.trim()))} className="flex-1 py-3.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 disabled:opacity-50 transition-all">
                    {cancelling ? <Loader2 className="w-5 h-5 animate-spin" /> : "Konfirmasi Batal"}
                  </motion.button>
                </div>
              </form>
            </>
          );
        })()}
      </BaseModal>


      {/* Modal QR Code Check-In */}
      <BaseModal
        isOpen={!!selectedQrRes}
        onClose={() => setSelectedQrRes(null)}
        showCloseButton={false}
        size="md"
        noPadding
      >
        {selectedQrRes && (() => {
          const parsed = getParsedNotes(selectedQrRes.notes);
          const clientName = parsed.atas_nama || "Pelanggan";
          const displayMejaList = parsed.meja_tambahan && parsed.meja_tambahan.length > 0 ? parsed.meja_tambahan.join(", ") : selectedQrRes.tables?.table_number;
          const qrData = selectedQrRes.qr_token || selectedQrRes.id;

          return (
            <>
              <div className="bg-primary p-6 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">QR Code Check-In</h2>
                  <p className="text-white/80 text-sm mt-1">Gunakan kode ini untuk check-in meja</p>
                </div>
                <button onClick={() => setSelectedQrRes(null)} title="Tutup" aria-label="Tutup" className="p-1 hover:bg-white/10 rounded-full text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 sm:p-8 space-y-6 text-center text-text-light dark:text-text-dark">
                {/* QR Code Image */}
                <div className="bg-white p-4 rounded-2xl inline-block shadow-md mx-auto">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`}
                    alt="Check-In QR Code"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
                
                {/* Token Label */}
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted uppercase tracking-wider">Kode Booking</p>
                  <p className="font-mono font-black text-primary text-base select-all">{qrData}</p>
                </div>

                {/* Instructions */}
                <div className="p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl text-sm border border-primary/20 text-left">
                  <p className="text-primary font-bold text-center leading-relaxed">
                    Tunjukkan QR Code ini kepada kasir saat kedatangan untuk melakukan check-in meja Anda secara instan.
                  </p>
                </div>

                {/* Details */}
                <div className="border-t border-border-light dark:border-border-dark pt-4 space-y-3 text-sm text-left">
                  <h4 className="font-bold text-muted uppercase text-xs tracking-wider mb-2">Detail Reservasi</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted font-medium">Atas Nama</p>
                      <p className="font-bold">{clientName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted font-medium">Tanggal</p>
                      <p className="font-semibold">{format(new Date(selectedQrRes.reservation_date), "dd MMM yyyy", { locale: localeId })}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted font-medium">Waktu</p>
                      <p className="font-semibold">{selectedQrRes.reservation_time?.substring(0, 5)} WIB</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted font-medium">Meja / Tamu</p>
                      <p className="font-bold text-primary">Meja {displayMejaList} ({selectedQrRes.guest_count} Tamu)</p>
                    </div>
                  </div>
                </div>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setSelectedQrRes(null)}
                  className="w-full py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-text-light dark:text-text-dark rounded-xl font-medium transition-all"
                >
                  Tutup
                </button>
              </div>
            </>
          );
        })()}
      </BaseModal>

      {/* Modal Peringatan Aturan Refund */}
      <BaseModal
        isOpen={showRefundWarning}
        onClose={() => { setShowRefundWarning(false); setRefundReservation(null); }}
        showCloseButton={false}
        size="md"
        noPadding
      >
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 text-white flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Aturan &amp; Ketentuan Refund</h2>
            <p className="text-white/80 text-sm">Mohon baca dengan teliti sebelum mengajukan</p>
          </div>
        </div>
        <div className="p-6 sm:p-8 space-y-4 text-text-light dark:text-text-dark">
          <p className="text-xs font-bold text-red-650 dark:text-red-400">
            Sebelum Anda melanjutkan pengisian data, mohon setujui ketentuan refund berikut:
          </p>
          <ul className="list-disc pl-5 space-y-2.5 text-xs sm:text-sm leading-relaxed">
            <li>Pastikan seluruh data yang Anda input sudah benar sebelum mengajukan refund.</li>
            <li>Periksa kembali nomor rekening atau akun DompetKu tujuan agar tidak terjadi kesalahan pencairan dana.</li>
            <li>Refund hanya dapat diproses sesuai metode pencairan yang dipilih dan data yang telah diverifikasi.</li>
            <li>Jika data tidak sesuai, resto berhak menolak pengajuan refund.</li>
            <li>Dengan menekan tombol “Lanjut Ajukan”, pelanggan menyatakan bahwa seluruh data yang diisi sudah benar dan dapat dipertanggungjawabkan.</li>
          </ul>
          <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
            <button 
              type="button" 
              onClick={() => { setShowRefundWarning(false); setRefundReservation(null); }} 
              className="flex-1 py-3 rounded-xl font-medium text-text-light dark:text-text-dark hover:bg-gray-150 dark:hover:bg-gray-800 transition-colors border border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800"
            >
              Batal
            </button>
            <motion.button 
              whileTap={{ scale: 0.98 }} 
              onClick={() => { setShowRefundWarning(false); setShowRefundForm(true); }}
              className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
            >
              Lanjut Ajukan
            </motion.button>
          </div>
        </div>
      </BaseModal>

      {/* Modal Form Pengajuan Refund */}
      <BaseModal
        isOpen={showRefundForm}
        onClose={() => { setShowRefundForm(false); setRefundReservation(null); }}
        showCloseButton={false}
        size="md"
        noPadding
      >
        {refundReservation && (() => {
          const parsed = getParsedNotes(refundReservation.notes);
          const name = parsed.atas_nama || "Pelanggan";
          const resNo = refundReservation.id.substring(0, 8).toUpperCase();
          const amount = refundReservation.payment_status === 'paid' ? (refundReservation.menu_total || 0) : (refundReservation.dp_amount || 0);

          return (
            <>
              <div className="bg-primary p-6 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">Form Pengajuan Refund</h2>
                  <p className="text-white/80 text-sm mt-1">Lengkapi data rekening/wallet pengembalian dana</p>
                </div>
                <button 
                  onClick={() => { setShowRefundForm(false); setRefundReservation(null); }} 
                  type="button" 
                  title="Tutup" 
                  aria-label="Tutup" 
                  className="p-1 hover:bg-white/10 rounded-full text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleRefundSubmit} className="p-6 sm:p-8 space-y-4 text-text-light dark:text-text-dark">
                {/* Field Detail */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted block font-medium uppercase text-[10px]">Nama Pelanggan</span>
                    <span className="font-bold text-sm">{name}</span>
                  </div>
                  <div>
                    <span className="text-muted block font-medium uppercase text-[10px]">Nomor Reservasi</span>
                    <span className="font-bold text-sm">#{resNo}</span>
                  </div>
                  <div className="col-span-2 p-3 bg-gray-50 dark:bg-gray-800/40 border border-border-light dark:border-border-dark rounded-xl">
                    <span className="text-muted block font-medium uppercase text-[10px]">Nominal Refund yang Diajukan</span>
                    <span className="font-black text-lg text-primary">Rp {amount.toLocaleString('id-ID')}</span>
                  </div>
                </div>

                {/* Alasan Refund */}
                <div>
                  <label htmlFor="refundReason" className="text-sm font-medium mb-1 block">Alasan Refund</label>
                  <textarea
                    id="refundReason"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Contoh: Pembatalan oleh resto, butuh ganti jadwal, dll..."
                    className="w-full px-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg focus:ring-2 focus:ring-slate-300 outline-none text-sm"
                    rows={2}
                    required
                  />
                </div>

                {/* Pilihan Metode */}
                <div className="space-y-2">
                  <label className="text-sm font-medium block">Metode Pengembalian Dana</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRefundMethod("transfer")}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                        refundMethod === "transfer"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border-light dark:border-border-dark hover:border-gray-300 text-muted"
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Transfer Bank</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefundMethod("dompetku")}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                        refundMethod === "dompetku"
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border-light dark:border-border-dark hover:border-gray-300 text-muted"
                      }`}
                    >
                      <Wallet className="w-4 h-4" />
                      <span>DompetKu</span>
                    </button>
                  </div>
                </div>

                {/* Input Dinamis berdasarkan metode */}
                {refundMethod === "dompetku" ? (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-border-light dark:border-border-dark space-y-2 text-xs">
                    {walletInfo && ["diterima", "selesai", "aktif"].includes(walletInfo.walletStatus) ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted">Nomor Akun DompetKu:</span>
                          <span className="font-black text-primary">{walletInfo.id || "-"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted">Status Akun:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 uppercase">Aktif</span>
                        </div>
                        <p className="text-[10px] text-muted italic mt-1 leading-relaxed">
                          * Dana refund akan otomatis dikreditkan secara instan setelah disetujui oleh admin.
                        </p>
                      </>
                    ) : (
                      <div className="space-y-2 text-center py-2">
                        <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                        <p className="font-bold text-red-500 text-xs">“Fitur DompetKu belum aktif pada akun Anda.”</p>
                        <p className="text-[10px] text-muted font-medium">“Silakan gunakan metode Transfer Bank.”</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-border-light dark:border-border-dark text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="refBank" className="text-[10px] font-bold text-muted uppercase block mb-1">Nama Bank</label>
                        <input
                          id="refBank"
                          type="text"
                          value={refundBankName}
                          onChange={(e) => setRefundBankName(e.target.value)}
                          placeholder="BCA, Mandiri, BNI..."
                          className="w-full px-3 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded focus:ring-1 focus:ring-primary outline-none"
                          required={refundMethod === "transfer"}
                        />
                      </div>
                      <div>
                        <label htmlFor="refAccountNo" className="text-[10px] font-bold text-muted uppercase block mb-1">Nomor Rekening</label>
                        <input
                          id="refAccountNo"
                          type="text"
                          value={refundAccountNumber}
                          onChange={(e) => setRefundAccountNumber(e.target.value)}
                          placeholder="Hanya angka..."
                          className="w-full px-3 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded focus:ring-1 focus:ring-primary outline-none"
                          required={refundMethod === "transfer"}
                        />
                      </div>
                      <div className="col-span-2">
                        <label htmlFor="refAccountName" className="text-[10px] font-bold text-muted uppercase block mb-1">Nama Pemilik Rekening</label>
                        <input
                          id="refAccountName"
                          type="text"
                          value={refundAccountName}
                          onChange={(e) => setRefundAccountName(e.target.value)}
                          placeholder="Nama lengkap di buku tabungan..."
                          className="w-full px-3 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded focus:ring-1 focus:ring-primary outline-none"
                          required={refundMethod === "transfer"}
                        />
                      </div>
                      <div className="col-span-2 grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor="refBranch" className="text-[10px] font-bold text-muted uppercase block mb-1">Cabang Bank (Opsional)</label>
                          <input
                            id="refBranch"
                            type="text"
                            value={refundBranch}
                            onChange={(e) => setRefundBranch(e.target.value)}
                            placeholder="KCU Yogyakarta..."
                            className="w-full px-3 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                        <div>
                          <label htmlFor="refNotes" className="text-[10px] font-bold text-muted uppercase block mb-1">Catatan Tambahan (Opsional)</label>
                          <input
                            id="refNotes"
                            type="text"
                            value={refundNotes}
                            onChange={(e) => setRefundNotes(e.target.value)}
                            placeholder="Tambahan keterangan..."
                            className="w-full px-3 py-2 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
                  <button 
                    type="button" 
                    onClick={() => { setShowRefundForm(false); setRefundReservation(null); }} 
                    className="flex-1 py-3 rounded-xl font-medium text-text-light dark:text-text-dark hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800"
                  >
                    Batal
                  </button>
                  <motion.button 
                    whileTap={{ scale: 0.98 }} 
                    type="submit"
                    disabled={refundSubmitting || (refundMethod === "dompetku" && (!walletInfo || !["diterima", "selesai", "aktif"].includes(walletInfo.walletStatus)))}
                    className="flex-1 py-3 bg-primary text-white rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {refundSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ajukan Refund"}
                  </motion.button>
                </div>
              </form>
            </>
          );
        })()}
      </BaseModal>

      {/* Modal Detail Transaksi */}
      <BaseModal
        isOpen={!!selectedDetailRes}
        onClose={() => setSelectedDetailRes(null)}
        showCloseButton={false}
        noPadding
        size="md"
      >
        {selectedDetailRes && (() => {
          const parsed = getParsedNotes(selectedDetailRes.notes);
          const mejaNumbers = parsed.meja_tambahan && parsed.meja_tambahan.length > 0 ? parsed.meja_tambahan.join(", ") : selectedDetailRes.tables?.table_number;
          const notesText = parsed.catatan;
          const hasPreOrder = selectedDetailRes.menu_total && selectedDetailRes.menu_total > 0;

          return (
            <>
              <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50 dark:bg-gray-850">
                <div>
                  <h3 className="font-bold text-lg text-text-light dark:text-text-dark">Detail Transaksi Reservasi</h3>
                  <p className="text-xs text-muted mt-0.5">#{selectedDetailRes.id}</p>
                </div>
                <button onClick={() => setSelectedDetailRes(null)} title="Tutup" aria-label="Tutup" className="text-muted hover:text-text-light"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-5 max-h-[600px] overflow-y-auto pr-1">
                {/* Status Badges Info */}
                <div className="flex flex-wrap gap-2 items-center p-4 bg-primary/5 dark:bg-primary/10 border border-primary/15 rounded-2xl">
                  <div className="w-full flex justify-between items-center text-xs font-bold text-text-light dark:text-text-dark border-b border-dashed border-primary/20 pb-2 mb-2">
                    <span>Status Reservasi:</span>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase border ${getStatusBadge(selectedDetailRes.status)}`}>
                      {getStatusText(selectedDetailRes.status)}
                    </span>
                  </div>
                  {selectedDetailRes.refund_status && (
                    <div className="w-full flex justify-between items-center text-xs font-bold text-text-light dark:text-text-dark">
                      <span>Status Pengembalian Dana (Refund):</span>
                      <span className={`text-[10px] px-2.5 py-1 rounded-full uppercase border ${
                        selectedDetailRes.refund_status === "waiting_review" || selectedDetailRes.refund_status === "pengajuan_refund" || selectedDetailRes.refund_status === "menunggu_peninjauan"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200"
                          : selectedDetailRes.refund_status === "menunggu_verifikasi"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-250"
                          : selectedDetailRes.refund_status === "disetujui" || selectedDetailRes.refund_status === "approved"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200"
                          : selectedDetailRes.refund_status === "ditolak" || selectedDetailRes.refund_status === "rejected"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200"
                          : selectedDetailRes.refund_status === "dana_dikirim"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200"
                          : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200"
                      }`}>
                        {getRefundStatusText(selectedDetailRes.refund_status)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Main details */}
                <div className="grid grid-cols-2 gap-4 text-xs font-bold text-text-light dark:text-text-dark bg-gray-50/50 dark:bg-gray-800/20 p-4 rounded-2xl border border-border-light dark:border-border-dark">
                  <div>
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Atas Nama Pemesan</span>
                    <p className="font-black text-sm text-text-light dark:text-text-dark mt-0.5">{parsed.atas_nama || "Pelanggan"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Nomor HP Kontak</span>
                    <p className="font-bold text-text-light dark:text-text-dark mt-0.5">{parsed.telepon || "-"}</p>
                  </div>
                  <div className="col-span-2 border-t border-border-light dark:border-border-dark pt-3 mt-1"></div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Tanggal Booking</span>
                    <p className="font-bold text-text-light dark:text-text-dark mt-0.5">{format(new Date(selectedDetailRes.reservation_date), "dd MMMM yyyy", { locale: localeId })}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Jam Booking</span>
                    <p className="font-bold text-text-light dark:text-text-dark mt-0.5">{selectedDetailRes.reservation_time.substring(0, 5)} WIB</p>
                  </div>
                  <div className="col-span-2 border-t border-border-light dark:border-border-dark pt-3 mt-1"></div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Nomor Meja</span>
                    <p className="font-black text-sm text-primary mt-0.5">Meja {mejaNumbers}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Jumlah Tamu</span>
                    <p className="font-bold text-text-light dark:text-text-dark mt-0.5">{selectedDetailRes.guest_count} Orang</p>
                  </div>
                </div>

                {/* Pre-Order Menu Items */}
                {hasPreOrder && (
                  <div className="space-y-2.5">
                    <span className="text-[10px] text-muted uppercase font-bold tracking-wider block">Daftar Pre-Order Menu</span>
                    <div className="bg-gray-50 dark:bg-gray-800/40 rounded-2xl p-4 border border-border-light dark:border-border-dark space-y-2">
                      {selectedDetailRes.menu_items && Array.isArray(selectedDetailRes.menu_items) && selectedDetailRes.menu_items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-xs text-text-light dark:text-text-dark">
                          <span>{item.name} <span className="text-xs text-muted">x{item.quantity}</span></span>
                          <span className="font-semibold">Rp {(item.price * item.quantity).toLocaleString("id-ID")}</span>
                        </div>
                      ))}
                      <div className="border-t border-dashed border-border-light dark:border-border-dark pt-2 mt-2 flex justify-between text-xs font-bold text-text-light dark:text-text-dark">
                        <span>Total Harga Menu:</span>
                        <span>Rp {selectedDetailRes.menu_total?.toLocaleString("id-ID")}</span>
                      </div>
                      {selectedDetailRes.payment_method === "dp" && (
                        <div className="flex justify-between text-xs text-primary font-bold">
                          <span>DP Dibayar ({selectedDetailRes.dp_percent || 0}%):</span>
                          <span>Rp {selectedDetailRes.dp_amount?.toLocaleString("id-ID")}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs text-muted font-bold">
                        <span>Sisa Pembayaran di Kasir:</span>
                        <span>Rp {selectedDetailRes.remaining_amount?.toLocaleString("id-ID")}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cancellation Details */}
                {selectedDetailRes.status === "cancelled" && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/20 border-2 border-red-200 dark:border-red-900 rounded-2xl text-xs space-y-2 text-text-light dark:text-text-dark">
                    <p className="font-black text-red-700 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Ban className="w-4 h-4 shrink-0" /> Informasi Pembatalan
                    </p>
                    <div className="grid grid-cols-2 gap-3 font-semibold mt-1">
                      <div>
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Pembatal Oleh</span>
                        <p className="mt-0.5 uppercase font-bold">
                          {parsed.dibatalkan_oleh === "kasir" ? "Kasir" : parsed.dibatalkan_oleh === "admin" ? "Resto/Admin" : "Pelanggan"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Waktu Pembatalan</span>
                        <p className="mt-0.5">
                          {selectedDetailRes.updated_at 
                            ? format(new Date(selectedDetailRes.updated_at), "dd MMM yyyy HH:mm", { locale: localeId }) + " WIB"
                            : "-"}
                        </p>
                      </div>
                    </div>
                    {(parsed.catatan_batal || parsed.catatan_tolak) && (
                      <div className="pt-2 border-t border-red-200/50 dark:border-red-900/30">
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Alasan Pembatalan / Penolakan</span>
                        <p className="mt-0.5 font-medium text-red-800 dark:text-red-400 leading-relaxed bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-red-200/50 dark:border-red-900/40">
                          {parsed.catatan_batal || parsed.catatan_tolak}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Refund Details */}
                {selectedDetailRes.refund_status && (
                  <div className="p-4 bg-blue-50/50 dark:bg-blue-950/10 border-2 border-blue-200 dark:border-blue-900 rounded-2xl text-xs space-y-3 text-text-light dark:text-text-dark">
                    <p className="font-black text-blue-800 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4 shrink-0" /> Detail Pengembalian Dana
                    </p>
                    <div className="grid grid-cols-2 gap-3 font-semibold">
                      <div>
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Metode Pencairan</span>
                        <p className="mt-0.5 uppercase font-bold text-primary flex items-center gap-1">
                          {selectedDetailRes.refund_method === "dompetku" ? <Wallet className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
                          {selectedDetailRes.refund_method === "dompetku" ? "DompetKu" : "Transfer Bank"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Nominal Refund</span>
                        <p className="mt-0.5 font-black text-sm text-primary">
                          Rp {Number(selectedDetailRes.refund_amount || selectedDetailRes.dp_amount || selectedDetailRes.menu_total).toLocaleString("id-ID")}
                        </p>
                      </div>
                      {selectedDetailRes.refund_method !== "dompetku" && selectedDetailRes.refund_bank_account && (
                        <div className="col-span-2 pt-2 border-t border-dashed border-blue-200/50 dark:border-blue-900/30">
                          <span className="text-[10px] text-muted uppercase tracking-wider block">Detail Rekening Tujuan</span>
                          <p className="mt-0.5 font-bold p-2 bg-white dark:bg-gray-900 rounded-lg border border-blue-200/50 dark:border-blue-900/40 font-mono tracking-tight leading-relaxed">
                            {selectedDetailRes.refund_bank_account}
                          </p>
                        </div>
                      )}
                    </div>

                    {selectedDetailRes.refund_reason && (
                      <div className="pt-2 border-t border-dashed border-blue-200/50 dark:border-blue-900/30">
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Alasan Pengajuan Refund</span>
                        <p className="mt-0.5 font-medium leading-relaxed">{selectedDetailRes.refund_reason}</p>
                      </div>
                    )}

                    {selectedDetailRes.refund_proof && (
                      <div className="pt-2 border-t border-dashed border-blue-200/50 dark:border-blue-900/30 space-y-1.5">
                        <span className="text-[10px] text-muted uppercase tracking-wider block">Bukti Transfer Refund</span>
                        <a href={selectedDetailRes.refund_proof} target="_blank" rel="noreferrer" className="block relative rounded-lg overflow-hidden border border-border-light dark:border-border-dark group">
                          <img src={selectedDetailRes.refund_proof} alt="Bukti Transfer" className="object-cover w-full h-32 rounded-lg" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                            <span className="text-white text-[10px] font-black uppercase tracking-wider">Perbesar Bukti</span>
                          </div>
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer close button */}
                <div className="pt-2 border-t border-border-light dark:border-border-dark">
                  <button 
                    type="button" 
                    onClick={() => setSelectedDetailRes(null)}
                    className="w-full py-3.5 bg-gray-100 dark:bg-gray-800 text-muted hover:bg-gray-200 dark:hover:bg-gray-750 font-bold rounded-xl text-center text-xs uppercase tracking-wider transition-all"
                  >
                    Tutup Detail
                  </button>
                </div>
              </div>
            </>
          );
        })()}
      </BaseModal>
    </div>
  );
}
