/**
 * sACN (E1.31) Streaming ACN Engine
 * Implements sACN universe streaming over WebSocket bridge
 * Used for grandMA3 → editor DMX data reception (up to 63,999 universes)
 *
 * sACN packet structure follows ANSI E1.31-2018:
 * - Root Layer (ACN root)
 * - Framing Layer (universe, priority, sequence)
 * - DMP Layer (512 channels of data)
 */

export interface SACNUniverse {
  universe: number;
  priority: number;
  sequence: number;
  channels: Uint8Array; // 512 bytes
  sourceName: string;
  lastUpdate: number;
  fps: number;
}

export interface SACNConfig {
  bridgeUrl: string;         // WebSocket bridge for sACN UDP relay
  universes: number[];       // Universes to subscribe to
  mergeMode: 'HTP' | 'LTP'; // Highest Takes Precedence or Latest Takes Precedence
}

export type SACNConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type SACNListener = (universe: number, channels: Uint8Array, sourceName: string) => void;

export class SACNReceiver {
  private ws: WebSocket | null = null;
  private config: SACNConfig;
  private universeData: Map<number, SACNUniverse> = new Map();
  private listeners: Set<SACNListener> = new Set();
  private _state: SACNConnectionState = 'disconnected';
  private frameCounters: Map<number, { count: number; lastReset: number }> = new Map();

  constructor(config: Partial<SACNConfig> = {}) {
    this.config = {
      bridgeUrl: config.bridgeUrl || 'ws://localhost:9003',
      universes: config.universes || [1],
      mergeMode: config.mergeMode || 'HTP',
    };
  }

  get state() { return this._state; }
  get subscribedUniverses() { return Array.from(this.universeData.values()); }

  getUniverse(num: number): SACNUniverse | undefined {
    return this.universeData.get(num);
  }

  getChannelValue(universe: number, channel: number): number {
    const u = this.universeData.get(universe);
    if (!u || channel < 1 || channel > 512) return 0;
    return u.channels[channel - 1];
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._state = 'connecting';
      try {
        this.ws = new WebSocket(this.config.bridgeUrl);
        this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
          this._state = 'connected';
          // Subscribe to universes
          this.ws!.send(JSON.stringify({
            type: 'subscribe',
            universes: this.config.universes,
          }));
          resolve();
        };

        this.ws.onmessage = (ev) => {
          if (ev.data instanceof ArrayBuffer) {
            this.handleSACNData(new Uint8Array(ev.data));
          } else if (typeof ev.data === 'string') {
            try {
              const json = JSON.parse(ev.data);
              if (json.type === 'sacn_data') {
                const channels = new Uint8Array(json.channels);
                this.processUniverseData(json.universe, channels, json.sourceName || 'MA3', json.priority || 100, json.sequence || 0);
              }
            } catch { /* ignore */ }
          }
        };

        this.ws.onerror = () => {
          this._state = 'error';
          reject(new Error('sACN bridge connection failed'));
        };

        this.ws.onclose = () => { this._state = 'disconnected'; };
      } catch (err) {
        this._state = 'error';
        reject(err);
      }
    });
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
    this._state = 'disconnected';
    this.universeData.clear();
  }

  private handleSACNData(data: Uint8Array) {
    // Minimal E1.31 packet parsing
    if (data.length < 126) return;

    // Check ACN root layer preamble
    if (data[0] !== 0x00 || data[1] !== 0x10) return;

    // Extract universe from framing layer (bytes 113-114, big-endian)
    const universe = (data[113] << 8) | data[114];

    // Source name (bytes 44-107, null-terminated UTF-8)
    let sourceEnd = 44;
    while (sourceEnd < 108 && data[sourceEnd] !== 0) sourceEnd++;
    const sourceName = new TextDecoder().decode(data.subarray(44, sourceEnd));

    // Priority (byte 108)
    const priority = data[108];

    // Sequence (byte 111)
    const sequence = data[111];

    // DMP data starts at byte 126
    const channels = data.subarray(126, Math.min(126 + 512, data.length));

    this.processUniverseData(universe, channels, sourceName, priority, sequence);
  }

  private processUniverseData(universe: number, channels: Uint8Array, sourceName: string, priority: number, sequence: number) {
    // FPS tracking
    const counter = this.frameCounters.get(universe) || { count: 0, lastReset: Date.now() };
    counter.count++;
    const elapsed = Date.now() - counter.lastReset;
    let fps = 0;
    if (elapsed >= 1000) {
      fps = Math.round(counter.count * 1000 / elapsed);
      counter.count = 0;
      counter.lastReset = Date.now();
    } else {
      fps = this.universeData.get(universe)?.fps || 0;
    }
    this.frameCounters.set(universe, counter);

    const existing = this.universeData.get(universe);
    let mergedChannels = new Uint8Array(512);

    if (existing && this.config.mergeMode === 'HTP') {
      // HTP merge
      for (let i = 0; i < 512; i++) {
        mergedChannels[i] = Math.max(existing.channels[i] || 0, channels[i] || 0);
      }
    } else {
      mergedChannels.set(channels);
    }

    this.universeData.set(universe, {
      universe,
      priority,
      sequence,
      channels: mergedChannels,
      sourceName,
      lastUpdate: Date.now(),
      fps,
    });

    this.listeners.forEach(l => l(universe, mergedChannels, sourceName));
  }

  subscribe(universes: number[]) {
    this.config.universes = [...new Set([...this.config.universes, ...universes])];
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', universes: this.config.universes }));
    }
  }

  unsubscribe(universes: number[]) {
    this.config.universes = this.config.universes.filter(u => !universes.includes(u));
    universes.forEach(u => this.universeData.delete(u));
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', universes }));
    }
  }

  on(listener: SACNListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

// Singleton
let _sacnReceiver: SACNReceiver | null = null;
export function getSACNReceiver(): SACNReceiver {
  if (!_sacnReceiver) _sacnReceiver = new SACNReceiver();
  return _sacnReceiver;
}
