"use client";

/**
 * ConnectionDetector — Pendeteksi Status Koneksi & Halaman Modern
 * ─────────────────────────────────────────────────────────────────
 * 4 Status yang didukung:
 *  1. OFFLINE       — navigator.onLine=false / ping berulang gagal
 *  2. SLOW_INTERNET — koneksi ada tapi ping lambat > threshold
 *  3. SLOW_PAGE     — halaman lambat render (browser/resource berat)
 *  4. RECOVERED     — koneksi pulih, auto-refresh sekali
 */

import React, { useState, useEffect, useRef, useCallback } from "react";

// ─── Konstanta & konfigurasi ──────────────────────────────────────────────────
const PING_URL            = "/api/ping";
const PING_INTERVAL_MS    = 5_000;   // Cek tiap 5 detik saat normal
const PING_TIMEOUT_MS     = 3_500;   // Timeout tiap request ping
const SLOW_THRESHOLD_MS   = 1_800;   // > 1.8s = koneksi lambat
const OFFLINE_FAILURES    = 3;       // Gagal 3x berturut = offline
const RECOVER_SUCCESSES   = 2;       // Sukses 2x berturut = pulih
const PAGE_SLOW_MS        = 5_000;   // Halaman belum siap setelah 5 det = slow page
const STORAGE_KEY         = "rb_conn_monitor";
const AUTO_REFRESH_KEY    = "rb_auto_refreshed";

type ConnectionStatus = "online" | "offline" | "slow_internet" | "slow_page" | "recovered" | "idle";

interface MonitorState {
  status: ConnectionStatus;
  lastChecked: number;
}

