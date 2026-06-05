"use client";

import { useEffect, useState, useRef } from 'react';
import { useTutorialStore } from '@/store/useTutorialStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function SpotlightTutorial() {
  const { isTutorialActive, currentStep, steps, nextStep, prevStep } = useTutorialStore();
  const [coords, setCoords] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Track window resizing and scrolling
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

  // Update spotlight coordinates when step, window size, or scroll changes
  useEffect(() => {
    if (!isTutorialActive || steps.length === 0) {
      setCoords(null);
      return;
    }

    const updateCoords = () => {
      const step = steps[currentStep];
      const element = document.querySelector(step.targetSelector);

      if (element) {
        const rect = element.getBoundingClientRect();
        // Check if element is visible (has width and height)
        if (rect.width > 0 && rect.height > 0) {
          setCoords({
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
          });
        } else {
          setCoords(null);
        }
      } else {
        setCoords(null);
      }
    };

    updateCoords();

    // Auto scroll to center of element
    const step = steps[currentStep];
    const element = document.querySelector(step.targetSelector);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Set up interval for smooth tracking during animations/transitions
    const intervalId = setInterval(updateCoords, 100);

    return () => clearInterval(intervalId);
  }, [isTutorialActive, currentStep, steps, windowSize]);

  if (!isTutorialActive || steps.length === 0) return null;

  const activeStep = steps[currentStep];

  // Dynamic padding based on selector (larger padding for notifications to keep the red badge fully visible)
  const getPadding = () => {
    if (activeStep?.targetSelector === '[data-tour="header-notifications"]') {
      return 18;
    }
    return 8;
  };

  // Generate inline SVG mask for backdrop cutout
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
    
    // Clamp to prevent negative coordinates and clipping at edges
    const x = Math.max(2, left - padding);
    const y = Math.max(2, top - padding);
    const rW = Math.min(windowSize.width - x - 2, width + padding * 2);
    const rH = Math.min(windowSize.height - y - 2, height + padding * 2);
    const radius = 12; // matching highlight border rounded-xl

    // Inline SVG: White is visible (blurred/dark), Black is cutout (transparent/clear)
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

  // Compute position of tooltip (relative to target coords with viewport boundary checks)
  const getTooltipStyle = () => {
    if (!coords) {
      return {
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed' as const
      };
    }

    const { left, top, width, height } = coords;
    const tooltipWidth = Math.min(320, windowSize.width - 32);
    const tooltipHeight = 220; // estimated popup height
    const offset = 16;
    const padding = getPadding();

    let tLeft = left + width / 2 - tooltipWidth / 2;
    let tTop = top + height + offset + padding; // default bottom placement

    let pos = activeStep.position;

    // Flip position if it overflows the screen horizontally
    if (pos === 'right' && left + width + offset + padding + tooltipWidth > windowSize.width - 16) {
      pos = left - offset - padding - tooltipWidth > 16 ? 'left' : 'bottom';
    } else if (pos === 'left' && left - offset - padding - tooltipWidth < 16) {
      pos = left + width + offset + padding + tooltipWidth < windowSize.width - 16 ? 'right' : 'bottom';
    }

    // Set coordinates based on position
    if (pos === 'bottom') {
      tLeft = left + width / 2 - tooltipWidth / 2;
      tTop = top + height + offset + padding;
    } else if (pos === 'top') {
      tLeft = left + width / 2 - tooltipWidth / 2;
      tTop = top - tooltipHeight - offset - padding;
    } else if (pos === 'left') {
      tLeft = left - tooltipWidth - offset - padding;
      tTop = top + height / 2 - tooltipHeight / 2;
    } else if (pos === 'right') {
      tLeft = left + width + offset + padding;
      tTop = top + height / 2 - tooltipHeight / 2;
    }

    // Clamp coordinates to keep inside the viewport (16px safe margin)
    tLeft = Math.max(16, Math.min(tLeft, windowSize.width - tooltipWidth - 16));
    tTop = Math.max(16, Math.min(tTop, windowSize.height - tooltipHeight - 16));

    return {
      left: `${tLeft}px`,
      top: `${tTop}px`,
      position: 'absolute' as const
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
            left: `${Math.max(2, coords.left - getPadding())}px`,
            top: `${Math.max(2, coords.top - getPadding())}px`,
            width: `${Math.min(windowSize.width - Math.max(2, coords.left - getPadding()) - 2, coords.width + getPadding() * 2)}px`,
            height: `${Math.min(windowSize.height - Math.max(2, coords.top - getPadding()) - 2, coords.height + getPadding() * 2)}px`
          }}
          className="absolute border-2 border-primary rounded-xl shadow-[0_0_15px_rgba(234,88,12,0.4)] pointer-events-none z-[99997]"
        />
      )}

      {/* Floating Tooltip Panel (Positioned contextually next to the spotlight) */}
      <AnimatePresence mode="wait">
        <motion.div
          ref={tooltipRef}
          key={currentStep}
          style={getTooltipStyle()}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="absolute bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-6 rounded-2xl shadow-2xl w-[calc(100vw-32px)] sm:w-80 max-w-sm pointer-events-auto z-[99999] flex flex-col gap-4 text-text-light dark:text-text-dark"
        >
          {/* Tooltip Header */}
          <div className="flex justify-between items-start gap-2">
            <h4 className="font-black text-sm text-primary uppercase tracking-wider">
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
