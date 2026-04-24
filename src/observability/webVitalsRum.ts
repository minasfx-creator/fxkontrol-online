/**
 * ─── Web Vitals → RUM bridge ──────────────────────────────────────
 * Shares the existing `web-vitals` instrumentation from
 * `src/lib/webVitals.ts` and forwards each metric to the RUM queue.
 * Initialize once from the observability entry point.
 */
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';
import { pushRumEvent } from './rumClient';

function getRoute(): string {
  return typeof window !== 'undefined' ? window.location.pathname : '/';
}

function send(metric: Metric): void {
  pushRumEvent({
    type: 'web_vital',
    route: getRoute(),
    payload: {
      name: metric.name,
      value: metric.name === 'CLS' ? Math.round(metric.value * 1000) : Math.round(metric.value),
      rating: metric.rating,
      navigationType: metric.navigationType,
    },
  });
}

let installed = false;

export function initWebVitalsRum(): void {
  if (installed) return;
  installed = true;
  onCLS(send);
  onLCP(send);
  onINP(send);
  onFCP(send);
  onTTFB(send);
}
