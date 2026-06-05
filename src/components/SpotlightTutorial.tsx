"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useTutorialStore } from '@/store/useTutorialStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function SpotlightTutorial() {
  const { isTutorialActive, currentStep, steps, nextStep, prevStep } = useTutorialStore();
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
    const isMobileW = window.innerWidth < 1024;
    const isSidebarStep =
      step.targetSelector.startsWith('[data-tour="nav-') ||
      step.targetSelector === '[data-tour="logout-button"]';

    let element: Element | null = null;

    if (isMobileW && isSidebarStep) {
      // Pick the visible element among all matches (mobile drawer vs hidden desktop sidebar)
      const all = Array.from(document.querySelectorAll(step.targetSelector));
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.top >= 0 && r.top < window.innerHeight) {
          element = el;
          break;
        }
      }
    } else {
      element = document.querySelector(step.targetSelector);
    }

    if (element) {
      const r = element.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setCoords({ left: r.left, top: r.top, width: r.width, height: r.height });
      } else {
        setCoords(null);
      }
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
  // - On mobile: uses left/right anchors (no fixed width) so never overflows right
  // - Placed BELOW the element when there's space, otherwise ABOVE
  // - Desktop also supports left/right placement
  const getTooltipStyle = (): React.CSSProperties => {
    const margin = 8;    // minimum gap from screen edges
    const off = 12;      // gap between element and tooltip

    // Fallback: no element found yet → show at bottom center
    if (!coords) {
      if (isMobileScreen) {
        return { position: 'fixed', bottom: margin, left: margin, right: margin };
      }
      const TW = Math.min(320, W - 32);
      return { position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: TW };
    }

    const { left, top, width, height } = coords;

    // ── MOBILE ──────────────────────────────────────────────────────────────
    if (isMobileScreen) {
      // Tooltip width: full width minus margins on both sides
      // Use left + right anchors — avoids any right overflow
      const tLeft = margin;
      const tRight = margin;

      // Preferred: below the element
      const belowTop = top + height + off + pad;
      // Estimated tooltip height ~180px
      const spaceBelow = H - belowTop - margin;

      if (spaceBelow >= 160) {
        // Enough space below → place below the element
        return { position: 'fixed', top: belowTop, left: tLeft, right: tRight };
      } else {
        // Not enough space below → place above the element
        const aboveBottom = H - (top - off - pad);
        const aboveBottomClamped = Math.max(margin, Math.min(aboveBottom, H - margin));
        return { position: 'fixed', bottom: aboveBottomClamped, left: tLeft, right: tRight };
      }
    }

    // ── DESKTOP ──────────────────────────────────────────────────────────────
    const TW = Math.min(320, W - 32);
    const TH = 220;
    let pos = activeStep.position;

    // Auto-flip if it would overflow horizontally
    if (pos === 'right' && left + width + off + pad + TW > W - margin) {
      pos = left - off - pad - TW > margin ? 'left' : 'bottom';
    } else if (pos === 'left' && left - off - pad - TW < margin) {
      pos = left + width + off + pad + TW < W - margin ? 'right' : 'bottom';
    }

    let tL = 0, tT = 0;
    if (pos === 'bottom') { tL = left + width / 2 - TW / 2; tT = top + height + off + pad; }
    else if (pos === 'top') { tL = left + width / 2 - TW / 2; tT = top - TH - off - pad; }
    else if (pos === 'left') { tL = left - TW - off - pad; tT = top + height / 2 - TH / 2; }
    else if (pos === 'right') { tL = left + width + off + pad; tT = top + height / 2 - TH / 2; }

    tL = Math.max(margin, Math.min(tL, W - TW - margin));
    tT = Math.max(margin, Math.min(tT, H - TH - margin));

    return { position: 'fixed', left: tL, top: tT, width: TW };
  };


  return (
    <>
      {/* Layer 1 — Dark blurred overlay with spotlight cutout
          NOTE: Keep this as a SEPARATE root element, NOT wrapping the tooltip,
          so framer-motion transforms don't affect tooltip's fixed positioning */}
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

      {/* Layer 3 — Tooltip panel (separate root element — no overflow-hidden parent) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          style={getTooltipStyle()}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
          className="z-[99999] pointer-events-auto bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-2xl shadow-2xl p-5 flex flex-col gap-3 text-text-light dark:text-text-dark overflow-hidden"
        >
          {/* Title */}
          <h4 className="font-black text-sm text-primary uppercase tracking-wide leading-snug break-words">
            {activeStep.title}
          </h4>

          {/* Description */}
          <p className="text-xs text-muted leading-relaxed">
            {activeStep.description}
          </p>

          {/* Footer */}
          <div className="flex justify-between items-center pt-2 border-t border-border-light/60 dark:border-border-dark/60">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wide">
              Langkah {currentStep + 1} dari {steps.length}
            </span>
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={prevStep}
                  className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 text-muted rounded-xl transition-all"
                  title="Kembali"
                  aria-label="Langkah sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={nextStep}
                className="flex items-center gap-1 bg-primary hover:bg-primary-hover text-white px-3 py-2 rounded-xl text-xs font-black uppercase transition-all shadow-md shadow-primary/10"
              >
                {currentStep === steps.length - 1 ? 'Selesai' : <> Lanjut <ChevronRight className="w-3.5 h-3.5" /></>}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
