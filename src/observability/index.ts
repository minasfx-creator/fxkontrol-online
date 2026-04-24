/**
 * ─── Observability Entry Point ────────────────────────────────────
 * Public surface:
 *   - initObservability()   → wires Web Vitals + global error capture
 *   - useRouteTracing()     → React hook for route change events
 *   - setReplayContext()    → call from emulator when replay starts
 *   - clearReplayContext()  → call from emulator when replay ends
 *   - captureError()        → manual error reporting
 *   - flushRum()            → force flush (e.g. before a critical nav)
 */
import { initWebVitalsRum } from './webVitalsRum';
import { initErrorCapture } from './errorCapture';

export function initObservability(): void {
  initWebVitalsRum();
  initErrorCapture();
}

export { useRouteTracing, trackRouteChange } from './routeTracing';
export {
  setReplayContext,
  clearReplayContext,
  getReplayContext,
} from './errorCorrelation';
export { captureError } from './errorCapture';
export { flushRum, getRumSessionId, pushRumEvent } from './rumClient';
export type { RumEvent, RumEventType } from './rumTypes';
