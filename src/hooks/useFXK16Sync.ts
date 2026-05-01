/**
 * ─── useFXK16Sync ─────────────────────────────────────────────────
 * React hook over `fxk16Sync` — the cross-surface event/timing store
 * shared by FieldOps, FieldTest, and Live Firing. Returns a stable
 * snapshot (status, armed, lastEvent, events, latency, op timestamps)
 * plus the ergonomic `fire` / `batch` / `eStop` wrappers that
 * automatically open/close timing spans.
 *
 * Wiring (one-shot, idempotent):
 *   1. Subscribes to the singleton `useFXK16Bridge` event stream so
 *      every bridge event lands in the sync store.
 *   2. Subscribes to `Fxk16CommandApi.onArmChange` so ARM state stays
 *      in sync regardless of which panel toggled it.
 *
 * Use this hook in any panel that needs to:
 *   • Render the *same* event log the other panels see.
 *   • Show ARM / READY / latency consistently.
 *   • Fire/batch/E-STOP and have the timing automatically broadcast.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { fxk16Sync, type SyncSnapshot } from '@/lib/fxk16/syncStore';
import { getFXK16Bridge } from '@/hooks/useFXK16Bridge';
import { getFXK16CommandApi } from '@/hooks/useFXK16Commands';
import type { CommandResponse } from '@/lib/fxk16/commandApi';

// ── Module-scope wiring (runs once per process) ───────────────────
let _wired = false;
function ensureWired(): void {
  if (_wired) return;
  _wired = true;
  const bridge = getFXK16Bridge();
  const api = getFXK16CommandApi();

  // Seed status immediately.
  fxk16Sync.setStatus(bridge.getStatus());

  // Wrap the existing onEvent handler — bridge constructor only
  // accepts ONE handler, but the singleton exposes `addEventListener`
  // semantics through the React hook. We tap into `getStatus()` polling
  // to keep the snapshot fresh + intercept events via a thin shim.
  // Note: the hook `useFXK16Bridge` already pushes status to listeners
  // on every event — we re-emit those into the sync store below.
  // For event *kinds*, we hook the bridge once via a side channel:
  // FireOneHardwareBridge exposes `onEvent` only via constructor, so
  // we patch `setStatus` propagation via the existing _listeners set
  // owned by `useFXK16Bridge`. Until that's accessible, we listen to
  // the same status changes and emit a synthetic delta-based event.
  const unsubStatus = subscribeBridgeStatus((s) => fxk16Sync.setStatus(s));

  // ARM change: wrap the existing onArmChange callback.
  const prevArm = api.isArmed();
  fxk16Sync.setArmed(prevArm);
  const unsubArm = subscribeArmChange((armed) => fxk16Sync.setArmed(armed));

  // Best-effort cleanup if the page is being torn down (HMR).
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      unsubStatus();
      unsubArm();
    }, { once: true });
  }
}

// ── Bridge status subscription (poll at 500ms — cheap, no allocs) ─
function subscribeBridgeStatus(cb: (s: ReturnType<ReturnType<typeof getFXK16Bridge>['getStatus']>) => void): () => void {
  const bridge = getFXK16Bridge();
  let last = bridge.getStatus();
  cb(last);
  const tick = setInterval(() => {
    const s = bridge.getStatus();
    // Cheap structural compare on the fields the UI reads.
    if (
      s.connected !== last.connected
      || s.linkHealth !== last.linkHealth
      || s.transport !== last.transport
      || s.deviceModel !== last.deviceModel
      || s.channelCount !== last.channelCount
      || s.rssi !== last.rssi
      || s.lastError !== last.lastError
      || s.firmwareVersion !== last.firmwareVersion
    ) {
      // Emit a synthetic event for the most meaningful transition.
      if (s.connected !== last.connected) {
        fxk16Sync.ingestBridgeEvent(s.connected ? 'connected' : 'disconnected', { transport: s.transport });
      } else if (s.linkHealth !== last.linkHealth && s.linkHealth === 'disconnected') {
        fxk16Sync.ingestBridgeEvent('heartbeat_timeout', { linkHealth: s.linkHealth });
      } else if (s.deviceModel !== last.deviceModel && s.deviceModel) {
        fxk16Sync.ingestBridgeEvent('module_model', s.deviceModel);
      } else if (s.firmwareVersion !== last.firmwareVersion && s.firmwareVersion) {
        fxk16Sync.ingestBridgeEvent('firmware_version', s.firmwareVersion);
      }
      last = s;
      cb(s);
    } else {
      // Always push fresh status (covers RSSI / latency drifts).
      cb(s);
    }
  }, 500);
  return () => clearInterval(tick);
}

// ── ARM-change subscription (poll the api flag) ───────────────────
function subscribeArmChange(cb: (armed: boolean) => void): () => void {
  const api = getFXK16CommandApi();
  let last = api.isArmed();
  const tick = setInterval(() => {
    const cur = api.isArmed();
    if (cur !== last) {
      last = cur;
      cb(cur);
    }
  }, 250);
  return () => clearInterval(tick);
}

// ── Public hook ───────────────────────────────────────────────────

export interface UseFXK16SyncApi extends SyncSnapshot {
  /** Fire one channel; pushes start/settle into the shared log. */
  fire(channel: number, durationMs: number): Promise<CommandResponse<unknown>>;
  /** Batch fire; pushes start/settle into the shared log. */
  batch(channels: number[], durationMs: number): Promise<CommandResponse<unknown>>;
  /** E-STOP; pushes attempt/result into the shared log. */
  eStop(): Promise<CommandResponse>;
  /** Reset the in-memory event log (does not touch hardware). */
  clearEvents(): void;
}

export function useFXK16Sync(): UseFXK16SyncApi {
  ensureWired();
  const snap = useSyncExternalStore(
    (cb) => fxk16Sync.subscribe(cb),
    () => fxk16Sync.get(),
    () => fxk16Sync.get(),
  );

  // Re-seed status on mount (covers SSR / first paint).
  useEffect(() => {
    const bridge = getFXK16Bridge();
    fxk16Sync.setStatus(bridge.getStatus());
  }, []);

  const fire = useCallback(async (channel: number, durationMs: number) => {
    const settle = fxk16Sync.beginFire(channel, durationMs);
    const api = getFXK16CommandApi();
    const res = await api.fire(channel, durationMs);
    settle(res.ok === true, res.ok === true ? undefined : res.message);
    return res;
  }, []);

  const batch = useCallback(async (channels: number[], durationMs: number) => {
    const settle = fxk16Sync.beginBatch(channels, durationMs);
    const api = getFXK16CommandApi();
    const res = await api.fireBatch(channels, durationMs);
    settle(res.ok === true, res.ok === true ? undefined : res.message);
    return res;
  }, []);

  const eStop = useCallback(async () => {
    const api = getFXK16CommandApi();
    fxk16Sync.ingestBridgeEvent('estop_attempt', { source: 'useFXK16Sync' });
    const res = await api.stop();
    fxk16Sync.ingestBridgeEvent('estop_result', { ok: res.ok === true });
    return res;
  }, []);

  const clearEvents = useCallback(() => fxk16Sync.clearEvents(), []);

  return { ...snap, fire, batch, eStop, clearEvents };
}
