/**
 * FireOne XLII+ Serial Protocol Engine
 * 
 * Implements the communication protocol for FireOne firing systems:
 * - RS-485 bus communication (9600 baud, 8N1)
 * - Master → Field Module addressing (1–40 per XLII+ manual, 2×20 outputs)
 * - ARM/DISARM with safety interlock
 * - FIRE with igniter position (1–32) and duration clamped to 20–1000ms
 * - CONTINUITY CHECK per module
 * - STATUS polling (battery, signal, temperature)
 * - EMERGENCY STOP broadcast
 * - Heartbeat keep-alive
 * - UltraFire mode: download fire files to modules for sub-frame autonomous firing
 * - Priority Disable: 16 priority groups for selective product disabling
 * - Semi-Auto Events: operator-initiated GO between event groups
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

/** XLII+ supports 2×20 = 40 modules max */
export const FIREONE_MAX_MODULES = 40;

/** Firing duration range per XLII+ manual (firmware v5.00.08+) */
export const FIREONE_MIN_FIRE_DURATION = 20;   // ms
export const FIREONE_MAX_FIRE_DURATION = 1000;  // ms

/** Number of fire file slots in XLII+ panel memory */
export const FIREONE_FILE_SLOTS = 8;

/** Max events for Semi-Auto mode */
export const FIREONE_MAX_EVENTS = 999;

/** Max total firings per show file */
export const FIREONE_MAX_FIRINGS = 4000;

/** Number of priority groups */
export const FIREONE_PRIORITY_GROUPS = 16;

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

  // IFMx-i32Q specific
  DMX_OUT         = 0x4F,  // 'O' — Send DMX values to module's built-in DMX output
  MODULE_CONFIG   = 0x47,  // 'G' — Query/set module configuration

  // Wireless IFMx-i32Q
  WIRELESS_STATUS = 0x57,  // 'W' — Query wireless RSSI, channel, link quality
  WIRELESS_CONFIG = 0x56,  // 'V' — Set wireless channel, TX power, fallback mode

  // UltraFire mode (XLII+ manual)
  DOWNLOAD_MODULE = 0x55,  // 'U' — Download fire file data to module
  VERIFY_ULTRAFIRE = 0x50, // 'P' — Verify UltraFire download with verify code
  ULTRAFIRE_GO    = 0x67,  // 'g' — Start UltraFire autonomous playback

  // Priority Disable (XLII+ 16 priority groups)
  PRIORITY_DISABLE = 0x70, // 'p' — Enable/disable priority group (1–16)

  // Preset firing
  PRESET_LOAD     = 0x6C,  // 'l' — Load preset (module + cue combination)
  PRESET_FIRE     = 0x71,  // 'q' — Fire all loaded presets
  PRESET_CLEAR    = 0x72,  // 'r' — Clear preset buffer
}

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type WirelessConnectionMode = 'wired' | 'wireless' | 'fallback';

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
  serialNumber?: string;
  dmxUniverse?: number;
  rssiDbm?: number;
  wirelessChannel?: number;
  packetLoss?: number;
  linkQuality?: number;
  connectionMode?: WirelessConnectionMode;
  ultraFireVerified?: boolean;
}

