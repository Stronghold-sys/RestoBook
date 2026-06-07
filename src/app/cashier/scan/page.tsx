"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { 
  Camera, RefreshCw, CheckCircle, Search, User, Calendar, Clock, 
  Users, MapPin, Receipt, AlertCircle, Ban, ArrowRight, Printer, CheckSquare, XCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CashierScanPage() {
  const supabase = createClient();
  const router = useRouter();

  // Authentication & Authorization check
  const [authChecking, setAuthChecking] = useState(true);
  const [cashierProfile, setCashierProfile] = useState<any>(null);

  // QR Code Scanner State
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<any>(null);

  // Manual token input state
  const [manualToken, setManualToken] = useState("");
  const [loading, setLoading] = useState(false);

  // Scan result state
  const [reservation, setReservation] = useState<any>(null);
  const [bookingHistory, setBookingHistory] = useState<any[]>([]);

  // Meja (Table) options
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [checkInStatus, setCheckInStatus] = useState("arrived"); // arrived or seated
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Print slip state
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profile?.role !== 'cashier' && profile?.role !== 'admin') {
        toast.error("Akses ditolak. Halaman ini hanya untuk Kasir atau Admin.");
        return router.push("/unauthorized");
      }

      if (profile?.role === 'cashier') {
        const { data: openShift } = await supabase
          .from('shifts')
          .select('id')
          .eq('profile_id', profile.id)
          .eq('status', 'open')
          .maybeSingle();

        if (!openShift) {
          toast.error("Silakan buka shift terlebih dahulu di Dashboard utama untuk mengakses menu ini!");
          return router.push("/cashier/dashboard");
        }
      }

      setCashierProfile(profile);
      setAuthChecking(false);

      // Fetch all tables
      const { data: tbls } = await supabase
        .from('tables')
        .select('*')
        .order('table_number');
      setTables(tbls || []);
    };

    checkAccess();
  }, []);

  // Realtime subscription to reservation changes
  useEffect(() => {
    if (!reservation?.id) return;

    const channel = supabase
      .channel(`scan-reservation-update-${reservation.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reservations",
          filter: `id=eq.${reservation.id}`
        },
        async (payload: any) => {
          if (payload.new) {
            // Re-fetch detail to get populated fields
            const { data: updatedRes } = await supabase
              .from('reservations')
              .select('*, profiles:customer_id(*), tables(*)')
              .eq('id', reservation.id)
              .single();

            if (updatedRes) {
              setReservation({
                id: updatedRes.id,
                customer_id: updatedRes.customer_id,
                customer_name: updatedRes.profiles?.full_name || 'Pelanggan',
                phone: updatedRes.profiles?.phone || '-',
                guest_count: updatedRes.guest_count,
                reservation_date: updatedRes.reservation_date,
                reservation_time: updatedRes.reservation_time,
                status: updatedRes.status,
                notes: updatedRes.notes,
                table_id: updatedRes.table_id,
                table_number: updatedRes.tables?.table_number,
                checked_in_at: updatedRes.checked_in_at,
                seated_at: updatedRes.seated_at
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reservation?.id]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    setScanError(null);
    setScanning(true);
    setReservation(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const html5QrCode = new Html5Qrcode("reader");
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        async (decodedText) => {
          // Success callback
          stopScanner();
          handleVerifyToken(decodedText);
        },
        (errorMessage) => {
          // Failure callback, usually silent
        }
      );
    } catch (err: any) {
      console.error("Failed to start scanner:", err);
      setScanError("Kamera tidak dapat diakses. Pastikan izin kamera telah diberikan.");
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error("Failed to stop scanner:", err);
      }
    }
    setScanning(false);
  };

  const handleVerifyToken = async (token: string) => {
    setLoading(true);
    setReservation(null);
    setBookingHistory([]);

    try {
      const res = await fetch("/api/cashier/scan-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: token, action: "verify" })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memverifikasi QR Code");
      }

      setReservation(data.reservation);
      setBookingHistory(data.bookingHistory || []);
      setSelectedTableId(data.reservation.table_id || "");
      toast.success("Verifikasi Booking Berhasil!");
    } catch (err: any) {
      toast.error(err.message || "QR Code tidak valid");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckInSubmit = async () => {
    if (!reservation) return;
    setUpdatingStatus(true);

    try {
      const res = await fetch("/api/cashier/scan-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrToken: reservation.qr_token || manualToken || reservation.id, // QR token is standard
          action: "check_in",
          tableId: selectedTableId || null,
          status: checkInStatus
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memperbarui status check-in");
      }

      toast.success(`Check-In Berhasil! Status diubah menjadi ${checkInStatus === 'arrived' ? 'Arrived' : 'Seated'}`);
      
      // Update local reservation state
      setReservation((prev: any) => ({
        ...prev,
        status: checkInStatus,
        table_id: selectedTableId,
        table_number: tables.find(t => t.id === selectedTableId)?.table_number
      }));

      // Redirect to reservations management page with query param id
      router.push(`/cashier/reservations?id=${reservation.id}`);

    } catch (err: any) {
      toast.error(err.message || "Gagal memproses check-in");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      arrived: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      seated: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
      completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
      cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
    };
    return map[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusText = (status: string) => {
    const map: Record<string, string> = {
      pending: "Menunggu",
      confirmed: "Dikonfirmasi",
      arrived: "Arrived (Tiba)",
      seated: "Seated (Duduk)",
      completed: "Selesai",
      cancelled: "Dibatalkan"
    };
    return map[status] || status;
  };

  const getParsedNotes = (notesStr: string) => {
    try {
      return JSON.parse(notesStr);
    } catch (e) {
      return { catatan: notesStr };
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted">Memeriksa hak akses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 pb-24 text-text-light dark:text-text-dark">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black uppercase tracking-wide">Pindai QR Booking</h1>
        <p className="text-muted mt-1 text-sm sm:text-base">Scan tiket booking pelanggan RestoBook untuk memvalidasi kedatangan & check-in meja.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Section: Scanner & Manual Input */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-6 shadow-xl space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" /> Pemindai Kamera
            </h2>

            {/* Video Stream Container */}
            <div className="relative aspect-square w-full max-w-[320px] mx-auto overflow-hidden rounded-2xl border-2 border-dashed border-border-light dark:border-border-dark bg-black flex flex-col items-center justify-center text-center p-4">
              <div id="reader" className="absolute inset-0 w-full h-full object-cover" />
              
              {!scanning && (
                <div className="z-10 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
                    <Camera className="w-8 h-8" />
                  </div>
                  <p className="text-xs text-muted font-bold">Kamera mati</p>
                </div>
              )}

              {scanError && (
                <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-4 text-center space-y-2 z-20">
                  <AlertCircle className="w-8 h-8 text-rose-500" />
                  <p className="text-xs text-rose-400 font-bold leading-relaxed">{scanError}</p>
                  <button onClick={startScanner} className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase">Coba Lagi</button>
                </div>
              )}
            </div>

            {/* Scanner Action Button */}
            <div className="flex justify-center">
              {scanning ? (
                <button 
                  onClick={stopScanner}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-600/20"
                >
                  Hentikan Scan
                </button>
              ) : (
                <button 
                  onClick={startScanner}
                  className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  <Camera className="w-4 h-4" /> Mulai Scan Kamera
                </button>
              )}
            </div>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-border-light dark:border-border-dark"></div>
              <span className="flex-shrink mx-4 text-muted text-xs font-black uppercase">atau</span>
              <div className="flex-grow border-t border-border-light dark:border-border-dark"></div>
            </div>

            {/* Manual input */}
            <div className="space-y-2">
              <label htmlFor="manualToken" className="text-xs font-black uppercase text-muted ml-1">Input Token / Kode Booking Manual</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Receipt className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted" />
                  <input 
                    id="manualToken"
                    type="text" 
                    value={manualToken}
                    onChange={e => setManualToken(e.target.value)}
                    placeholder="Contoh: RTB-E35FA..."
                    className="w-full pl-12 pr-4 py-3.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl outline-none focus:ring-2 focus:ring-primary transition-all font-mono font-bold text-sm"
                  />
                </div>
                <button 
                  onClick={() => handleVerifyToken(manualToken.trim())}
                  disabled={loading || !manualToken.trim()}
                  className="px-5 py-3.5 bg-primary text-white rounded-2xl font-black hover:bg-primary-hover transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-primary/10 disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Cari
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Right Section: Details & Actions */}
        <div className="lg:col-span-7 space-y-6">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div 
                key="loading" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-12 text-center shadow-xl flex flex-col items-center justify-center h-full min-h-[400px]"
              >
                <RefreshCw className="w-12 h-12 animate-spin text-primary mb-4" />
                <h3 className="font-bold text-lg">Memproses Kode Booking...</h3>
                <p className="text-xs text-muted mt-1">Mengambil data validasi terenkripsi dari server backend.</p>
              </motion.div>
            ) : reservation ? (
              <motion.div 
                key="result" 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                
                {/* Main booking details card */}
                <div className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-6 sm:p-8 shadow-xl space-y-6">
                  
                  {/* Status header */}
                  <div className="flex justify-between items-center pb-4 border-b border-border-light dark:border-border-dark">
                    <div>
                      <span className="text-[10px] font-black uppercase text-muted tracking-wider">Nomor Booking</span>
                      <p className="font-mono font-black text-lg text-primary uppercase">#{reservation.id.substring(0, 8)}</p>
                    </div>
                    <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase ${getStatusBadge(reservation.status)}`}>
                      {getStatusText(reservation.status)}
                    </span>
                  </div>

                  {/* Core details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-muted">Nama Pelanggan</span>
                      <div className="flex items-center gap-2 font-bold">
                        <User className="w-4 h-4 text-primary shrink-0" />
                        <span>{reservation.customer_name}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-muted">Nomor Telepon</span>
                      <p className="font-bold">{reservation.phone}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-muted">Tanggal Booking</span>
                      <div className="flex items-center gap-2 font-bold">
                        <Calendar className="w-4 h-4 text-primary shrink-0" />
                        <span>{reservation.reservation_date}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-muted">Jam Datang</span>
                      <div className="flex items-center gap-2 font-bold">
                        <Clock className="w-4 h-4 text-primary shrink-0" />
                        <span>{reservation.reservation_time.substring(0, 5)} WIB</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-muted">Jumlah Tamu</span>
                      <div className="flex items-center gap-2 font-bold">
                        <Users className="w-4 h-4 text-primary shrink-0" />
                        <span>{reservation.guest_count} Orang</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-muted">Meja Saat Ini</span>
                      <div className="flex items-center gap-2 font-bold">
                        <MapPin className="w-4 h-4 text-primary shrink-0" />
                        <span>{reservation.table_number ? `Meja ${reservation.table_number}` : 'Belum Ditentukan'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  {reservation.notes && (
                    <div className="p-4 bg-background-light dark:bg-background-dark rounded-2xl text-xs space-y-1 border border-border-light dark:border-border-dark">
                      <span className="font-black uppercase text-muted">Catatan Pelanggan:</span>
                      <p className="text-muted leading-relaxed font-semibold italic">
                        &ldquo;{getParsedNotes(reservation.notes).catatan || getParsedNotes(reservation.notes).catatan_batal || reservation.notes}&rdquo;
                      </p>
                    </div>
                  )}

                  {/* Check-In Controls */}
                  {['pending', 'confirmed', 'arrived', 'seated'].includes(reservation.status) && (
                    <div className="pt-6 border-t border-border-light dark:border-border-dark space-y-4">
                      <h3 className="font-bold text-sm uppercase tracking-wider text-muted">Kontrol Kedatangan / Meja</h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Status select */}
                        <div className="space-y-1.5">
                          <label htmlFor="arrival-status-select" className="text-xs font-bold text-muted ml-1">Status Kedatangan</label>
                          <select 
                            id="arrival-status-select"
                            value={checkInStatus}
                            onChange={e => setCheckInStatus(e.target.value)}
                            className="w-full p-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm font-bold"
                          >
                            <option value="arrived">Arrived (Tiba)</option>
                            <option value="seated">Seated (Duduk)</option>
                            <option value="completed">Completed (Selesai)</option>
                            <option value="cancelled">Cancelled (Batal)</option>
                          </select>
                        </div>

                        {/* Table Select */}
                        <div className="space-y-1.5">
                          <label htmlFor="table-assign-select" className="text-xs font-bold text-muted ml-1">Assign Nomor Meja</label>
                          <select 
                            id="table-assign-select"
                            value={selectedTableId}
                            onChange={e => setSelectedTableId(e.target.value)}
                            className="w-full p-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm font-bold"
                          >
                            <option value="">-- Pilih Meja --</option>
                            {tables.map(t => (
                              <option key={t.id} value={t.id}>
                                Meja {t.table_number} (Kapasitas: {t.capacity} Tamu)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button 
                          onClick={handleCheckInSubmit}
                          disabled={updatingStatus}
                          className="flex-1 py-4 bg-primary hover:bg-primary-hover text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {updatingStatus ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Check-In Sekarang
                        </button>
                        <button 
                          onClick={() => {
                            setReservation(null);
                            setManualToken("");
                            setBookingHistory([]);
                          }}
                          className="px-5 py-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 rounded-2xl font-black text-xs uppercase hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-all flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-4 h-4" /> Batalkan
                        </button>
                        <button 
                          onClick={() => setShowPrintModal(true)}
                          className="px-5 py-4 bg-gray-100 dark:bg-gray-800 text-muted rounded-2xl font-black text-xs uppercase hover:bg-gray-200 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Printer className="w-4 h-4" /> Cetak Slip
                        </button>
                      </div>

                    </div>
                  )}

                </div>

                {/* Customer History Card */}
                {bookingHistory.length > 0 && (
                  <div className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-6 shadow-xl space-y-4">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-muted">Riwayat Reservasi Terkait</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-border-light dark:border-border-dark text-muted font-bold">
                            <th className="py-2.5">Tanggal</th>
                            <th className="py-2.5">Jam</th>
                            <th className="py-2.5">Tamu</th>
                            <th className="py-2.5">Meja</th>
                            <th className="py-2.5 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light/40 dark:divide-border-dark/40">
                          {bookingHistory.map(h => (
                            <tr key={h.id} className="text-muted hover:text-text-light dark:hover:text-text-dark">
                              <td className="py-2.5 font-medium">{h.date}</td>
                              <td className="py-2.5">{h.time.substring(0, 5)}</td>
                              <td className="py-2.5">{h.guests} org</td>
                              <td className="py-2.5">{h.tableNumber ? `Meja ${h.tableNumber}` : '-'}</td>
                              <td className="py-2.5 text-right">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${getStatusBadge(h.status)}`}>
                                  {getStatusText(h.status)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </motion.div>
            ) : (
              <motion.div 
                key="empty" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }}
                className="bg-card-light dark:bg-card-dark rounded-3xl border border-border-light dark:border-border-dark p-12 text-center shadow-xl flex flex-col items-center justify-center h-full min-h-[400px]"
              >
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-muted mb-4">
                  <Receipt className="w-8 h-8 opacity-40" />
                </div>
                <h3 className="font-bold text-lg">Belum Ada Tiket Booking yang Dimuat</h3>
                <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                  Silakan scan QR Code tiket pelanggan menggunakan kamera di sebelah kiri, atau masukkan token booking secara manual.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>

      {/* Print Confirmation Slip Modal */}
      <AnimatePresence>
        {showPrintModal && reservation && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white text-black rounded-[2rem] p-6 w-full max-w-sm shadow-2xl space-y-6 flex flex-col"
            >
              {/* Slip Content to print */}
              <div id="print-slip-area" className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs space-y-3 font-mono">
                <div className="text-center border-b border-dashed border-gray-300 pb-3">
                  <h4 className="font-bold text-sm">RESTOBOOK</h4>
                  <p className="text-[10px] text-gray-500">Bukti Kedatangan Reservasi Meja</p>
                  <p className="text-[9px] text-gray-400 mt-1">{new Date().toLocaleString('id-ID')}</p>
                </div>
                <div className="space-y-1.5">
                  <p><strong>Booking ID:</strong> #{reservation.id.substring(0, 8).toUpperCase()}</p>
                  <p><strong>Pelanggan:</strong> {reservation.customer_name}</p>
                  <p><strong>Jml Tamu:</strong> {reservation.guest_count} Orang</p>
                  <p><strong>Waktu Booking:</strong> {reservation.reservation_date} | {reservation.reservation_time.substring(0, 5)}</p>
                  <p><strong>Assigned Meja:</strong> Meja {reservation.table_number || selectedTableId ? tables.find(t => t.id === selectedTableId)?.table_number : '-'}</p>
                  <p><strong>Status Baru:</strong> {checkInStatus.toUpperCase()}</p>
                </div>
                <div className="border-t border-dashed border-gray-300 pt-3 text-center text-[10px]">
                  <p>Kasir: {cashierProfile?.full_name || 'Kasir'}</p>
                  <p className="text-[8px] text-gray-400 mt-1">Harap tunjukkan slip ini ke staff pelayan.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowPrintModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs uppercase"
                >
                  Tutup
                </button>
                <button 
                  onClick={() => {
                    const printContent = document.getElementById("print-slip-area")?.innerHTML;
                    const originalContent = document.body.innerHTML;
                    if (printContent) {
                      const printWindow = window.open('', '_blank');
                      printWindow?.document.write(`
                        <html>
                          <head><title>Cetak Slip Booking</title></head>
                          <body style="font-family: monospace; padding: 20px;" onload="window.print();window.close();">
                            ${printContent}
                          </body>
                        </html>
                      `);
                      printWindow?.document.close();
                    }
                  }}
                  className="flex-2 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Cetak Slip
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
