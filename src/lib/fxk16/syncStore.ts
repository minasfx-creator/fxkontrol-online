/**
 * ─── FXK16 Sync Store ─────────────────────────────────────────────
 * Single source of truth that fans out FXK16 activity to every
 * surface (FieldOps, FieldTest, Live Firing). Captures:
 *
 *   • status snapshot (transport, linkHealth, deviceModel, RSSI)
 *   • armed flag (mirrored from Fxk16CommandApi.onArmChange)
 *   • last bridge event (`connected`, `heartbeat_timeout`,
 *     `estop_attempt`, `estop_result`, `module_model`, `data`, …)
 *   • per-op timing for FIRE / BATCH / ESTOP — `lastFireAt`,
 *     `lastBatchAt`, `lastEStopAt`, `lastLatencyMs`
 *   • bounded ring buffer of `SyncEvent`s (default 120)
 *
 * Pure module-scope singleton; no React. Hooks subscribe via
 * `useSyncExternalStore`. Pushing into the ring is the only mutation
 * — listeners receive an immutable snapshot reference each notify.
 *
 * Intentionally NOT calling into the bridge or the command API. The
 * bridge owns transport; the command API owns ARM. We only *observe*.
 */
import type { BridgeStatus } from '@/lib/fireoneModuleHardwareBridge';

export type SyncEventKind =
  | 'connected'
  | 'disconnected'
  | 'heartbeat_timeout'
  | 'reconnecting'
  | 'firmware_version'
  | 'module_model'
  | 'module_channels'
  | 'estop_attempt'
  | 'estop_result'
  | 'fire_start'
  | 'fire_settled'
  | 'batch_start'
  | 'batch_settled'
  | 'arm'
  | 'disarm'
  | 'data'
  | 'unknown';

export interface SyncEvent {
  id: string;
  ts: number;
  kind: SyncEventKind;
  /** Free-form short label for UI rendering. */
  label: string;
  /** Round-trip / settle latency, when applicable. */
  latencyMs?: number;
  /** Original payload from the bridge (kept loose by design). */
  payload?: unknown;
  /** OK flag for settle-style entries. */
  ok?: boolean;
}

export interface SyncSnapshot {
  status: BridgeStatus | null;
  armed: boolean;
  /** Last event pushed. `null` until the first event. */
  lastEvent: SyncEvent | null;
  /** Bounded ring buffer (newest first). */
  events: SyncEvent[];
  /** Timestamps of the most recent ops (ms epoch). 0 = never. */
  lastFireAt: number;
  lastBatchAt: number;
  lastEStopAt: number;
  /** Most recent settled latency in ms (FIRE or BATCH). */
  lastLatencyMs: number;
  /** Monotonic counter — useful as a React key / equality probe. */
  rev: number;
}

const MAX_EVENTS = 120;

const _initial: SyncSnapshot = {
  status: null,
  armed: false,
  lastEvent: null,
  events: [],
  lastFireAt: 0,
  lastBatchAt: 0,
  lastEStopAt: 0,
  lastLatencyMs: 0,
  rev: 0,
};

let _snap: SyncSnapshot = _initial;
const _listeners = new Set<() => void>();

