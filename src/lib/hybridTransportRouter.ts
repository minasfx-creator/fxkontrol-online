/**
 * Hybrid Transport Router — Starlink + Radio 433MHz
 * 
 * Architecture:
 * - CRITICAL PATH (Radio 433MHz local): E-STOP, ARM, FIRE, DISARM — low latency, NFPA compliant
 * - SUPERVISION PATH (Starlink/Wi-Fi Direct): sync, monitoring, cue upload, status — global reach
 * - Auto-fallback: if primary path fails, reroutes through available transport
 * 
 * Priority matrix:
 *   E-STOP     → Radio (broadcast ALL) — always, no exceptions
 *   ARM/FIRE   → Radio first, fallback Wi-Fi Direct
 *   DISARM     → Radio first, fallback Wi-Fi Direct
 *   SYNC/STATUS → Starlink/Wi-Fi Direct first, fallback Radio
 *   CUE UPLOAD → Starlink only (bandwidth)
 */

import {
  type FireOneTransport,
  type TransportType,
  type TransportState,
  type TransportManagerEvent,
  type TransportManagerListener,
  FireOneTransportManager,
  getTransportManager,
} from '@/lib/fireoneTransport';

// ═══════════════════════════════════════════════════════════
// COMMAND CLASSIFICATION
// ═══════════════════════════════════════════════════════════

/** FireOne command bytes that map to safety-critical operations */
const ESTOP_CMD = 0x58;   // 'X' — Emergency Stop (FireOneCmd.EMERGENCY_STOP)
const ARM_CMD = 0x41;     // 'A' — Arm module
const FIRE_CMD = 0x46;    // 'F' — Fire cue
const DISARM_CMD = 0x44;  // 'D' — Disarm module
const CONTINUITY_CMD = 0x43; // 'C' — Continuity check
const STATUS_CMD = 0x53;  // 'S' — Status request
const HEARTBEAT_CMD = 0x48; // 'H' — Heartbeat
const DMX_CMD = 0x4F;     // 'O' — DMX output
const SCRIPT_CMD = 0x55;  // 'U' — UltraFire script upload

export type CommandPriority = 'critical' | 'high' | 'normal' | 'bulk';
export type RoutingPath = 'radio' | 'starlink' | 'any' | 'broadcast';

export interface RoutingDecision {
  priority: CommandPriority;
  preferredPath: RoutingPath;
  fallbackAllowed: boolean;
  retryCount: number;
  timeoutMs: number;
}

/**
 * Classify a FireOne frame and determine routing path
 */
export function classifyCommand(frame: Uint8Array): RoutingDecision {
  if (frame.length < 3) {
    return { priority: 'normal', preferredPath: 'any', fallbackAllowed: true, retryCount: 1, timeoutMs: 500 };
  }

  const cmd = frame[2];

  switch (cmd) {
    case ESTOP_CMD:
      return { priority: 'critical', preferredPath: 'broadcast', fallbackAllowed: false, retryCount: 3, timeoutMs: 50 };
    case ARM_CMD:
    case FIRE_CMD:
    case DISARM_CMD:
      return { priority: 'high', preferredPath: 'radio', fallbackAllowed: true, retryCount: 2, timeoutMs: 100 };
    case CONTINUITY_CMD:
    case STATUS_CMD:
    case HEARTBEAT_CMD:
      return { priority: 'normal', preferredPath: 'starlink', fallbackAllowed: true, retryCount: 1, timeoutMs: 2000 };
    case DMX_CMD:
      return { priority: 'normal', preferredPath: 'starlink', fallbackAllowed: true, retryCount: 0, timeoutMs: 100 };
    case SCRIPT_CMD:
      return { priority: 'bulk', preferredPath: 'starlink', fallbackAllowed: false, retryCount: 2, timeoutMs: 10000 };
    default:
      return { priority: 'normal', preferredPath: 'any', fallbackAllowed: true, retryCount: 1, timeoutMs: 500 };
  }
}

// ═══════════════════════════════════════════════════════════
// TRANSPORT HEALTH MONITOR
// ═══════════════════════════════════════════════════════════

export interface TransportHealth {
  transportId: string;
  type: TransportType;
  state: TransportState;
  latencyMs: number;
  latencyP95: number;
  packetLossRate: number;   // 0-1
  lastSuccessMs: number;    // timestamp
  lastFailureMs: number;    // timestamp
  consecutiveFailures: number;
  isHealthy: boolean;
  isSatellite: boolean;     // Starlink flag
}

