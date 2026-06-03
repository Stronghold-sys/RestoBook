import React, { useEffect, useState } from "react";
import { Clock, AlertTriangle, CheckCircle2, XCircle, Truck, ChefHat } from "lucide-react";

interface OrderCountdownProps {
  order: {
    id: string;
    status: string;
    order_type: string;
    created_at: string;
    estimated_duration_minutes?: number | null;
    estimated_delivery_duration_minutes?: number | null;
    estimation_status?: string | null;
    actual_duration_minutes?: number | null;
    estimation_started_at?: string | null;
    estimation_completed_at?: string | null;
    distance_km?: number | null;
  };
}

export default function OrderCountdown({ order }: OrderCountdownProps) {
  const [timeLeftText, setTimeLeftText] = useState("");
  const [percentage, setPercentage] = useState(100);
  const [isOverdue, setIsOverdue] = useState(false);
  const [isAlmostFinished, setIsAlmostFinished] = useState(false);

  useEffect(() => {
    // If order has no estimation fields yet or estimation is disabled, return
    if (!order.estimated_duration_minutes) {
      return;
    }

    const isFinished = ["completed", "cancelled", "ready"].includes(order.status);
    if (isFinished) {
      return;
    }

    const startedTime = new Date(order.estimation_started_at || order.created_at).getTime();
    const durationMs = order.estimated_duration_minutes * 60 * 1000;
    const endTime = startedTime + durationMs;

    const updateTimer = () => {
      const now = Date.now();
      const diffMs = endTime - now;

      if (diffMs > 0) {
        // Ticking down
        setIsOverdue(false);
        const diffSeconds = Math.floor(diffMs / 1000);
        const minutes = Math.floor(diffSeconds / 60);
        const seconds = diffSeconds % 60;
        
        const pad = (n: number) => n.toString().padStart(2, "0");
        setTimeLeftText(`${pad(minutes)}:${pad(seconds)}`);
        
        const elapsedMs = now - startedTime;
        const pct = Math.max(0, Math.min(100, 100 - (elapsedMs / durationMs) * 100));
        setPercentage(pct);

        // Warning when less than 5 minutes remain
        setIsAlmostFinished(diffSeconds < 300);
      } else {
        // Overdue, ticking up (late time)
        setIsOverdue(true);
        setIsAlmostFinished(false);
        const lateMs = now - endTime;
        const lateSeconds = Math.floor(lateMs / 1000);
        const minutes = Math.floor(lateSeconds / 60);
        const seconds = lateSeconds % 60;
        
        const pad = (n: number) => n.toString().padStart(2, "0");
        setTimeLeftText(`+${pad(minutes)}:${pad(seconds)}`);
        setPercentage(0);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [order.estimated_duration_minutes, order.estimation_started_at, order.created_at, order.status]);

  if (!order.estimated_duration_minutes) {
    return null;
  }

  const isFinished = ["completed", "cancelled", "ready"].includes(order.status);

  // ── Render Completed / Finished State ──
  if (isFinished) {
    const isLate = order.estimation_status === "terlambat";
    return (
      <div className={`p-6 rounded-2xl border-2 transition-all ${
        isLate 
          ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300"
          : "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300"
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${
            isLate ? "bg-red-150 dark:bg-red-900/50" : "bg-emerald-150 dark:bg-emerald-900/50"
          }`}>
            {isLate ? <XCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest opacity-75">Status Estimasi Pesanan</p>
            <h4 className="text-base font-black uppercase mt-0.5">
              {isLate ? "Pesanan Terlambat" : "Pesanan Selesai Tepat Waktu"}
            </h4>
            <p className="text-xs font-semibold mt-1 opacity-90">
              {isLate 
                ? `Pesanan diselesaikan dalam ${order.actual_duration_minutes || 0} menit (Melebihi estimasi ${order.estimated_duration_minutes} menit).`
                : `Pesanan berhasil diselesaikan dalam waktu ${order.actual_duration_minutes || 0} menit sebelum estimasi habis.`
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Render Ongoing Countdown State ──
  return (
    <div className={`p-6 rounded-2xl border-2 transition-all bg-card-light dark:bg-card-dark ${
      isOverdue 
        ? "border-red-200 dark:border-red-900/30" 
        : isAlmostFinished 
          ? "border-amber-200 dark:border-amber-900/30" 
          : "border-border-light dark:border-border-dark"
    }`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${
            isOverdue 
              ? "bg-red-50 text-red-500 dark:bg-red-900/20" 
              : isAlmostFinished 
                ? "bg-amber-50 text-amber-500 dark:bg-amber-900/20 animate-pulse" 
                : "bg-primary/10 text-primary dark:bg-primary/5"
          }`}>
            {isOverdue ? (
              <AlertTriangle className="w-5 h-5" />
            ) : order.order_type === "delivery" ? (
              <Truck className="w-5 h-5" />
            ) : (
              <ChefHat className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">
              {order.order_type === "delivery" ? "Estimasi Pengantaran & Ongkir" : "Estimasi Persiapan Hidangan"}
            </p>
            <h4 className="text-sm font-bold text-text-light dark:text-text-dark mt-0.5">
              {isOverdue 
                ? "Pesanan melebihi estimasi"
                : isAlmostFinished 
                  ? "Estimasi hampir habis" 
                  : "Pesanan sedang diproses"
              }
            </h4>
          </div>
        </div>

        <div className="text-left sm:text-right shrink-0">
          <span className="text-[9px] font-black uppercase text-muted tracking-wider block">
            {isOverdue ? "Keterlambatan" : "Sisa Waktu"}
          </span>
          <span className={`font-mono text-2xl font-black ${
            isOverdue ? "text-red-500" : isAlmostFinished ? "text-amber-500" : "text-text-light dark:text-text-dark"
          }`}>
            {timeLeftText}
          </span>
        </div>
      </div>

      {/* Progress Bar (only show if not overdue) */}
      {!isOverdue && (
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden mb-3">
          <div 
            className={`h-full transition-all duration-1000 ${
              isAlmostFinished ? "bg-amber-500" : "bg-primary"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {/* Warning/Info Messages */}
      <div className="text-xs font-semibold leading-relaxed">
        {isOverdue ? (
          <p className="text-red-500">
            Sedang diproses melebihi waktu estimasi. Mohon maaf, pesanan Anda terlambat dari estimasi.
          </p>
        ) : isAlmostFinished ? (
          <p className="text-amber-600 dark:text-amber-400">
            Pesanan Anda sedang diprioritaskan. Mohon tunggu sebentar, pesanan segera selesai.
          </p>
        ) : (
          <p className="text-muted">
            Mohon tunggu, pesanan Anda sedang disiapkan. (Estimasi Total: {order.estimated_duration_minutes} Menit
            {order.estimated_delivery_duration_minutes && order.order_type === "delivery" 
              ? `, termasuk perjalanan ke lokasi Anda sekitar ${order.estimated_delivery_duration_minutes} Menit` 
              : ""
            })
          </p>
        )}
      </div>
    </div>
  );
}
