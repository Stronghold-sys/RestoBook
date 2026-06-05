"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useTutorialStore } from '@/store/useTutorialStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function SpotlightTutorial() {
  const { isTutorialActive, currentStep, steps, nextStep, prevStep, skipTutorial } = useTutorialStore();
  const [coords, setCoords] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  // Use actual window dimensions from the start
  const [vw, setVw] = useState(0);
  const [vh, setVh] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Capture real viewport dimensions immediately on mount
  useEffect(() => {
    const update = () => {
      setVw(window.innerWidth);
      setVh(window.innerHeight);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Open/close mobile sidebar drawer based on current step
  useEffect(() => {
    if (!isTutorialActive || steps.length === 0) return;
    const step = steps[currentStep];
    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
      const isSidebarStep =
        step.targetSelector.startsWith('[data-tour="nav-') ||
        step.targetSelector === '[data-tour="logout-button"]';
      window.dispatchEvent(
        new CustomEvent(isSidebarStep ? 'open-mobile-sidebar' : 'close-mobile-sidebar')
      );
    }
  }, [isTutorialActive, currentStep, steps]);

  useEffect(() => {
    if (!isTutorialActive) {
      window.dispatchEvent(new CustomEvent('close-mobile-sidebar'));
    }
  }, [isTutorialActive]);

  // Poll for element coordinates — handles sidebar slide-in animation
  const updateCoords = useCallback(() => {
    if (!isTutorialActive || steps.length === 0) { setCoords(null); return; }

    const step = steps[currentStep];
    let element: Element | null = null;

    // Pick the visible element among all matches (e.g. mobile drawer vs hidden desktop sidebar)
    const all = Array.from(document.querySelectorAll(step.targetSelector));
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        element = el;
        break;
      }
    }

    if (element) {
      const r = element.getBoundingClientRect();
      setCoords({ left: r.left, top: r.top, width: r.width, height: r.height });
    } else {
      setCoords(null);
    }
  }, [isTutorialActive, currentStep, steps]);

  useEffect(() => {
    if (!isTutorialActive || steps.length === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCoords(null);
      return;
    }
    if (intervalRef.current) clearInterval(intervalRef.current);
    updateCoords();
    intervalRef.current = setInterval(updateCoords, 80);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isTutorialActive, currentStep, steps, vw, vh, updateCoords]);

  // Scroll target element into view when currentStep changes (handles overflow-y scroll container)
  useEffect(() => {
    if (!isTutorialActive || steps.length === 0) return;
    const step = steps[currentStep];

    const scrollIntoViewWithRetry = () => {
      let element: Element | null = null;
      const all = Array.from(document.querySelectorAll(step.targetSelector));
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          element = el;
          break;
        }
      }

      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    };

    // Run immediately and again with short delays to account for animation & render lag
    scrollIntoViewWithRetry();
    const timer = setTimeout(scrollIntoViewWithRetry, 100);
    const timer2 = setTimeout(scrollIntoViewWithRetry, 300);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [isTutorialActive, currentStep, steps]);

  if (!isTutorialActive || steps.length === 0) return null;

  const activeStep = steps[currentStep];
  // Use real window dimensions for all calculations — vw/vh are 0 on SSR, fallback to 1200/800
  const W = vw || 1200;
  const H = vh || 800;
  const isMobileScreen = W < 640;

  const pad = activeStep?.targetSelector === '[data-tour="header-notifications"]' ? 18 : 8;

  // ── SVG mask for the spotlight cutout ──────────────────────────────────────
  const getMaskStyle = () => {
    if (!coords) return { maskImage: 'none', WebkitMaskImage: 'none' };
    const { left, top, width, height } = coords;
    const x = Math.max(2, left - pad);
    const y = Math.max(2, top - pad);
    const rW = Math.min(W - x - 2, width + pad * 2);
    const rH = Math.min(H - y - 2, height + pad * 2);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      `<defs><mask id="m"><rect width="${W}" height="${H}" fill="white"/>` +
      `<rect x="${x}" y="${y}" width="${rW}" height="${rH}" rx="12" ry="12" fill="black"/>` +
      `</mask></defs><rect width="${W}" height="${H}" fill="white" mask="url(#m)"/></svg>`;
    const mask = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
    return { maskImage: mask, WebkitMaskImage: mask, maskSize: '100% 100%', WebkitMaskSize: '100% 100%', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat' };
  };

  // ── Highlight outline box position (fixed, never overflow) ─────────────────
  const getHighlightStyle = (): React.CSSProperties => {
    if (!coords) return { display: 'none' };
    const x = Math.max(2, coords.left - pad);
    const y = Math.max(2, coords.top - pad);
    return {
      position: 'fixed',
      left: x,
      top: y,
      width: Math.min(W - x - 2, coords.width + pad * 2),
      height: Math.min(H - y - 2, coords.height + pad * 2),
    };
  };

  // ── Tooltip position ────────────────────────────────────────────────────────
  // Tooltip follows the highlighted element on ALL screen sizes.
  // - Uses a compact 290px card that centers below/above the element.
  // - Automatically flips to above the element if there is no space below.
  // - Prevents overflow on screen boundaries.
  const getTooltipStyle = (): React.CSSProperties => {
    const margin = 12;   // minimum gap from screen edges
    const off = 10;      // gap between element and tooltip
    const TW = Math.min(290, W - 24); // Compact card width: 290px max

    // Fallback: no element found or coordinates missing → show at center of screen
    if (!coords) {
      // Calculate exact pixel coordinates for centering to prevent conflicts with Framer Motion's transform animation
      const tL = W / 2 - TW / 2;
      const tT = H / 2 - 120; // 120px is approximately half of the card height
      return {
        position: 'fixed',
        left: tL,
        top: Math.max(margin, tT),
        width: TW,
      };
    }

    const { left, top, width, height } = coords;

    // ── MOBILE & DRAWER ACTIVE STATE (< 1024px) ─────────────────────────────
    const isMobileW = W < 1024;
    if (isMobileW) {
      // 1. Center relative to the highlighted element
      let tL = left + width / 2 - TW / 2;
      tL = Math.max(margin, Math.min(tL, W - TW - margin));

      // 2. Place below by default. If not enough space, place above.
      const belowTop = top + height + off + pad;
      const spaceBelow = H - belowTop - margin;
      
      const estHeight = 200; // Estimated height for compact card

      if (spaceBelow >= estHeight || top < estHeight) {
        return {
          position: 'fixed',
          left: tL,
          top: belowTop,
          width: TW,
        };
      } else {
        const aboveBottom = H - (top - off - pad);
        return {
          position: 'fixed',
          left: tL,
          bottom: aboveBottom,
          width: TW,
        };
      }
    }

    // ── DESKTOP (>= 1024px) ──────────────────────────────────────────────────
    // Keep side-anchoring supporting right/left/top/bottom, but with TW = 290
    const TH = 200;
    let pos = activeStep.position;

    // Auto-flip if it would overflow horizontally
    if (pos === 'right' && left + width + off + pad + TW > W - margin) {
      pos = left - off - pad - TW > margin ? 'left' : 'bottom';
    } else if (pos === 'left' && left - off - pad - TW < margin) {
      pos = left + width + off + pad + TW < W - margin ? 'right' : 'bottom';
    }

    let tL = 0, tT = 0;
    if (pos === 'bottom') { 
      tL = left + width / 2 - TW / 2; 
      tT = top + height + off + pad; 
    } else if (pos === 'top') { 
      tL = left + width / 2 - TW / 2; 
      tT = top - TH - off - pad; 
    } else if (pos === 'left') { 
      tL = left - TW - off - pad; 
      tT = top + height / 2 - TH / 2; 
    } else if (pos === 'right') { 
      tL = left + width + off + pad; 
      tT = top + height / 2 - TH / 2; 
    }

    tL = Math.max(margin, Math.min(tL, W - TW - margin));
    tT = Math.max(margin, Math.min(tT, H - TH - margin));

    return { 
      position: 'fixed', 
      left: tL, 
      top: tT, 
      width: TW 
    };
  };


  return (
    <>
      {/* Layer 1 — Dark blurred overlay with spotlight cutout */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99996] bg-black/65 backdrop-blur-[4px] pointer-events-auto"
        style={getMaskStyle()}
      />

      {/* Layer 2 — Spotlight outline ring */}
      {coords && (
        <div
          style={getHighlightStyle()}
          className="fixed z-[99997] border-2 border-primary rounded-xl shadow-[0_0_18px_rgba(234,88,12,0.5)] pointer-events-none"
        />
      )}

      {/* Layer 3 — Redesigned Compact Tooltip Panel */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          style={getTooltipStyle()}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="z-[99999] pointer-events-auto bg-card-light/95 dark:bg-card-dark/95 backdrop-blur-md border border-border-light/80 dark:border-border-dark/80 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 text-text-light dark:text-text-dark select-none"
        >
          {/* Header Progress indicator */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-[10px] font-black text-primary uppercase tracking-widest">
              <span>Panduan Fitur</span>
              <span>{currentStep + 1} / {steps.length}</span>
            </div>
            <div className="w-full h-1 bg-gray-200/55 dark:bg-gray-800/55 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 rounded-full" 
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Title */}
          <h4 className="font-extrabold text-sm text-text-light dark:text-text-dark mt-0.5 leading-snug break-words">
            {activeStep.title}
          </h4>

          {/* Description */}
          <p className="text-xs text-muted leading-relaxed font-medium">
            {activeStep.description}
          </p>

          {/* Footer controls */}
          <div className="flex justify-between items-center pt-2.5 mt-0.5 border-t border-border-light/60 dark:border-border-dark/60">
            {currentStep > 0 ? (
              <button
                onClick={prevStep}
                className="flex items-center gap-0.5 text-[11px] font-bold text-muted hover:text-text-light dark:hover:text-text-dark transition-all px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
                title="Kembali"
                aria-label="Langkah sebelumnya"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Kembali
              </button>
            ) : (
              <button
                onClick={skipTutorial}
                className="text-[11px] font-bold text-rose-500/80 hover:text-rose-500 transition-all px-2.5 py-1.5 rounded-xl hover:bg-rose-500/10"
                title="Lewati"
                aria-label="Lewati tutorial"
              >
                Lewati
              </button>
            )}

            <button
              onClick={nextStep}
              className="flex items-center gap-1 bg-primary hover:bg-primary-hover text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-primary/10 hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]"
            >
              {currentStep === steps.length - 1 ? 'Selesai' : <> Lanjut <ChevronRight className="w-3.5 h-3.5" /></>}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