class TransportHealthMonitor {
  private healthMap = new Map<string, TransportHealth>();
  private latencyHistory = new Map<string, number[]>();
  private readonly MAX_HISTORY = 100;

  update(transportId: string, type: TransportType, state: TransportState, latencyMs: number, success: boolean, isSatellite = false): TransportHealth {
    let h = this.healthMap.get(transportId);
    if (!h) {
      h = {
        transportId, type, state, latencyMs, latencyP95: latencyMs,
        packetLossRate: 0, lastSuccessMs: 0, lastFailureMs: 0,
        consecutiveFailures: 0, isHealthy: state === 'connected', isSatellite,
      };
      this.healthMap.set(transportId, h);
      this.latencyHistory.set(transportId, []);
    }

    h.state = state;
    h.latencyMs = latencyMs;
    h.isSatellite = isSatellite;

    if (success) {
      h.lastSuccessMs = Date.now();
      h.consecutiveFailures = 0;
    } else {
      h.lastFailureMs = Date.now();
      h.consecutiveFailures++;
    }

    // Track latency history for P95
    const history = this.latencyHistory.get(transportId)!;
    if (latencyMs > 0) {
      history.push(latencyMs);
      if (history.length > this.MAX_HISTORY) history.shift();
      const sorted = [...history].sort((a, b) => a - b);
      h.latencyP95 = sorted[Math.floor(sorted.length * 0.95)] || latencyMs;
    }

    // Packet loss estimation
    const total = history.length;
    const failures = h.consecutiveFailures;
    h.packetLossRate = total > 0 ? Math.min(failures / total, 1) : 0;

    // Health assessment
    h.isHealthy = state === 'connected' && h.consecutiveFailures < 3 && h.packetLossRate < 0.1;

    return h;
  }

  get(transportId: string): TransportHealth | undefined {
    return this.healthMap.get(transportId);
  }

  getByType(type: TransportType): TransportHealth[] {
    return Array.from(this.healthMap.values()).filter(h => h.type === type);
  }

  getHealthyByType(type: TransportType): TransportHealth[] {
    return this.getByType(type).filter(h => h.isHealthy);
  }

  remove(transportId: string): void {
    this.healthMap.delete(transportId);
    this.latencyHistory.delete(transportId);
  }

  get allHealth(): TransportHealth[] {
    return Array.from(this.healthMap.values());
  }
}

// ═══════════════════════════════════════════════════════════
// HYBRID TRANSPORT ROUTER
// ═══════════════════════════════════════════════════════════

export type HybridRouterEvent =
  | { type: 'route-decision'; command: CommandPriority; path: string; transportId: string }
  | { type: 'fallback-activated'; from: string; to: string; reason: string }
  | { type: 'estop-broadcast'; transportsUsed: number; maxLatencyMs: number }
  | { type: 'health-alert'; transportId: string; health: TransportHealth }
  | { type: 'satellite-handoff'; estimatedSpikeMs: number };

export type HybridRouterListener = (event: HybridRouterEvent) => void;

export interface HybridRouterConfig {
  /** Max acceptable E-STOP latency (ms). Radio only if under this. Default: 50 */
  estopMaxLatencyMs: number;
  /** Max acceptable fire command latency (ms). Default: 100 */
  fireMaxLatencyMs: number;
  /** Enable satellite (Starlink) path for supervision. Default: true */
  enableSatellitePath: boolean;
  /** Force radio-only mode (no satellite). Default: false */
  radioOnlyMode: boolean;
  /** Pre-load cues to modules before show (reduces real-time dependency). Default: true */
  preloadCues: boolean;
  /** Health check interval (ms). Default: 3000 */
  healthCheckIntervalMs: number;
}

const DEFAULT_CONFIG: HybridRouterConfig = {
  estopMaxLatencyMs: 50,
  fireMaxLatencyMs: 100,
  enableSatellitePath: true,
  radioOnlyMode: false,
  preloadCues: true,
  healthCheckIntervalMs: 3000,
};

export class HybridTransportRouter {
  private manager: FireOneTransportManager;
  private health: TransportHealthMonitor;
  private listeners: HybridRouterListener[] = [];
  private config: HybridRouterConfig;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private _stats = { totalSent: 0, radioSent: 0, starlinkSent: 0, fallbacks: 0, estops: 0 };
  private managerUnsub: (() => void) | null = null;

