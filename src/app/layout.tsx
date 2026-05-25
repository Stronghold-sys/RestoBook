import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import DynamicFavicon from "@/components/DynamicFavicon";
import Script from "next/script";
import RestoBot from "@/components/RestoBot";
import ConnectionDetector from "@/components/ConnectionDetector";
import SessionStatusListener from "@/components/SessionStatusListener";
import ScrollToTop from "@/components/ScrollToTop";
import DeviceDimensionManager from "@/components/DeviceDimensionManager";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://restobookid.my.id'),
  title: "RestoBook - Sistem Pemesanan Restoran",
  description: "Aplikasi pemesanan restoran online yang mudah, cepat, dan modern. Pesan meja atau makanan favorit Anda langsung dari RestoBook.",
  openGraph: {
    title: "RestoBook - Sistem Pemesanan Restoran",
    description: "Pesan meja atau makanan favorit Anda langsung dari RestoBook.",
    url: "https://restobookid.my.id",
    siteName: "RestoBook",
    type: "website",
  },
};


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
        <DeviceDimensionManager />
        <DynamicFavicon />
        <ConnectionDetector />
        <SessionStatusListener />
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
