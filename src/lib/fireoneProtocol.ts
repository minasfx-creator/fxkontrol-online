/**
 * FireOne XL4+ Serial Protocol Engine
 * 
 * Implements the communication protocol for FireOne firing systems:
 * - RS-485 bus communication (9600 baud, 8N1)
 * - Master → Field Module addressing (1–99)
 * - ARM/DISARM with safety interlock
 * - FIRE with igniter position (1–32)
 * - CONTINUITY CHECK per module
 * - STATUS polling (battery, signal, temperature)
 * - EMERGENCY STOP broadcast
 * - Heartbeat keep-alive
 * 
 * Protocol frame format:
 * [STX][MODULE_ADDR][CMD][PAYLOAD...][CHECKSUM][ETX]
 * 
 * Compatible with WebSerial API for browser-based hardware control.
 */

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

export const FIREONE_BAUD_RATE = 9600;
export const FIREONE_DATA_BITS = 8;
export const FIREONE_STOP_BITS = 1;
export const FIREONE_PARITY = 'none';

const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;
const NAK = 0x15;
const BROADCAST_ADDR = 0x00;

// ═══════════════════════════════════════════════════════════
// COMMAND DEFINITIONS
// ═══════════════════════════════════════════════════════════

export enum FireOneCmd {
  // Safety & control
  ARM             = 0x41,  // 'A' — Arm module
  DISARM          = 0x44,  // 'D' — Disarm module
  FIRE            = 0x46,  // 'F' — Fire igniter
  EMERGENCY_STOP  = 0x58,  // 'X' — Emergency stop (broadcast)

  // Status & diagnostics
  STATUS          = 0x53,  // 'S' — Request module status
  CONTINUITY      = 0x43,  // 'C' — Continuity check
  HEARTBEAT       = 0x48,  // 'H' — Keep-alive heartbeat
  IDENTIFY        = 0x49,  // 'I' — Identify/discover module
  RESET           = 0x52,  // 'R' — Reset module

  // Configuration
  SET_ADDRESS     = 0x4E,  // 'N' — Set module address
  SET_MODE        = 0x4D,  // 'M' — Set firing mode (manual/auto)
  SET_DELAY       = 0x4C,  // 'L' — Set igniter delay
  SYNC_TIME       = 0x54,  // 'T' — Sync timecode

  // Batch operations
  ARM_ALL         = 0x61,  // 'a' — Arm all modules (broadcast)
  DISARM_ALL      = 0x64,  // 'd' — Disarm all modules (broadcast)
  FIRE_SEQUENCE   = 0x66,  // 'f' — Fire sequence (multi-igniter)
  STATUS_ALL      = 0x73,  // 's' — Status poll all
}

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface FireOneModuleStatus {
  moduleAddress: number;
  armed: boolean;
  batteryVoltage: number;
  temperature: number;
  signalStrength: number;
  firmwareVersion: string;
  igniters: FireOneIgniterStatus[];
  lastSeen: number;
  wireless: boolean;
  errors: string[];
}

export interface FireOneIgniterStatus {
  position: number;       // 1–32
  connected: boolean;
  fired: boolean;
  resistance: number;     // Ω (0 = open, >50 = short, 1–5 = normal)
  continuityOk: boolean;
}

export interface FireOneFrame {
  moduleAddr: number;
  command: FireOneCmd;
  payload: Uint8Array;
  checksum: number;
}

export interface FireOneConnection {
  port: any;  // SerialPort
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  writer: WritableStreamDefaultWriter<Uint8Array> | null;
  connected: boolean;
  readLoop: boolean;
}

export type FireOneEventType =
  | 'module-discovered'
  | 'status-update'
  | 'continuity-result'
  | 'fire-confirm'
  | 'arm-confirm'
  | 'error'
  | 'heartbeat'
  | 'emergency-stop';

export interface FireOneEvent {
  type: FireOneEventType;
  moduleAddress: number;
  data: any;
  timestamp: number;
}

export type FireOneListener = (event: FireOneEvent) => void;

// ═══════════════════════════════════════════════════════════
// CHECKSUM
// ═══════════════════════════════════════════════════════════

function calcChecksum(moduleAddr: number, cmd: number, payload: Uint8Array): number {
  let sum = moduleAddr + cmd;
  for (let i = 0; i < payload.length; i++) {
    sum += payload[i];
  }
  return sum & 0xFF;
}

