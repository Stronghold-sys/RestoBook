import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import DynamicFavicon from "@/components/DynamicFavicon";

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
  const isSandbox = process.env.DUITKU_MERCHANT_CODE?.startsWith('DS') ?? true;
  // Use dynamic SDK URL based on environment, default to Sandbox if not specified
  const duitkuScriptUrl = isSandbox 
    ? "https://api-sandbox.duitku.com/lib/js/duitku.js" 
    : "https://api-prod.duitku.com/lib/js/duitku.js";

  return (
    <html lang="id">
      <body className={inter.className}>
        <DynamicFavicon />
        {children}
        <Toaster position="top-center" />
        {/* Duitku Pop SDK - untuk popup pembayaran transparan */}
        <script src={duitkuScriptUrl} async></script>
      </body>
    </html>
  );
}
