/**
 * ─── Flockwave Protocol Engine ─────────────────────────────────────
 * WebSocket-based communication protocol compatible with Skybrush Server.
 * Implements the Flockwave JSON-RPC protocol for UAV fleet management.
 * 
 * Protocol spec: https://doc.collmot.com/public/skybrush-protocol-spec/
 * 
 * Message types:
 *   SYS-*   System info & time sync
 *   UAV-*   UAV telemetry & commands
 *   SHOW-*  Show management & execution
 *   CONN-*  Connection management
 *   DEV-*   Device tree queries
 */

// ── Types ───────────────────────────────────────────────────────────

export interface FlockwaveMessage {
  type: string;
  id?: string;
  body?: Record<string, unknown>;
}

export interface UAVStatus {
  id: string;
  position: { lat: number; lon: number; alt: number; altMSL: number };
  velocity: { vx: number; vy: number; vz: number };
  attitude: { roll: number; pitch: number; yaw: number };
  battery: { voltage: number; percentage: number; charging: boolean };
  gps: { fix: number; numSat: number; hAcc: number; vAcc: number };
  signal: { rssi: number; quality: number };
  mode: 'idle' | 'takeoff' | 'hovering' | 'mission' | 'rth' | 'landing' | 'landed' | 'error';
  armed: boolean;
  errors: string[];
  light: { r: number; g: number; b: number };
  timestamp: number;
}

export interface ShowUploadData {
  trajectories: ShowTrajectory[];
  lightProgram: LightKeyframe[][];
  startMethod: 'rc' | 'auto' | 'gps_time';
  startTime?: number; // Unix timestamp for GPS-based start
  coordinateSystem: 'neu' | 'ned' | 'enu';
  origin: { lat: number; lon: number; altMSL: number };
}

export interface ShowTrajectory {
  droneId: string;
  points: { t: number; x: number; y: number; z: number }[];
}

export interface LightKeyframe {
  t: number;
  r: number;
  g: number;
  b: number;
  w?: number;
}

export interface GeofenceConfig {
  enabled: boolean;
  maxAltitude: number;
  maxDistance: number;
  polygon: { lat: number; lon: number }[];
  action: 'land' | 'rth' | 'hover' | 'report' | 'shutoff';
  rallyPoint?: { lat: number; lon: number; alt: number };
}

export interface PreflightResult {
  droneId: string;
  checks: PreflightCheck[];
  passed: boolean;
  timestamp: number;
}

export interface PreflightCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  value?: number;
  threshold?: number;
}

export interface ClockSyncState {
  offset: number; // ms offset from server
  roundTrip: number; // ms round-trip latency
  synced: boolean;
  lastSync: number;
  serverTime: number;
}

// ── Protocol Constants ──────────────────────────────────────────────

export const FLOCKWAVE_VERSION = '1.0';
export const HEARTBEAT_INTERVAL = 1000;
export const CLOCK_SYNC_INTERVAL = 5000;
export const TELEMETRY_RATE = 4; // Hz

// ── Message Builders ────────────────────────────────────────────────

let messageCounter = 0;

function createMessage(type: string, body?: Record<string, unknown>): FlockwaveMessage {
  return {
    type,
    id: `msg-${++messageCounter}-${Date.now().toString(36)}`,
    body: body ?? {},
  };
}

// System messages
export const SYS = {
  ping: () => createMessage('SYS-PING', { timestamp: Date.now() }),
  info: () => createMessage('SYS-INF'),
  time: () => createMessage('SYS-TIME', { timestamp: Date.now() }),
  version: () => createMessage('SYS-VER'),
  close: () => createMessage('SYS-CLOSE'),
};

// UAV messages
export const UAV = {
  list: () => createMessage('UAV-LIST'),
  info: (ids: string[]) => createMessage('UAV-INF', { ids }),
  cmd: (id: string, command: string, args?: Record<string, unknown>) =>
    createMessage('UAV-CMD', { id, command, args }),
  takeoff: (ids: string[]) => createMessage('UAV-TAKEOFF', { ids }),
  land: (ids: string[]) => createMessage('UAV-LAND', { ids }),
  rth: (ids: string[]) => createMessage('UAV-RTH', { ids }),
  hover: (ids: string[]) => createMessage('UAV-HOVER', { ids }),
  motorOn: (ids: string[]) => createMessage('UAV-MOTOR-ON', { ids }),
  motorOff: (ids: string[]) => createMessage('UAV-MOTOR-OFF', { ids }),
  setLight: (ids: string[], color: { r: number; g: number; b: number }) =>
    createMessage('UAV-LIGHT', { ids, color }),
  signal: (ids: string[], signal: 'beep' | 'flash' | 'both') =>
    createMessage('UAV-SIGNAL', { ids, signal }),
  preflight: (ids: string[]) => createMessage('UAV-PREFLIGHT', { ids }),
  powerOff: (ids: string[]) => createMessage('UAV-PWROFF', { ids }),
  reboot: (ids: string[]) => createMessage('UAV-REBOOT', { ids }),
};

