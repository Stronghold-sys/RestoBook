import React, { useRef, useState, useEffect } from "react";
import { X, Camera, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export default function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");
  const [loading, setLoading] = useState(true);

  const startCamera = async (mode: "user" | "environment") => {
    setLoading(true);
    // Hentikan stream yang ada sebelum memulai baru
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setLoading(false);
    } catch (err: any) {
      console.error("Camera access error:", err);
      toast.error("Gagal mengakses kamera. Silakan berikan izin kamera pada browser/perangkat Anda.");
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    
    if (ctx) {
      // Gambar frame video ke canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `camera_${Date.now()}.jpg`, { type: "image/jpeg" });
          onCapture(file);
          stopCamera();
          onClose();
        } else {
          toast.error("Gagal mengambil gambar.");
        }
      }, "image/jpeg", 0.85);
    }
  };

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col justify-between bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/60 backdrop-blur-sm z-10">
        <h3 className="text-xs font-black tracking-widest uppercase">Kamera RestoBook</h3>
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onClose();
          }}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-white"
          aria-label="Tutup Kamera"
          title="Tutup"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Video Viewport */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs text-gray-400">Menyiapkan kamera...</p>
          </div>
        )}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover max-h-[85vh]"
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
        />
      </div>

      {/* Bottom Controls */}
      <div className="p-6 bg-black/80 backdrop-blur-sm flex items-center justify-around z-10">
        {/* Toggle Camera (Front/Back) */}
        <button
          type="button"
          onClick={toggleFacingMode}
          className="p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all active:scale-95"
          title="Putar Kamera"
          aria-label="Putar Kamera"
        >
          <RefreshCw className="w-6 h-6" />
        </button>

        {/* Capture Button */}
        <button
          type="button"
          onClick={handleCapture}
          className="w-20 h-20 bg-white hover:bg-gray-200 rounded-full flex items-center justify-center text-black border-4 border-white shadow-2xl transition-all active:scale-90"
          title="Ambil Foto"
          aria-label="Ambil Foto"
        >
          <div className="w-16 h-16 rounded-full border-2 border-black flex items-center justify-center">
            <Camera className="w-7 h-7 text-black" />
          </div>
        </button>

        {/* Empty placeholder for alignment */}
        <div className="w-14 h-14" />
      </div>
    </div>
  );
}
