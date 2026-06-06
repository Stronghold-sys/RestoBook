import type { Easing } from 'framer-motion';

/**
 * animationPresets.ts
 *
 * Defines animation presets for 4 performance modes:
 * low | medium | high | ultra
 *
 * All durations use CSS custom properties that update based on detected refresh rate.
 * Components read from useAdaptiveAnimation() hook to get the right preset.
 */

export type PerformanceMode = 'low' | 'medium' | 'high' | 'ultra';

export type EaseProp = Easing | Easing[];

export interface AnimationPreset {
  mode: PerformanceMode;
  /** Duration in seconds for standard transitions */
  duration: number;
  /** Duration in seconds for fast micro-interactions */
  durationFast: number;
  /** Duration in seconds for slow/entrance animations */
  durationSlow: number;
  /** Stagger delay between list items (seconds) */
  staggerDelay: number;
  /** Easing curve — Framer Motion compatible */
  ease: EaseProp;
  /** Spring easing (for Framer Motion) */
  spring: { type: 'spring'; stiffness: number; damping: number; mass: number };
  /** How far elements slide in from (px) */
  slideDistance: number;
  /** Parallax strength multiplier (0 = off) */
  parallaxStrength: number;
  /** Whether blur effects are enabled */
  enableBlur: boolean;
  /** Whether scale effects are enabled */
  enableScale: boolean;
  /** Whether stagger animations are enabled */
  enableStagger: boolean;
}

export const ANIMATION_PRESETS: Record<PerformanceMode, AnimationPreset> = {
  low: {
    mode: 'low',
    duration: 0.12,
    durationFast: 0.08,
    durationSlow: 0.18,
    staggerDelay: 0,
    ease: 'easeOut' as EaseProp,
    spring: { type: 'spring', stiffness: 400, damping: 40, mass: 0.6 },
    slideDistance: 8,
    parallaxStrength: 0,
    enableBlur: false,
    enableScale: false,
    enableStagger: false,
  },
  medium: {
    mode: 'medium',
    duration: 0.22,
    durationFast: 0.12,
    durationSlow: 0.35,
    staggerDelay: 0.04,
    ease: [0.25, 0.46, 0.45, 0.94] as unknown as EaseProp,
    spring: { type: 'spring', stiffness: 280, damping: 28, mass: 0.8 },
    slideDistance: 16,
    parallaxStrength: 0,
    enableBlur: false,
    enableScale: true,
    enableStagger: true,
  },
  high: {
    mode: 'high',
    duration: 0.32,
    durationFast: 0.16,
    durationSlow: 0.48,
    staggerDelay: 0.06,
    ease: [0.16, 1, 0.3, 1] as unknown as EaseProp,
    spring: { type: 'spring', stiffness: 220, damping: 22, mass: 1 },
    slideDistance: 24,
    parallaxStrength: 0.08,
    enableBlur: true,
    enableScale: true,
    enableStagger: true,
  },
  ultra: {
    mode: 'ultra',
    duration: 0.42,
    durationFast: 0.2,
    durationSlow: 0.65,
    staggerDelay: 0.08,
    ease: [0.08, 0.82, 0.17, 1] as unknown as EaseProp,
    spring: { type: 'spring', stiffness: 180, damping: 18, mass: 1.2 },
    slideDistance: 32,
    parallaxStrength: 0.12,
    enableBlur: true,
    enableScale: true,
    enableStagger: true,
  },
};

// ---------------------------------------------------------------------------
// Framer Motion Variant Factories
// Each factory accepts a preset and returns ready-to-use Framer Motion variants
// ---------------------------------------------------------------------------

export function makePageTransitionVariants(preset: AnimationPreset) {
  if (preset.mode === 'low') {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: preset.duration, ease: preset.ease } },
      exit:    { opacity: 0, transition: { duration: preset.durationFast, ease: 'easeIn' } },
    };
  }
  return {
    initial: { opacity: 0, y: preset.slideDistance * 0.5 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: preset.duration, ease: preset.ease },
    },
    exit: {
      opacity: 0,
      y: -(preset.slideDistance * 0.25),
      transition: { duration: preset.durationFast, ease: 'easeIn' },
    },
  };
}

export function makeFadeInVariants(preset: AnimationPreset) {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: preset.duration, ease: preset.ease } },
  };
}

export function makeSlideUpVariants(preset: AnimationPreset) {
  return {
    hidden: { opacity: 0, y: preset.slideDistance },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: preset.duration, ease: preset.ease },
    },
  };
}

export function makeSlideInVariants(preset: AnimationPreset, direction: 'left' | 'right' = 'left') {
  const x = direction === 'left' ? -preset.slideDistance : preset.slideDistance;
  return {
    hidden: { opacity: 0, x },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: preset.duration, ease: preset.ease },
    },
  };
}

export function makeScaleInVariants(preset: AnimationPreset) {
  if (!preset.enableScale) return makeFadeInVariants(preset);
  return {
    hidden: { opacity: 0, scale: 0.96 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: preset.spring,
    },
  };
}

export function makeModalVariants(preset: AnimationPreset) {
  if (preset.mode === 'low') {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: preset.duration } },
      exit:    { opacity: 0, transition: { duration: preset.durationFast } },
    };
  }
  return {
    hidden: { opacity: 0, scale: 0.95, y: 8 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { ...preset.spring },
    },
    exit: {
      opacity: 0,
      scale: 0.97,
      y: 4,
      transition: { duration: preset.durationFast, ease: 'easeIn' },
    },
  };
}

export function makeDrawerVariants(preset: AnimationPreset, side: 'left' | 'right' | 'bottom' = 'left') {
  const axis = side === 'bottom' ? 'y' : 'x';
  const start = side === 'left' ? -320 : side === 'right' ? 320 : '100%';
  return {
    hidden: { opacity: 0.6, [axis]: start },
    visible: {
      opacity: 1,
      [axis]: 0,
      transition: { duration: preset.duration, ease: preset.ease },
    },
    exit: {
      opacity: 0.4,
      [axis]: start,
      transition: { duration: preset.durationFast, ease: 'easeIn' },
    },
  };
}

export function makeDropdownVariants(preset: AnimationPreset) {
  if (!preset.enableScale) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: preset.durationFast } },
      exit:    { opacity: 0, transition: { duration: preset.durationFast } },
    };
  }
  return {
    hidden: { opacity: 0, scale: 0.97, y: -4 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: { duration: preset.durationFast, ease: preset.ease },
    },
    exit: {
      opacity: 0,
      scale: 0.97,
      y: -4,
      transition: { duration: preset.durationFast, ease: 'easeIn' },
    },
  };
}

export function makeStaggerContainerVariants(preset: AnimationPreset) {
  if (!preset.enableStagger) {
    return {
      hidden: {},
      visible: { transition: { staggerChildren: 0 } },
    };
  }
  return {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: preset.staggerDelay,
        delayChildren: 0.05,
      },
    },
  };
}

export function makeStaggerItemVariants(preset: AnimationPreset) {
  return makeSlideUpVariants(preset);
}

// ---------------------------------------------------------------------------
// Refresh rate → performance mode mapping
// ---------------------------------------------------------------------------
export function getPerformanceModeByRefreshRate(hz: number): PerformanceMode {
  if (hz >= 120) return 'ultra';
  if (hz >= 90)  return 'high';
  if (hz >= 60)  return 'medium';
  return 'low';
}
