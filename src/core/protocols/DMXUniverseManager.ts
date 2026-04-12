/**
 * ─── DMX Universe Manager ───────────────────────────────────────────
 * Manages multiple DMX universes with HTP/LTP merge and priority.
 * Separated from UI layout — this is the operational protocol layer.
 */

import { artNetBridge } from './ArtNetBridge';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

export type MergeMode = 'HTP' | 'LTP';

export interface UniverseConfig {
  id: number;              // Universe number (0-based Art-Net)
  label: string;
  channelCount: number;    // Typically 512
  mergeMode: MergeMode;
  priority: number;        // 0-200 (sACN priority)
  outputEnabled: boolean;
}

class DMXUniverseManager {
  private _universes = new Map<number, UniverseConfig>();
  private _buffers = new Map<number, Uint8Array>();
  private _dirty = new Set<number>();

  /** Register a universe. */
  addUniverse(config: UniverseConfig): void {
    this._universes.set(config.id, config);
    this._buffers.set(config.id, new Uint8Array(config.channelCount));
    blackbox.record('net', `DMXUniverse: added universe ${config.id} "${config.label}" (${config.mergeMode})`);
  }

  /** Remove a universe. */
  removeUniverse(id: number): void {
    this._universes.delete(id);
    this._buffers.delete(id);
    this._dirty.delete(id);
  }

  /** Set a single channel value (1-indexed, DMX convention). */
  setChannel(universe: number, channel: number, value: number): void {
    const buf = this._buffers.get(universe);
    if (!buf || channel < 1 || channel > buf.length) return;
    buf[channel - 1] = Math.max(0, Math.min(255, value));
    this._dirty.add(universe);
  }

  /** Set multiple channels at once. */
  setChannels(universe: number, startChannel: number, values: number[]): void {
    const buf = this._buffers.get(universe);
    if (!buf) return;
    for (let i = 0; i < values.length; i++) {
      const ch = startChannel + i - 1;
      if (ch >= 0 && ch < buf.length) {
        buf[ch] = Math.max(0, Math.min(255, values[i]));
      }
    }
    this._dirty.add(universe);
  }

  /** HTP merge: take highest value per channel. */
  mergeHTP(universe: number, incoming: Uint8Array): void {
    const buf = this._buffers.get(universe);
    if (!buf) return;
    for (let i = 0; i < Math.min(buf.length, incoming.length); i++) {
      buf[i] = Math.max(buf[i], incoming[i]);
    }
    this._dirty.add(universe);
  }

  /** Flush all dirty universes to Art-Net. */
  flush(): void {
    for (const uniId of this._dirty) {
      const config = this._universes.get(uniId);
      const buf = this._buffers.get(uniId);
      if (!config || !buf || !config.outputEnabled) continue;
      artNetBridge.sendDmx(uniId, buf);
    }
    this._dirty.clear();
  }

  /** Blackout a universe (all channels to 0). */
  blackout(universe: number): void {
    const buf = this._buffers.get(universe);
    if (buf) {
      buf.fill(0);
      this._dirty.add(universe);
      blackbox.record('cmd', `DMXUniverse: blackout universe ${universe}`);
    }
  }

  /** Blackout all universes. */
  blackoutAll(): void {
    for (const id of this._universes.keys()) {
      this.blackout(id);
    }
    this.flush();
  }

  /** Get channel buffer for a universe (read-only). */
  getBuffer(universe: number): Readonly<Uint8Array> | null {
    return this._buffers.get(universe) ?? null;
  }

  getUniverses(): UniverseConfig[] {
    return Array.from(this._universes.values());
  }

  getUniverseCount(): number { return this._universes.size; }
}

export const dmxUniverseManager = new DMXUniverseManager();
