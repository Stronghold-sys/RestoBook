"use client";

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TooltipProps {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  children?: React.ReactNode;
  className?: string;
}

export default function Tooltip({
  content,
  position = 'top',
  children,
  className = ''
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-card-light dark:border-t-card-dark border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-card-light dark:border-b-card-dark border-l-transparent border-r-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-card-light dark:border-l-card-dark border-t-transparent border-b-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-card-light dark:border-r-card-dark border-t-transparent border-b-transparent border-l-transparent'
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children ? (
        children
      ) : (
        <button
          type="button"
          aria-label={`Bantuan: ${content}`}
          className="text-muted hover:text-primary transition-colors focus:outline-none p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <HelpCircle className="w-4.5 h-4.5" />
        </button>
      )}

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-[99999] w-48 p-2.5 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-[11px] font-bold text-text-light dark:text-text-dark rounded-xl shadow-xl leading-relaxed pointer-events-none ${positionClasses[position]}`}
            role="tooltip"
          >
            {content}
            <span
              className={`absolute border-4 ${arrowClasses[position]}`}
              aria-hidden="true"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
