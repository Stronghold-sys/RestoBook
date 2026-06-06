"use client";

import { useEffect, useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

const useSafeLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function TranslationRouteHandler() {
  const pathname = usePathname();

  // 1. Intersept click & popstate untuk menyembunyikan konten secara instan saat navigasi dimulai
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hideOnNavigate = () => {
      const activeLang = localStorage.getItem("rb_i18n_lang") || "id";
      if (activeLang !== "id") {
        document.documentElement.classList.add("i18n-loading");
      }
    };

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      
      // Deteksi jika link internal dan navigasi client-side
      if (
        anchor &&
        anchor.href &&
        anchor.href.startsWith(window.location.origin) &&
        !anchor.target &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        hideOnNavigate();
      }
    };

    document.addEventListener("click", handleLinkClick, { capture: true });
    window.addEventListener("popstate", hideOnNavigate);

    return () => {
      document.removeEventListener("click", handleLinkClick, { capture: true });
      window.removeEventListener("popstate", hideOnNavigate);
    };
  }, []);

  // 2. Terjemahkan halaman secara sinkron saat pathname berubah sebelum browser menggambar ulang (paint)
  useSafeLayoutEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const activeLang = localStorage.getItem("rb_i18n_lang") || "id";
      if (activeLang !== "id") {
        // Jalankan penterjemahan halaman secara sinkron
        if ((window as any).translatePage) {
          (window as any).translatePage(activeLang);
        }

        // Tunggu antrean penerjemahan kosong atau timeout 800ms sebelum menampilkan halaman
        const checkInterval = 20; // cek setiap 20ms
        const maxTimeout = 800; // batas waktu 800ms
        let elapsed = 0;

        const interval = setInterval(() => {
          elapsed += checkInterval;
          const state = (window as any).translationState;
          const isQueueEmpty = !state || (state.queue.length === 0 && !state.isProcessingQueue);

          if (isQueueEmpty || elapsed >= maxTimeout) {
            clearInterval(interval);
            document.documentElement.classList.remove("i18n-loading");
          }
        }, checkInterval);

        return () => clearInterval(interval);
      } else {
        document.documentElement.classList.remove("i18n-loading");
      }
    } catch (e) {
      console.error("Error in TranslationRouteHandler:", e);
      document.documentElement.classList.remove("i18n-loading");
    }
  }, [pathname]);

  return null;
}
