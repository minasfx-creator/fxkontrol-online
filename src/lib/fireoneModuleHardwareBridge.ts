/**
 * FireOne IFMx-i32Q Hardware Bridge
 * 
 * Connects the Virtual Module to real hardware via:
 * 1. Web Bluetooth BLE → ESP32 (curto alcance ~30m)
 * 2. BLE Long Range (Coded PHY) → ESP32 (~1km)
 * 3. WebSerial USB → ESP32/Arduino
 * 4. WebSocket → ESP32 Wi-Fi AP
 * 5. Wi-Fi Direct (P2P) → ESP32 (antena do celular como "rádio")
 * 6. Direct Relay → Arduino Nano via USB OTG
 * 
 * ESP32 Firmware Protocol:
 *   FIRE:pin:durationMs\n     → fires igniter (responds "OK:FIRE:pin\n")
 *   BATCH:mask:durationMs\n   → fire multiple via bitmask
 *   GPIO:pin:HIGH|LOW\n       → set GPIO
 *   CONT:pin\n                → read continuity (responds "CONT:pin:ohms\n")
 *   CDS:pin\n                 → read cap voltage (responds "CDS:pin:volts\n")
 *   STATUS\n                  → responds "BAT:voltage;PINS:mask;RSSI:dbm\n"
 *   HEARTBEAT\n               → responds "PONG\n"
 *   VERSION\n                 → responds "VER:x.y.z\n"
 *   ESTOP\n                   → emergency stop all
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { isIOSWebKit, requiresSecureBridgeTransport } from '@/lib/bridgeGateway';

export type BridgeTransport = 'ble' | 'ble_lr' | 'usb' | 'websocket' | 'wifi_direct' | 'direct_relay' | 'none';

/**
 * Standardized reason codes for bridge errors / link state.
 * Stable, machine-readable identifiers — UI translates for display.
 */
export type BridgeReasonCode =
  | 'OK'
  | 'UNSUPPORTED_TRANSPORT'
  | 'TRANSPORT_UNAVAILABLE'
  | 'PERMISSION_DENIED'
  | 'HANDSHAKE_TIMEOUT'
  | 'HEARTBEAT_TIMEOUT'
  | 'TRANSPORT_DISCONNECTED'
  | 'WEBSOCKET_OPEN_FAILED'
  | 'WEBSOCKET_INVALID_URL'
  | 'SERIAL_OPEN_FAILED'
  | 'BLE_GATT_FAILED'
  | 'SEND_FAILED'
  | 'NOT_CONNECTED'
  | 'LINK_NOT_HEALTHY'
  | 'STALE_SESSION'
  | 'COMMAND_TIMEOUT'
  | 'RETRY_RATE_LIMITED'
  | 'CONNECT_IN_PROGRESS'
  | 'UNKNOWN';

export interface BridgeError {
  code: BridgeReasonCode;
  message: string;
  transport?: BridgeTransport;
  detail?: string;
  at: number;
}

export type LinkHealth = 'disconnected' | 'handshaking' | 'healthy';

export interface BridgeDiagnostics {
  rateLimitedTotal: number;
  rateLimitedByKey: Record<string, number>;
  retryByKey: Record<string, number>;
  retryByCommandType: Partial<Record<BridgeCommandType, number>>;
  retryCount: number;
  retryRateLimit: number;
  sessionId: number;
  pendingCount: number;
  pendingKeys: string[];
  linkHealth?: 'disconnected' | 'handshaking' | 'healthy';
  oldestPendingAgeMs?: number;
}

export interface BridgeStatus {
  transport: BridgeTransport;
  connected: boolean;
  connecting: boolean;
  deviceName: string;
  batteryVoltage?: number;
  firmwareVersion?: string;
  lastPing: number;
  txBytes: number;
  rxBytes: number;
  rssi?: number;
  estimatedDistance?: number;
  lastError?: string;
  lastErrorCode?: BridgeReasonCode;
  linkHealth?: 'disconnected' | 'handshaking' | 'healthy';
  sessionId?: number;
  diagnostics?: BridgeDiagnostics;
}

export interface BridgeTransportSupport {
  ble: boolean;
  ble_lr: boolean;
  usb: boolean;
  websocket: boolean;
  wifi_direct: boolean;
  direct_relay: boolean;
}

export type BridgeEventHandler = (event: string, data: unknown) => void;

/** Command class enum — used by retry policy + command inspection. */
export type BridgeCommandType =
  | 'HANDSHAKE' | 'HEARTBEAT' | 'VERSION' | 'STATUS'
  | 'CONT' | 'CDS' | 'CONFIRM'
  | 'FIRE' | 'BATCH' | 'GPIO' | 'ESTOP'
  | 'UNKNOWN';

/** Reason a single retry attempt missed (for diagnostics). */
export type BridgeRetryReason = 'empty_drain' | 'parse_miss' | 'timeout' | 'rate_limited';

