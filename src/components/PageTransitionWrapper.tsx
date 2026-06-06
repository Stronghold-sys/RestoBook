'use client';

/**
 * PageTransitionWrapper.tsx
 *
 * Client component that reads current pathname and passes it to PageTransition.
 * Needed because layout.tsx is a Server Component and cannot use usePathname.
 */

import { usePathname } from 'next/navigation';
import PageTransition from '@/components/PageTransition';
import React from 'react';

interface Props {
  children: React.ReactNode;
}

export default function PageTransitionWrapper({ children }: Props) {
  const pathname = usePathname();
  return <PageTransition pathname={pathname}>{children}</PageTransition>;
}
