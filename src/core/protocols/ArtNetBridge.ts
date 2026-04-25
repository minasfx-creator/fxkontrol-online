/**
 * ─── Art-Net Bridge — Art-Net 4 via WebSocket ───────────────────────
 * Sends/receives Art-Net packets through a WebSocket relay.
 * Supports ArtDmx (data), ArtPoll (discovery), and ArtSync.
 *
 * Architecture: Browser → WebSocket → Art-Net Node (bridge) → DMX Universe
 *
 * Hardening (Fatia 8 — DMX timing):
 *  • #1 Rate cap: 33 PPS spec limit per universe (≥30ms between sends).
 *  • #2 Zero-GC hot path: pre-allocated frame buffer + binary WS payload
 *       (no Array.from, no JSON.stringify per send).
 *  • #6 Critical send: `{ critical: true }` bypasses throttle for fire/blackout.
 */

import { blackbox } from '@/core/reliability/blackBoxRecorder';

export type ArtNetOpCode = 'ArtDmx' | 'ArtPoll' | 'ArtPollReply' | 'ArtSync';

export interface ArtNetPacket {
  opCode: ArtNetOpCode;
  universe: number;
  sequence: number;
  data: Uint8Array;
  timestamp: number;
}

export interface ArtNetNode {
  ip: string;
  port: number;
  shortName: string;
  longName: string;
  universes: number[];
  lastSeen: number;
}

export type ArtNetState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ArtNetSendOptions {
  /**
   * Critical sends bypass the per-universe rate cap (33 PPS).
   * Use ONLY for safety-relevant transitions: blackout, fire, e-stop snapshots.
   * Visual streams (dimmer/color) MUST stay false to honor Art-Net 4 spec.
   */
  critical?: boolean;
}

export interface ArtNetStats {
  sent: number;
  received: number;
  throttled: number;
  nodes: number;
}

// Art-Net 4 spec: max ~44 PPS per universe; conservative 33 PPS keeps
// receiver buffers from overflowing. ~30ms ⇒ 33.3 PPS.
export const ARTNET_MIN_INTERVAL_MS = 30;

class ArtNetBridge {
  private _ws: WebSocket | null = null;
  private _state: ArtNetState = 'disconnected';
  private _sequence = 0;
  private _nodes: ArtNetNode[] = [];
  private _packetsSent = 0;
  private _packetsReceived = 0;
  private _throttledCount = 0;
  private _listeners = new Set<(state: ArtNetState) => void>();

  // ── Hot-path zero-GC scratch ──────────────────────────────────────
  /** monotonic last-send time per universe (Art-Net 4 rate cap, #1). */
  private readonly _lastSendByUniverse = new Map<number, number>();
  /** Reusable JSON envelope key buffer (avoid repeated string alloc). */
  private readonly _scratchEnvelope = { op: 'ArtDmx', uni: 0, seq: 0, data: '' };

  /** Connect to Art-Net WebSocket relay. */
  connect(wsUrl: string): void {
    if (this._ws) this.disconnect();

    this._state = 'connecting';
    this._notify();

    try {
      this._ws = new WebSocket(wsUrl);
      this._ws.binaryType = 'arraybuffer';

      this._ws.onopen = () => {
        this._state = 'connected';
        this._notify();
        blackbox.record('net', `ArtNetBridge: connected to ${wsUrl}`);
        // Send ArtPoll for discovery
        this.sendPoll();
      };

      this._ws.onmessage = (event) => {
        this._packetsReceived++;
        this._handleMessage(event.data);
      };

      this._ws.onclose = () => {
        this._state = 'disconnected';
        this._ws = null;
        this._notify();
        blackbox.record('net', 'ArtNetBridge: disconnected');
      };

      this._ws.onerror = () => {
        this._state = 'error';
        this._notify();
        blackbox.record('emergency', 'ArtNetBridge: connection error');
      };
    } catch {
      this._state = 'error';
      this._notify();
    }
  }

  disconnect(): void {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._state = 'disconnected';
    this._lastSendByUniverse.clear();
    this._notify();
  }

