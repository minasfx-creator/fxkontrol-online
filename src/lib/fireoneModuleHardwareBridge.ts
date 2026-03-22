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
export type BridgeTransport = 'ble' | 'ble_lr' | 'usb' | 'websocket' | 'wifi_direct' | 'direct_relay' | 'none';

export interface BridgeStatus {
  transport: BridgeTransport;
  connected: boolean;
  deviceName: string;
  batteryVoltage?: number;
  firmwareVersion?: string;
  lastPing: number;
  txBytes: number;
  rxBytes: number;
  rssi?: number;
  estimatedDistance?: number;
}

export type BridgeEventHandler = (event: string, data: unknown) => void;

// BLE Service/Characteristic UUIDs (custom for FXK-ESP32)
const BLE_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const BLE_CHAR_TX_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
const BLE_CHAR_RX_UUID = '0000ffe2-0000-1000-8000-00805f9b34fb';

const HEARTBEAT_INTERVAL = 5000;
const FIRE_CONFIRM_TIMEOUT = 2000;

export class FireOneHardwareBridge {
  private transport: BridgeTransport = 'none';
  private connected = false;
  private deviceName = '';
  private firmwareVersion = '';
  private batteryVoltage?: number;
  private txBytes = 0;
  private rxBytes = 0;
  private lastPing = 0;
  private rssi?: number;
  private estimatedDistance?: number;

  private bleDevice: any = null;
  private bleCharTx: any = null;
  private bleCharRx: any = null;
  private serialPort: any = null;
  private serialReader: any = null;
  private serialWriter: any = null;
  private ws: WebSocket | null = null;

  private responseBuffer = '';
  private pendingResolves: Map<string, (value: string) => void> = new Map();
  private onEvent: BridgeEventHandler | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private rssiTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private lastConnectArgs: { method: string; args?: any } | null = null;

  constructor(eventHandler?: BridgeEventHandler) {
    this.onEvent = eventHandler ?? null;
  }

  // ─── Connection Methods ──────────────────────────────

