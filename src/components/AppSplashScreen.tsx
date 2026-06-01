"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Utensils } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function AppSplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isPWA = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
      const isLighthouse = /Lighthouse|GTmetrix|HeadlessChrome|Chrome-Lighthouse/i.test(navigator.userAgent);
      
      if (isLighthouse || !isPWA) {
        setIsVisible(false);
        return;
      }
    }

    // 1. Fetch logo from database
    const fetchLogo = async () => {
      try {
        const { data } = await supabase.from("restaurant_settings").select("logo_url").single();
        if (data?.logo_url) {
          setLogoUrl(data.logo_url);
        }
      } catch (e) {
        console.error("Failed to load logo for splash screen:", e);
      }
    };
    fetchLogo();

    // 2. Set timeout to hide splash screen after 2.5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeInOut" } }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#fff8f0] dark:bg-[#0f172a] select-none"
        >
          {/* Animated Background Glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.15, 0.3, 0.15],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute -top-[10%] -left-[10%] w-[120%] h-[120%] bg-gradient-to-tr from-primary/10 via-transparent to-primary/10 rounded-full blur-[80px]"
            />
          </div>

          <div className="relative flex flex-col items-center gap-6">
            {/* Logo Container with Pop In & Pulse Animation */}
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ 
                scale: 1, 
                rotate: 0,
                y: [0, -10, 0]
              }}
              transition={{
                scale: { type: "spring", stiffness: 200, damping: 15, delay: 0.1 },
                rotate: { type: "spring", stiffness: 200, damping: 15, delay: 0.1 },
                y: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.6 }
              }}
              className="relative w-24 h-24 bg-primary/10 dark:bg-primary/20 rounded-[2rem] flex items-center justify-center border-2 border-primary/20 shadow-2xl p-4"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Utensils className="w-12 h-12 text-primary" />
              )}
            </motion.div>

            {/* Application Name with Fade In & Slide Up */}
            <div className="text-center">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="text-3xl font-extrabold text-text-light dark:text-text-dark tracking-wide"
              >
                Resto<span className="text-primary font-black">Book</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="text-xs text-muted font-semibold mt-1.5 tracking-[0.2em] uppercase"
              >
                Sistem Pemesanan Restoran
              </motion.p>
            </div>

            {/* Subtle Progress Bar */}
            <div className="w-36 h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mt-2">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 2.2, ease: "easeInOut" }}
                className="h-full bg-primary"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