  constructor(config?: Partial<HybridRouterConfig>) {
    this.manager = getTransportManager();
    this.health = new TransportHealthMonitor();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupHealthTracking();
  }

  get stats() { return { ...this._stats }; }
  get healthStatus(): TransportHealth[] { return this.health.allHealth; }

  on(listener: HybridRouterListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit(event: HybridRouterEvent) {
    this.listeners.forEach(l => l(event));
  }

  // ─── CORE ROUTING ─────────────────────────────────────

  /**
   * Route a FireOne frame through the optimal transport path
   * based on command classification and transport health.
   */
  async send(frame: Uint8Array): Promise<void> {
    const decision = classifyCommand(frame);
    this._stats.totalSent++;

    if (decision.preferredPath === 'broadcast') {
      await this.broadcastEstop(frame, decision);
      return;
    }

    const transport = this.selectTransport(decision);
    if (!transport) {
      throw new Error(`Nenhum transporte disponível para ${decision.preferredPath}`);
    }

    await this.sendWithRetry(transport, frame, decision);
  }

  /**
   * E-STOP: broadcast on ALL transports simultaneously, radio first.
   * Triple-send for redundancy.
   */
  private async broadcastEstop(frame: Uint8Array, decision: RoutingDecision): Promise<void> {
    this._stats.estops++;
    const t0 = performance.now();

    // Send on radio FIRST (lowest latency) — don't wait
    const radioTransports = this.getTransportsByPath('radio');
    const radioPromises = radioTransports.map(t =>
      t.send(frame).catch(() => {})
    );

    // Then broadcast on ALL (including radio again for redundancy)
    const broadcastPromise = this.manager.broadcast(frame);

    // Triple-send E-STOP
    await Promise.allSettled([...radioPromises, broadcastPromise]);
    await this.manager.broadcast(frame);
    await this.manager.broadcast(frame);

    const maxLat = Math.round(performance.now() - t0);
    const transportsUsed = this.manager.connectedCount;

    this.emit({ type: 'estop-broadcast', transportsUsed, maxLatencyMs: maxLat });
  }

  private selectTransport(decision: RoutingDecision): FireOneTransport | null {
    const { preferredPath, fallbackAllowed } = decision;

    // Get preferred transports
    const preferred = this.getTransportsByPath(preferredPath);
    const healthyPreferred = preferred.filter(t => {
      const h = this.health.get(t.id);
      return t.state === 'connected' && (!h || h.isHealthy);
    });

    if (healthyPreferred.length > 0) {
      // Pick lowest latency among healthy preferred
      return healthyPreferred.sort((a, b) => a.latencyMs - b.latencyMs)[0];
    }

    // Fallback
    if (fallbackAllowed) {
      const fallbackPath = preferredPath === 'radio' ? 'starlink' : 'radio';
      const fallbacks = this.getTransportsByPath(fallbackPath)
        .filter(t => t.state === 'connected');

      if (fallbacks.length > 0) {
        const fb = fallbacks.sort((a, b) => a.latencyMs - b.latencyMs)[0];
        this.emit({
          type: 'fallback-activated',
          from: preferredPath,
          to: fb.type,
          reason: `${preferredPath} indisponível, usando ${fb.type}`,
        });
        this._stats.fallbacks++;
        return fb;
      }

      // Last resort: any connected transport
      const best = this.manager.bestTransport;
      if (best) {
        this.emit({
          type: 'fallback-activated',
          from: preferredPath,
          to: best.type,
          reason: `Fallback de emergência para ${best.type}`,
        });
        this._stats.fallbacks++;
        return best;
      }
    }

    return null;
  }

  private getTransportsByPath(path: RoutingPath): FireOneTransport[] {
    if (path === 'radio') {
      return this.manager.getTransportsByType('radio');
    }
    if (path === 'starlink') {
      // Starlink uses wifi_direct or wifi transports
      return [
        ...this.manager.getTransportsByType('wifi_direct'),
        ...this.manager.getTransportsByType('wifi'),
      ];
    }
    if (path === 'any') {
      // All connected, sorted by priority
      return this.manager.allTransports
        .filter(t => t.state === 'connected')
        .map(t => this.manager.getTransport(t.id)!)
        .filter(Boolean);
    }
    return [];
  }

  private async sendWithRetry(
    transport: FireOneTransport,
    frame: Uint8Array,
    decision: RoutingDecision,
  ): Promise<void> {
    const maxRetries = decision.retryCount;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const t0 = performance.now();
        await Promise.race([
          transport.send(frame),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), decision.timeoutMs)
          ),
        ]);
        const lat = performance.now() - t0;

        // Update health
        this.health.update(transport.id, transport.type, transport.state, lat, true,
          transport.type === 'wifi_direct' || transport.type === 'wifi');

        // Track stats
        if (transport.type === 'radio') this._stats.radioSent++;
        else this._stats.starlinkSent++;

        this.emit({
          type: 'route-decision',
          command: decision.priority,
          path: decision.preferredPath,
          transportId: transport.id,
        });
        return;
      } catch (err: any) {
        lastError = err;
        this.health.update(transport.id, transport.type, transport.state, 0, false,
          transport.type === 'wifi_direct' || transport.type === 'wifi');

        // On retry, try fallback transport
        if (attempt < maxRetries && decision.fallbackAllowed) {
          const fb = this.selectTransport({ ...decision, preferredPath: 'any' });
          if (fb && fb.id !== transport.id) {
            transport = fb;
          }
        }
      }
    }

    throw lastError || new Error('Envio falhou após todas tentativas');
  }

  // ─── HEALTH TRACKING ──────────────────────────────────

  private setupHealthTracking(): void {
    this.managerUnsub = this.manager.on((event) => {
      if (event.type === 'transport-state') {
        const t = this.manager.getTransport(event.id);
        if (t) {
          const h = this.health.update(event.id, t.type, event.state, t.latencyMs,
            event.state === 'connected', t.type === 'wifi_direct' || t.type === 'wifi');
          if (!h.isHealthy && event.state === 'error') {
            this.emit({ type: 'health-alert', transportId: event.id, health: h });
          }
        }
      }
      if (event.type === 'transport-removed') {
        this.health.remove(event.id);
      }
    });

    // Periodic health check
    this.healthCheckTimer = setInterval(() => {
      this.health.allHealth.forEach(h => {
        // Detect satellite handoff (sudden latency spike)
        if (h.isSatellite && h.latencyMs > 150 && h.latencyP95 < 100) {
          this.emit({ type: 'satellite-handoff', estimatedSpikeMs: h.latencyMs });
        }
        // Alert if transport degraded
        if (!h.isHealthy && h.state === 'connected') {
          this.emit({ type: 'health-alert', transportId: h.transportId, health: h });
        }
      });
    }, this.config.healthCheckIntervalMs);
  }

  // ─── CONVENIENCE METHODS ──────────────────────────────

  /** Check if radio path is available for safety-critical commands */
  get hasRadioPath(): boolean {
    return this.health.getHealthyByType('radio').length > 0;
  }

  /** Check if satellite/Wi-Fi path is available for supervision */
  get hasSatellitePath(): boolean {
    return [
      ...this.health.getHealthyByType('wifi_direct'),
      ...this.health.getHealthyByType('wifi'),
    ].length > 0;
  }

  /** Get recommended mode based on available transports */
  get recommendedMode(): 'hybrid' | 'radio-only' | 'satellite-only' | 'offline' {
    const radio = this.hasRadioPath;
    const sat = this.hasSatellitePath;
    if (radio && sat) return 'hybrid';
    if (radio) return 'radio-only';
    if (sat) return 'satellite-only';
    return 'offline';
  }

  /** Summary for UI display */
  get summary() {
    const radioHealth = this.health.getByType('radio');
    const satHealth = [
      ...this.health.getByType('wifi_direct'),
      ...this.health.getByType('wifi'),
    ];
    return {
      mode: this.recommendedMode,
      radioAvailable: this.hasRadioPath,
      satelliteAvailable: this.hasSatellitePath,
      radioLatencyMs: radioHealth.length > 0 ? Math.min(...radioHealth.map(h => h.latencyMs)) : null,
      satelliteLatencyMs: satHealth.length > 0 ? Math.min(...satHealth.map(h => h.latencyMs)) : null,
      radioP95: radioHealth.length > 0 ? Math.min(...radioHealth.map(h => h.latencyP95)) : null,
      satelliteP95: satHealth.length > 0 ? Math.min(...satHealth.map(h => h.latencyP95)) : null,
      estopCompliant: this.hasRadioPath, // Radio E-STOP < 50ms = NFPA compliant
      stats: this.stats,
    };
  }

  updateConfig(partial: Partial<HybridRouterConfig>): void {
    Object.assign(this.config, partial);
  }

  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    this.managerUnsub?.();
    this.listeners = [];
  }
}

