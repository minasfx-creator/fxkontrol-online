/**
 * FireOne IFMx-i32Q Hardware Bridge
 * 
 * Connects the Virtual Module to real hardware via:
 * 1. Web Bluetooth BLE → ESP32
 * 2. WebSerial USB → ESP32
 * 3. WebSocket → ESP32 Wi-Fi server
 * 
 * ESP32 Firmware Protocol:
 *   FIRE:pin:durationMs\n     → fires igniter (responds "OK:FIRE:pin\n")
 *   BATCH:mask:durationMs\n   → fire multiple via bitmask
 *   GPIO:pin:HIGH|LOW\n       → set GPIO
 *   CONT:pin\n                → read continuity (responds "CONT:pin:ohms\n")
 *   CDS:pin\n                 → read cap voltage (responds "CDS:pin:volts\n")
 *   STATUS\n                  → responds "BAT:voltage;PINS:mask\n"
 *   HEARTBEAT\n               → responds "PONG\n"
 *   VERSION\n                 → responds "VER:x.y.z\n"
 *   ESTOP\n                   → emergency stop all
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type BridgeTransport = 'ble' | 'usb' | 'websocket' | 'direct_relay' | 'none';

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

  constructor(eventHandler?: BridgeEventHandler) {
    this.onEvent = eventHandler ?? null;
  }

  // ─── Connection Methods ──────────────────────────────

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
      this.onConnect();
      return true;
    } catch (err) {
      console.warn('[HardwareBridge] BLE connect failed:', err);
      return false;
    }
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

      this.readSerialLoop();
      this.onConnect();
      return true;
    } catch (err) {
      console.warn('[HardwareBridge] USB connect failed:', err);
      return false;
    }
  }

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
          this.onConnect();
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

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
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

  /** Fire a single igniter pin — waits for hardware confirmation */
  async fire(pin: number, durationMs: number): Promise<boolean> {
    const key = `OK:FIRE:${pin}`;
    return this.sendAndWaitConfirm(`FIRE:${pin}:${durationMs}\n`, key);
  }

  /** Fire multiple pins via bitmask — hardware-level group fire */
  async fireBatch(mask: number, durationMs: number): Promise<boolean> {
    const maskHex = (mask >>> 0).toString(16).padStart(8, '0');
    return this.sendAndWaitConfirm(`BATCH:${maskHex}:${durationMs}\n`, 'OK:BATCH');
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
      setTimeout(() => {
        if (this.pendingResolves.has(key)) {
          this.pendingResolves.delete(key);
          resolve(0);
        }
      }, 2000);
    });
  }

  /** Read CDS capacitor voltage */
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
      batteryVoltage: this.batteryVoltage,
      firmwareVersion: this.firmwareVersion,
      lastPing: this.lastPing,
      txBytes: this.txBytes,
      rxBytes: this.rxBytes,
    };
  }

  // ─── Private ──────────────────────────────────────────

  private onConnect(): void {
    this.onEvent?.('connected', { transport: this.transport, device: this.deviceName });
    // Query firmware version
    this.sendCommand('VERSION\n');
    // Start heartbeat
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

  /** Send a command and wait for a specific confirmation response */
  private async sendAndWaitConfirm(cmd: string, confirmKey: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.pendingResolves.set(confirmKey, () => resolve(true));
      this.sendCommand(cmd);
      setTimeout(() => {
        if (this.pendingResolves.has(confirmKey)) {
          this.pendingResolves.delete(confirmKey);
          resolve(false); // Hardware didn't confirm in time
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

    const lines = this.responseBuffer.split('\n');
    this.responseBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Parse firmware version
      if (trimmed.startsWith('VER:')) {
        this.firmwareVersion = trimmed.substring(4);
        this.onEvent?.('firmware_version', this.firmwareVersion);
        continue;
      }

      // Parse battery voltage from STATUS response
      if (trimmed.startsWith('BAT:')) {
        this.batteryVoltage = parseFloat(trimmed.substring(4));
      }

      // Check pending resolves
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
    this.connected = false;
    this.transport = 'none';
    this.stopHeartbeat();
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
 * ─── ESP32-S3 Arduino Firmware Reference ────────────────────
 * 
 * Hardware: ESP32-S3 + 4x 74HC595 + 4x ULN2803A + CDS
 * 
 * ```cpp
 * #include <WiFi.h>
 * #include <WebSocketsServer.h>
 * #include <BLEDevice.h>
 * 
 * // Shift register pins
 * #define SR_DATA  11  // SER (DS)
 * #define SR_CLOCK 12  // SRCLK (SH_CP)
 * #define SR_LATCH 13  // RCLK (ST_CP)
 * 
 * // Continuity MUX pins (2x CD4051)
 * #define MUX_A    4
 * #define MUX_B    5
 * #define MUX_C    6
 * #define MUX_SEL  7   // selects CD4051 #1 vs #2
 * #define MUX_ADC  1   // ADC input
 * 
 * // CDS control
 * #define CDS_CHARGE_EN 14  // master charge enable
 * 
 * uint32_t outputMask = 0;
 * WebSocketsServer ws(81);
 * 
 * void shiftOut32(uint32_t mask) {
 *   digitalWrite(SR_LATCH, LOW);
 *   for (int i = 31; i >= 0; i--) {
 *     digitalWrite(SR_DATA, (mask >> i) & 1);
 *     digitalWrite(SR_CLOCK, HIGH);
 *     delayMicroseconds(1);
 *     digitalWrite(SR_CLOCK, LOW);
 *   }
 *   digitalWrite(SR_LATCH, HIGH);
 * }
 * 
 * void firePin(int pin, int durMs) {
 *   if (pin < 0 || pin > 31 || durMs < 20 || durMs > 1000) return;
 *   outputMask |= (1UL << pin);
 *   shiftOut32(outputMask);
 *   delay(durMs);
 *   outputMask &= ~(1UL << pin);
 *   shiftOut32(outputMask);
 * }
 * 
 * void fireBatch(uint32_t mask, int durMs) {
 *   outputMask |= mask;
 *   shiftOut32(outputMask);
 *   delay(durMs);
 *   outputMask &= ~mask;
 *   shiftOut32(outputMask);
 * }
 * 
 * float readContinuity(int pin) {
 *   // Select MUX channel
 *   int ch = pin % 16;
 *   digitalWrite(MUX_SEL, pin >= 16 ? HIGH : LOW);
 *   digitalWrite(MUX_A, ch & 1);
 *   digitalWrite(MUX_B, (ch >> 1) & 1);
 *   digitalWrite(MUX_C, (ch >> 2) & 1);
 *   delayMicroseconds(100);
 *   int adc = analogRead(MUX_ADC);
 *   return adc > 0 ? (3.3 / (adc / 4095.0) - 1.0) * 10.0 : 0;
 * }
 * 
 * void eStopAll() {
 *   outputMask = 0;
 *   shiftOut32(0);
 *   digitalWrite(CDS_CHARGE_EN, LOW);
 * }
 * 
 * void processCommand(String cmd, int clientNum) {
 *   cmd.trim();
 *   if (cmd.startsWith("FIRE:")) {
 *     int c1 = cmd.indexOf(':', 5);
 *     int pin = cmd.substring(5, c1).toInt();
 *     int dur = cmd.substring(c1 + 1).toInt();
 *     firePin(pin, dur);
 *     respond("OK:FIRE:" + String(pin), clientNum);
 *   } else if (cmd.startsWith("BATCH:")) {
 *     int c1 = cmd.indexOf(':', 6);
 *     uint32_t mask = strtoul(cmd.substring(6, c1).c_str(), NULL, 16);
 *     int dur = cmd.substring(c1 + 1).toInt();
 *     fireBatch(mask, dur);
 *     respond("OK:BATCH", clientNum);
 *   } else if (cmd.startsWith("ESTOP")) {
 *     eStopAll();
 *     respond("OK:ESTOP", clientNum);
 *   } else if (cmd.startsWith("CONT:")) {
 *     int pin = cmd.substring(5).toInt();
 *     float ohms = readContinuity(pin);
 *     respond("CONT:" + String(pin) + ":" + String(ohms, 1), clientNum);
 *   } else if (cmd.startsWith("CDS:")) {
 *     int pin = cmd.substring(4).toInt();
 *     // Read CDS voltage via ADC (separate MUX or inline divider)
 *     float volts = analogRead(MUX_ADC) / 4095.0 * 12.0;
 *     respond("CDS:" + String(pin) + ":" + String(volts, 1), clientNum);
 *   } else if (cmd == "STATUS") {
 *     float bat = analogRead(A0) / 4095.0 * 16.5;
 *     respond("BAT:" + String(bat, 1), clientNum);
 *   } else if (cmd == "HEARTBEAT") {
 *     respond("PONG", clientNum);
 *   } else if (cmd == "VERSION") {
 *     respond("VER:1.0.0", clientNum);
 *   }
 * }
 * 
 * void respond(String msg, int clientNum) {
 *   if (clientNum >= 0) ws.sendTXT(clientNum, msg + "\n");
 *   Serial.println(msg);
 * }
 * 
 * void setup() {
 *   Serial.begin(115200);
 *   pinMode(SR_DATA, OUTPUT);
 *   pinMode(SR_CLOCK, OUTPUT);
 *   pinMode(SR_LATCH, OUTPUT);
 *   pinMode(CDS_CHARGE_EN, OUTPUT);
 *   shiftOut32(0); // all off
 *   WiFi.softAP("FXK-ESP32", "fireworks");
 *   ws.begin();
 *   ws.onEvent([](uint8_t num, WStype_t type, uint8_t *payload, size_t len) {
 *     if (type == WStype_TEXT) processCommand(String((char*)payload), num);
 *   });
 * }
 * 
 * void loop() {
 *   ws.loop();
 *   if (Serial.available()) {
 *     String cmd = Serial.readStringUntil('\n');
 *     processCommand(cmd, -1);
 *   }
 * }
 * ```
 */
