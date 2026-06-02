"use client";

import React from "react";
import { ShieldAlert, Clock, AlertTriangle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

interface MaintenanceBlockPageProps {
  message?: string;
  estimatedHours?: string;
  role?: string;
}

export default function MaintenanceBlockPage({ 
  message = "Sistem sedang dalam perbaikan untuk meningkatkan layanan. Sementara ini, proses transaksi dan pembayaran belum dapat digunakan. Silakan coba kembali nanti.", 
  estimatedHours = "2 Jam",
  role = "customer"
}: MaintenanceBlockPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center max-w-2xl mx-auto space-y-8 select-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 15 }}
        className="relative"
      >
        {/* PREMIUM METALLIC & GLOWING MAINTENANCE ILLUSTRATION */}
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/20 to-orange-500/20 rounded-full blur-3xl -z-10 animate-pulse" />
        
        {/* Modern Gear & Shield SVG Illustration */}
        <svg className="w-48 h-48 mx-auto text-orange-500" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: '100px 100px' }}
          >
            <circle cx="100" cy="100" r="50" stroke="currentColor" strokeWidth="12" strokeDasharray="30 15" className="opacity-30" />
            <circle cx="100" cy="100" r="30" stroke="currentColor" strokeWidth="8" strokeDasharray="15 8" className="opacity-50" />
          </motion.g>
          <motion.g
            animate={{ rotate: -360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: '100px 100px' }}
          >
            <circle cx="100" cy="100" r="75" stroke="currentColor" strokeWidth="6" strokeDasharray="40 25" className="opacity-20" />
          </motion.g>
          <path d="M70 100L90 120L130 80" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse" />
        </svg>
        
        <div className="absolute -bottom-2 right-6 bg-red-500 text-white p-3 rounded-2xl shadow-xl shadow-red-500/30 border-2 border-white dark:border-gray-900 animate-bounce">
          <ShieldAlert className="w-6 h-6" />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 rounded-full font-black text-xs uppercase tracking-widest border border-orange-500/20">
          <AlertCircle className="w-3.5 h-3.5" /> Sedang Maintenance
        </div>
        
        <h1 className="text-3xl font-black tracking-tight text-text-light dark:text-text-dark sm:text-4xl">
          Layanan <span className="text-orange-500">Maintenance</span>
        </h1>
        
        <p className="text-muted text-sm sm:text-base leading-relaxed max-w-lg mx-auto font-medium">
          {message}
        </p>
      </motion.div>

      {/* ESTIMATED DOWNTIME METRIC CARD */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-3xl p-6 border border-orange-500/15 flex flex-col sm:flex-row items-center justify-around gap-6"
      >
        <div className="flex items-center gap-4 text-left">
          <div className="h-12 w-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted font-bold uppercase tracking-wider">Estimasi Selesai</p>
            <p className="text-xl font-black text-orange-950 dark:text-orange-200">{estimatedHours}</p>
          </div>
        </div>
        
        <div className="h-px sm:h-12 w-full sm:w-px bg-orange-500/10" />

        <div className="flex items-center gap-4 text-left">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted font-bold uppercase tracking-wider">Hak Akses Role</p>
            <p className="text-xl font-black text-amber-950 dark:text-amber-200">
              {role === "cashier" ? "Kasir (Terbatas)" : "Pelanggan"}
            </p>
          </div>
        </div>
      </motion.div>

      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ delay: 0.3 }}
        className="text-[11px] text-muted font-medium"
      >
        Mohon maaf atas ketidaknyamanan ini. Kami sedang memperbarui infrastruktur backend RestoBook untuk memberikan performa transaksi yang jauh lebih cepat dan andal.
      </motion.p>
    </div>
  );
}
