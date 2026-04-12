/**
 * useRenderCounter — Dev-only hook to monitor component re-renders.
 *
 * Usage:
 *   useRenderCounter('PositionPins');
 *
 * In development, logs render count to console with throttled output.
 * Completely no-ops in production builds (tree-shaken away).
 */
import { useRef, useEffect } from 'react';

const THROTTLE_MS = 2000;
const counters = new Map<string, { count: number; lastLog: number }>();

function logCounters() {
  const now = performance.now();
  const entries: string[] = [];
  counters.forEach((v, name) => {
    if (now - v.lastLog < THROTTLE_MS) return;
    entries.push(`${name}: ${v.count}`);
    v.lastLog = now;
  });
  if (entries.length > 0) {
    console.debug(`[RenderCounter] ${entries.join(' | ')}`);
  }
}

let rafId: number | null = null;
function scheduleLog() {
  if (rafId !== null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    logCounters();
  });
}

/**
 * Track render count for a named component.
 * Only active when `import.meta.env.DEV` is true.
 */
export function useRenderCounter(name: string): void {
  if (!import.meta.env.DEV) return;

  const ref = useRef(0);
  ref.current += 1;

  if (!counters.has(name)) {
    counters.set(name, { count: 0, lastLog: 0 });
  }
  counters.get(name)!.count = ref.current;
  scheduleLog();
}

/**
 * Get a snapshot of all render counts (for devtools / debug UI).
 */
export function getRenderCounters(): Record<string, number> {
  const out: Record<string, number> = {};
  counters.forEach((v, k) => { out[k] = v.count; });
  return out;
}

/**
 * Reset all counters (useful when navigating between views).
 */
export function resetRenderCounters(): void {
  counters.clear();
}