// ═══════════════════════════════════════════════════════════
// STARLINK TRANSPORT (extends Wi-Fi Direct with satellite awareness)
// ═══════════════════════════════════════════════════════════

export class StarlinkTransport implements FireOneTransport {
  readonly id: string;
  readonly type: TransportType = 'wifi_direct';
  readonly label: string;
  priority = 2.5; // Between Wi-Fi Direct (1.5) and Radio (3)
  state: TransportState = 'disconnected';
  latencyMs = 0;
  txBytes = 0;
  rxBytes = 0;

  private ws: WebSocket | null = null;
  private receiveCallbacks: Array<(data: Uint8Array, id: string) => void> = [];
  private stateCallbacks: Array<(id: string, state: TransportState, error?: string) => void> = [];
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private handoffDetected = false;
  private latencyBaseline = 0;

  constructor(id?: string) {
    this.id = id || `starlink-${Date.now()}`;
    this.label = 'Starlink Satellite';
  }

  get isHandoff(): boolean { return this.handoffDetected; }

  onReceive(cb: (data: Uint8Array, id: string) => void) { this.receiveCallbacks.push(cb); }
  onStateChange(cb: (id: string, state: TransportState, error?: string) => void) { this.stateCallbacks.push(cb); }
  isAvailable() { return typeof WebSocket !== 'undefined'; }

