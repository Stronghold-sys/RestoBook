/**
 * useAnimationStore.ts
 *
 * Global Zustand store for animation system state.
 * Persists to localStorage so re-detection is avoided on every visit.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PerformanceMode } from '@/lib/animationPresets';

interface AnimationState {
  /** Detected device refresh rate in Hz. 0 = not yet detected. */
  detectedRefreshRate: number;
  /** Current performance preset mode */
  performanceMode: PerformanceMode;
  /** Whether OS/browser reduced motion preference is active */
  reducedMotion: boolean;
  /** Measured FPS from runtime monitoring */
  measuredFPS: number;
  /** Whether detection has completed */
  isDetected: boolean;
  /** Whether FPS pressure degraded the mode */
  isFPSDegraded: boolean;

  // Actions
  setDetectedRefreshRate: (hz: number) => void;
  setPerformanceMode: (mode: PerformanceMode) => void;
  setReducedMotion: (reduced: boolean) => void;
  setMeasuredFPS: (fps: number) => void;
  setIsDetected: (detected: boolean) => void;
  setIsFPSDegraded: (degraded: boolean) => void;
  /** Reset to force re-detection on next mount */
  resetDetection: () => void;
}

export const useAnimationStore = create<AnimationState>()(
  persist(
    (set) => ({
      detectedRefreshRate: 0,
      performanceMode: 'medium',
      reducedMotion: false,
      measuredFPS: 60,
      isDetected: false,
      isFPSDegraded: false,

      setDetectedRefreshRate: (hz) => set({ detectedRefreshRate: hz }),
      setPerformanceMode: (mode) => set({ performanceMode: mode }),
      setReducedMotion: (reduced) => set({
        reducedMotion: reduced,
        // Force low mode if reduced motion is requested
        performanceMode: reduced ? 'low' : undefined as any,
      }),
      setMeasuredFPS: (fps) => set({ measuredFPS: fps }),
      setIsDetected: (detected) => set({ isDetected: detected }),
      setIsFPSDegraded: (degraded) => set({ isFPSDegraded: degraded }),
      resetDetection: () => set({
        detectedRefreshRate: 0,
        isDetected: false,
        isFPSDegraded: false,
      }),
    }),
    {
      name: 'restobook-animation',
      // Only persist stable values, not transient FPS measurements
      partialize: (state) => ({
        detectedRefreshRate: state.detectedRefreshRate,
        performanceMode: state.performanceMode,
        reducedMotion: state.reducedMotion,
        isDetected: state.isDetected,
      }),
    }
  )
);
