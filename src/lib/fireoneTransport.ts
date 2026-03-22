/**
 * FireOne Multi-Transport Abstraction Layer
 * 
 * Provides a unified interface for sending/receiving FireOne protocol frames
 * across multiple physical transports: Serial (RS-485), Radio (CC1101/SX1276),
 * Wi-Fi (WebSocket relay), and Art-Net (IFMx-i32Q DMX output).
 * 
 * TransportManager handles priority routing, E-STOP broadcast, and auto-fallback.
 */

export type TransportType = 'serial' | 'radio' | 'wifi' | 'wifi_direct' | 'artnet';
export type TransportState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

export interface TransportStatus {
  id: string;
  type: TransportType;
  label: string;
  state: TransportState;
  priority: number;
  latencyMs: number;
  txBytes: number;
  rxBytes: number;
  lastActivity: number;
  error?: string;
  config?: Record<string, any>;
}

export type TransportReceiveCallback = (data: Uint8Array, transportId: string) => void;
export type TransportStateCallback = (id: string, state: TransportState, error?: string) => void;

// ═══════════════════════════════════════════════════════════
// TRANSPORT INTERFACE
// ═══════════════════════════════════════════════════════════

export interface FireOneTransport {
  readonly id: string;
  readonly type: TransportType;
  readonly label: string;
  priority: number;
  state: TransportState;
  latencyMs: number;
  txBytes: number;
  rxBytes: number;

  connect(config?: Record<string, any>): Promise<void>;
  disconnect(): Promise<void>;
  send(frame: Uint8Array): Promise<void>;
  onReceive(callback: TransportReceiveCallback): void;
  onStateChange(callback: TransportStateCallback): void;
  isAvailable(): boolean;
}

// ═══════════════════════════════════════════════════════════
// SERIAL TRANSPORT (RS-485 via WebSerial)
// ═══════════════════════════════════════════════════════════

export class SerialTransport implements FireOneTransport {
  readonly id: string;
  readonly type: TransportType = 'serial';
  readonly label = 'RS-485 Cable';
  priority = 1;
  state: TransportState = 'disconnected';
  latencyMs = 0;
  txBytes = 0;
  rxBytes = 0;

  private port: any = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readLoop = false;
  private receiveCallbacks: TransportReceiveCallback[] = [];
  private stateCallbacks: TransportStateCallback[] = [];
  private baudRate: number;

  constructor(id?: string, baudRate = 9600) {
    this.id = id || `serial-${Date.now()}`;
    this.baudRate = baudRate;
  }

  onReceive(cb: TransportReceiveCallback) { this.receiveCallbacks.push(cb); }
  onStateChange(cb: TransportStateCallback) { this.stateCallbacks.push(cb); }
  isAvailable() { return 'serial' in navigator; }

  private setState(s: TransportState, error?: string) {
    this.state = s;
    this.stateCallbacks.forEach(cb => cb(this.id, s, error));
  }

