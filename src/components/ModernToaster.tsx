"use client";

import { useEffect, useState } from 'react';
import { useToaster, toast, resolveValue, Toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Info, Bell } from 'lucide-react';
import { useAudioStore } from '@/store/useAudioStore';

// Custom component for individual toast item
function ToastMessage({ toast: t }: { toast: Toast }) {
  const [isHovered, setIsHovered] = useState(false);
  const resolved = resolveValue(t.message, t);
  const messageText = resolved ? String(resolved) : '';
  const lowerMessage = messageText.toLowerCase();

  // Sub-classify toast types
  let visualType: 'success' | 'error' | 'warning' | 'info' | 'realtime' = 'info';
  if (t.type === 'success') {
    visualType = 'success';
  } else if (t.type === 'error') {
    visualType = 'error';
  }

  // Keywords to classify warnings
  const warningKeywords = [
    'belum lengkap', 'hampir habis', 'peringatan', 'konfirmasi diperlukan',
    'sesi anda', 'perhatian', 'mohon tunggu', 'batas', 'warning', 'ditangguhkan'
  ];
  if (warningKeywords.some(kw => lowerMessage.includes(kw))) {
    visualType = 'warning';
  }

  // Keywords to classify realtime events
  const realtimeKeywords = [
    'pesanan online baru', 'pesanan baru masuk', 'chat baru', 'pesan baru',
    'reservasi baru', 'pembayaran baru', 'realtime', 'lunas'
  ];
  if (realtimeKeywords.some(kw => lowerMessage.includes(kw))) {
    visualType = 'realtime';
  }

  // Play Web Audio sound feedback when mounted
  useEffect(() => {
    const isSoundEnabled = useAudioStore.getState().isCustomerSoundEnabled;
    if (!isSoundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.06, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };

      const now = ctx.currentTime;
      if (visualType === 'success') {
        playTone(523.25, now, 0.15); // C5
        playTone(659.25, now + 0.08, 0.25); // E5
      } else if (visualType === 'error') {
        playTone(392.00, now, 0.15); // G4
        playTone(311.13, now + 0.08, 0.3); // Eb4 (Minor feel)
      } else if (visualType === 'warning') {
        playTone(440.00, now, 0.2); // A4
      } else if (visualType === 'realtime') {
        playTone(587.33, now, 0.12); // D5
        playTone(880.00, now + 0.08, 0.35); // A5
      } else {
        playTone(523.25, now, 0.2); // C5
      }
    } catch (err) {
      console.warn("Web Audio API chime blocked:", err);
    }
  }, [visualType]);

  // Design styles and icon maps
  const styles = {
    success: {
      border: 'border-emerald-500/25 dark:border-emerald-500/35',
      text: 'text-emerald-950 dark:text-emerald-50',
      titleColor: 'text-emerald-500 dark:text-emerald-400',
      iconColor: 'text-emerald-500',
      progressBg: 'bg-emerald-500',
      shadow: 'shadow-[0_8px_30px_rgba(16,185,129,0.08)]',
      icon: <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-emerald-500" />
    },
    error: {
      border: 'border-rose-500/25 dark:border-rose-500/35',
      text: 'text-rose-950 dark:text-rose-50',
      titleColor: 'text-rose-500 dark:text-rose-400',
      iconColor: 'text-rose-500',
      progressBg: 'bg-rose-500',
      shadow: 'shadow-[0_8px_30px_rgba(244,63,94,0.08)]',
      icon: <XCircle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-rose-500" />
    },
    warning: {
      border: 'border-amber-500/25 dark:border-amber-500/35',
      text: 'text-amber-950 dark:text-amber-50',
      titleColor: 'text-amber-500 dark:text-amber-400',
      iconColor: 'text-amber-500',
      progressBg: 'bg-amber-500',
      shadow: 'shadow-[0_8px_30px_rgba(245,158,11,0.08)]',
      icon: <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-amber-500" />
    },
    info: {
      border: 'border-blue-500/25 dark:border-blue-500/35',
      text: 'text-blue-950 dark:text-blue-50',
      titleColor: 'text-blue-500 dark:text-blue-400',
      iconColor: 'text-blue-500',
      progressBg: 'bg-blue-500',
      shadow: 'shadow-[0_8px_30px_rgba(59,130,246,0.08)]',
      icon: <Info className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-blue-500" />
    },
    realtime: {
      border: 'border-violet-500/35 dark:border-violet-500/45',
      text: 'text-violet-950 dark:text-violet-50',
      titleColor: 'text-violet-500 dark:text-violet-400',
      iconColor: 'text-violet-500',
      progressBg: 'bg-violet-500',
      shadow: 'shadow-[0_12px_40px_rgba(139,92,246,0.2)] animate-toast-pulse-glow',
      icon: <Bell className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-violet-500 animate-bounce" />
    }
  };

  const styleConfig = styles[visualType];

  // Specific motion animations per type
  const animations: Record<'success' | 'error' | 'warning' | 'info' | 'realtime', any> = {
    success: {
      initial: { opacity: 0, y: -20, scale: 0.93 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, scale: 0.95 },
      transition: { type: 'spring', stiffness: 350, damping: 18 }
    },
    error: {
      initial: { opacity: 0, y: -20 },
      animate: { 
        opacity: 1, 
        y: 0,
        x: [0, -8, 8, -6, 6, -3, 3, 0],
        transition: { duration: 0.45, ease: 'easeInOut' }
      },
      exit: { opacity: 0, scale: 0.95 }
    },
    warning: {
      initial: { opacity: 0, y: -15 },
      animate: { 
        opacity: 1, 
        y: 0, 
        scale: [1, 1.03, 1],
        transition: { scale: { duration: 0.4 }, y: { type: 'spring', stiffness: 300, damping: 20 } }
      },
      exit: { opacity: 0, scale: 0.95 }
    },
    info: {
      initial: { opacity: 0, y: -30 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -20, transition: { duration: 0.15 } },
      transition: { duration: 0.25, ease: 'easeOut' }
    },
    realtime: {
      initial: { opacity: 0, y: -25, scale: 0.95 },
      animate: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, scale: 0.9, y: -10 },
      transition: { type: 'spring', stiffness: 400, damping: 15 }
    }
  };

  const currentAnim = animations[visualType];
  const toastDuration = t.duration || 4000;

  return (
    <motion.div
      {...currentAnim}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={0}
      role={visualType === 'error' ? 'alert' : 'status'}
      aria-live={visualType === 'error' ? 'assertive' : 'polite'}
      onKeyDown={(e) => {
        if (e.key === 'Escape') toast.dismiss(t.id);
      }}
      className={`w-[calc(100vw-24px)] xs:w-[350px] sm:w-[480px] md:w-[540px] bg-white/80 dark:bg-slate-900/85 backdrop-blur-xl border ${styleConfig.border} ${styleConfig.text} ${styleConfig.shadow} p-3.5 sm:p-5 rounded-2xl flex items-center gap-3 sm:gap-4 relative overflow-hidden transition-all duration-300 pointer-events-auto`}
    >
      {/* Icon Area */}
      <div className="flex-shrink-0 flex items-center justify-center">
        {styleConfig.icon}
      </div>

      {/* Message Area */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-black tracking-wider uppercase ${styleConfig.titleColor}`}>
          {visualType === 'success' ? 'Berhasil' : 
           visualType === 'error' ? 'Kesalahan' : 
           visualType === 'warning' ? 'Peringatan' : 
           visualType === 'realtime' ? 'Notifikasi Langsung' : 'Informasi'}
        </p>
        <p className="text-sm font-bold mt-0.5 text-text-light dark:text-text-dark leading-snug">
          {messageText}
        </p>
      </div>

      {/* Time Progress Bar */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100/50 dark:bg-gray-800/40"
      >
        <div 
          className={`h-full ${styleConfig.progressBg} animate-toast-shrink`}
          style={{
            animationDuration: `${toastDuration}ms`,
            animationPlayState: isHovered ? 'paused' : 'running'
          }}
        />
      </div>
    </motion.div>
  );
}

export default function ModernToaster() {
  const { toasts, handlers } = useToaster({
    duration: 4000
  });
  const { startPause, endPause } = handlers;

  // Queue logic: limit to 3 visible toasts concurrently
  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .slice(3) // Auto dismiss 4th and older toasts
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts]);

  return (
    <div 
      onMouseEnter={startPause}
      onMouseLeave={endPause}
      className="fixed top-0 left-0 right-0 z-[99999] flex flex-col items-center gap-3 p-4 pointer-events-none mt-safe-top"
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .mt-safe-top {
          top: calc(16px + env(safe-area-inset-top, 0px));
        }
      `}} />
      <AnimatePresence mode="popLayout">
        {toasts
          .filter((t) => t.visible)
          .map((t) => (
            <div key={t.id} className="flex justify-center w-full">
              <ToastMessage toast={t} />
            </div>
          ))}
      </AnimatePresence>
    </div>
  );
}
