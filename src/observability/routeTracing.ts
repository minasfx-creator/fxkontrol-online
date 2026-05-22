/**
 * ─── Route Tracing ────────────────────────────────────────────────
 * Records `from → to` transitions with dwell time on the previous
 * route. Pair with `useRouteTracing` for React Router.
 */
import { pushRumEvent } from './rumClient';

let lastRoute =
  typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}`
    : '/';

let lastTs =
  typeof performance !== 'undefined' ? performance.now() : Date.now();

export function trackRouteChange(nextRoute?: string): void {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const route =
    nextRoute ??
    (typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/');

  if (route === lastRoute) return;

  pushRumEvent({
    type: 'route_change',
    route,
    payload: {
      from: lastRoute,
      to: route,
      durationMs: Math.max(0, Math.round(now - lastTs)),
    },
  });

  lastRoute = route;
  lastTs = now;
}

export function resetRouteTracing(route = '/'): void {
  lastRoute = route;
  lastTs = typeof performance !== 'undefined' ? performance.now() : Date.now();
}
