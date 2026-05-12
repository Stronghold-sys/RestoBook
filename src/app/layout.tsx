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
  return (
    <html lang="id">
      <body className={inter.className}>
        <DynamicFavicon />
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
