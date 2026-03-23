/**
 * Field Test Service — Real firing test between two devices
 * Supports: Supabase Realtime (LAN/WAN), BLE
 */
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { bleFieldTransport, isWebBluetoothAvailable } from './bleFieldTransport';

export type DeviceRole = 'controller' | 'module';
export type TestTransport = 'realtime-lan' | 'realtime-wan' | 'ble';

export interface FireEvent {
  id: string;
  channel: number;
  timestamp: number; // ms since epoch
  transport: TestTransport;
  source: 'controller';
}

export interface FireAck {
  fireId: string;
  receivedAt: number;
  latencyMs: number;
  transport: TestTransport;
}

export interface TestLog {
  id: string;
  type: 'fire' | 'ack' | 'arm' | 'disarm' | 'estop' | 'info' | 'error';
  transport: TestTransport;
  channel?: number;
  latencyMs?: number;
  timestamp: number;
  message: string;
}

export interface FieldTestSession {
  code: string;
  role: DeviceRole;
  transport: TestTransport;
  armed: boolean;
  connected: boolean;
  peerConnected: boolean;
  logs: TestLog[];
  stats: TransportStats;
}

export interface TransportStats {
  firesSent: number;
  acksReceived: number;
  latencies: number[];
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  packetLoss: number;
}

const emptyStats = (): TransportStats => ({
  firesSent: 0, acksReceived: 0, latencies: [],
  avgLatency: 0, minLatency: 0, maxLatency: 0, p95Latency: 0, packetLoss: 0,
});

function computeStats(latencies: number[]): Partial<TransportStats> {
  if (latencies.length === 0) return {};
  const sorted = [...latencies].sort((a, b) => a - b);
  const n = sorted.length;
  return {
    avgLatency: +(latencies.reduce((a, b) => a + b, 0) / n).toFixed(1),
    minLatency: +sorted[0].toFixed(1),
    maxLatency: +sorted[n - 1].toFixed(1),
    p95Latency: +sorted[Math.floor(n * 0.95)].toFixed(1),
  };
}

function genId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function generateSessionCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

type Listener = (session: FieldTestSession) => void;

