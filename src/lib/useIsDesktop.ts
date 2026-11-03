// One breakpoint for the desktop layout. CSS uses the same query: @media (min-width: 1024px).
import { useSyncExternalStore } from 'react';

export const DESKTOP_QUERY = '(min-width: 1024px)';

const mq: MediaQueryList | null = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(DESKTOP_QUERY) : null;

function subscribe(cb: () => void) {
  if (!mq) return () => {};
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

export function isDesktopNow(): boolean { return !!mq?.matches; }

// True at 1024px and up. Use it only for structure (nav, rails, panes); style everything else in CSS.
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, isDesktopNow, () => false);
}
