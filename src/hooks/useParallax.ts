'use client';

/**
 * useParallax.ts
 *
 * Lightweight parallax scroll effect using rAF + IntersectionObserver.
 * Only runs when the element is in/near viewport.
 * Auto-disables for low performance mode and reduced motion.
 *
 * Usage:
 *   const { ref, style } = useParallax({ strength: 0.1 });
 *   <div ref={ref} style={style}>...</div>
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { useAnimationStore } from '@/store/useAnimationStore';
import { ANIMATION_PRESETS } from '@/lib/animationPresets';

interface UseParallaxOptions {
  /** Strength multiplier (0-1). 0.1 = subtle, 0.3 = strong */
  strength?: number;
  /** Direction: 'y' (vertical) or 'x' (horizontal) */
  direction?: 'x' | 'y';
}

interface ParallaxResult {
  ref: React.RefObject<HTMLDivElement>;
  style: React.CSSProperties;
}

export function useParallax(options: UseParallaxOptions = {}): ParallaxResult {
  const { strength: customStrength, direction = 'y' } = options;
  const performanceMode = useAnimationStore((s) => s.performanceMode);
  const reducedMotion = useAnimationStore((s) => s.reducedMotion);

  const preset = ANIMATION_PRESETS[performanceMode];
  const strength = customStrength ?? preset.parallaxStrength;

  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const rafIdRef = useRef<number>(0);
  const isVisibleRef = useRef(false);
  const lastScrollRef = useRef(0);

  // Disable for low performance and reduced motion
  const isEnabled = !reducedMotion && strength > 0 && performanceMode !== 'low';

  const updateParallax = useCallback(() => {
    if (!isVisibleRef.current || !ref.current) return;

    const scrollY = window.scrollY;
    if (Math.abs(scrollY - lastScrollRef.current) < 0.5) return; // Skip tiny changes
    lastScrollRef.current = scrollY;

    const rect = ref.current.getBoundingClientRect();
    const viewportMid = window.innerHeight / 2;
    const elementMid = rect.top + rect.height / 2;
    const relativeOffset = elementMid - viewportMid;

    setOffset(relativeOffset * strength);
  }, [strength]);

  useEffect(() => {
    if (!isEnabled) {
      setOffset(0);
      return;
    }

    const el = ref.current;
    if (!el) return;

    // Use IntersectionObserver to avoid wasted work when off-screen
    const observer = new IntersectionObserver(
      (entries) => {
        isVisibleRef.current = entries[0].isIntersecting;
      },
      { rootMargin: '100px' } // Start a bit early
    );
    observer.observe(el);

    // Throttled scroll handler via rAF
    const handleScroll = () => {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(updateParallax);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    updateParallax(); // Initial call

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [isEnabled, updateParallax]);

  const style: React.CSSProperties = isEnabled
    ? {
        transform: direction === 'y'
          ? `translateY(${offset}px)`
          : `translateX(${offset}px)`,
        willChange: 'transform',
        transition: 'transform 0.05s linear', // Tiny lag for smoother feel
      }
    : {};

  return { ref, style };
}
