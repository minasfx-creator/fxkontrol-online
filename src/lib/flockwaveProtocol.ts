/**
 * ─── Flockwave Protocol Engine v2 ──────────────────────────────────
 * Full-spec Flockwave JSON-RPC protocol for Skybrush Server.
 * Based on: https://doc.collmot.com/public/skybrush-protocol-spec/
 * 
 * Envelope format: { "$fw.version": "1.0", id, refs, body }
 * Message categories:
 *   AUTH-*   Authentication
 *   SYS-*   System info, time sync, version
 *   UAV-*   UAV telemetry, commands, calibration
 *   SHOW-*  Show config, upload, execution
 *   CONN-*  Connection management
 *   DEV-*   Device tree queries
 *   OBJ-*   Generic object operations
 *   GEO-*   Geofence management
 */

// ── Types ───────────────────────────────────────────────────────────

export interface FlockwaveEnvelope {
  '$fw.version': string;
  id?: string;
  refs?: string;
  body: FlockwaveBody;
  error?: { code: number; message: string };
}

export interface FlockwaveBody {
  type: string;
  [key: string]: unknown;
}

/** Legacy compat */
export interface FlockwaveMessage {
  type: string;
  id?: string;
  body?: Record<string, unknown>;
}

export type AuthorizationScope = 'none' | 'live' | 'rehearsal';
export type StartMethod = 'rc' | 'auto' | 'gps_time';

export interface DroneShowConfiguration {
  start: {
    authorized: boolean;
    authorizationScope: AuthorizationScope;
    clock: string | null;
    time: number | null;
    method: StartMethod;
    uavIds: string[];
  };
  mapping: (string | null)[];
  duration: number;
  environment?: {
    type: 'indoor' | 'outdoor';
  };
}

export interface UAVStatus {
  id: string;
  position: { lat: number; lon: number; alt: number; altMSL: number };
  velocity: { vx: number; vy: number; vz: number };
  attitude: { roll: number; pitch: number; yaw: number };
  battery: { voltage: number; percentage: number; charging: boolean };
  gps: { fix: number; numSat: number; hAcc: number; vAcc: number };
  signal: { rssi: number; quality: number };
  mode: UAVMode;
  armed: boolean;
  errors: string[];
  light: { r: number; g: number; b: number };
  timestamp: number;
  // Extended fields from Skybrush
  heading?: number;
  debug?: string;
  age?: number; // ms since last telemetry
  missionProgress?: number; // 0-1
  positionXYZ?: { x: number; y: number; z: number }; // local NEU coords
}

export type UAVMode = 'idle' | 'takeoff' | 'hovering' | 'mission' | 'rth' | 'landing' | 'landed' | 'error' | 'preflight' | 'motor_test' | 'calibrating';

export interface ShowUploadData {
  trajectories: ShowTrajectory[];
  lightProgram: LightKeyframe[][];
  startMethod: StartMethod;
  startTime?: number;
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
  action: GeofenceAction;
  rallyPoint?: { lat: number; lon: number; alt: number };
  inclusionZones?: GeofenceZone[];
  exclusionZones?: GeofenceZone[];
}

export type GeofenceAction = 'land' | 'rth' | 'hover' | 'report' | 'shutoff';

export interface GeofenceZone {
  id: string;
  name: string;
  type: 'inclusion' | 'exclusion';
  polygon: { lat: number; lon: number }[];
  minAlt?: number;
  maxAlt?: number;
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
  offset: number;
  roundTrip: number;
  synced: boolean;
  lastSync: number;
  serverTime: number;
}

export interface ServerInfo {
  name: string;
  version: string;
  platform: string;
  features: string[];
  extensions: string[];
}

export interface ConnectionInfo {
  id: string;
  purpose: string;
  description: string;
  status: 'connected' | 'disconnected' | 'error';
  statistics?: { sent: number; received: number; errors: number };
}

export interface UAVCalibrationRequest {
  component: 'baro' | 'compass' | 'esc' | 'gyro' | 'imu' | 'led' | 'motor' | 'rc';
  params?: Record<string, unknown>;
}

// ── Protocol Constants ──────────────────────────────────────────────

