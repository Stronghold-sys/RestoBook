"use client";

export const runtime = 'edge';

import { motion } from "framer-motion";
import { FileQuestion, Home } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4 safe-auth-container">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="max-w-md w-full bg-card-light dark:bg-card-dark rounded-2xl shadow-xl p-8 text-center"
      >
        <motion.div
          animate={{ 
            y: [0, -10, 0],
            rotate: [0, -5, 5, 0]
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity,
            repeatType: "reverse"
          }}
          className="mx-auto w-32 h-32 mb-6 text-primary opacity-80"
        >
          <FileQuestion className="w-full h-full" />
        </motion.div>

        <h1 className="text-3xl font-bold text-text-light dark:text-text-dark mb-3">
          404
        </h1>
        <h2 className="text-xl font-semibold text-text-light dark:text-text-dark mb-2">
          Halaman Tidak Ditemukan
        </h2>
        <p className="text-muted mb-8">
          Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
        </p>

        <Link href="/">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white py-3 px-4 rounded-lg font-medium transition-colors"
          >
            <Home className="w-5 h-5" />
            Kembali ke Beranda
          </motion.button>
        </Link>
      </motion.div>
    </div>
  );
}
