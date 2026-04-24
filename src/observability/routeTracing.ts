/**
 * ─── Route Tracing ────────────────────────────────────────────────
 * Emits a RUM event on each route change with `from`, `to`, and the
 * time spent on the previous route. Pair with the `useRouteTracing`
 * hook for React Router integration.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pushRumEvent } from './rumClient';

let lastRoute: string =
  typeof window !== 'undefined' ? window.location.pathname : '/';
let lastTs: number =
  typeof performance !== 'undefined' ? performance.now() : Date.now();

export function trackRouteChange(nextRoute?: string): void {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const to = nextRoute ?? (typeof window !== 'undefined' ? window.location.pathname : '/');

  pushRumEvent({
    type: 'route_change',
    route: to,
    payload: {
      from: lastRoute,
      to,
      durationMs: Math.round(now - lastTs),
    },
  });

  lastRoute = to;
  lastTs = now;
}

/** React Router hook — mount once near the app root, inside <BrowserRouter>. */
export function useRouteTracing(): void {
  const loc = useLocation();
  useEffect(() => {
    trackRouteChange(loc.pathname);
  }, [loc.pathname]);
}
