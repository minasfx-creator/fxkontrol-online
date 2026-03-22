/**
 * FireOne IFMx-i32Q Hardware Bridge
 * 
 * Connects the Virtual Module to real hardware via:
 * 1. Web Bluetooth BLE → ESP32
 * 2. WebSerial USB → ESP32
 * 3. WebSocket → ESP32 Wi-Fi server
 * 
 * ESP32 Firmware Protocol:
 *   FIRE:pin:durationMs\n     → fires igniter
 *   GPIO:pin:HIGH|LOW\n       → set GPIO
 *   CONT:pin\n                → read continuity (responds "CONT:pin:ohms\n")
 *   STATUS\n                  → responds "BAT:voltage;PINS:mask\n"
 *   ESTOP\n                   → emergency stop all
 * 
 * Minimal ESP32 Arduino sketch (see comments at bottom)
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type BridgeTransport = 'ble' | 'usb' | 'websocket' | 'none';

export interface BridgeStatus {
  transport: BridgeTransport;
  connected: boolean;
  deviceName: string;
  batteryVoltage?: number;
  firmwareVersion?: string;
  lastPing: number;
  txBytes: number;
  rxBytes: number;
}

export type BridgeEventHandler = (event: string, data: unknown) => void;

// BLE Service/Characteristic UUIDs (custom for FXK-ESP32)
const BLE_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const BLE_CHAR_TX_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
const BLE_CHAR_RX_UUID = '0000ffe2-0000-1000-8000-00805f9b34fb';

export class FireOneHardwareBridge {
  private transport: BridgeTransport = 'none';
  private connected = false;
  private deviceName = '';
  private txBytes = 0;
  private rxBytes = 0;
  private lastPing = 0;

  // Transport handles (use `any` for Web Bluetooth / WebSerial types not in default TS lib)
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

  constructor(eventHandler?: BridgeEventHandler) {
    this.onEvent = eventHandler ?? null;
  }

  // ─── Connection Methods ──────────────────────────────

  /** Connect via Web Bluetooth BLE */
  async connectBLE(): Promise<boolean> {
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) throw new Error('Web Bluetooth not supported');

      const device = await nav.bluetooth.requestDevice({
        filters: [{ services: [BLE_SERVICE_UUID] }],
        optionalServices: [BLE_SERVICE_UUID],
      });

      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      this.bleCharTx = await service.getCharacteristic(BLE_CHAR_TX_UUID);
      this.bleCharRx = await service.getCharacteristic(BLE_CHAR_RX_UUID);

      // Listen for responses
      await this.bleCharRx.startNotifications();
      this.bleCharRx.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = new TextDecoder().decode(event.target.value.buffer);
        this.handleResponse(value);
      });

      device.addEventListener('gattserverdisconnected', () => this.handleDisconnect());

      this.bleDevice = device;
      this.transport = 'ble';
      this.connected = true;
      this.deviceName = device.name || 'ESP32-FXK';
      this.lastPing = Date.now();
      this.onEvent?.('connected', { transport: 'ble', device: this.deviceName });
      return true;
    } catch (err) {
      console.warn('[HardwareBridge] BLE connect failed:', err);
      return false;
    }
  }

  /** Connect via WebSerial USB */
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

      // Start reading serial data
      this.readSerialLoop();

      this.onEvent?.('connected', { transport: 'usb', device: this.deviceName });
      return true;
    } catch (err) {
      console.warn('[HardwareBridge] USB connect failed:', err);
      return false;
    }
  }

  /** Connect via WebSocket to ESP32 Wi-Fi server */
  async connectWebSocket(url = 'ws://192.168.4.1:81'): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(url);

        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          this.ws = ws;
          this.transport = 'websocket';
          this.connected = true;
          this.deviceName = `ESP32-WS(${url})`;
          this.lastPing = Date.now();
          this.onEvent?.('connected', { transport: 'websocket', device: this.deviceName });
          resolve(true);
        };

        ws.onmessage = (ev) => {
          this.handleResponse(String(ev.data));
        };

        ws.onclose = () => {
          clearTimeout(timeout);
          this.handleDisconnect();
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      } catch {
        resolve(false);
      }
    });
  }

  /** Disconnect from hardware */
  async disconnect(): Promise<void> {
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

  /** Fire a single igniter pin */
  async fire(pin: number, durationMs: number): Promise<boolean> {
    const cmd = `FIRE:${pin}:${durationMs}\n`;
    return this.sendCommand(cmd);
  }

  /** Emergency stop */
  async eStop(): Promise<boolean> {
    return this.sendCommand('ESTOP\n');
  }

  /** Read continuity for a pin (returns ohms) */
  async readContinuity(pin: number): Promise<number> {
    const key = `CONT:${pin}`;
    return new Promise<number>((resolve) => {
      this.pendingResolves.set(key, (val) => {
        const parts = val.split(':');
        resolve(parts.length >= 3 ? parseFloat(parts[2]) : 0);
      });
      this.sendCommand(`CONT:${pin}\n`);

      // Timeout after 2s
      setTimeout(() => {
        if (this.pendingResolves.has(key)) {
          this.pendingResolves.delete(key);
          resolve(0);
        }
      }, 2000);
    });
  }

  /** Set GPIO pin directly */
  async setGpio(pin: number, high: boolean): Promise<boolean> {
    return this.sendCommand(`GPIO:${pin}:${high ? 'HIGH' : 'LOW'}\n`);
  }

  /** Request status from ESP32 */
  async requestStatus(): Promise<void> {
    await this.sendCommand('STATUS\n');
  }

  /** Get current bridge status */
  getStatus(): BridgeStatus {
    return {
      transport: this.transport,
      connected: this.connected,
      deviceName: this.deviceName,
      lastPing: this.lastPing,
      txBytes: this.txBytes,
      rxBytes: this.rxBytes,
    };
  }

  // ─── Private ──────────────────────────────────────────

  private async sendCommand(cmd: string): Promise<boolean> {
    const bytes = new TextEncoder().encode(cmd);
    this.txBytes += bytes.length;

    try {
      switch (this.transport) {
        case 'ble':
          if (this.bleCharTx) {
            await this.bleCharTx.writeValue(bytes);
            return true;
          }
          break;

        case 'usb':
          if (this.serialWriter) {
            await this.serialWriter.write(bytes);
            return true;
          }
          break;

        case 'websocket':
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

    // Process complete lines
    const lines = this.responseBuffer.split('\n');
    this.responseBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check if it matches a pending resolve
      for (const [key, resolver] of this.pendingResolves) {
        if (trimmed.startsWith(key)) {
          resolver(trimmed);
          this.pendingResolves.delete(key);
          break;
        }
      }

      this.onEvent?.('data', trimmed);
    }
  }

  private handleDisconnect(): void {
    this.connected = false;
    this.transport = 'none';
    this.onEvent?.('disconnected', null);
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

/**
 * ─── ESP32 Arduino Firmware Reference ────────────────────────
 * 
 * Minimal sketch for ESP32 + ULN2803 to receive commands:
 * 
 * ```cpp
 * #include <WiFi.h>
 * #include <WebSocketsServer.h>
 * 
 * // Pin mapping: GPIO 2-33 → ULN2803 inputs → relay/igniter outputs
 * const int IGNITER_PINS[32] = {
 *   2, 4, 5, 12, 13, 14, 15, 16,   // Bank A (ULN2803 #1)
 *   17, 18, 19, 21, 22, 23, 25, 26, // Bank B (ULN2803 #2)
 *   27, 32, 33, 34, 35, 36, 39, 0,  // Bank C (ULN2803 #3)
 *   1, 3, 6, 7, 8, 9, 10, 11        // Bank D (ULN2803 #4)
 * };
 * 
 * WebSocketsServer ws(81);
 * 
 * void setup() {
 *   Serial.begin(115200);
 *   for (int i = 0; i < 32; i++) {
 *     pinMode(IGNITER_PINS[i], OUTPUT);
 *     digitalWrite(IGNITER_PINS[i], LOW);
 *   }
 *   WiFi.softAP("FXK-ESP32", "fireworks");
 *   ws.begin();
 *   ws.onEvent(wsEvent);
 * }
 * 
 * void loop() {
 *   ws.loop();
 *   // Also handle Serial commands
 *   if (Serial.available()) {
 *     String cmd = Serial.readStringUntil('\n');
 *     processCommand(cmd, -1);
 *   }
 * }
 * 
 * void processCommand(String cmd, int clientNum) {
 *   if (cmd.startsWith("FIRE:")) {
 *     int pin = cmd.substring(5, cmd.indexOf(':', 5)).toInt();
 *     int dur = cmd.substring(cmd.lastIndexOf(':') + 1).toInt();
 *     if (pin >= 0 && pin < 32 && dur >= 20 && dur <= 1000) {
 *       digitalWrite(IGNITER_PINS[pin], HIGH);
 *       delay(dur);
 *       digitalWrite(IGNITER_PINS[pin], LOW);
 *       respond("OK:FIRE:" + String(pin), clientNum);
 *     }
 *   } else if (cmd.startsWith("ESTOP")) {
 *     for (int i = 0; i < 32; i++) digitalWrite(IGNITER_PINS[i], LOW);
 *     respond("OK:ESTOP", clientNum);
 *   } else if (cmd.startsWith("CONT:")) {
 *     int pin = cmd.substring(5).toInt();
 *     int adc = analogRead(IGNITER_PINS[pin]); // ADC for continuity
 *     float ohms = adc > 0 ? (3.3 / (adc / 4095.0) - 1.0) * 10.0 : 0;
 *     respond("CONT:" + String(pin) + ":" + String(ohms, 1), clientNum);
 *   } else if (cmd == "STATUS") {
 *     float bat = analogRead(A0) / 4095.0 * 16.5; // voltage divider
 *     respond("BAT:" + String(bat, 1), clientNum);
 *   }
 * }
 * 
 * void respond(String msg, int clientNum) {
 *   if (clientNum >= 0) ws.sendTXT(clientNum, msg + "\n");
 *   Serial.println(msg);
 * }
 * 
 * void wsEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length) {
 *   if (type == WStype_TEXT) {
 *     processCommand(String((char*)payload), num);
 *   }
 * }
 * ```
 */
