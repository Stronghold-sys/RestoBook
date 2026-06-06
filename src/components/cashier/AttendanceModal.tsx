"use client";

import { useEffect, useRef, useState } from "react";

import { Camera, RefreshCw, CheckCircle2, DollarSign, Loader2, AlertCircle, ShieldCheck, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import BaseModal from "@/components/BaseModal";
import { createAuditLog } from "@/lib/audit";

interface AttendanceModalProps {
  onSuccess: (shiftId: string) => void;
  onClose?: () => void;
  substituteDetails?: any;
  workShiftId?: string;
}

export default function AttendanceModal({ onSuccess, onClose, substituteDetails, workShiftId }: AttendanceModalProps) {
  const [step, setStep] = useState<1 | 2>(1); // 1: Photo, 2: Initial Cash
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [initialCash, setInitialCash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (step === 1 && !capturedImage) {
      startCamera();
    }
    return () => stopCamera();
  }, [step, capturedImage]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user" }, 
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setCameraError("Gagal mengakses kamera. Pastikan izin kamera sudah diberikan.");
    }
  };

  const stopCamera = () => {
    // 1. Stop dari state stream
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
    
    // 2. Stop langsung dari video element (Back up jika state terlambat)
    if (videoRef.current && videoRef.current.srcObject) {
      const activeStream = videoRef.current.srcObject as MediaStream;
      activeStream.getTracks().forEach(track => {
        track.stop();
      });
      videoRef.current.srcObject = null;
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);
      
      const dataUrl = canvas.toDataURL("image/jpeg");
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  const handleSubmit = async () => {
    if (!capturedImage || !initialCash) {
      toast.error("Foto dan modal awal wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak ditemukan");

      // 1. Ambil profile_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error("Profil tidak ditemukan");

      // 2. Upload Foto (Base64 to Storage)
      const fileName = `attendance/${user.id}/${Date.now()}.jpg`;
      const base64Data = capturedImage.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const fileBlob = new Blob([byteArray], { type: 'image/jpeg' });

      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(fileName, fileBlob);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(fileName);
      const photoUrl = publicUrl;

      // 3. Simpan Absensi via API (Bypass RLS)
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          profileId: profile?.id,
          type: 'check_in',
          photoUrl: photoUrl,
          initialCash: initialCash,
          status: 'approved',
          location: 'Restoran (Cabang Utama)',
          workShiftId: workShiftId,
          notes: substituteDetails?.isSubstitute 
            ? `[TUGAS PENGGANTI] Bertugas menggantikan: ${substituteDetails.substituteFor || 'Staff'} (TERHITUNG LEMBUR)` 
            : null
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menyimpan data absensi");

      toast.success("Absensi & Buka Shift Berhasil!");
      await createAuditLog('open_shift', {
        shiftId: result.shiftId,
        cashierId: profile.id,
        initialCash: parseFloat(initialCash) || 0,
        workShiftId: workShiftId || null
      });
      onSuccess(result.shiftId);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      stopCamera(); // Pastikan mati saat selesai proses
      setSubmitting(false);
    }
  };

  return (
    <BaseModal
      isOpen={true}
      onClose={onClose || (() => {})}
      showCloseButton={false}
      noPadding
      size="md"
    >
        <div className="bg-primary p-8 text-white text-center relative overflow-hidden">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors z-20"
              title="Tutup"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
          <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight">Otentikasi Kasir</h2>
          <p className="text-white/70 text-sm mt-1">Selesaikan absensi untuk memulai tugas hari ini</p>
        </div>

        <div className="p-8">
          <div className="flex justify-center gap-4 mb-8">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${step === 1 ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-muted'}`}>
              <Camera className="w-4 h-4" /> 1. Ambil Foto
            </div>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${step === 2 ? 'bg-primary text-white shadow-lg' : 'bg-gray-100 text-muted'}`}>
              <DollarSign className="w-4 h-4" /> 2. Modal Awal
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <div className="aspect-video bg-black rounded-3xl overflow-hidden relative border-4 border-gray-100 dark:border-gray-800 shadow-inner">
                {!capturedImage ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover mirror" />
                    {cameraError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gray-900/90 text-white">
                        <AlertCircle className="w-12 h-12 text-secondary mb-4" />
                        <p className="font-bold">{cameraError}</p>
                        <button onClick={startCamera} className="mt-4 px-6 py-2 bg-primary rounded-xl font-bold">Coba Lagi</button>
                      </div>
                    )}
                  </>
                ) : (
                  <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {!capturedImage ? (
                <button 
                  onClick={takePhoto}
                  disabled={!!cameraError}
                  className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-3 uppercase tracking-widest"
                >
                  <Camera className="w-6 h-6" /> Ambil Foto Sekarang
                </button>
              ) : (
                <div className="flex gap-4">
                  <button 
                    onClick={() => setCapturedImage(null)}
                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-muted rounded-2xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Ulangi Foto
                  </button>
                  <button 
                    onClick={() => {
                      stopCamera();
                      setStep(2);
                    }}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-black hover:bg-primary-hover transition-all flex items-center justify-center gap-2"
                  >
                    Lanjut <CheckCircle2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-primary/5 p-6 rounded-3xl border border-primary/20 text-center">
                <p className="text-sm text-muted mb-4 font-medium">Masukkan jumlah uang tunai yang ada di laci kasir saat ini</p>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-primary text-xl">Rp</span>
                  <input 
                    type="number" 
                    value={initialCash}
                    onChange={(e) => setInitialCash(e.target.value)}
                    placeholder="0"
                    className="w-full pl-16 pr-6 py-5 bg-white dark:bg-gray-800 border-2 border-primary/20 rounded-2xl outline-none focus:border-primary text-2xl font-black transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setStep(1)}
                  disabled={submitting}
                  className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-muted rounded-2xl font-bold hover:bg-gray-200 transition-all"
                >
                  Kembali
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={submitting || !initialCash}
                  className="flex-2 py-4 bg-primary text-white rounded-2xl font-black hover:bg-primary-hover transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Mulai Tugas Kasir <CheckCircle2 className="w-6 h-6" /></>}
                </button>
              </div>
            </div>
          )}
        </div>
        
        <p className="text-center p-6 text-[10px] text-muted uppercase font-bold tracking-widest border-t border-border-light dark:border-border-dark">
          Keamanan RestoBook - Data Absensi Dienkripsi
        </p>
    </BaseModal>
  );
}
