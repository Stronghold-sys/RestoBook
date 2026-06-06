'use client';

/**
 * useAdaptiveAnimation.ts
 *
 * The primary hook for consuming animation presets.
 * Combines refresh rate detection + reduced motion + FPS monitoring
 * into a single, ready-to-use API for all components.
 *
 * Usage:
 *   const { preset, isAnimationEnabled, variants, spring } = useAdaptiveAnimation();
 */

import { useMemo } from 'react';
import { useAnimationStore } from '@/store/useAnimationStore';
import {
  ANIMATION_PRESETS,
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

export function useAdaptiveAnimation() {
  const performanceMode = useAnimationStore((s) => s.performanceMode);
  const reducedMotion = useAnimationStore((s) => s.reducedMotion);
  const detectedRefreshRate = useAnimationStore((s) => s.detectedRefreshRate);
  const isDetected = useAnimationStore((s) => s.isDetected);

  const preset = useMemo(() => ANIMATION_PRESETS[performanceMode], [performanceMode]);
  const isAnimationEnabled = !reducedMotion && performanceMode !== 'low' || false;

  const variants = useMemo(() => ({
    pageTransition: makePageTransitionVariants(preset),
    fadeIn: makeFadeInVariants(preset),
    slideUp: makeSlideUpVariants(preset),
    slideInLeft: makeSlideInVariants(preset, 'left'),
    slideInRight: makeSlideInVariants(preset, 'right'),
    scaleIn: makeScaleInVariants(preset),
    modal: makeModalVariants(preset),
    drawerLeft: makeDrawerVariants(preset, 'left'),
    drawerRight: makeDrawerVariants(preset, 'right'),
    drawerBottom: makeDrawerVariants(preset, 'bottom'),
    dropdown: makeDropdownVariants(preset),
    staggerContainer: makeStaggerContainerVariants(preset),
    staggerItem: makeStaggerItemVariants(preset),
  }), [preset]);

  return {
    /** Current preset object with all timing values */
    preset,
    /** Shorthand: whether visual animations should play */
    isAnimationEnabled,
    /** Whether reduced motion is requested by the user */
    reducedMotion,
    /** Current performance mode string */
    mode: performanceMode,
    /** Detected Hz (0 if not yet detected) */
    refreshRate: detectedRefreshRate,
    /** Whether initial detection has completed */
    isDetected,
    /** All Framer Motion variants, pre-configured for current preset */
    variants,
    /** Current spring config for direct use in motion.* props */
    spring: preset.spring,
    /** Shorthand timing values */
    duration: preset.duration,
    durationFast: preset.durationFast,
    durationSlow: preset.durationSlow,
    ease: preset.ease,
    staggerDelay: preset.staggerDelay,
  };
}
