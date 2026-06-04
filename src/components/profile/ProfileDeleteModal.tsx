"use client";

import { useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import BaseModal from "@/components/BaseModal";

interface ProfileDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function ProfileDeleteModal({
  isOpen,
  onClose,
  onConfirm
}: ProfileDeleteModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} showCloseButton={true}>
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8" />
        </div>
        <h3 className="text-2xl font-black text-text-light dark:text-text-dark uppercase tracking-wide">
          Hapus Akun Anda?
        </h3>
        <p className="text-sm text-muted mt-2">
          Semua data diri, transaksi, ulasan, keranjang belanja, dan pesanan Anda akan{" "}
          <strong className="font-bold text-text-light dark:text-text-dark">
            dibersihkan sepenuhnya tanpa sisa
          </strong>{" "}
          dari database.
        </p>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/30 p-4 rounded-2xl text-center leading-relaxed">
          Tindakan ini bersifat PERMANEN dan tidak dapat dibatalkan dengan cara apa pun. Anda akan otomatis keluar dari aplikasi.
        </p>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-muted hover:bg-gray-250 dark:hover:bg-gray-700 rounded-2xl font-black text-xs uppercase transition-colors"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ya, Hapus Permanen"}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