  /** BLE padrão — alcance ~30m */
  async connectBLE(): Promise<boolean> {
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) throw new Error('Web Bluetooth not supported');

      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: [BLE_SERVICE_UUID] }],
        optionalServices: [BLE_SERVICE_UUID],
      });

      await this.setupBLEDevice(device, 'ble');
      return true;
    } catch (err) {
      console.warn('[HardwareBridge] BLE connect failed:', err);
      return false;
    }
  }

  /** BLE Long Range (Coded PHY / BLE 5.0) — alcance ~1km */
  async connectBLELongRange(): Promise<boolean> {
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) throw new Error('Web Bluetooth not supported');

      const device = await nav.bluetooth.requestDevice({
        filters: [
          { services: [BLE_SERVICE_UUID] },
          { namePrefix: 'FXK' },
        ],
        optionalServices: [BLE_SERVICE_UUID],
      });

      await this.setupBLEDevice(device, 'ble_lr');
      return true;
    } catch (err) {
      console.warn('[HardwareBridge] BLE LR connect failed:', err);
      return false;
    }
  }

  /** Shared BLE setup for both standard and Long Range */
  private async setupBLEDevice(device: any, transport: 'ble' | 'ble_lr'): Promise<void> {
    const server = await device.gatt!.connect();
    const service = await server.getPrimaryService(BLE_SERVICE_UUID);
    this.bleCharTx = await service.getCharacteristic(BLE_CHAR_TX_UUID);
    this.bleCharRx = await service.getCharacteristic(BLE_CHAR_RX_UUID);

    await this.bleCharRx.startNotifications();
    this.bleCharRx.addEventListener('characteristicvaluechanged', (event: any) => {
      const value = new TextDecoder().decode(event.target.value.buffer);
      this.handleResponse(value);
    });

    device.addEventListener('gattserverdisconnected', () => this.handleDisconnect());

    this.bleDevice = device;
    this.transport = transport;
    this.connected = true;
    this.deviceName = device.name || (transport === 'ble_lr' ? 'FXK-LR' : 'ESP32-FXK');
    this.lastPing = Date.now();
    this.lastConnectArgs = { method: transport };
    this.reconnectAttempts = 0;
    this.onConnect();
    this.startRssiPolling();
  }

  async connectUSB(baudRate = 115200): Promise<boolean> {
    try {
      if (!('serial' in navigator)) throw new Error('WebSerial not supported');

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });

      this.serialPort = port;
      this.serialReader = port.readable!.getReader();
      this.serialWriter = port.writable!.getWriter();

      this.transport = 'usb';
      this.connected = true;
      this.deviceName = 'ESP32-USB';
      this.lastPing = Date.now();
      this.lastConnectArgs = { method: 'usb' };
      this.reconnectAttempts = 0;

      this.readSerialLoop();
      this.onConnect();
      return true;
    } catch (err) {
      console.warn('[HardwareBridge] USB connect failed:', err);
      return false;
    }
  }

  async connectDirectRelay(baudRate = 115200): Promise<boolean> {
    try {
      if (!('serial' in navigator)) throw new Error('WebSerial not supported');

      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate });

      this.serialPort = port;
      this.serialReader = port.readable!.getReader();
      this.serialWriter = port.writable!.getWriter();

      this.transport = 'direct_relay';
      this.connected = true;
      this.deviceName = 'DirectRelay-USB';
      this.lastPing = Date.now();
      this.lastConnectArgs = { method: 'direct_relay' };
      this.reconnectAttempts = 0;

      this.readSerialLoop();
      this.onConnect();
      return true;
    } catch (err) {
      console.warn('[HardwareBridge] Direct Relay connect failed:', err);
      return false;
    }
  }

  async connectWebSocket(url = 'ws://192.168.4.1:81'): Promise<boolean> {
    const ok = await this.tryWebSocketConnect(url, 'websocket', 5000);
    if (ok) {
      this.lastConnectArgs = { method: 'websocket', args: url };
      this.reconnectAttempts = 0;
    }
    return ok;
  }

  /**
   * Wi-Fi Direct (P2P) — usa antena Wi-Fi do celular como "rádio"
   * Tenta auto-discovery via mDNS antes de fallback para IP fixo.
   */
  async connectWiFiDirect(url?: string): Promise<boolean> {
    const endpoints = [
      url,
      'ws://fxk-esp32.local:81',
      'ws://192.168.4.1:81',
      'ws://192.168.1.1:81',
    ].filter(Boolean) as string[];

    for (const endpoint of endpoints) {
      const ok = await this.tryWebSocketConnect(endpoint, 'wifi_direct', 3000);
      if (ok) {
        this.lastConnectArgs = { method: 'wifi_direct', args: endpoint };
        this.reconnectAttempts = 0;
        return true;
      }
    }
    return false;
  }

  private async tryWebSocketConnect(url: string, transport: BridgeTransport, timeout = 5000): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(url);
        const timer = setTimeout(() => { ws.close(); resolve(false); }, timeout);

        ws.onopen = () => {
          clearTimeout(timer);
          this.ws = ws;
          this.transport = transport;
          this.connected = true;
          this.deviceName = `FXK-${transport === 'wifi_direct' ? 'P2P' : 'WS'}(${url})`;
          this.lastPing = Date.now();
          this.onConnect();
          resolve(true);
        };
        ws.onmessage = (ev) => this.handleResponse(String(ev.data));
        ws.onclose = () => { clearTimeout(timer); this.handleDisconnect(); };
        ws.onerror = () => { clearTimeout(timer); resolve(false); };
      } catch { resolve(false); }
    });
  }

  async disconnect(): Promise<void> {
    this.lastConnectArgs = null; // Prevent auto-reconnect
    this.stopHeartbeat();
    this.stopRssiPolling();
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

  async fire(pin: number, durationMs: number): Promise<boolean> {
    const key = `OK:FIRE:${pin}`;
    return this.sendAndWaitConfirm(`FIRE:${pin}:${durationMs}\n`, key);
  }

  async fireBatch(mask: number, durationMs: number): Promise<boolean> {
    const maskHex = (mask >>> 0).toString(16).padStart(8, '0');
    return this.sendAndWaitConfirm(`BATCH:${maskHex}:${durationMs}\n`, 'OK:BATCH');
  }

  async eStop(): Promise<boolean> {
    return this.sendCommand('ESTOP\n');
  }

  async readContinuity(pin: number): Promise<number> {
    const key = `CONT:${pin}`;
    return new Promise<number>((resolve) => {
      this.pendingResolves.set(key, (val) => {
        const parts = val.split(':');
        resolve(parts.length >= 3 ? parseFloat(parts[2]) : 0);
      });
      this.sendCommand(`CONT:${pin}\n`);
      setTimeout(() => {
        if (this.pendingResolves.has(key)) {
          this.pendingResolves.delete(key);
          resolve(0);
        }
      }, 2000);
    });
  }

  async readCdsVoltage(pin: number): Promise<number> {
    const key = `CDS:${pin}`;
    return new Promise<number>((resolve) => {
      this.pendingResolves.set(key, (val) => {
        const parts = val.split(':');
        resolve(parts.length >= 3 ? parseFloat(parts[2]) : 0);
      });
      this.sendCommand(`CDS:${pin}\n`);
      setTimeout(() => {
        if (this.pendingResolves.has(key)) {
          this.pendingResolves.delete(key);
          resolve(0);
        }
      }, 2000);
    });
  }

  async setGpio(pin: number, high: boolean): Promise<boolean> {
    return this.sendCommand(`GPIO:${pin}:${high ? 'HIGH' : 'LOW'}\n`);
  }

  async requestStatus(): Promise<void> {
    await this.sendCommand('STATUS\n');
  }

  getStatus(): BridgeStatus {
    return {
      transport: this.transport,
      connected: this.connected,
      deviceName: this.deviceName,
      batteryVoltage: this.batteryVoltage,
      firmwareVersion: this.firmwareVersion,
      lastPing: this.lastPing,
      txBytes: this.txBytes,
      rxBytes: this.rxBytes,
      rssi: this.rssi,
      estimatedDistance: this.estimatedDistance,
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
        this.pendingResolves.set(key, () => resolve(true));
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
      this.pendingResolves.set(confirmKey, () => resolve(true));
      this.sendCommand(cmd);
      setTimeout(() => {
        if (this.pendingResolves.has(confirmKey)) {
          this.pendingResolves.delete(confirmKey);
          resolve(false);
        }
      }, FIRE_CONFIRM_TIMEOUT);
    });
  }

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

      if (trimmed.startsWith('BAT:')) {
        this.batteryVoltage = parseFloat(trimmed.substring(4));
      }

      if (trimmed.startsWith('RSSI:')) {
        this.rssi = parseInt(trimmed.substring(5));
        this.estimatedDistance = this.estimateDistance(this.rssi);
      }

      for (const [key, resolver] of this.pendingResolves) {
        if (trimmed.startsWith(key) || trimmed === key) {
          resolver(trimmed);
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
    this.transport = 'none';
    this.stopHeartbeat();
    this.stopRssiPolling();
    this.onEvent?.('disconnected', null);
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
}
