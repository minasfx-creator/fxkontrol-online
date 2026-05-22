import { artNetBridge } from '@/core/protocols/ArtNetBridge';

export const ARTNET_DEFAULT_LATENCY_MS = 8;
export const ARTNET_CHANNELS_PER_UNIVERSE = 512;
export const ARTNET_MAX_UNIVERSE = 32767;

export interface ArtNetChannelUpdate {
  channel: number;
  value: number;
}

export interface ArtNetRangeUpdate {
  startChannel: number;
  values: number[];
}

export interface ArtNetScheduledPayload {
  universe: number;
  updates?: ArtNetChannelUpdate[];
  ranges?: ArtNetRangeUpdate[];
}

export interface ArtNetFlushStats {
  sentUniverses: number;
  dirtyUniverses: number;
}

export class ArtNetTransport {
  private readonly universes = new Map<number, Uint8Array>();
  private readonly dirtyUniverses = new Set<number>();

  enqueue(payload: ArtNetScheduledPayload): void {
    if (!Number.isInteger(payload.universe) || payload.universe < 0 || payload.universe > ARTNET_MAX_UNIVERSE) {
      return;
    }

    const buffer = this.getUniverseBuffer(payload.universe);

    for (const update of payload.updates ?? []) {
      if (update.channel < 1 || update.channel > ARTNET_CHANNELS_PER_UNIVERSE) continue;
      buffer[update.channel - 1] = clampDmxValue(update.value);
      this.dirtyUniverses.add(payload.universe);
    }

    for (const range of payload.ranges ?? []) {
      for (let i = 0; i < range.values.length; i++) {
        const channel = range.startChannel + i;
        if (channel < 1 || channel > ARTNET_CHANNELS_PER_UNIVERSE) continue;
        buffer[channel - 1] = clampDmxValue(range.values[i]);
        this.dirtyUniverses.add(payload.universe);
      }
    }
  }

  flush(): ArtNetFlushStats {
    let sentUniverses = 0;

    for (const universe of this.dirtyUniverses) {
      const buffer = this.universes.get(universe);
      if (!buffer) continue;
      artNetBridge.sendDmx(universe, buffer);
      sentUniverses++;
    }

    const stats: ArtNetFlushStats = {
      sentUniverses,
      dirtyUniverses: this.dirtyUniverses.size,
    };

    this.dirtyUniverses.clear();
    return stats;
  }

  reset(): void {
    this.universes.clear();
    this.dirtyUniverses.clear();
  }

  getUniverseSnapshot(universe: number): Uint8Array {
    return new Uint8Array(this.getUniverseBuffer(universe));
  }

  private getUniverseBuffer(universe: number): Uint8Array {
    const existing = this.universes.get(universe);
    if (existing) return existing;

    const created = new Uint8Array(ARTNET_CHANNELS_PER_UNIVERSE);
    this.universes.set(universe, created);
    return created;
  }
}

function clampDmxValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

export const artNetTransport = new ArtNetTransport();