"use client";

import { useEffect } from "react";

export default function DeviceDimensionManager() {
  useEffect(() => {
    const adjustDimension = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const doc = document.documentElement;

      // Hapus kelas ukuran layar/device sebelumnya
      doc.classList.remove(
        "device-mobile",
        "device-tablet",
        "device-desktop",
        "device-apple-desktop",
        "screen-xs",
        "screen-sm",
        "screen-md",
        "screen-lg",
        "screen-xl",
        "screen-xxl"
      );

      // Definisikan CSS variables untuk ukuran viewport realtime
      doc.style.setProperty("--viewport-width", `${width}px`);
      doc.style.setProperty("--viewport-height", `${height}px`);

      // Tambahkan kelas perangkat berdasarkan breakpoint standard
      if (width < 640) {
        doc.classList.add("device-mobile");
      } else if (width >= 640 && width < 1024) {
        doc.classList.add("device-tablet");
      } else {
        doc.classList.add("device-desktop");

        // Deteksi Apple Desktop (macOS Desktop)
        const isMac = (navigator.userAgent.includes('Macintosh') || 
                       navigator.userAgent.includes('MacIntel') || 
                       (navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0));
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        if (isMac && !isTouch) {
          doc.classList.add("device-apple-desktop");
        }
      }

      // Tambahkan detail kelas ukuran layar untuk penyesuaian media query di CSS
      if (width < 480) {
        doc.classList.add("screen-xs");
      } else if (width >= 480 && width < 640) {
        doc.classList.add("screen-sm");
      } else if (width >= 640 && width < 768) {
        doc.classList.add("screen-md");
      } else if (width >= 768 && width < 1024) {
        doc.classList.add("screen-lg");
      } else if (width >= 1024 && width < 1280) {
        doc.classList.add("screen-xl");
      } else {
        doc.classList.add("screen-xxl");
      }

      // Logika auto-scaling font size pada layar kecil (misal iOS) agar tampilan tetap rapi
      if (width < 360) {
        doc.style.fontSize = "14px";
      } else if (width >= 360 && width < 400) {
        doc.style.fontSize = "15px";
      } else {
        doc.style.fontSize = ""; // default browser font size
      }
    };

    // Jalankan pada saat render pertama
    adjustDimension();

    // Pasang listener pada perubahan ukuran layar (resize)
    window.addEventListener("resize", adjustDimension);
    return () => window.removeEventListener("resize", adjustDimension);
  }, []);

  return null;
}
