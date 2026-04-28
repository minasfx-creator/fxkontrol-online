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
        try {
          const send = transportSenderRegistry.getSender(t);
          await send(dev, stamped);
          const latency = performance.now() - t0;
          this._recordOk(t, latency);
          return { transport: t, ok: true, latencyMs: latency };
        } catch (e) {
          const latency = performance.now() - t0;
          const msg = e instanceof Error ? e.message : String(e);
          this._recordErr(t, latency, msg);
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
      ev.type === 'link-lost' ||
      ev.type === 'promoted' ||
      ev.type === 'added'
    ) {
      const before = this._participants.join(',');
      this._recomputeParticipants();
      if (this._participants.join(',') !== before) {
        this._emit('participants-changed');
      }
    }
  }

  private _recomputeParticipants(): void {
    const dev = this.getDevice();
    if (!dev) {
      this._participants = [];
      return;
    }
    const onlineLinks = PRIORITY.filter((t) => dev.links[t]?.online);

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

    // Ensure health entry exists for every participant.
    for (const t of this._participants) this._ensureHealth(t);
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
    h.lastAt = Date.now();
    h.lastError = undefined;
    h.status = 'ok';
    h.latencyMs = h.latencyMs === 0
      ? latencyMs
      : EMA_ALPHA * latencyMs + (1 - EMA_ALPHA) * h.latencyMs;
    this._totalTxOk += 1;
  }

  private _recordErr(transport: DiscoveryTransport, latencyMs: number, error: string): void {
    const h = this._ensureHealth(transport);
    h.txErr += 1;
    h.lastAt = Date.now();
    h.lastError = error;
    h.status = 'fail';
    // Still update EMA so failing-fast stubs don't skew latency to 0.
    h.latencyMs = h.latencyMs === 0
      ? latencyMs
      : EMA_ALPHA * latencyMs + (1 - EMA_ALPHA) * h.latencyMs;
    this._totalTxErr += 1;
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
