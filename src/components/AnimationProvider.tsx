'use client';

/**
 * AnimationProvider.tsx
 *
 * Global provider that:
 * 1. Runs refresh rate detection on mount (useRefreshRateDetection)
 * 2. Subscribes to reduced motion preference (useMotionPreferences)
 * 3. Starts FPS monitoring (useFPSMonitor)
 * 4. Applies performance mode class to <html> element for CSS utility classes
 * 5. Updates CSS custom properties based on detected refresh rate
 *
 * Renders nothing — purely a logic provider.
 */

import { useEffect } from 'react';
import { useRefreshRateDetection } from '@/hooks/useRefreshRateDetection';
import { useMotionPreferences } from '@/hooks/useMotionPreferences';
import { useFPSMonitor } from '@/hooks/useFPSMonitor';
import { useAnimationStore } from '@/store/useAnimationStore';
import { ANIMATION_PRESETS } from '@/lib/animationPresets';

const ALL_MODE_CLASSES = ['anim-mode-low', 'anim-mode-medium', 'anim-mode-high', 'anim-mode-ultra'];

function AnimationCSSSync() {
  const performanceMode = useAnimationStore((s) => s.performanceMode);
  const reducedMotion = useAnimationStore((s) => s.reducedMotion);

  useEffect(() => {
    const html = document.documentElement;
    const preset = ANIMATION_PRESETS[performanceMode];

    // Update class on <html> for CSS utility class overrides
    ALL_MODE_CLASSES.forEach((cls) => html.classList.remove(cls));
    html.classList.add(`anim-mode-${performanceMode}`);

    // Update CSS custom properties so all CSS animations adapt
    html.style.setProperty('--anim-fast',   `${preset.durationFast}s`);
    html.style.setProperty('--anim-normal', `${preset.duration}s`);
    html.style.setProperty('--anim-slow',   `${preset.durationSlow}s`);
    html.style.setProperty('--anim-stagger', `${preset.staggerDelay}s`);
    html.style.setProperty('--anim-slide-sm', `${preset.slideDistance * 0.5}px`);
    html.style.setProperty('--anim-slide-md', `${preset.slideDistance}px`);
    html.style.setProperty('--anim-slide-lg', `${preset.slideDistance * 1.5}px`);

    if (Array.isArray(preset.ease)) {
      html.style.setProperty('--anim-spring', `cubic-bezier(${preset.ease.join(',')})`);
    }

    // Disable smooth scroll in low/reduced mode to prevent jank
    if (reducedMotion || performanceMode === 'low') {
      html.classList.add('page-transitioning');
    } else {
      html.classList.remove('page-transitioning');
    }
  }, [performanceMode, reducedMotion]);

  return null;
}

export default function AnimationProvider() {
  useRefreshRateDetection();
  useMotionPreferences();
  useFPSMonitor();

  return <AnimationCSSSync />;
}
