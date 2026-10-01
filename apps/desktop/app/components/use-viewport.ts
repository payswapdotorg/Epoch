'use client';

import { useEffect, useState } from 'react';

/**
 * The window-resize viewport hook (client-only; the static export
 * pre-renders with the desktop layout and adjusts after hydration).
 *
 * The desktop product is a window UI: below the compact breakpoint the
 * left navigation rail collapses into a wrapping strip and the session
 * bar wraps — pure inline-style responsiveness driven by measured width
 * (no CSS media queries; the repo has no stylesheet surface).
 */
export interface Viewport {
  readonly width: number | null;
  readonly compact: boolean;
}

/** The compact breakpoint (px) — narrow desktop windows / small webviews. */
const COMPACT_BREAKPOINT = 780;

export function useViewport(): Viewport {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const update = (): void => setWidth(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return { width, compact: width !== null && width < COMPACT_BREAKPOINT };
}
