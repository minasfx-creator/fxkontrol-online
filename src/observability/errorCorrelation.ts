/**
 * ─── Error ↔ Replay Correlation ───────────────────────────────────
 * Module-scoped context bridging the emulator to the error pipeline
 * without coupling them. Set on replay start, clear on stop.
 */

let currentReplayId: string | undefined;
let currentTraceId: string | undefined;

export function setReplayContext(replayId: string, traceId?: string): void {
  currentReplayId = replayId;
  currentTraceId = traceId;
}

export function clearReplayContext(): void {
  currentReplayId = undefined;
  currentTraceId = undefined;
}

export function getReplayContext(): { replayId?: string; traceId?: string } {
  return { replayId: currentReplayId, traceId: currentTraceId };
}

export function createReplayId(prefix = 'replay'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
