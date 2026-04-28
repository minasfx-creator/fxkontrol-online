/**
 * ─── Device Aggregator — Multi-Transport Identity Layer ────────────
 * Sits on top of `unifiedDiscovery` and groups every `DiscoveredDevice`
 * link that points to the same physical hardware into a single
 * `PhysicalDevice`. Provides:
 *
 *   • Stable cross-transport identity (see aggregateKey.ts)
 *   • Active-transport selection with operator preference + auto fallback
 *   • Promotion event when the active link goes offline
 *   • Persistence of preferredTransport via portRegistry
 *
 * Read-only by design — no I/O, no side effects on the discovery pipeline.
 * Purely a downstream observer.
 */

import { logger } from '@/lib/logger';
import { unifiedDiscovery } from './UnifiedDiscoveryService';
import { aggregateKeyFor } from './aggregateKey';
import { portRegistry, keyFor, aliasCandidatesFor } from './portRegistry';
import type {
  DiscoveredDevice,
  DiscoveryEvent,
  DiscoveryTransport,
  PhysicalDevice,
  PhysicalDeviceEvent,
} from './types';

/** Default transport priority — serial first (most deterministic for DMX/PBUS). */
const DEFAULT_PRIORITY: DiscoveryTransport[] = [
  'webserial',
  'webusb',
  'webble',
  'mdns-artnet',
];

type Listener = (event: PhysicalDeviceEvent) => void;

class DeviceAggregator {
  private _devices = new Map<string, PhysicalDevice>();
  /** Reverse index: per-link DiscoveredDevice.id → aggregateId */
  private _linkIndex = new Map<string, string>();
  private _listeners = new Set<Listener>();
  private _started = false;
  private _unsubDiscovery: (() => void) | null = null;

  /** Lazy bootstrap. Idempotent. */
  start(): void {
    if (this._started) return;
    this._started = true;

    // Seed from current snapshot.
    for (const d of unifiedDiscovery.getDevices()) {
      this._ingest({ type: 'discovered', device: d }, /*silent*/ true);
    }

    this._unsubDiscovery = unifiedDiscovery.watch((ev) => this._ingest(ev, false));
    logger.info('[DeviceAggregator] started — tracking', this._devices.size, 'physical device(s)');
  }

  stop(): void {
    if (!this._started) return;
    this._unsubDiscovery?.();
    this._unsubDiscovery = null;
    this._started = false;
  }

