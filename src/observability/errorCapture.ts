/**
 * ─── Error Capture ────────────────────────────────────────────────
 * Window-level error + unhandledrejection listeners that emit
 * sanitized RUM events with the active replay context attached.
 *
 * We deliberately cap stack length (1KB) and never include args,
 * locals, or DOM content.
 */
import { pushRumEvent } from './rumClient';
import { getReplayContext } from './errorCorrelation';

function getRoute(): string {
  return typeof window !== 'undefined' ? window.location.pathname : '/';
}

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try { return JSON.stringify(err).slice(0, 500); } catch { return 'unknown'; }
}

function safeStack(err: unknown): string | undefined {
  if (err instanceof Error && err.stack) return err.stack.slice(0, 1000);
  return undefined;
}

export function captureError(err: unknown): void {
  const ctx = getReplayContext();
  pushRumEvent({
    type: 'error',
    route: getRoute(),
    replayId: ctx.replayId,
    traceId: ctx.traceId,
    payload: {
      message: safeMessage(err),
      stack: safeStack(err),
    },
  });
}

let installed = false;

export function initErrorCapture(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (e: ErrorEvent) => {
    captureError(e.error ?? e.message);
  });
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    captureError(e.reason);
  });
}
