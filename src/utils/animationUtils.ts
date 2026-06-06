/**
 * animationUtils.ts
 *
 * Standalone utility functions for the animation system.
 * These can be used outside of React hooks where needed.
 */

import type { PerformanceMode } from '@/lib/animationPresets';
import { getPerformanceModeByRefreshRate } from '@/lib/animationPresets';

// ---------------------------------------------------------------------------
// Runtime refresh rate detection (non-hook version)
// Useful for SSR fallback or initialization outside React.
// ---------------------------------------------------------------------------
export function detectRefreshRate(sampleFrames = 60): Promise<number> {
  return new Promise((resolve) => {
    let count = 0;
    let last = 0;
    const durations: number[] = [];

    const timeout = setTimeout(() => {
      resolve(60); // fallback
    }, 3000);

    const loop = (ts: number) => {
      if (last !== 0) {
        const delta = ts - last;
        if (delta > 0 && delta < 100) {
          durations.push(delta);
          count++;
        }
      }
      last = ts;

      if (count < sampleFrames) {
        requestAnimationFrame(loop);
      } else {
        clearTimeout(timeout);
        const sorted = [...durations].sort((a, b) => a - b);
        const trim = Math.floor(sorted.length * 0.1);
        const trimmed = sorted.slice(trim, sorted.length - trim);
        const avg = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
        const hz = Math.round(1000 / avg);
        resolve(classifyHz(hz));
      }
    };

    requestAnimationFrame(loop);
  });
}

function classifyHz(hz: number): number {
  if (hz >= 130) return 144;
  if (hz >= 105) return 120;
  if (hz >= 80)  return 90;
  return 60;
}

// ---------------------------------------------------------------------------
// Clamp animation duration based on performance mode
// ---------------------------------------------------------------------------
export function clampDuration(ms: number, mode: PerformanceMode): number {
  const maxByMode: Record<PerformanceMode, number> = {
    low: 150,
    medium: 300,
    high: 500,
    ultra: 700,
  };
  return Math.min(ms, maxByMode[mode]);
}

// ---------------------------------------------------------------------------
// Get CSS easing string from preset ease value
// ---------------------------------------------------------------------------
export function easingToCss(ease: string | number[]): string {
  if (typeof ease === 'string') return ease;
  return `cubic-bezier(${ease.join(', ')})`;
}

// ---------------------------------------------------------------------------
// Generate CSS transition string
// ---------------------------------------------------------------------------
export function makeCSSTransition(
  properties: string[],
  durationMs: number,
  ease: string | number[],
  delayMs: number = 0
): string {
  const easing = easingToCss(ease);
  return properties
    .map((prop) => `${prop} ${durationMs}ms ${easing} ${delayMs}ms`)
    .join(', ');
}

// ---------------------------------------------------------------------------
// Re-export for convenience
// ---------------------------------------------------------------------------
export { getPerformanceModeByRefreshRate };
