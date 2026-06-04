"use client";

import { useEffect, useState, useRef } from 'react';
import { useTutorialStore } from '@/store/useTutorialStore';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function SpotlightTutorial() {
  const { isTutorialActive, currentStep, steps, nextStep, prevStep, stopTutorial, skipTutorial } = useTutorialStore();
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

  // Update spotlight coordinates when step or window size changes
  useEffect(() => {
    if (!isTutorialActive || steps.length === 0) {
      setCoords(null);
      return;
    }

    const step = steps[currentStep];
    const element = document.querySelector(step.targetSelector);

    if (element) {
      // Auto scroll to center of element
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Small delay to let scroll animation finish, then measure
      const timer = setTimeout(() => {
        const rect = element.getBoundingClientRect();
        setCoords({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        });
      }, 300);

      return () => clearTimeout(timer);
    } else {
      // If element not found, skip to next step or center spotlight
      setCoords(null);
    }
  }, [isTutorialActive, currentStep, steps, windowSize]);

  // Handle window scroll updates to coords
  useEffect(() => {
    if (!isTutorialActive || steps.length === 0) return;

    const handleScroll = () => {
      const step = steps[currentStep];
      const element = document.querySelector(step.targetSelector);
      if (element) {
        const rect = element.getBoundingClientRect();
        setCoords({
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isTutorialActive, currentStep, steps]);

  if (!isTutorialActive || steps.length === 0) return null;

  const activeStep = steps[currentStep];

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
    const padding = 8;
    const x = left - padding;
    const y = top - padding;
    const rW = width + padding * 2;
    const rH = height + padding * 2;
    const radius = 12; // matching highlight border rounded-xl

    // Inline SVG: White is visible (blurred/dark), Black is cutout (transparent/clear)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="white"/><rect x="${x}" y="${y}" width="${rW}" height="${rH}" rx="${radius}" ry="${radius}" fill="black"/></svg>`;
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

  // Compute position of tooltip (Always center of the screen)
  const getTooltipStyle = () => {
    return {
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      position: 'fixed' as const
    };
  };

  const handleSkip = () => {
    skipTutorial();
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
        <motion.div
          initial={false}
          animate={{
            left: coords.left - 8,
            top: coords.top - 8,
            width: coords.width + 16,
            height: coords.height + 16
          }}
          transition={{ type: 'spring', damping: 26, stiffness: 220 }}
          className="absolute border-2 border-primary rounded-xl shadow-[0_0_15px_rgba(234,88,12,0.4)] pointer-events-none z-[99997]"
        />
      )}

      {/* Floating Tooltip Panel (Always centered) */}
      <AnimatePresence mode="wait">
        <motion.div
          ref={tooltipRef}
          key={currentStep}
          style={getTooltipStyle()}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-6 rounded-2xl shadow-2xl w-80 max-w-sm pointer-events-auto z-[99999] flex flex-col gap-4 text-text-light dark:text-text-dark"
        >
          {/* Tooltip Header */}
          <div className="flex justify-between items-start gap-2">
            <h4 className="font-black text-sm text-primary uppercase tracking-wider">
              {activeStep.title}
            </h4>
            <button
              onClick={handleSkip}
              className="p-1 hover:bg-gray-150 dark:hover:bg-gray-800 rounded-lg text-muted transition-colors"
              title="Lewati Tutorial"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
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
