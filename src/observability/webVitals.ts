/**
 * ─── Web Vitals → RUM bridge ──────────────────────────────────────
 * Lazy-imports `web-vitals` and forwards each metric to the queue.
 */
import { pushRumEvent } from './rumClient';
import type { WebVitalPayload } from './rumTypes';

interface WebVitalMetric {
  name: string;
  value: number;
  rating?: string;
  delta?: number;
  id?: string;
}

function route(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
}

function send(metric: WebVitalMetric): void {
  const payload: WebVitalPayload = {
    name: metric.name,
    value: metric.name === 'CLS' ? Math.round(metric.value * 1000) : Math.round(metric.value),
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
  };
  pushRumEvent({
    type: 'web_vital',
    route: route(),
    payload: payload as unknown as Record<string, unknown>,
  });
}

let installed = false;

export async function initWebVitals(): Promise<void> {
  if (installed) return;
  installed = true;
  try {
    const vitals = await import('web-vitals');
    vitals.onCLS(send);
    vitals.onLCP(send);
    vitals.onINP(send);
    vitals.onTTFB(send);
    if ('onFCP' in vitals && typeof vitals.onFCP === 'function') {
      vitals.onFCP(send);
    }
  } catch {
    /* web-vitals unavailable — observability degrades to no-op */
  }
}