export const FLOCKWAVE_VERSION = '1.0';
export const HEARTBEAT_INTERVAL = 1000;
export const CLOCK_SYNC_INTERVAL = 5000;
export const TELEMETRY_RATE = 4; // Hz
export const DEFAULT_REQUEST_TIMEOUT = 5000;
export const SHOW_UPLOAD_TIMEOUT = 30000;

// ── Envelope Builder ────────────────────────────────────────────────

let messageCounter = 0;

function createEnvelope(body: FlockwaveBody, refs?: string): FlockwaveEnvelope {
  return {
    '$fw.version': FLOCKWAVE_VERSION,
    id: `msg-${++messageCounter}-${Date.now().toString(36)}`,
    ...(refs ? { refs } : {}),
    body,
  };
}

/** Legacy helper */
function createMessage(type: string, fields?: Record<string, unknown>): FlockwaveMessage {
  return {
    type,
    id: `msg-${++messageCounter}-${Date.now().toString(36)}`,
    body: { type, ...(fields ?? {}) },
  };
}

// ── Message Builders ────────────────────────────────────────────────

// Authentication
export const AUTH = {
  info: () => createMessage('AUTH-INF'),
  request: (method: string, data?: string) =>
    createMessage('AUTH-REQ', { method, data }),
  whoami: () => createMessage('AUTH-WHOAMI'),
};

// System
export const SYS = {
  ping: () => createMessage('SYS-PING', { timestamp: Date.now() }),
  info: () => createMessage('SYS-INF'),
  time: () => createMessage('SYS-TIME', { timestamp: Date.now() }),
  version: () => createMessage('SYS-VER'),
  close: () => createMessage('SYS-CLOSE'),
};

// UAV
export const UAV = {
  list: () => createMessage('UAV-LIST'),
  info: (ids: string[]) => createMessage('UAV-INF', { ids }),
  cmd: (id: string, command: string, args?: Record<string, unknown>) =>
    createMessage('OBJ-CMD', { ids: [id], command, args }),
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
  calibrate: (ids: string[], req: UAVCalibrationRequest) =>
    createMessage('UAV-CALIB', { ids, component: req.component, params: req.params }),
  flyTo: (id: string, target: { lat: number; lon: number; alt?: number }) =>
    createMessage('UAV-FLY', { ids: [id], target }),
  setParameter: (id: string, name: string, value: unknown) =>
    createMessage('UAV-PARAM', { id, name, value }),
};

// Show management (matches SHOW-* from official spec)
export const SHOW = {
  config: () => createMessage('SHOW-CFG'),
  setConfig: (config: Partial<DroneShowConfiguration>) =>
    createMessage('SHOW-SETCFG', { configuration: config }),
  upload: (data: ShowUploadData) => createMessage('SHOW-UPLOAD', { data }),
  start: () => createMessage('SHOW-START'),
  pause: () => createMessage('SHOW-PAUSE'),
  resume: () => createMessage('SHOW-RESUME'),
  stop: () => createMessage('SHOW-STOP'),
  status: () => createMessage('SHOW-STATUS'),
  setStartTime: (timestamp: number) =>
    createMessage('SHOW-SETCFG', { configuration: { start: { time: timestamp } } }),
  setStartMethod: (method: StartMethod) =>
    createMessage('SHOW-SETCFG', { configuration: { start: { method } } }),
  authorize: (scope: AuthorizationScope = 'live') =>
    createMessage('SHOW-SETCFG', {
      configuration: { start: { authorized: true, authorizationScope: scope } },
    }),
  deauthorize: () =>
    createMessage('SHOW-SETCFG', {
      configuration: { start: { authorized: false, authorizationScope: 'none' } },
    }),
  setMapping: (mapping: (string | null)[]) =>
    createMessage('SHOW-SETCFG', { configuration: { mapping } }),
  setDuration: (duration: number) =>
    createMessage('SHOW-SETCFG', { configuration: { duration } }),
};

// Connection management
export const CONN = {
  list: () => createMessage('CONN-LIST'),
  info: (ids: string[]) => createMessage('CONN-INF', { ids }),
};

// Device tree
export const DEV = {
  list: () => createMessage('DEV-LIST'),
  listPaths: (ids: string[]) => createMessage('DEV-LISTP', { ids }),
  info: (paths: string[]) => createMessage('DEV-INF', { paths }),
  subscribe: (paths: string[]) => createMessage('DEV-SUB', { paths }),
  unsubscribe: (paths: string[]) => createMessage('DEV-UNSUB', { paths }),
};

