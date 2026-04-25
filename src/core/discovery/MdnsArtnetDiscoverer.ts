/**
 * ─── Art-Net Discoverer (network) ──────────────────────────────────
 * Browsers cannot do raw mDNS or UDP, so discovery proxies through the
 * existing `artnet-bridge` edge function (action: 'poll'). The function
 * sends an ArtPoll broadcast on the operator's behalf and returns
 * ArtPollReply records (shortName, longName, oem, port count, ip).
 *
 * Failures (function unreachable, no nodes responding) degrade gracefully:
 * the discoverer reports `unsupported` instead of throwing, so the
 * unified service keeps the rest of the discovery operational.
 */

import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import type { DiscoveredDevice, DiscoveryEvent, TransportDiscoverer } from './types';

interface ArtPollReplyRecord {
  ip: string;
  shortName?: string;
  longName?: string;
  oem?: number;
  portCount?: number;
  mac?: string;
}

class MdnsArtnetDiscoverer implements TransportDiscoverer {
  readonly id = 'mdns-artnet' as const;
  private _devices = new Map<string, DiscoveredDevice>();
  private _listeners = new Set<(ev: DiscoveryEvent) => void>();
  /** Disabled by default — only runs when operator hits "Deep Scan". */
  private _supportedFlag = true;

  isSupported(): boolean { return this._supportedFlag; }

  async scan(): Promise<DiscoveredDevice[]> {
    try {
      const { data, error } = await supabase.functions.invoke('artnet-bridge', {
        body: { action: 'poll' },
      });
      if (error) throw error;
      const replies: ArtPollReplyRecord[] = Array.isArray(data?.replies) ? data.replies : [];
      const seen = new Set<string>();
      for (const r of replies) {
        const id = `mdns-artnet:${r.ip}`;
        seen.add(id);
        const dev: DiscoveredDevice = {
          id,
          transport: 'mdns-artnet',
          label: r.longName?.trim() || r.shortName?.trim() || `Art-Net node ${r.ip}`,
          host: r.ip,
          recognized: true,
          authorized: true,
          online: true,
          family: 'artnet-node',
          lastSeen: Date.now(),
          metadata: { oem: r.oem, portCount: r.portCount, mac: r.mac },
        };
        const prev = this._devices.get(id);
        this._devices.set(id, dev);
        this._emit({ type: prev ? 'updated' : 'discovered', device: dev });
      }
      for (const [id, dev] of this._devices) {
        if (!seen.has(id)) {
          this._devices.delete(id);
          this._emit({ type: 'lost', device: { ...dev, online: false } });
        }
      }
      return this.getDevices();
    } catch (e) {
      logger.info('[MdnsArtnetDiscoverer] poll unavailable', e);
      // Mark as unsupported for this session so the UI hides the column.
      this._supportedFlag = false;
      return this.getDevices();
    }
  }

  watch(listener: (ev: DiscoveryEvent) => void): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  getDevices(): DiscoveredDevice[] {
    return Array.from(this._devices.values());
  }

  private _emit(ev: DiscoveryEvent): void {
    for (const fn of this._listeners) {
      try { fn(ev); } catch (e) { logger.warn('[MdnsArtnetDiscoverer] listener err', e); }
    }
  }
}

export const mdnsArtnetDiscoverer = new MdnsArtnetDiscoverer();
