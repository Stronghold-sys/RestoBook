"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import BaseModal from "@/components/BaseModal";

interface ProfileResignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function ProfileResignModal({
  isOpen,
  onClose,
  onConfirm
}: ProfileResignModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} showCloseButton={true}>
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-teal-100 text-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-2xl font-black text-text-light dark:text-text-dark uppercase tracking-wide">
          Kirim Pengajuan?
        </h3>
        <p className="text-sm text-muted mt-2">
          Pastikan semua data yang Anda masukkan sudah benar dan sesuai dengan kesepakatan internal.
        </p>
      </div>

      <div className="space-y-4">
        <p className="text-xs font-bold text-teal-600 bg-teal-50 dark:bg-teal-950/30 p-4 rounded-2xl text-center leading-relaxed">
          Pengajuan akan diteruskan langsung ke Panel Manajemen Admin RestoBook secara real-time.
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
            onClick={handleConfirm}
            disabled={submitting}
            className="flex-1 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ya, Kirim"}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
