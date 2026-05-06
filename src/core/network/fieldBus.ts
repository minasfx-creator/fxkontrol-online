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

function isNonReplayable(msg: TransportMessage): boolean {
  // Physical or emergency commands are single-intent. Replaying them after
  // failover can ignite a late cue or mask an E-STOP delivery failure.
  return msg.type === 'pyro' || msg.type === 'estop';
}

export class FieldBus {
  private _transports: Transport[] = [];
  private _activeIdx = 0;
  private _failoverCount = 0;
  private _messagesSent = 0;
  private _localBuffer: TransportMessage[] = [];
  private _checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Transports start in a "no link" state. Real transports must be wired
    // via setTransport()/heartbeat() before send() will succeed.
    this._transports = [
      this._createTransport('wifi'),
      this._createTransport('rs485'),
      this._createTransport('relay'),
    ];
  }

  private _createTransport(id: TransportId): Transport {
    return {
      id,
      // No link is wired yet — refuse to "send" so callers see honest failures
      // instead of silent drops or fake successes.
      send: (_msg: TransportMessage) => false,
      isAlive: () => false,
      lastHeartbeat: 0,
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

    if (isNonReplayable(msg)) {
      blackbox.record('emergency', `FieldBus: refused to buffer non-replayable ${msg.type} command`);
      return false;
    }

    // Buffer only replay-safe messages (for example telemetry/heartbeat).
    this._localBuffer.push(msg);
    if (this._localBuffer.length <= 1) {
      blackbox.record('net', 'FieldBus: buffering replay-safe message locally (transport down)');
    }
    return false;
  }

  private _flushLocalBuffer(): void {
    if (this._localBuffer.length === 0) return;
    const active = this._transports[this._activeIdx];
    const count = this._localBuffer.length;
    for (const msg of this._localBuffer) {
      if (isNonReplayable(msg)) {
        blackbox.record('emergency', `FieldBus: dropped stale non-replayable ${msg.type} during failover flush`);
        continue;
      }
      active.send(msg);
      this._messagesSent++;
    }
    this._localBuffer.length = 0;
    blackbox.record('net', `FieldBus: flushed ${count} buffered messages`);
  }

  /**
   * Wire (or revoke) a real transport implementation. Replaces the no-op stub
   * created by the constructor without touching failover counters or the local
   * buffer. Pass a stub `{ send: () => false, isAlive: () => false }` to revoke.
   */
  setTransport(
    id: TransportId,
    impl: Pick<Transport, 'send' | 'isAlive'>,
  ): void {
    const idx = this._transports.findIndex(t => t.id === id);
    if (idx < 0) return;
    const prev = this._transports[idx];
    this._transports[idx] = {
      id,
      send: impl.send,
      isAlive: impl.isAlive,
      lastHeartbeat: prev.lastHeartbeat,
    };
    blackbox.record('net', `FieldBus: transport[${id}] wired`);
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