class FieldTestEngine {
  private session: FieldTestSession | null = null;
  private channel: RealtimeChannel | null = null;
  private listeners = new Set<Listener>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    if (this.session) fn({ ...this.session, logs: [...this.session.logs] });
    return () => this.listeners.delete(fn);
  }

  private emit() {
    if (!this.session) return;
    const snapshot = { ...this.session, logs: [...this.session.logs], stats: { ...this.session.stats } };
    this.listeners.forEach(fn => fn(snapshot));
  }

  private log(type: TestLog['type'], message: string, extra?: Partial<TestLog>) {
    if (!this.session) return;
    this.session.logs.unshift({
      id: genId(),
      type,
      transport: this.session.transport,
      timestamp: Date.now(),
      message,
      ...extra,
    });
    // keep last 200
    if (this.session.logs.length > 200) this.session.logs.length = 200;
  }

  get isActive() { return !!this.session; }
  get currentSession() { return this.session; }

  // ─── Start Session ───────────────────────────────
  async start(code: string, role: DeviceRole, transport: TestTransport): Promise<boolean> {
    await this.stop();

    this.session = {
      code, role, transport,
      armed: false,
      connected: false,
      peerConnected: false,
      logs: [],
      stats: emptyStats(),
    };

    this.log('info', `Session ${code} · ${role.toUpperCase()} · ${transport}`);

    if (transport === 'ble') {
      this.session.connected = true;
      this.log('info', 'BLE mode — use native Bluetooth pairing');
      this.emit();
      return true;
    }

    // Realtime transport
    const channelName = `field-test:${code}`;
    this.channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    this.channel
      .on('broadcast', { event: 'fire' }, (msg) => this.onFireReceived(msg.payload as FireEvent))
      .on('broadcast', { event: 'ack' }, (msg) => this.onAckReceived(msg.payload as FireAck))
      .on('broadcast', { event: 'arm' }, () => this.onArmReceived())
      .on('broadcast', { event: 'disarm' }, () => this.onDisarmReceived())
      .on('broadcast', { event: 'estop' }, () => this.onEStopReceived())
      .on('broadcast', { event: 'heartbeat' }, () => {
        if (this.session) {
          this.session.peerConnected = true;
          this.emit();
        }
      })
      .on('presence', { event: 'join' }, () => {
        if (this.session) {
          this.session.peerConnected = true;
          this.log('info', 'Peer connected ✓');
          this.emit();
        }
      })
      .on('presence', { event: 'leave' }, () => {
        if (this.session) {
          this.session.peerConnected = false;
          this.log('info', 'Peer disconnected');
          this.emit();
        }
      });

    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && this.session) {
        this.session.connected = true;
        this.log('info', 'Realtime channel connected ✓');
        await this.channel!.track({ role, joinedAt: Date.now() });
        this.emit();
      }
    });

    // Heartbeat every 2s
    this.heartbeatInterval = setInterval(() => {
      this.channel?.send({ type: 'broadcast', event: 'heartbeat', payload: {} });
    }, 2000);

    this.emit();
    return true;
  }

  // ─── Commands (Controller) ───────────────────────
  async arm() {
    if (!this.session || this.session.role !== 'controller') return;
    this.session.armed = true;
    this.log('arm', '🔑 ARMED');
    this.channel?.send({ type: 'broadcast', event: 'arm', payload: {} });
    this.emit();
  }

  async disarm() {
    if (!this.session || this.session.role !== 'controller') return;
    this.session.armed = false;
    this.log('disarm', '🔒 DISARMED');
    this.channel?.send({ type: 'broadcast', event: 'disarm', payload: {} });
    this.emit();
  }

  async fire(channel: number) {
    if (!this.session || this.session.role !== 'controller' || !this.session.armed) return;

    const evt: FireEvent = {
      id: genId(),
      channel,
      timestamp: Date.now(),
      transport: this.session.transport,
      source: 'controller',
    };

    this.session.stats.firesSent++;
    this.log('fire', `🔥 FIRE CH-${String(channel).padStart(2, '0')}`, { channel });

    this.channel?.send({ type: 'broadcast', event: 'fire', payload: evt });
    this.emit();
  }

  async eStop() {
    if (!this.session) return;
    this.session.armed = false;
    this.log('estop', '🚨 E-STOP');
    this.channel?.send({ type: 'broadcast', event: 'estop', payload: {} });
    this.emit();
  }

  // ─── Receive Handlers ───────────────────────────
  private onFireReceived(evt: FireEvent) {
    if (!this.session || this.session.role !== 'module') return;
    const now = Date.now();
    const latency = now - evt.timestamp;

    this.log('fire', `⚡ RECV CH-${String(evt.channel).padStart(2, '0')} · ${latency}ms`, {
      channel: evt.channel, latencyMs: latency,
    });

    // Send ACK back
    const ack: FireAck = {
      fireId: evt.id,
      receivedAt: now,
      latencyMs: latency,
      transport: evt.transport,
    };
    this.channel?.send({ type: 'broadcast', event: 'ack', payload: ack });
    this.emit();
  }

  private onAckReceived(ack: FireAck) {
    if (!this.session || this.session.role !== 'controller') return;
    const roundTrip = Date.now() - (Date.now() - ack.latencyMs); // approx
    this.session.stats.acksReceived++;
    this.session.stats.latencies.push(ack.latencyMs);

    const computed = computeStats(this.session.stats.latencies);
    Object.assign(this.session.stats, computed);
    this.session.stats.packetLoss = +(
      ((this.session.stats.firesSent - this.session.stats.acksReceived) / Math.max(1, this.session.stats.firesSent)) * 100
    ).toFixed(1);

    this.log('ack', `✅ ACK · ${ack.latencyMs}ms`, { latencyMs: ack.latencyMs });
    this.emit();
  }

  private onArmReceived() {
    if (!this.session || this.session.role !== 'module') return;
    this.session.armed = true;
    this.log('arm', '🔑 CONTROLLER ARMED');
    this.emit();
  }

  private onDisarmReceived() {
    if (!this.session || this.session.role !== 'module') return;
    this.session.armed = false;
    this.log('disarm', '🔒 CONTROLLER DISARMED');
    this.emit();
  }

  private onEStopReceived() {
    if (!this.session) return;
    this.session.armed = false;
    this.log('estop', '🚨 E-STOP RECEIVED');
    this.emit();
  }

  // ─── Stop ───────────────────────────────────────
  async stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
    this.session = null;
    this.emit();
  }
}

export const fieldTestEngine = new FieldTestEngine();
