/**
 * ─── Art-Net Bridge — Art-Net 4 via WebSocket ───────────────────────
 * Sends/receives Art-Net packets through a WebSocket relay.
 * Supports ArtDmx (data), ArtPoll (discovery), and ArtSync.
 *
 * Architecture: Browser → WebSocket → Art-Net Node (bridge) → DMX Universe
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

class ArtNetBridge {
  private _ws: WebSocket | null = null;
  private _state: ArtNetState = 'disconnected';
  private _sequence = 0;
  private _nodes: ArtNetNode[] = [];
  private _packetsSent = 0;
  private _packetsReceived = 0;
  private _listeners = new Set<(state: ArtNetState) => void>();

  /** Connect to Art-Net WebSocket relay. */
  connect(wsUrl: string): void {
    if (this._ws) this.disconnect();

    this._state = 'connecting';
    this._notify();

    try {
      this._ws = new WebSocket(wsUrl);

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
    this._notify();
  }

  /** Send DMX data to a universe. */
  sendDmx(universe: number, channels: Uint8Array): void {
    if (this._state !== 'connected' || !this._ws) return;

    const packet: ArtNetPacket = {
      opCode: 'ArtDmx',
      universe,
      sequence: this._nextSequence(),
      data: channels,
      timestamp: Date.now(),
    };

    this._ws.send(JSON.stringify({
      op: 'ArtDmx',
      uni: universe,
      seq: packet.sequence,
      data: Array.from(channels),
    }));

    this._packetsSent++;
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
  getStats() {
    return { sent: this._packetsSent, received: this._packetsReceived, nodes: this._nodes.length };
  }
}

export const artNetBridge = new ArtNetBridge();