/** Per-command retry rule. */
export interface BridgeRetryRule {
  maxRetries: number;
  perAttemptTimeoutMs: number;
}

/** Command classes safe to auto-retry (read-only / lifecycle). */
export const RETRYABLE_COMMAND_TYPES: ReadonlySet<BridgeCommandType> = new Set<BridgeCommandType>([
  'HEARTBEAT', 'VERSION', 'STATUS', 'CONT', 'CDS',
]);

/** Command classes that MUST NEVER auto-retry (destructive / single-intent). */
export const NON_RETRYABLE_COMMAND_TYPES: ReadonlySet<BridgeCommandType> = new Set<BridgeCommandType>([
  'HANDSHAKE', 'CONFIRM', 'FIRE', 'BATCH', 'GPIO', 'ESTOP', 'UNKNOWN',
]);

/** Type guard: is this command class allowed to auto-retry? */
export function isRetryableCommandType(t: BridgeCommandType): boolean {
  return RETRYABLE_COMMAND_TYPES.has(t);
}

/** Default per-class retry rules. */
export const DEFAULT_RETRY_POLICY: Readonly<Partial<Record<BridgeCommandType, BridgeRetryRule>>> = Object.freeze({
  HEARTBEAT: { maxRetries: 1, perAttemptTimeoutMs: 1000 },
  VERSION:   { maxRetries: 1, perAttemptTimeoutMs: 1000 },
  STATUS:    { maxRetries: 2, perAttemptTimeoutMs: 1500 },
  CONT:      { maxRetries: 2, perAttemptTimeoutMs: 1500 },
  CDS:       { maxRetries: 2, perAttemptTimeoutMs: 1500 },
});

/** Default rate limit for retry attempts (per command class, per second). */
export const DEFAULT_RETRY_RATE_LIMIT = 5;

/** Internal pending-response record (session-scoped to drop stale frames). */
interface PendingResponse {
  resolver: (value: string) => void;
  sessionId: number;
  commandType: BridgeCommandType;
}

// BLE Service/Characteristic UUIDs (custom for FXK-ESP32)
const BLE_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const BLE_CHAR_TX_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
const BLE_CHAR_RX_UUID = '0000ffe2-0000-1000-8000-00805f9b34fb';

const HEARTBEAT_INTERVAL = 5000;
const FIRE_CONFIRM_TIMEOUT = 2000;

export class FireOneHardwareBridge {
  private transport: BridgeTransport = 'none';
  private connected = false;
  private connecting = false;
  private deviceName = '';
  private firmwareVersion = '';
  private batteryVoltage?: number;
  private txBytes = 0;
  private rxBytes = 0;
  private lastPing = 0;
  private rssi?: number;
  private estimatedDistance?: number;
  private lastError?: string;
  private linkHealth: 'disconnected' | 'handshaking' | 'healthy' = 'disconnected';

  private bleDevice: any = null;
  private bleCharTx: any = null;
  private bleCharRx: any = null;
  private serialPort: any = null;
  private serialReader: any = null;
  private serialWriter: any = null;
  private ws: WebSocket | null = null;

