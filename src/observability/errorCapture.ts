/**
 * ─── Error Capture ────────────────────────────────────────────────
 * Window-level error listeners. Emits sanitized error events with
 * the active replay/trace IDs attached. Stack traces are capped.
 */
import { getReplayContext } from './errorCorrelation';
import { pushRumEvent } from './rumClient';
import type { ErrorPayload } from './rumTypes';

function route(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search}`;
}

function toErrorPayload(err: unknown, source: ErrorPayload['source']): ErrorPayload {
  if (err instanceof Error) {
    return {
      source,
      name: err.name,
      message: err.message.slice(0, 1000),
      stack: err.stack?.slice(0, 2000),
    };
  }
  return { source, message: String(err).slice(0, 1000) };
}

export function captureError(
  err: unknown,
  source: ErrorPayload['source'] = 'manual',
): void {
  const ctx = getReplayContext();
  pushRumEvent({
    type: 'error',
    route: route(),
    replayId: ctx.replayId,
    traceId: ctx.traceId,
    payload: toErrorPayload(err, source) as unknown as Record<string, unknown>,
  });
}

let installed = false;

export function initErrorCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    captureError(event.error ?? event.message, 'window_error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason, 'unhandled_rejection');
  });
}