// ═══════════════════════════════════════════════════════════
// FRAME BUILDER
// ═══════════════════════════════════════════════════════════

export function buildFrame(moduleAddr: number, cmd: FireOneCmd, payload: Uint8Array = new Uint8Array(0)): Uint8Array {
  const checksum = calcChecksum(moduleAddr, cmd, payload);
  const frame = new Uint8Array(4 + payload.length + 1);
  let offset = 0;
  frame[offset++] = STX;
  frame[offset++] = moduleAddr & 0xFF;
  frame[offset++] = cmd;
  for (let i = 0; i < payload.length; i++) {
    frame[offset++] = payload[i];
  }
  frame[offset++] = checksum;
  frame[offset++] = ETX;
  return frame;
}

// ═══════════════════════════════════════════════════════════
// FRAME PARSER
// ═══════════════════════════════════════════════════════════

export function parseFrame(data: Uint8Array): FireOneFrame | null {
  if (data.length < 5) return null;
  if (data[0] !== STX || data[data.length - 1] !== ETX) return null;

  const moduleAddr = data[1];
  const command = data[2] as FireOneCmd;
  const payload = data.slice(3, data.length - 2);
  const checksum = data[data.length - 2];

  const expectedChecksum = calcChecksum(moduleAddr, command, payload);
  if (checksum !== expectedChecksum) return null;

  return { moduleAddr, command, payload, checksum };
}

// ═══════════════════════════════════════════════════════════
// PARSE STATUS RESPONSE
// ═══════════════════════════════════════════════════════════

export function parseStatusPayload(moduleAddr: number, payload: Uint8Array): FireOneModuleStatus {
  // Payload layout:
  // [0]    = armed flag (0/1)
  // [1-2]  = battery voltage (mV, big-endian)
  // [3]    = temperature (signed, °C + 40 offset)
  // [4]    = signal strength (0-100%)
  // [5-6]  = firmware version (major.minor)
  // [7]    = error flags
  // [8..N] = igniter status bytes (1 byte each: bits = connected|fired|continuity, 5 bits = resistance/10)

  const armed = (payload[0] ?? 0) !== 0;
  const batteryMv = ((payload[1] ?? 0) << 8) | (payload[2] ?? 0);
  const temp = (payload[3] ?? 40) - 40;
  const signal = payload[4] ?? 0;
  const fwMajor = payload[5] ?? 1;
  const fwMinor = payload[6] ?? 0;
  const errorFlags = payload[7] ?? 0;

  const errors: string[] = [];
  if (errorFlags & 0x01) errors.push('LOW_BATTERY');
  if (errorFlags & 0x02) errors.push('OVER_TEMP');
  if (errorFlags & 0x04) errors.push('COMM_ERROR');
  if (errorFlags & 0x08) errors.push('SHORT_CIRCUIT');

  const igniters: FireOneIgniterStatus[] = [];
  for (let i = 0; i < 32; i++) {
    const byte = payload[8 + i] ?? 0;
    const connected = (byte & 0x80) !== 0;
    const fired = (byte & 0x40) !== 0;
    const continuityOk = (byte & 0x20) !== 0;
    const resistanceTenths = byte & 0x1F;
    igniters.push({
      position: i + 1,
      connected,
      fired,
      continuityOk,
      resistance: resistanceTenths / 10 * 5, // scale to 0–15.5Ω range
    });
  }

  return {
    moduleAddress: moduleAddr,
    armed,
    batteryVoltage: batteryMv / 1000,
    temperature: temp,
    signalStrength: signal,
    firmwareVersion: `${fwMajor}.${fwMinor}`,
    igniters,
    lastSeen: Date.now(),
    wireless: false,
    errors,
  };
}

// ═══════════════════════════════════════════════════════════
// COMMAND BUILDERS — convenience functions
// ═══════════════════════════════════════════════════════════

export function buildArmCommand(moduleAddr: number): Uint8Array {
  return buildFrame(moduleAddr, FireOneCmd.ARM);
}

export function buildDisarmCommand(moduleAddr: number): Uint8Array {
  return buildFrame(moduleAddr, FireOneCmd.DISARM);
}