// Show messages
export const SHOW = {
  upload: (data: ShowUploadData) => createMessage('SHOW-UPLOAD', { data }),
  start: () => createMessage('SHOW-START'),
  pause: () => createMessage('SHOW-PAUSE'),
  resume: () => createMessage('SHOW-RESUME'),
  stop: () => createMessage('SHOW-STOP'),
  status: () => createMessage('SHOW-STATUS'),
  setStartTime: (timestamp: number) => createMessage('SHOW-SETTIME', { timestamp }),
  setStartMethod: (method: 'rc' | 'auto' | 'gps_time') =>
    createMessage('SHOW-SETMETHOD', { method }),
  authorize: (code: string) => createMessage('SHOW-AUTH', { code }),
};

// Connection messages
export const CONN = {
  list: () => createMessage('CONN-LIST'),
  info: (ids: string[]) => createMessage('CONN-INF', { ids }),
};

// Device tree messages
export const DEV = {
  list: () => createMessage('DEV-LIST'),
  info: (paths: string[]) => createMessage('DEV-INF', { paths }),
  subscribe: (paths: string[]) => createMessage('DEV-SUB', { paths }),
};

// ── Client Class ────────────────────────────────────────────────────

export type FlockwaveEventHandler = (msg: FlockwaveMessage) => void;
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export class FlockwaveClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<FlockwaveEventHandler>>();
  private pendingRequests = new Map<string, {
    resolve: (value: FlockwaveMessage) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private clockSyncTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  
  state: ConnectionState = 'disconnected';
  clockSync: ClockSyncState = {
    offset: 0,
    roundTrip: 0,
    synced: false,
    lastSync: 0,
    serverTime: 0,
  };
  uavs = new Map<string, UAVStatus>();
  
  constructor(private url: string = 'ws://localhost:5000/api/v1/ws') {}

  // ── Connection ──────────────────────────────────────────────────

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      
      this.state = 'connecting';
      this.emit('state-change', createMessage('STATE', { state: this.state }));
      
      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        this.state = 'error';
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        this.state = 'connected';
        this.reconnectAttempts = 0;
        this.emit('state-change', createMessage('STATE', { state: this.state }));
        this.startHeartbeat();
        this.startClockSync();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: FlockwaveMessage = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch {
          // Ignore malformed messages
        }
      };

      this.ws.onerror = () => {
        this.state = 'error';
        this.emit('state-change', createMessage('STATE', { state: this.state }));
      };

      this.ws.onclose = () => {
        this.state = 'disconnected';
        this.stopHeartbeat();
        this.stopClockSync();
        this.emit('state-change', createMessage('STATE', { state: this.state }));
        this.attemptReconnect();
      };
    });
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.maxReconnectAttempts = 0; // prevent auto-reconnect
    this.stopHeartbeat();
    this.stopClockSync();
    this.ws?.close();
    this.ws = null;
    this.state = 'disconnected';
    this.uavs.clear();
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect().catch(() => {}), delay);
  }

  // ── Message Handling ────────────────────────────────────────────

  private handleMessage(msg: FlockwaveMessage) {
    // Resolve pending request
    if (msg.id && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(msg.id);
      pending.resolve(msg);
    }

    // Handle UAV telemetry updates
    if (msg.type === 'UAV-INF' && msg.body) {
      this.processUAVInfo(msg.body);
    }

    // Handle clock sync response
    if (msg.type === 'SYS-TIME' && msg.body) {
      this.processClockSync(msg.body);
    }

    // Emit to type-specific handlers
    this.emit(msg.type, msg);
    this.emit('*', msg); // wildcard handler
  }

  private processUAVInfo(body: Record<string, unknown>) {
    const statuses = body.status as Record<string, unknown> | undefined;
    if (!statuses) return;

    for (const [id, data] of Object.entries(statuses)) {
      const d = data as Record<string, unknown>;
      const existing = this.uavs.get(id);
      const status: UAVStatus = {
        id,
        position: (d.position as UAVStatus['position']) ?? existing?.position ?? { lat: 0, lon: 0, alt: 0, altMSL: 0 },
        velocity: (d.velocity as UAVStatus['velocity']) ?? existing?.velocity ?? { vx: 0, vy: 0, vz: 0 },
        attitude: (d.attitude as UAVStatus['attitude']) ?? existing?.attitude ?? { roll: 0, pitch: 0, yaw: 0 },
        battery: (d.battery as UAVStatus['battery']) ?? existing?.battery ?? { voltage: 0, percentage: 0, charging: false },
        gps: (d.gps as UAVStatus['gps']) ?? existing?.gps ?? { fix: 0, numSat: 0, hAcc: 99, vAcc: 99 },
        signal: (d.signal as UAVStatus['signal']) ?? existing?.signal ?? { rssi: -100, quality: 0 },
        mode: (d.mode as UAVStatus['mode']) ?? existing?.mode ?? 'idle',
        armed: (d.armed as boolean) ?? existing?.armed ?? false,
        errors: (d.errors as string[]) ?? existing?.errors ?? [],
        light: (d.light as UAVStatus['light']) ?? existing?.light ?? { r: 0, g: 0, b: 0 },
        timestamp: Date.now(),
      };
      this.uavs.set(id, status);
    }

    this.emit('uav-update', createMessage('UAV-UPDATE', {
      count: this.uavs.size,
      ids: Array.from(this.uavs.keys()),
    }));
  }

  private processClockSync(body: Record<string, unknown>) {
    const serverTime = body.timestamp as number;
    const clientSendTime = body.clientTimestamp as number;
    if (!serverTime) return;

    const now = Date.now();
    const roundTrip = clientSendTime ? now - clientSendTime : 0;
    const oneWay = roundTrip / 2;
    this.clockSync = {
      offset: serverTime - (now - oneWay),
      roundTrip,
      synced: true,
      lastSync: now,
      serverTime: serverTime + oneWay,
    };
    this.emit('clock-sync', createMessage('CLOCK-SYNC', { sync: this.clockSync }));
  }

  // ── Heartbeat & Clock Sync ──────────────────────────────────────

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.send(SYS.ping()).catch(() => {});
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  private startClockSync() {
    this.clockSyncTimer = setInterval(() => {
      this.send(SYS.time()).catch(() => {});
    }, CLOCK_SYNC_INTERVAL);
    // Immediate first sync
    this.send(SYS.time()).catch(() => {});
  }

  private stopClockSync() {
    if (this.clockSyncTimer) clearInterval(this.clockSyncTimer);
    this.clockSyncTimer = null;
  }

  // ── Send ────────────────────────────────────────────────────────

  send(msg: FlockwaveMessage, timeout = 5000): Promise<FlockwaveMessage> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('Not connected'));
        return;
      }

      const timeoutHandle = setTimeout(() => {
        if (msg.id) this.pendingRequests.delete(msg.id);
        reject(new Error(`Timeout: ${msg.type}`));
      }, timeout);

      if (msg.id) {
        this.pendingRequests.set(msg.id, { resolve, reject, timeout: timeoutHandle });
      }

      this.ws.send(JSON.stringify(msg));

      if (!msg.id) {
        clearTimeout(timeoutHandle);
        resolve(msg);
      }
    });
  }

  // ── Event System ────────────────────────────────────────────────

  on(type: string, handler: FlockwaveEventHandler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  off(type: string, handler: FlockwaveEventHandler) {
    this.handlers.get(type)?.delete(handler);
  }

  private emit(type: string, msg: FlockwaveMessage) {
    this.handlers.get(type)?.forEach(h => h(msg));
  }

  // ── Convenience Methods ─────────────────────────────────────────

  async listUAVs(): Promise<string[]> {
    const res = await this.send(UAV.list());
    return (res.body?.ids as string[]) ?? [];
  }

  async requestTelemetry(ids: string[]): Promise<void> {
    await this.send(UAV.info(ids));
  }

  async uploadShow(data: ShowUploadData): Promise<boolean> {
    const res = await this.send(SHOW.upload(data), 30000);
    return res.body?.success as boolean ?? false;
  }

  async startShow(): Promise<boolean> {
    const res = await this.send(SHOW.start());
    return res.body?.success as boolean ?? false;
  }

  async pauseShow(): Promise<void> {
    await this.send(SHOW.pause());
  }

  async stopShow(): Promise<void> {
    await this.send(SHOW.stop());
  }

  async setGeofence(config: GeofenceConfig): Promise<void> {
    await this.send(createMessage('GEO-SET', { config }));
  }

  async runPreflight(ids: string[]): Promise<PreflightResult[]> {
    const res = await this.send(UAV.preflight(ids), 15000);
    return (res.body?.results as PreflightResult[]) ?? [];
  }

  getServerTime(): number {
    return Date.now() + this.clockSync.offset;
  }

  getUAV(id: string): UAVStatus | undefined {
    return this.uavs.get(id);
  }

  getAllUAVs(): UAVStatus[] {
    return Array.from(this.uavs.values());
  }
}

// ── Singleton Instance ──────────────────────────────────────────────

export const flockwave = new FlockwaveClient();
