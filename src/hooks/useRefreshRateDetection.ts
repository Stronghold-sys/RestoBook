'use client';

/**
 * useRefreshRateDetection.ts
 *
 * Detects device refresh rate using requestAnimationFrame timing.
 * Samples 90 frames to get a stable average, then classifies into:
 * 60Hz / 90Hz / 120Hz / 144Hz+ / fallback
 *
 * Runs once on mount. Results saved to useAnimationStore.
 */

import { useEffect } from 'react';
import { useAnimationStore } from '@/store/useAnimationStore';
import { getPerformanceModeByRefreshRate } from '@/lib/animationPresets';

const FRAME_SAMPLE_COUNT = 90;
const DETECTION_TIMEOUT_MS = 3000; // Safety timeout

function classifyRefreshRate(avgFrameMs: number): number {
  const hz = 1000 / avgFrameMs;
  // Map to nearest standard refresh rate with tolerance
  if (hz >= 130) return 144;
  if (hz >= 105) return 120;
  if (hz >= 80)  return 90;
  return 60;
}

export function useRefreshRateDetection() {
  const { isDetected, setDetectedRefreshRate, setPerformanceMode, setIsDetected, reducedMotion } = useAnimationStore();

  useEffect(() => {
    // Skip if already detected from a previous session (persisted in localStorage)
    if (isDetected) return;

    let rafId: number;
    const timeoutRef: { id: ReturnType<typeof setTimeout> | undefined } = { id: undefined };
    let frameCount = 0;
    let lastTimestamp = 0;
    const frameDurations: number[] = [];

    const measureFrame = (timestamp: number) => {
      if (lastTimestamp !== 0) {
        const delta = timestamp - lastTimestamp;
        // Filter out obviously wrong values (tab was hidden, etc.)
        if (delta > 0 && delta < 100) {
          frameDurations.push(delta);
          frameCount++;
        }
      }
      lastTimestamp = timestamp;

      if (frameCount < FRAME_SAMPLE_COUNT) {
        rafId = requestAnimationFrame(measureFrame);
      } else {
        // Calculate average, discard top/bottom 10% outliers
        const sorted = [...frameDurations].sort((a, b) => a - b);
        const trimCount = Math.floor(sorted.length * 0.1);
        const trimmed = sorted.slice(trimCount, sorted.length - trimCount);
        const avg = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;

        const detectedHz = classifyRefreshRate(avg);
        const mode = reducedMotion ? 'low' : getPerformanceModeByRefreshRate(detectedHz);

        setDetectedRefreshRate(detectedHz);
        setPerformanceMode(mode);
        setIsDetected(true);

        // Apply CSS custom properties for use in CSS transitions
        document.documentElement.style.setProperty('--anim-hz', String(detectedHz));

        clearTimeout(timeoutRef.id);
      }
    };

    // Safety: if detection takes too long (e.g., low-power device), fall back gracefully
    timeoutRef.id = setTimeout(() => {
      cancelAnimationFrame(rafId);
      if (!useAnimationStore.getState().isDetected) {
        const fallbackHz = 60;
        const mode = reducedMotion ? 'low' : getPerformanceModeByRefreshRate(fallbackHz);
        setDetectedRefreshRate(fallbackHz);
        setPerformanceMode(mode);
        setIsDetected(true);
        document.documentElement.style.setProperty('--anim-hz', '60');
      }
    }, DETECTION_TIMEOUT_MS);

    rafId = requestAnimationFrame(measureFrame);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutRef.id);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
