"use client";

/**
 * PingMonitor — Widget Monitoring Latency Real-time
 * ─────────────────────────────────────────────────
 * Mengukur waktu respons HTTP ke /api/ping setiap beberapa detik,
 * mengklasifikasikan kualitas koneksi, dan menampilkan:
 *  - Latency dalam ms
 *  - Status: Sangat Cepat | Normal | Lambat | Sangat Lambat | Offline
 *  - Bar sinyal animasi
 *  - Riwayat 10 ping terakhir
 *  - Rata-rata, min, max latency
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useReducer,
} from "react";

// ─── Konstanta & konfigurasi ─────────────────────────────────────────────────
const PING_URL             = "/api/ping";
const PING_INTERVAL_FAST   = 3_000;   // Saat kondisi buruk: tiap 3 detik
const PING_INTERVAL_NORMAL = 5_000;   // Saat kondisi baik: tiap 5 detik
const TIMEOUT_MS           = 3_000;   // Batas timeout request
const FAIL_THRESHOLD       = 3;       // Gagal n kali → offline
const RECOVER_THRESHOLD    = 2;       // Sukses n kali setelah gagal → pulih
const HISTORY_SIZE         = 10;      // Jumlah histori tersimpan
const AUTO_REFRESH_KEY     = "rb_ping_refreshed";

// ─── Klasifikasi latency ─────────────────────────────────────────────────────
export type PingStatus =
  | "excellent"   // < 50ms
  | "good"        // 50–120ms
  | "slow"        // 121–300ms
  | "very_slow"   // > 300ms atau berulang tinggi
  | "offline"     // gagal FAIL_THRESHOLD kali
  | "recovering"  // baru pulih, menunggu konfirmasi
  | "checking";   // baru mulai / inisialisasi

const THRESHOLDS = {
  excellent: 50,
  good:      120,
  slow:      300,
} as const;

function classifyPing(ms: number, failCount: number): PingStatus {
  if (failCount >= FAIL_THRESHOLD)   return "offline";
  if (ms < THRESHOLDS.excellent)     return "excellent";
  if (ms < THRESHOLDS.good)          return "good";
  if (ms < THRESHOLDS.slow)          return "slow";
  return "very_slow";
}

// ─── Label teks ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<PingStatus, {
  label: string;
  color: string;       // Warna teks & ikon
  bg: string;          // Background badge
  border: string;      // Border badge
  barColor: string;    // Warna bar sinyal
  bars: number;        // Jumlah bar aktif (dari 4)
  pulseColor: string;  // Warna titik pulse
}> = {
  excellent:  { label: "Sangat Cepat",  color: "#10b981", bg: "rgba(16,185,129,.1)",  border: "rgba(16,185,129,.25)", barColor: "#10b981", bars: 4, pulseColor: "#10b981" },
  good:       { label: "Normal",        color: "#3b82f6", bg: "rgba(59,130,246,.1)",  border: "rgba(59,130,246,.25)", barColor: "#3b82f6", bars: 3, pulseColor: "#3b82f6" },
  slow:       { label: "Lambat",        color: "#f59e0b", bg: "rgba(245,158,11,.1)",  border: "rgba(245,158,11,.25)", barColor: "#f59e0b", bars: 2, pulseColor: "#f59e0b" },
  very_slow:  { label: "Sangat Lambat", color: "#ef4444", bg: "rgba(239,68,68,.1)",   border: "rgba(239,68,68,.25)",  barColor: "#ef4444", bars: 1, pulseColor: "#ef4444" },
  offline:    { label: "Offline",       color: "#6b7280", bg: "rgba(107,114,128,.1)", border: "rgba(107,114,128,.2)", barColor: "#6b7280", bars: 0, pulseColor: "#6b7280" },
  recovering: { label: "Pulih",         color: "#10b981", bg: "rgba(16,185,129,.12)", border: "rgba(16,185,129,.3)",  barColor: "#10b981", bars: 3, pulseColor: "#10b981" },
  checking:   { label: "Memeriksa...",  color: "#8b5cf6", bg: "rgba(139,92,246,.1)",  border: "rgba(139,92,246,.25)", barColor: "#8b5cf6", bars: 2, pulseColor: "#8b5cf6" },
};

// ─── State & Reducer ──────────────────────────────────────────────────────────
interface PingEntry { ms: number; ts: number; ok: boolean; }

interface MonitorState {
  status: PingStatus;
  lastMs: number | null;
  history: PingEntry[];
  failCount: number;
  successAfterFail: number;
  wasOffline: boolean;
  showPanel: boolean;
  recovered: boolean;
}

type Action =
  | { type: "PING_SUCCESS"; ms: number }
  | { type: "PING_FAIL" }
  | { type: "TOGGLE_PANEL" }
  | { type: "CLEAR_RECOVERED" }
  | { type: "SET_CHECKING" };

const initialState: MonitorState = {
  status: "checking",
  lastMs: null,
  history: [],
  failCount: 0,
  successAfterFail: 0,
  wasOffline: false,
  showPanel: false,
  recovered: false,
};

function pingReducer(state: MonitorState, action: Action): MonitorState {
  switch (action.type) {
    case "SET_CHECKING":
      return { ...state, status: "checking" };

    case "PING_SUCCESS": {
      const entry: PingEntry = { ms: action.ms, ts: Date.now(), ok: true };
      const newHistory = [entry, ...state.history].slice(0, HISTORY_SIZE);
      const wasOffline = state.failCount >= FAIL_THRESHOLD;
      const newSuccessAfterFail = wasOffline ? state.successAfterFail + 1 : 0;
      const isRecovering = wasOffline && newSuccessAfterFail < RECOVER_THRESHOLD;
      const justRecovered = wasOffline && newSuccessAfterFail >= RECOVER_THRESHOLD;

      const newStatus = isRecovering
        ? "recovering"
        : classifyPing(action.ms, 0);

      return {
        ...state,
        status: newStatus,
        lastMs: action.ms,
        history: newHistory,
        failCount: 0,
        successAfterFail: newSuccessAfterFail,
        wasOffline: justRecovered ? false : wasOffline,
        recovered: justRecovered ? true : (state.recovered && !justRecovered ? false : state.recovered),
      };
    }

    case "PING_FAIL": {
      const entry: PingEntry = { ms: TIMEOUT_MS, ts: Date.now(), ok: false };
      const newHistory = [entry, ...state.history].slice(0, HISTORY_SIZE);
      const newFailCount = state.failCount + 1;
      const newStatus = newFailCount >= FAIL_THRESHOLD ? "offline" : classifyPing(TIMEOUT_MS, newFailCount);
      return {
        ...state,
        status: newStatus,
        history: newHistory,
        failCount: newFailCount,
        successAfterFail: 0,
        wasOffline: newFailCount >= FAIL_THRESHOLD ? true : state.wasOffline,
      };
    }

    case "TOGGLE_PANEL":
      return { ...state, showPanel: !state.showPanel };

    case "CLEAR_RECOVERED":
      return { ...state, recovered: false };

    default:
      return state;
  }
}

// ─── Helper: HTTP ping dengan timeout ────────────────────────────────────────
async function measurePing(): Promise<{ ok: boolean; ms: number }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = performance.now();
  try {
    await fetch(`${PING_URL}?_t=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return { ok: true, ms: Math.round(performance.now() - t0) };
  } catch {
    clearTimeout(timer);
    return { ok: false, ms: TIMEOUT_MS };
  }
}

// ─── Statistik dari histori ───────────────────────────────────────────────────
function getStats(history: PingEntry[]) {
  const successful = history.filter(h => h.ok).map(h => h.ms);
  if (!successful.length) return { avg: null, min: null, max: null };
  const avg = Math.round(successful.reduce((a, b) => a + b, 0) / successful.length);
  const min = Math.min(...successful);
  const max = Math.max(...successful);
  return { avg, min, max };
}

// ─── Komponen Utama ───────────────────────────────────────────────────────────
interface PingMonitorProps {
  /** Ukuran tampilan: "sm" = badge kecil, "md" = default, "lg" = badge besar */
  size?: "sm" | "md" | "lg";
  /** Jika true, tombol tidak bisa diklik untuk buka panel */
  readOnly?: boolean;
}