  watch(listener: Listener): () => void {
    this.start();
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  getDevices(): PhysicalDevice[] {
    this.start();
    return [...this._devices.values()].sort((a, b) => b.lastSeen - a.lastSeen);
  }

  getDevice(aggregateId: string): PhysicalDevice | undefined {
    this.start();
    return this._devices.get(aggregateId);
  }

  /**
   * Pin a preferred transport for an aggregate. Persists to portRegistry
   * (when a stable VID:PID/host registry key is available) and immediately
   * promotes the chosen transport when it's online.
   */
  setPreferredTransport(aggregateId: string, transport: DiscoveryTransport): PhysicalDevice | undefined {
    const dev = this._devices.get(aggregateId);
    if (!dev) return undefined;

    dev.preferredTransport = transport;

    // Persist when we have stable identifiers.
    const regKey = this._registryKeyFor(dev);
    if (regKey) {
      try {
        portRegistry.setPreferredTransport(regKey, transport, dev.label);
      } catch (e) {
        logger.warn('[DeviceAggregator] persist preferred transport failed', e);
      }
    }

    // If preferred link is online, promote immediately.
    const link = dev.links[transport];
    if (link?.online && dev.activeTransport !== transport) {
      const previousActive = dev.activeTransport;
      dev.activeTransport = transport;
      dev.lastPromotion = {
        from: previousActive,
        to: transport,
        at: Date.now(),
        reason: 'preference-applied',
      };
      this._emit({ type: 'promoted', device: dev, transport, previousActive });
    }
    return dev;
  }

  clearPreferredTransport(aggregateId: string): void {
    const dev = this._devices.get(aggregateId);
    if (!dev) return;
    dev.preferredTransport = null;
    const regKey = this._registryKeyFor(dev);
    if (regKey) {
      try { portRegistry.clearPreferredTransport(regKey); } catch { /* noop */ }
    }
  }

  // ─── Internals ─────────────────────────────────────────────────

  private _ingest(ev: DiscoveryEvent, silent: boolean): void {
    const link = ev.device;
    const aggId = aggregateKeyFor(link);
    const now = Date.now();

    if (ev.type === 'lost') {
      const existingAggId = this._linkIndex.get(link.id) ?? aggId;
      const dev = this._devices.get(existingAggId);
      if (!dev) return;
      const lostTransport = link.transport;
      // Mark link offline rather than removing — operator may want to see it.
      const existing = dev.links[lostTransport];
      if (existing) {
        dev.links[lostTransport] = { ...existing, online: false, lastSeen: now };
      }
      dev.online = Object.values(dev.links).some((l) => l?.online);
      dev.lastSeen = now;
      if (!silent) this._emit({ type: 'link-lost', device: dev, transport: lostTransport });

      if (dev.activeTransport === lostTransport) {
        this._promoteOnLoss(dev, lostTransport, silent);
      }

      // If no link remains, drop the aggregate.
      if (Object.keys(dev.links).length === 0) {
        this._devices.delete(existingAggId);
        this._linkIndex.delete(link.id);
        if (!silent) this._emit({ type: 'removed', device: dev });
      }
      return;
    }

    // discovered / updated
    let dev = this._devices.get(aggId);
    const isNewAggregate = !dev;
    if (!dev) {
      dev = {
        aggregateId: aggId,
        label: link.label || link.id,
        vendorId: link.vendorId,
        productId: link.productId,
        host: link.host,
        serialNumber: this._extractSerial(link),
        links: {},
        activeTransport: null,
        preferredTransport: null,
        online: false,
        firstSeen: now,
        lastSeen: now,
      };
      // Hydrate preferred transport from persisted registry.
      const regKey = this._registryKeyFor(dev);
      if (regKey) {
        const pref = portRegistry.getPreferredTransport(regKey);
        if (pref) dev.preferredTransport = pref;
      }
      this._devices.set(aggId, dev);
    }

    const isNewLink = !dev.links[link.transport];
    dev.links[link.transport] = link;
    this._linkIndex.set(link.id, aggId);

    // Promote label / metadata when richer info arrives.
    if (link.label && link.label.length > dev.label.length) dev.label = link.label;
    dev.vendorId = dev.vendorId ?? link.vendorId;
    dev.productId = dev.productId ?? link.productId;
    dev.host = dev.host ?? link.host;
    const serial = this._extractSerial(link);
    if (serial && !dev.serialNumber) dev.serialNumber = serial;
    dev.online = Object.values(dev.links).some((l) => l?.online);
    dev.lastSeen = now;

    // Pick active transport.
    const previousActive = dev.activeTransport;
    const desired = this._chooseActive(dev);
    if (desired !== previousActive) {
      dev.activeTransport = desired;
      if (desired) {
        dev.lastPromotion = {
          from: previousActive,
          to: desired,
          at: now,
          reason: previousActive === null ? 'initial' : 'preference-applied',
        };
      }
    }

    // Persist cross-transport identity unification — collapses duplicate
    // portRegistry entries when the same physical device is touched via
    // multiple transports (Web Serial + WebUSB, BLE + USB, etc.).
    if (isNewAggregate || isNewLink) {
      this._unifyRegistryAliases(dev);
    }

    if (silent) return;

    if (isNewAggregate) {
      this._emit({ type: 'added', device: dev });
    } else if (isNewLink) {
      this._emit({ type: 'link-added', device: dev, transport: link.transport });
    } else {
      this._emit({ type: 'link-updated', device: dev, transport: link.transport });
    }

    if (desired !== previousActive && desired) {
      this._emit({ type: 'promoted', device: dev, transport: desired, previousActive });
    }
  }

  private _promoteOnLoss(
    dev: PhysicalDevice,
    lostTransport: DiscoveryTransport,
    silent: boolean,
  ): void {
    const previousActive = dev.activeTransport;
    const next = this._chooseActive(dev, /*excludeOffline*/ true);
    dev.activeTransport = next;
    if (next && next !== previousActive) {
      dev.lastPromotion = {
        from: lostTransport,
        to: next,
        at: Date.now(),
        reason: 'link-lost',
      };
      if (!silent) this._emit({ type: 'promoted', device: dev, transport: next, previousActive });
    }
  }

  private _chooseActive(
    dev: PhysicalDevice,
    excludeOffline = false,
  ): DiscoveryTransport | null {
    const isCandidate = (t: DiscoveryTransport): boolean => {
      const l = dev.links[t];
      if (!l) return false;
      if (excludeOffline && !l.online) return false;
      return true;
    };

    // Honor explicit preference when its link is present (and online if required).
    if (dev.preferredTransport && isCandidate(dev.preferredTransport)) {
      return dev.preferredTransport;
    }
    // Otherwise priority-order pick.
    for (const t of DEFAULT_PRIORITY) {
      if (isCandidate(t)) return t;
    }
    // Fallback: any link, even offline, to keep UI stable.
    for (const t of DEFAULT_PRIORITY) {
      if (dev.links[t]) return t;
    }
    return null;
  }

  private _extractSerial(d: DiscoveredDevice): string | undefined {
    const meta = (d.metadata ?? {}) as Record<string, unknown>;
    return typeof meta.serialNumber === 'string' ? meta.serialNumber : undefined;
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

  private _emit(ev: PhysicalDeviceEvent): void {
    for (const l of this._listeners) {
      try { l(ev); } catch (e) { logger.warn('[DeviceAggregator] listener threw', e); }
    }
  }
}

export const deviceAggregator = new DeviceAggregator();
