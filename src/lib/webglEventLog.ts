/**
 * ─── WebGL Event Log ─────────────────────────────────────────────────
 * Lightweight ring buffer that records `webglcontextlost` / `webglcontextrestored`
 * events as they happen so the dev diagnostics panel can show a timeline
 * (and prove the auto-recovery actually fired).
 *
 * Zero dependencies, side-effect free at module load. Bounded at 200 entries
 * to avoid unbounded growth in long sessions.
 */

export type WebglEventKind = 'lost' | 'restored' | 'remount-attempt' | 'recovered';

export interface WebglEvent {
  /** Monotonic event id (incremented per push). */
  id: number;
  /** `Date.now()` at the time of the event. */
  ts: number;
  kind: WebglEventKind;
  /** Free-form context (e.g. attempt number, reason). */
  detail?: string;
}

const MAX_EVENTS = 200;

let _events: WebglEvent[] = [];
let _seq = 0;
let _lostCount = 0;
let _restoredCount = 0;
let _remountCount = 0;

const _subs = new Set<() => void>();

function _notify() {
  for (const fn of _subs) {
    try { fn(); } catch { /* ignore */ }
  }
}

export function logWebglEvent(kind: WebglEventKind, detail?: string): void {
  _seq++;
  const evt: WebglEvent = { id: _seq, ts: Date.now(), kind, detail };
  _events.push(evt);
  if (_events.length > MAX_EVENTS) _events = _events.slice(-MAX_EVENTS);
  if (kind === 'lost') _lostCount++;
  else if (kind === 'restored') _restoredCount++;
  else if (kind === 'remount-attempt') _remountCount++;
  _notify();
}

export function getWebglEvents(): readonly WebglEvent[] {
  return _events;
}

export function getWebglEventCounters(): Readonly<{
  lost: number; restored: number; remountAttempts: number; total: number;
}> {
  return {
    lost: _lostCount,
    restored: _restoredCount,
    remountAttempts: _remountCount,
    total: _seq,
  };
}

export function subscribeWebglEvents(fn: () => void): () => void {
  _subs.add(fn);
  return () => { _subs.delete(fn); };
}

export function clearWebglEvents(): void {
  _events = [];
  // Counters intentionally NOT reset — they are cumulative for the session
  // so dev can see "this session has had 3 context losses total" even after
  // clearing the timeline.
  _notify();
}
