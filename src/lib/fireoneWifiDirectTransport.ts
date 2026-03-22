/**
 * WiFi Direct Transport for FireOne TransportManager
 * 
 * Extends WiFiTransport with auto-discovery via mDNS endpoints.
 * Used for connecting to XL4/XL2 gateways and FM-i32Q modules
 * via Wi-Fi Direct P2P (no router needed).
 * 
 * Priority: 1.5 (between Serial=1 and WiFi=2)
 */

import {
  WiFiTransport,
  type TransportType,
  type TransportState,
  type TransportReceiveCallback,
  type TransportStateCallback,
  type FireOneTransport,
} from '@/lib/fireoneTransport';

const WIFI_DIRECT_DISCOVERY_ENDPOINTS = [
  { host: 'fxk-xl4.local', port: 81, label: 'XL4 Gateway' },
  { host: 'fxk-xl2.local', port: 81, label: 'XL2 Gateway' },
  { host: 'fxk-fm.local', port: 81, label: 'FM-i32Q' },
  { host: 'fxk-esp32.local', port: 81, label: 'ESP32 Generic' },
  { host: '192.168.4.1', port: 81, label: 'AP Default' },
];

const DISCOVERY_TIMEOUT = 8000;

export type WiFiDirectDeviceType = 'XL4' | 'XL2' | 'FM-i32Q' | 'unknown';

export interface WiFiDirectDeviceInfo {
  host: string;
  port: number;
  label: string;
  deviceType: WiFiDirectDeviceType;
  rssi?: number;
  latencyMs?: number;
}

export class WiFiDirectTransport implements FireOneTransport {
  readonly id: string;
  readonly type: TransportType = 'wifi_direct';
  readonly label: string;
  priority = 1.5;
  state: TransportState = 'disconnected';
  latencyMs = 0;
  txBytes = 0;
  rxBytes = 0;

  private ws: WebSocket | null = null;
  private receiveCallbacks: TransportReceiveCallback[] = [];
  private stateCallbacks: TransportStateCallback[] = [];
  private connectedUrl = '';
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnects = 5;
  private autoReconnect = true;
  private statusPollTimer: ReturnType<typeof setInterval> | null = null;
  private _rssi?: number;
  private _deviceType: WiFiDirectDeviceType = 'unknown';
  private _connectedDevice: WiFiDirectDeviceInfo | null = null;

  constructor(id?: string) {
    this.id = id || `wifi-direct-${Date.now()}`;
    this.label = 'Wi-Fi Direct';
  }

  get rssi(): number | undefined { return this._rssi; }
  get deviceType(): WiFiDirectDeviceType { return this._deviceType; }
  get connectedDevice(): WiFiDirectDeviceInfo | null { return this._connectedDevice; }

  onReceive(cb: TransportReceiveCallback) { this.receiveCallbacks.push(cb); }
  onStateChange(cb: TransportStateCallback) { this.stateCallbacks.push(cb); }
  isAvailable() { return typeof WebSocket !== 'undefined'; }

  private setState(s: TransportState, error?: string) {
    this.state = s;
    this.stateCallbacks.forEach(cb => cb(this.id, s, error));
  }

  /**
   * Auto-discovery connect: tries mDNS endpoints sequentially,
   * then falls back to known IPs. Use targetHost to skip discovery.
   */
  async connect(config?: Record<string, any>): Promise<void> {
    const targetHost = config?.targetHost as string | undefined;
    const targetPort = config?.targetPort as number | undefined;
    this.autoReconnect = config?.autoReconnect !== false;

    if (targetHost) {
      const url = `ws://${targetHost}:${targetPort || 81}`;
      await this.tryConnect(url, targetHost);
      return;
    }

    // Auto-discovery
    this.setState('connecting');
    for (const endpoint of WIFI_DIRECT_DISCOVERY_ENDPOINTS) {
      const url = `ws://${endpoint.host}:${endpoint.port}`;
      try {
        await this.tryConnect(url, endpoint.label);
        this._deviceType = this.inferDeviceType(endpoint.host);
        this._connectedDevice = {
          host: endpoint.host,
          port: endpoint.port,
          label: endpoint.label,
          deviceType: this._deviceType,
        };
        return;
      } catch {
        // Try next endpoint
      }
    }

    this.setState('error', 'Nenhum dispositivo Wi-Fi Direct encontrado');
    throw new Error('Wi-Fi Direct: nenhum dispositivo encontrado após discovery');
  }