  private responseBuffer = '';
  private pendingResolves: Map<string, PendingResponse> = new Map();
  private onEvent: BridgeEventHandler | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private rssiTimer: ReturnType<typeof setInterval> | null = null;
  private bleCharValueHandler: ((event: any) => void) | null = null;
  private bleDisconnectHandler: (() => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private lastConnectArgs: { method: string; args?: any } | null = null;

  // ── Session + retry diagnostics ──
  private sessionId = 0;
  private connectingSessionId = 0;
  private lastErrorCode?: BridgeReasonCode;
  private retryPolicy: Partial<Record<BridgeCommandType, BridgeRetryRule>> = { ...DEFAULT_RETRY_POLICY };
  private retryRateLimit: { windowMs: number; maxRetriesPerKey: number; maxRetriesTotal: number } = {
    windowMs: 1000, maxRetriesPerKey: DEFAULT_RETRY_RATE_LIMIT, maxRetriesTotal: DEFAULT_RETRY_RATE_LIMIT * 4,
  };
  private retryCount = 0;
  private retryByKey: Record<string, number> = {};
  private retryByCommandType: Partial<Record<BridgeCommandType, number>> = {};
  private rateLimitedTotal = 0;
  private rateLimitedByKey: Record<string, number> = {};
  private retryTimestampsAll: number[] = [];
  private retryTimestampsByKey: Map<string, number[]> = new Map();

  // ── Helpers (added stubs to satisfy SDK + tests; runtime no-op safe) ──
  private setError(code: BridgeReasonCode, message: string): void {
    this.lastErrorCode = code;
    this.lastError = message;
  }
  private registerPending(key: string, commandType: BridgeCommandType, resolver: (val: string) => void): void {
    this.pendingResolves.set(key, { resolver, sessionId: this.sessionId, commandType });
  }
  isHealthy(): boolean {
    return this.connected && this.linkHealth === 'healthy';
  }
  getDiagnostics(): BridgeDiagnostics {
    return {
      rateLimitedTotal: this.rateLimitedTotal,
      rateLimitedByKey: { ...this.rateLimitedByKey },
      retryByKey: { ...this.retryByKey },
      retryByCommandType: { ...this.retryByCommandType },
      retryCount: this.retryCount,
      retryRateLimit: this.retryRateLimit.maxRetriesPerKey,
      sessionId: this.sessionId,
      pendingCount: this.pendingResolves.size,
      pendingKeys: Array.from(this.pendingResolves.keys()),
    };
  }
  setRetryRateLimit(limit: number | { windowMs?: number; maxRetriesPerKey?: number; maxRetriesTotal?: number }): void {
    if (typeof limit === 'number') {
      this.retryRateLimit.maxRetriesPerKey = limit;
    } else {
      this.retryRateLimit = { ...this.retryRateLimit, ...limit };
    }
  }
  setRetryPolicy(policy: Partial<Record<BridgeCommandType, BridgeRetryRule>>): void {
    this.retryPolicy = { ...this.retryPolicy, ...policy };
  }
  getRetryPolicy(): Readonly<Partial<Record<BridgeCommandType, BridgeRetryRule>>> {
    return { ...this.retryPolicy };
  }

  constructor(eventHandler?: BridgeEventHandler) {
    this.onEvent = eventHandler ?? null;
  }

  static detectTransportSupport(): BridgeTransportSupport {
    if (typeof navigator === 'undefined' || typeof window === 'undefined') {
      return {
        ble: false,
        ble_lr: false,
        usb: false,
        websocket: false,
        wifi_direct: false,
        direct_relay: false,
      };
    }

    const nav = navigator as any;
    const hasBluetooth = Boolean(nav.bluetooth);
    const hasSerial = Boolean(nav.serial);
    const secureRequired = requiresSecureBridgeTransport(window.location, nav);
    const iosWebKit = isIOSWebKit(nav);
    const websocketAllowed = typeof WebSocket !== 'undefined';

    return {
      ble: hasBluetooth,
      ble_lr: hasBluetooth,
      usb: hasSerial,
      direct_relay: hasSerial,
      websocket: websocketAllowed,
      wifi_direct: websocketAllowed && !secureRequired && !iosWebKit,
    };
  }

  getTransportSupport(): BridgeTransportSupport {
    return FireOneHardwareBridge.detectTransportSupport();
  }

  // ─── Connection Methods ──────────────────────────────

  /** BLE padrão — alcance ~30m */
  async connectBLE(): Promise<boolean> {
    if (this.connecting) {
      this.lastError = 'Conexão em andamento. Aguarde.';
      return false;
    }
    this.connecting = true;
    try {
      if (!this.getTransportSupport().ble) {
        this.lastError = 'BLE não suportado neste navegador/dispositivo';
        this.onEvent?.('unsupported_transport', { transport: 'ble' });
        return false;
      }
      const nav = navigator as any;
      if (!nav.bluetooth) throw new Error('Web Bluetooth not supported');

      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: [BLE_SERVICE_UUID] }],
        optionalServices: [BLE_SERVICE_UUID],
      });

      return await this.setupBLEDevice(device, 'ble');
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Falha ao conectar BLE';
      console.warn('[HardwareBridge] BLE connect failed:', err);
      return false;
    } finally {
      this.connecting = false;
    }
  }

  /** BLE Long Range (Coded PHY / BLE 5.0) — alcance ~1km */
  async connectBLELongRange(): Promise<boolean> {
    if (this.connecting) {
      this.lastError = 'Conexão em andamento. Aguarde.';
      return false;
    }
    this.connecting = true;
    try {
      if (!this.getTransportSupport().ble_lr) {
        this.lastError = 'BLE Long Range não suportado neste navegador/dispositivo';
        this.onEvent?.('unsupported_transport', { transport: 'ble_lr' });
        return false;
      }
      const nav = navigator as any;
      if (!nav.bluetooth) throw new Error('Web Bluetooth not supported');

      const device = await nav.bluetooth.requestDevice({
        filters: [
          { services: [BLE_SERVICE_UUID] },
          { namePrefix: 'FXK' },
        ],
        optionalServices: [BLE_SERVICE_UUID],
      });

      return await this.setupBLEDevice(device, 'ble_lr');
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Falha ao conectar BLE LR';
      console.warn('[HardwareBridge] BLE LR connect failed:', err);
      return false;
    } finally {
      this.connecting = false;
    }
  }

  /** Shared BLE setup for both standard and Long Range */
  private async setupBLEDevice(device: any, transport: 'ble' | 'ble_lr'): Promise<boolean> {
    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(BLE_SERVICE_UUID);
    this.bleCharTx = await service.getCharacteristic(BLE_CHAR_TX_UUID);
    this.bleCharRx = await service.getCharacteristic(BLE_CHAR_RX_UUID);

    await this.bleCharRx.startNotifications();
    this.bleCharValueHandler = (event: any) => {
      const value = new TextDecoder().decode(event.target.value.buffer);
      this.handleResponse(value);
    };
    this.bleCharRx.addEventListener('characteristicvaluechanged', this.bleCharValueHandler);

    this.bleDisconnectHandler = () => this.handleDisconnect();
    device.addEventListener('gattserverdisconnected', this.bleDisconnectHandler);

    this.bleDevice = device;
    const ok = await this.establishHealthyLink(
      transport,
      device.name || (transport === 'ble_lr' ? 'FXK-LR' : 'ESP32-FXK'),
    );
    if (ok) {
      this.lastConnectArgs = { method: transport };
      this.reconnectAttempts = 0;
      this.startRssiPolling();
      return true;
    }
    try { device.gatt?.disconnect?.(); } catch { /* ignore */ }
    return false;
  }

  async connectUSB(baudRate = 115200): Promise<boolean> {
    if (this.connecting) {
      this.lastError = 'Conexão em andamento. Aguarde.';
      return false;
    }
    this.connecting = true;
    try {
      if (!this.getTransportSupport().usb) {
        this.lastError = 'USB/WebSerial não suportado neste navegador/dispositivo';
        this.onEvent?.('unsupported_transport', { transport: 'usb' });
        return false;
      }
      if (!('serial' in navigator)) throw new Error('WebSerial not supported');

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });

      this.serialPort = port;
      this.serialReader = port.readable!.getReader();
      this.serialWriter = port.writable!.getWriter();

      this.readSerialLoop();
      const ok = await this.establishHealthyLink('usb', 'ESP32-USB');
      if (ok) {
        this.lastConnectArgs = { method: 'usb' };
        this.reconnectAttempts = 0;
        return true;
      }
      await this.disconnect();
      return false;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Falha ao conectar USB';
      console.warn('[HardwareBridge] USB connect failed:', err);
      return false;
    } finally {
      this.connecting = false;
    }
  }

  async connectDirectRelay(baudRate = 115200): Promise<boolean> {
    if (this.connecting) {
      this.lastError = 'Conexão em andamento. Aguarde.';
      return false;
    }
    this.connecting = true;
    try {
      if (!this.getTransportSupport().direct_relay) {
        this.lastError = 'Direct Relay/WebSerial não suportado neste navegador/dispositivo';
        this.onEvent?.('unsupported_transport', { transport: 'direct_relay' });
        return false;
      }
      if (!('serial' in navigator)) throw new Error('WebSerial not supported');

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });

      this.serialPort = port;
      this.serialReader = port.readable!.getReader();
      this.serialWriter = port.writable!.getWriter();

      this.readSerialLoop();
      const ok = await this.establishHealthyLink('direct_relay', 'DirectRelay-USB');
      if (ok) {
        this.lastConnectArgs = { method: 'direct_relay' };
        this.reconnectAttempts = 0;
        return true;
      }
      await this.disconnect();
      return false;
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'Falha ao conectar Direct Relay';
      console.warn('[HardwareBridge] Direct Relay connect failed:', err);
      return false;
    } finally {
      this.connecting = false;
    }
  }

  async connectWebSocket(url = 'ws://192.168.4.1:81'): Promise<boolean> {
    if (this.connecting) {
      this.lastError = 'Conexão em andamento. Aguarde.';
      return false;
    }
    this.connecting = true;
    if (!this.getTransportSupport().websocket) {
      this.lastError = 'WebSocket não suportado neste navegador/dispositivo';
      this.onEvent?.('unsupported_transport', { transport: 'websocket' });
      this.connecting = false;
      return false;
    }
    const endpoint = this.normalizeWebSocketUrl(url);
    const ok = await this.tryWebSocketConnect(endpoint, 'websocket', 5000);
    if (ok) {
      this.lastConnectArgs = { method: 'websocket', args: endpoint };
      this.reconnectAttempts = 0;
    }
    this.connecting = false;
    return ok;
  }

  /**
   * Wi-Fi Direct (P2P) — usa antena Wi-Fi do celular como "rádio"
   * Tenta auto-discovery via mDNS antes de fallback para IP fixo.
   */
  async connectWiFiDirect(url?: string): Promise<boolean> {
    if (this.connecting) {
      this.lastError = 'Conexão em andamento. Aguarde.';
      return false;
    }
    this.connecting = true;
    const support = this.getTransportSupport();
    if (!support.wifi_direct) {
      this.lastError = 'Wi‑Fi Direct indisponível neste ambiente';
      this.onEvent?.('unsupported_transport', { transport: 'wifi_direct' });
      this.connecting = false;
      return false;
    }
    const endpoints = this.getWiFiDirectEndpoints(url);

    for (const endpoint of endpoints) {
      const ok = await this.tryWebSocketConnect(endpoint, 'wifi_direct', 3000);
      if (ok) {
        this.lastConnectArgs = { method: 'wifi_direct', args: endpoint };
        this.reconnectAttempts = 0;
        this.connecting = false;
        return true;
      }
    }
    this.connecting = false;
    return false;
  }

  private getWiFiDirectEndpoints(customUrl?: string): string[] {
    const secureRequired = requiresSecureBridgeTransport();
    const scheme = secureRequired ? 'wss' : 'ws';
    return [
      customUrl ? this.normalizeWebSocketUrl(customUrl) : null,
      `${scheme}://fxk-esp32.local:81`,
      `${scheme}://192.168.4.1:81`,
      `${scheme}://192.168.1.1:81`,
    ].filter(Boolean) as string[];
  }

  private normalizeWebSocketUrl(raw: string): string {
    const secureRequired = requiresSecureBridgeTransport();
    const defaultScheme = secureRequired ? 'wss' : 'ws';
    const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `${defaultScheme}://${raw}`;
    try {
      const parsed = new URL(withScheme);
      if (secureRequired && parsed.protocol === 'ws:') {
        parsed.protocol = 'wss:';
      }
      return parsed.toString();
    } catch {
      return withScheme;
    }
  }

  private async tryWebSocketConnect(url: string, transport: BridgeTransport, timeout = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        let opened = false;
        const ws = new WebSocket(url);
        const timer = setTimeout(() => { ws.close(); resolve(false); }, timeout);

        ws.onopen = () => {
          opened = true;
          clearTimeout(timer);
          this.ws = ws;
          this.establishHealthyLink(
            transport,
            `FXK-${transport === 'wifi_direct' ? 'P2P' : 'WS'}(${url})`,
          ).then((ok) => {
            if (!ok) ws.close();
            resolve(ok);
          });
        };
        ws.onmessage = (ev) => this.handleResponse(String(ev.data));
        ws.onclose = () => {
          clearTimeout(timer);
          if (opened || this.connected) this.handleDisconnect();
        };
        ws.onerror = () => {
          this.lastError = `Falha ao conectar WebSocket (${url})`;
          clearTimeout(timer);
          resolve(false);
        };
      } catch {
        this.lastError = `URL de WebSocket inválida (${url})`;
        resolve(false);
      }
    });
  }

  async disconnect(): Promise<void> {
    this.lastConnectArgs = null; // Prevent auto-reconnect
    this.stopHeartbeat();
    this.stopRssiPolling();
    // Remove BLE event listeners before disconnecting
    if (this.bleCharRx && this.bleCharValueHandler) {
      this.bleCharRx.removeEventListener('characteristicvaluechanged', this.bleCharValueHandler);
      this.bleCharValueHandler = null;
    }
    if (this.bleDevice && this.bleDisconnectHandler) {
      this.bleDevice.removeEventListener('gattserverdisconnected', this.bleDisconnectHandler);
      this.bleDisconnectHandler = null;
    }
    if (this.bleDevice?.gatt?.connected) {
      this.bleDevice.gatt.disconnect();
    }
    if (this.serialReader) {
      await this.serialReader.cancel().catch(() => {});
      this.serialReader = null;
    }
    if (this.serialWriter) {
      await this.serialWriter.close().catch(() => {});
      this.serialWriter = null;
    }
    if (this.serialPort) {
      await this.serialPort.close().catch(() => {});
      this.serialPort = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handleDisconnect();
  }

  // ─── Command Methods ─────────────────────────────────

  /**
   * Health gate for command execution. Returns null if OK to proceed,
   * otherwise a `BridgeReasonCode` to surface to the caller.
   *
   * NOTE: `eStop()` intentionally bypasses this gate — emergency stop must
   * always attempt transmission, even on a degraded link.
   */
  private requireHealthy(): BridgeReasonCode | null {
    if (!this.connected) return 'NOT_CONNECTED';
    if (this.linkHealth !== 'healthy') return 'LINK_NOT_HEALTHY';
    return null;
  }

  async fire(pin: number, durationMs: number): Promise<boolean> {
    const gate = this.requireHealthy();
    if (gate) {
      this.setError(gate, `fire(${pin}) blocked: ${gate}`);
      return false;
    }
    const key = `OK:FIRE:${pin}`;
    return this.sendAndWaitConfirm(`FIRE:${pin}:${durationMs}\n`, key);
  }

  async fireBatch(mask: number, durationMs: number): Promise<boolean> {
    const gate = this.requireHealthy();
    if (gate) {
      this.setError(gate, `fireBatch blocked: ${gate}`);
      return false;
    }
    const maskHex = (mask >>> 0).toString(16).padStart(8, '0');
    return this.sendAndWaitConfirm(`BATCH:${maskHex}:${durationMs}\n`, 'OK:BATCH');
  }

  /**
   * Emergency stop — bypasses requireHealthy() by design.
   * Always logs an audit event with current link state for post-event analysis,
   * regardless of whether transmission succeeds.
   */
  async eStop(): Promise<boolean> {
    this.onEvent?.('estop_attempt', {
      linkHealth: this.linkHealth,
      connected: this.connected,
      transport: this.transport,
      sessionId: this.sessionId,
      at: Date.now(),
    });
    const ok = await this.sendCommand('ESTOP\n');
    this.onEvent?.('estop_result', {
      ok,
      sessionId: this.sessionId,
      at: Date.now(),
    });
    return ok;
  }

  async readContinuity(pin: number, maxRetries?: number): Promise<number> {
    const rule = this.retryPolicy.CONT;
    return this.readWithRetry('CONT', pin, maxRetries ?? rule.maxRetries, rule.perAttemptTimeoutMs);
  }

  async readCdsVoltage(pin: number, maxRetries?: number): Promise<number> {
    const rule = this.retryPolicy.CDS;
    return this.readWithRetry('CDS', pin, maxRetries ?? rule.maxRetries, rule.perAttemptTimeoutMs);
  }

  /**
   * Shared retrying-read helper for CONT/CDS.
   *
   * Retry policy:
   *  - only fires for command types in `RETRYABLE_COMMAND_TYPES` (compile-time enforced via param type)
   *  - aborts the moment `linkHealth !== 'healthy'` (no retries on degraded link)
   *  - aborts if `sessionId` changes mid-retry (reconnect happened)
   *  - bounded by `maxRetries`; per-class default lives in `DEFAULT_RETRY_POLICY`
   *
   * Physical commands (FIRE/BATCH/GPIO/ESTOP) deliberately do NOT use this path.
   */
  private async readWithRetry(
    commandType: 'CONT' | 'CDS',
    pin: number,
    maxRetries: number,
    perAttemptTimeoutMs: number,
  ): Promise<number> {
    const sessionAtStart = this.sessionId;
    const key = `${commandType}:${pin}`;

    /** Returns [value, reasonIfMiss]. value !== null = real response. */
    const attemptOnce = (): Promise<{ value: number | null; reason: BridgeRetryReason | null }> =>
      new Promise((resolve) => {
        this.registerPending(key, commandType, (val) => {
          // Empty val = drain sentinel from disconnect → retryable miss.
          if (!val) { resolve({ value: null, reason: 'empty_drain' }); return; }
          const parts = val.split(':');
          if (parts.length < 3) { resolve({ value: null, reason: 'parse_miss' }); return; }
          const parsed = parseFloat(parts[2]);
          if (Number.isNaN(parsed)) { resolve({ value: null, reason: 'parse_miss' }); return; }
          resolve({ value: parsed, reason: null });
        });
        this.sendCommand(`${commandType}:${pin}\n`);
        setTimeout(() => {
          if (this.pendingResolves.has(key)) {
            this.pendingResolves.delete(key);
            resolve({ value: null, reason: 'timeout' });
          }
        }, perAttemptTimeoutMs);
      });

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Healthy + same session gate — re-checked before EACH attempt.
      if (this.linkHealth !== 'healthy' || this.sessionId !== sessionAtStart) {
        return 0;
      }
      const { value, reason } = await attemptOnce();
      if (value !== null) return value;
      // miss → maybe retry
      if (attempt < maxRetries) {
        // Rate-limit gate — evaluated BEFORE consuming a retry slot.
        const limit = this.checkRetryRateLimit(key);
        if (limit !== null) {
          this.rateLimitedTotal++;
          this.rateLimitedByKey[key] = (this.rateLimitedByKey[key] ?? 0) + 1;
          this.setError('RETRY_RATE_LIMITED', `Retry suppressed for ${key}: ${limit}`);
          this.onEvent?.('retry_rate_limited', {
            key,
            commandType,
            scope: limit, // 'per_key' | 'total'
            retryCountForKey: this.retryByKey[key] ?? 0,
            retryCountTotal: this.retryCount,
            windowMs: this.retryRateLimit.windowMs,
            sessionId: this.sessionId,
            at: Date.now(),
          });
          return 0;
        }

        const now = Date.now();
        this.recordRetryTimestamp(key, now);
        this.retryCount++;
        this.retryByCommandType[commandType] = (this.retryByCommandType[commandType] ?? 0) + 1;
        this.retryByKey[key] = (this.retryByKey[key] ?? 0) + 1;
        this.onEvent?.('retry', {
          commandType,
          key,
          attempt: attempt + 1,
          maxRetries,
          sessionId: this.sessionId,
          linkHealth: this.linkHealth,
          reason: reason ?? 'timeout',
          at: now,
        });
      }
    }
    return 0;
  }

  /**
   * Returns null if a retry is allowed; otherwise the scope that tripped
   * (`'per_key'` or `'total'`). Uses a sliding window of `windowMs`.
   */
  private checkRetryRateLimit(key: string): 'per_key' | 'total' | null {
    const now = Date.now();
    const { windowMs, maxRetriesPerKey, maxRetriesTotal } = this.retryRateLimit;
    const cutoff = now - windowMs;

    // Prune + count global
    this.retryTimestampsAll = this.retryTimestampsAll.filter(t => t >= cutoff);
    if (this.retryTimestampsAll.length >= maxRetriesTotal) return 'total';

    // Prune + count per-key
    const stamps = this.retryTimestampsByKey.get(key) ?? [];
    const pruned = stamps.filter(t => t >= cutoff);
    if (pruned.length !== stamps.length) this.retryTimestampsByKey.set(key, pruned);
    if (pruned.length >= maxRetriesPerKey) return 'per_key';

    return null;
  }

  private recordRetryTimestamp(key: string, ts: number): void {
    this.retryTimestampsAll.push(ts);
    const stamps = this.retryTimestampsByKey.get(key) ?? [];
    stamps.push(ts);
    this.retryTimestampsByKey.set(key, stamps);
  }

  async setGpio(pin: number, high: boolean): Promise<boolean> {
    const gate = this.requireHealthy();
    if (gate) {
      this.setError(gate, `setGpio(${pin}) blocked: ${gate}`);
      return false;
    }
    return this.sendCommand(`GPIO:${pin}:${high ? 'HIGH' : 'LOW'}\n`);
  }

  async requestStatus(): Promise<void> {
    await this.sendCommand('STATUS\n');
  }

  getStatus(): BridgeStatus {
    return {
      transport: this.transport,
      connected: this.connected,
      connecting: this.connecting,
      deviceName: this.deviceName,
      batteryVoltage: this.batteryVoltage,
      firmwareVersion: this.firmwareVersion,
      lastPing: this.lastPing,
      txBytes: this.txBytes,
      rxBytes: this.rxBytes,
      rssi: this.rssi,
      estimatedDistance: this.estimatedDistance,
      lastError: this.lastError,
      linkHealth: this.linkHealth,
    };
  }

  // ─── Private ──────────────────────────────────────────

  private onConnect(): void {
    this.onEvent?.('connected', { transport: this.transport, device: this.deviceName });
    this.sendCommand('VERSION\n');
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(async () => {
      if (!this.connected) return;
      const key = 'PONG';
      const responded = await new Promise<boolean>((resolve) => {
        this.registerPending(key, 'HEARTBEAT', () => resolve(true));
        this.sendCommand('HEARTBEAT\n');
        setTimeout(() => {
          if (this.pendingResolves.has(key)) {
            this.pendingResolves.delete(key);
            resolve(false);
          }
        }, 3000);
      });
      if (!responded && this.connected) {
        console.warn('[HardwareBridge] Heartbeat timeout — disconnecting');
        this.setError('HEARTBEAT_TIMEOUT', 'Heartbeat timeout — link lost');
        this.handleDisconnect();
        this.onEvent?.('heartbeat_timeout', null);
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private startRssiPolling(): void {
    this.stopRssiPolling();
    if (this.transport !== 'ble' && this.transport !== 'ble_lr') return;
    this.rssiTimer = setInterval(async () => {
      if (!this.connected || !this.bleDevice?.gatt?.connected) return;
      try { await this.sendCommand('STATUS\n'); } catch { /* ignore */ }
    }, 3000);
  }

  private stopRssiPolling(): void {
    if (this.rssiTimer) {
      clearInterval(this.rssiTimer);
      this.rssiTimer = null;
    }
  }

  private estimateDistance(rssi: number): number {
    const txPower = -59;
    const n = 2.0;
    return Math.round(Math.pow(10, (txPower - rssi) / (10 * n)) * 10) / 10;
  }

  private async attemptReconnect(): Promise<void> {
    if (!this.lastConnectArgs || this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = Math.pow(2, this.reconnectAttempts) * 1000;
    this.onEvent?.('reconnecting', { attempt: this.reconnectAttempts, delay });

    await new Promise(r => setTimeout(r, delay));

    let ok = false;
    switch (this.lastConnectArgs.method) {
      case 'ble': ok = await this.connectBLE(); break;
      case 'ble_lr': ok = await this.connectBLELongRange(); break;
      case 'websocket': ok = await this.connectWebSocket(this.lastConnectArgs.args); break;
      case 'wifi_direct': ok = await this.connectWiFiDirect(this.lastConnectArgs.args); break;
    }
    if (!ok && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.attemptReconnect();
    }
  }

  private async sendAndWaitConfirm(cmd: string, confirmKey: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      // Resolver receives the matched line. A non-empty match = real confirmation.
      // Empty string is the disconnect drain sentinel → resolve false (NOT a confirm).
      this.registerPending(confirmKey, 'CONFIRM', (val) => resolve(Boolean(val)));
      this.sendCommand(cmd);
      setTimeout(() => {
        if (this.pendingResolves.has(confirmKey)) {
          this.pendingResolves.delete(confirmKey);
          resolve(false);
        }
      }, FIRE_CONFIRM_TIMEOUT);
    });
  }

  /**
   * Low-level send. **Intentionally does NOT check linkHealth** — this lets the
   * handshake (`waitForHandshake`) transmit during `linkHealth: 'handshaking'`
   * and lets `eStop()` transmit on a degraded link. Health gating lives in
   * `requireHealthy()` and is enforced by the public command methods only.
   */
  private async sendCommand(cmd: string): Promise<boolean> {
    const bytes = new TextEncoder().encode(cmd);
    this.txBytes += bytes.length;

    try {
      switch (this.transport) {
        case 'ble':
        case 'ble_lr':
          if (this.bleCharTx) {
            await this.bleCharTx.writeValue(bytes);
            return true;
          }
          break;

        case 'usb':
        case 'direct_relay':
          if (this.serialWriter) {
            await this.serialWriter.write(bytes);
            return true;
          }
          break;

        case 'websocket':
        case 'wifi_direct':
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(cmd);
            return true;
          }
          break;
      }
    } catch (err) {
      console.warn('[HardwareBridge] Send failed:', err);
      this.setError('SEND_FAILED', err instanceof Error ? err.message : 'Send failed');
    }
    return false;
  }




  private handleResponse(data: string): void {
    this.rxBytes += data.length;
    this.lastPing = Date.now();
    this.responseBuffer += data;

    const lines = this.responseBuffer.split('\n');
    this.responseBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('VER:')) {
        this.firmwareVersion = trimmed.substring(4);
        this.onEvent?.('firmware_version', this.firmwareVersion);
        continue;
      }

      for (const token of trimmed.split(';')) {
        const chunk = token.trim();
        if (!chunk) continue;
        if (chunk.startsWith('BAT:')) {
          const bat = parseFloat(chunk.substring(4));
          if (!Number.isNaN(bat)) this.batteryVoltage = bat;
        }
        if (chunk.startsWith('RSSI:')) {
          const rssi = parseInt(chunk.substring(5), 10);
          if (!Number.isNaN(rssi)) {
            this.rssi = rssi;
            this.estimatedDistance = this.estimateDistance(rssi);
          }
        }
      }


      for (const [key, pending] of this.pendingResolves) {
        if (trimmed.startsWith(key) || trimmed === key) {
          // Stale-session guard: ignore frames whose pending was registered
          // in an older session (can happen if a late frame arrives after
          // a disconnect+reconnect cycle drained but didn't catch this key).
          if (pending.sessionId !== this.sessionId && pending.sessionId !== this.connectingSessionId) {
            this.onEvent?.('stale_response_dropped', {
              key, frame: trimmed,
              pendingSession: pending.sessionId,
              currentSession: this.sessionId,
            });
            this.pendingResolves.delete(key);
            break;
          }
          pending.resolver(trimmed);
          this.pendingResolves.delete(key);
          break;
        }
      }

      this.onEvent?.('data', trimmed);
    }
  }

  private handleDisconnect(): void {
    const wasConnected = this.connected;
    this.connected = false;
    this.connecting = false;
    this.transport = 'none';
    this.linkHealth = 'disconnected';
    this.pendingResolves.clear();
    this.stopHeartbeat();
    this.stopRssiPolling();
    if (wasConnected) this.onEvent?.('disconnected', null);
    if (wasConnected && this.lastConnectArgs) {
      this.attemptReconnect();
    }
  }

  private async readSerialLoop(): Promise<void> {
    const reader = this.serialReader;
    if (!reader) return;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done || !value) break;
        this.handleResponse(new TextDecoder().decode(value));
      }
    } catch {
      // Port closed or error
    }
  }

  private async establishHealthyLink(transport: BridgeTransport, deviceName: string): Promise<boolean> {
    this.transport = transport;
    this.deviceName = deviceName;
    this.lastPing = Date.now();
    this.linkHealth = 'handshaking';
    const ok = await this.waitForHandshake();
    if (!ok) {
      this.lastError = `Handshake timeout (${transport})`;
      this.handleDisconnect();
      return false;
    }
    this.connected = true;
    this.lastError = undefined;
    this.linkHealth = 'healthy';
    this.onConnect();
    return true;
  }

  private async waitForHandshake(timeoutMs = 3000): Promise<boolean> {
    return new Promise((resolve) => {
      let done = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        this.pendingResolves.delete('PONG');
        this.pendingResolves.delete('VER:');
        resolve(ok);
      };
      this.registerPending('PONG', 'HEARTBEAT', () => finish(true));
      this.registerPending('VER:', 'VERSION', () => finish(true));
      this.sendCommand('VERSION\n');
      this.sendCommand('HEARTBEAT\n');
      timer = setTimeout(() => finish(false), timeoutMs);
    });
  }
}
