/**
 * ─── MultiTransportLink — Concurrent Dispatch per Physical Device ──
 * One instance per `PhysicalDevice.aggregateId`. Coordinates parallel
 * transmission across multiple transports so the same physical
 * controller can be driven over Web Serial AND WebUSB AND BLE AND
 * Art-Net at the same time.
 *
 * Modes:
 *   • single    — only `activeTransport`
 *   • dual      — `activeTransport` + next-best online link
 *   • broadcast — every online link in parallel
 *
 * dispatch(payload) runs `Promise.allSettled` across participants and
 * updates per-link health (EMA latency, tx ok/err counters, last error).
 *
 * NOTE: This layer is purely a coordinator. The actual byte-level
 * transmission lives in the per-transport sender registered via
 * `transportSenderRegistry`. With no real sender registered, dispatches
 * fail-fast with `NO_REAL_SENDER:<transport>` unless the dev hardware
 * simulator is ON — preserving the honest-hardware contract.
 */

import { logger } from '@/lib/logger';
import { deviceAggregator } from './DeviceAggregator';
import { transportSenderRegistry } from './TransportSenderRegistry';
import { portRegistry, keyFor } from './portRegistry';
import type {
  DiscoveryTransport,
  DispatchResult,
  LinkHealth,
  LinkMode,
  MultiTransportEvent,
  MultiTransportLinkSnapshot,
  PhysicalDevice,
  PhysicalDeviceEvent,
  TransportPayload,
} from './types';

const PRIORITY: DiscoveryTransport[] = ['webserial', 'webusb', 'webble', 'mdns-artnet'];
const EMA_ALPHA = 0.3;
/** Per-link timeout budget for a dispatch (ms). Anything slower is counted
 *  as a `timeout` instead of a hard error. */
const DEFAULT_TIMEOUT_MS = 1500;
/** Consecutive timeouts/errors on a single link that trip auto-quarantine. */
const FAILURE_QUARANTINE_THRESHOLD = 3;
/** Errors that should NOT trigger quarantine — they're contract-level
 *  signals (no real sender wired up), not flaky hardware. */
const QUARANTINE_IGNORED_PREFIXES = ['NO_REAL_SENDER:'];

type Listener = (event: MultiTransportEvent) => void;

function emptyHealth(transport: DiscoveryTransport): LinkHealth {
  return {
    transport,
    txOk: 0,
    txErr: 0,
    txTimeout: 0,
    latencyMs: 0,
    maxLatencyMs: 0,
    lastAt: 0,
    lastOkAt: 0,
    lastFailAt: 0,
    online: false,
    status: 'idle',
  };
}

export class MultiTransportLink {
  readonly aggregateId: string;
  private _mode: LinkMode = 'single';
  private _participants: DiscoveryTransport[] = [];
  private _health = new Map<DiscoveryTransport, LinkHealth>();
  private _consecutiveFailures = new Map<DiscoveryTransport, number>();
  private _listeners = new Set<Listener>();
  private _totalTxOk = 0;
  private _totalTxErr = 0;
  private _totalTxTimeout = 0;
  private _lastDispatch?: MultiTransportLinkSnapshot['lastDispatch'];
  private _unsubAggregator: (() => void) | null = null;

  constructor(aggregateId: string, initialMode: LinkMode = 'single') {
    this.aggregateId = aggregateId;
    this._mode = initialMode;
    this._recomputeParticipants();

    this._unsubAggregator = deviceAggregator.watch((ev) => this._onAggregatorEvent(ev));
  }

  destroy(): void {
    this._unsubAggregator?.();
    this._unsubAggregator = null;
    this._listeners.clear();
  }

  // ── Public API ─────────────────────────────────────────────────

  get mode(): LinkMode { return this._mode; }
  get participants(): DiscoveryTransport[] { return [...this._participants]; }

  setMode(mode: LinkMode, opts?: { persist?: boolean }): void {
    if (this._mode === mode) return;
    this._mode = mode;
    this._recomputeParticipants();
    if (opts?.persist !== false) this._persistMode();
    this._emit('mode-changed');
  }

  getDevice(): PhysicalDevice | undefined {
    return deviceAggregator.getDevice(this.aggregateId);
  }

  getSnapshot(): MultiTransportLinkSnapshot {
    const dev = this.getDevice();
    // Refresh `online` field on cached entries from the latest aggregator view.
    if (dev) {
      for (const [t, h] of this._health) {
        h.online = !!dev.links[t]?.online;
      }
    }
    const health: Partial<Record<DiscoveryTransport, LinkHealth>> = {};
    for (const [t, h] of this._health) health[t] = { ...h };
    return {
      aggregateId: this.aggregateId,
      mode: this._mode,
      participants: [...this._participants],
      primary: dev?.activeTransport ?? null,
      health,
      totalTxOk: this._totalTxOk,
      totalTxErr: this._totalTxErr,
      totalTxTimeout: this._totalTxTimeout,
      lastDispatch: this._lastDispatch ? { ...this._lastDispatch } : undefined,
    };
  }

