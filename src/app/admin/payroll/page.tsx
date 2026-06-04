"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BaseModal from "@/components/BaseModal";
import { 
  CreditCard, DollarSign, User, Users, CalendarDays, 
  Receipt, Download, CheckCircle2, AlertCircle, ChevronDown,
  Search, Banknote, Plus, Minus, Filter, Loader2, Wallet,
  ArrowLeft, History, TrendingUp, FileSpreadsheet, Edit3, X, Save, Clock,
  Shield, Calculator, XCircle, Calendar, Mail
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, startOfYear } from "date-fns";
import { id } from "date-fns/locale";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { downloadFile } from "@/utils/downloadHelper";

const BANK_BUMN = ["Bank BRI", "Bank BNI", "Bank Mandiri", "Bank BTN", "Bank BSI"];
const BANK_SWASTA = ["BCA", "CIMB Niaga", "Danamon", "Permata Bank", "Panin Bank", "OCBC NISP", "Maybank", "Bank Mega", "Bank Bukopin", "Bank Sinarmas", "Bank BTPN", "Bank Commonwealth", "Bank Jago", "SeaBank", "Allo Bank", "Blu BCA"];
const BANK_DAERAH = ["Bank Jateng", "BJB (Bank Jabar Banten)", "Bank DKI", "Bank Jatim", "Bank Sumut", "Bank Sumsel Babel", "Bank Aceh Syariah", "Bank Sulselbar", "Bank Sulut Go", "Bank Kaltimtara", "Bank NTB Syariah", "Bank BPD Bali", "Bank Maluku Malut", "Bank Papua", "Bank Kalbar", "Bank Kalteng", "Bank Sulteng", "Bank Sultra", "Bank Bengkulu", "Bank Jambi", "Bank Nagari", "Bank Lampung", "Bank NTT", "Bank Riau Kepri"];
const BANK_DIGITAL = ["Jenius", "Digibank", "Neo Bank", "Bank Raya", "Bank Saqu", "LINE Bank"];
const E_WALLETS = ["GoPay", "OVO", "DANA", "ShopeePay", "LinkAja", "Sakuku", "Kredivo", "Akulaku", "Flip", "iSaku", "TrueMoney"];

