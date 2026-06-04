"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, ShieldAlert, Info, CheckCircle, X } from "lucide-react";
import BaseModal from "@/components/BaseModal";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
  type?: "danger" | "warning" | "info" | "success";
  /** Jika true, tidak ada tombol batal (hanya tombol konfirmasi) */
  singleButton?: boolean;
  isLoading?: boolean;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "Ya, Lanjutkan",
  cancelText = "Batal",
  onConfirm,
  onClose,
  type = "warning",
  singleButton = false,
  isLoading = false,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && confirmBtnRef.current) {
      // Focus confirm button when dialog opens
      setTimeout(() => confirmBtnRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const iconMap = {
    danger: <ShieldAlert className="w-7 h-7" />,
    warning: <AlertTriangle className="w-7 h-7" />,
    info: <Info className="w-7 h-7" />,
    success: <CheckCircle className="w-7 h-7" />,
  };

  const colorMap = {
    danger: {
      icon: "text-red-500",
      iconBg: "bg-red-50 dark:bg-red-950/30",
      confirmBtn:
        "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white",
    },
    warning: {
      icon: "text-amber-500",
      iconBg: "bg-amber-50 dark:bg-amber-950/30",
      confirmBtn:
        "bg-amber-500 hover:bg-amber-600 focus:ring-amber-400 text-white",
    },
    info: {
      icon: "text-blue-500",
      iconBg: "bg-blue-50 dark:bg-blue-950/30",
      confirmBtn:
        "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white",
    },
    success: {
      icon: "text-emerald-500",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/30",
      confirmBtn:
        "bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 text-white",
    },
  };

  const colors = colorMap[type];

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={!isLoading}
      size="sm"
    >
      <div className="space-y-5">
        {/* Icon */}
        <div className={`w-14 h-14 rounded-2xl ${colors.iconBg} ${colors.icon} flex items-center justify-center`}>
          {iconMap[type]}
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h2
            id="confirm-dialog-title"
            className="text-lg font-black text-text-light dark:text-text-dark"
          >
            {title}
          </h2>
          <p className="text-sm text-muted leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className={`flex gap-3 ${singleButton ? "justify-center" : ""}`}>
          {!singleButton && (
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-sm font-bold text-muted hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-all"
            >
              {cancelText}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-black disabled:opacity-60 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-md ${colors.confirmBtn}`}
          >
            {isLoading ? "Memproses..." : confirmText}
          </button>
        </div>
      </div>
    </BaseModal>
  );
}
