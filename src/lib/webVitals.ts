/**
 * Web Vitals RUM — Per-route performance instrumentation.
 * Reports LCP, INP, CLS, FCP, TTFB with route context.
 */
import { onLCP, onINP, onCLS, onFCP, onTTFB, type Metric } from 'web-vitals';

interface VitalReport {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  route: string;
  timestamp: number;
  navigationType: string;
}

const reports: VitalReport[] = [];

function getRoute(): string {
  return window.location.pathname || '/';
}

function handleMetric(metric: Metric) {
  const report: VitalReport = {
    name: metric.name,
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    rating: metric.rating,
    route: getRoute(),
    timestamp: Date.now(),
    navigationType: metric.navigationType,
  };

  reports.push(report);

  // Log to console in development
  if (import.meta.env.DEV) {
    const color = report.rating === 'good' ? '#0f0' : report.rating === 'needs-improvement' ? '#ff0' : '#f00';
    console.log(
      `%c[WebVital] ${report.name}: ${report.value}${report.name === 'CLS' ? ' (x1000)' : 'ms'} [${report.rating}] @ ${report.route}`,
      `color: ${color}; font-weight: bold;`
    );
  }
}

export function initWebVitals() {
  onLCP(handleMetric);
  onINP(handleMetric);
  onCLS(handleMetric);
  onFCP(handleMetric);
  onTTFB(handleMetric);
}

/** Get all collected reports (for debugging / future beacon) */
export function getVitalReports(): VitalReport[] {
  return [...reports];
}
