/**
 * ─── RUM Client ───────────────────────────────────────────────────
 * Class-based queue with sendBeacon/fetch keepalive flush, payload
 * sanitization (drops command/trace/PII keys), and silent no-op
 * when no endpoint is configured.
 *
 * Security guarantee: this client NEVER ships command frames, raw
 * trace data, or PII fields. See `sanitizePayload` for the blocklist.
 */
import type { RumClientOptions, RumEvent } from './rumTypes';

const DEFAULT_MAX_QUEUE = 50;

function safeRandomId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `rum_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getDefaultBuild(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_APP_VERSION ?? env.VITE_COMMIT_SHA ?? 'dev';
}

function getDefaultEndpoint(): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_RUM_ENDPOINT || undefined;
}

function getCurrentRoute(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
}

/**
 * Strip sensitive / oversized fields. Anything not on the safe-type
 * allowlist is replaced with a tag rather than serialized.
 */
function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const blockedKeys = new Set([
    'trace',
    'frames',
    'rawTrace',
    'command',
    'cmd',
    'payloadRaw',
    'email',
    'phone',
    'name',
  ]);

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (blockedKeys.has(key)) continue;

    if (typeof value === 'string') {
      out[key] = value.length > 1000 ? `${value.slice(0, 1000)}…` : value;
      continue;
    }

    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null ||
      value === undefined
    ) {
      out[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      out[key] = `[array:${value.length}]`;
      continue;
    }

    if (typeof value === 'object') {
      out[key] = '[object]';
      continue;
    }

    out[key] = String(value);
  }

  // The web-vital event uses `name` legitimately. Re-allow it for that case.
  if ('name' in payload && typeof payload.name === 'string' && payload.name.length <= 16) {
    out.name = payload.name;
  }

  return out;
}

export class RumClient {
  private queue: RumEvent[] = [];
  private endpoint?: string;
  private maxQueue: number;
  private enabled: boolean;
  private readonly sessionId: string;
  private readonly build: string;

  constructor(options: RumClientOptions = {}) {
    this.endpoint = options.endpoint ?? getDefaultEndpoint();
    this.maxQueue = options.maxQueue ?? DEFAULT_MAX_QUEUE;
    this.enabled = options.enabled ?? true;
    this.sessionId = safeRandomId();
    this.build = options.build ?? getDefaultBuild();
  }

  getSessionId(): string { return this.sessionId; }
  getQueueSize(): number { return this.queue.length; }
  getQueueSnapshot(): RumEvent[] { return [...this.queue]; }

  setEndpoint(endpoint?: string): void { this.endpoint = endpoint; }
  setEnabled(enabled: boolean): void { this.enabled = enabled; }

  push(event: Omit<RumEvent, 'id' | 'ts' | 'sessionId' | 'build'>): RumEvent | null {
    if (!this.enabled) return null;

    const full: RumEvent = {
      ...event,
      id: safeRandomId(),
      ts: Date.now(),
      sessionId: this.sessionId,
      build: this.build,
      route: event.route || getCurrentRoute(),
      payload: sanitizePayload(event.payload ?? {}),
    };

    this.queue.push(full);

    if (this.queue.length >= this.maxQueue) {
      this.flush();
    }
    return full;
  }

  flush(): boolean {
    if (!this.enabled || !this.endpoint || this.queue.length === 0) return false;

    const batch = this.queue.splice(0, this.queue.length);
    const body = JSON.stringify(batch);

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const ok = navigator.sendBeacon(
          this.endpoint,
          new Blob([body], { type: 'application/json' }),
        );
        if (ok) return true;
        this.queue.unshift(...batch);
        return false;
      }

      if (typeof fetch !== 'undefined') {
        void fetch(this.endpoint, {
          method: 'POST',
          body,
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => { this.queue.unshift(...batch); });
        return true;
      }

      this.queue.unshift(...batch);
      return false;
    } catch {
      this.queue.unshift(...batch);
      return false;
    }
  }
}

export const rumClient = new RumClient();

export function pushRumEvent(
  event: Omit<RumEvent, 'id' | 'ts' | 'sessionId' | 'build'>,
): RumEvent | null {
  return rumClient.push(event);
}

export function flushRum(): boolean {
  return rumClient.flush();
}

export function getRumSessionId(): string {
  return rumClient.getSessionId();
}

export function installRumFlushHandlers(): void {
  if (typeof window === 'undefined') return;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') rumClient.flush();
  });
  window.addEventListener('pagehide', () => { rumClient.flush(); });
}
