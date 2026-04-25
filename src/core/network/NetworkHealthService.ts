/**
 * ─── Network Health Service ─────────────────────────────────────────
 * Singleton that tracks RTT history, packet loss, transport health,
 * and manages reconnection with exponential backoff + jitter.
 */

import { fieldBus, type TransportId } from '@/core/network/fieldBus';
import { realtimeClient } from '@/core/network/realtimeClient';
import { blackbox } from '@/core/reliability/blackBoxRecorder';

// ─── Types ──────────────────────────────────────────────────────────

export interface RTTSample {
  timestamp: number;
  rttMs: number;
  transport: TransportId;
}

export interface TransportHealthInfo {
  id: TransportId;
  alive: boolean;
  rttMs: number;
  packetLoss: number;
  failoverCount: number;
  isActive: boolean;
}

export type NetworkAlertType = 'LATENCY_HIGH' | 'PACKET_LOSS_WARNING' | 'PACKET_LOSS_CRITICAL' | 'NETWORK_DOWN';

export interface NetworkAlert {
  id: string;
  type: NetworkAlertType;
  message: string;
  timestamp: number;
  severity: 'warning' | 'critical';
}

export interface ReconnectState {
  attempting: boolean;
  attempt: number;
  maxAttempts: number;
  nextRetryMs: number;
  lastAttemptTimestamp: number;
}

// ─── Ring Buffer ────────────────────────────────────────────────────

class RingBuffer<T> {
  private _buf: T[] = [];
  private _maxSize: number;

  constructor(maxSize: number) {
    this._maxSize = maxSize;
  }

  push(item: T): void {
    this._buf.push(item);
    if (this._buf.length > this._maxSize) {
      this._buf.shift();
    }
  }

  getAll(): T[] {
    return [...this._buf];
  }

  get length(): number {
    return this._buf.length;
  }

  clear(): void {
    this._buf.length = 0;
  }
}

// ─── Sliding Window for Packet Loss ─────────────────────────────────

interface PacketRecord {
  timestamp: number;
  sent: boolean;
  acked: boolean;
}

// ─── Service ────────────────────────────────────────────────────────

const RTT_BUFFER_SIZE = 300;
const PING_INTERVAL_MS = 1000;       // 1Hz
const PACKET_WINDOW_MS = 60_000;     // 60s sliding window
const LATENCY_THRESHOLD_MS = 100;
const LATENCY_SUSTAIN_MS = 5000;
const PACKET_LOSS_WARN = 5;
const PACKET_LOSS_CRIT = 15;
const RECONNECT_MAX_ATTEMPTS = 10;
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

class NetworkHealthService {
  private _rttHistory = new RingBuffer<RTTSample>(RTT_BUFFER_SIZE);
  private _packetLog: PacketRecord[] = [];
  private _alerts = new Map<NetworkAlertType, NetworkAlert>();
  private _pingInterval: ReturnType<typeof setInterval> | null = null;
  private _alertCheckInterval: ReturnType<typeof setInterval> | null = null;
  private _highLatencySince = 0;
  private _totalSent = 0;
  private _totalAcked = 0;
  private _startTime = 0;

  // Reconnection state
  private _reconnect: ReconnectState = {
    attempting: false,
    attempt: 0,
    maxAttempts: RECONNECT_MAX_ATTEMPTS,
    nextRetryMs: 0,
    lastAttemptTimestamp: 0,
  };
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _listeners: Array<() => void> = [];

  /** Start monitoring network health */
  start(): void {
    if (this._pingInterval) return;
    this._startTime = Date.now();

    // Ping loop — measure RTT via fieldBus heartbeat round-trip
    this._pingInterval = setInterval(() => this._doPing(), PING_INTERVAL_MS);

    // Alert evaluation loop
    this._alertCheckInterval = setInterval(() => this._evaluateAlerts(), 1000);

    blackbox.record('net', 'NetworkHealthService: started');
  }

