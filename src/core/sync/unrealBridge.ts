/**
 * ─── Unreal Engine Live Bridge ──────────────────────────────────────
 * Streams camera, timeline, events to Unreal Engine via WebSocket.
 * 60 FPS target. 3-frame buffer. Auto-reconnect with exponential backoff.
 */

export interface UnrealFrame {
  camera: {
    position: [number, number, number];
    rotation: [number, number, number]; // euler XYZ degrees
    fov: number;
  };
  timeline: {
    time: number;
    playing: boolean;
    speed: number;
  };
  events: UnrealEvent[];
  frameId: number;
  timestamp: number;
}

export interface UnrealEvent {
  type: 'cue_fire' | 'effect_start' | 'effect_end' | 'camera_cut' | 'custom';
  id: string;
  data?: Record<string, unknown>;
}

export interface UnrealBridgeState {
  connected: boolean;
  endpoint: string;
  framesSent: number;
  latencyMs: number;
  reconnectAttempts: number;
  bufferedFrames: number;
}

const BUFFER_SIZE = 3;
const MAX_RECONNECT_DELAY = 30_000;

class UnrealBridge {
  private ws: WebSocket | null = null;
  private endpoint = '';
  private frameBuffer: UnrealFrame[] = [];
  private frameId = 0;
  private framesSent = 0;
  private latencyMs = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;
  private _enabled = false;
  private pendingEvents: UnrealEvent[] = [];

  /** Connect to Unreal Engine listener */
  connect(endpoint: string): void {
    this.endpoint = endpoint;
    this._enabled = true;
    this.reconnectAttempts = 0;
    this.doConnect();
  }

  disconnect(): void {
    this._enabled = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this._connected = false;
    console.log('[UnrealBridge] Disconnected');
  }

  /** Queue an event to be sent with next frame */
  pushEvent(event: UnrealEvent): void {
    this.pendingEvents.push(event);
    // Cap pending events
    if (this.pendingEvents.length > 100) {
      this.pendingEvents = this.pendingEvents.slice(-50);
    }
  }

  /** Send a frame — call from render loop at 60 FPS */
  sendFrame(
    cameraPos: [number, number, number],
    cameraRot: [number, number, number],
    fov: number,
    time: number,
    playing: boolean,
    speed: number,
  ): void {
    if (!this._enabled || !this._connected) return;

    this.frameId++;
    const frame: UnrealFrame = {
      camera: {
        position: cameraPos,
        rotation: cameraRot,
        fov,
      },
      timeline: { time, playing, speed },
      events: this.pendingEvents.splice(0),
      frameId: this.frameId,
      timestamp: performance.now(),
    };

    // Buffer for jitter absorption
    this.frameBuffer.push(frame);
    if (this.frameBuffer.length > BUFFER_SIZE) {
      const toSend = this.frameBuffer.shift()!;
      this.doSend(toSend);
    }
  }

  /** Flush buffer — call on pause/stop */
  flush(): void {
    while (this.frameBuffer.length > 0) {
      this.doSend(this.frameBuffer.shift()!);
    }
  }

  getState(): UnrealBridgeState {
    return {
      connected: this._connected,
      endpoint: this.endpoint,
      framesSent: this.framesSent,
      latencyMs: this.latencyMs,
      reconnectAttempts: this.reconnectAttempts,
      bufferedFrames: this.frameBuffer.length,
    };
  }

  isConnected(): boolean { return this._connected; }

  private doSend(frame: UnrealFrame): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify(frame));
      this.framesSent++;
    } catch {
      // silent — will reconnect
    }
  }

  private doConnect(): void {
    if (!this._enabled || !this.endpoint) return;

    try {
      this.ws = new WebSocket(this.endpoint);

      this.ws.onopen = () => {
        this._connected = true;
        this.reconnectAttempts = 0;
        console.log(`[UnrealBridge] Connected to ${this.endpoint}`);
      };

      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === 'pong' && msg.frameId) {
            this.latencyMs = performance.now() - msg.timestamp;
          }
        } catch { /* ignore */ }
      };

      this.ws.onclose = () => {
        this._connected = false;
        if (this._enabled) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        this.ws?.close();
      };
    } catch (e) {
      console.error('[UnrealBridge] Connection failed:', e);
      if (this._enabled) this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), MAX_RECONNECT_DELAY);
    console.warn(`[UnrealBridge] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.doConnect(), delay);
  }

  reset(): void {
    this.disconnect();
    this.frameId = 0;
    this.framesSent = 0;
    this.latencyMs = 0;
    this.frameBuffer = [];
    this.pendingEvents = [];
  }
}

export const unrealBridge = new UnrealBridge();
