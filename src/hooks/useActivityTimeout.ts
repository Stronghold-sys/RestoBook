import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export interface ActivityTimeoutOptions {
  role: string | null;
  onWarn?: (secondsRemaining: number) => void;
  onLogout?: () => void;
}

export function useActivityTimeout({ role, onWarn, onLogout }: ActivityTimeoutOptions) {
  const [warningActive, setWarningActive] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const warnTimerRef = useRef<NodeJS.Timeout | null>(null);
  const supabase = createClient();

  // Tentukan batas waktu tidak aktif berdasarkan peran (dalam menit)
  const getInactivityLimit = (userRole: string | null): number => {
    switch (userRole) {
      case 'admin':
        return 15;
      case 'cashier':
        return 20;
      case 'customer':
      default:
        return 30;
    }
  };

  const limitMinutes = getInactivityLimit(role);
  const limitMs = limitMinutes * 60 * 1000;
  const warningMs = limitMs - 60 * 1000; // Peringatan 1 menit sebelum habis

  const updateActivityCookie = () => {
    if (typeof window !== 'undefined') {
      const now = Date.now();
      document.cookie = `last_active_timestamp=${now}; path=/; secure; samesite=strict`;
    }
  };

  const handleLogoutFlow = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('API logout failed', e);
    }
    await supabase.auth.signOut();
    if (onLogout) {
      onLogout();
    } else {
      window.location.href = '/login?session_expired=true';
    }
  };

  useEffect(() => {
    if (!role) return;

    // Reset warning state
    setWarningActive(false);
    updateActivityCookie();

    const resetTimers = () => {
      // Jika warning sedang aktif dan user melakukan aksi, matikan warning
      if (warningActive) {
        setWarningActive(false);
      }

      // Reset activity cookie
      updateActivityCookie();

      // Hapus timer lama
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnTimerRef.current) clearInterval(warnTimerRef.current);

      // 1. Timer Peringatan (60 detik sebelum limit habis)
      timerRef.current = setTimeout(() => {
        setWarningActive(true);
        setSecondsLeft(60);

        // 2. Timer Hitung Mundur Ke Logout
        let count = 60;
        warnTimerRef.current = setInterval(() => {
          count--;
          setSecondsLeft(count);
          if (onWarn) onWarn(count);

          if (count <= 0) {
            clearInterval(warnTimerRef.current!);
            handleLogoutFlow();
          }
        }, 1000);

      }, warningMs);
    };

    // Daftarkan event listener interaksi pengguna
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Gabungkan dengan throttle agar tidak membebani performa
    let throttleTimer: NodeJS.Timeout | null = null;
    const handleInteraction = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        resetTimers();
        throttleTimer = null;
      }, 1000); // Trigger reset paling cepat 1 detik sekali
    };

    events.forEach(event => {
      window.addEventListener(event, handleInteraction);
    });

    // Inisialisasi awal
    resetTimers();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warnTimerRef.current) clearInterval(warnTimerRef.current);
      events.forEach(event => {
        window.removeEventListener(event, handleInteraction);
      });
      if (throttleTimer) clearTimeout(throttleTimer);
    };
  }, [role, warningActive]);

  return {
    warningActive,
    secondsLeft,
    resetActivity: () => {
      setWarningActive(false);
      updateActivityCookie();
    }
  };
}
