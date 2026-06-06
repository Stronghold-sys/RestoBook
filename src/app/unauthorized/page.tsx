"use client";

export const runtime = 'edge';

import { motion } from "framer-motion";
import { ShieldX, ArrowLeft, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UnauthorizedPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4 safe-auth-container">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="max-w-md w-full bg-card-light dark:bg-card-dark rounded-2xl shadow-xl p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="mx-auto w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6"
        >
          <ShieldX className="w-12 h-12 text-secondary" />
        </motion.div>

        <h1 className="text-2xl font-bold text-text-light dark:text-text-dark mb-2">
          Akses Ditolak
        </h1>
        <p className="text-muted mb-8">
          Anda tidak memiliki izin (role) yang sesuai untuk mengakses halaman ini.
        </p>

        <div className="space-y-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/')}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white py-3 px-4 rounded-xl font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Ke Beranda
          </motion.button>

          <button
            onClick={async () => {
              const supabase = createClient();
              try {
                await fetch('/api/auth/logout', { method: 'POST' });
              } catch (e) {
                console.error('API logout failed', e);
              }
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-muted py-3 px-4 rounded-xl font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Keluar / Ganti Akun
          </button>
        </div>
      </motion.div>
    </div>
  );
}