export function buildFireCommand(moduleAddr: number, igniterPos: number, durationMs: number = 500): Uint8Array {
  const payload = new Uint8Array(3);
  payload[0] = igniterPos & 0xFF;
  payload[1] = (durationMs >> 8) & 0xFF;
  payload[2] = durationMs & 0xFF;
  return buildFrame(moduleAddr, FireOneCmd.FIRE, payload);
}

export function buildContinuityCommand(moduleAddr: number): Uint8Array {
  return buildFrame(moduleAddr, FireOneCmd.CONTINUITY);
}

export function buildStatusCommand(moduleAddr: number): Uint8Array {
  return buildFrame(moduleAddr, FireOneCmd.STATUS);
}

export function buildEmergencyStop(): Uint8Array {
  return buildFrame(BROADCAST_ADDR, FireOneCmd.EMERGENCY_STOP);
}

export function buildHeartbeat(): Uint8Array {
  return buildFrame(BROADCAST_ADDR, FireOneCmd.HEARTBEAT);
}

export function buildIdentify(moduleAddr: number): Uint8Array {
  return buildFrame(moduleAddr, FireOneCmd.IDENTIFY);
}

export function buildArmAll(): Uint8Array {
  return buildFrame(BROADCAST_ADDR, FireOneCmd.ARM_ALL);
}

export function buildDisarmAll(): Uint8Array {
  return buildFrame(BROADCAST_ADDR, FireOneCmd.DISARM_ALL);
}

export function buildFireSequence(moduleAddr: number, igniters: number[], delayMs: number = 100): Uint8Array {
  const payload = new Uint8Array(2 + igniters.length);
  payload[0] = (delayMs >> 8) & 0xFF;
  payload[1] = delayMs & 0xFF;
  igniters.forEach((pos, i) => { payload[2 + i] = pos & 0xFF; });
  return buildFrame(moduleAddr, FireOneCmd.FIRE_SEQUENCE, payload);
}

export function buildSyncTimecode(timecodeMs: number): Uint8Array {
  const payload = new Uint8Array(4);
  payload[0] = (timecodeMs >> 24) & 0xFF;
  payload[1] = (timecodeMs >> 16) & 0xFF;
  payload[2] = (timecodeMs >> 8) & 0xFF;
  payload[3] = timecodeMs & 0xFF;
  return buildFrame(BROADCAST_ADDR, FireOneCmd.SYNC_TIME, payload);
}

export function buildSetAddress(currentAddr: number, newAddr: number): Uint8Array {
  return buildFrame(currentAddr, FireOneCmd.SET_ADDRESS, new Uint8Array([newAddr & 0xFF]));
}

export function buildReset(moduleAddr: number): Uint8Array {
  return buildFrame(moduleAddr, FireOneCmd.RESET);
}

// ═══════════════════════════════════════════════════════════
// FIREONE SERIAL CONTROLLER CLASS
// ═══════════════════════════════════════════════════════════

export class FireOneController {
  private conn: FireOneConnection | null = null;
  private listeners: FireOneListener[] = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private readBuffer = new Uint8Array(0);
  private modules: Map<number, FireOneModuleStatus> = new Map();

  get isConnected(): boolean {
    return this.conn?.connected ?? false;
  }

  get discoveredModules(): FireOneModuleStatus[] {
    return Array.from(this.modules.values()).sort((a, b) => a.moduleAddress - b.moduleAddress);
  }

