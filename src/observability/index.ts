/**
 * ─── Observability Public Surface ─────────────────────────────────
 * - initObservability()   → Web Vitals + global error capture
 * - useRouteTracing()     → React Router hook
 * - setReplayContext()    → call from emulator on replay start
 * - clearReplayContext()  → call from emulator on replay stop
 * - captureError()        → manual error reporting
 * - flushRum()            → force flush before critical nav
 */
import { initErrorCapture } from './errorCapture';
import { installRumFlushHandlers } from './rumClient';
import { initWebVitals } from './webVitals';

let installed = false;

export function initObservability(): void {
  if (installed) return;
  installed = true;

  installRumFlushHandlers();
  initErrorCapture();
  void initWebVitals();
}

export * from './rumTypes';
export * from './rumClient';
export * from './routeTracing';
export * from './errorCorrelation';
export * from './errorCapture';
export * from './webVitals';
export { useRouteTracing } from './useRouteTracing';
