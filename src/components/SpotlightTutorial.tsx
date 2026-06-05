"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useTutorialStore } from '@/store/useTutorialStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function SpotlightTutorial() {
  const { isTutorialActive, currentStep, steps, nextStep, prevStep } = useTutorialStore();
  const [coords, setCoords] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track window resizing
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });

    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Programmatic mobile sidebar opening/closing
  useEffect(() => {
    if (!isTutorialActive || steps.length === 0) return;

    const step = steps[currentStep];
    const isMobile = window.innerWidth < 1024;

    if (isMobile) {
      const isSidebarStep = step.targetSelector.startsWith('[data-tour="nav-') ||
                            step.targetSelector === '[data-tour="logout-button"]';

      if (isSidebarStep) {
        window.dispatchEvent(new CustomEvent('open-mobile-sidebar'));
      } else {
        window.dispatchEvent(new CustomEvent('close-mobile-sidebar'));
      }
    }
  }, [isTutorialActive, currentStep, steps]);

  useEffect(() => {
    if (!isTutorialActive) {
      window.dispatchEvent(new CustomEvent('close-mobile-sidebar'));
    }
  }, [isTutorialActive]);

  // Core function to find the element and update coordinates
  const updateCoords = useCallback(() => {
    if (!isTutorialActive || steps.length === 0) {
      setCoords(null);
      return;
    }

    const step = steps[currentStep];
    
    // On mobile, prefer elements inside the open mobile sidebar drawer
    // On desktop, prefer the fixed sidebar elements
    const isMobile = window.innerWidth < 1024;
    const isSidebarStep = step.targetSelector.startsWith('[data-tour="nav-') ||
                          step.targetSelector === '[data-tour="logout-button"]';

    let element: Element | null = null;

    if (isMobile && isSidebarStep) {
      // Query ALL matching elements and pick the one that is actually visible (in the mobile drawer)
      const allMatches = Array.from(document.querySelectorAll(step.targetSelector));
      for (const el of allMatches) {
        const rect = el.getBoundingClientRect();
        // Mobile drawer element will have valid coordinates visible within the viewport
        if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight) {
          element = el;
          break;
        }
      }
    } else {
      element = document.querySelector(step.targetSelector);
    }

    if (element) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCoords({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        });
        // Auto-scroll element into view if it's partially out of viewport
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } else {
        setCoords(null);
      }
    } else {
      setCoords(null);
    }
  }, [isTutorialActive, currentStep, steps]);

  // Set up polling interval for coordinate tracking during animations (sidebar slide-in, etc.)
  useEffect(() => {
    if (!isTutorialActive || steps.length === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCoords(null);
      return;
    }

    // Clear previous interval
    if (intervalRef.current) clearInterval(intervalRef.current);

    // Initial update immediately
    updateCoords();

    // Poll every 80ms — fast enough to track slide-in animations
    intervalRef.current = setInterval(updateCoords, 80);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTutorialActive, currentStep, steps, windowSize, updateCoords]);

  if (!isTutorialActive || steps.length === 0) return null;

  const activeStep = steps[currentStep];
  const isMobile = windowSize.width < 640;

  const getPadding = () => {
    if (activeStep?.targetSelector === '[data-tour="header-notifications"]') return 18;
    return 8;
  };

  // Generate SVG mask for backdrop cutout
  const getMaskStyle = () => {
    const w = windowSize.width;
    const h = windowSize.height;
    if (!coords) {
      return {
        maskImage: 'none',
        WebkitMaskImage: 'none',
      };
    }

    const { left, top, width, height } = coords;
    const padding = getPadding();

    const x = Math.max(2, left - padding);
    const y = Math.max(2, top - padding);
    const rW = Math.min(w - x - 2, width + padding * 2);
    const rH = Math.min(h - y - 2, height + padding * 2);
    const radius = 12;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><mask id="spotlight-mask"><rect width="${w}" height="${h}" fill="white"/><rect x="${x}" y="${y}" width="${rW}" height="${rH}" rx="${radius}" ry="${radius}" fill="black"/></mask></defs><rect width="${w}" height="${h}" fill="white" mask="url(#spotlight-mask)"/></svg>`;
    const mask = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

    return {
      maskImage: mask,
      WebkitMaskImage: mask,
      maskSize: '100% 100%',
      WebkitMaskSize: '100% 100%',
      maskRepeat: 'no-repeat',
      WebkitMaskRepeat: 'no-repeat',
    };
  };

  // Compute tooltip position relative to the spotlight target element
  // Always uses fixed positioning so it stays anchored to the viewport correctly
  const getTooltipStyle = (): React.CSSProperties => {
    // Safe tooltip width: on mobile use almost full width, desktop cap at 320px
    const tooltipWidth = isMobile
      ? Math.min(windowSize.width - 24, 340)
      : Math.min(320, windowSize.width - 32);
    const tooltipHeight = 220;
    const offset = 12;
    const padding = getPadding();
    const safeMargin = 8; // minimum gap from screen edge

    // If no target found, show centered
    if (!coords) {
      return {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: `${tooltipWidth}px`,
        maxWidth: `calc(100vw - ${safeMargin * 2}px)`,
      };
    }

    const { left, top, width, height } = coords;

    let pos = activeStep.position;
    let tLeft = 0;
    let tTop = 0;

    // On mobile, override any 'right'/'left' to place tooltip below or above 
    // so the sidebar element highlight is visible and tooltip doesn't overflow
    if (isMobile) {
      if (pos === 'right' || pos === 'left') {
        // Try below first
        const belowFits = top + height + offset + padding + tooltipHeight < windowSize.height - safeMargin;
        pos = belowFits ? 'bottom' : 'top';
      }
    } else {
      // Desktop: flip if it overflows horizontally
      if (pos === 'right' && left + width + offset + padding + tooltipWidth > windowSize.width - safeMargin) {
        pos = left - offset - padding - tooltipWidth > safeMargin ? 'left' : 'bottom';
      } else if (pos === 'left' && left - offset - padding - tooltipWidth < safeMargin) {
        pos = left + width + offset + padding + tooltipWidth < windowSize.width - safeMargin ? 'right' : 'bottom';
      }
    }

    // Calculate position based on pos
    switch (pos) {
      case 'bottom':
        tLeft = left + width / 2 - tooltipWidth / 2;
        tTop = top + height + offset + padding;
        break;
      case 'top':
        tLeft = left + width / 2 - tooltipWidth / 2;
        tTop = top - tooltipHeight - offset - padding;
        break;
      case 'left':
        tLeft = left - tooltipWidth - offset - padding;
        tTop = top + height / 2 - tooltipHeight / 2;
        break;
      case 'right':
        tLeft = left + width + offset + padding;
        tTop = top + height / 2 - tooltipHeight / 2;
        break;
      default:
        tLeft = left + width / 2 - tooltipWidth / 2;
        tTop = top + height + offset + padding;
    }

    // Clamp to keep tooltip fully inside the viewport
    tLeft = Math.max(safeMargin, Math.min(tLeft, windowSize.width - tooltipWidth - safeMargin));
    tTop = Math.max(safeMargin, Math.min(tTop, windowSize.height - tooltipHeight - safeMargin));

    return {
      position: 'fixed',
      left: `${tLeft}px`,
      top: `${tTop}px`,
      width: `${tooltipWidth}px`,
      maxWidth: `calc(100vw - ${safeMargin * 2}px)`,
    };
  };

  return (
    <div className="fixed inset-0 z-[99998] overflow-hidden pointer-events-none">
      {/* Background Blur & Dark Overlay with Spotlight Cutout */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99996] bg-black/65 backdrop-blur-[4px] pointer-events-auto"
        style={getMaskStyle()}
      />

      {/* Spotlight highlight outline */}
      {coords && (
        <div
          style={{
            position: 'fixed',
            left: `${Math.max(2, coords.left - getPadding())}px`,
            top: `${Math.max(2, coords.top - getPadding())}px`,
            width: `${Math.min(windowSize.width - Math.max(2, coords.left - getPadding()) - 2, coords.width + getPadding() * 2)}px`,
            height: `${Math.min(windowSize.height - Math.max(2, coords.top - getPadding()) - 2, coords.height + getPadding() * 2)}px`,
          }}
          className="border-2 border-primary rounded-xl shadow-[0_0_15px_rgba(234,88,12,0.4)] pointer-events-none z-[99997]"
        />
      )}

      {/* Floating Tooltip Panel */}
      <AnimatePresence mode="wait">
        <motion.div
          ref={tooltipRef}
          key={currentStep}
          style={getTooltipStyle()}
          initial={{ opacity: 0, scale: 0.95, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 6 }}
          transition={{ duration: 0.18 }}
          className="bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-5 rounded-2xl shadow-2xl pointer-events-auto z-[99999] flex flex-col gap-3 text-text-light dark:text-text-dark"
        >
          {/* Tooltip Header */}
          <div className="flex justify-between items-start gap-2">
            <h4 className="font-black text-sm text-primary uppercase tracking-wider leading-tight">
              {activeStep.title}
            </h4>
          </div>

          {/* Description */}
          <p className="text-xs text-muted leading-relaxed">
            {activeStep.description}
          </p>

          {/* Controls Footer */}
          <div className="flex justify-between items-center pt-2 border-t border-border-light/60 dark:border-border-dark/60">
            {/* Step Counter */}
            <span className="text-[10px] font-bold text-muted uppercase">
              Langkah {currentStep + 1} dari {steps.length}
            </span>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  onClick={prevStep}
                  className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-750 text-muted rounded-xl transition-all"
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
                {currentStep === steps.length - 1 ? (
                  'Selesai'
                ) : (
                  <>
                    Lanjut <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