  on(listener: FireOneListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit(event: FireOneEvent): void {
    this.listeners.forEach(l => l(event));
  }

  // ─── Connect via WebSerial ───
  async connect(): Promise<void> {
    if (!('serial' in navigator)) {
      throw new Error('WebSerial API não suportada neste navegador');
    }

    const nav = navigator as any;
    const port = await nav.serial.requestPort({
      filters: [
        { usbVendorId: 0x0403 },  // FTDI (common RS-485 adapters)
        { usbVendorId: 0x067B },  // Prolific PL2303
        { usbVendorId: 0x10C4 },  // Silicon Labs CP210x
        { usbVendorId: 0x1A86 },  // CH340/CH341
      ],
    });

    await port.open({
      baudRate: FIREONE_BAUD_RATE,
      dataBits: FIREONE_DATA_BITS,
      stopBits: FIREONE_STOP_BITS,
      parity: FIREONE_PARITY,
      bufferSize: 4096,
    });

    const reader = port.readable?.getReader() ?? null;
    const writer = port.writable?.getWriter() ?? null;

    this.conn = { port, reader, writer, connected: true, readLoop: true };

    // Start read loop
    this.startReadLoop();

    // Start heartbeat (every 2s)
    this.heartbeatInterval = setInterval(() => {
      this.send(buildHeartbeat()).catch(() => {});
    }, 2000);
  }

  // ─── Disconnect ───
  async disconnect(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.conn) {
      this.conn.readLoop = false;
      try {
        if (this.conn.reader) {
          await this.conn.reader.cancel().catch(() => {});
          this.conn.reader.releaseLock();
        }
        if (this.conn.writer) {
          await this.conn.writer.close().catch(() => {});
          this.conn.writer.releaseLock();
        }
        await this.conn.port.close().catch(() => {});
      } catch { /* ignore */ }
      this.conn.connected = false;
      this.conn = null;
    }

    this.modules.clear();
  }

  // ─── Send raw frame ───
  async send(data: Uint8Array): Promise<void> {
    if (!this.conn?.writer || !this.conn.connected) {
      throw new Error('Não conectado ao hardware FireOne');
    }
    await this.conn.writer.write(data);
  }

  // ─── High-level commands ───
  async armModule(addr: number): Promise<void> {
    await this.send(buildArmCommand(addr));
  }

  async disarmModule(addr: number): Promise<void> {
    await this.send(buildDisarmCommand(addr));
  }

  async fireIgniter(addr: number, igniterPos: number, durationMs = 500): Promise<void> {
    await this.send(buildFireCommand(addr, igniterPos, durationMs));
  }

  async emergencyStop(): Promise<void> {
    await this.send(buildEmergencyStop());
    // Send 3 times for redundancy
    await this.send(buildEmergencyStop());
    await this.send(buildEmergencyStop());
    this.modules.forEach(m => { m.armed = false; });
  }

  async requestStatus(addr: number): Promise<void> {
    await this.send(buildStatusCommand(addr));
  }

  async requestContinuity(addr: number): Promise<void> {
    await this.send(buildContinuityCommand(addr));
  }

  async discoverModules(maxAddr = 20): Promise<void> {
    for (let addr = 1; addr <= maxAddr; addr++) {
      await this.send(buildIdentify(addr));
      await new Promise(r => setTimeout(r, 50)); // 50ms gap between polls
    }
  }

  async armAll(): Promise<void> {
    await this.send(buildArmAll());
  }

  async disarmAll(): Promise<void> {
    await this.send(buildDisarmAll());
    this.modules.forEach(m => { m.armed = false; });
  }

  async syncTimecode(ms: number): Promise<void> {
    await this.send(buildSyncTimecode(ms));
  }

  async fireSequence(addr: number, igniters: number[], delayMs = 100): Promise<void> {
    await this.send(buildFireSequence(addr, igniters, delayMs));
  }

  // ─── Read loop ───
  private async startReadLoop(): Promise<void> {
    if (!this.conn?.reader) return;

    while (this.conn.readLoop) {
      try {
        const { value, done } = await this.conn.reader.read();
        if (done) break;
        if (value) {
          this.processIncoming(value);
        }
      } catch {
        break;
      }
    }
  }

  private processIncoming(chunk: Uint8Array): void {
    // Append to buffer
    const newBuf = new Uint8Array(this.readBuffer.length + chunk.length);
    newBuf.set(this.readBuffer, 0);
    newBuf.set(chunk, this.readBuffer.length);
    this.readBuffer = newBuf;

    // Extract complete frames
    while (true) {
      const stxIdx = this.readBuffer.indexOf(STX);
      if (stxIdx === -1) { this.readBuffer = new Uint8Array(0); break; }
      const etxIdx = this.readBuffer.indexOf(ETX, stxIdx);
      if (etxIdx === -1) break; // incomplete frame

      const frameData = this.readBuffer.slice(stxIdx, etxIdx + 1);
      this.readBuffer = this.readBuffer.slice(etxIdx + 1);

      const frame = parseFrame(frameData);
      if (frame) {
        this.handleFrame(frame);
      }
    }
  }