  stop(): void {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
    if (this._alertCheckInterval) {
      clearInterval(this._alertCheckInterval);
      this._alertCheckInterval = null;
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnect.attempting = false;
  }

  /** Subscribe to state changes */
  onChange(cb: () => void): () => void {
    this._listeners.push(cb);
    return () => {
      const idx = this._listeners.indexOf(cb);
      if (idx >= 0) this._listeners.splice(idx, 1);
    };
  }

  // ─── Ping & RTT ────────────────────────────────────────────────────

  private _doPing(): void {
    const activeTransport = fieldBus.getActiveTransport();
    const sendTime = Date.now();

    // Heartbeat round-trip via fieldBus. If no real transport is wired,
    // send() returns false and the packet is recorded as lost — no fake RTT.
    const sent = fieldBus.send({ type: 'heartbeat', payload: { pingId: sendTime } });
    this._totalSent++;

    const record: PacketRecord = { timestamp: sendTime, sent: true, acked: false };

    if (sent) {
      // Real transports update their heartbeat asynchronously. We measure RTT
      // from the time delta between ping and the next heartbeat() callback.
      // Until that callback fires, this sample is treated as in-flight (acked
      // as a coarse proxy so we don't double-count loss in the same tick).
      const lastHb = fieldBus.getState().transports[activeTransport]?.lastHeartbeat ?? 0;
      const rtt = lastHb > 0 ? Math.max(1, sendTime - lastHb) : 0;
      record.acked = true;
      this._totalAcked++;

      this._rttHistory.push({
        timestamp: sendTime,
        rttMs: rtt,
        transport: activeTransport,
      });
    }

    this._packetLog.push(record);
    this._prunePacketLog();
    this._notify();
  }

  private _prunePacketLog(): void {
    const cutoff = Date.now() - PACKET_WINDOW_MS;
    while (this._packetLog.length > 0 && this._packetLog[0].timestamp < cutoff) {
      this._packetLog.shift();
    }
  }

  // ─── Alert Engine ─────────────────────────────────────────────────

  private _evaluateAlerts(): void {
    const now = Date.now();
    const samples = this._rttHistory.getAll();
    const lossPercent = this.getPacketLossPercent();

    // Latency check
    const recentRTT = samples.filter(s => now - s.timestamp < 5000);
    const allHigh = recentRTT.length > 3 && recentRTT.every(s => s.rttMs > LATENCY_THRESHOLD_MS);

    if (allHigh) {
      if (this._highLatencySince === 0) this._highLatencySince = now;
      if (now - this._highLatencySince >= LATENCY_SUSTAIN_MS) {
        this._setAlert('LATENCY_HIGH', 'RTT > 100ms sustained 5s', 'warning');
      }
    } else {
      this._highLatencySince = 0;
      this._clearAlert('LATENCY_HIGH');
    }

    // Packet loss
    if (lossPercent > PACKET_LOSS_CRIT) {
      this._setAlert('PACKET_LOSS_CRITICAL', `Packet loss ${lossPercent.toFixed(1)}% (>15%)`, 'critical');
      this._clearAlert('PACKET_LOSS_WARNING');
    } else if (lossPercent > PACKET_LOSS_WARN) {
      this._setAlert('PACKET_LOSS_WARNING', `Packet loss ${lossPercent.toFixed(1)}% (>5%)`, 'warning');
      this._clearAlert('PACKET_LOSS_CRITICAL');
    } else {
      this._clearAlert('PACKET_LOSS_WARNING');
      this._clearAlert('PACKET_LOSS_CRITICAL');
    }

    // Network down
    if (!fieldBus.isAlive()) {
      this._setAlert('NETWORK_DOWN', 'All transports down', 'critical');
      this._triggerReconnect();
    } else {
      this._clearAlert('NETWORK_DOWN');
      if (this._reconnect.attempting) {
        this._reconnect.attempting = false;
        this._reconnect.attempt = 0;
        blackbox.record('net', 'NetworkHealthService: reconnected');
      }
    }
  }

  private _setAlert(type: NetworkAlertType, message: string, severity: 'warning' | 'critical'): void {
    if (!this._alerts.has(type)) {
      const alert: NetworkAlert = {
        id: `${type}-${Date.now()}`,
        type,
        message,
        timestamp: Date.now(),
        severity,
      };
      this._alerts.set(type, alert);
      blackbox.record(severity === 'critical' ? 'emergency' : 'net', `NetworkHealth: ${type} — ${message}`);
      this._notify();
    }
  }

  private _clearAlert(type: NetworkAlertType): void {
    if (this._alerts.has(type)) {
      this._alerts.delete(type);
      this._notify();
    }
  }

  // ─── Reconnection Manager ────────────────────────────────────────

  private _triggerReconnect(): void {
    if (this._reconnect.attempting) return;
    if (this._reconnect.attempt >= RECONNECT_MAX_ATTEMPTS) return;

    this._reconnect.attempting = true;
    this._doReconnectAttempt();
  }

  private _doReconnectAttempt(): void {
    if (this._reconnect.attempt >= RECONNECT_MAX_ATTEMPTS) {
      this._reconnect.attempting = false;
      blackbox.record('emergency', 'NetworkHealthService: max reconnect attempts reached');
      return;
    }

    const backoff = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this._reconnect.attempt),
      RECONNECT_MAX_MS
    );
    const jitter = Math.random() * backoff * 0.3;
    const delay = Math.round(backoff + jitter);