export default function PingMonitor({ size = "md", readOnly = false }: PingMonitorProps) {
  const [state, dispatch] = useReducer(pingReducer, initialState);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshedRef  = useRef(false);
  const panelRef      = useRef<HTMLDivElement>(null);

  // ── Auto-refresh sekali saat pulih ────────────────────────────────────────
  const handleRecovery = useCallback(() => {
    const done = sessionStorage.getItem(AUTO_REFRESH_KEY) === "1";
    if (done || refreshedRef.current) {
      dispatch({ type: "CLEAR_RECOVERED" });
      return;
    }
    refreshedRef.current = true;
    sessionStorage.setItem(AUTO_REFRESH_KEY, "1");
    setTimeout(() => {
      dispatch({ type: "CLEAR_RECOVERED" });
      window.location.reload();
    }, 2500);
  }, []);

  // ── Polling loop ──────────────────────────────────────────────────────────
  const runPing = useCallback(async () => {
    const { ok, ms } = await measurePing();
    if (ok) {
      dispatch({ type: "PING_SUCCESS", ms });
    } else {
      dispatch({ type: "PING_FAIL" });
    }
  }, []);

  const startPolling = useCallback((fast: boolean) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const delay = fast ? PING_INTERVAL_FAST : PING_INTERVAL_NORMAL;
    intervalRef.current = setInterval(runPing, delay);
  }, [runPing]);

  // ── Setup ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Hapus flag auto-refresh jika sudah lebih dari 1 menit
    try {
      const ts = sessionStorage.getItem(AUTO_REFRESH_KEY + "_ts");
      if (ts && Date.now() - parseInt(ts) > 60_000) {
        sessionStorage.removeItem(AUTO_REFRESH_KEY);
        sessionStorage.removeItem(AUTO_REFRESH_KEY + "_ts");
      }
    } catch {}

    dispatch({ type: "SET_CHECKING" });
    runPing();
    startPolling(false);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [runPing, startPolling]);

  // ── Percepat polling saat kondisi buruk ───────────────────────────────────
  useEffect(() => {
    const bad = state.status === "offline" || state.status === "slow" || state.status === "very_slow";
    startPolling(bad);
  }, [state.status, startPolling]);

  // ── Tangani recovery ──────────────────────────────────────────────────────
  useEffect(() => {
    if (state.recovered) handleRecovery();
  }, [state.recovered, handleRecovery]);

  // ── Tutup panel saat klik di luar ─────────────────────────────────────────
  useEffect(() => {
    if (!state.showPanel) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        dispatch({ type: "TOGGLE_PANEL" });
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [state.showPanel]);

  const cfg  = STATUS_CONFIG[state.status];
  const stats = getStats(state.history);

  const msLabel = state.status === "offline"
    ? "Offline"
    : state.status === "checking"
    ? "..."
    : state.lastMs !== null
    ? `${state.lastMs} ms`
    : "—";

  // Dideklarasikan sebagai boolean eksplisit di luar JSX agar ARIA static
  // validator tidak salah mengira nilainya sebagai ekspresi tak terbatas.
  const ariaExpanded: boolean = state.showPanel;

  return (
    <>
      <style>{PM_STYLES}</style>

      <div className="pm-wrapper" ref={panelRef}>
        {/* ── Badge trigger ─────────────────────────────────── */}
        <button
          className={`pm-badge pm-badge--${size}`}
          style={{
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            color: cfg.color,
          }}
          onClick={() => !readOnly && dispatch({ type: "TOGGLE_PANEL" })}
          aria-label={`Status koneksi: ${cfg.label}, Latency: ${msLabel}`}
          aria-haspopup="dialog"
          // eslint-disable-next-line jsx-a11y/aria-proptypes
          aria-expanded={ariaExpanded}
          title={`${cfg.label} — ${msLabel}`}
          disabled={readOnly}
        >
          {/* Pulse dot */}
          <span
            className={`pm-dot ${state.status === "offline" ? "" : "pm-dot--pulse"}`}
            style={{ background: cfg.color }}
            aria-hidden="true"
          />

          {/* Signal bars */}
          <SignalBars bars={cfg.bars} color={cfg.barColor} />

          {/* Text */}
          <span className="pm-label">
            {size === "sm"
              ? msLabel
              : `${msLabel}`}
          </span>
        </button>

        {/* ── Detail Panel ──────────────────────────────────── */}
        {state.showPanel && (
          <div
            className="pm-panel"
            role="dialog"
            aria-label="Detail status koneksi internet"
          >
            {/* Header */}
            <div className="pm-panel__head" style={{ borderBottom: `1px solid ${cfg.border}` }}>
              <div className="pm-panel__head-left">
                <span
                  className={`pm-dot pm-dot--lg ${state.status !== "offline" ? "pm-dot--pulse" : ""}`}
                  style={{ background: cfg.color }}
                  aria-hidden="true"
                />
                <div>
                  <div className="pm-panel__status" style={{ color: cfg.color }}>
                    {cfg.label}
                  </div>
                  <div className="pm-panel__sub">
                    {state.status === "offline"
                      ? "Tidak ada koneksi ke server"
                      : state.status === "checking"
                      ? "Mendeteksi koneksi ke server..."
                      : state.status === "recovering"
                      ? "Koneksi pulih — memverifikasi..."
                      : state.status === "very_slow"
                      ? "Server merespons dengan lambat"
                      : state.status === "slow"
                      ? "Kualitas koneksi di bawah normal"
                      : "Koneksi ke server stabil"}
                  </div>
                </div>
              </div>
              <div className="pm-panel__ms" style={{ color: cfg.color }}>
                {msLabel}
              </div>
            </div>

            {/* Stats */}
            <div className="pm-stats">
              <StatBox label="Rata-rata" value={stats.avg !== null ? `${stats.avg} ms` : "—"} />
              <StatBox label="Tercepat"  value={stats.min !== null ? `${stats.min} ms` : "—"} color="#10b981" />
              <StatBox label="Terlambat" value={stats.max !== null ? `${stats.max} ms` : "—"} color="#f59e0b" />
            </div>

            {/* Histogram bar chart */}
            {state.history.length > 0 && (
              <div className="pm-hist" aria-label="Riwayat latency 10 ping terakhir">
                <div className="pm-hist__label">Riwayat 10 Ping Terakhir</div>
                <HistogramBars history={state.history} />
              </div>
            )}

            {/* Threshold guide */}
            <div className="pm-guide">
              <ThresholdRow color="#10b981" label="Sangat Cepat" range="< 50 ms" />
              <ThresholdRow color="#3b82f6" label="Normal"       range="50–120 ms" />
              <ThresholdRow color="#f59e0b" label="Lambat"       range="120–300 ms" />
              <ThresholdRow color="#ef4444" label="Sangat Lambat" range="> 300 ms" />
            </div>

            {/* Footer */}
            <div className="pm-panel__foot">
              <span>HTTP latency ke server • diperbarui otomatis</span>
              <button
                className="pm-refresh-btn"
                onClick={runPing}
                aria-label="Refresh ping sekarang"
              >
                ↻ Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Sub-komponen ─────────────────────────────────────────────────────────────

function SignalBars({ bars, color }: { bars: number; color: string }) {
  return (
    <span className="pm-bars" aria-hidden="true">
      {[1, 2, 3, 4].map(i => (
        <span
          key={i}
          className="pm-bar"
          style={{
            height: `${i * 3 + 3}px`,
            background: i <= bars ? color : "rgba(150,150,150,.25)",
            opacity: i <= bars ? 1 : 0.5,
          }}
        />
      ))}
    </span>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="pm-stat">
      <div className="pm-stat__val" style={color ? { color } : undefined}>{value}</div>
      <div className="pm-stat__lbl">{label}</div>
    </div>
  );
}

function HistogramBars({ history }: { history: PingEntry[] }) {
  const maxMs = Math.max(...history.map(h => h.ms), 300);
  return (
    <div className="pm-hist__bars">
      {[...history].reverse().map((h, i) => {
        const pct = Math.min((h.ms / maxMs) * 100, 100);
        const col = !h.ok ? "#6b7280"
          : h.ms < THRESHOLDS.excellent ? "#10b981"
          : h.ms < THRESHOLDS.good      ? "#3b82f6"
          : h.ms < THRESHOLDS.slow      ? "#f59e0b"
          : "#ef4444";
        return (
          <div
            key={i}
            className="pm-hist__bar-wrap"
            title={h.ok ? `${h.ms} ms` : "Gagal"}
          >
            <div
              className="pm-hist__bar"
              style={{ height: `${Math.max(pct, 8)}%`, background: col }}
            />
          </div>
        );
      })}
    </div>
  );
}

function ThresholdRow({ color, label, range }: { color: string; label: string; range: string }) {
  return (
    <div className="pm-guide__row">
      <span className="pm-guide__dot" style={{ background: color }} />
      <span className="pm-guide__label">{label}</span>
      <span className="pm-guide__range">{range}</span>
    </div>
  );
}

// ─── CSS ─────────────────────────────────────────────────────────────────────
const PM_STYLES = `
/* PingMonitor — Styles */

@keyframes pm-pulse {
  0%,100% { transform:scale(1); opacity:1; }
  50%      { transform:scale(1.5); opacity:.4; }
}
@keyframes pm-fadein {
  from { opacity:0; transform:translateY(-8px) scale(.97); }
  to   { opacity:1; transform:translateY(0)    scale(1);   }
}

.pm-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  font-family: system-ui, -apple-system, sans-serif;
}

/* ── Badge ────────────────────────────────────────────────── */
.pm-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 10px;
  cursor: pointer;
  transition: all .18s ease;
  white-space: nowrap;
  outline: none;
  user-select: none;
}
.pm-badge:hover { filter: brightness(1.08); transform: scale(1.03); }
.pm-badge:active { transform: scale(.97); }
.pm-badge[disabled] { cursor: default; pointer-events: none; }

.pm-badge--sm { padding: 4px 8px;  font-size: 11px; }
.pm-badge--md { padding: 5px 10px; font-size: 12px; }
.pm-badge--lg { padding: 7px 12px; font-size: 13px; }

/* ── Dot ──────────────────────────────────────────────────── */
.pm-dot {
  display: inline-block;
  width: 7px; height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pm-dot--lg { width: 10px; height: 10px; }
.pm-dot--pulse { animation: pm-pulse 2s ease-in-out infinite; }

/* ── Signal bars ──────────────────────────────────────────── */
.pm-bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 15px;
  flex-shrink: 0;
}
.pm-bar {
  width: 3px;
  border-radius: 2px;
  transition: background .3s, height .3s;
}

/* ── Label ────────────────────────────────────────────────── */
.pm-label {
  font-weight: 700;
  letter-spacing: -.01em;
}

/* ── Detail Panel ─────────────────────────────────────────── */
.pm-panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 99990;
  width: 300px;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 16px 56px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.06);
  overflow: hidden;
  animation: pm-fadein .22s ease both;
}
@media (prefers-color-scheme: dark) {
  .pm-panel {
    background: #1e293b;
    box-shadow: 0 16px 56px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06);
  }
}
@media (max-width: 420px) {
  .pm-panel { right: -60px; width: 280px; }
}

/* Panel header */
.pm-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  gap: 10px;
}
.pm-panel__head-left {
  display: flex; align-items: center; gap: 10px;
}
.pm-panel__status {
  font-size: 14px; font-weight: 800; letter-spacing: -.02em;
}
.pm-panel__sub {
  font-size: 11px; color: #94a3b8; margin-top: 1px; line-height: 1.4;
}
.pm-panel__ms {
  font-size: 20px; font-weight: 900; letter-spacing: -.04em; flex-shrink: 0;
}

/* Stats row */
.pm-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  padding: 0 12px 12px;
}
.pm-stat {
  text-align: center;
  padding: 8px 4px;
  border-radius: 10px;
}
.pm-stat__val { font-size: 13px; font-weight: 800; color: #334155; }
@media (prefers-color-scheme: dark) { .pm-stat__val { color: #e2e8f0; } }
.pm-stat__lbl { font-size: 10px; color: #94a3b8; margin-top: 2px; }

/* Histogram */
.pm-hist { padding: 0 16px 10px; }
.pm-hist__label {
  font-size: 10px; color: #94a3b8; text-transform: uppercase;
  letter-spacing: .06em; margin-bottom: 8px;
}
.pm-hist__bars {
  display: flex; align-items: flex-end; gap: 4px;
  height: 44px;
}
.pm-hist__bar-wrap { flex: 1; display: flex; align-items: flex-end; height: 100%; }
.pm-hist__bar { width: 100%; border-radius: 3px 3px 0 0; transition: height .3s ease; min-height: 4px; }

/* Threshold guide */
.pm-guide {
  border-top: 1px solid rgba(148,163,184,.15);
  padding: 10px 16px;
  display: flex; flex-direction: column; gap: 5px;
}
.pm-guide__row {
  display: flex; align-items: center; gap: 7px;
}
.pm-guide__dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.pm-guide__label { font-size: 11px; color: #475569; font-weight: 600; flex: 1; }
@media (prefers-color-scheme: dark) { .pm-guide__label { color: #94a3b8; } }
.pm-guide__range { font-size: 10.5px; color: #94a3b8; font-variant-numeric: tabular-nums; }

/* Footer */
.pm-panel__foot {
  border-top: 1px solid rgba(148,163,184,.15);
  padding: 8px 16px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 10.5px; color: #94a3b8;
}
.pm-refresh-btn {
  background: none; border: none; cursor: pointer;
  font-size: 11px; color: #6366f1; font-weight: 700;
  padding: 2px 6px; border-radius: 6px;
  transition: background .15s;
}
.pm-refresh-btn:hover { background: rgba(99,102,241,.08); }
`;