  private handleFrame(frame: FireOneFrame): void {
    const addr = frame.moduleAddr;

    switch (frame.command) {
      case FireOneCmd.STATUS: {
        const status = parseStatusPayload(addr, frame.payload);
        this.modules.set(addr, status);
        this.emit({ type: 'status-update', moduleAddress: addr, data: status, timestamp: Date.now() });
        break;
      }

      case FireOneCmd.CONTINUITY: {
        const status = this.modules.get(addr);
        if (status) {
          // Update igniter continuity from payload
          for (let i = 0; i < Math.min(32, frame.payload.length); i++) {
            const byte = frame.payload[i];
            if (status.igniters[i]) {
              status.igniters[i].connected = (byte & 0x80) !== 0;
              status.igniters[i].continuityOk = (byte & 0x20) !== 0;
              status.igniters[i].resistance = (byte & 0x1F) / 10 * 5;
            }
          }
          this.modules.set(addr, { ...status, lastSeen: Date.now() });
        }
        this.emit({ type: 'continuity-result', moduleAddress: addr, data: frame.payload, timestamp: Date.now() });
        break;
      }

      case FireOneCmd.FIRE: {
        const igniterPos = frame.payload[0] ?? 0;
        const module = this.modules.get(addr);
        if (module) {
          const ig = module.igniters.find(i => i.position === igniterPos);
          if (ig) ig.fired = true;
          this.modules.set(addr, { ...module, lastSeen: Date.now() });
        }
        this.emit({ type: 'fire-confirm', moduleAddress: addr, data: { igniterPos }, timestamp: Date.now() });
        break;
      }

      case FireOneCmd.ARM: {
        const module = this.modules.get(addr);
        if (module) {
          module.armed = true;
          this.modules.set(addr, { ...module, lastSeen: Date.now() });
        }
        this.emit({ type: 'arm-confirm', moduleAddress: addr, data: { armed: true }, timestamp: Date.now() });
        break;
      }

      case FireOneCmd.DISARM: {
        const module = this.modules.get(addr);
        if (module) {
          module.armed = false;
          this.modules.set(addr, { ...module, lastSeen: Date.now() });
        }
        this.emit({ type: 'arm-confirm', moduleAddress: addr, data: { armed: false }, timestamp: Date.now() });
        break;
      }

      case FireOneCmd.IDENTIFY: {
        // Module responded to identify — parse as status
        const status = parseStatusPayload(addr, frame.payload);
        this.modules.set(addr, status);
        this.emit({ type: 'module-discovered', moduleAddress: addr, data: status, timestamp: Date.now() });
        break;
      }

      case FireOneCmd.HEARTBEAT: {
        const module = this.modules.get(addr);
        if (module) {
          this.modules.set(addr, { ...module, lastSeen: Date.now() });
        }
        this.emit({ type: 'heartbeat', moduleAddress: addr, data: null, timestamp: Date.now() });
        break;
      }

      case FireOneCmd.EMERGENCY_STOP: {
        this.modules.forEach(m => { m.armed = false; });
        this.emit({ type: 'emergency-stop', moduleAddress: addr, data: null, timestamp: Date.now() });
        break;
      }

      default: {
        // Unknown response
        this.emit({ type: 'error', moduleAddress: addr, data: { cmd: frame.command, payload: frame.payload }, timestamp: Date.now() });
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// SIMULATION — for testing without hardware
// ═══════════════════════════════════════════════════════════

export function createSimulatedModuleStatus(addr: number, wireless = false): FireOneModuleStatus {
  return {
    moduleAddress: addr,
    armed: false,
    batteryVoltage: 11.5 + Math.random() * 1.5,
    temperature: 20 + Math.floor(Math.random() * 15),
    signalStrength: wireless ? 60 + Math.floor(Math.random() * 40) : 100,
    firmwareVersion: '2.4',
    igniters: Array.from({ length: 32 }, (_, i) => ({
      position: i + 1,
      connected: Math.random() > 0.1,
      fired: false,
      continuityOk: Math.random() > 0.15,
      resistance: 1.5 + Math.random() * 3.5,
    })),
    lastSeen: Date.now(),
    wireless,
    errors: [],
  };
}

// Singleton for app-wide access
let _controller: FireOneController | null = null;
export function getFireOneController(): FireOneController {
  if (!_controller) _controller = new FireOneController();
  return _controller;
}
