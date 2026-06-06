'use client';

/**
 * ScrollReveal.tsx
 *
 * Reusable scroll reveal wrapper using IntersectionObserver.
 * - Elements animate in when they enter the viewport
 * - Supports stagger for lists of children
 * - Respects reduced motion preference
 * - Does NOT use scroll listeners (uses IntersectionObserver for performance)
 * - Animates only once by default (one-shot: element stays visible after reveal)
 *
 * Usage:
 *   // Single element:
 *   <ScrollReveal>
 *     <Card />
 *   </ScrollReveal>
 *
 *   // Staggered list:
 *   <ScrollReveal stagger>
 *     {items.map(item => <Card key={item.id} {...item} />)}
 *   </ScrollReveal>
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useAdaptiveAnimation } from '@/hooks/useAdaptiveAnimation';

interface ScrollRevealProps {
  children: React.ReactNode;
  /** Enable stagger effect for multiple children */
  stagger?: boolean;
  /** Custom delay before animation starts (ms) */
  delay?: number;
  /** Animation type */
  animation?: 'fadeIn' | 'slideUp' | 'slideInLeft' | 'slideInRight' | 'scaleIn';
  /** IntersectionObserver threshold (0-1) */
  threshold?: number;
  /** Root margin for earlier/later triggering */
  rootMargin?: string;
  /** Re-animate on each viewport entry (default: false = animate once) */
  repeat?: boolean;
  className?: string;
}

interface StaggerItemProps {
  children: React.ReactNode;
  index: number;
  staggerDelay: number;
  animation: ScrollRevealProps['animation'];
  preset: ReturnType<typeof useAdaptiveAnimation>['preset'];
  isVisible: boolean;
}

function StaggerItem({ children, index, staggerDelay, animation, preset, isVisible }: StaggerItemProps) {
  const delay = index * staggerDelay * 1000;
  const style = getAnimationStyle(isVisible, animation, preset, delay);

  return (
    <div style={style}>
      {children}
    </div>
  );
}

function getAnimationStyle(
  isVisible: boolean,
  animation: ScrollRevealProps['animation'] = 'slideUp',
  preset: ReturnType<typeof useAdaptiveAnimation>['preset'],
  delayMs: number = 0
): React.CSSProperties {
  const baseTransition = `opacity ${preset.duration}s ${Array.isArray(preset.ease) ? `cubic-bezier(${preset.ease.join(',')})` : preset.ease} ${delayMs}ms, transform ${preset.duration}s ${Array.isArray(preset.ease) ? `cubic-bezier(${preset.ease.join(',')})` : preset.ease} ${delayMs}ms`;

  const hiddenStyles: Record<NonNullable<ScrollRevealProps['animation']>, React.CSSProperties> = {
    fadeIn: { opacity: 0 },
    slideUp: { opacity: 0, transform: `translateY(${preset.slideDistance}px)` },
    slideInLeft: { opacity: 0, transform: `translateX(-${preset.slideDistance}px)` },
    slideInRight: { opacity: 0, transform: `translateX(${preset.slideDistance}px)` },
    scaleIn: { opacity: 0, transform: preset.enableScale ? 'scale(0.96)' : 'none' },
  };

  const visibleStyle: React.CSSProperties = {
    opacity: 1,
    transform: 'none',
  };

  return {
    ...(isVisible ? visibleStyle : hiddenStyles[animation]),
    transition: baseTransition,
    willChange: isVisible ? 'auto' : 'opacity, transform',
  };
}

export default function ScrollReveal({
  children,
  stagger = false,
  delay = 0,
  animation = 'slideUp',
  threshold = 0.12,
  rootMargin = '0px 0px -40px 0px',
  repeat = false,
  className,
}: ScrollRevealProps) {
  const { preset, reducedMotion } = useAdaptiveAnimation();
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    const entry = entries[0];
    if (entry.isIntersecting) {
      setIsVisible(true);
      if (!repeat && observerRef.current) {
        observerRef.current.disconnect();
      }
    } else if (repeat) {
      setIsVisible(false);
    }
  }, [repeat]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || reducedMotion) {
      setIsVisible(true);
      return;
    }

    observerRef.current = new IntersectionObserver(handleIntersect, {
      threshold,
      rootMargin,
    });
    observerRef.current.observe(el);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [handleIntersect, threshold, rootMargin, reducedMotion]);

  // Reduced motion: just render children without any animation
  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  // Stagger mode: wrap each child individually with staggered delays
  if (stagger && preset.enableStagger) {
    const childrenArray = React.Children.toArray(children);
    return (
      <div ref={containerRef} className={className}>
        {childrenArray.map((child, index) => (
          <StaggerItem
            key={index}
            index={index}
            staggerDelay={preset.staggerDelay}
            animation={animation}
            preset={preset}
            isVisible={isVisible}
          >
            {child}
          </StaggerItem>
        ))}
      </div>
    );
  }

  // Single element mode
  const style = getAnimationStyle(isVisible, animation, preset, delay);

  return (
    <div ref={containerRef} style={style} className={className}>
      {children}
    </div>
  );
}
