import React, { useEffect, useState } from "react";
import { Clock, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface OrderEstimationBadgeProps {
  order: {
    status: string;
    created_at: string;
    estimated_duration_minutes?: number | null;
    estimation_status?: string | null;
    estimation_started_at?: string | null;
  };
}

export default function OrderEstimationBadge({ order }: OrderEstimationBadgeProps) {
  const [badgeState, setBadgeState] = useState<{
    label: string;
    className: string;
    icon: React.ReactNode;
  } | null>(null);

  useEffect(() => {
    if (!order.estimated_duration_minutes) {
      setBadgeState(null);
      return;
    }

    const isFinished = ["completed", "cancelled", "ready"].includes(order.status);

    if (isFinished) {
      const isLate = order.estimation_status === "terlambat" || order.status === "cancelled" && order.estimation_status === "terlambat";
      if (order.status === "cancelled") {
        setBadgeState({
          label: "Batal",
          className: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400 border-gray-200 dark:border-gray-700",
          icon: <XCircle className="w-3.5 h-3.5" />
        });
      } else if (isLate) {
        setBadgeState({
          label: "Terlambat",
          className: "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border-red-100 dark:border-red-900/30",
          icon: <XCircle className="w-3.5 h-3.5" />
        });
      } else {
        setBadgeState({
          label: "Tepat Waktu",
          className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30",
          icon: <CheckCircle2 className="w-3.5 h-3.5" />
        });
      }
      return;
    }

    const startedTime = new Date(order.estimation_started_at || order.created_at).getTime();
    const durationMs = order.estimated_duration_minutes * 60 * 1000;
    const endTime = startedTime + durationMs;

    const updateBadge = () => {
      const now = Date.now();
      const diffMs = endTime - now;

      if (diffMs <= 0) {
        // Late
        setBadgeState({
          label: "Terlambat",
          className: "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 border-red-200 dark:border-red-800/30 animate-pulse",
          icon: <AlertTriangle className="w-3.5 h-3.5" />
        });
      } else if (diffMs < 5 * 60 * 1000) {
        // Less than 5 mins
        setBadgeState({
          label: "Hampir Habis",
          className: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200 dark:border-amber-800/30 animate-pulse",
          icon: <AlertTriangle className="w-3.5 h-3.5" />
        });
      } else {
        // Processing normally
        setBadgeState({
          label: "Diproses",
          className: "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-100 dark:border-blue-900/30",
          icon: <Clock className="w-3.5 h-3.5" />
        });
      }
    };

    updateBadge();
    const interval = setInterval(updateBadge, 5000); // update status every 5s

    return () => clearInterval(interval);
  }, [order.estimated_duration_minutes, order.estimation_started_at, order.created_at, order.status, order.estimation_status]);

  if (!badgeState) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase border tracking-wider select-none ${badgeState.className}`}>
      {badgeState.icon}
      {badgeState.label}
    </span>
  );
}