  private inferDeviceType(host: string): WiFiDirectDeviceType {
    if (host.includes('xl4')) return 'XL4';
    if (host.includes('xl2')) return 'XL2';
    if (host.includes('fm')) return 'FM-i32Q';
    return 'unknown';
  }

  private tryConnect(url: string, label: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.close();
        reject(new Error(`Timeout ${url}`));
      }, DISCOVERY_TIMEOUT);

      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        clearTimeout(timer);
        this.ws = ws;
        this.connectedUrl = url;
        this.reconnectAttempts = 0;
        this.setState('connected');
        this.measureLatency();
        this.startStatusPolling();
        resolve();
      };

      ws.onmessage = (ev: MessageEvent) => {
        if (ev.data instanceof ArrayBuffer) {
          const data = new Uint8Array(ev.data);
          this.rxBytes += data.length;
          this.receiveCallbacks.forEach(cb => cb(data, this.id));
        } else if (typeof ev.data === 'string') {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === 'pong') {
              this.latencyMs = Math.round(performance.now() - (msg.t0 || 0));
            } else if (msg.type === 'status') {
              if (msg.rssi !== undefined) this._rssi = msg.rssi;
            } else if (msg.type === 'fireone-frame' && msg.data) {
              const bytes = Uint8Array.from(atob(msg.data), c => c.charCodeAt(0));
              this.rxBytes += bytes.length;
              this.receiveCallbacks.forEach(cb => cb(bytes, this.id));
            }
          } catch { /* non-JSON text ignored */ }
        }
      };

      ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`WS error: ${url}`));
      };

      ws.onclose = () => {
        clearTimeout(timer);
        if (this.ws === ws) {
          this.stopStatusPolling();
          if (this.state === 'connected' && this.autoReconnect) {
            this.attemptReconnect();
          } else if (this.state !== 'reconnecting') {
            this.setState('disconnected');
          }
        }
      };
    });
  }

  async disconnect(): Promise<void> {
    this.autoReconnect = false;
    this.stopStatusPolling();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.setState('disconnected');
  }

  async send(frame: Uint8Array): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Wi-Fi Direct não conectado');
    }
    const t0 = performance.now();
    this.ws.send(frame.slice().buffer as ArrayBuffer);
    this.latencyMs = Math.round(performance.now() - t0);
    this.txBytes += frame.length;
  }

  private measureLatency() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping', t0: performance.now() }));
    }
  }

  private startStatusPolling() {
    this.stopStatusPolling();
    this.statusPollTimer = setInterval(() => {
      this.measureLatency();
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'status-request' }));
      }
    }, 5000);
  }

  private stopStatusPolling() {
    if (this.statusPollTimer) {
      clearInterval(this.statusPollTimer);
      this.statusPollTimer = null;
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
      this.tryConnect(this.connectedUrl, 'reconnect')
        .catch(() => this.attemptReconnect());
    }, delay);
  }

  /**
   * Scan for available Wi-Fi Direct devices without connecting.
   * Returns list of reachable endpoints.
   */
  static async scanDevices(): Promise<WiFiDirectDeviceInfo[]> {
    const found: WiFiDirectDeviceInfo[] = [];

    const checks = WIFI_DIRECT_DISCOVERY_ENDPOINTS.map(async (ep) => {
      try {
        const ws = new WebSocket(`ws://${ep.host}:${ep.port}`);
        const ok = await new Promise<boolean>((resolve) => {
          const t = setTimeout(() => { ws.close(); resolve(false); }, 3000);
          ws.onopen = () => { clearTimeout(t); ws.close(); resolve(true); };
          ws.onerror = () => { clearTimeout(t); resolve(false); };
        });
        if (ok) {
          found.push({
            host: ep.host,
            port: ep.port,
            label: ep.label,
            deviceType: ep.host.includes('xl4') ? 'XL4' :
                        ep.host.includes('xl2') ? 'XL2' :
                        ep.host.includes('fm') ? 'FM-i32Q' : 'unknown',
          });
        }
      } catch { /* skip */ }
    });

    await Promise.allSettled(checks);
    return found;
  }
}