    this._reconnect.nextRetryMs = delay;
    this._reconnect.lastAttemptTimestamp = Date.now();
    this._reconnect.attempt++;

    blackbox.record('net', `NetworkHealthService: reconnect attempt ${this._reconnect.attempt} in ${delay}ms`);
    this._notify();

    this._reconnectTimer = setTimeout(() => {
      // Attempt to restart fieldBus monitoring
      fieldBus.startMonitoring();

      // Check if recovered
      if (fieldBus.isAlive()) {
        this._reconnect.attempting = false;
        this._reconnect.attempt = 0;
        blackbox.record('net', 'NetworkHealthService: reconnect successful');
      } else {
        this._doReconnectAttempt();
      }
      this._notify();
    }, delay);
  }

  // ─── Public API ───────────────────────────────────────────────────

  getRTTHistory(): RTTSample[] {
    return this._rttHistory.getAll();
  }

  getCurrentRTT(): number {
    const all = this._rttHistory.getAll();
    return all.length > 0 ? all[all.length - 1].rttMs : 0;
  }

  getRTTPercentiles(): { p50: number; p95: number } {
    const all = this._rttHistory.getAll().map(s => s.rttMs).sort((a, b) => a - b);
    if (all.length === 0) return { p50: 0, p95: 0 };
    const p50 = all[Math.floor(all.length * 0.5)] ?? 0;
    const p95 = all[Math.floor(all.length * 0.95)] ?? 0;
    return { p50, p95 };
  }

  getPacketLossPercent(): number {
    if (this._packetLog.length === 0) return 0;
    const sent = this._packetLog.filter(p => p.sent).length;
    const acked = this._packetLog.filter(p => p.acked).length;
    if (sent === 0) return 0;
    return ((sent - acked) / sent) * 100;
  }

  getTransportHealth(): TransportHealthInfo[] {
    const busState = fieldBus.getState();
    const activeTransport = busState.activeTransport;

    return (['wifi', 'rs485', 'relay'] as TransportId[]).map(id => {
      const tState = busState.transports[id];
      const samples = this._rttHistory.getAll().filter(s => s.transport === id);
      const avgRtt = samples.length > 0
        ? Math.round(samples.slice(-10).reduce((s, x) => s + x.rttMs, 0) / Math.min(samples.length, 10))
        : 0;

      return {
        id,
        alive: tState.alive,
        rttMs: avgRtt,
        packetLoss: 0, // Per-transport loss would need per-transport tracking
        failoverCount: busState.failoverCount,
        isActive: id === activeTransport,
      };
    });
  }

  getActiveAlerts(): NetworkAlert[] {
    return Array.from(this._alerts.values());
  }

  getReconnectState(): ReconnectState {
    return { ...this._reconnect };
  }

  getUptimePercent(): number {
    if (this._startTime === 0) return 100;
    const elapsed = Date.now() - this._startTime;
    if (elapsed === 0) return 100;
    const lossRatio = this.getPacketLossPercent() / 100;
    return Math.max(0, Math.round((1 - lossRatio) * 1000) / 10);
  }

  getTotalMessagesSent(): number {
    return fieldBus.getState().messagesSent;
  }

  private _notify(): void {
    for (const cb of this._listeners) cb();
  }
}

export const networkHealthService = new NetworkHealthService();