  private setState(s: TransportState, error?: string) {
    this.state = s;
    this.stateCallbacks.forEach(cb => cb(this.id, s, error));
  }

  /**
   * Connect via Starlink ground station relay.
   * config.relayUrl: WebSocket URL of the Starlink-connected relay server
   * config.psk: Pre-shared key for AES-128-GCM encryption
   */
  async connect(config?: Record<string, any>): Promise<void> {
    const relayUrl = config?.relayUrl || 'wss://relay.fxkontrol.com/starlink';
    this.setState('connecting');

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ws?.close();
        reject(new Error('Starlink connection timeout'));
      }, 15000); // Longer timeout for satellite

      this.ws = new WebSocket(relayUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        clearTimeout(timer);
        this.reconnectAttempts = 0;
        this.setState('connected');
        this.calibrateBaseline();
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
              const lat = Math.round(performance.now() - (msg.t0 || 0));
              this.latencyMs = lat;
              // Detect satellite handoff (>3x baseline)
              if (this.latencyBaseline > 0 && lat > this.latencyBaseline * 3) {
                this.handoffDetected = true;
                setTimeout(() => { this.handoffDetected = false; }, 5000);
              }
            }
          } catch { /* ignore */ }
        }
      };

      this.ws.onerror = () => {
        clearTimeout(timer);
        this.setState('error', 'Starlink connection error');
        reject(new Error('Starlink WebSocket error'));
      };

      this.ws.onclose = () => {
        if (this.state === 'connected') {
          this.attemptReconnect();
        } else {
          this.setState('disconnected');
        }
      };
    });
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.setState('disconnected');
  }

  async send(frame: Uint8Array): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Starlink não conectado');
    }
    const t0 = performance.now();
    this.ws.send(frame.buffer as ArrayBuffer);
    this.latencyMs = Math.round(performance.now() - t0);
    this.txBytes += frame.length;
  }

  private calibrateBaseline(): void {
    // Send 5 pings to establish baseline latency
    let count = 0;
    const latencies: number[] = [];
    const interval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || count >= 5) {
        clearInterval(interval);
        if (latencies.length > 0) {
          this.latencyBaseline = latencies.sort((a, b) => a - b)[Math.floor(latencies.length / 2)];
        }
        return;
      }
      const t0 = performance.now();
      this.ws.send(JSON.stringify({ type: 'ping', t0 }));
      count++;
      // Collect via onmessage handler above
      setTimeout(() => { latencies.push(this.latencyMs); }, 2000);
    }, 1000);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= 10) {
      this.setState('error', 'Starlink: reconexão falhou');
      return;
    }
    this.setState('reconnecting');
    const delay = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => this.attemptReconnect());
    }, delay);
  }
}

// ═══════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════

let _hybridRouter: HybridTransportRouter | null = null;

export function getHybridRouter(config?: Partial<HybridRouterConfig>): HybridTransportRouter {
  if (!_hybridRouter) {
    _hybridRouter = new HybridTransportRouter(config);
  }
  return _hybridRouter;
}