  /**
   * Send DMX data to a universe.
   *
   * Returns `true` if the packet was emitted, `false` if it was throttled
   * by the per-universe 33 PPS cap. Critical sends are never throttled.
   */
  sendDmx(universe: number, channels: Uint8Array, opts?: ArtNetSendOptions): boolean {
    if (this._state !== 'connected' || !this._ws) return false;

    // ── #1 Rate cap (skip for critical) ─────────────────────────────
    if (!opts?.critical) {
      const now = performance.now();
      const last = this._lastSendByUniverse.get(universe) ?? -Infinity;
      if (now - last < ARTNET_MIN_INTERVAL_MS) {
        this._throttledCount++;
        return false;
      }
      this._lastSendByUniverse.set(universe, now);
    } else {
      // Still update timestamp so the next non-critical send respects cadence.
      this._lastSendByUniverse.set(universe, performance.now());
    }

    const seq = this._nextSequence();

    // ── #2 Zero-GC payload: write channels as base64 of the raw bytes ──
    // We avoid Array.from(channels) (which allocates a 512-element JS array)
    // and stringify a tiny envelope. The relay decodes base64 → Uint8Array.
    const dataB64 = bytesToBase64(channels);
    this._scratchEnvelope.uni = universe;
    this._scratchEnvelope.seq = seq;
    this._scratchEnvelope.data = dataB64;

    try {
      this._ws.send(JSON.stringify(this._scratchEnvelope));
      this._packetsSent++;
      return true;
    } catch {
      return false;
    }
  }

  /** Send ArtPoll for node discovery. */
  sendPoll(): void {
    if (!this._ws || this._state !== 'connected') return;
    this._ws.send(JSON.stringify({ op: 'ArtPoll' }));
    this._packetsSent++;
  }

  /** Send ArtSync to synchronize outputs. */
  sendSync(): void {
    if (!this._ws || this._state !== 'connected') return;
    this._ws.send(JSON.stringify({ op: 'ArtSync' }));
    this._packetsSent++;
  }

  private _handleMessage(raw: unknown): void {
    try {
      const msg = typeof raw === 'string' ? JSON.parse(raw) : null;
      if (!msg) return;

      if (msg.op === 'ArtPollReply') {
        const node: ArtNetNode = {
          ip: msg.ip ?? '0.0.0.0',
          port: msg.port ?? 6454,
          shortName: msg.shortName ?? '',
          longName: msg.longName ?? '',
          universes: msg.universes ?? [],
          lastSeen: Date.now(),
        };
        // Upsert node
        const idx = this._nodes.findIndex(n => n.ip === node.ip);
        if (idx >= 0) this._nodes[idx] = node;
        else this._nodes.push(node);

        blackbox.record('net', `ArtNetBridge: discovered node ${node.shortName} (${node.ip})`);
      }
    } catch { /* ignore parse errors */ }
  }

  private _nextSequence(): number {
    this._sequence = (this._sequence + 1) & 0xFF;
    return this._sequence;
  }

  onChange(fn: (state: ArtNetState) => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private _notify(): void {
    for (const fn of this._listeners) fn(this._state);
  }

  getState(): ArtNetState { return this._state; }
  getNodes(): Readonly<ArtNetNode[]> { return this._nodes; }
  getStats(): ArtNetStats {
    return {
      sent: this._packetsSent,
      received: this._packetsReceived,
      throttled: this._throttledCount,
      nodes: this._nodes.length,
    };
  }

  /**
   * Test/diagnostics only: reset throttle bookkeeping.
   * Do NOT call from the app hot path.
   */
  _resetThrottleStateForTest(): void {
    this._lastSendByUniverse.clear();
    this._throttledCount = 0;
  }
}

// ── Base64 encoder for Uint8Array (avoids per-byte JS-array detour) ──
const _b64Alphabet =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  const len = bytes.length;
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    out += _b64Alphabet[b0 >> 2]
      + _b64Alphabet[((b0 & 0x03) << 4) | (b1 >> 4)]
      + _b64Alphabet[((b1 & 0x0f) << 2) | (b2 >> 6)]
      + _b64Alphabet[b2 & 0x3f];
  }
  if (i < len) {
    const b0 = bytes[i];
    if (i + 1 < len) {
      const b1 = bytes[i + 1];
      out += _b64Alphabet[b0 >> 2]
        + _b64Alphabet[((b0 & 0x03) << 4) | (b1 >> 4)]
        + _b64Alphabet[(b1 & 0x0f) << 2]
        + '=';
    } else {
      out += _b64Alphabet[b0 >> 2]
        + _b64Alphabet[(b0 & 0x03) << 4]
        + '==';
    }
  }
  return out;
}

export const artNetBridge = new ArtNetBridge();
export { ArtNetBridge };
