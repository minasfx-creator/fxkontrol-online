/**
 * ─── MultiTransport Registry — Singleton dispatcher pool ───────────
 * One `MultiTransportLink` per PhysicalDevice. Lazily created on
 * first request, hydrated with the persisted `linkMode` from
 * `portRegistry`, and torn down when the underlying aggregate is
 * removed.
 */

import { deviceAggregator } from './DeviceAggregator';
import { MultiTransportLink } from './MultiTransportLink';
import { portRegistry, keyFor } from './portRegistry';
import type {
  LinkMode,
  MultiTransportEvent,
  MultiTransportLinkSnapshot,
  PhysicalDevice,
  PhysicalDeviceEvent,
} from './types';
import { logger } from '@/lib/logger';

type Listener = (event: MultiTransportEvent) => void;

class MultiTransportRegistry {
  private _links = new Map<string, MultiTransportLink>();
  private _listeners = new Set<Listener>();
  private _started = false;

  start(): void {
    if (this._started) return;
    this._started = true;
    // Cleanup links when aggregates are removed.
    deviceAggregator.watch((ev: PhysicalDeviceEvent) => {
      if (ev.type === 'removed') {
        const link = this._links.get(ev.device.aggregateId);
        if (link) {
          link.destroy();
          this._links.delete(ev.device.aggregateId);
        }
      }
    });
    logger.info('[multiTransportRegistry] started');
  }

  getOrCreate(aggregateId: string): MultiTransportLink {
    this.start();
    let link = this._links.get(aggregateId);
    if (link) return link;

    const initialMode = this._loadPersistedMode(aggregateId);
    link = new MultiTransportLink(aggregateId, initialMode);
    // Bridge link events to registry listeners.
    link.watch((ev) => {
      for (const l of this._listeners) {
        try { l(ev); } catch (e) { logger.warn('[multiTransportRegistry] listener', e); }
      }
    });
    this._links.set(aggregateId, link);
    return link;
  }

  setMode(aggregateId: string, mode: LinkMode): void {
    this.getOrCreate(aggregateId).setMode(mode);
  }

  getSnapshot(aggregateId: string): MultiTransportLinkSnapshot | undefined {
    return this._links.get(aggregateId)?.getSnapshot();
  }

  watch(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  list(): MultiTransportLink[] {
    return [...this._links.values()];
  }

  private _loadPersistedMode(aggregateId: string): LinkMode {
    const dev = deviceAggregator.getDevice(aggregateId);
    if (!dev) return 'single';
    const key = this._registryKeyFor(dev);
    if (!key) return 'single';
    return portRegistry.getLinkMode(key) ?? 'single';
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
}

export const multiTransportRegistry = new MultiTransportRegistry();