export interface FireOneIgniterStatus {
  position: number;       // 1–32
  connected: boolean;
  fired: boolean;
  resistance: number;     // Ω — 5-bit field (0–31) × 0.5 = 0–15.5Ω range. Normal e-match: 1–5Ω. >10Ω = suspect. 0 = open circuit.
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
  | 'emergency-stop'
  | 'dmx-out-confirm'
  | 'config-response'
  | 'wireless-status'
  | 'wireless-fallback'
  | 'ultrafire-verify'
  | 'ultrafire-download-progress'
  | 'priority-update';

export interface FireOneModuleConfig {
  wireless: boolean;
  dmxUniverse: number;
  firingDelay: number;
  firmwareVersion: string;
  serialNumber: string;
}

export interface FireOneWirelessStatus {
  rssiDbm: number;
  channel: number;
  packetLoss: number;
  linkQuality: number;
  mode: WirelessConnectionMode;
  txPower: number;
}

export interface FireOneWirelessConfig {
  channel: number;
  txPower: number;
  autoFallback: boolean;
}

/** UltraFire cue data for downloading to modules */
export interface UltraFireCueData {
  igniterPos: number;     // 1–32
  timecodeMs: number;     // absolute time in show
  durationMs: number;     // firing duration (20–1000ms)
  priority: number;       // priority group (0 = none, 1–16)
}

export interface FireOneEvent {
  type: FireOneEventType;
  moduleAddress: number;
  data: any;
  timestamp: number;
}

export type FireOneListener = (event: FireOneEvent) => void;

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

/** Clamp firing duration to hardware-safe range (20–1000ms) */
export function clampFireDuration(durationMs: number): number {
  return Math.min(FIREONE_MAX_FIRE_DURATION, Math.max(FIREONE_MIN_FIRE_DURATION, Math.round(durationMs)));
}

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
  // [8..N] = igniter status bytes (1 byte each: bits = connected|fired|continuity, 5 bits = resistance × 0.5Ω)

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
      resistance: resistanceTenths * 0.5, // 5-bit field × 0.5 = 0–15.5Ω range
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

/** Build fire command with duration clamped to 20–1000ms (per XLII+ manual) */
export function buildFireCommand(moduleAddr: number, igniterPos: number, durationMs: number = 500): Uint8Array {
  const validDuration = clampFireDuration(durationMs);
  const payload = new Uint8Array(3);
  payload[0] = igniterPos & 0xFF;
  payload[1] = (validDuration >> 8) & 0xFF;
  payload[2] = validDuration & 0xFF;
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
// IFMx-i32Q SPECIFIC COMMANDS
// ═══════════════════════════════════════════════════════════

/** Send DMX values to IFMx-i32Q built-in DMX output port */
export function buildDmxOutCommand(moduleAddr: number, startChannel: number, values: number[]): Uint8Array {
  const payload = new Uint8Array(2 + values.length);
  payload[0] = (startChannel >> 8) & 0xFF;
  payload[1] = startChannel & 0xFF;
  values.forEach((v, i) => { payload[2 + i] = Math.min(255, Math.max(0, v)); });
  return buildFrame(moduleAddr, FireOneCmd.DMX_OUT, payload);
}

/** Query module configuration */
export function buildModuleConfigQuery(moduleAddr: number): Uint8Array {
  return buildFrame(moduleAddr, FireOneCmd.MODULE_CONFIG, new Uint8Array([0x00])); // 0x00 = query
}

/** Set module configuration */
export function buildModuleConfigSet(moduleAddr: number, config: Partial<FireOneModuleConfig>): Uint8Array {
  const payload = new Uint8Array(5);
  payload[0] = 0x01; // 0x01 = set
  payload[1] = config.wireless ? 1 : 0;
  payload[2] = (config.dmxUniverse ?? 0) & 0xFF;
  payload[3] = ((config.firingDelay ?? 0) >> 8) & 0xFF;
  payload[4] = (config.firingDelay ?? 0) & 0xFF;
  return buildFrame(moduleAddr, FireOneCmd.MODULE_CONFIG, payload);
}

/** Parse module config response payload */
export function parseModuleConfig(payload: Uint8Array): FireOneModuleConfig {
  return {
    wireless: (payload[0] ?? 0) !== 0,
    dmxUniverse: payload[1] ?? 0,
    firingDelay: ((payload[2] ?? 0) << 8) | (payload[3] ?? 0),
    firmwareVersion: `${payload[4] ?? 1}.${payload[5] ?? 0}`,
    serialNumber: Array.from(payload.slice(6, 14)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase(),
  };
}

// ═══════════════════════════════════════════════════════════
// WIRELESS IFMx-i32Q COMMANDS
// ═══════════════════════════════════════════════════════════

/** Query wireless status (RSSI, channel, link quality) */
export function buildWirelessStatusQuery(moduleAddr: number): Uint8Array {
  return buildFrame(moduleAddr, FireOneCmd.WIRELESS_STATUS, new Uint8Array([0x00]));
}

/** Set wireless configuration */
export function buildWirelessConfigCommand(moduleAddr: number, config: FireOneWirelessConfig): Uint8Array {
  const payload = new Uint8Array(4);
  payload[0] = 0x01; // set mode
  payload[1] = config.channel & 0xFF;
  payload[2] = config.txPower & 0x03;
  payload[3] = config.autoFallback ? 1 : 0;
  return buildFrame(moduleAddr, FireOneCmd.WIRELESS_CONFIG, payload);
}

/** Parse wireless status response */
export function parseWirelessStatus(payload: Uint8Array): FireOneWirelessStatus {
  const rssiRaw = payload[0] ?? 0;
  // RSSI is stored as unsigned offset: value = actual + 128 (so -128 to 0 dBm maps to 0-128)
  const rssiDbm = rssiRaw > 128 ? rssiRaw - 256 : rssiRaw - 128;
  return {
    rssiDbm,
    channel: payload[1] ?? 1,
    packetLoss: payload[2] ?? 0,
    linkQuality: payload[3] ?? 100,
    mode: payload[4] === 2 ? 'fallback' : payload[4] === 1 ? 'wireless' : 'wired',
    txPower: payload[5] ?? 3,
  };
}

// ═══════════════════════════════════════════════════════════
// ULTRAFIRE COMMANDS (XLII+ manual)
// ═══════════════════════════════════════════════════════════

/**
 * Download fire cue data to a module for UltraFire autonomous firing.
 * Each module stores its own cue list and fires based on synced timecode.
 * Payload: [verifyCode(2)][cueCount(1)][cues: igniterPos(1)+timeMs(4)+durationMs(2)+priority(1) × N]
 */
export function buildDownloadToModule(moduleAddr: number, verifyCode: number, cues: UltraFireCueData[]): Uint8Array {
  const cueBytes = 8; // per cue: 1 + 4 + 2 + 1
  const payload = new Uint8Array(3 + cues.length * cueBytes);
  payload[0] = (verifyCode >> 8) & 0xFF;
  payload[1] = verifyCode & 0xFF;
  payload[2] = cues.length & 0xFF;

  cues.forEach((cue, i) => {
    const off = 3 + i * cueBytes;
    const dur = clampFireDuration(cue.durationMs);
    payload[off] = cue.igniterPos & 0xFF;
    payload[off + 1] = (cue.timecodeMs >> 24) & 0xFF;
    payload[off + 2] = (cue.timecodeMs >> 16) & 0xFF;
    payload[off + 3] = (cue.timecodeMs >> 8) & 0xFF;
    payload[off + 4] = cue.timecodeMs & 0xFF;
    payload[off + 5] = (dur >> 8) & 0xFF;
    payload[off + 6] = dur & 0xFF;
    payload[off + 7] = cue.priority & 0x0F;
  });

  return buildFrame(moduleAddr, FireOneCmd.DOWNLOAD_MODULE, payload);
}

/** Verify UltraFire download — modules compare verify code and report readiness */
export function buildVerifyUltraFire(verifyCode: number): Uint8Array {
  const payload = new Uint8Array(2);
  payload[0] = (verifyCode >> 8) & 0xFF;
  payload[1] = verifyCode & 0xFF;
  return buildFrame(BROADCAST_ADDR, FireOneCmd.VERIFY_ULTRAFIRE, payload);
}

/** Start UltraFire autonomous playback — modules fire independently based on synced time */
export function buildUltraFireGo(): Uint8Array {
  return buildFrame(BROADCAST_ADDR, FireOneCmd.ULTRAFIRE_GO);
}

// ═══════════════════════════════════════════════════════════
// PRIORITY DISABLE COMMANDS
// ═══════════════════════════════════════════════════════════

/**
 * Enable or disable a priority group (1–16).
 * When disabled, all cues assigned to that priority will be skipped during firing.
 * Used for selectively disabling product groups during live shows (wind, safety, etc.)
 */
export function buildPriorityDisable(priority: number, enabled: boolean): Uint8Array {
  const p = Math.min(16, Math.max(1, priority));
  const payload = new Uint8Array(2);
  payload[0] = p;
  payload[1] = enabled ? 1 : 0;
  return buildFrame(BROADCAST_ADDR, FireOneCmd.PRIORITY_DISABLE, payload);
}

// ═══════════════════════════════════════════════════════════
// PRESET COMMANDS
// ═══════════════════════════════════════════════════════════

/** Load a module/cue into the preset buffer for batch firing */
export function buildPresetLoad(moduleAddr: number, igniterPos: number): Uint8Array {
  return buildFrame(BROADCAST_ADDR, FireOneCmd.PRESET_LOAD, new Uint8Array([moduleAddr, igniterPos]));
}

/** Fire all loaded presets simultaneously */
export function buildPresetFire(): Uint8Array {
  return buildFrame(BROADCAST_ADDR, FireOneCmd.PRESET_FIRE);
}

/** Clear preset buffer */
export function buildPresetClear(): Uint8Array {
  return buildFrame(BROADCAST_ADDR, FireOneCmd.PRESET_CLEAR);
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

  /** Discover modules — default 40 per XLII+ manual (2×20 outputs) */
  async discoverModules(maxAddr = FIREONE_MAX_MODULES): Promise<void> {
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

  /** Download UltraFire cues to a specific module */
  async downloadUltraFire(addr: number, verifyCode: number, cues: UltraFireCueData[]): Promise<void> {
    await this.send(buildDownloadToModule(addr, verifyCode, cues));
  }

  /** Verify all modules have correct UltraFire data */
  async verifyUltraFire(verifyCode: number): Promise<void> {
    await this.send(buildVerifyUltraFire(verifyCode));
  }

  /** Start UltraFire autonomous playback */
  async startUltraFire(): Promise<void> {
    await this.send(buildUltraFireGo());
  }

  /** Set priority group enabled/disabled */
  async setPriorityDisable(priority: number, enabled: boolean): Promise<void> {
    await this.send(buildPriorityDisable(priority, enabled));
  }

  /** Load preset, fire presets, clear presets */
  async loadPreset(moduleAddr: number, igniterPos: number): Promise<void> {
    await this.send(buildPresetLoad(moduleAddr, igniterPos));
  }

  async firePresets(): Promise<void> {
    await this.send(buildPresetFire());
  }

  async clearPresets(): Promise<void> {
    await this.send(buildPresetClear());
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
              status.igniters[i].resistance = (byte & 0x1F) * 0.5; // Fixed: × 0.5 for 0–15.5Ω range
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

      case FireOneCmd.DMX_OUT: {
        this.emit({ type: 'dmx-out-confirm', moduleAddress: addr, data: { payload: frame.payload }, timestamp: Date.now() });
        break;
      }

      case FireOneCmd.MODULE_CONFIG: {
        const config = parseModuleConfig(frame.payload);
        const module = this.modules.get(addr);
        if (module) {
          module.serialNumber = config.serialNumber;
          module.dmxUniverse = config.dmxUniverse;
          module.wireless = config.wireless;
          module.firmwareVersion = config.firmwareVersion;
          this.modules.set(addr, { ...module, lastSeen: Date.now() });
        }
        this.emit({ type: 'config-response', moduleAddress: addr, data: config, timestamp: Date.now() });
        break;
      }

      case FireOneCmd.WIRELESS_STATUS: {
        const ws = parseWirelessStatus(frame.payload);
        const module = this.modules.get(addr);
        if (module) {
          const prevMode = module.connectionMode;
          module.rssiDbm = ws.rssiDbm;
          module.wirelessChannel = ws.channel;
          module.packetLoss = ws.packetLoss;
          module.linkQuality = ws.linkQuality;
          module.connectionMode = ws.mode;
          module.wireless = ws.mode !== 'wired';
          this.modules.set(addr, { ...module, lastSeen: Date.now() });
          // Detect fallback transition
          if (prevMode === 'wireless' && ws.mode === 'fallback') {
            this.emit({ type: 'wireless-fallback', moduleAddress: addr, data: ws, timestamp: Date.now() });
          }
        }
        this.emit({ type: 'wireless-status', moduleAddress: addr, data: ws, timestamp: Date.now() });
        break;
      }

      case FireOneCmd.WIRELESS_CONFIG: {
        // ACK for wireless config set
        this.emit({ type: 'wireless-status', moduleAddress: addr, data: { configured: true }, timestamp: Date.now() });
        break;
      }

      case FireOneCmd.VERIFY_ULTRAFIRE: {
        // Module reports UltraFire verification result
        const verified = (frame.payload[0] ?? 0) === ACK;
        const module = this.modules.get(addr);
        if (module) {
          module.ultraFireVerified = verified;
          this.modules.set(addr, { ...module, lastSeen: Date.now() });
        }
        this.emit({ type: 'ultrafire-verify', moduleAddress: addr, data: { verified }, timestamp: Date.now() });
        break;
      }

      case FireOneCmd.DOWNLOAD_MODULE: {
        // ACK for download — report progress
        const accepted = (frame.payload[0] ?? 0) === ACK;
        this.emit({ type: 'ultrafire-download-progress', moduleAddress: addr, data: { accepted }, timestamp: Date.now() });
        break;
      }

      case FireOneCmd.PRIORITY_DISABLE: {
        const priority = frame.payload[0] ?? 0;
        const enabled = (frame.payload[1] ?? 0) !== 0;
        this.emit({ type: 'priority-update', moduleAddress: addr, data: { priority, enabled }, timestamp: Date.now() });
        break;
      }

      default: {
        this.emit({ type: 'error', moduleAddress: addr, data: { cmd: frame.command, payload: frame.payload }, timestamp: Date.now() });
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════
// SIMULATION — for testing without hardware
// ═══════════════════════════════════════════════════════════

export function createSimulatedModuleStatus(addr: number, wireless = false): FireOneModuleStatus {
  const rssi = wireless ? -(40 + Math.floor(Math.random() * 45)) : undefined;
  return {
    moduleAddress: addr,
    armed: false,
    batteryVoltage: 11.5 + Math.random() * 1.5,
    temperature: 20 + Math.floor(Math.random() * 15),
    signalStrength: wireless ? 60 + Math.floor(Math.random() * 40) : 100,
    firmwareVersion: '5.0',
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
    rssiDbm: rssi,
    wirelessChannel: wireless ? 1 + Math.floor(Math.random() * 16) : undefined,
    packetLoss: wireless ? Math.floor(Math.random() * 5) : undefined,
    linkQuality: wireless ? 80 + Math.floor(Math.random() * 20) : undefined,
    connectionMode: wireless ? 'wireless' : 'wired',
  };
}

// Singleton for app-wide access
let _controller: FireOneController | null = null;
export function getFireOneController(): FireOneController {
  if (!_controller) _controller = new FireOneController();
  return _controller;
}