  async connect(): Promise<void> {
    if (!this.isAvailable()) throw new Error('WebSerial não suportado');
    this.setState('connecting');
    try {
      const nav = navigator as any;
      this.port = await nav.serial.requestPort({
        filters: [
          { usbVendorId: 0x0403 }, { usbVendorId: 0x067B },
          { usbVendorId: 0x10C4 }, { usbVendorId: 0x1A86 },
        ],
      });
      await this.port.open({
        baudRate: this.baudRate, dataBits: 8, stopBits: 1, parity: 'none', bufferSize: 4096,
      });
      this.reader = this.port.readable?.getReader() ?? null;
      this.writer = this.port.writable?.getWriter() ?? null;
      this.setState('connected');
      this.startReading();
    } catch (err: any) {
      this.setState('error', err.message);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.readLoop = false;
    try {
      if (this.reader) { await this.reader.cancel().catch(() => {}); this.reader.releaseLock(); }
      if (this.writer) { await this.writer.close().catch(() => {}); this.writer.releaseLock(); }
      if (this.port) await this.port.close().catch(() => {});
    } catch { /* ignore */ }
    this.port = null; this.reader = null; this.writer = null;
    this.setState('disconnected');
  }

  async send(frame: Uint8Array): Promise<void> {
    if (!this.writer || this.state !== 'connected') throw new Error('Serial não conectado');
    const t0 = performance.now();
    await this.writer.write(frame);
    this.latencyMs = Math.round(performance.now() - t0);
    this.txBytes += frame.length;
  }

  private async startReading() {
    this.readLoop = true;
    while (this.readLoop && this.reader) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          this.rxBytes += value.length;
          this.receiveCallbacks.forEach(cb => cb(value, this.id));
        }
      } catch { break; }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// RADIO TRANSPORT (CC1101/SX1276 via WebSerial)
// ═══════════════════════════════════════════════════════════

export class RadioTransport implements FireOneTransport {
  readonly id: string;
  readonly type: TransportType = 'radio';
  readonly label = 'Radio RF';
  priority = 3;
  state: TransportState = 'disconnected';
  latencyMs = 0;
  txBytes = 0;
  rxBytes = 0;

  private port: any = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readLoop = false;
  private receiveCallbacks: TransportReceiveCallback[] = [];
  private stateCallbacks: TransportStateCallback[] = [];
  private seq = 0;

  constructor(id?: string) {
    this.id = id || `radio-${Date.now()}`;
  }

  onReceive(cb: TransportReceiveCallback) { this.receiveCallbacks.push(cb); }
  onStateChange(cb: TransportStateCallback) { this.stateCallbacks.push(cb); }
  isAvailable() { return 'serial' in navigator; }

  private setState(s: TransportState, error?: string) {
    this.state = s;
    this.stateCallbacks.forEach(cb => cb(this.id, s, error));
  }

  async connect(config?: Record<string, any>): Promise<void> {
    if (!this.isAvailable()) throw new Error('WebSerial não suportado');
    this.setState('connecting');
    try {
      const nav = navigator as any;
      this.port = await nav.serial.requestPort();
      const baudRate = config?.baudRate || 38400;
      await this.port.open({ baudRate, dataBits: 8, stopBits: 1, parity: 'none', bufferSize: 4096 });
      this.reader = this.port.readable?.getReader() ?? null;
      this.writer = this.port.writable?.getWriter() ?? null;
      this.setState('connected');
      this.startReading();
    } catch (err: any) {
      this.setState('error', err.message);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.readLoop = false;
    try {
      if (this.reader) { await this.reader.cancel().catch(() => {}); this.reader.releaseLock(); }
      if (this.writer) { await this.writer.close().catch(() => {}); this.writer.releaseLock(); }
      if (this.port) await this.port.close().catch(() => {});
    } catch { /* ignore */ }
    this.port = null; this.reader = null; this.writer = null;
    this.setState('disconnected');
  }

  /** Wraps FireOne frame in radio packet before sending */
  async send(frame: Uint8Array): Promise<void> {
    if (!this.writer || this.state !== 'connected') throw new Error('Rádio não conectado');
    // Wrap in radio protocol: SYNC + LEN + DEST(broadcast) + SRC(0) + SEQ + CMD(DATA=0x10) + payload + CRC
    const SYNC = 0xD5;
    const destAddr = frame[1] ?? 0xFF; // module addr from FireOne frame
    const len = 4 + frame.length;
    const radioFrame = new Uint8Array(1 + 1 + len + 2);
    radioFrame[0] = SYNC;
    radioFrame[1] = len;
    radioFrame[2] = destAddr;
    radioFrame[3] = 0x00; // src
    radioFrame[4] = this.seq++ & 0xFF;
    radioFrame[5] = 0x10; // DATA cmd
    radioFrame.set(frame, 6);
    // CRC16-CCITT
    let crc = 0xFFFF;
    const crcData = radioFrame.subarray(1, 6 + frame.length);
    for (let i = 0; i < crcData.length; i++) {
      crc ^= crcData[i] << 8;
      for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xFFFF;
    }
    radioFrame[radioFrame.length - 2] = (crc >> 8) & 0xFF;
    radioFrame[radioFrame.length - 1] = crc & 0xFF;

    const t0 = performance.now();
    await this.writer.write(radioFrame);
    this.latencyMs = Math.round(performance.now() - t0);
    this.txBytes += radioFrame.length;
  }

  private async startReading() {
    this.readLoop = true;
    while (this.readLoop && this.reader) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          this.rxBytes += value.length;
          // Extract FireOne payload from radio frame if DATA response
          // For now, pass raw to controller which handles both formats
          this.receiveCallbacks.forEach(cb => cb(value, this.id));
        }
      } catch { break; }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// WIFI TRANSPORT (WebSocket to local relay)
// ═══════════════════════════════════════════════════════════

export class WiFiTransport implements FireOneTransport {
  readonly id: string;
  readonly type: TransportType = 'wifi';
  readonly label = 'Wi-Fi Relay';
  priority = 2;
  state: TransportState = 'disconnected';
  latencyMs = 0;
  txBytes = 0;
  rxBytes = 0;

