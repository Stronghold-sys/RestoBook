'use client';

/**
 * useMotionPreferences.ts
 *
 * Detects and subscribes to OS/browser reduced motion preferences.
 * Updates the animation store reactively when user changes the preference.
 */

import { useEffect } from 'react';
import { useAnimationStore } from '@/store/useAnimationStore';
import { getPerformanceModeByRefreshRate } from '@/lib/animationPresets';

export function useMotionPreferences() {
  const { setReducedMotion, setPerformanceMode, detectedRefreshRate } = useAnimationStore();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const isReduced = e.matches;
      setReducedMotion(isReduced);
      if (isReduced) {
        setPerformanceMode('low');
      } else {
        // Restore based on detected refresh rate
        const hz = detectedRefreshRate || 60;
        setPerformanceMode(getPerformanceModeByRefreshRate(hz));
      }
    };

    // Check initial state
    handleChange(mq);

    // Listen for changes
    if (mq.addEventListener) {
      mq.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mq.addListener(handleChange as any);
    }

    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', handleChange);
      } else {
        mq.removeListener(handleChange as any);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectedRefreshRate]);
}
