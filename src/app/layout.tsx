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

import AppSplashScreen from "@/components/AppSplashScreen";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://restobookid.my.id'),
  title: "RestoBook - Sistem Pemesanan Restoran",
  description: "Aplikasi pemesanan restoran online yang mudah, cepat, dan modern. Pesan meja atau makanan favorit Anda langsung dari RestoBook.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RestoBook",
  },
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
  themeColor: "#ea580c",
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
        <AppSplashScreen />
        <DeviceDimensionManager />
        <DynamicFavicon />
        <ConnectionDetector />
        <SessionStatusListener />
        {children}
        <Toaster position="top-center" containerStyle={{ top: 'calc(16px + env(safe-area-inset-top, 0px))' }} />
        <RestoBot />
        <ScrollToTop />
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(
                  function(registration) {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                  },
                  function(err) {
                    console.log('ServiceWorker registration failed: ', err);
                  }
                );
              });
            }
          `}
        </Script>
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