  private ws: WebSocket | null = null;
  private receiveCallbacks: TransportReceiveCallback[] = [];
  private stateCallbacks: TransportStateCallback[] = [];
  private relayUrl = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnects = 5;
  private autoReconnect = true;

  constructor(id?: string) {
    this.id = id || `wifi-${Date.now()}`;
  }

  onReceive(cb: TransportReceiveCallback) { this.receiveCallbacks.push(cb); }
  onStateChange(cb: TransportStateCallback) { this.stateCallbacks.push(cb); }
  isAvailable() { return typeof WebSocket !== 'undefined'; }

  private setState(s: TransportState, error?: string) {
    this.state = s;
    this.stateCallbacks.forEach(cb => cb(this.id, s, error));
  }

  async connect(config?: Record<string, any>): Promise<void> {
    const ip = config?.relayIp || '192.168.1.100';
    const port = config?.relayPort || 9485;
    this.relayUrl = `ws://${ip}:${port}`;
    this.autoReconnect = config?.autoReconnect !== false;

    return new Promise((resolve, reject) => {
      this.setState('connecting');
      this.ws = new WebSocket(this.relayUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.setState('connected');
        this.reconnectAttempts = 0;
        // Send ping for latency measurement
        this.measureLatency();
        resolve();
      };

      this.ws.onmessage = (ev: MessageEvent) => {
        if (ev.data instanceof ArrayBuffer) {
          const data = new Uint8Array(ev.data);
          this.rxBytes += data.length;
          this.receiveCallbacks.forEach(cb => cb(data, this.id));
        } else if (typeof ev.data === 'string') {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'pong') {
              this.latencyMs = Math.round(performance.now() - (msg.t0 || 0));
            } else if (msg.type === 'fireone-frame' && msg.data) {
              const bytes = Uint8Array.from(atob(msg.data), c => c.charCodeAt(0));
              this.rxBytes += bytes.length;
              this.receiveCallbacks.forEach(cb => cb(bytes, this.id));
            }
          } catch { /* ignore non-JSON */ }
        }
      };

      this.ws.onerror = () => {
        this.setState('error', `Falha ao conectar ${this.relayUrl}`);
        reject(new Error(`WebSocket error: ${this.relayUrl}`));
      };

      this.ws.onclose = () => {
        if (this.state === 'connected' && this.autoReconnect) {
          this.attemptReconnect();
        } else {
          this.setState('disconnected');
        }
      };
    });
  }

  async disconnect(): Promise<void> {
    this.autoReconnect = false;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.setState('disconnected');
  }