// ─── Helper: ping dengan timeout ──────────────────────────────────────────────
async function doPing(): Promise<{ ok: boolean; latency: number }> {
  const t0 = performance.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PING_TIMEOUT_MS);
    const res = await fetch(`${PING_URL}?_t=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const latency = performance.now() - t0;
    return { ok: res.ok, latency };
  } catch {
    return { ok: false, latency: PING_TIMEOUT_MS };
  }
}

// ─── Komponen utama ───────────────────────────────────────────────────────────
export default function ConnectionDetector() {
  const [status, setStatus]           = useState<ConnectionStatus>("idle");
  const [visible, setVisible]         = useState(false);
  const [dismissed, setDismissed]     = useState(false);
  const [latency, setLatency]         = useState<number | null>(null);
  const [countdown, setCountdown]     = useState(3);

  const failCount      = useRef(0);
  const successCount   = useRef(0);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pageSlow       = useRef(false);
  const prevStatus     = useRef<ConnectionStatus>("idle");
  const refreshedRef   = useRef(false);

  // ── Simpan / muat state dari sessionStorage ───────────────────────────────
  const saveState = useCallback((s: ConnectionStatus) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ status: s, lastChecked: Date.now() } satisfies MonitorState));
    } catch {}
  }, []);

  // ── Ubah status & tampilkan overlay ──────────────────────────────────────
  const applyStatus = useCallback((s: ConnectionStatus) => {
    if (s === prevStatus.current && s !== "recovered") return; // Jangan re-render jika sama
    prevStatus.current = s;
    setStatus(s);
    saveState(s);
    setDismissed(false);

    if (s === "idle" || s === "online") {
      setVisible(false);
    } else {
      setVisible(true);
    }
  }, [saveState]);

  // ── Auto refresh ─────────────────────────────────────────────────────────
  const autoRefreshOnce = useCallback(() => {
    const alreadyRefreshed = sessionStorage.getItem(AUTO_REFRESH_KEY) === "1";
    if (alreadyRefreshed || refreshedRef.current) return;
    refreshedRef.current = true;
    sessionStorage.setItem(AUTO_REFRESH_KEY, "1");

    setCountdown(3);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ── Logic utama ping ──────────────────────────────────────────────────────
  const checkConnection = useCallback(async () => {
    const isNavigatorOnline = navigator.onLine;

    if (!isNavigatorOnline) {
      successCount.current = 0;
      failCount.current = Math.min(failCount.current + 1, OFFLINE_FAILURES + 1);
      if (failCount.current >= OFFLINE_FAILURES) {
        applyStatus("offline");
      }
      return;
    }

    const { ok, latency: ms } = await doPing();
    setLatency(ms);

    if (!ok) {
      successCount.current = 0;
      failCount.current++;
      if (failCount.current >= OFFLINE_FAILURES) {
        applyStatus("offline");
      } else if (failCount.current >= 2) {
        applyStatus("slow_internet");
      }
      return;
    }

    // Berhasil
    failCount.current = 0;
    successCount.current++;

    if (ms > SLOW_THRESHOLD_MS) {
      successCount.current = 0;
      applyStatus("slow_internet");
      return;
    }

    // Pulih dari state buruk
    if (prevStatus.current === "offline" || prevStatus.current === "slow_internet" || prevStatus.current === "slow_page") {
      if (successCount.current >= RECOVER_SUCCESSES) {
        applyStatus("recovered");
        autoRefreshOnce();
        return;
      }
    }

    // Normal
    if (prevStatus.current !== "idle" && prevStatus.current !== "online") {
      // Sudah recovery tapi belum terpicu
    } else {
      applyStatus("online");
      setVisible(false);
    }
  }, [applyStatus, autoRefreshOnce]);

  // ── Deteksi halaman lambat memuat ─────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Hapus flag auto-refresh saat reload manual (bukan otomatis)
    // Hanya hapus jika sudah > 30 detik sejak terakhir di-set
    const lastSaved = sessionStorage.getItem(STORAGE_KEY);
    if (lastSaved) {
      try {
        const parsed: MonitorState = JSON.parse(lastSaved);
        if (Date.now() - parsed.lastChecked > 30_000) {
          sessionStorage.removeItem(AUTO_REFRESH_KEY);
          sessionStorage.removeItem(STORAGE_KEY);
        }
      } catch {}
    }

    // Timer halaman lambat — hanya aktif jika internet masih ada
    const slowPageTimer = setTimeout(() => {
      if (document.readyState !== "complete" && navigator.onLine) {
        pageSlow.current = true;
        if (prevStatus.current === "idle" || prevStatus.current === "online") {
          applyStatus("slow_page");
        }
      }
    }, PAGE_SLOW_MS);

    const onLoad = () => {
      clearTimeout(slowPageTimer);
      if (pageSlow.current) {
        pageSlow.current = false;
        if (prevStatus.current === "slow_page") {
          applyStatus("online");
          setVisible(false);
        }
      }
    };

    if (document.readyState === "complete") {
      clearTimeout(slowPageTimer);
    } else {
      window.addEventListener("load", onLoad, { once: true });
    }

    return () => {
      clearTimeout(slowPageTimer);
      window.removeEventListener("load", onLoad);
    };
  }, [applyStatus]);

  // ── Event listener online/offline ─────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onOffline = () => {
      failCount.current = OFFLINE_FAILURES;
      successCount.current = 0;
      applyStatus("offline");
    };

    const onOnline = () => {
      // Jangan langsung "online" — verifikasi dulu lewat ping
      checkConnection();
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    // Cek pertama
    checkConnection();

    // Mulai polling interval
    intervalRef.current = setInterval(checkConnection, PING_INTERVAL_MS);

    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [checkConnection, applyStatus]);

  // ── Manual retry ─────────────────────────────────────────────────────────
  const handleRetry = useCallback(async () => {
    failCount.current = 0;
    successCount.current = 0;
    await checkConnection();
  }, [checkConnection]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setVisible(false);
  }, []);

  // ── Jangan render di luar browser / tidak visible / dismissed ────────────
  if (typeof window === "undefined") return null;
  if (!visible || dismissed) return null;

  return (
    <>
      <style>{CSS_STYLES}</style>
      <ConnectionUI
        status={status}
        latency={latency}
        countdown={countdown}
        onRetry={handleRetry}
        onDismiss={handleDismiss}
      />
    </>
  );
}

// ─── Komponen tampilan terpisah ───────────────────────────────────────────────
interface UIProps {
  status: ConnectionStatus;
  latency: number | null;
  countdown: number;
  onRetry: () => void;
  onDismiss: () => void;
}

function ConnectionUI({ status, latency, countdown, onRetry, onDismiss }: UIProps) {
  if (status === "offline") {
    return (
      <>
        {/* Top Banner */}
        <div className="cm-banner cm-banner--offline" role="alert" aria-live="assertive">
          <span className="cm-banner__icon">{IconWifiOff}</span>
          <span>Koneksi terputus. Halaman akan aktif kembali saat koneksi pulih.</span>
        </div>

        {/* Fullscreen overlay */}
        <div className="cm-overlay" role="dialog" aria-modal="true" aria-label="Status koneksi offline">
          <div className="cm-card cm-card--offline">
            {/* Animated wave rings */}
            <div className="cm-rings">
              <div className="cm-ring cm-ring--1" />
              <div className="cm-ring cm-ring--2" />
              <div className="cm-ring cm-ring--3" />
              <div className="cm-icon-wrap cm-icon-wrap--offline">
                {IconWifiOff}
              </div>
            </div>

            <div className="cm-progress-bar cm-progress-bar--stopped" />

            <div className="cm-content">
              <h2 className="cm-title">Koneksi Terputus</h2>
              <p className="cm-desc">
                Internet tidak terdeteksi. Periksa sambungan Wi-Fi atau data seluler Anda.
              </p>
              <p className="cm-note">
                ⏳ Halaman akan aktif kembali secara otomatis saat koneksi pulih.
              </p>
            </div>

            <div className="cm-actions">
              <button className="cm-btn cm-btn--primary" onClick={onRetry} aria-label="Coba lagi">
                {IconRefresh} Coba Lagi
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (status === "slow_internet") {
    return (
      <div className="cm-banner cm-banner--slow" role="status" aria-live="polite">
        <div className="cm-top-progress" />
        <div className="cm-banner__inner">
          <span className="cm-banner__icon cm-pulse">{IconSignal}</span>
          <div className="cm-banner__text">
            <strong>Internet Lambat</strong>
            <span>Koneksi tidak stabil. Beberapa fitur mungkin memuat lebih lama.
              {latency && latency < 9999 && <em> ({Math.round(latency)}ms)</em>}
            </span>
          </div>
          <div className="cm-banner__actions">
            <button className="cm-btn cm-btn--ghost cm-btn--sm" onClick={onRetry} aria-label="Muat ulang">
              {IconRefresh} Muat Ulang
            </button>
            <button className="cm-btn-close" onClick={onDismiss} aria-label="Tutup notifikasi">
              {IconX}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "slow_page") {
    return (
      <div className="cm-toast cm-toast--loading" role="status" aria-live="polite">
        <div className="cm-toast__shimmer" />
        <div className="cm-toast__inner">
          <span className="cm-spinner" aria-hidden="true" />
          <div className="cm-toast__text">
            <strong>Halaman Memuat Lebih Lama</strong>
            <span>Browser sedang memproses konten. Ini bukan masalah internet Anda.</span>
          </div>
          <div className="cm-toast__actions">
            <button className="cm-btn cm-btn--ghost cm-btn--sm" onClick={() => window.location.reload()} aria-label="Coba muat ulang">
              Muat Ulang
            </button>
            <button className="cm-btn-close" onClick={onDismiss} aria-label="Tutup">
              {IconX}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "recovered") {
    return (
      <div className="cm-toast cm-toast--success" role="status" aria-live="polite">
        <div className="cm-toast__inner">
          <span className="cm-check-icon">{IconCheckCircle}</span>
          <div className="cm-toast__text">
            <strong>Koneksi Pulih!</strong>
            <span>Internet kembali normal. Memuat data terbaru dalam <strong>{countdown}s</strong>…</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── SVG Icons (inline, zero-dependency) ─────────────────────────────────────
const IconWifiOff = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
    <path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
    <circle cx="12" cy="20" r="1"/>
  </svg>
);

const IconSignal = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
    <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
    <circle cx="12" cy="20" r="1"/>
  </svg>
);

const IconRefresh = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10"/>
    <polyline points="1 20 1 14 7 14"/>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
  </svg>
);

const IconX = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconCheckCircle = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

// ─── CSS (semua animasi dan gaya dalam satu blok ─ zero external deps) ─────────
const CSS_STYLES = `
/* ═══════════════════════════════════════════════════════════════
   ConnectionDetector — Styles
   ═══════════════════════════════════════════════════════════════ */

/* ── Keyframes ─────────────────────────────────────────────── */
@keyframes cm-fade-in        { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
@keyframes cm-fade-in-up     { from{opacity:0;transform:translateY(20px) scale(.95)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes cm-slide-right    { from{opacity:0;transform:translateX(100%)} to{opacity:1;transform:translateX(0)} }
@keyframes cm-pulse-ring     { 0%,100%{transform:scale(1);opacity:.6} 50%{transform:scale(1.18);opacity:.25} }
@keyframes cm-spin           { to{transform:rotate(360deg)} }
@keyframes cm-ping           { 75%,100%{transform:scale(2);opacity:0} }
@keyframes cm-shimmer        { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
@keyframes cm-progress-wave  { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
@keyframes cm-bounce-subtle  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
@keyframes cm-slide-down     { from{max-height:0;opacity:0} to{max-height:160px;opacity:1} }
@keyframes cm-check-pop      { 0%{transform:scale(0) rotate(-30deg);opacity:0} 70%{transform:scale(1.15) rotate(5deg)} 100%{transform:scale(1) rotate(0);opacity:1} }

/* ── Top Banner (offline / slow) ───────────────────────────── */
.cm-banner {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 99999;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  animation: cm-fade-in .35s ease both;
  overflow: hidden;
}

.cm-banner--offline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: #dc2626;
  color: #fff;
  font-weight: 600;
  letter-spacing: .01em;
}
.cm-banner--offline .cm-banner__icon {
  width: 16px; height: 16px; display: flex; align-items: center;
  animation: cm-bounce-subtle 2s infinite;
}

.cm-banner--slow {
  background: linear-gradient(135deg, #78350f 0%, #92400e 100%);
  color: #fef3c7;
  border-bottom: 1px solid #b45309;
}
.cm-banner__inner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  max-width: 900px;
  margin: 0 auto;
  flex-wrap: wrap;
}
.cm-banner__icon { width: 18px; height: 18px; flex-shrink: 0; }
.cm-banner__text { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.cm-banner__text strong { font-weight: 700; font-size: 13px; }
.cm-banner__text span   { font-size: 11.5px; opacity: .85; }
.cm-banner__text em     { font-style: normal; opacity: .7; font-size: 10.5px; }
.cm-banner__actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }

/* ── Fullscreen Overlay ─────────────────────────────────────── */
.cm-overlay {
  position: fixed;
  inset: 0;
  z-index: 99998;
  background: rgba(2, 6, 23, .55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: cm-fade-in .4s ease both;
}

/* ── Card ───────────────────────────────────────────────────── */
.cm-card {
  background: #fff;
  border-radius: 28px;
  padding: 40px 36px 32px;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 24px 80px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06);
  text-align: center;
  position: relative;
  overflow: hidden;
  animation: cm-fade-in-up .45s cubic-bezier(.22,1,.36,1) both;
}
@media (prefers-color-scheme: dark) {
  .cm-card { background: #0f172a; border: 1px solid #1e293b; }
}

/* ── Rings animation (offline icon bg) ─────────────────────── */
.cm-rings {
  position: relative;
  width: 96px; height: 96px;
  margin: 0 auto 24px;
  display: flex; align-items: center; justify-content: center;
}
.cm-ring {
  position: absolute;
  border-radius: 50%;
  animation: cm-pulse-ring 2.4s ease-in-out infinite;
}
.cm-ring--1 { width: 96px; height: 96px; background: rgba(239,68,68,.08); animation-delay: 0s; }
.cm-ring--2 { width: 72px; height: 72px; background: rgba(239,68,68,.13); animation-delay: .4s; }
.cm-ring--3 { width: 50px; height: 50px; background: rgba(239,68,68,.18); animation-delay: .8s; }

.cm-icon-wrap {
  position: relative;
  z-index: 1;
  width: 52px; height: 52px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
}
.cm-icon-wrap--offline {
  background: #fef2f2;
  color: #dc2626;
  box-shadow: 0 4px 20px rgba(239,68,68,.25);
}
.cm-icon-wrap svg { width: 26px; height: 26px; }

/* ── Progress bar ───────────────────────────────────────────── */
.cm-progress-bar {
  height: 3px;
  border-radius: 2px;
  margin-bottom: 24px;
  overflow: hidden;
  background: #f1f5f9;
  position: relative;
}
.cm-progress-bar::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, #ea580c, transparent);
  animation: cm-progress-wave 1.8s ease infinite;
  width: 50%;
}
.cm-progress-bar--stopped::after {
  background: #e2e8f0;
  animation: none;
  width: 100%;
}

/* ── Top thin progress (banner slow) ───────────────────────── */
.cm-top-progress {
  height: 2px;
  background: linear-gradient(90deg, transparent, #fbbf24, #f59e0b, transparent);
  background-size: 300% 100%;
  animation: cm-progress-wave 1.6s linear infinite;
  position: absolute;
  top: 0; left: 0; right: 0;
}

/* ── Content text ───────────────────────────────────────────── */
.cm-title {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -.02em;
  color: #0f172a;
  margin: 0 0 8px;
}
@media (prefers-color-scheme: dark) {
  .cm-title { color: #f1f5f9; }
}
.cm-desc {
  font-size: 13.5px;
  color: #64748b;
  line-height: 1.6;
  margin: 0 0 10px;
}
.cm-note {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 20px;
}
.cm-content { margin-bottom: 8px; }

/* ── Action buttons ─────────────────────────────────────────── */
.cm-actions { display: flex; flex-direction: column; gap: 10px; }

.cm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: none;
  border-radius: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all .18s ease;
  font-family: inherit;
  letter-spacing: .01em;
}
.cm-btn:active { transform: scale(.97); }

.cm-btn--primary {
  width: 100%;
  padding: 14px 20px;
  background: #ea580c;
  color: #fff;
  font-size: 13px;
  box-shadow: 0 6px 24px rgba(234,88,12,.3);
}
.cm-btn--primary:hover { background: #c2410c; box-shadow: 0 8px 28px rgba(234,88,12,.4); }

.cm-btn--ghost {
  padding: 7px 14px;
  background: rgba(255,255,255,.15);
  color: inherit;
  font-size: 12px;
  border-radius: 8px;
}
.cm-btn--ghost:hover { background: rgba(255,255,255,.25); }

.cm-btn--sm { font-size: 11.5px; }

.cm-btn svg { width: 14px; height: 14px; }

.cm-btn-close {
  width: 28px; height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(255,255,255,.15);
  color: inherit;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background .18s;
  flex-shrink: 0;
}
.cm-btn-close:hover { background: rgba(255,255,255,.28); }
.cm-btn-close svg { width: 13px; height: 13px; }

/* ── Spinner ────────────────────────────────────────────────── */
.cm-spinner {
  display: inline-block;
  width: 18px; height: 18px;
  border: 2.5px solid rgba(100,116,139,.25);
  border-top-color: #ea580c;
  border-radius: 50%;
  animation: cm-spin .8s linear infinite;
  flex-shrink: 0;
}

/* ── Pulse animation ────────────────────────────────────────── */
.cm-pulse { animation: cm-bounce-subtle 2.5s ease infinite; }

/* ── Toast (loading + success) ─────────────────────────────── */
.cm-toast {
  position: fixed;
  bottom: 24px; right: 24px;
  z-index: 99999;
  max-width: 380px;
  width: calc(100vw - 48px);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 16px 56px rgba(0,0,0,.22), 0 0 0 1px rgba(255,255,255,.08);
  animation: cm-slide-right .4s cubic-bezier(.22,1,.36,1) both;
  font-family: system-ui, -apple-system, sans-serif;
}
@media (max-width: 480px) {
  .cm-toast { bottom: 16px; right: 12px; left: 12px; width: auto; }
}

.cm-toast--loading {
  background: #1e293b;
  color: #e2e8f0;
}
@media (prefers-color-scheme: light) {
  .cm-toast--loading { background: #fff; color: #1e293b; border: 1px solid #e2e8f0; }
}
.cm-toast--success {
  background: linear-gradient(135deg, #064e3b 0%, #065f46 100%);
  color: #d1fae5;
}

.cm-toast__shimmer {
  height: 2px;
  background: linear-gradient(90deg, #334155, #ea580c, #f59e0b, #334155);
  background-size: 200% 100%;
  animation: cm-shimmer 1.8s linear infinite;
}

.cm-toast__inner {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
}

.cm-toast__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.cm-toast__text strong { font-size: 13px; font-weight: 700; }
.cm-toast__text span   { font-size: 11.5px; opacity: .8; line-height: 1.5; }
.cm-toast__text strong { white-space: nowrap; }

.cm-toast__actions { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }

/* ── Success icon (check) ───────────────────────────────────── */
.cm-check-icon {
  width: 32px; height: 32px;
  flex-shrink: 0;
  color: #6ee7b7;
  display: flex; align-items: center; justify-content: center;
  animation: cm-check-pop .5s cubic-bezier(.22,1,.36,1) .1s both;
}
.cm-check-icon svg { width: 32px; height: 32px; }

/* ── Responsive adjustments ─────────────────────────────────── */
@media (max-width: 600px) {
  .cm-card { padding: 32px 20px 24px; border-radius: 20px; }
  .cm-title { font-size: 18px; }
  .cm-banner__inner { flex-direction: column; align-items: flex-start; gap: 8px; }
  .cm-banner__actions { width: 100%; justify-content: flex-end; }
}
`;
