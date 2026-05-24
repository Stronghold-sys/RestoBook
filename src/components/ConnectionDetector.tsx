"use client";

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ConnectionDetector() {
  const [isOnline, setIsOnline] = useState(true);
  const [showRestored, setShowRestored] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const handleOnline = async () => {
      // Double check internet access
      setChecking(true);
      try {
        const res = await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store' });
        if (res.ok) {
          setIsOnline(true);
          setShowRestored(true);
          setTimeout(() => {
            setShowRestored(false);
            window.location.reload();
          }, 1500);
        } else {
          setIsOnline(false);
        }
      } catch (e) {
        setIsOnline(false);
      } finally {
        setChecking(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Background polling when offline to detect recovery automatically in real-time
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isOnline) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store' });
        if (res.ok) {
          setIsOnline(true);
          setShowRestored(true);
          setTimeout(() => {
            setShowRestored(false);
            window.location.reload();
          }, 1500);
        }
      } catch (e) {
        // Still offline
      }
    }, 3000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isOnline]);

  const manualCheck = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-store' });
      if (res.ok) {
        setIsOnline(true);
        setShowRestored(true);
        setTimeout(() => {
          setShowRestored(false);
          window.location.reload();
        }, 1500);
      } else {
        setIsOnline(false);
      }
    } catch (e) {
      setIsOnline(false);
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {/* Offline Banner */}
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-0 left-0 right-0 z-[10000] bg-red-600 text-white py-3 px-4 shadow-lg text-center flex items-center justify-center gap-3 font-semibold text-sm select-none border-b border-red-500"
          >
            <WifiOff className="w-5 h-5 animate-pulse shrink-0" />
            <span>Koneksi internet Anda terputus. Menunggu terhubung kembali...</span>
            <button 
              onClick={manualCheck} 
              disabled={checking}
              className="ml-3 px-3 py-1 bg-white/20 hover:bg-white/30 active:scale-95 transition-all text-xs font-black uppercase rounded-lg flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              Coba Lagi
            </button>
          </motion.div>
        )}

        {/* Restored Connection Banner */}
        {isOnline && showRestored && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-0 left-0 right-0 z-[10000] bg-emerald-600 text-white py-3 px-4 shadow-lg text-center flex items-center justify-center gap-3 font-semibold text-sm select-none border-b border-emerald-500"
          >
            <Wifi className="w-5 h-5 shrink-0" />
            <span>Koneksi Terhubung Kembali. Semua sistem kembali online!</span>
          </motion.div>
        )}

        {/* Offline Glassmorphic Overlay */}
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-slate-900/40 backdrop-blur-[6px] flex flex-col items-center justify-center p-6 text-center select-none"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring' }}
              className="max-w-md w-full bg-white dark:bg-card-dark rounded-3xl p-10 shadow-2xl border border-border-light dark:border-border-dark space-y-6"
            >
              <div className="w-20 h-20 bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto shadow-md">
                <WifiOff className="w-10 h-10 animate-bounce" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-text-light dark:text-text-dark tracking-tight uppercase">Mode Offline Aktif</h3>
                <p className="text-muted text-sm leading-relaxed">
                  Kami mendeteksi perangkat Anda sedang tidak terhubung dengan internet. Harap periksa jaringan Wi-Fi atau data seluler Anda sebelum melanjutkan aktivitas pemesanan di RestoBook.
                </p>
              </div>
              <button
                onClick={manualCheck}
                disabled={checking}
                className="w-full py-4 bg-primary hover:bg-primary-hover disabled:opacity-55 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-primary/20"
              >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                {checking ? 'Memverifikasi Koneksi...' : 'Periksa Koneksi Sekarang'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