  async send(frame: Uint8Array): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) throw new Error('Wi-Fi relay não conectado');
    const t0 = performance.now();
    // Send as binary for lowest latency
    this.ws.send(frame.slice().buffer as ArrayBuffer);
    this.latencyMs = Math.round(performance.now() - t0);
    this.txBytes += frame.length;
  }

  private measureLatency() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping', t0: performance.now() }));
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnects) {
      this.setState('error', `Reconexão falhou após ${this.maxReconnects} tentativas`);
      return;
    }
    this.setState('reconnecting');
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect({ relayIp: new URL(this.relayUrl).hostname, relayPort: parseInt(new URL(this.relayUrl).port) })
        .catch(() => this.attemptReconnect());
    }, delay);
  }
}

// ═══════════════════════════════════════════════════════════
// ARTNET TRANSPORT (IFMx-i32Q DMX output only)
// ═══════════════════════════════════════════════════════════

export class ArtNetTransport implements FireOneTransport {
  readonly id: string;
  readonly type: TransportType = 'artnet';
  readonly label = 'Art-Net DMX';
  priority = 4; // lowest — only for DMX_OUT
  state: TransportState = 'disconnected';
  latencyMs = 0;
  txBytes = 0;
  rxBytes = 0;

  private receiveCallbacks: TransportReceiveCallback[] = [];
  private stateCallbacks: TransportStateCallback[] = [];
  private edgeFunctionUrl = '';
  private targetIp = '';

  constructor(id?: string) {
    this.id = id || `artnet-${Date.now()}`;
  }

  onReceive(cb: TransportReceiveCallback) { this.receiveCallbacks.push(cb); }
  onStateChange(cb: TransportStateCallback) { this.stateCallbacks.push(cb); }
  isAvailable() { return true; } // Always available via edge function

  private setState(s: TransportState, error?: string) {
    this.state = s;
    this.stateCallbacks.forEach(cb => cb(this.id, s, error));
  }

