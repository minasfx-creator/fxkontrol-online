/**
 * ─── Error ↔ Replay Correlation ───────────────────────────────────
 * Tiny module-scoped context that lets error events carry the active
 * replay/trace IDs without coupling the error pipeline to the
 * emulator. The emulator calls setReplayContext when a replay starts
 * and clearReplayContext when it ends.
 */

let currentReplayId: string | null = null;
let currentTraceId: string | null = null;

export function setReplayContext(replayId: string, traceId?: string): void {
  currentReplayId = replayId;
  currentTraceId = traceId ?? null;
}

export function clearReplayContext(): void {
  currentReplayId = null;
  currentTraceId = null;
}

export function getReplayContext(): { replayId?: string; traceId?: string } {
  return {
    replayId: currentReplayId ?? undefined,
    traceId: currentTraceId ?? undefined,
  };
}
