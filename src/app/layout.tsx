import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ModernToaster from "@/components/ModernToaster";
import DynamicFavicon from "@/components/DynamicFavicon";
import Script from "next/script";
import ConnectionDetector from "@/components/ConnectionDetector";
import SessionStatusListener from "@/components/SessionStatusListener";
import AutoTableStatusManager from "@/components/AutoTableStatusManager";
import DeviceDimensionManager from "@/components/DeviceDimensionManager";
import AppSplashScreen from "@/components/AppSplashScreen";
import dynamic from "next/dynamic";

import GlobalModalContainer from "@/components/layout/GlobalModalContainer";
import SpotlightTutorial from "@/components/SpotlightTutorial";

const RestoBot = dynamic(() => import("@/components/RestoBot"), {
  ssr: false,
});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL('https://restobookid.my.id'),
  title: "RestoBook - Sistem Pemesanan Restoran",
  description: "Aplikasi pemesanan restoran online yang mudah, cepat, dan modern. Pesan meja atau makanan favorit Anda langsung dari RestoBook.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
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
        <AutoTableStatusManager />
        {children}
        <GlobalModalContainer />
        <SpotlightTutorial />
        <ModernToaster />
        <RestoBot />
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
      </body>
    </html>
  );
}
