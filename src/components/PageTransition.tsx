'use client';

/**
 * PageTransition.tsx
 *
 * Smooth page transition wrapper for Next.js App Router.
 * Uses Framer Motion's AnimatePresence with pathname as key
 * to trigger enter/exit animations on every route change.
 *
 * Usage: Wrap {children} in layout.tsx via PageTransitionWrapper
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdaptiveAnimation } from '@/hooks/useAdaptiveAnimation';

interface PageTransitionProps {
  children: React.ReactNode;
  pathname: string;
}

export default function PageTransition({ children, pathname }: PageTransitionProps) {
  const { preset, reducedMotion } = useAdaptiveAnimation();

  // Skip animation wrapper if reduced motion is requested
  if (reducedMotion) {
    return <>{children}</>;
  }

  const isSimple = preset.mode === 'low';
  const slideY = isSimple ? 0 : preset.slideDistance * 0.5;
  const exitY = isSimple ? 0 : -(preset.slideDistance * 0.25);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: slideY }}
        animate={{
          opacity: 1,
          y: 0,
          transition: {
            duration: preset.duration,
            ease: 'easeOut',
          },
        }}
        exit={{
          opacity: 0,
          y: exitY,
          transition: {
            duration: preset.durationFast,
            ease: 'easeIn',
          },
        }}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '100%',
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