  watch(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Dispatch a payload across ALL participating transports in parallel.
   * Returns a per-transport result list. Per-link health is updated
   * before this promise resolves.
   */
  async dispatch(payload: TransportPayload): Promise<DispatchResult[]> {
    const dev = this.getDevice();
    if (!dev) {
      logger.warn('[MultiTransportLink] dispatch called on missing aggregate', this.aggregateId);
      return [];
    }
    if (this._participants.length === 0) {
      this._lastDispatch = { at: Date.now(), okCount: 0, failCount: 0, avgLatencyMs: 0 };
      this._emit('tx', []);
      return [];
    }

    const startedAt = Date.now();
    const stamped: TransportPayload = { at: startedAt, ...payload };

    // Mark all participants 'sending'.
    for (const t of this._participants) {
      const h = this._ensureHealth(t);
      h.status = 'sending';
    }
    this._emit('health');

    const results = await Promise.all(
      this._participants.map(async (t): Promise<DispatchResult> => {
        const t0 = performance.now();
        let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
        try {
          const send = transportSenderRegistry.getSender(t);
          const sendPromise = Promise.resolve().then(() => send(dev, stamped));
          const timeoutPromise = new Promise<never>((_, rej) => {
            timeoutHandle = setTimeout(
              () => rej(new Error(`TIMEOUT:${t}:${DEFAULT_TIMEOUT_MS}ms`)),
              DEFAULT_TIMEOUT_MS,
            );
          });
          await Promise.race([sendPromise, timeoutPromise]);
          if (timeoutHandle) clearTimeout(timeoutHandle);
          const latency = performance.now() - t0;
          this._recordOk(t, latency);
          return { transport: t, ok: true, latencyMs: latency };
        } catch (e) {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          const latency = performance.now() - t0;
          const msg = e instanceof Error ? e.message : String(e);
          const isTimeout = msg.startsWith('TIMEOUT:');
          if (isTimeout) this._recordTimeout(t, latency, msg);
          else this._recordErr(t, latency, msg);
          return { transport: t, ok: false, latencyMs: latency, error: msg };
        }
      }),
    );

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;
    const avgLatencyMs =
      results.reduce((sum, r) => sum + r.latencyMs, 0) / Math.max(1, results.length);
    this._lastDispatch = { at: Date.now(), okCount, failCount, avgLatencyMs };
    this._emit('tx', results);
    return results;
  }

  // ── Internals ──────────────────────────────────────────────────

  private _onAggregatorEvent(ev: PhysicalDeviceEvent): void {
    if (ev.device.aggregateId !== this.aggregateId) return;
    if (
      ev.type === 'link-added' ||
      ev.type === 'link-updated' ||
      ev.type === 'link-lost' ||
      ev.type === 'link-quarantined' ||
      ev.type === 'link-recovered' ||
      ev.type === 'promoted' ||
      ev.type === 'added'
    ) {
      const before = this._participants.join(',');
      this._recomputeParticipants();
      if (this._participants.join(',') !== before) {
        this._emit('participants-changed');
      } else {
        // online flags or activeTransport may have changed without
        // altering participant list — still surface a health refresh.
        this._emit('health');
      }
    }
  }

  private _recomputeParticipants(): void {
    const dev = this.getDevice();
    if (!dev) {
      this._participants = [];
      return;
    }
    const quarantined = dev.quarantinedTransports ?? {};
    const onlineLinks = PRIORITY.filter((t) => dev.links[t]?.online && !quarantined[t]);

    if (this._mode === 'broadcast') {
      this._participants = onlineLinks;
    } else if (this._mode === 'dual') {
      const active = dev.activeTransport && onlineLinks.includes(dev.activeTransport)
        ? dev.activeTransport
        : onlineLinks[0];
      const second = onlineLinks.find((t) => t !== active);
      this._participants = [active, second].filter(Boolean) as DiscoveryTransport[];
    } else {
      // single
      const active = dev.activeTransport && onlineLinks.includes(dev.activeTransport)
        ? dev.activeTransport
        : onlineLinks[0];
      this._participants = active ? [active] : [];
    }

    // Ensure health entry exists for every known link AND keep online flag synced.
    for (const t of PRIORITY) {
      const linkData = dev.links[t];
      if (!linkData) continue;
      const h = this._ensureHealth(t);
      h.online = !!linkData.online;
    }
  }

  private _ensureHealth(transport: DiscoveryTransport): LinkHealth {
    let h = this._health.get(transport);
    if (!h) {
      h = emptyHealth(transport);
      this._health.set(transport, h);
    }
    return h;
  }

  private _recordOk(transport: DiscoveryTransport, latencyMs: number): void {
    const h = this._ensureHealth(transport);
    h.txOk += 1;
    const now = Date.now();
    h.lastAt = now;
    h.lastOkAt = now;
    h.lastError = undefined;
    h.status = 'ok';
    h.latencyMs = h.latencyMs === 0
      ? latencyMs
      : EMA_ALPHA * latencyMs + (1 - EMA_ALPHA) * h.latencyMs;
    if (latencyMs > h.maxLatencyMs) h.maxLatencyMs = latencyMs;
    this._totalTxOk += 1;
    // Healthy dispatch — reset failure streak.
    this._consecutiveFailures.set(transport, 0);
  }

  private _recordErr(transport: DiscoveryTransport, latencyMs: number, error: string): void {
    const h = this._ensureHealth(transport);
    h.txErr += 1;
    const now = Date.now();
    h.lastAt = now;
    h.lastFailAt = now;
    h.lastError = error;
    h.status = 'fail';
    h.latencyMs = h.latencyMs === 0
      ? latencyMs
      : EMA_ALPHA * latencyMs + (1 - EMA_ALPHA) * h.latencyMs;
    if (latencyMs > h.maxLatencyMs) h.maxLatencyMs = latencyMs;
    this._totalTxErr += 1;
    this._tickFailure(transport, error);
  }

  private _recordTimeout(transport: DiscoveryTransport, latencyMs: number, error: string): void {
    const h = this._ensureHealth(transport);
    h.txTimeout += 1;
    const now = Date.now();
    h.lastAt = now;
    h.lastFailAt = now;
    h.lastError = error;
    h.status = 'fail';
    h.latencyMs = h.latencyMs === 0
      ? latencyMs
      : EMA_ALPHA * latencyMs + (1 - EMA_ALPHA) * h.latencyMs;
    if (latencyMs > h.maxLatencyMs) h.maxLatencyMs = latencyMs;
    this._totalTxTimeout += 1;
    this._tickFailure(transport, error);
  }

  /**
   * Increment the consecutive-failure counter for a transport and trip
   * auto-quarantine when the threshold is reached. Quarantine is honored
   * by DeviceAggregator._chooseActive() — the active transport will be
   * promoted to the next-best healthy link and our participants list is
   * recomputed so subsequent dispatches stop targeting the bad link.
   *
   * Honest-hardware contract preserved: errors classified as
   * `NO_REAL_SENDER:*` (no real adapter wired in) are NOT counted —
   * those are configuration signals, not flaky links.
   */
  private _tickFailure(transport: DiscoveryTransport, error: string): void {
    if (QUARANTINE_IGNORED_PREFIXES.some((p) => error.startsWith(p))) return;

    const next = (this._consecutiveFailures.get(transport) ?? 0) + 1;
    this._consecutiveFailures.set(transport, next);
    if (next < FAILURE_QUARANTINE_THRESHOLD) return;

    // Trip the aggregator. It will promote a fresh active transport when
    // the failed one was active, and emit a 'link-quarantined' event.
    try {
      deviceAggregator.quarantineTransport(this.aggregateId, transport, error, next);
    } catch (e) {
      logger.warn('[MultiTransportLink] quarantineTransport threw', e);
    }
    // Aggregator event will trigger _onAggregatorEvent → recompute, but
    // force an immediate participant refresh so the in-flight dispatch
    // result loop sees the new layout right away.
    const before = this._participants.join(',');
    this._recomputeParticipants();
    if (this._participants.join(',') !== before) this._emit('participants-changed');
    // Reset counter so a recovered link doesn't immediately re-quarantine.
    this._consecutiveFailures.set(transport, 0);
  }

  private _persistMode(): void {
    const dev = this.getDevice();
    if (!dev) return;
    const regKey = this._registryKeyFor(dev);
    if (!regKey) return;
    try { portRegistry.setLinkMode(regKey, this._mode, dev.label); }
    catch (e) { logger.warn('[MultiTransportLink] persist linkMode failed', e); }
  }

  private _registryKeyFor(dev: PhysicalDevice): string | null {
    if (dev.host) return keyFor({ host: dev.host });
    if (typeof dev.vendorId === 'number' && typeof dev.productId === 'number') {
      return keyFor({
        vendorId: dev.vendorId,
        productId: dev.productId,
        serialNumber: dev.serialNumber,
      });
    }
    return null;
  }

  private _emit(type: MultiTransportEvent['type'], results?: DispatchResult[]): void {
    const snapshot = this.getSnapshot();
    for (const l of this._listeners) {
      try { l({ type, aggregateId: this.aggregateId, snapshot, results }); }
      catch (e) { logger.warn('[MultiTransportLink] listener threw', e); }
    }
  }
}
