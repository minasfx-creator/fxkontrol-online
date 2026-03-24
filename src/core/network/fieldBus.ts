/**
 * ─── Field Bus — Multi-Transport Abstraction ────────────────────────
 * Routes commands through WiFi (primary), RS-485 (backup), Relay (fallback).
 * Auto-failover with heartbeat monitoring.
 * All transitions logged to BlackBox.
 */

import { blackbox } from '@/core/reliability/blackBoxRecorder';

export interface TransportMessage {
  type: 'pyro' | 'drone' | 'dmx' | 'heartbeat' | 'estop';
  payload: unknown;
  timestamp?: number;
}

export type TransportId = 'wifi' | 'rs485' | 'relay';

interface Transport {
  id: TransportId;
  send(msg: TransportMessage): boolean;
  isAlive(): boolean;
  lastHeartbeat: number;
}

export interface FieldBusState {
  activeTransport: TransportId;
  transports: Record<TransportId, { alive: boolean; lastHeartbeat: number }>;
  failoverCount: number;
  messagesSent: number;
  localBufferSize: number;
}

const HEARTBEAT_TIMEOUT = 2000;   // 2s no heartbeat → switch
const FAILOVER_CHECK_MS = 500;

export class FieldBus {
  private _transports: Transport[] = [];
  private _activeIdx = 0;
  private _failoverCount = 0;
  private _messagesSent = 0;
  private _localBuffer: TransportMessage[] = [];
  private _checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Register default transports (simulated — real impl would use WebSocket/Serial)
    this._transports = [
      this._createTransport('wifi'),
      this._createTransport('rs485'),
      this._createTransport('relay'),
    ];
  }

  private _createTransport(id: TransportId): Transport {
    return {
      id,
      send: (_msg: TransportMessage) => true, // Simulated: always succeeds
      isAlive: () => true,                     // Simulated: always alive
      lastHeartbeat: Date.now(),
    };
  }

  /** Start heartbeat monitoring. */
  startMonitoring(): void {
    if (this._checkInterval) return;
    this._checkInterval = setInterval(() => this._checkHealth(), FAILOVER_CHECK_MS);
    blackbox.record('net', 'FieldBus: monitoring started');
  }

  /** Stop heartbeat monitoring. */
  stopMonitoring(): void {
    if (this._checkInterval) {
      clearInterval(this._checkInterval);
      this._checkInterval = null;
    }
  }

  private _checkHealth(): void {
    const now = Date.now();
    const active = this._transports[this._activeIdx];

    if (!active.isAlive() || (now - active.lastHeartbeat > HEARTBEAT_TIMEOUT)) {
      // Try next transport
      for (let i = 0; i < this._transports.length; i++) {
        const idx = (this._activeIdx + 1 + i) % this._transports.length;
        const t = this._transports[idx];
        if (t.isAlive() && (now - t.lastHeartbeat <= HEARTBEAT_TIMEOUT)) {
          const from = active.id;
          this._activeIdx = idx;
          this._failoverCount++;
          blackbox.record('net', `FieldBus: failover ${from} → ${t.id}`, { failoverCount: this._failoverCount });
          this._flushLocalBuffer();
          return;
        }
      }
      // All transports down
      blackbox.record('emergency', 'FieldBus: ALL TRANSPORTS DOWN');
    }
  }

  /** Send a message through the active transport. Buffers locally if all down. */
  send(msg: TransportMessage): boolean {
    msg.timestamp = Date.now();
    const active = this._transports[this._activeIdx];

    if (active.isAlive()) {
      const ok = active.send(msg);
      if (ok) {
        this._messagesSent++;
        return true;
      }
    }

    // Buffer locally
    this._localBuffer.push(msg);
    if (this._localBuffer.length <= 1) {
      blackbox.record('net', 'FieldBus: buffering locally (transport down)');
    }
    return false;
  }

  private _flushLocalBuffer(): void {
    if (this._localBuffer.length === 0) return;
    const active = this._transports[this._activeIdx];
    const count = this._localBuffer.length;
    for (const msg of this._localBuffer) {
      active.send(msg);
      this._messagesSent++;
    }
    this._localBuffer.length = 0;
    blackbox.record('net', `FieldBus: flushed ${count} buffered messages`);
  }

  /** Record a heartbeat for a transport. */
  heartbeat(id: TransportId): void {
    const t = this._transports.find(tr => tr.id === id);
    if (t) t.lastHeartbeat = Date.now();
  }

  /** Check if any transport is alive. */
  isAlive(): boolean {
    return this._transports.some(t => t.isAlive());
  }

  getActiveTransport(): TransportId {
    return this._transports[this._activeIdx].id;
  }

  getState(): FieldBusState {
    const transports = {} as FieldBusState['transports'];
    for (const t of this._transports) {
      transports[t.id] = { alive: t.isAlive(), lastHeartbeat: t.lastHeartbeat };
    }
    return {
      activeTransport: this._transports[this._activeIdx].id,
      transports,
      failoverCount: this._failoverCount,
      messagesSent: this._messagesSent,
      localBufferSize: this._localBuffer.length,
    };
  }
}

export const fieldBus = new FieldBus();