// Object operations
export const OBJ = {
  list: (filter?: string) => createMessage('OBJ-LIST', { filter }),
  cmd: (ids: string[], command: string, args?: Record<string, unknown>) =>
    createMessage('OBJ-CMD', { ids, command, args }),
};

// Geofence
export const GEO = {
  set: (config: GeofenceConfig) => createMessage('GEO-SET', { config }),
  get: () => createMessage('GEO-GET'),
  clear: () => createMessage('GEO-CLEAR'),
};

// ── Client Class ────────────────────────────────────────────────────

export type FlockwaveEventHandler = (msg: FlockwaveMessage) => void;
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'authenticating';

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
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  state: ConnectionState = 'disconnected';
  serverInfo: ServerInfo | null = null;
  showConfig: DroneShowConfiguration | null = null;
  connections: ConnectionInfo[] = [];
  clockSync: ClockSyncState = {
    offset: 0, roundTrip: 0, synced: false, lastSync: 0, serverTime: 0,
  };
  uavs = new Map<string, UAVStatus>();

  constructor(private url: string = 'ws://localhost:5000/api/v1/ws') {}

  // ── Connection ──────────────────────────────────────────────────

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) { resolve(); return; }

      this.state = 'connecting';
      this.emit('state-change', createMessage('STATE', { state: this.state }));

      try { this.ws = new WebSocket(this.url); }
      catch (err) { this.state = 'error'; reject(err); return; }

      this.ws.onopen = async () => {
        this.state = 'connected';
        this.reconnectAttempts = 0;
        this.emit('state-change', createMessage('STATE', { state: this.state }));
        this.startHeartbeat();
        this.startClockSync();
        this.startTelemetryPolling();
        // Initial handshake
        this.requestServerInfo().catch(() => {});
        this.requestShowConfig().catch(() => {});
        this.requestConnections().catch(() => {});
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          // Handle both envelope and legacy format
          const msg: FlockwaveMessage = raw.body
            ? { type: raw.body.type, id: raw.id, body: raw.body }
            : raw;
          if (raw.refs && this.pendingRequests.has(raw.refs)) {
            const pending = this.pendingRequests.get(raw.refs)!;
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(raw.refs);
            pending.resolve(msg);
          }
          this.handleMessage(msg);
        } catch { /* ignore malformed */ }
      };

      this.ws.onerror = () => {
        this.state = 'error';
        this.emit('state-change', createMessage('STATE', { state: this.state }));
      };

      this.ws.onclose = () => {
        this.state = 'disconnected';
        this.stopAll();
        this.emit('state-change', createMessage('STATE', { state: this.state }));
        this.attemptReconnect();
      };
    });
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.maxReconnectAttempts = 0;
    this.stopAll();
    this.ws?.close();
    this.ws = null;
    this.state = 'disconnected';
    this.uavs.clear();
    this.serverInfo = null;
    this.showConfig = null;
  }

  private stopAll() {
    this.stopHeartbeat();
    this.stopClockSync();
    if (this.telemetryTimer) clearInterval(this.telemetryTimer);
    this.telemetryTimer = null;
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => this.connect().catch(() => {}), delay);
  }

  // ── Message Handling ────────────────────────────────────────────

  private handleMessage(msg: FlockwaveMessage) {
    // Resolve pending request (legacy id match)
    if (msg.id && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id)!;
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(msg.id);
      pending.resolve(msg);
    }

    // Handle UAV telemetry
    if (msg.type === 'UAV-INF' && msg.body) this.processUAVInfo(msg.body);

    // Handle clock sync
    if (msg.type === 'SYS-TIME' && msg.body) this.processClockSync(msg.body);

    // Handle server info
    if (msg.type === 'SYS-VER' && msg.body) {
      this.serverInfo = {
        name: (msg.body.name as string) ?? 'Skybrush Server',
        version: (msg.body.version as string) ?? 'unknown',
        platform: (msg.body.platform as string) ?? 'unknown',
        features: (msg.body.features as string[]) ?? [],
        extensions: (msg.body.extensions as string[]) ?? [],
      };
      this.emit('server-info', msg);
    }

    // Handle show config updates
    if (msg.type === 'SHOW-CFG' && msg.body?.configuration) {
      this.showConfig = msg.body.configuration as unknown as DroneShowConfiguration;
      this.emit('show-config', msg);
    }

    // Handle connection updates
    if (msg.type === 'CONN-INF' && msg.body?.status) {
      const connStatus = msg.body.status as Record<string, ConnectionInfo>;
      this.connections = Object.values(connStatus);
      this.emit('connections', msg);
    }

    // Emit
    this.emit(msg.type, msg);
    this.emit('*', msg);
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
        mode: (d.mode as UAVMode) ?? existing?.mode ?? 'idle',
        armed: (d.armed as boolean) ?? existing?.armed ?? false,
        errors: (d.errors as string[]) ?? existing?.errors ?? [],
        light: (d.light as UAVStatus['light']) ?? existing?.light ?? { r: 0, g: 0, b: 0 },
        timestamp: Date.now(),
        heading: (d.heading as number) ?? existing?.heading,
        debug: (d.debug as string) ?? existing?.debug,
        missionProgress: (d.missionProgress as number) ?? existing?.missionProgress,
        positionXYZ: (d.positionXYZ as UAVStatus['positionXYZ']) ?? existing?.positionXYZ,
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

  // ── Timers ─────────────────────────────────────────────────────

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
    this.send(SYS.time()).catch(() => {});
  }

  private stopClockSync() {
    if (this.clockSyncTimer) clearInterval(this.clockSyncTimer);
    this.clockSyncTimer = null;
  }

  private startTelemetryPolling() {
    this.telemetryTimer = setInterval(() => {
      const ids = Array.from(this.uavs.keys());
      if (ids.length > 0) this.send(UAV.info(ids)).catch(() => {});
    }, 1000 / TELEMETRY_RATE);
  }

  // ── Send ────────────────────────────────────────────────────────

  send(msg: FlockwaveMessage, timeout = DEFAULT_REQUEST_TIMEOUT): Promise<FlockwaveMessage> {
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

      // Send as proper envelope
      const envelope: FlockwaveEnvelope = {
        '$fw.version': FLOCKWAVE_VERSION,
        id: msg.id,
        body: { type: msg.type, ...(msg.body ?? {}) },
      };
      this.ws.send(JSON.stringify(envelope));

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

  async requestServerInfo(): Promise<ServerInfo | null> {
    const res = await this.send(SYS.version());
    return this.serverInfo;
  }

  async requestShowConfig(): Promise<DroneShowConfiguration | null> {
    await this.send(SHOW.config());
    return this.showConfig;
  }

  async requestConnections(): Promise<ConnectionInfo[]> {
    await this.send(CONN.list());
    return this.connections;
  }

  async listUAVs(): Promise<string[]> {
    const res = await this.send(UAV.list());
    return (res.body?.ids as string[]) ?? [];
  }

  async requestTelemetry(ids: string[]): Promise<void> {
    await this.send(UAV.info(ids));
  }

  async uploadShow(data: ShowUploadData): Promise<boolean> {
    const res = await this.send(SHOW.upload(data), SHOW_UPLOAD_TIMEOUT);
    return res.body?.success as boolean ?? false;
  }

  async authorizeShow(scope: AuthorizationScope = 'live'): Promise<void> {
    await this.send(SHOW.authorize(scope));
  }

  async deauthorizeShow(): Promise<void> {
    await this.send(SHOW.deauthorize());
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

  async clearGeofence(): Promise<void> {
    await this.send(GEO.clear());
  }

  async runPreflight(ids: string[]): Promise<PreflightResult[]> {
    const res = await this.send(UAV.preflight(ids), 15000);
    return (res.body?.results as PreflightResult[]) ?? [];
  }

  async calibrateUAV(ids: string[], component: UAVCalibrationRequest['component']): Promise<void> {
    await this.send(UAV.calibrate(ids, { component }));
  }

  async flyTo(id: string, target: { lat: number; lon: number; alt?: number }): Promise<void> {
    await this.send(UAV.flyTo(id, target));
  }

  async setDroneMapping(mapping: (string | null)[]): Promise<void> {
    await this.send(SHOW.setMapping(mapping));
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
