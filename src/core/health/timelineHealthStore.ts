/**
 * timelineHealthStore — single source of truth for the operational status
 * of the master timeline clock, consumed by the health-check watchdog and
 * by the UI badge in the timeline header.
 *
 * Why a dedicated store
 *   The watchdog (`useTimelineClockHealthCheck`) already knows *exactly*
 *   when the clock advances, stalls, or recovers — but until now that
 *   knowledge only surfaced as toasts. The badge in the timeline header
 *   needs the same information continuously, so the watchdog now publishes
 *   its derived status here and any UI surface can subscribe with a tiny
 *   `useSyncExternalStore` hook (`useTimelineHealth`) without re-implementing
 *   the stall heuristics.
 *
 * Status semantics — the badge reflects the *clock*, not the operator's
 * intent (`isPlaying`):
 *   - 'idle'      : `isPlaying === false`. Clock is intentionally not
 *                   advancing; we don't show alarming colors.
 *   - 'running'   : `isPlaying === true` and the clock is advancing within
 *                   the watchdog's stall threshold.
 *   - 'stalled'   : `isPlaying === true` but the clock has not advanced for
 *                   ≥ stallThresholdMs. The watchdog is about to attempt
 *                   recovery (or has just attempted it without success).
 *   - 'recovered' : a recovery just completed successfully and the clock is
 *                   moving again. Auto-clears after a short window so the
 *                   badge falls back to 'running'.
 */

export type TimelineHealthStatus = 'idle' | 'running' | 'stalled' | 'recovered';

export interface TimelineHealthState {
  status: TimelineHealthStatus;
  /** ms since the last forward progress was observed. Useful for tooltips. */
  stalledForMs: number;
  /** Whether the last stall recovery was driven by audio-master resync vs
   *  pure lockstep fallback. */
  lastRecoveryPath: 'audio-resync' | 'lockstep-fallback' | null;
  /** Performance.now() of the last status transition, for animations. */
  updatedAt: number;
}

const INITIAL_STATE: TimelineHealthState = {
  status: 'idle',
  stalledForMs: 0,
  lastRecoveryPath: null,
  updatedAt: 0,
};

let state: TimelineHealthState = INITIAL_STATE;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) {
    try { l(); } catch { /* swallow listener errors */ }
  }
}

export const timelineHealthStore = {
  getState(): TimelineHealthState {
    return state;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Internal API — only the watchdog should call this. */
  _set(next: Partial<TimelineHealthState>): void {
    const merged: TimelineHealthState = { ...state, ...next, updatedAt: performance.now() };
    if (
      merged.status === state.status &&
      merged.stalledForMs === state.stalledForMs &&
      merged.lastRecoveryPath === state.lastRecoveryPath
    ) {
      return;
    }
    state = merged;
    emit();
  },
};
