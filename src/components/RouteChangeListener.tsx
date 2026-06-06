'use client';

/**
 * RouteChangeListener.tsx
 *
 * Listens to Next.js App Router navigation events and applies
 * CSS-based page transition animation WITHOUT causing React component
 * unmount/remount. This prevents Supabase Realtime subscription errors.
 *
 * Strategy:
 * - Uses CSS opacity + translateY animation triggered by class toggle
 * - No AnimatePresence or motion.div wrapping the entire tree
 * - Applies animation directly to <html> data-attribute so CSS handles it
 * - Zero React tree disruption = no subscription/side-effect conflicts
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAnimationStore } from '@/store/useAnimationStore';

export default function RouteChangeListener() {
  const pathname = usePathname();
  const prevPathname = useRef<string>(pathname);
  const animFrameRef = useRef<number>(0);
  const reducedMotion = useAnimationStore((s) => s.reducedMotion);
  const performanceMode = useAnimationStore((s) => s.performanceMode);

  useEffect(() => {
    // Skip animation for same path or reduced motion
    if (pathname === prevPathname.current || reducedMotion || performanceMode === 'low') {
      prevPathname.current = pathname;
      return;
    }

    prevPathname.current = pathname;

    // Cancel any pending animation frame
    cancelAnimationFrame(animFrameRef.current);

    const html = document.documentElement;

    // Trigger enter animation: add class that CSS listens to
    html.setAttribute('data-page-entering', 'true');

    animFrameRef.current = requestAnimationFrame(() => {
      animFrameRef.current = requestAnimationFrame(() => {
        // Remove class after first paint to trigger transition
        html.removeAttribute('data-page-entering');
      });
    });

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [pathname, reducedMotion, performanceMode]);

  return null;
}
