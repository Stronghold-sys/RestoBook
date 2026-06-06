'use client';

/**
 * useFPSMonitor.ts
 *
 * Lightweight FPS monitoring using requestAnimationFrame.
 * Automatically degrades performance mode if FPS drops below threshold.
 * Recovers when FPS improves. Pauses when tab is hidden.
 */

import { useEffect, useRef } from 'react';
import { useAnimationStore } from '@/store/useAnimationStore';
import type { PerformanceMode } from '@/lib/animationPresets';

const FPS_SAMPLE_WINDOW = 30;  // frames to average
const DEGRADED_FPS_THRESHOLD = 30;
const RECOVERY_FPS_THRESHOLD = 50;
const RECOVERY_REQUIRED_SAMPLES = 60; // ~2s at 30fps

function degradeMode(mode: PerformanceMode): PerformanceMode {
  if (mode === 'ultra') return 'high';
  if (mode === 'high')  return 'medium';
  if (mode === 'medium') return 'low';
  return 'low';
}

export function useFPSMonitor() {
  const {
    reducedMotion,
    setMeasuredFPS,
    setPerformanceMode,
    setIsFPSDegraded,
    detectedRefreshRate,
  } = useAnimationStore();

  const rafIdRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const fpsBufferRef = useRef<number[]>([]);
  const recoveryCountRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(false);

  useEffect(() => {
    // Don't monitor if reduced motion — already at lowest quality
    if (reducedMotion) return;

    const measureFPS = (timestamp: number) => {
      if (!isRunningRef.current) return;

      if (lastTimeRef.current !== 0) {
        const delta = timestamp - lastTimeRef.current;
        if (delta > 0 && delta < 200) {
          const fps = 1000 / delta;
          fpsBufferRef.current.push(fps);

          if (fpsBufferRef.current.length > FPS_SAMPLE_WINDOW) {
            fpsBufferRef.current.shift();
          }

          if (fpsBufferRef.current.length === FPS_SAMPLE_WINDOW) {
            const avgFPS = fpsBufferRef.current.reduce((a, b) => a + b, 0) / FPS_SAMPLE_WINDOW;
            setMeasuredFPS(Math.round(avgFPS));

            const currentMode = useAnimationStore.getState().performanceMode;
            const currentDegraded = useAnimationStore.getState().isFPSDegraded;

            if (avgFPS < DEGRADED_FPS_THRESHOLD && currentMode !== 'low') {
              // FPS is struggling → degrade
              setPerformanceMode(degradeMode(currentMode));
              setIsFPSDegraded(true);
              recoveryCountRef.current = 0;
              fpsBufferRef.current = [];
            } else if (avgFPS >= RECOVERY_FPS_THRESHOLD && currentDegraded) {
              // FPS recovered
              recoveryCountRef.current++;
              if (recoveryCountRef.current >= RECOVERY_REQUIRED_SAMPLES) {
                // Restore to original mode based on refresh rate
                const hz = detectedRefreshRate || 60;
                const restoredMode: PerformanceMode =
                  hz >= 120 ? 'ultra' : hz >= 90 ? 'high' : 'medium';
                setPerformanceMode(restoredMode);
                setIsFPSDegraded(false);
                recoveryCountRef.current = 0;
              }
            } else {
              recoveryCountRef.current = 0;
            }
          }
        }
      }

      lastTimeRef.current = timestamp;
      rafIdRef.current = requestAnimationFrame(measureFPS);
    };

    const startMonitoring = () => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;
      lastTimeRef.current = 0;
      rafIdRef.current = requestAnimationFrame(measureFPS);
    };

    const stopMonitoring = () => {
      isRunningRef.current = false;
      cancelAnimationFrame(rafIdRef.current);
      lastTimeRef.current = 0;
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopMonitoring();
      } else {
        fpsBufferRef.current = [];
        startMonitoring();
      }
    };

    if (!document.hidden) {
      startMonitoring();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopMonitoring();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, detectedRefreshRate]);
}
