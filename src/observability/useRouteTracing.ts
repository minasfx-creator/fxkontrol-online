/**
 * ─── useRouteTracing ──────────────────────────────────────────────
 * React Router hook. Mount once near the app shell, inside
 * <BrowserRouter>.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackRouteChange } from './routeTracing';

export function useRouteTracing(): void {
  const location = useLocation();
  useEffect(() => {
    trackRouteChange(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);
}