  async connect(config?: Record<string, any>): Promise<void> {
    this.targetIp = config?.targetIp || '2.0.0.1';
    this.edgeFunctionUrl = config?.edgeFunctionUrl || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/artnet-bridge`;
    this.setState('connecting');
    try {
      // Validate connection
      const resp = await fetch(this.edgeFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate', targetIp: this.targetIp }),
      });
      if (!resp.ok) throw new Error(`Art-Net bridge: ${resp.statusText}`);
      this.setState('connected');
    } catch (err: any) {
      this.setState('error', err.message);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.setState('disconnected');
  }

  /** Only handles DMX_OUT frames (cmd 0x4F). Other commands are ignored. */
  async send(frame: Uint8Array): Promise<void> {
    if (this.state !== 'connected') throw new Error('Art-Net não conectado');
    // Only process DMX_OUT commands
    if (frame.length < 4 || frame[2] !== 0x4F) return;
    
    const moduleAddr = frame[1];
    const payload = frame.slice(3, frame.length - 2);
    const startCh = (payload[0] << 8) | payload[1];
    const values = Array.from(payload.slice(2));

    const t0 = performance.now();
    await fetch(this.edgeFunctionUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'dmx',
        targetIp: this.targetIp,
        universe: moduleAddr - 1,
        channels: values.map((v, i) => ({ channel: startCh + i, value: v })),
      }),
    });
    this.latencyMs = Math.round(performance.now() - t0);
    this.txBytes += frame.length;
  }
}

// ═══════════════════════════════════════════════════════════
// TRANSPORT MANAGER
// ═══════════════════════════════════════════════════════════

export type TransportManagerEvent = 
  | { type: 'transport-added'; transport: TransportStatus }
  | { type: 'transport-removed'; id: string }
  | { type: 'transport-state'; id: string; state: TransportState; error?: string }
  | { type: 'data'; data: Uint8Array; transportId: string }
  | { type: 'fallback'; from: string; to: string };

export type TransportManagerListener = (event: TransportManagerEvent) => void;

export class FireOneTransportManager {
  private transports: Map<string, FireOneTransport> = new Map();
  private listeners: TransportManagerListener[] = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  get allTransports(): TransportStatus[] {
    return Array.from(this.transports.values())
      .map(t => ({
        id: t.id, type: t.type, label: t.label, state: t.state,
        priority: t.priority, latencyMs: t.latencyMs,
        txBytes: t.txBytes, rxBytes: t.rxBytes, lastActivity: Date.now(),
      }))
      .sort((a, b) => a.priority - b.priority);
  }

  get connectedCount(): number {
    let c = 0;
    this.transports.forEach(t => { if (t.state === 'connected') c++; });
    return c;
  }

  get bestTransport(): FireOneTransport | null {
    let best: FireOneTransport | null = null;
    this.transports.forEach(t => {
      if (t.state === 'connected' && (!best || t.priority < best.priority)) best = t;
    });
    return best;
  }

  get isConnected(): boolean {
    return this.bestTransport !== null;
  }

  on(listener: TransportManagerListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit(event: TransportManagerEvent) {
    this.listeners.forEach(l => l(event));
  }

  addTransport(transport: FireOneTransport): void {
    this.transports.set(transport.id, transport);
    transport.onReceive((data, id) => {
      this.emit({ type: 'data', data, transportId: id });
    });
    transport.onStateChange((id, state, error) => {
      this.emit({ type: 'transport-state', id, state, error });
      // Auto-fallback: if primary fails, log fallback to next
      if (state === 'error' || state === 'disconnected') {
        const next = this.bestTransport;
        if (next && next.id !== id) {
          this.emit({ type: 'fallback', from: id, to: next.id });
        }
      }
    });
    this.emit({
      type: 'transport-added',
      transport: {
        id: transport.id, type: transport.type, label: transport.label,
        state: transport.state, priority: transport.priority,
        latencyMs: 0, txBytes: 0, rxBytes: 0, lastActivity: Date.now(),
      },
    });
  }

  removeTransport(id: string): void {
    const t = this.transports.get(id);
    if (t) {
      t.disconnect().catch(() => {});
      this.transports.delete(id);
      this.emit({ type: 'transport-removed', id });
    }
  }

  /** Send via best available transport (priority-based) */
  async send(frame: Uint8Array): Promise<void> {
    const best = this.bestTransport;
    if (!best) throw new Error('Nenhum transporte conectado');
    try {
      await best.send(frame);
    } catch (err) {
      // Try fallback
      let sent = false;
      const sorted = Array.from(this.transports.values())
        .filter(t => t.state === 'connected' && t.id !== best.id)
        .sort((a, b) => a.priority - b.priority);
      for (const fallback of sorted) {
        try {
          await fallback.send(frame);
          this.emit({ type: 'fallback', from: best.id, to: fallback.id });
          sent = true;
          break;
        } catch { /* try next */ }
      }
      if (!sent) throw err;
    }
  }

  /** Broadcast on ALL connected transports (for E-STOP) */
  async broadcast(frame: Uint8Array): Promise<void> {
    const promises: Promise<void>[] = [];
    this.transports.forEach(t => {
      if (t.state === 'connected') promises.push(t.send(frame).catch(() => {}));
    });
    await Promise.allSettled(promises);
  }

  /** Send heartbeat on all connected transports */
  startHeartbeat(buildHeartbeatFn: () => Uint8Array, intervalMs = 2000): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      const hb = buildHeartbeatFn();
      this.transports.forEach(t => {
        if (t.state === 'connected') t.send(hb).catch(() => {});
      });
    }, intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) { clearInterval(this.heartbeatInterval); this.heartbeatInterval = null; }
  }

  async disconnectAll(): Promise<void> {
    this.stopHeartbeat();
    const promises: Promise<void>[] = [];
    this.transports.forEach(t => promises.push(t.disconnect().catch(() => {})));
    await Promise.allSettled(promises);
  }

  getTransport(id: string): FireOneTransport | undefined {
    return this.transports.get(id);
  }

  getTransportsByType(type: TransportType): FireOneTransport[] {
    return Array.from(this.transports.values()).filter(t => t.type === type);
  }
}

// Singleton
let _manager: FireOneTransportManager | null = null;
export function getTransportManager(): FireOneTransportManager {
  if (!_manager) _manager = new FireOneTransportManager();
  return _manager;
}
