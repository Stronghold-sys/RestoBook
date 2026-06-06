/**
 * Animation System — Public API
 *
 * Re-exports all animation hooks and utilities for convenient imports.
 *
 * Usage:
 *   import { useAdaptiveAnimation, ScrollReveal, useParallax } from '@/animation';
 */

// Primary hook (most commonly used)
export { useAdaptiveAnimation } from '@/hooks/useAdaptiveAnimation';

// Detection hooks (used internally by AnimationProvider — rarely needed directly)
export { useRefreshRateDetection } from '@/hooks/useRefreshRateDetection';
export { useMotionPreferences } from '@/hooks/useMotionPreferences';
export { useFPSMonitor } from '@/hooks/useFPSMonitor';

// Specialized hooks
export { useParallax } from '@/hooks/useParallax';

// Store (for reading raw state)
export { useAnimationStore } from '@/store/useAnimationStore';

// Presets and utilities
export {
  ANIMATION_PRESETS,
  getPerformanceModeByRefreshRate,
  makePageTransitionVariants,
  makeFadeInVariants,
  makeSlideUpVariants,
  makeSlideInVariants,
  makeScaleInVariants,
  makeModalVariants,
  makeDrawerVariants,
  makeDropdownVariants,
  makeStaggerContainerVariants,
  makeStaggerItemVariants,
} from '@/lib/animationPresets';

export type { PerformanceMode, AnimationPreset } from '@/lib/animationPresets';

// Utility functions
export {
  detectRefreshRate,
  clampDuration,
  easingToCss,
  makeCSSTransition,
} from '@/utils/animationUtils';
