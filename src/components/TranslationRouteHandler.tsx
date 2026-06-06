"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function TranslationRouteHandler() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const activeLang = localStorage.getItem("rb_i18n_lang") || "id";
      if (activeLang !== "id") {
        // 1. Tambahkan i18n-loading ke root html untuk menyembunyikan FOUT secara instan
        document.documentElement.classList.add("i18n-loading");

        // 2. Jalankan penterjemahan halaman secara sinkron
        if ((window as any).translatePage) {
          (window as any).translatePage(activeLang);
        }

        // 3. Tampilkan kembali halaman setelah render/layout browser selesai
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            document.documentElement.classList.remove("i18n-loading");
          });
        });
      }
    } catch (e) {
      console.error("Error in TranslationRouteHandler:", e);
      document.documentElement.classList.remove("i18n-loading");
    }
  }, [pathname]);

  return null;
}
