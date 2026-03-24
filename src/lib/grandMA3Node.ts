/**
 * grandMA3 Passive Node — Bidirectional sACN / Art-Net 4 bridge.
 * Acts as a network node that can receive DMX data from grandMA3 consoles
 * and send show control commands back. Supports up to 32 universes multicast.
 *
 * Architecture:
 * - Receives: sACN (E1.31) / Art-Net via WebSocket relay bridge
 * - Sends: Art-Net 4 ArtDmx / ArtSync / ArtPoll replies
 * - Bidirectional: Can act as both input and output node simultaneously
 */

// ═══ Types ═══
export type MA3NodeMode = 'input' | 'output' | 'bidirectional';
export type MA3Protocol = 'artnet' | 'sacn';

export interface MA3Universe {
  id: number;
  net: number;
  subnet: number;
  universe: number;
  priority: number;
  mode: 'input' | 'output';
  buffer: Uint8Array;
  lastUpdate: number;
  pps: number; // packets per second
  active: boolean;
}

export interface MA3NodeConfig {
  mode: MA3NodeMode;
  protocol: MA3Protocol;
  relayUrl: string;           // WebSocket relay bridge URL
  nodeLabel: string;          // Node name visible on grandMA3 network
  universeCount: number;      // 1–32
  priority: number;           // sACN priority (0–200)
  syncMode: boolean;          // Art-Net Sync enabled
  rdmEnabled: boolean;        // Remote Device Management
  multicastGroup?: string;    // sACN multicast group
}

export interface MA3NodeState {
  connected: boolean;
  mode: MA3NodeMode;
  protocol: MA3Protocol;
  nodeLabel: string;
  universes: MA3Universe[];
  totalPPS: number;
  latencyMs: number;
  lastArtPoll: number;
  artSyncActive: boolean;
  errors: string[];
}

// ═══ Default configuration ═══
export const DEFAULT_MA3_CONFIG: MA3NodeConfig = {
  mode: 'bidirectional',
  protocol: 'artnet',
  relayUrl: 'ws://localhost:6455',
  nodeLabel: 'FXK-MA3-NODE',
  universeCount: 8,
  priority: 100,
  syncMode: true,
  rdmEnabled: false,
};

// ═══ Art-Net 4 packet constants ═══
const ARTNET_HEADER = [0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00]; // "Art-Net\0"
const ARTNET_OP_POLL       = 0x2000;
const ARTNET_OP_POLL_REPLY = 0x2100;
const ARTNET_OP_DMX        = 0x5000;
const ARTNET_OP_SYNC       = 0x5200;
const ARTNET_OP_RDM        = 0x8300;

// ═══ sACN E1.31 constants ═══
const SACN_VECTOR_ROOT = 0x00000004;
const SACN_VECTOR_DMP  = 0x02;

