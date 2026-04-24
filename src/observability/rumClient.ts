/**
 * ─── RUM Client ───────────────────────────────────────────────────
 * Lightweight queue + flush. Uses navigator.sendBeacon when possible
 * so we never block unload. Silently no-ops if VITE_RUM_ENDPOINT is
 * not configured — RUM is opt-in via env var.
 *
 * Security: we NEVER include command payloads, user data, or trace
 * frames. Only metrics, sanitized error info, and correlation IDs.
 */
import type { RumEvent } from './rumTypes';

const ENDPOINT: string | undefined = import.meta.env.VITE_RUM_ENDPOINT;
const MAX_QUEUE = 50;

let queue: RumEvent[] = [];

const sessionId =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const build = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function flush(): void {
  if (!ENDPOINT || queue.length === 0) return;

  const batch = queue;
  queue = [];
  const payload = JSON.stringify(batch);

  try {
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const ok = navigator.sendBeacon(ENDPOINT, payload);
      if (ok) return;
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      body: payload,
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => { /* swallow — RUM must never break the app */ });
  } catch {
    /* swallow */
  }
}

export function pushRumEvent(
  event: Omit<RumEvent, 'id' | 'ts' | 'sessionId' | 'build'>,
): void {
  const full: RumEvent = {
    ...event,
    id: newId(),
    ts: Date.now(),
    sessionId,
    build,
  };

  queue.push(full);
  if (queue.length >= MAX_QUEUE) flush();
}

export function flushRum(): void {
  flush();
}

/** For tests — drains the in-memory queue without sending. */
export function _drainRumQueueForTest(): RumEvent[] {
  const drained = queue;
  queue = [];
  return drained;
}

export function getRumSessionId(): string {
  return sessionId;
}

// Auto-flush on tab hide. Guarded for SSR / tests.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