function notify(): void {
  for (const l of _listeners) {
    try { l(); } catch { /* never break safety on listener errors */ }
  }
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function pushEvent(ev: Omit<SyncEvent, 'id' | 'ts'> & { ts?: number }): SyncEvent {
  const event: SyncEvent = {
    id: makeId(),
    ts: ev.ts ?? Date.now(),
    ...ev,
  };
  const events = [event, ..._snap.events];
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  let { lastFireAt, lastBatchAt, lastEStopAt, lastLatencyMs } = _snap;
  if (event.kind === 'fire_settled') {
    lastFireAt = event.ts;
    if (typeof event.latencyMs === 'number') lastLatencyMs = event.latencyMs;
  } else if (event.kind === 'batch_settled') {
    lastBatchAt = event.ts;
    if (typeof event.latencyMs === 'number') lastLatencyMs = event.latencyMs;
  } else if (event.kind === 'estop_result' || event.kind === 'estop_attempt') {
    lastEStopAt = event.ts;
  }
  _snap = {
    ..._snap,
    events,
    lastEvent: event,
    lastFireAt,
    lastBatchAt,
    lastEStopAt,
    lastLatencyMs,
    rev: _snap.rev + 1,
  };
  notify();
  return event;
}

export const fxk16Sync = {
  /** Read-only snapshot accessor (stable identity between mutations). */
  get(): SyncSnapshot {
    return _snap;
  },

  subscribe(listener: () => void): () => void {
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  },

  /** Wholesale status replacement (called by `useFXK16Bridge` listener). */
  setStatus(status: BridgeStatus): void {
    if (_snap.status === status) return;
    _snap = { ..._snap, status, rev: _snap.rev + 1 };
    notify();
  },

  /** Mirror of Fxk16CommandApi ARM flag. */
  setArmed(armed: boolean, label?: string): void {
    if (_snap.armed === armed && !label) return;
    _snap = { ..._snap, armed, rev: _snap.rev + 1 };
    pushEvent({ kind: armed ? 'arm' : 'disarm', label: label ?? (armed ? 'ARMED' : 'DISARMED') });
  },

  /** Generic bridge event ingestion. */
  ingestBridgeEvent(event: string, data: unknown): void {
    const known: SyncEventKind[] = [
      'connected', 'disconnected', 'heartbeat_timeout', 'reconnecting',
      'firmware_version', 'module_model', 'module_channels',
      'estop_attempt', 'estop_result', 'data',
    ];
    const kind: SyncEventKind = (known as string[]).includes(event)
      ? (event as SyncEventKind)
      : 'unknown';
    let label = event;
    let ok: boolean | undefined;
    if (kind === 'estop_result') ok = !!(data as { ok?: boolean })?.ok;
    if (kind === 'data') {
      const s = String(data ?? '');
      label = s.length > 48 ? `${s.slice(0, 48)}…` : s;
    }
    pushEvent({ kind, label, payload: data, ok });
  },

  /** Open a FIRE op span; returns a `settle` callback that closes it. */
  beginFire(channel: number, durationMs: number): (ok: boolean, detail?: string) => void {
    const t0 = performance.now();
    pushEvent({
      kind: 'fire_start',
      label: `FIRE ch${channel} (${durationMs}ms)`,
      payload: { channel, durationMs },
    });
    return (ok: boolean, detail?: string) => {
      const latencyMs = Math.round(performance.now() - t0);
      pushEvent({
        kind: 'fire_settled',
        label: `FIRE ch${channel} ${ok ? 'OK' : 'ERR'}${detail ? ` · ${detail}` : ''}`,
        latencyMs,
        ok,
        payload: { channel, durationMs },
      });
    };
  },

  /** Open a BATCH op span; returns a `settle` callback that closes it. */
  beginBatch(channels: number[], durationMs: number): (ok: boolean, detail?: string) => void {
    const t0 = performance.now();
    pushEvent({
      kind: 'batch_start',
      label: `BATCH [${channels.join(',')}] (${durationMs}ms)`,
      payload: { channels: [...channels], durationMs },
    });
    return (ok: boolean, detail?: string) => {
      const latencyMs = Math.round(performance.now() - t0);
      pushEvent({
        kind: 'batch_settled',
        label: `BATCH n=${channels.length} ${ok ? 'OK' : 'ERR'}${detail ? ` · ${detail}` : ''}`,
        latencyMs,
        ok,
        payload: { channels: [...channels], durationMs },
      });
    };
  },

  /** Reset the in-memory log (does not touch hardware). */
  clearEvents(): void {
    _snap = { ..._snap, events: [], lastEvent: null, rev: _snap.rev + 1 };
    notify();
  },
};

export type Fxk16SyncStore = typeof fxk16Sync;