export default function AdvancedPayrollPage() {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Helper to map role into beautiful Indonesian Division Names
  const getDivision = (role: string) => {
    const r = role?.toLowerCase();
    if (r === 'admin') return 'Administrasi';
    if (r === 'cashier') return 'Kasir / Front Office';
    if (r === 'chef' || r === 'cook') return 'Kitchen / Dapur';
    if (r === 'waiter' || r === 'server') return 'Pelayanan / Service';
    return 'Operasional';
  };
  
  // Active Selected Modal Entities
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showKasbonModal, setShowKasbonModal] = useState(false);
  const [showFineModal, setShowFineModal] = useState(false);

  // Internal Input States for Rates Modal
  const [editDailyWage, setEditDailyWage] = useState("");
  const [editOvertimeRate, setEditOvertimeRate] = useState("");
  const [editMealAllow, setEditMealAllow] = useState("");
  const [editTransAllow, setEditTransAllow] = useState("");
  const [editFixedAllow, setEditFixedAllow] = useState("");

  // Internal Input States for Active Record Editing
  const [adjBonus, setAdjBonus] = useState("0");
  const [adjIncentive, setAdjIncentive] = useState("0");
  const [adjIncentiveNotes, setAdjIncentiveNotes] = useState("");
  const [adjOtherDeduct, setAdjOtherDeduct] = useState("0");
  const [adjOtherDeductNotes, setAdjOtherDeductNotes] = useState("");
  
  // MANUAL INCOME OVERRIDES
  const [adjBasic, setAdjBasic] = useState("0");
  const [adjOvertime, setAdjOvertime] = useState("0");
  const [adjMeal, setAdjMeal] = useState("0");
  const [adjTransport, setAdjTransport] = useState("0");
  const [adjFixed, setAdjFixed] = useState("0");

  // Forms for adding standalone Kasbon / Fine
  const [kasbonAmount, setKasbonAmount] = useState("");
  const [kasbonNotes, setKasbonNotes] = useState("");
  const [fineAmount, setFineAmount] = useState("");
  const [fineReason, setFineReason] = useState("Pelanggaran SOP");
  const [fineNotes, setFineNotes] = useState("");

  // Elite Payment Matrix Input States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payPref, setPayPref] = useState("tunai"); // tunai, bank, wallet, lain
  const [payBank, setPayBank] = useState("");
  const [payAccNum, setPayAccNum] = useState("");
  const [payAccHolder, setPayAccHolder] = useState("");
  const [payBranch, setPayBranch] = useState("");
  const [payWallet, setPayWallet] = useState("");
  const [payWalletNum, setPayWalletNum] = useState("");
  const [payOtherText, setPayOtherText] = useState("");

  // Universal Custom Confirmation Engine
  const [showUniversalConfirm, setShowUniversalConfirm] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<any>({ title: "", msg: "", onConfirm: () => {}, type: 'primary' });

  const triggerConfirm = (title: string, msg: string, type: 'danger' | 'primary', action: () => void) => {
     setConfirmConfig({ title, msg, onConfirm: action, type });
     setShowUniversalConfirm(true);
  };

  const supabase = createClient();
  const now = new Date();
  const months = eachMonthOfInterval({ start: startOfYear(now), end: new Date(now.getFullYear(), 11, 31) });

  const fetchData = async () => {
    setLoading(true);
    try {
      // 0. Load Entire Company Identity Config
      const { data: setts } = await supabase.from("restaurant_settings").select("*").single();
      if (setts) setCompanySettings(setts);
      
      const dynamicCutoff = setts?.cutoff_date || 27;
      const dynamicPayday = setts?.payday_date || 28;
      
      // --- SMART FUTURE DETECTION ---
      const nowTime = new Date();
      const isFutureBrowsing = new Date(selectedYear, selectedMonth - 1, 1) > new Date(nowTime.getFullYear(), nowTime.getMonth(), 1);

      // 1. Load Main Profiles
      const { data: emps, error: err1 } = await supabase
        .from("profiles")
        .select("*")
        .neq("role", "customer")
        .neq("role", "admin")
        .order("full_name");
      if (err1) throw err1;

      // Define current Period bounds (1st - Cutoff)
      const startDate = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0);
      const endDate = new Date(selectedYear, selectedMonth - 1, dynamicCutoff, 23, 59, 59);

      // 2. Fetch/Ensure Period Exists in DB
      const label = `${format(startDate, "MMMM yyyy", {locale: id})}`;
      const { data: periodsList } = await supabase.from("salary_periods").select("*").eq("period_month", selectedMonth).eq("period_year", selectedYear).order("created_at", {ascending:false}).limit(1);
      let period = periodsList?.[0] || null;
      if (!period) {
         const { data: newPeriod } = await supabase.from("salary_periods").insert({
            period_month: selectedMonth,
            period_year: selectedYear,
            period_label: label,
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            pay_date: new Date(selectedYear, selectedMonth - 1, dynamicPayday).toISOString()
         }).select().single();
         period = newPeriod;
      }

      // 3. BULK FETCH ALL SUPPORTING DATA IN ONE SHOT 
      const [
        { data: allAtt },
        { data: allRecords },
        { data: allKasbons },
        { data: allFines }
      ] = await Promise.all([
        supabase.from("attendance").select("profile_id, type, status, notes, late_minutes").gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
        supabase.from("salary_records").select("*").eq("period_id", period.id).order("updated_at", { ascending: false }),
        supabase.from("employee_kasbon").select("*").in("status", ["active", "partially_paid"]),
        supabase.from("employee_fines").select("*").eq("status", "active")
      ]);

      // 4. LOCAL ENRICHMENT (0% Extra Network Cost)
      const enriched = (emps || []).map((emp: any) => {
         const myAtt = (allAtt || []).filter((a: any) => a.profile_id === emp.id);
         
         // LOCAL COUNTS
         const daysPresent = myAtt.filter((a:any) => a.type === 'check_in' && a.status === 'approved').length;
         const daysIzin = myAtt.filter((a:any) => ['izin','sakit'].includes(a.type) && a.status === 'approved').length;
         const daysAlpha = myAtt.filter((a:any) => a.type === 'alpha').length;
         
         // LOCAL OVERTIME
         let totalOtSecs = 0;
         myAtt.filter((a:any) => a.type === 'check_out').forEach((log: any) => {
            if (log.notes?.startsWith("OVERTIME_LOG:")) {
               try { totalOtSecs += Number(JSON.parse(log.notes.replace("OVERTIME_LOG:", "")).seconds || 0); } catch(e) {}
            }
         });
         const finalOtHours = Number((totalOtSecs / 3600).toFixed(1));

         // LOCAL BALANCES
         const myKasbons = (allKasbons || []).filter((k:any) => k.profile_id === emp.id);
         const myFines = (allFines || []).filter((f:any) => f.profile_id === emp.id);
         const sumKasbon = myKasbons.reduce((sum, k) => sum + Number(k.remaining_amount), 0);
         const sumFines = myFines.reduce((sum, f) => sum + Number(f.amount), 0);

         // LOCAL RECORD CORRELATION
         const record = (allRecords || []).find((r: any) => r.profile_id === emp.id) || null;

         // LOCAL MATHEMATICAL ENGINE
         const dailyW = Number(emp.daily_salary || 0);
         const otRate = Number(emp.overtime_pay_per_hour || 0);
         const mAll = Number(emp.meal_allowance || 0);
         const tAll = Number(emp.transport_allowance || 0);
         const fAll = Number(emp.fixed_allowance || 0);

         // SMART PREDICTION ENGINE FOR ADVANCE PAY MODE
         // If future month and no attendance registered, assume full period for initial visualization
         let estDays = daysPresent;
         if (isFutureBrowsing && daysPresent === 0 && !record) {
            estDays = Number(dynamicCutoff);
         }

         const bSalary = estDays * dailyW;
         const oPay = finalOtHours * otRate;
         const mealTotal = estDays * mAll;
         const transTotal = estDays * tAll;

         // LOCAL LATENESS DEDUCTION ENGINE
         const totalLateMins = myAtt.reduce((sum: number, a: any) => sum + (Number(a.late_minutes) || 0), 0);
         const lateOccurrences = myAtt.filter((a: any) => a.type === 'check_in' && (Number(a.late_minutes) || 0) > 0).length;
         let lateDeduct = 0;
         
         // If admin turned ON auto deduction in settings
         if (companySettings?.auto_deduct_late_salary && totalLateMins > 0) {
            const dailyWage = Number(emp.daily_salary || 0);
            const minPerDay = Number(companySettings.minutes_per_working_day || 480); // 480 min = 8 hours industrial standard
            const payPerMin = dailyWage / minPerDay;
            lateDeduct = Math.round(totalLateMins * payPerMin);
         }

         // Check record for saved/legacy values if it was locked in the past
         const finalLateMinutes = record?.total_late_minutes !== undefined ? record.total_late_minutes : totalLateMins;
         const finalLateDeduct = record?.late_deduction !== undefined ? Number(record.late_deduction) : lateDeduct;
         const finalLateCount = record?.late_count !== undefined ? Number(record.late_count) : lateOccurrences;

         const dynamicBonus = record ? Number(record.bonus || 0) : 0;
         const dynamicIncentive = record ? Number(record.special_incentive || 0) : 0;
         const dynamicOtherDeduct = record ? Number(record.other_deduction || 0) : 0;
         const dynamicIncentiveNotes = record ? (record.incentive_notes || "") : "";
         const dynamicOtherDeductNotes = record ? (record.other_deduction_notes || "") : "";

         const gross = bSalary + oPay + mealTotal + transTotal + fAll + dynamicBonus + dynamicIncentive;
         const deducs = sumKasbon + sumFines + dynamicOtherDeduct + finalLateDeduct;
         const net = gross - deducs;

         return {
            ...emp,
            daysPresent, daysIzin, daysAlpha, finalOtHours,
            totalLateMins: finalLateMinutes,
            lateDeduct: finalLateDeduct,
            lateCount: finalLateCount,
            sumKasbon, sumFines,
            bSalary, oPay, mealTotal, transTotal, fAll,
            dynamicBonus, dynamicIncentive, dynamicOtherDeduct,
            dynamicIncentiveNotes, dynamicOtherDeductNotes,
            gross, deducs, net,
            currentRecord: record,
            activeKasbons: myKasbons,
            activeFines: myFines
         };
      });

      setEmployees(enriched);
    } catch (e: any) {
       console.error(e);
       toast.error("Pastikan SQL Upgrade telah dijalankan di Supabase!");
    } finally {
       setLoading(false);
    }
  };

   useEffect(() => {
     // FORCED DATABASE UNLOCK TRIGGER 
     fetch('/api/fix-rls').catch(e => console.error(e));
     fetchData(); 

     // REAL-TIME PAYROLL RADAR  (Sync dynamic counts instantly)
     const channel = supabase.channel('payroll_realtime_updates')
       .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => fetchData())
       .on('postgres_changes', { event: '*', schema: 'public', table: 'salary_records' }, () => fetchData())
       .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_kasbon' }, () => fetchData())
       .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_fines' }, () => fetchData())
       .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchData())
       .subscribe();

     return () => {
       supabase.removeChannel(channel);
     };
   }, [selectedMonth, selectedYear]);

  // --- HANDLERS ---

  const handleSaveRates = async () => {
    if (!selectedProfile) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.from("profiles").update({
         daily_salary: Number(editDailyWage),
         overtime_pay_per_hour: Number(editOvertimeRate),
         meal_allowance: Number(editMealAllow),
         transport_allowance: Number(editTransAllow),
         fixed_allowance: Number(editFixedAllow)
      }).eq("id", selectedProfile.id).select();
      
      console.log("UPDATE RESULT:", data);
      if (!data || data.length === 0) {
         throw new Error("Gagal memperbarui database! Izin (RLS) ditolak atau baris tidak ditemukan.");
      }
      if (error) throw error;
      toast.success("Pengaturan Tarif Gaji Diperbarui!");
      setShowRateModal(false);
      fetchData();
    } catch (e: any) { toast.error(e.message); } finally { setProcessing(false); }
  };

   const refreshActiveSelectedBalances = async (profileId: string) => {
      const { data: k } = await supabase.from("employee_kasbon").select("*").eq("profile_id", profileId).in("status", ["active", "partially_paid"]);
      const { data: f } = await supabase.from("employee_fines").select("*").eq("profile_id", profileId).eq("status", "active");
      const sk = (k || []).reduce((sum, cur) => sum + Number(cur.remaining_amount), 0);
      const sf = (f || []).reduce((sum, cur) => sum + Number(cur.amount), 0);
      setSelectedProfile((prev: any) => prev ? {
         ...prev,
         activeKasbons: k || [],
         activeFines: f || [],
         sumKasbon: sk,
         sumFines: sf,
         deducs: sk + sf
      } : null);
   };

   const handleAddStandaloneKasbon = async () => {
     if (!selectedProfile || !kasbonAmount || Number(kasbonAmount) <= 0) return toast.error("Masukkan nominal valid");
     setProcessing(true);
     try {
        const { error } = await supabase.from("employee_kasbon").insert({
           profile_id: selectedProfile.id,
           amount: Number(kasbonAmount),
           remaining_amount: Number(kasbonAmount),
           notes: kasbonNotes,
           status: 'active'
        });
        if (error) throw error;
        toast.success("Catatan Kasbon Berhasil Ditambahkan!");
        setShowKasbonModal(false);
        setKasbonAmount(""); setKasbonNotes("");
        await refreshActiveSelectedBalances(selectedProfile.id);
        fetchData();
     } catch (e:any) { toast.error(e.message); } finally { setProcessing(false); }
   };

   const handleDeleteKasbon = async (id: string) => {
      triggerConfirm(
         "Hapus Kasbon?", 
         "Apakah Anda yakin ingin menghapus catatan kasbon ini secara permanen? Saldo akan diperbarui seketika.",
         "danger",
         async () => {
            try {
               await supabase.from("employee_kasbon").delete().eq("id", id);
               toast.success("Kasbon berhasil dihapus!");
               await refreshActiveSelectedBalances(selectedProfile!.id);
               fetchData();
            } catch(e:any){ toast.error(e.message); }
         }
      );
   };

   const handleAddStandaloneFine = async () => {
     if (!selectedProfile || !fineAmount || Number(fineAmount) <= 0) return toast.error("Masukkan nominal valid");
     setProcessing(true);
     try {
        const { error } = await supabase.from("employee_fines").insert({
           profile_id: selectedProfile.id,
           amount: Number(fineAmount),
           reason: fineReason,
           notes: fineNotes,
           status: 'active'
        });
        if (error) throw error;
        toast.success("Catatan Denda Berhasil Diterbitkan!");
        setShowFineModal(false);
        setFineAmount(""); setFineNotes("");
        await refreshActiveSelectedBalances(selectedProfile.id);
        fetchData();
     } catch (e:any) { toast.error(e.message); } finally { setProcessing(false); }
   };

   const handleDeleteFine = async (id: string) => {
      triggerConfirm(
         "Hapus Denda?",
         "Apakah Anda yakin ingin menghapus denda ini? Tindakan ini akan mencabut potongan dari perhitungan bulan berjalan.",
         "danger",
         async () => {
            try {
               await supabase.from("employee_fines").delete().eq("id", id);
               toast.success("Catatan Denda dihapus!");
               await refreshActiveSelectedBalances(selectedProfile!.id);
               fetchData();
            } catch(e:any){ toast.error(e.message); }
         }
      );
   };

  const saveSalaryRecord = async (isTransferLock = false) => {
     if (!selectedProfile) return;
     setProcessing(true);
     try {
        // Get the active period ID again explicitly
                 const { data: periodsListSave } = await supabase.from("salary_periods").select("id").eq("period_month", selectedMonth).eq("period_year", selectedYear).order("created_at", {ascending:false}).limit(1);
         let period = periodsListSave?.[0] || null;
                 if (!period) {
            const startDate = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0);
            const endDate = new Date(selectedYear, selectedMonth - 1, companySettings?.cutoff_date || 27, 23, 59, 59);
            const label = `${format(startDate, "MMMM yyyy", {locale: id})}`;
            const { data: newPeriod, error: createErr } = await supabase.from("salary_periods").insert({
               period_month: selectedMonth,
               period_year: selectedYear,
               period_label: label,
               start_date: startDate.toISOString(),
               end_date: endDate.toISOString(),
               pay_date: new Date(selectedYear, selectedMonth - 1, companySettings?.payday_date || 28).toISOString()
            }).select("id").single();
            
            if (createErr) throw createErr;
            period = newPeriod;
         }
         if (!period) throw new Error("Gagal menginisialisasi ID Periode");

        const payload = {
           profile_id: selectedProfile.id,
           period_id: period.id,
           total_working_days: Number(companySettings?.cutoff_date || 27),
           days_present: selectedProfile.daysPresent,
           days_izin: selectedProfile.daysIzin,
           total_overtime_hours: selectedProfile.finalOtHours,
           
           daily_wage: Number(selectedProfile.daily_salary || 0),
           basic_salary: Number(adjBasic || 0),
           overtime_pay: Number(adjOvertime || 0),
           meal_allowance: Number(adjMeal || 0),
           transport_allowance: Number(adjTransport || 0),
           fixed_allowance: Number(adjFixed || 0),

           bonus: Number(adjBonus),
           special_incentive: Number(adjIncentive),
           incentive_notes: adjIncentiveNotes,

           kasbon_deduction: selectedProfile.sumKasbon,
           fine_deduction: selectedProfile.sumFines,
           late_deduction: selectedProfile.lateDeduct,
           total_late_minutes: selectedProfile.totalLateMins,
           late_count: Number(selectedProfile.lateCount || 0),
           other_deduction: Number(adjOtherDeduct),
           other_deduction_notes: adjOtherDeductNotes,

           gross_salary: Number(adjBasic || 0) + Number(adjOvertime || 0) + Number(adjMeal || 0) + Number(adjTransport || 0) + Number(adjFixed || 0) + Number(adjBonus) + Number(adjIncentive),
           total_deduction: selectedProfile.deducs + Number(adjOtherDeduct),
           net_salary: (Number(adjBasic || 0) + Number(adjOvertime || 0) + Number(adjMeal || 0) + Number(adjTransport || 0) + Number(adjFixed || 0) + Number(adjBonus) + Number(adjIncentive)) - (selectedProfile.deducs + Number(adjOtherDeduct)),
           
                       updated_at: new Date().toISOString(),
            ...(isTransferLock ? {
               is_transferred: true,
               transferred_at: new Date().toISOString(),
               is_locked: true,
               locked_at: new Date().toISOString()
            } : {})
        };

                 // Force Real-time lookup to defeat collision duplicates!
         const { data: existingRec } = await supabase.from("salary_records").select("id").eq("profile_id", selectedProfile.id).eq("period_id", period.id).order("created_at", {ascending:false}).limit(1).maybeSingle();
         let resErr;
        if (existingRec) {
           const { error } = await supabase.from("salary_records").update(payload).eq("id", existingRec.id);
           resErr = error;
        } else {
           const { error } = await supabase.from("salary_records").insert(payload);
           resErr = error;
        }

        if (resErr) throw resErr;

        if (isTransferLock) {
           // Mark transfer completed & lock period
           const finalNet = getComputedNetLive();
           /* await supabase.from("salary_records").update({
              is_transferred: true,
              transferred_at: new Date().toISOString(),
              is_locked: true,
              locked_at: new Date().toISOString()
           }).eq("profile_id", selectedProfile.id).eq("period_id", period.id); */

           // DEDUCT KASBON & FINES
           if (selectedProfile.activeKasbons.length > 0) {
             for (const k of selectedProfile.activeKasbons) {
               await supabase.from("employee_kasbon").update({ status: 'paid', remaining_amount: 0 }).eq("id", k.id);
             }
           }
           if (selectedProfile.activeFines.length > 0) {
             for (const f of selectedProfile.activeFines) {
               await supabase.from("employee_fines").update({ status: 'deducted', deducted_period_id: period.id }).eq("id", f.id);
             }
           }
           
           // AUTO WHATSAPP SEND TRIGGER WITH PDF ATTACHMENT
           if (selectedProfile.phone) {
             try {
               const monthName = format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy", {locale: id});
               const cleanPhone = String(selectedProfile.phone).startsWith("0") ? "62" + String(selectedProfile.phone).slice(1) : String(selectedProfile.phone);
               const msg = `Halo *${selectedProfile.full_name}*,\n\nGaji Anda periode *${monthName}* telah berhasil ditransfer!\n\n*Ringkasan:*\nGaji Bersih: *Rp ${finalNet.toLocaleString('id-ID')}*\nTanggal: ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\nBerikut kami lampirkan dokumen Slip Gaji PDF Anda bulan ini. Mohon periksa juga email Anda (${selectedProfile.email || 'yang terdaftar'}) sebagai salinan (copy) resmi.\n\nTerima kasih atas kerja keras Anda!`;
               
               // Generate PDF blob
               const doc = await generatePayslipDoc(selectedProfile);
               const pdfBlob = doc.output('blob');
               const pdfFile = new File([pdfBlob], `Slip_Gaji_${selectedProfile.full_name.replace(/\s+/g, '_')}_${monthName}.pdf`, { type: 'application/pdf' });

               const fData = new FormData(); 
               fData.append('target', cleanPhone); 
               fData.append('message', msg);
               fData.append('file', pdfFile);
               
               fetch('https://api.fonnte.com/send', { 
                 method: 'POST', 
                 headers: { 'Authorization': 'CpJ7L8M8TfwCVy2k2m6C' }, // FormData does NOT need Content-Type, fetch sets it automatically with boundary
                 body: fData 
               }).catch(e => {});
             } catch(e){}
           }

           // SEND EMAIL INSTANTLY
           if (selectedProfile.email) {
              handleSendEmailSlip(selectedProfile, false).catch(e => console.error(e));
           }

           toast.success("Gaji Terkunci & Berhasil Ditransfer!");
        } else {
           toast.success("Draf Perhitungan Disimpan!");
        }
        
        setShowDetailModal(false);
        fetchData();
     } catch (e: any) { toast.error(e.message); } finally { setProcessing(false); }
  };

  // --- UI HELPERS ---
  const openDetail = (emp: any) => {
     setSelectedProfile(emp);
     const r = emp.currentRecord;
     
     // Seed income editable fields with existing record values OR fallback calculated logic
     setAdjBasic(String(r?.basic_salary ?? emp.bSalary ?? "0"));
     setAdjOvertime(String(r?.overtime_pay ?? emp.oPay ?? "0"));
     setAdjMeal(String(r?.meal_allowance ?? emp.mealTotal ?? "0"));
     setAdjTransport(String(r?.transport_allowance ?? emp.transTotal ?? "0"));
     setAdjFixed(String(r?.fixed_allowance ?? emp.fAll ?? "0"));

     setAdjBonus(String(r?.bonus || "0"));
     setAdjIncentive(String(r?.special_incentive || "0"));
     setAdjIncentiveNotes(r?.incentive_notes || "");
     setAdjOtherDeduct(String(r?.other_deduction || "0"));
     setAdjOtherDeductNotes(r?.other_deduction_notes || "");
     setShowDetailModal(true);
  };

  const openRates = (emp: any) => {
     setSelectedProfile(emp);
     setEditDailyWage(String(emp.daily_salary || 0));
     setEditOvertimeRate(String(emp.overtime_pay_per_hour || 0));
     setEditMealAllow(String(emp.meal_allowance || 0));
     setEditTransAllow(String(emp.transport_allowance || 0));
     setEditFixedAllow(String(emp.fixed_allowance || 0));
     setShowRateModal(true);
  };

  const getDaysToPayday = () => {
    const payday = new Date(new Date().getFullYear(), new Date().getMonth(), companySettings?.payday_date || 28);
    const diff = payday.getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

   const getComputedNetLive = () => {
      if (!selectedProfile) return 0;
      // Calculate dynamically based on live manual overrides
      const curGross = Number(adjBasic || 0) + 
                      Number(adjOvertime || 0) + 
                      Number(adjMeal || 0) + 
                      Number(adjTransport || 0) + 
                      Number(adjFixed || 0) + 
                      Number(adjBonus || 0) + 
                      Number(adjIncentive || 0);
      const curDeduct = selectedProfile.deducs + Number(adjOtherDeduct || 0);
      return curGross - curDeduct;
   };

   const openPaymentSettings = (emp: any) => {
      setPayPref(emp.payment_method_preference || "tunai");
      setPayBank(emp.bank_name || "");
      setPayAccNum(emp.bank_account_number || "");
      setPayAccHolder(emp.bank_account_holder || "");
      setPayBranch(emp.bank_branch || "");
      setPayWallet(emp.e_wallet_name || "");
      setPayWalletNum(emp.e_wallet_number || "");
      setPayOtherText(emp.bank_name && !["bank","wallet","tunai"].includes(emp.payment_method_preference) ? emp.bank_name : "");
      setShowPaymentModal(true);
   };

   const handleSavePaymentMethod = async () => {
      if(!selectedProfile) return;
      setProcessing(true);
      try {
         let finalBankName = "";
         if(payPref === "bank") finalBankName = payBank;
         else if(payPref === "wallet") finalBankName = payWallet;
         else if(payPref === "lain") finalBankName = payOtherText;

         const { error } = await supabase.from("profiles").update({
            payment_method_preference: payPref,
            bank_name: finalBankName,
            bank_account_number: payPref === "wallet" ? payWalletNum : payAccNum,
            bank_account_holder: payAccHolder,
            bank_branch: payBranch,
            e_wallet_name: payPref === "wallet" ? payWallet : null,
            e_wallet_number: payPref === "wallet" ? payWalletNum : null
         }).eq("id", selectedProfile.id);

         if (error) throw error;
         toast.success("Metode Pembayaran Diperbarui!");
         setShowPaymentModal(false);
         
         // Refresh details locally instantly so UI reflects
         const updatedEmp = { ...selectedProfile, payment_method_preference: payPref, bank_name: finalBankName, bank_account_number: payPref === "wallet" ? payWalletNum : payAccNum, bank_account_holder: payAccHolder, bank_branch: payBranch };
         setSelectedProfile(updatedEmp);
         
         fetchData();
      } catch (e:any) { toast.error(e.message); } finally { setProcessing(false); }
   };

    // Reusable Helper: Convert Numbers to Indonesian Word Form
    const toTerbilang = (n: number): string => {
      const words = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
      let result = "";
      const val = Math.floor(Math.abs(n));
      if (val === 0) return "Nol";
      
      const generate = (a: number): string => {
        if (a < 12) return words[a];
        if (a < 20) return generate(a - 10) + " Belas";
        if (a < 100) return words[Math.floor(a / 10)] + " Puluh " + generate(a % 10);
        if (a < 200) return "Seratus " + generate(a - 100);
        if (a < 1000) return words[Math.floor(a / 100)] + " Ratus " + generate(a % 100);
        if (a < 2000) return "Seribu " + generate(a - 1000);
        if (a < 1000000) return generate(Math.floor(a / 1000)) + " Ribu " + generate(a % 1000);
        if (a < 1000000000) return generate(Math.floor(a / 1000000)) + " Juta " + generate(a % 1000000);
        return generate(Math.floor(a / 1000000000)) + " Miliar " + generate(a % 1000000000);
      };
      
      result = generate(val).replace(/\s+/g, ' ').trim() + " Rupiah";
      return result.charAt(0).toUpperCase() + result.slice(1);
    };

    const generatePayslipDoc = async (emp: any) => {
       const r = emp.currentRecord;
       const isFinal = !!r;
       const d = {
          name: emp.full_name,
          id: emp.employee_id || "-",
          divisi: getDivision(emp.role),
          period: format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy", {locale: id}),
          isAdvance: r?.transferred_at && new Date(r.transferred_at) < new Date(selectedYear, selectedMonth - 1, 1),
          transferredDateStr: r?.transferred_at ? format(new Date(r.transferred_at), "d MMM yyyy", {locale: id}) : "",
          
          pokok: isFinal ? Number(r.basic_salary || 0) : emp.bSalary,
          lembur: isFinal ? Number(r.overtime_pay || 0) : emp.oPay,
          makan: isFinal ? Number(r.meal_allowance || 0) : emp.mealTotal,
          trans: isFinal ? Number(r.transport_allowance || 0) : emp.transTotal,
          tetap: isFinal ? Number(r.fixed_allowance || 0) : emp.fAll,
          bonus: isFinal ? Number(r.bonus || 0) : emp.dynamicBonus,
          insentif: isFinal ? Number(r.special_incentive || 0) : emp.dynamicIncentive,
          
          kasbon: isFinal ? Number(r.kasbon_deduction || 0) : emp.sumKasbon,
          denda: isFinal ? Number(r.fine_deduction || 0) : emp.sumFines,
          dendaTelat: isFinal ? Number(r.late_deduction || 0) : emp.lateDeduct,
          potLain: isFinal ? Number(r.other_deduction || 0) : emp.dynamicOtherDeduct,
          insentifNotes: isFinal ? (r.incentive_notes || "") : (emp.dynamicIncentiveNotes || ""),
          potLainNotes: isFinal ? (r.other_deduction_notes || "") : (emp.dynamicOtherDeductNotes || ""),
          
          net: isFinal ? Number(r.net_salary || 0) : emp.net,
          
          daysPresent: emp.daysPresent || 0,
          daysIzin: emp.daysIzin || 0,
          daysAlpha: emp.daysAlpha || 0,
          finalOt: emp.finalOtHours || 0,
          totalLateMins: isFinal ? Number(r.total_late_minutes || 0) : (emp.totalLateMins || 0),
          lateCount: isFinal ? Number(r.late_count || 0) : (emp.lateCount || 0),
          avatar: emp.avatar_url
       };

       const earnList = [
          ["Gaji Pokok", d.pokok],
          ["Lembur", d.lembur],
          ["Tunjangan Uang Makan", d.makan],
          ["Tunjangan Transport", d.trans],
          ["Tunjangan Jabatan", d.tetap],
          ["Bonus Kinerja", d.bonus],
          [`Insentif Khusus ${d.insentifNotes ? '('+d.insentifNotes+')' : ''}`, d.insentif]
       ].filter(i => i[0].includes("Bonus Kinerja") || i[0].includes("Insentif Khusus") || i[1] > 0); 
       if (earnList.length === 0) earnList.push(["Gaji Pokok", d.pokok]);

       const dedList = [
          ["Potongan Kasbon", d.kasbon],
          ["Akumulasi Denda", d.denda],
          [`Denda Terlambat (${d.totalLateMins}m)`, d.dendaTelat],
          [`Potongan Lainnya ${d.potLainNotes ? '('+d.potLainNotes+')' : ''}`, d.potLain]
       ].filter(i => i[0].includes("Potongan Lainnya") || i[1] > 0);
       if (dedList.length === 0) dedList.push(["Tidak ada potongan", 0]);

       const earnTotal = d.pokok + d.lembur + d.makan + d.trans + d.tetap + d.bonus + d.insentif;
       const dedTotal = d.kasbon + d.denda + d.dendaTelat + d.potLain;

       const doc = new jsPDF();
       const currency = (n: number) => n.toLocaleString('id-ID');

       // OUTER FRAME BORDER
       doc.setDrawColor(0, 0, 0);
       doc.setLineWidth(0.5);
       doc.rect(10, 10, 190, 260); // The main frame bounds (Expanded for footer & sign)

       // 1. TOP LEFT: COMPANY BRANDING
       const currentLogo = companySettings?.logo_url;
       if (currentLogo) {
          try {
             const img = new Image();
             img.crossOrigin = "Anonymous";
             img.src = currentLogo;
             await new Promise((resolve, reject) => {
               img.onload = resolve;
               img.onerror = reject;
             });
             // Dynamic aspect ratio or scaled fit
             doc.addImage(img, 'PNG', 15, 15, 25, 25);
          } catch (err) {
             doc.setFillColor(235, 235, 235);
             doc.rect(15, 15, 25, 25, 'F');
             doc.setTextColor(220, 38, 38);
             doc.setFontSize(7);
             doc.text("Logo", 27.5, 30, { align: "center" });
          }
       } else {
          //  PERFECT VISUAL SIMULATION OF YOUR RESTOBOOK LOGO (AUTOMATIC DEFAULT!)
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          
          // Draw 'Resto' in Navy Blue
          doc.setTextColor(30, 58, 95); 
          doc.text("Resto", 15, 28);
          
          // Measure width of 'Resto' dynamically to append 'Book' right next to it
          const restoWidth = doc.getTextWidth("Resto");
          
          // Draw 'Book' in Vibrant Orange
          doc.setTextColor(249, 115, 22); 
          doc.text("Book", 15 + restoWidth, 28);
       }

       // DYNAMIC COMPANY INFO
       const compName = companySettings?.name || "RESTOBOOK SYSTEM";
       const compAddr = companySettings?.address || "-";
       const compPhone = companySettings?.phone || "";

       doc.setTextColor(0, 0, 0);
       doc.setFont("helvetica", "bold");
       doc.setFontSize(9.5);
       // Enforce max-width to prevent long name overlap
       const splitName = doc.splitTextToSize(compName, 55);
       doc.text(splitName, 15, 48);
       
       doc.setFont("helvetica", "normal");
       doc.setFontSize(8);
       
       // Calculate start position based on how many lines the Name took
       const nameHeight = splitName.length * 4.5; 
       const addrStartY = 48 + nameHeight;
       
       // Dynamically split long address text at 55mm width limit
       const splitAddr = doc.splitTextToSize(compAddr, 55);
       doc.text(splitAddr, 15, addrStartY);
       
       // Calculate dynamic gap based on address line count
       const addrHeight = splitAddr.length * 4;
       if(compPhone) doc.text("Phone: " + compPhone, 15, addrStartY + addrHeight);

       // 2. TOP RIGHT: HEADER TITLE
       doc.setFont("helvetica", "bold");
       doc.setFontSize(28);
       doc.text("Slip Gaji", 195, 25, { align: "right" });

       // 2.5 EMPLOYEE PHOTO (MIDDLE COLUMN)
       const photoX = 75;
       const photoY = 35;
       const photoW = 20;
       const photoH = 25;

       if (d.avatar) {
          try {
             const userImg = new Image();
             userImg.crossOrigin = "Anonymous";
             userImg.src = d.avatar;
             await new Promise((res, rej) => {
                userImg.onload = res;
                userImg.onerror = rej;
             });
             // Apply light frame
             doc.setDrawColor(200, 200, 200);
             doc.setLineWidth(0.2);
             doc.rect(photoX, photoY, photoW, photoH);
             doc.addImage(userImg, 'JPEG', photoX + 0.5, photoY + 0.5, photoW - 1, photoH - 1);
          } catch (err) {
             // Silent fail fallback frame
             doc.setDrawColor(220, 220, 220);
             doc.rect(photoX, photoY, photoW, photoH);
          }
       } else {
          // Gray silhouette placeholder
          doc.setFillColor(245, 245, 245);
          doc.setDrawColor(220, 220, 220);
          doc.rect(photoX, photoY, photoW, photoH, 'FD');
          doc.setFontSize(6);
          doc.setTextColor(150, 150, 150);
          doc.text("Foto", photoX + (photoW/2), photoY + (photoH/2), { align: "center" });
          doc.setTextColor(0, 0, 0);
       }

       // Advance Payment Sticky Note Banner
       if (d.isAdvance) {
          doc.setFillColor(254, 242, 242);
          doc.rect(100, 37, 95, 6, 'F');
          doc.setTextColor(220, 38, 38);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.text(`* GAJI INI TELAH DIAMBIL LEBIH AWAL PADA TGL ${d.transferredDateStr}`, 193, 41, { align: "right" });
          doc.setTextColor(0, 0, 0);
       }

       // 3. HEADER DETAILS TABLE (Right Aligned Structure)
       doc.setFontSize(8.5);
       doc.setFont("helvetica", "normal");
       
       let infoY = 48;
       doc.text("Nama / NIK", 100, infoY);
       doc.text(`${d.name} (${d.id})`, 195, infoY, { align: "right" });
       
       infoY += 5;
       doc.text("Dept / Jabatan", 100, infoY);
       doc.text(d.divisi, 195, infoY, { align: "right" });

       infoY += 5;
       doc.text("Tgl Cetak", 100, infoY);
       doc.text(format(new Date(), "dd/MM/yyyy"), 150, infoY, { align: "right" });
       doc.text("Periode Gaji", 160, infoY);
       doc.setFont("helvetica", "bold");
       doc.text(d.period, 195, infoY, { align: "right" });

       // 4. PENDAPATAN & POTONGAN DUAL-TABLE HEADERS
       let tableY = 65;
       doc.setFillColor(220, 220, 220); // Gray shading
       doc.rect(10, tableY, 190, 7, 'F');
       
       doc.setFont("helvetica", "bold");
       doc.setFontSize(10);
       doc.setTextColor(0, 0, 0);
       doc.text("Pendapatan", 12, tableY + 5);
       doc.text("Potongan", 107, tableY + 5);

       // 5. POPULATE DUAL LISTS
       doc.setFont("helvetica", "normal");
       doc.setFontSize(9.5);
       let listY = tableY + 13;
       const maxLines = Math.max(earnList.length, dedList.length, 5); // Minimum 5 lines spacing

       for(let i = 0; i < maxLines; i++) {
          // Left: Earn
          if(earnList[i]) {
             doc.text(earnList[i][0] as string, 12, listY);
             doc.text(currency(earnList[i][1] as number), 100, listY, { align: "right" });
          }
          
          // Right: Ded
          if(dedList[i]) {
             doc.text(dedList[i][0] as string, 107, listY);
             doc.text(currency(dedList[i][1] as number), 195, listY, { align: "right" });
          }
          listY += 7;
       }

       // 6. TOTALS FOOTER STRIP
       listY = Math.max(listY, tableY + 45); // Ensure it drops down enough to look consistent
       doc.setDrawColor(0,0,0);
       doc.line(10, listY - 4, 200, listY - 4); // Top border line for totals
       
       doc.setFont("helvetica", "bold");
       doc.text("Total Pendapatan", 12, listY + 2);
       doc.text(currency(earnTotal), 100, listY + 2, { align: "right" });

       doc.text("Total Potongan", 107, listY + 2);
       doc.text(currency(dedTotal), 195, listY + 2, { align: "right" });
       
       doc.line(10, listY + 6, 200, listY + 6); // Bottom border line for totals

       // 7. RANGKUMAN KEHADIRAN
       let attY = listY + 12;
       doc.setFillColor(220, 220, 220);
       doc.rect(10, attY, 190, 7, 'F');
       
       doc.setFont("helvetica", "bold");
       doc.text("Rangkuman Informasi Kehadiran", 12, attY + 5);

       doc.setFont("helvetica", "normal");
       doc.setFontSize(9);
       let rowY = attY + 13;
       
       // Left Att
       doc.text("Kehadiran", 12, rowY);
       doc.text(`${d.daysPresent} Hari`, 100, rowY, { align: "right" });
       
       doc.text("Lembur", 107, rowY);
       doc.text(`${d.finalOt} Jam`, 195, rowY, { align: "right" });
       
       rowY += 6;
       doc.text("Ketidakhadiran / Alpha", 12, rowY);
       doc.text(`${d.daysAlpha} Hari`, 100, rowY, { align: "right" });
       
       doc.text("Total Terlambat", 107, rowY);
       doc.text(`${d.totalLateMins} Menit`, 195, rowY, { align: "right" });
       
       rowY += 6;
       doc.text("Izin / Sakit", 12, rowY);
       doc.text(`${d.daysIzin} Hari`, 100, rowY, { align: "right" });
       
       doc.text("Terlambat Masuk", 107, rowY);
       doc.text(`${d.lateCount} Kali`, 195, rowY, { align: "right" });
       
       // 8. FINAL TAKE HOME PAY AT THE VERY BOTTOM FRAME
       let finalY = Math.max(rowY + 15, 200); // Auto drop to fit content
       doc.setFillColor(240, 240, 240);
       doc.rect(10, finalY, 190, 10, 'F');
       doc.setFontSize(12);
       doc.setFont("helvetica", "bold");
       doc.text("PENGHASILAN BERSIH (TAKE HOME PAY)", 15, finalY + 7);
       doc.text("Rp " + currency(d.net), 195, finalY + 7, { align: "right" });

       // 9. TERBILANG ROW
       doc.setFont("helvetica", "italic");
       doc.setFontSize(8.5);
       doc.setTextColor(50, 50, 50);
       doc.text("Terbilang: " + toTerbilang(d.net), 15, finalY + 15);
       
       doc.setTextColor(0, 0, 0);
       doc.setFont("helvetica", "normal");
       
       // 10. DUAL SIGNATURE ENDORSEMENT BLOCK
       let signY = finalY + 30;
       const signCity = (() => {
           let s = "Surabaya";
           if (compAddr && compAddr !== "-") {
              const p = compAddr.split(',');
              const c = p[p.length - 1].replace(/\d+/g, '').trim();
              if (c.length > 2) s = c;
           }
           return s;
        })();

       doc.setFontSize(9);
       // Top Date line 
       doc.text(`${signCity}, ${format(new Date(), "d MMMM yyyy", {locale: id})}`, 195, signY, { align: "right" });
       
       signY += 6;
       // LEFT: Karyawan (Diterima Oleh)
       doc.setFont("helvetica", "bold");
       doc.text("Diterima Oleh,", 15, signY);
       
       // RIGHT: Admin
       doc.text("Diserahkan Oleh,", 195, signY, { align: "right" });
       
       signY += 25; // Signature whitespace
       
       // LEFT: Signature Name & Divisi
       doc.text(d.name, 15, signY);
       doc.setFont("helvetica", "normal");
       doc.setFontSize(8);
       doc.text(d.divisi, 15, signY + 4);
       
       // RIGHT: Manager Line
       doc.setFont("helvetica", "bold");
       doc.setFontSize(9);
       doc.text("(____________________)", 195, signY, { align: "right" });
       doc.setFont("helvetica", "normal");
       doc.setFontSize(8);
       doc.text("Manajer Operasional / HR", 195, signY + 4, { align: "right" });

       return doc;
    };

    const handleDownloadSlip = async (emp: any) => {
       try {
          const doc = await generatePayslipDoc(emp);
          const pdfBase64 = doc.output('datauristring');
          await downloadFile({
            dataBase64: pdfBase64,
            filename: `Slip_Gaji_${emp.full_name.replace(/\s+/g, '_')}_Format_Resmi.pdf`,
            mimeType: 'application/pdf'
          });
          toast.success("Slip Gaji Format Resmi berhasil diunduh!");
       } catch (err) {
          toast.error("Gagal membuat Slip Gaji PDF");
       }
    };

    const handleSendEmailSlip = async (emp: any, showToast = true) => {
       if (!emp.email) {
          if (showToast) toast.error(`Karyawan ${emp.full_name} tidak memiliki email`);
          return false;
       }
       const tId = showToast ? toast.loading(`Mengirim slip gaji ke ${emp.email}...`) : null;
       try {
          const doc = await generatePayslipDoc(emp);
          const pdfBase64 = doc.output('datauristring');
          const monthStr = format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy", {locale: id});

          const res = await fetch('/api/admin/send-payslip', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                email: emp.email,
                name: emp.full_name,
                month: monthStr,
                pdfBase64
             })
          });

          if (!res.ok) throw new Error("Gagal kirim email");
          if (tId) toast.success(`Slip gaji berhasil dikirim ke email ${emp.full_name}`, { id: tId });
          return true;
       } catch (err) {
          if (tId) toast.error(`Gagal kirim ke email ${emp.email}`, { id: tId });
          return false;
       }
    };

    const handleBulkSendEmailSlip = async () => {
       const paidEmps = employees.filter(e => e.currentRecord?.is_transferred && e.email);
       if (paidEmps.length === 0) {
          return toast.error("Tidak ada karyawan yang sudah ditransfer dan memiliki email.");
       }
       
       triggerConfirm(
          "Kirim Slip Gaji Masal?", 
          `Sistem akan mengirimkan slip gaji via email ke ${paidEmps.length} karyawan yang gajinya sudah ditransfer.`,
          "primary",
          async () => {
             const tId = toast.loading(`Mengirim ke ${paidEmps.length} karyawan...`);
             let success = 0;
             for (const emp of paidEmps) {
                const res = await handleSendEmailSlip(emp, false);
                if (res) success++;
             }
             toast.success(`Berhasil mengirim slip gaji ke ${success} dari ${paidEmps.length} karyawan.`, { id: tId });
          }
       );
    };

   const handleExportExcel = () => {
      const exportData = employees.map((emp, idx) => {
         const r = emp.currentRecord;
         const isFinal = !!r;
         
         const pokok = isFinal ? Number(r.basic_salary || 0) : emp.bSalary;
         const lemburRp = isFinal ? Number(r.overtime_pay || 0) : emp.oPay;
         const makan = isFinal ? Number(r.meal_allowance || 0) : emp.mealTotal;
         const trans = isFinal ? Number(r.transport_allowance || 0) : emp.transTotal;
         const jabatan = isFinal ? Number(r.fixed_allowance || 0) : emp.fAll;
         const bonus = isFinal ? Number(r.bonus || 0) : emp.dynamicBonus;
         const insentif = isFinal ? Number(r.special_incentive || 0) : emp.dynamicIncentive;
         const insNotes = isFinal ? (r.incentive_notes || "") : (emp.dynamicIncentiveNotes || "");
         
         const kasbon = isFinal ? Number(r.kasbon_deduction || 0) : emp.sumKasbon;
         const denda = isFinal ? Number(r.fine_deduction || 0) : emp.sumFines;
         const dendaTelat = isFinal ? Number(r.late_deduction || 0) : emp.lateDeduct;
         const potLain = isFinal ? Number(r.other_deduction || 0) : emp.dynamicOtherDeduct;
         const potNotes = isFinal ? (r.other_deduction_notes || "") : (emp.dynamicOtherDeductNotes || "");
         
         const bruto = pokok + lemburRp + makan + trans + jabatan + bonus + insentif;
         const totPot = kasbon + denda + dendaTelat + potLain;
         const net = isFinal ? Number(r.net_salary || 0) : emp.net;

         return {
            no: idx+1, 
            id: emp.employee_id || "-", 
            nama: emp.full_name, 
            divisi: getDivision(emp.role),
            periode: format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy", {locale: id}),
            hadir: emp.daysPresent, 
            lemburJam: emp.finalOtHours,
            pokok, lemburRp, makan, trans, jabatan, bonus, insentif, insNotes, bruto,
            kasbon, denda, dendaTelat, potLain, potNotes, totPot, net,
            status: r?.is_transferred ? "LUNAS" : "MENUNGGU"
         };
      });

      const sP = exportData.reduce((a,b)=>a+b.pokok, 0);
      const sL = exportData.reduce((a,b)=>a+b.lemburRp, 0);
      const sM = exportData.reduce((a,b)=>a+b.makan, 0);
      const sTr = exportData.reduce((a,b)=>a+b.trans, 0);
      const sJ = exportData.reduce((a,b)=>a+b.jabatan, 0);
      const sB = exportData.reduce((a,b)=>a+b.bonus, 0);
      const sI = exportData.reduce((a,b)=>a+b.insentif, 0);
      const sBr = exportData.reduce((a,b)=>a+b.bruto, 0);
      const sK = exportData.reduce((a,b)=>a+b.kasbon, 0);
      const sD = exportData.reduce((a,b)=>a+b.denda, 0);
      const sDt = exportData.reduce((a,b)=>a+b.dendaTelat, 0);
      const sPl = exportData.reduce((a,b)=>a+b.potLain, 0);
      const sPo = exportData.reduce((a,b)=>a+b.totPot, 0);
      const sN = exportData.reduce((a,b)=>a+b.net, 0);

      const periodTitle = format(new Date(selectedYear, selectedMonth - 1, 1), "MMMM yyyy", {locale: id}).toUpperCase();

      let tableHtml = `<table border="1" style="border-collapse: collapse; font-family: Arial;">
         <tr style="height: 35px;"><td colspan="24" align="center" style="font-size: 16px; font-weight: bold;">REKAP GAJI ${periodTitle}</td></tr>
         <tr style="background-color: #d1d5db; color: #000000; font-weight: bold; height: 30px;">
            <th>No</th>
            <th>Nama Karyawan</th>
            <th>NIK</th>
            <th>Jabatan</th>
            <th>Periode</th>
            <th>Hadir</th>
            <th>Lembur (Jam)</th>
            <th>Gaji Pokok</th>
            <th>Lembur (Rp)</th>
            <th>Tunjangan Makan</th>
            <th>Tunjangan Transport</th>
            <th>Tunjangan Jabatan</th>
            <th>Bonus Kinerja</th>
            <th>Insentif Khusus</th>
            <th>Ket. Insentif</th>
            <th style="border: 2px solid black;">Gaji Kotor</th>
            <th>Kasbon</th>
            <th>Denda</th>
            <th>Denda Telat</th>
            <th>Potongan Lainnya</th>
            <th>Ket. Potongan</th>
            <th style="background-color: #d1d5db; border: 2px solid black;">Total Potongan</th>
            <th style="background-color: #d1d5db; border: 2px solid black;">Gaji Bersih</th>
            <th>Status</th>
         </tr>`;

      exportData.forEach(d => {
         tableHtml += `<tr style="height: 25px;">
            <td align="center">${d.no}</td>
            <td>${d.nama}</td>
            <td>${d.id}</td>
            <td>${d.divisi}</td>
            <td>${d.periode}</td>
            <td align="center">${d.hadir}</td>
            <td align="center">${d.lemburJam}</td>
            <td>${d.pokok.toLocaleString('id-ID')}</td>
            <td>${d.lemburRp.toLocaleString('id-ID')}</td>
            <td>${d.makan.toLocaleString('id-ID')}</td>
            <td>${d.trans.toLocaleString('id-ID')}</td>
            <td>${d.jabatan.toLocaleString('id-ID')}</td>
            <td>${d.bonus.toLocaleString('id-ID')}</td>
            <td>${d.insentif.toLocaleString('id-ID')}</td>
            <td>${d.insNotes}</td>
            <td style="font-weight: bold; border: 1px solid black;">${d.bruto.toLocaleString('id-ID')}</td>
            <td>${d.kasbon.toLocaleString('id-ID')}</td>
            <td>${d.denda.toLocaleString('id-ID')}</td>
            <td>${d.dendaTelat.toLocaleString('id-ID')}</td>
            <td>${d.potLain.toLocaleString('id-ID')}</td>
            <td>${d.potNotes}</td>
            <td style="font-weight: bold; border: 1px solid black;">${d.totPot.toLocaleString('id-ID')}</td>
            <td style="font-weight: bold; border: 1px solid black;">${d.net.toLocaleString('id-ID')}</td>
            <td>${d.status}</td>
         </tr>`;
      });

      tableHtml += `<tr style="background-color: #d1d5db; font-weight: bold; height: 30px;">
         <td colspan="7" align="center">TOTAL</td>
         <td>${sP.toLocaleString('id-ID')}</td>
         <td>${sL.toLocaleString('id-ID')}</td>
         <td>${sM.toLocaleString('id-ID')}</td>
         <td>${sTr.toLocaleString('id-ID')}</td>
         <td>${sJ.toLocaleString('id-ID')}</td>
         <td>${sB.toLocaleString('id-ID')}</td>
         <td>${sI.toLocaleString('id-ID')}</td>
         <td></td>
         <td style="border: 2px solid black;">${sBr.toLocaleString('id-ID')}</td>
         <td>${sK.toLocaleString('id-ID')}</td>
         <td>${sD.toLocaleString('id-ID')}</td>
         <td>${sDt.toLocaleString('id-ID')}</td>
         <td>${sPl.toLocaleString('id-ID')}</td>
         <td></td>
         <td style="border: 2px solid black;">${sPo.toLocaleString('id-ID')}</td>
         <td style="border: 2px solid black;">${sN.toLocaleString('id-ID')}</td>
         <td></td>
      </tr>`;

      tableHtml += `</table>`;

      const template = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Rekap</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${tableHtml}</body></html>`;
      const blob = new Blob([template], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rekap_Gaji_${selectedMonth}_${selectedYear}.xls`;
      a.click();
      URL.revokeObjectURL(url);
  };

   const handleExportAllHistory = async () => {
      const loadId = toast.loading("Mengambil database sejarah gaji...");
      try {
         const { data, error } = await supabase.from('salary_records').select(`
            *,
            profiles (full_name, employee_id, role),
            salary_periods (period_label, period_month, period_year)
         `).order('created_at', { ascending: false });

         if (error) throw error;
         if (!data || data.length === 0) {
            toast.error("Belum ada riwayat gaji tersimpan di database.", { id: loadId });
            return;
         }

         const exportData = data.map((r: any, idx: number) => {
            const pokok = Number(r.basic_salary || 0);
            const lemburRp = Number(r.overtime_pay || 0);
            const makan = Number(r.meal_allowance || 0);
            const trans = Number(r.transport_allowance || 0);
            const jabatan = Number(r.fixed_allowance || 0);
            const bonus = Number(r.bonus || 0);
            const insentif = Number(r.special_incentive || 0);
            const insNotes = r.incentive_notes || "";

            const kasbon = Number(r.kasbon_deduction || 0);
            const denda = Number(r.fine_deduction || 0);
            const dendaTelat = Number(r.late_deduction || 0);
            const potLain = Number(r.other_deduction || 0);
            const potNotes = r.other_deduction_notes || "";

            const bruto = pokok + lemburRp + makan + trans + jabatan + bonus + insentif;
            const totPot = kasbon + denda + dendaTelat + potLain;
            const net = Number(r.net_salary || 0);
            
            return {
               no: idx+1,
               periode: r.salary_periods?.period_label || "N/A",
               nama: r.profiles?.full_name || "Eks-Karyawan",
               id: r.profiles?.employee_id || "-",
               divisi: getDivision(r.profiles?.role),
               hadir: r.days_present || 0,
               lemburJam: r.total_overtime_hours || 0,
               pokok, lemburRp, makan, trans, jabatan, bonus, insentif, insNotes, bruto,
               kasbon, denda, dendaTelat, potLain, potNotes, totPot, net,
               status: r.is_transferred ? "LUNAS" : "TERKUNCI"
            };
         });

         const sP = exportData.reduce((a,b)=>a+b.pokok, 0);
         const sL = exportData.reduce((a,b)=>a+b.lemburRp, 0);
         const sM = exportData.reduce((a,b)=>a+b.makan, 0);
         const sTr = exportData.reduce((a,b)=>a+b.trans, 0);
         const sJ = exportData.reduce((a,b)=>a+b.jabatan, 0);
         const sB = exportData.reduce((a,b)=>a+b.bonus, 0);
         const sI = exportData.reduce((a,b)=>a+b.insentif, 0);
         const sBr = exportData.reduce((a,b)=>a+b.bruto, 0);
         const sK = exportData.reduce((a,b)=>a+b.kasbon, 0);
         const sD = exportData.reduce((a,b)=>a+b.denda, 0);
         const sDt = exportData.reduce((a,b)=>a+b.dendaTelat, 0);
         const sPl = exportData.reduce((a,b)=>a+b.potLain, 0);
         const sPo = exportData.reduce((a,b)=>a+b.totPot, 0);
         const sN = exportData.reduce((a,b)=>a+b.net, 0);

         let tableHtml = `<table border="1" style="border-collapse: collapse; font-family: Arial;">
            <tr style="height: 35px;"><td colspan="24" align="center" style="font-size: 16px; font-weight: bold;">LAPORAN KESELURUHAN SEJARAH GAJI RESTOBOOK</td></tr>
            <tr style="background-color: #d1d5db; color: #000000; font-weight: bold; height: 30px;">
               <th>No</th>
               <th>Nama Karyawan</th>
               <th>NIK</th>
               <th>Jabatan</th>
               <th>Periode</th>
               <th>Hadir</th>
               <th>Lembur (Jam)</th>
               <th>Gaji Pokok</th>
               <th>Lembur (Rp)</th>
               <th>Tunjangan Makan</th>
               <th>Tunjangan Transport</th>
               <th>Tunjangan Jabatan</th>
               <th>Bonus Kinerja</th>
               <th>Insentif Khusus</th>
               <th>Ket. Insentif</th>
               <th style="border: 2px solid black;">Gaji Kotor</th>
               <th>Kasbon</th>
               <th>Denda</th>
               <th>Denda Telat</th>
               <th>Potongan Lainnya</th>
               <th>Ket. Potongan</th>
               <th style="background-color: #d1d5db; border: 2px solid black;">Total Potongan</th>
               <th style="background-color: #d1d5db; border: 2px solid black;">Gaji Bersih</th>
               <th>Status</th>
            </tr>`;

         exportData.forEach(d => {
            tableHtml += `<tr style="height: 25px;">
               <td align="center">${d.no}</td>
               <td>${d.nama}</td>
               <td>${d.id}</td>
               <td>${d.divisi}</td>
               <td>${d.periode}</td>
               <td align="center">${d.hadir}</td>
               <td align="center">${d.lemburJam}</td>
               <td>${d.pokok.toLocaleString('id-ID')}</td>
               <td>${d.lemburRp.toLocaleString('id-ID')}</td>
               <td>${d.makan.toLocaleString('id-ID')}</td>
               <td>${d.trans.toLocaleString('id-ID')}</td>
               <td>${d.jabatan.toLocaleString('id-ID')}</td>
               <td>${d.bonus.toLocaleString('id-ID')}</td>
               <td>${d.insentif.toLocaleString('id-ID')}</td>
               <td>${d.insNotes}</td>
               <td style="font-weight: bold; border: 1px solid black;">${d.bruto.toLocaleString('id-ID')}</td>
               <td>${d.kasbon.toLocaleString('id-ID')}</td>
               <td>${d.denda.toLocaleString('id-ID')}</td>
               <td>${d.dendaTelat.toLocaleString('id-ID')}</td>
               <td>${d.potLain.toLocaleString('id-ID')}</td>
               <td>${d.potNotes}</td>
               <td style="font-weight: bold; border: 1px solid black;">${d.totPot.toLocaleString('id-ID')}</td>
               <td style="font-weight: bold; border: 1px solid black;">${d.net.toLocaleString('id-ID')}</td>
               <td>${d.status}</td>
            </tr>`;
         });

         tableHtml += `<tr style="background-color: #d1d5db; font-weight: bold; height: 30px;">
            <td colspan="7" align="center">TOTAL</td>
            <td>${sP.toLocaleString('id-ID')}</td>
            <td>${sL.toLocaleString('id-ID')}</td>
            <td>${sM.toLocaleString('id-ID')}</td>
            <td>${sTr.toLocaleString('id-ID')}</td>
            <td>${sJ.toLocaleString('id-ID')}</td>
            <td>${sB.toLocaleString('id-ID')}</td>
            <td>${sI.toLocaleString('id-ID')}</td>
            <td></td>
            <td style="border: 2px solid black;">${sBr.toLocaleString('id-ID')}</td>
            <td>${sK.toLocaleString('id-ID')}</td>
            <td>${sD.toLocaleString('id-ID')}</td>
            <td>${sDt.toLocaleString('id-ID')}</td>
            <td>${sPl.toLocaleString('id-ID')}</td>
            <td></td>
            <td style="border: 2px solid black;">${sPo.toLocaleString('id-ID')}</td>
            <td style="border: 2px solid black;">${sN.toLocaleString('id-ID')}</td>
            <td></td>
         </tr>`;

         tableHtml += `</table>`;

         const template = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Riwayat</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body>${tableHtml}</body></html>`;
         
         const blob = new Blob([template], { type: 'application/vnd.ms-excel' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `DOKUMEN_SEJARAH_GAJI_TOTAL_${new Date().getFullYear()}.xls`;
         a.click();
         URL.revokeObjectURL(url);
         toast.success("Arsip Sejarah Gaji berhasil diunduh!", { id: loadId });
      } catch (e: any) {
         toast.error("Terjadi gangguan: " + e.message, { id: loadId });
      }
   };

  const filtered = employees.filter(e => e.full_name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalNetPending = filtered.reduce((sum, e) => sum + (!e.currentRecord?.is_transferred ? (e.currentRecord ? Number(e.currentRecord.net_salary) : e.net) : 0), 0);
  const totalPaid = filtered.reduce((sum, e) => sum + (e.currentRecord?.is_transferred ? Number(e.currentRecord.net_salary) : 0), 0);

  return (
    <div className="min-h-screen bg-[#fdfbf7] dark:bg-gray-950 p-6 lg:p-10 text-text-light dark:text-text-dark font-sans">
      
      {/* HEADER BAR */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
         <div>
            <p className="text-[10px] font-black text-orange-600 dark:text-orange-400 tracking-[0.2em] uppercase mb-1 flex items-center gap-2">
               <Shield className="w-3 h-3" /> Payroll Enterprise Level
            </p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter flex items-center gap-3">
               Manajemen <span className="text-orange-500">Penggajian</span>
            </h1>
         </div>

         <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-2xl p-1.5 flex shadow-sm">
               <select aria-label="Pilih Bulan" value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="bg-transparent font-bold text-xs uppercase px-4 py-2 outline-none cursor-pointer">
                  {months.map(m => <option key={m.getMonth()+1} value={m.getMonth()+1}>{format(m, "MMMM", {locale: id})}</option>)}
               </select>
               <select aria-label="Pilih Tahun" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="bg-transparent font-bold text-xs px-4 py-2 border-l border-border-light dark:border-border-dark outline-none cursor-pointer">
                  {[...Array(4)].map((_, i) => {
                     const y = new Date().getFullYear() - 1 + i;
                     return <option key={y} value={y}>{y}</option>
                  })}
               </select>
            </div>
            <button onClick={handleExportExcel} className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-md transition-all active:scale-95">
               <FileSpreadsheet className="w-4 h-4" /> Ekspor Bulan Ini
            </button>
            <button onClick={handleExportAllHistory} className="px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-lg shadow-slate-800/20 transition-all active:scale-95">
               <History className="w-4 h-4" /> Rekap Semua Riwayat
            </button>
            <button onClick={handleBulkSendEmailSlip} className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase flex items-center gap-2 shadow-md transition-all active:scale-95">
               <Mail className="w-4 h-4" /> Kirim Slip Masal
            </button>
         </div>
      </header>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
         <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm relative overflow-hidden group">
            <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-orange-500/10 rounded-full blur-3xl group-hover:bg-orange-500/20 transition-all"></div>
            <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Total Terbayar Bulan Ini</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Rp {totalPaid.toLocaleString('id-ID')}</h3>
            <div className="mt-3 flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 w-fit px-2 py-1 rounded-lg">
               <TrendingUp className="w-3 h-3" /> Realtime Update
            </div>
         </div>
         
         <div className="bg-white dark:bg-gray-900 p-6 rounded-[2rem] border border-border-light dark:border-border-dark shadow-sm">
            <p className="text-[10px] font-black uppercase text-muted tracking-widest mb-1">Menunggu Pembayaran</p>
            <h3 className="text-2xl font-black text-orange-600">Rp {totalNetPending.toLocaleString('id-ID')}</h3>
            <div className="mt-3 w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
               <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(totalPaid / (totalPaid + totalNetPending || 1)) * 100}%` }} />
            </div>
         </div>

         <div className="bg-slate-900 text-white p-6 rounded-[2rem] relative overflow-hidden">
            <Banknote className="absolute right-6 top-1/2 -translate-y-1/2 w-16 h-16 text-white/10 rotate-12" />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">Countdown Gajian</p>
            <h3 className="text-2xl font-black">{getDaysToPayday()} Hari Lagi</h3>
            <p className="text-[10px] font-bold opacity-60 mt-1">Setiap Tanggal {companySettings?.payday_date || 28} Tiap Bulan</p>
         </div>
      </div>

      {/* CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
         <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input 
               type="text" 
               placeholder="Cari nama karyawan..." 
               value={searchQuery} 
               onChange={e => setSearchQuery(e.target.value)}
               className="w-full bg-white dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-2xl pl-11 pr-4 py-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500 shadow-sm"
            />
         </div>
         <div className="flex gap-3">
            <button aria-label="Muat Ulang Data" onClick={fetchData} className="p-3.5 bg-white dark:bg-gray-900 border border-border-light dark:border-border-dark rounded-2xl hover:bg-gray-50 shadow-sm"><Clock className="w-5 h-5" /></button>
         </div>
      </div>

      {/* MAIN LIST TABLE */}
      {loading ? (
         <div className="h-64 bg-white dark:bg-gray-900 rounded-[2rem] flex items-center justify-center border border-dashed border-muted/30">
            <div className="flex flex-col items-center gap-3">
               <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
               <p className="font-black text-xs uppercase tracking-widest text-muted">Menghitung Ulang Gaji...</p>
            </div>
         </div>
      ) : (
         <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border border-border-light dark:border-border-dark shadow-xl shadow-black/[0.02] overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" style={{ minWidth: '1000px' }}>
                  <thead>
                     <tr className="bg-gray-50/50 dark:bg-gray-800/30 text-[10px] font-black uppercase text-muted tracking-wider">
                        <th className="p-6 whitespace-nowrap">Karyawan</th>
                        <th className="p-6 whitespace-nowrap">Absensi / Jam</th>
                        <th className="p-6 whitespace-nowrap">Tarif Dasar</th>
                        <th className="p-6 whitespace-nowrap">Saldo Kasbon/Denda</th>
                        <th className="p-6 whitespace-nowrap">Total Bersih</th>
                        <th className="p-6 text-center whitespace-nowrap">Aksi</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-border-dark">
                     {filtered.map(emp => {
                        const currentNet = emp.currentRecord ? Number(emp.currentRecord.net_salary) : emp.net;
                        const isPaid = emp.currentRecord?.is_transferred;
                        
                        // ADVANCE PAY DETECTORS
                        const transferredDate = emp.currentRecord?.transferred_at ? new Date(emp.currentRecord.transferred_at) : null;
                        const periodStartDate = new Date(selectedYear, selectedMonth - 1, 1);
                        const isAdvanceRecord = transferredDate && transferredDate < periodStartDate;
                        
                        const nowCheck = new Date();
                        const isBrowsingFuture = selectedYear > nowCheck.getFullYear() || (selectedYear === nowCheck.getFullYear() && (selectedMonth - 1) > nowCheck.getMonth());

                        return (
                           <tr key={emp.id} className="group hover:bg-orange-50/30 dark:hover:bg-orange-950/10 transition-all">
                              <td className="p-6 whitespace-nowrap">
                                 <div className="flex items-center gap-4 whitespace-nowrap">
                                    <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-border-light dark:border-border-dark overflow-hidden shadow-sm flex-shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform">
                                       {emp.avatar_url ? <img src={emp.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-6 h-6 text-muted" />}
                                    </div>
                                    <div className="whitespace-nowrap">
                                       <p className="font-black text-sm text-slate-900 dark:text-white whitespace-nowrap">{emp.full_name}</p>
                                       <p className="text-[10px] font-bold text-muted uppercase mt-0.5 whitespace-nowrap">{emp.role || 'Staff'}</p>
                                    </div>
                                 </div>
                              </td>
                              <td className="p-6 whitespace-nowrap">
                                 <div className="space-y-1 whitespace-nowrap">
                                    <div className="flex gap-1.5 whitespace-nowrap">
                                       <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400 text-[9px] font-black rounded-md uppercase whitespace-nowrap">+{emp.daysPresent} H</span>
                                       <span className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 text-[9px] font-black rounded-md uppercase whitespace-nowrap">{emp.daysIzin} I</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-muted flex items-center gap-1 whitespace-nowrap"><Clock className="w-3 h-3" /> {emp.finalOtHours} Jam Lembur</p>
                                 </div>
                              </td>
                              <td className="p-6 whitespace-nowrap">
                                 <div className="flex items-center gap-2 group/btn whitespace-nowrap">
                                    <div className="whitespace-nowrap">
                                       <p className="text-xs font-black text-slate-800 dark:text-slate-200 whitespace-nowrap">Rp {(emp.daily_salary || 0).toLocaleString('id-ID')}</p>
                                       <p className="text-[9px] font-bold text-muted whitespace-nowrap">/ Hari Kerja</p>
                                    </div>
                                    {!isPaid && (
                                       <button aria-label="Atur Tarif" onClick={() => openRates(emp)} className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 shadow-sm hover:bg-orange-600 hover:text-white hover:border-orange-600 dark:hover:bg-orange-600 dark:hover:text-white transition-all active:scale-95 flex items-center justify-center ml-2 whitespace-nowrap">
                                          <Edit3 className="w-4 h-4" />
                                       </button>
                                    )}
                                 </div>
                              </td>
                              <td className="p-6 whitespace-nowrap">
                                 <div className="space-y-1.5 flex flex-col items-start whitespace-nowrap">
                                    {emp.sumKasbon > 0 && (
                                       <div className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/30 px-2.5 py-1 rounded-lg border border-red-200/30 whitespace-nowrap flex items-center">- Rp {emp.sumKasbon.toLocaleString('id-ID')} (Kasbon)</div>
                                    )}
                                    {emp.sumFines > 0 && (
                                       <div className="text-[10px] font-bold text-orange-600 bg-orange-50 dark:bg-orange-950/30 px-2.5 py-1 rounded-lg border border-orange-200/30 whitespace-nowrap flex items-center">- Rp {emp.sumFines.toLocaleString('id-ID')} (Denda)</div>
                                    )}
                                    {(emp.sumKasbon === 0 && emp.sumFines === 0) && <span className="text-[10px] text-muted italic whitespace-nowrap">Tidak ada potongan aktif</span>}
                                 </div>
                              </td>
                              <td className="p-6 whitespace-nowrap">
                                 <p className="text-lg font-black text-slate-900 dark:text-white whitespace-nowrap">Rp {currentNet.toLocaleString('id-ID')}</p>
                              </td>
                              <td className="p-6 whitespace-nowrap">
                                 <div className="flex justify-center items-center gap-2">
                                    {isPaid ? (
                                       <div className="flex items-center gap-2">
                                          <div className="flex flex-col gap-1">
                                             <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-xl text-[10px] font-black uppercase border border-emerald-200/30 whitespace-nowrap">
                                                <CheckCircle2 className="w-3 h-3" /> Lunas
                                             </div>
                                             {isAdvanceRecord && (
                                                <span className="text-[7px] font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded uppercase border border-red-200/30 text-center flex items-center justify-center gap-1">
                                                   <Shield className="w-2 h-2"/> Diambil Dini
                                                </span>
                                             )}
                                          </div>
                                          <div className="flex items-center gap-1">
                                             <button 
                                                onClick={() => handleDownloadSlip(emp)}
                                                title="Unduh Slip Gaji PDF"
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-900 text-slate-700 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 border border-slate-200 shadow-sm"
                                             >
                                                <Download className="w-3 h-3" /> Slip
                                             </button>
                                             <button 
                                                onClick={() => handleSendEmailSlip(emp)}
                                                title="Kirim Ulang ke Email"
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all active:scale-95 border border-blue-200 shadow-sm"
                                             >
                                                <Mail className="w-3 h-3" /> Email
                                             </button>
                                          </div>
                                       </div>
                                    ) : (
                                       <div className="relative">
                                          {isBrowsingFuture && <span className="absolute -top-2.5 -right-1 z-10 px-2 py-0.5 bg-orange-500 text-white text-[8px] rounded-lg font-black border border-orange-600 shadow-sm animate-bounce uppercase tracking-wider">Mode Panjar</span>}
                                          <button onClick={() => openDetail(emp)} className="px-4 py-2 bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 text-white text-[10px] font-black uppercase rounded-xl tracking-wider shadow-md transition-all active:scale-95 flex items-center gap-1.5">
                                             <Calculator className="w-3.5 h-3.5" /> Detail Gaji
                                          </button>
                                       </div>
                                    )}
                                 </div>
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: DETAIL PENGGAJIAN TERINTEGRASI (NEW PRD FORMULA)      */}
      {/* ------------------------------------------------------------- */}
      <BaseModal isOpen={showDetailModal && !!selectedProfile} onClose={() => setShowDetailModal(false)} size="4xl" showCloseButton={true} noPadding={true}>
         {selectedProfile && (
            <div className="bg-[#fafafa] dark:bg-gray-950 flex flex-col">
               {/* Header Modal */}
               <div className="bg-white dark:bg-gray-900 p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center sticky top-0 z-10">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-orange-500/20">
                        {selectedProfile.full_name.charAt(0)}
                     </div>
                     <div>
                        <div className="flex items-center gap-2">
                           <h3 className="font-black text-lg text-slate-900 dark:text-white uppercase tracking-tight">{selectedProfile.full_name}</h3>
                           <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 text-[9px] font-black uppercase rounded-md border border-blue-100 dark:border-blue-900/30">
                              Divisi: {getDivision(selectedProfile.role)}
                           </span>
                        </div>
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest mt-0.5">Detail Gaji Periode {format(new Date(selectedYear, selectedMonth-1, 1), "MMMM yyyy", {locale: id})}</p>
                     </div>
                  </div>
               </div>

               {/* Content Grid */}
               <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Future Payroll Warning Banner Spanning Columns */}
                  {(selectedYear > new Date().getFullYear() || (selectedYear === new Date().getFullYear() && (selectedMonth - 1) > new Date().getMonth())) && (
                     <div className="lg:col-span-3 p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-[2rem] flex items-start gap-4 shadow-sm mb-2">
                        <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/50 rounded-xl flex items-center justify-center text-orange-600 flex-shrink-0 animate-pulse">
                           <AlertCircle className="w-6 h-6" />
                        </div>
                        <div>
                           <h5 className="text-sm font-black text-orange-700 dark:text-orange-400 uppercase tracking-tight">Mode Panjar Gaji Aktif (Pengambilan Dini)</h5>
                           <p className="text-[10px] font-bold text-orange-600/80 mt-1 leading-relaxed">PERHATIAN ADMIN: Anda sedang memproses gaji untuk periode BULAN DEPAN yang belum jatuh tempo secara alamiah. Jika Anda melakukan transfer sekarang, sistem akan secara permanen mengunci ini sebagai &apos;Gaji Diambil Lebih Awal&apos;.</p>
                        </div>
                     </div>
                  )}
                  
                  {/* COLUMN 1: ATTENDANCE & INFO */}
                  <div className="space-y-6">
                     <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-border-light dark:border-border-dark shadow-sm">
                        <h4 className="text-[10px] font-black uppercase text-orange-600 mb-4 flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> Riwayat Kehadiran</h4>
                        <div className="grid grid-cols-4 gap-2">
                           <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl px-1 py-3 text-center border border-border-light dark:border-border-dark relative overflow-hidden">
                              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate" title={String(selectedProfile.daysPresent)}>{selectedProfile.daysPresent}</p>
                              <p className="text-[7px] xs:text-[8px] font-black uppercase text-muted tracking-wider mt-1 break-words">Hadir</p>
                           </div>
                           <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl px-1 py-3 text-center border border-border-light dark:border-border-dark relative overflow-hidden">
                              <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate" title={String(selectedProfile.daysIzin)}>{selectedProfile.daysIzin}</p>
                              <p className="text-[7px] xs:text-[8px] font-black uppercase text-muted tracking-wider mt-1 break-words">Izin / Sakit</p>
                           </div>
                           <div className="bg-red-50 dark:bg-red-950/20 rounded-xl px-1 py-3 text-center border border-red-100 dark:border-red-900/20 relative overflow-hidden">
                              <p className="text-xl sm:text-2xl font-black text-red-600 tracking-tight truncate" title={String(selectedProfile.daysAlpha)}>{selectedProfile.daysAlpha}</p>
                              <p className="text-[7px] xs:text-[8px] font-black uppercase text-red-600/70 tracking-wider mt-1 break-words">Alpa</p>
                           </div>
                           <div className="bg-rose-50 dark:bg-rose-950/30 rounded-xl px-1 py-3 text-center border border-rose-100 dark:border-rose-900/20 relative overflow-hidden">
                              <p className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight truncate" title={String(selectedProfile.totalLateMins || 0)}>{selectedProfile.totalLateMins || 0}</p>
                              <p className="text-[7px] xs:text-[8px] font-black uppercase text-rose-600/70 tracking-wider mt-1 break-words leading-none">Menit Terlambat</p>
                              
                              <div className="absolute top-0.5 right-0.5 bg-rose-600 text-white font-black text-[6px] px-1 rounded-full scale-75">
                                 {selectedProfile.lateCount || 0}x
                              </div>
                           </div>
                        </div>
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl flex justify-between items-center">
                              <p className="text-[9px] font-bold text-muted uppercase">Total Jam Lembur</p>
                              <p className="text-base font-black text-slate-900 dark:text-white">{selectedProfile.finalOtHours} Jam</p>
                        </div>
                     </div>

                     <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-border-light dark:border-border-dark shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                           <h4 className="text-[10px] font-black uppercase text-orange-600 flex items-center gap-2"><Wallet className="w-3.5 h-3.5" /> Metode Transfer</h4>
                           <button onClick={() => openPaymentSettings(selectedProfile)} className="p-1.5 bg-gray-50 hover:bg-gray-100 text-muted rounded-lg text-[9px] font-bold uppercase flex items-center gap-1 border border-border-light transition-all active:scale-95">
                              <Edit3 className="w-2.5 h-2.5"/> Edit
                           </button>
                        </div>
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                              {selectedProfile.payment_method_preference === 'tunai' ? <DollarSign className="w-5 h-5"/> : <Banknote className="w-5 h-5"/>}
                           </div>
                           <div>
                              <p className="text-xs font-black text-slate-900 dark:text-white uppercase leading-tight">
                                 {selectedProfile.payment_method_preference === 'bank' ? (selectedProfile.bank_name || 'Transfer Bank') : 
                                  selectedProfile.payment_method_preference === 'wallet' ? (selectedProfile.e_wallet_name || 'E-Wallet') : 
                                  selectedProfile.payment_method_preference === 'lain' ? (selectedProfile.bank_name || 'Lainnya') : 
                                  'Tunai / Cash'}
                              </p>
                              <p className="text-[10px] font-bold text-muted mt-0.5">
                                 {selectedProfile.payment_method_preference === 'tunai' ? 'Pembayaran Langsung' : 
                                  (selectedProfile.bank_account_number || selectedProfile.e_wallet_number || '-')}
                              </p>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* COLUMN 2: PENDAPATAN (INCOME) */}
                  <div className="space-y-6">
                     <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-border-light dark:border-border-dark shadow-sm">
                        <h4 className="text-[10px] font-black uppercase text-green-600 mb-4 flex items-center gap-2"><TrendingUp className="w-3.5 h-3.5" /> Komponen Pendapatan</h4>
                        
                        <div className="space-y-3">
                           <div className="flex justify-between text-xs items-center py-1 border-b border-dashed border-gray-100 dark:border-gray-800 gap-3">
                              <span className="text-muted font-bold flex-1">Gaji Pokok ({selectedProfile.daysPresent} H)</span>
                              <div className="flex items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border-light dark:border-border-dark px-2 w-32 group-hover:border-green-200 transition-colors">
                                 <span className="text-[9px] font-black opacity-40">Rp</span>
                                 <input type="number" aria-label="Gaji Pokok" placeholder="0" value={adjBasic} onChange={e=>setAdjBasic(e.target.value)} className="w-full bg-transparent outline-none font-black text-right text-xs p-1.5 text-slate-900 dark:text-white [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                              </div>
                           </div>
                           <div className="flex justify-between text-xs items-center py-1 border-b border-dashed border-gray-100 dark:border-gray-800 gap-3">
                              <span className="text-muted font-bold flex-1">Upah Lembur ({selectedProfile.finalOtHours} J)</span>
                              <div className="flex items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border-light dark:border-border-dark px-2 w-32">
                                 <span className="text-[9px] font-black opacity-40">Rp</span>
                                 <input type="number" aria-label="Upah Lembur" placeholder="0" value={adjOvertime} onChange={e=>setAdjOvertime(e.target.value)} className="w-full bg-transparent outline-none font-black text-right text-xs p-1.5 text-slate-900 dark:text-white [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                              </div>
                           </div>
                           <div className="flex justify-between text-xs items-center py-1 border-b border-dashed border-gray-100 dark:border-gray-800 gap-3">
                              <span className="text-muted font-bold flex-1">Tunj. Makan ({selectedProfile.daysPresent} H)</span>
                              <div className="flex items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border-light dark:border-border-dark px-2 w-32">
                                 <span className="text-[9px] font-black opacity-40">Rp</span>
                                 <input type="number" aria-label="Tunjangan Makan" placeholder="0" value={adjMeal} onChange={e=>setAdjMeal(e.target.value)} className="w-full bg-transparent outline-none font-black text-right text-xs p-1.5 text-slate-900 dark:text-white [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                              </div>
                           </div>
                           <div className="flex justify-between text-xs items-center py-1 border-b border-dashed border-gray-100 dark:border-gray-800 gap-3">
                              <span className="text-muted font-bold flex-1">Tunj. Transport ({selectedProfile.daysPresent} H)</span>
                              <div className="flex items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border-light dark:border-border-dark px-2 w-32">
                                 <span className="text-[9px] font-black opacity-40">Rp</span>
                                 <input type="number" aria-label="Tunjangan Transport" placeholder="0" value={adjTransport} onChange={e=>setAdjTransport(e.target.value)} className="w-full bg-transparent outline-none font-black text-right text-xs p-1.5 text-slate-900 dark:text-white [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                              </div>
                           </div>
                           <div className="flex justify-between text-xs items-center py-1 border-b border-dashed border-gray-100 dark:border-gray-800 gap-3">
                              <span className="text-muted font-bold flex-1">Tunj. Tetap Bulanan</span>
                              <div className="flex items-center bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-border-light dark:border-border-dark px-2 w-32">
                                 <span className="text-[9px] font-black opacity-40">Rp</span>
                                 <input type="number" aria-label="Tunjangan Tetap" placeholder="0" value={adjFixed} onChange={e=>setAdjFixed(e.target.value)} className="w-full bg-transparent outline-none font-black text-right text-xs p-1.5 text-slate-900 dark:text-white [-moz-appearance:_textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                              </div>
                           </div>
                           
                           <div className="pt-2 space-y-3">
                              <div>
                                 <label className="text-[9px] font-black uppercase text-muted">Bonus Kinerja (Input)</label>
                                 <input placeholder="0" aria-label="Bonus" type="number" value={adjBonus} onChange={e=>setAdjBonus(e.target.value)} className="w-full mt-1 bg-gray-50 dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl p-2.5 font-black text-xs text-green-600 outline-none"/>
                              </div>
                              <div>
                                 <label className="text-[9px] font-black uppercase text-muted">Insentif Khusus (Input)</label>
                                 <div className="flex flex-col gap-2 mt-1">
                                    <input type="number" value={adjIncentive} onChange={e=>setAdjIncentive(e.target.value)} placeholder="Nominal" className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl p-2.5 font-black text-xs text-green-600 outline-none"/>
                                    <input type="text" value={adjIncentiveNotes} onChange={e=>setAdjIncentiveNotes(e.target.value)} placeholder="Keterangan insentif..." className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl p-2.5 font-bold text-xs outline-none"/>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* COLUMN 3: POTONGAN (DEDUCTIONS) */}
                  <div className="space-y-6">
                     <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-border-light dark:border-border-dark shadow-sm">
                        <h4 className="text-[10px] font-black uppercase text-red-600 mb-4 flex items-center gap-2"><XCircle className="w-3.5 h-3.5" /> Komponen Potongan</h4>
                        <div className="space-y-4 mb-4">
                           {selectedProfile.lateDeduct > 0 && (
                              <div className="flex justify-between text-xs items-center py-2.5 bg-rose-50 dark:bg-rose-950/30 px-3.5 rounded-xl border border-rose-100 dark:border-rose-900/30">
                                 <span className="text-rose-700 dark:text-rose-400 font-black uppercase tracking-wider text-[9px] flex items-center gap-1.5"><Clock className="w-3 h-3"/> Potongan Telat ({selectedProfile.totalLateMins}m)</span>
                                 <span className="font-black text-rose-600">- Rp {selectedProfile.lateDeduct.toLocaleString('id-ID')}</span>
                              </div>
                           )}
                           <div>
                              <div className="flex justify-between text-xs items-center py-2 border-b border-dashed border-gray-100 dark:border-gray-800">
                                 <span className="text-muted font-black uppercase tracking-wider text-[9px]">Total Bon / Kasbon</span>
                                 <span className="font-black text-red-600">- Rp {selectedProfile.sumKasbon.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="space-y-1.5 mt-2 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                                 {selectedProfile.activeKasbons?.map((k:any) => (
                                    <div key={k.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg text-[10px] group hover:bg-red-50/50 dark:hover:bg-red-950/10 transition-all">
                                       <div className="truncate flex-1 pr-2">
                                          <p className="font-black text-slate-800 dark:text-slate-200">Rp {Number(k.remaining_amount).toLocaleString('id-ID')}</p>
                                          <p className="text-muted truncate">{k.notes || 'Tanpa Catatan'}</p>
                                       </div>
                                       <button onClick={()=>handleDeleteKasbon(k.id)} title="Hapus Kasbon" aria-label="Hapus Kasbon" className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-100 hover:bg-red-500 text-red-600 hover:text-white rounded-md transition-all">
                                          <X className="w-3 h-3"/>
                                       </button>
                                    </div>
                                 ))}
                                 {(!selectedProfile.activeKasbons || selectedProfile.activeKasbons.length === 0) && <p className="text-[8px] font-bold text-muted italic text-center mt-1">Tidak ada kasbon aktif</p>}
                              </div>
                           </div>

                           <div>
                              <div className="flex justify-between text-xs items-center py-2 border-b border-dashed border-gray-100 dark:border-gray-800">
                                 <span className="text-muted font-black uppercase tracking-wider text-[9px]">Akumulasi Denda</span>
                                 <span className="font-black text-red-600">- Rp {selectedProfile.sumFines.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="space-y-1.5 mt-2 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                                 {selectedProfile.activeFines?.map((f:any) => (
                                    <div key={f.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg text-[10px] group hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-all">
                                       <div className="truncate flex-1 pr-2">
                                          <p className="font-black text-slate-800 dark:text-slate-200">Rp {Number(f.amount).toLocaleString('id-ID')}</p>
                                          <p className="text-muted truncate">{f.reason}: {f.notes}</p>
                                       </div>
                                       <button onClick={()=>handleDeleteFine(f.id)} title="Hapus Denda" aria-label="Hapus Denda" className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-100 hover:bg-red-500 text-red-600 hover:text-white rounded-md transition-all">
                                          <X className="w-3 h-3"/>
                                       </button>
                                    </div>
                                 ))}
                                 {(!selectedProfile.activeFines || selectedProfile.activeFines.length === 0) && <p className="text-[8px] font-bold text-muted italic text-center mt-1">Tidak ada denda aktif</p>}
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-5">
                           <button onClick={() => { setShowKasbonModal(true); }} className="px-3 py-2 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 text-red-600 dark:text-red-400 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-red-100 dark:border-red-900/30">
                              <DollarSign className="w-3 h-3" /> Tambah Kasbon
                           </button>
                           <button onClick={() => { setShowFineModal(true); }} className="px-3 py-2 bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 text-orange-600 dark:text-orange-400 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-1.5 transition-all active:scale-95 border border-orange-100 dark:border-orange-900/30">
                              <AlertCircle className="w-3 h-3" /> Terbitkan Denda
                           </button>
                        </div>

                        <div>
                           <label className="text-[9px] font-black uppercase text-muted">Potongan Lainnya</label>
                           <div className="flex flex-col gap-2 mt-1">
                              <input type="number" value={adjOtherDeduct} onChange={e=>setAdjOtherDeduct(e.target.value)} placeholder="Nominal" className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light rounded-xl p-2.5 font-black text-xs text-red-600 outline-none"/>
                              <input type="text" value={adjOtherDeductNotes} onChange={e=>setAdjOtherDeductNotes(e.target.value)} placeholder="Catatan potongan..." className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light rounded-xl p-2.5 font-bold text-xs outline-none"/>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Footer Controls With Persistent Total */}
               <div className="bg-white dark:bg-gray-900 p-6 border-t border-border-light dark:border-border-dark flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.04)]">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                     <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-lg flex flex-col min-w-[200px]">
                        <span className="text-[8px] font-black uppercase tracking-widest opacity-70">Gaji Bersih Akhir</span>
                        <span className="text-xl font-black">Rp {getComputedNetLive().toLocaleString('id-ID')}</span>
                     </div>
                     <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-bold text-emerald-600">Siap Ditransfer</span>
                     </div>
                  </div>

                  <div className="flex flex-wrap gap-3 w-full md:w-auto justify-end">
                     <button onClick={()=>setShowDetailModal(false)} className="px-5 py-3 text-muted hover:text-slate-900 font-black text-xs uppercase tracking-widest">Batal</button>
                     <button onClick={() => saveSalaryRecord(false)} disabled={processing} className="px-5 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-slate-900 dark:text-white rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95">
                        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4"/>} Draf
                     </button>
                     <button onClick={() => {
                        triggerConfirm(
                           "Kunci & Transfer Gaji?", 
                           "Sistem akan menandai pembayaran ini sebagai LUNAS, mengunci data periode berjalan agar tidak bisa diubah lagi, dan mengirimkan notifikasi WhatsApp otomatis.", 
                           "primary", 
                           () => saveSalaryRecord(true)
                        );
                     }} disabled={processing} className="px-6 py-3.5 bg-slate-900 hover:bg-black dark:bg-white dark:text-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all active:scale-95">
                        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4"/>} Kunci & Transfer
                     </button>
                  </div>
               </div>
            </div>
         )}
      </BaseModal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: PENGATURAN TARIF DASAR (RATES)                         */}
      {/* ------------------------------------------------------------- */}
      <BaseModal isOpen={showRateModal && !!selectedProfile} onClose={() => setShowRateModal(false)} size="md">
         {selectedProfile && (
            <div>
               <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mb-1 uppercase"><Calculator className="w-5 h-5 text-orange-600" /> Atur Tarif Dasar</h3>
               <p className="text-xs font-bold text-muted mb-6">Tentukan standar pendapatan per hari untuk <b>{selectedProfile.full_name}</b>.</p>
               
               <div className="space-y-4">
                  <div>
                     <label className="text-[9px] font-black uppercase text-muted ml-1">Gaji Pokok Per Hari Kerja</label>
                     <input placeholder="Masukkan nominal..." aria-label="Gaji Pokok" type="number" value={editDailyWage} onChange={e=>setEditDailyWage(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light rounded-xl p-3.5 font-black text-sm outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"/>
                  </div>
                  <div>
                     <label className="text-[9px] font-black uppercase text-muted ml-1">Upah Lembur Per Jam</label>
                     <input placeholder="Masukkan nominal..." aria-label="Lembur" type="number" value={editOvertimeRate} onChange={e=>setEditOvertimeRate(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light rounded-xl p-3.5 font-black text-sm outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-white"/>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="text-[9px] font-black uppercase text-muted ml-1">Tunj. Makan / Hari</label>
                        <input placeholder="0" aria-label="Makan" type="number" value={editMealAllow} onChange={e=>setEditMealAllow(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light rounded-xl p-3.5 font-black text-sm outline-none text-slate-900 dark:text-white"/>
                     </div>
                     <div>
                        <label className="text-[9px] font-black uppercase text-muted ml-1">Tunj. Transport / Hari</label>
                        <input placeholder="0" aria-label="Transport" type="number" value={editTransAllow} onChange={e=>setEditTransAllow(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light rounded-xl p-3.5 font-black text-sm outline-none text-slate-900 dark:text-white"/>
                     </div>
                  </div>
                  <div>
                     <label className="text-[9px] font-black uppercase text-muted ml-1">Tunjangan Tetap Jabatan (Bulanan)</label>
                     <input placeholder="0" aria-label="Tunjangan" type="number" value={editFixedAllow} onChange={e=>setEditFixedAllow(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light rounded-xl p-3.5 font-black text-sm outline-none text-slate-900 dark:text-white"/>
                  </div>

                  <div className="flex gap-3 pt-4">
                     <button onClick={()=>setShowRateModal(false)} className="flex-1 py-3.5 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 text-muted rounded-xl font-black text-xs uppercase">Batal</button>
                     <button onClick={handleSaveRates} disabled={processing} className="flex-1 py-3.5 bg-slate-900 text-white rounded-xl font-black text-xs uppercase flex justify-center items-center gap-2">
                        {processing ? <Loader2 className="w-4 h-4 animate-spin"/> : "Simpan"}
                     </button>
                  </div>
               </div>
            </div>
         )}
      </BaseModal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: TAMBAH KASBON                                         */}
      {/* ------------------------------------------------------------- */}
      <BaseModal isOpen={showKasbonModal && !!selectedProfile} onClose={() => setShowKasbonModal(false)} size="sm">
         {selectedProfile && (
            <div>
               <h3 className="text-lg font-black text-red-600 flex items-center gap-2 mb-1 uppercase"><DollarSign className="w-5 h-5" /> Catat Kasbon Baru</h3>
               <p className="text-[10px] font-bold text-muted mb-6 uppercase tracking-wider">Karyawan: {selectedProfile.full_name}</p>
               
               <div className="space-y-4">
                  <div>
                     <label className="text-[9px] font-black uppercase text-muted">Nominal Rupiah</label>
                     <input type="number" value={kasbonAmount} onChange={e=>setKasbonAmount(e.target.value)} placeholder="0" className="w-full bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-3.5 font-black text-base text-red-600 outline-none"/>
                  </div>
                  <div>
                     <label className="text-[9px] font-black uppercase text-muted">Keterangan Alasan</label>
                     <textarea value={kasbonNotes} onChange={e=>setKasbonNotes(e.target.value)} placeholder="Tulis keterangan..." className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light rounded-xl p-3 text-xs font-bold outline-none min-h-[80px] text-slate-900 dark:text-white"/>
                  </div>
                  <button onClick={handleAddStandaloneKasbon} disabled={processing} className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase flex justify-center items-center gap-2 shadow-lg shadow-red-600/20">
                     {processing ? <Loader2 className="w-4 h-4 animate-spin"/> : "Terbitkan Kasbon"}
                  </button>
               </div>
            </div>
         )}
      </BaseModal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: TAMBAH DENDA                                          */}
      {/* ------------------------------------------------------------- */}
      <BaseModal isOpen={showFineModal && !!selectedProfile} onClose={() => setShowFineModal(false)} size="sm">
         {selectedProfile && (
            <div>
               <h3 className="text-lg font-black text-orange-600 flex items-center gap-2 mb-1 uppercase"><AlertCircle className="w-5 h-5" /> Terbitkan Denda</h3>
               <p className="text-[10px] font-bold text-muted mb-6 uppercase tracking-wider">Karyawan: {selectedProfile.full_name}</p>
               
               <div className="space-y-4">
                  <div>
                     <label className="text-[9px] font-black uppercase text-muted">Nominal Denda</label>
                     <input type="number" value={fineAmount} onChange={e=>setFineAmount(e.target.value)} placeholder="0" className="w-full bg-orange-50 dark:bg-orange-950/20 border border-orange-200 rounded-xl p-3.5 font-black text-base text-orange-600 outline-none"/>
                  </div>
                  <div>
                     <label className="text-[9px] font-black uppercase text-muted">Kategori Pelanggaran</label>
                     <select aria-label="Kategori Denda" value={fineReason} onChange={e=>setFineReason(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light rounded-xl p-3 text-xs font-black uppercase outline-none text-slate-900 dark:text-white">
                        <option>Keterlambatan</option>
                        <option>Pelanggaran SOP</option>
                        <option>Kerusakan Aset</option>
                        <option>Absen Tanpa Keterangan</option>
                        <option>Lainnya</option>
                     </select>
                  </div>
                  <div>
                     <label className="text-[9px] font-black uppercase text-muted">Catatan Detail</label>
                     <textarea value={fineNotes} onChange={e=>setFineNotes(e.target.value)} placeholder="Keterangan detail denda..." className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light rounded-xl p-3 text-xs font-bold outline-none min-h-[80px] text-slate-900 dark:text-white"/>
                  </div>
                  <button onClick={handleAddStandaloneFine} disabled={processing} className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black text-xs uppercase flex justify-center items-center gap-2 shadow-lg shadow-orange-600/20">
                     {processing ? <Loader2 className="w-4 h-4 animate-spin"/> : "Simpan Denda"}
                  </button>
               </div>
            </div>
         )}
      </BaseModal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: PENGATURAN DATA PEMBAYARAN / REKENING                  */}
      {/* ------------------------------------------------------------- */}
      <BaseModal isOpen={showPaymentModal && !!selectedProfile} onClose={() => setShowPaymentModal(false)} size="md" showCloseButton={false}>
         {selectedProfile && (
            <div>
               <div className="flex justify-between items-start mb-6">
                  <div>
                     <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-tight"><CreditCard className="w-6 h-6 text-blue-600" /> Rekening Karyawan</h3>
                     <p className="text-[10px] font-bold text-muted uppercase tracking-wider mt-1">Data Pembayaran: {selectedProfile.full_name}</p>
                  </div>
                  <button onClick={()=>setShowPaymentModal(false)} title="Tutup Modal" aria-label="Tutup" className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-muted hover:text-red-500 transition-colors"><X className="w-5 h-5"/></button>
               </div>

               <div className="space-y-5">
                  {/* Dropdown Jenis */}
                  <div>
                     <label className="text-[9px] font-black uppercase text-muted mb-1.5 block ml-1">Metode Utama Pembayaran</label>
                     <select value={payPref} onChange={e=>setPayPref(e.target.value)} title="Pilih Metode Pembayaran Utama" className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light rounded-xl p-3.5 font-black text-sm uppercase tracking-wider outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white">
                        <option value="tunai">Tunai Langsung (Cash)</option>
                        <option value="bank">Transfer Bank Indonesia</option>
                        <option value="wallet">E-Wallet / Dompet Digital</option>
                        <option value="lain">Metode Lainnya</option>
                     </select>
                  </div>

                  {/* DYNAMIC SECTION: BANK */}
                  {payPref === "bank" && (
                     <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} className="space-y-4 p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                        <div>
                           <label className="text-[9px] font-black uppercase text-blue-700 dark:text-blue-400 mb-1 block ml-1">Pilih Nama Bank</label>
                           <select value={payBank} onChange={e=>setPayBank(e.target.value)} title="Daftar Nama Bank Indonesia" className="w-full bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900/50 rounded-xl p-3 font-black text-xs outline-none text-slate-900 dark:text-white">
                              <option value="">-- Pilih Bank --</option>
                              <optgroup label="BANK BUMN">
                                 {BANK_BUMN.map(b => <option key={b} value={b}>{b}</option>)}
                              </optgroup>
                              <optgroup label="BANK SWASTA NASIONAL">
                                 {BANK_SWASTA.map(b => <option key={b} value={b}>{b}</option>)}
                              </optgroup>
                              <optgroup label="BANK DAERAH (BPD)">
                                 {BANK_DAERAH.map(b => <option key={b} value={b}>{b}</option>)}
                              </optgroup>
                              <optgroup label="BANK DIGITAL">
                                 {BANK_DIGITAL.map(b => <option key={b} value={b}>{b}</option>)}
                              </optgroup>
                           </select>
                        </div>
                        <div>
                           <label className="text-[9px] font-black uppercase text-blue-700 dark:text-blue-400 mb-1 block ml-1">Nomor Rekening</label>
                           <input value={payAccNum} onChange={e=>setPayAccNum(e.target.value)} placeholder="Masukkan No Rek..." className="w-full bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900/50 rounded-xl p-3 font-black text-base tracking-widest outline-none text-slate-900 dark:text-white"/>
                        </div>
                        <div>
                           <label className="text-[9px] font-black uppercase text-blue-700 dark:text-blue-400 mb-1 block ml-1">Cabang (Opsional)</label>
                           <input value={payBranch} onChange={e=>setPayBranch(e.target.value)} placeholder="Cabang Bank..." className="w-full bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900/50 rounded-xl p-3 font-bold text-xs outline-none text-slate-900 dark:text-white"/>
                        </div>
                     </motion.div>
                  )}

                  {/* DYNAMIC SECTION: WALLET */}
                  {payPref === "wallet" && (
                     <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} className="space-y-4 p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                        <div>
                           <label className="text-[9px] font-black uppercase text-emerald-700 dark:emerald-400 mb-1 block ml-1">Platform E-Wallet</label>
                           <select value={payWallet} onChange={e=>setPayWallet(e.target.value)} title="Pilih Platform E-Wallet" className="w-full bg-white dark:bg-gray-800 border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-3 font-black text-xs uppercase outline-none text-slate-900 dark:text-white">
                              <option value="">-- Pilih Wallet --</option>
                              {E_WALLETS.map(w => <option key={w} value={w}>{w}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-400 mb-1 block ml-1">Nomor HP / ID Akun</label>
                           <input value={payWalletNum} onChange={e=>setPayWalletNum(e.target.value)} placeholder="08xxxxxxxxxx" className="w-full bg-white dark:bg-gray-800 border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-3 font-black text-base tracking-widest outline-none text-slate-900 dark:text-white"/>
                        </div>
                     </motion.div>
                  )}

                  {/* DYNAMIC SECTION: LAINNYA */}
                  {payPref === "lain" && (
                     <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700">
                        <div>
                           <label className="text-[9px] font-black uppercase text-muted mb-1 block ml-1">Keterangan Metode (Isi Manual)</label>
                           <input value={payOtherText} onChange={e=>setPayOtherText(e.target.value)} placeholder="Contoh: Kantor Pos, Transfer Antar Cabang..." className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl p-3 font-black text-xs outline-none text-slate-900 dark:text-white"/>
                        </div>
                        <div>
                           <label className="text-[9px] font-black uppercase text-muted mb-1 block ml-1">ID Referensi / No Rek</label>
                           <input value={payAccNum} onChange={e=>setPayAccNum(e.target.value)} placeholder="Nomor referensi jika ada..." className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl p-3 font-bold text-xs outline-none text-slate-900 dark:text-white"/>
                        </div>
                     </motion.div>
                  )}

                  {/* Common Field: ATAS NAMA */}
                  {payPref !== "tunai" && (
                     <motion.div initial={{opacity:0}} animate={{opacity:1}} className="pt-1">
                        <label className="text-[9px] font-black uppercase text-muted mb-1 block ml-1">Atas Nama Pemilik Rekening</label>
                        <input value={payAccHolder} onChange={e=>setPayAccHolder(e.target.value)} placeholder="Nama Sesuai Identitas..." className="w-full bg-gray-50 dark:bg-gray-800 border border-border-light rounded-xl p-3 font-black text-sm outline-none focus:border-slate-400 text-slate-900 dark:text-white"/>
                     </motion.div>
                  )}

                  {/* TUNAI INFO */}
                  {payPref === "tunai" && (
                     <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl text-center border border-amber-100 dark:border-amber-900/20">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-500">Sistem akan menandai pembayaran gajian ini dibayarkan secara langsung dalam bentuk Tunai / Cash.</p>
                     </div>
                  )}

                  <div className="pt-4">
                     <button onClick={handleSavePaymentMethod} disabled={processing} className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-xs uppercase tracking-widest flex justify-center items-center gap-2 shadow-xl transition-all active:scale-95 disabled:opacity-70">
                        {processing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Simpan Data Rekening
                     </button>
                  </div>
               </div>
            </div>
         )}
      </BaseModal>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: UNIVERSAL PREMIUM CONFIRMATION SYSTEM                  */}
      {/* ------------------------------------------------------------- */}
      <BaseModal isOpen={showUniversalConfirm} onClose={() => setShowUniversalConfirm(false)} size="sm" showCloseButton={false}>
         <div className="text-center">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${confirmConfig.type === 'danger' ? 'bg-red-50 text-red-600 dark:bg-red-950/30' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/30'}`}>
               {confirmConfig.type === 'danger' ? <XCircle className="w-8 h-8"/> : <Shield className="w-8 h-8"/>}
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 uppercase">{confirmConfig.title}</h3>
            <p className="text-xs font-medium text-muted leading-relaxed mb-8 px-2">{confirmConfig.msg}</p>
            
            <div className="flex gap-3">
               <button onClick={()=>setShowUniversalConfirm(false)} className="flex-1 py-3.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 text-muted dark:text-gray-300 rounded-xl font-black text-xs uppercase transition-all">
                  Batal
               </button>
               <button 
                  onClick={() => {
                     confirmConfig.onConfirm();
                     setShowUniversalConfirm(false);
                  }} 
                  className={`flex-1 py-3.5 text-white rounded-xl font-black text-xs uppercase shadow-lg transition-all active:scale-95 ${confirmConfig.type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' : 'bg-slate-900 hover:bg-black shadow-slate-900/20'}`}
               >
                  Lanjutkan
               </button>
            </div>
         </div>
      </BaseModal>

    </div>
  );
}