// ═══ grandMA3 Node Engine ═══
export class GrandMA3Node {
  private config: MA3NodeConfig;
  private state: MA3NodeState;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private ppsCounters: number[] = [];
  private ppsInterval: number | null = null;
  private latencyBuffer: number[] = [];
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  constructor(config: Partial<MA3NodeConfig> = {}) {
    this.config = { ...DEFAULT_MA3_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  private createInitialState(): MA3NodeState {
    const universes: MA3Universe[] = [];
    for (let i = 0; i < this.config.universeCount; i++) {
      universes.push({
        id: i,
        net: 0,
        subnet: Math.floor(i / 16),
        universe: i % 16,
        priority: this.config.priority,
        mode: this.config.mode === 'input' ? 'input' : this.config.mode === 'output' ? 'output' : (i < this.config.universeCount / 2 ? 'input' : 'output'),
        buffer: new Uint8Array(512),
        lastUpdate: 0,
        pps: 0,
        active: false,
      });
    }
    return {
      connected: false,
      mode: this.config.mode,
      protocol: this.config.protocol,
      nodeLabel: this.config.nodeLabel,
      universes,
      totalPPS: 0,
      latencyMs: 0,
      lastArtPoll: 0,
      artSyncActive: false,
      errors: [],
    };
  }

  // ═══ Connection Management ═══
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.config.relayUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.state.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connected', { label: this.config.nodeLabel });

        // Send ArtPoll to announce presence
        if (this.config.protocol === 'artnet') {
          this.sendArtPoll();
        }

        // Start PPS counter
        this.ppsInterval = window.setInterval(() => this.updatePPS(), 1000);
      };

      this.ws.onmessage = (ev) => this.handleMessage(ev);

      this.ws.onclose = () => {
        this.state.connected = false;
        this.emit('disconnected', null);
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        this.state.errors.push(`WebSocket error: ${String(err)}`);
        this.emit('error', { message: String(err) });
      };
    } catch (e) {
      this.state.errors.push(`Connection failed: ${String(e)}`);
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ppsInterval) clearInterval(this.ppsInterval);
    this.ws?.close();
    this.ws = null;
    this.state.connected = false;
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.state.errors.push('Max reconnect attempts reached');
      return;
    }
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts), 32000);
    this.reconnectAttempts++;
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  // ═══ Protocol Handling ═══
  private handleMessage(ev: MessageEvent): void {
    const startTime = performance.now();

    if (ev.data instanceof ArrayBuffer) {
      const data = new Uint8Array(ev.data);

      if (this.config.protocol === 'artnet') {
        this.handleArtNet(data);
      } else {
        this.handleSACN(data);
      }
    }

    // Track latency
    const latency = performance.now() - startTime;
    this.latencyBuffer.push(latency);
    if (this.latencyBuffer.length > 20) this.latencyBuffer.shift();
    this.state.latencyMs = this.latencyBuffer.reduce((a, b) => a + b, 0) / this.latencyBuffer.length;
  }

  private handleArtNet(data: Uint8Array): void {
    if (data.length < 12) return;

    // Verify Art-Net header
    const header = Array.from(data.slice(0, 8));
    if (header.join(',') !== ARTNET_HEADER.join(',')) return;

    const opCode = data[8] | (data[9] << 8);

    switch (opCode) {
      case ARTNET_OP_DMX:
        this.handleArtDmx(data);
        break;
      case ARTNET_OP_POLL:
        this.handleArtPollRequest(data);
        break;
      case ARTNET_OP_SYNC:
        this.state.artSyncActive = true;
        this.emit('sync', null);
        break;
      case ARTNET_OP_RDM:
        if (this.config.rdmEnabled) this.handleRDM(data);
        break;
    }
  }

  private handleArtDmx(data: Uint8Array): void {
    if (data.length < 18) return;

    const sequence = data[12];
    const physical = data[13];
    const subUni = data[14];
    const net = data[15];
    const lengthHi = data[16];
    const lengthLo = data[17];
    const dmxLength = (lengthHi << 8) | lengthLo;

    const universeIdx = subUni + (net * 256);
    const universe = this.state.universes.find(u => u.id === universeIdx);

    if (universe && universe.mode === 'input') {
      const dmxData = data.slice(18, 18 + Math.min(dmxLength, 512));
      universe.buffer.set(dmxData);
      universe.lastUpdate = performance.now();
      universe.active = true;
      this.ppsCounters[universeIdx] = (this.ppsCounters[universeIdx] || 0) + 1;

      this.emit('dmx-input', {
        universe: universeIdx,
        channels: dmxData,
        sequence,
      });
    }
  }

  private handleArtPollRequest(_data: Uint8Array): void {
    this.state.lastArtPoll = performance.now();
    this.sendArtPollReply();
  }

  private handleSACN(data: Uint8Array): void {
    if (data.length < 126) return;
    // Parse E1.31 root layer
    const vector = (data[18] << 24) | (data[19] << 16) | (data[20] << 8) | data[21];
    if (vector !== SACN_VECTOR_ROOT) return;

    const universe = (data[113] << 8) | data[114];
    const priority = data[108];
    const dmxStart = 126;
    const dmxData = data.slice(dmxStart, dmxStart + 512);

    const uObj = this.state.universes.find(u => u.id === universe - 1);
    if (uObj && uObj.mode === 'input' && priority >= uObj.priority) {
      uObj.buffer.set(dmxData);
      uObj.lastUpdate = performance.now();
      uObj.active = true;
      uObj.priority = priority;

      this.emit('dmx-input', { universe: universe - 1, channels: dmxData, priority });
    }
  }

  private handleRDM(_data: Uint8Array): void {
    // RDM discovery/response handling stub
    this.emit('rdm', { message: 'RDM packet received' });
  }

  // ═══ Sending ═══
  sendDMX(universeIdx: number, channels: Uint8Array): void {
    const universe = this.state.universes[universeIdx];
    if (!universe || universe.mode === 'input' || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    universe.buffer.set(channels);
    universe.lastUpdate = performance.now();
    universe.active = true;

    if (this.config.protocol === 'artnet') {
      this.sendArtDmx(universeIdx, channels);
    } else {
      this.sendSACNPacket(universeIdx, channels);
    }

    this.ppsCounters[universeIdx] = (this.ppsCounters[universeIdx] || 0) + 1;
    this.emit('dmx-output', { universe: universeIdx, channels });
  }

  private sendArtDmx(universeIdx: number, channels: Uint8Array): void {
    const packet = new Uint8Array(18 + 512);
    packet.set(ARTNET_HEADER, 0);
    packet[8] = ARTNET_OP_DMX & 0xFF;
    packet[9] = (ARTNET_OP_DMX >> 8) & 0xFF;
    packet[10] = 0x00; // ProtVerHi
    packet[11] = 14;   // ProtVerLo
    packet[12] = 0;    // Sequence
    packet[13] = 0;    // Physical
    packet[14] = universeIdx & 0xFF; // SubUni
    packet[15] = (universeIdx >> 8) & 0xFF; // Net
    packet[16] = 0x02; // LengthHi (512)
    packet[17] = 0x00; // LengthLo
    packet.set(channels.slice(0, 512), 18);

    this.ws?.send(packet.buffer);
  }

  sendArtSync(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const packet = new Uint8Array(14);
    packet.set(ARTNET_HEADER, 0);
    packet[8] = ARTNET_OP_SYNC & 0xFF;
    packet[9] = (ARTNET_OP_SYNC >> 8) & 0xFF;
    packet[10] = 0x00;
    packet[11] = 14;
    this.ws.send(packet.buffer);
    this.state.artSyncActive = true;
  }

  private sendArtPoll(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const packet = new Uint8Array(14);
    packet.set(ARTNET_HEADER, 0);
    packet[8] = ARTNET_OP_POLL & 0xFF;
    packet[9] = (ARTNET_OP_POLL >> 8) & 0xFF;
    packet[10] = 0x00;
    packet[11] = 14;
    packet[12] = 0x06; // TalkToMe: send ArtPollReply on change
    packet[13] = 0x00; // Priority
    this.ws.send(packet.buffer);
  }

  private sendArtPollReply(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const packet = new Uint8Array(239);
    packet.set(ARTNET_HEADER, 0);
    packet[8] = ARTNET_OP_POLL_REPLY & 0xFF;
    packet[9] = (ARTNET_OP_POLL_REPLY >> 8) & 0xFF;
    // Encode node label
    const labelBytes = new TextEncoder().encode(this.config.nodeLabel.slice(0, 17));
    packet.set(labelBytes, 26); // Short Name
    packet.set(labelBytes, 44); // Long Name
    // Num ports
    packet[173] = Math.min(this.config.universeCount, 4);
    this.ws.send(packet.buffer);
  }

  private sendSACNPacket(universeIdx: number, channels: Uint8Array): void {
    // Simplified E1.31 packet for relay bridge
    const packet = new Uint8Array(638);
    // Root Layer preamble
    packet[0] = 0x00; packet[1] = 0x10; // preamble size
    // Vector
    packet[18] = (SACN_VECTOR_ROOT >> 24) & 0xFF;
    packet[19] = (SACN_VECTOR_ROOT >> 16) & 0xFF;
    packet[20] = (SACN_VECTOR_ROOT >> 8) & 0xFF;
    packet[21] = SACN_VECTOR_ROOT & 0xFF;
    // Priority
    packet[108] = this.config.priority;
    // Universe (1-indexed)
    packet[113] = ((universeIdx + 1) >> 8) & 0xFF;
    packet[114] = (universeIdx + 1) & 0xFF;
    // DMX data
    packet.set(channels.slice(0, 512), 126);
    this.ws?.send(packet.buffer);
  }

  // ═══ PPS Tracking ═══
  private updatePPS(): void {
    let total = 0;
    for (let i = 0; i < this.state.universes.length; i++) {
      const pps = this.ppsCounters[i] || 0;
      this.state.universes[i].pps = pps;
      total += pps;
      this.ppsCounters[i] = 0;
    }
    this.state.totalPPS = total;
    this.emit('pps-update', { totalPPS: total });
  }

  // ═══ Event System ═══
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  // ═══ State Access ═══
  getState(): MA3NodeState { return this.state; }
  getConfig(): MA3NodeConfig { return this.config; }
  getUniverseBuffer(idx: number): Uint8Array | null {
    return this.state.universes[idx]?.buffer ?? null;
  }

  setUniverseMode(idx: number, mode: 'input' | 'output'): void {
    if (this.state.universes[idx]) {
      this.state.universes[idx].mode = mode;
    }
  }

  /** Simulate incoming DMX data (for stress testing without hardware) */
  simulateInput(universeIdx: number, channels: Uint8Array): void {
    const u = this.state.universes[universeIdx];
    if (!u) return;
    u.buffer.set(channels);
    u.lastUpdate = performance.now();
    u.active = true;
    this.ppsCounters[universeIdx] = (this.ppsCounters[universeIdx] || 0) + 1;
    this.emit('dmx-input', { universe: universeIdx, channels });
  }

  updateConfig(partial: Partial<MA3NodeConfig>): void {
    Object.assign(this.config, partial);
    if (partial.nodeLabel) this.state.nodeLabel = partial.nodeLabel;
    if (partial.universeCount && partial.universeCount !== this.state.universes.length) {
      this.disconnect();
      this.state = this.createInitialState();
      this.connect();
    }
  }
}

// ═══ Singleton instance ═══
let _ma3NodeInstance: GrandMA3Node | null = null;

export function getMA3Node(config?: Partial<MA3NodeConfig>): GrandMA3Node {
  if (!_ma3NodeInstance) {
    _ma3NodeInstance = new GrandMA3Node(config);
  }
  return _ma3NodeInstance;
}

export function resetMA3Node(): void {
  _ma3NodeInstance?.disconnect();
  _ma3NodeInstance = null;
}
