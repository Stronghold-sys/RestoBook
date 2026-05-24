import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import DynamicFavicon from "@/components/DynamicFavicon";
import Script from "next/script";
import RestoBot from "@/components/RestoBot";
import ConnectionDetector from "@/components/ConnectionDetector";
import ScrollToTop from "@/components/ScrollToTop";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "RestoBook - Sistem Pemesanan Restoran",
  description: "Aplikasi pemesanan restoran modern dan responsif",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isSandbox = process.env.DUITKU_MERCHANT_CODE?.startsWith('DS');
  const duitkuScript = isSandbox
    ? "https://app-sandbox.duitku.com/lib/js/duitku.js"
    : "https://app-prod.duitku.com/lib/js/duitku.js";

  return (
    <html lang="id">
      <body className={inter.className}>
        <DynamicFavicon />
        <ConnectionDetector />
        {children}
        <Toaster position="top-center" />
        <RestoBot />
        <ScrollToTop />
        <Script
          src={duitkuScript}
          strategy="lazyOnload"
          data-clearonload="false"
        />
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  );
}
