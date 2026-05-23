/**
 * ─── Cluster Sync Engine ────────────────────────────────────────────
 * Master/Client distributed rendering.
 * Master broadcasts camera, time, physics, quality at 30-60 FPS.
 * Clients interpolate — never snap. Fallback to last valid state.
 */

export type ClusterRole = 'master' | 'client' | 'standalone';

export interface ClusterFrame {
  seq: number;
  t: number;           // timeline time
  camera: {
    px: number; py: number; pz: number;
    rx: number; ry: number; rz: number;
    fov: number;
  };
  physics: {
    windX: number; windY: number; windZ: number;
    drag: number;
    turbulence: number;
  };
  qualityLevel: number; // 0-4 maps to QualityTier
  timestamp: number;
}

export interface ClusterState {
  role: ClusterRole;
  connected: boolean;
  masterSeq: number;
  clientCount: number;
  latencyMs: number;
  lastFrame: ClusterFrame | null;
  desyncCount: number;
}

const DESYNC_THRESHOLD = 30; // frame seq gap before forced resync
const LERP_SPEED = 0.15;

class ClusterSyncEngine {
  private role: ClusterRole = 'standalone';
  private seq = 0;
  private broadcastChannel: BroadcastChannel | null = null;
  private ws: WebSocket | null = null;
  private wsUrl: string | null = null;
  private lastFrame: ClusterFrame | null = null;
  private targetFrame: ClusterFrame | null = null;
  private interpolatedFrame: ClusterFrame | null = null;
  private clientCount = 0;
  private desyncCount = 0;
  private latencyMs = 0;
  private listeners = new Set<(frame: ClusterFrame) => void>();
  private _connected = false;

  /** Start as master or client */
  start(role: ClusterRole, wsUrl?: string): void {
    this.role = role;
    this.wsUrl = wsUrl ?? null;

    // BroadcastChannel for same-machine tabs
    try {
      this.broadcastChannel = new BroadcastChannel('fxk-cluster-sync');
      this.broadcastChannel.onmessage = (e) => this.onMessage(e.data);
    } catch {
      console.warn('[ClusterSync] BroadcastChannel unavailable');
    }

    // WebSocket for cross-machine
    if (wsUrl) {
      this.connectWebSocket(wsUrl);
    }

    this._connected = true;
    console.log(`[ClusterSync] Started as ${role}${wsUrl ? ` → ${wsUrl}` : ' (local only)'}`);
  }

  stop(): void {
    this.broadcastChannel?.close();
    this.broadcastChannel = null;
    this.ws?.close();
    this.ws = null;
    this._connected = false;
    this.role = 'standalone';
    console.log('[ClusterSync] Stopped');
  }

  /** Master: broadcast current frame state */
  broadcastFrame(camera: ClusterFrame['camera'], t: number, physics: ClusterFrame['physics'], qualityLevel: number): void {
    if (this.role !== 'master') return;

    this.seq++;
    const frame: ClusterFrame = {
      seq: this.seq,
      t,
      camera,
      physics,
      qualityLevel,
      timestamp: performance.now(),
    };

    // Broadcast via BroadcastChannel
    try {
      this.broadcastChannel?.postMessage(frame);
    } catch { /* no-op */ }

    // Broadcast via WebSocket
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(frame));
      } catch { /* no-op */ }
    }

    this.lastFrame = frame;
  }

  /** Client: get interpolated frame for this tick */
  getInterpolatedFrame(): ClusterFrame | null {
    if (this.role !== 'client' || !this.targetFrame) return null;

    if (!this.interpolatedFrame) {
      this.interpolatedFrame = { ...this.targetFrame };
      return this.interpolatedFrame;
    }

    const f = this.interpolatedFrame;
    const tgt = this.targetFrame;
    const s = LERP_SPEED;

    // Interpolate camera — never snap
    f.camera.px = lerp(f.camera.px, tgt.camera.px, s);
    f.camera.py = lerp(f.camera.py, tgt.camera.py, s);
    f.camera.pz = lerp(f.camera.pz, tgt.camera.pz, s);
    f.camera.rx = lerp(f.camera.rx, tgt.camera.rx, s);
    f.camera.ry = lerp(f.camera.ry, tgt.camera.ry, s);
    f.camera.rz = lerp(f.camera.rz, tgt.camera.rz, s);
    f.camera.fov = lerp(f.camera.fov, tgt.camera.fov, s);

    // Interpolate physics
    f.physics.windX = lerp(f.physics.windX, tgt.physics.windX, s);
    f.physics.windY = lerp(f.physics.windY, tgt.physics.windY, s);
    f.physics.windZ = lerp(f.physics.windZ, tgt.physics.windZ, s);
    f.physics.drag = lerp(f.physics.drag, tgt.physics.drag, s);
    f.physics.turbulence = lerp(f.physics.turbulence, tgt.physics.turbulence, s);

    f.t = lerp(f.t, tgt.t, s);
    f.qualityLevel = tgt.qualityLevel;
    f.seq = tgt.seq;

    return f;
  }

  getState(): ClusterState {
    return {
      role: this.role,
      connected: this._connected,
      masterSeq: this.seq,
      clientCount: this.clientCount,
      latencyMs: this.latencyMs,
      lastFrame: this.lastFrame,
      desyncCount: this.desyncCount,
    };
  }

  getRole(): ClusterRole { return this.role; }
  isConnected(): boolean { return this._connected; }

  onChange(cb: (frame: ClusterFrame) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private onMessage(frame: ClusterFrame): void {
    if (this.role !== 'client') return;

    // Desync detection
    if (this.targetFrame && Math.abs(frame.seq - this.targetFrame.seq) > DESYNC_THRESHOLD) {
      this.desyncCount++;
      console.warn(`[ClusterSync] Desync detected (gap: ${frame.seq - this.targetFrame.seq}) — resyncing`);
      // Force snap on severe desync
      this.interpolatedFrame = { ...frame };
    }

    this.latencyMs = performance.now() - frame.timestamp;
    this.targetFrame = frame;
    this.lastFrame = frame;

    for (const l of this.listeners) {
      try { l(frame); } catch { /* no-op */ }
    }
  }

  private connectWebSocket(url: string): void {
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[ClusterSync] WebSocket connected');
        this._connected = true;
      };

      this.ws.onmessage = (e) => {
        try {
          const frame = JSON.parse(e.data) as ClusterFrame;
          this.onMessage(frame);
        } catch { /* ignore bad data */ }
      };

      this.ws.onclose = () => {
        console.warn('[ClusterSync] WebSocket disconnected — retrying in 3s');
        this._connected = false;
        setTimeout(() => {
          if (this.role !== 'standalone' && this.wsUrl) {
            this.connectWebSocket(this.wsUrl);
          }
        }, 3000);
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (e) {
      console.error('[ClusterSync] WebSocket connection failed:', e);
    }
  }

  reset(): void {
    this.stop();
    this.seq = 0;
    this.lastFrame = null;
    this.targetFrame = null;
    this.interpolatedFrame = null;
    this.desyncCount = 0;
    this.latencyMs = 0;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export const clusterSync = new ClusterSyncEngine();
