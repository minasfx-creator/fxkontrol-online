/**
 * PBUS Protocol Engine — Showven PyroSlave Native Communication
 * 
 * Serial protocol for PyroSlave C16, X4, PyroMote devices.
 * Frame: [PREAMBLE 0xAA][DEVICE_ADDR][CMD][LEN][PAYLOAD...][CRC16_HI][CRC16_LO][TERM 0x55]
 * Bus: 19200 baud, 8N1
 * Dual-band wireless: 433MHz (range) / 868MHz (bandwidth)
 */

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

export const PBUS_BAUD_RATE = 19200;
export const PBUS_DATA_BITS = 8;
export const PBUS_STOP_BITS = 1;
export const PBUS_PARITY = 'none';

const PREAMBLE = 0xAA;
const TERMINATOR = 0x55;
const BROADCAST_ADDR = 0x00;
const MAX_SCAN_ADDR = 64;

// ═══════════════════════════════════════════════════════════
// COMMAND DEFINITIONS
// ═══════════════════════════════════════════════════════════

export enum PBusCmd {
  DISCOVER    = 0x01,
  ARM         = 0x10,
  DISARM      = 0x11,
  FIRE        = 0x20,
  FIRE_SEQ    = 0x21,
  STATUS      = 0x30,
  CUE_STATUS  = 0x31,
  BATTERY     = 0x32,
  WIRELESS    = 0x33,
  CONFIG      = 0x40,
  SET_BAND    = 0x41,
  ESTOP       = 0xFF,
}

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export type PBusWirelessBand = '433M' | '868M' | 'dual';
export type PBusDeviceType = 'C16' | 'X4' | 'PyroMote' | 'unknown';

export interface PBusCueState {
  index: number;
  connected: boolean;
  fired: boolean;
  resistance: number; // Ω — 0 = open, <5 = short, 5-50 = good
}

export interface PBusDevice {
  address: number;
  type: PBusDeviceType;
  channels: number; // 16 for C16, 4 for X4
  firmwareVersion: string;
  batteryV: number;
  rssi433: number; // dBm
  rssi868: number; // dBm
  activeBand: PBusWirelessBand;
  cueStates: PBusCueState[];
  armed: boolean;
  lastSeen: number;
  serialNumber?: string;
}

export interface PBusEvent {
  type: 'device-discovered' | 'status-update' | 'cue-update' | 'fire-confirm' | 'arm-confirm' | 'estop' | 'wireless-update' | 'error';
  deviceAddress: number;
  timestamp: number;
  data?: any;
}

export type PBusEventListener = (event: PBusEvent) => void;

// ═══════════════════════════════════════════════════════════
// CRC16-CCITT
// ═══════════════════════════════════════════════════════════

export function calculateCRC16(data: Uint8Array): number {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xFFFF;
    }
  }
  return crc;
}

// ═══════════════════════════════════════════════════════════
// FRAME BUILDERS
// ═══════════════════════════════════════════════════════════

export function buildPBusFrame(addr: number, cmd: PBusCmd, payload: number[] = []): Uint8Array {
  const len = payload.length;
  const inner = new Uint8Array([addr, cmd, len, ...payload]);
  const crc = calculateCRC16(inner);
  const frame = new Uint8Array(inner.length + 3); // preamble + inner + crc(2) + term
  frame[0] = PREAMBLE;
  frame.set(inner, 1);
  frame[1 + inner.length] = (crc >> 8) & 0xFF;
  frame[2 + inner.length] = crc & 0xFF;
  // Oops, need +1 more for term
  const full = new Uint8Array(frame.length + 1);
  full.set(frame);
  full[full.length - 1] = TERMINATOR;
  return full;
}

export function buildDiscoverFrame(addr: number): Uint8Array {
  return buildPBusFrame(addr, PBusCmd.DISCOVER);
}

export function buildArmFrame(addr: number): Uint8Array {
  return buildPBusFrame(addr, PBusCmd.ARM);
}

export function buildDisarmFrame(addr: number): Uint8Array {
  return buildPBusFrame(addr, PBusCmd.DISARM);
}

export function buildFireFrame(addr: number, cueIndex: number, durationMs = 500): Uint8Array {
  const durHi = (durationMs >> 8) & 0xFF;
  const durLo = durationMs & 0xFF;
  return buildPBusFrame(addr, PBusCmd.FIRE, [cueIndex, durHi, durLo]);
}

export function buildFireSequenceFrame(addr: number, cueIndices: number[], intervalMs = 10): Uint8Array {
  const intHi = (intervalMs >> 8) & 0xFF;
  const intLo = intervalMs & 0xFF;
  return buildPBusFrame(addr, PBusCmd.FIRE_SEQ, [intHi, intLo, ...cueIndices]);
}

export function buildStatusQuery(addr: number): Uint8Array {
  return buildPBusFrame(addr, PBusCmd.STATUS);
}

export function buildCueStatusQuery(addr: number): Uint8Array {
  return buildPBusFrame(addr, PBusCmd.CUE_STATUS);
}

export function buildBatteryQuery(addr: number): Uint8Array {
  return buildPBusFrame(addr, PBusCmd.BATTERY);
}

export function buildWirelessQuery(addr: number): Uint8Array {
  return buildPBusFrame(addr, PBusCmd.WIRELESS);
}

export function buildSetBandFrame(addr: number, band: PBusWirelessBand): Uint8Array {
  const bandByte = band === '433M' ? 0x01 : band === '868M' ? 0x02 : 0x03;
  return buildPBusFrame(addr, PBusCmd.SET_BAND, [bandByte]);
}

export function buildEStopFrame(): Uint8Array {
  return buildPBusFrame(BROADCAST_ADDR, PBusCmd.ESTOP);
}

// ═══════════════════════════════════════════════════════════
// RESPONSE PARSER
// ═══════════════════════════════════════════════════════════

export interface PBusParsedFrame {
  addr: number;
  cmd: PBusCmd;
  payload: Uint8Array;
  valid: boolean;
}

export function parsePBusResponse(data: Uint8Array): PBusParsedFrame | null {
  if (data.length < 6) return null; // min: preamble + addr + cmd + len + crc(2) + term
  if (data[0] !== PREAMBLE || data[data.length - 1] !== TERMINATOR) return null;

  const addr = data[1];
  const cmd = data[2] as PBusCmd;
  const len = data[3];

  if (data.length < 6 + len) return null;

  const payload = data.slice(4, 4 + len);
  const innerData = data.slice(1, 4 + len);
  const expectedCrc = calculateCRC16(innerData);
  const receivedCrc = (data[4 + len] << 8) | data[5 + len];

  return { addr, cmd, payload, valid: expectedCrc === receivedCrc };
}

export function parseDeviceStatus(payload: Uint8Array): Partial<PBusDevice> {
  if (payload.length < 8) return {};
  const type: PBusDeviceType = payload[0] === 0x10 ? 'C16' : payload[0] === 0x04 ? 'X4' : payload[0] === 0x01 ? 'PyroMote' : 'unknown';
  const channels = payload[1];
  const batteryV = (payload[2] << 8 | payload[3]) / 100;
  const armed = payload[4] === 0x01;
  const fwMajor = payload[5];
  const fwMinor = payload[6];
  const fwPatch = payload[7];
  return {
    type,
    channels,
    batteryV,
    armed,
    firmwareVersion: `${fwMajor}.${fwMinor}.${fwPatch}`,
  };
}

export function parseCueStates(payload: Uint8Array, numCues: number): PBusCueState[] {
  const states: PBusCueState[] = [];
  for (let i = 0; i < numCues && i * 3 < payload.length; i++) {
    const flags = payload[i * 3];
    const resHi = payload[i * 3 + 1];
    const resLo = payload[i * 3 + 2];
    states.push({
      index: i,
      connected: (flags & 0x01) !== 0,
      fired: (flags & 0x02) !== 0,
      resistance: (resHi << 8 | resLo) / 10,
    });
  }
  return states;
}

export function parseWirelessStatus(payload: Uint8Array): { rssi433: number; rssi868: number; activeBand: PBusWirelessBand } {
  if (payload.length < 5) return { rssi433: -100, rssi868: -100, activeBand: 'dual' };
  const rssi433 = -(payload[0]);
  const rssi868 = -(payload[1]);
  const bandByte = payload[2];
  const activeBand: PBusWirelessBand = bandByte === 0x01 ? '433M' : bandByte === 0x02 ? '868M' : 'dual';
  return { rssi433, rssi868, activeBand };
}

// ═══════════════════════════════════════════════════════════
// PBUS CONTROLLER — Singleton
// ═══════════════════════════════════════════════════════════

export class PBusController {
  private port: any = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private listeners: PBusEventListener[] = [];
  private buffer = new Uint8Array(0);
  private readLoop = false;

  discoveredDevices: Map<number, PBusDevice> = new Map();

  on(listener: PBusEventListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit(event: PBusEvent) {
    this.listeners.forEach(l => l(event));
  }

  get isConnected(): boolean {
    return this.port !== null && this.readLoop;
  }

  async connect(): Promise<void> {
    if (!('serial' in navigator)) throw new Error('Web Serial API not supported');
    const nav = navigator as any;
    this.port = await nav.serial.requestPort();
    await this.port.open({ baudRate: PBUS_BAUD_RATE, dataBits: PBUS_DATA_BITS, stopBits: PBUS_STOP_BITS, parity: PBUS_PARITY });
    this.reader = this.port.readable.getReader();
    this.writer = this.port.writable.getWriter();
    this.readLoop = true;
    this.startReading();
  }

  async disconnect(): Promise<void> {
    this.readLoop = false;
    try {
      if (this.reader) { await this.reader.cancel().catch(() => {}); this.reader.releaseLock(); }
      if (this.writer) { await this.writer.close().catch(() => {}); this.writer.releaseLock(); }
      if (this.port) await this.port.close().catch(() => {});
    } catch { /* ignore */ }
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.discoveredDevices.clear();
  }

  async send(frame: Uint8Array): Promise<void> {
    if (!this.writer) throw new Error('PBUS not connected');
    await this.writer.write(frame);
  }

  async discoverDevices(maxAddr = MAX_SCAN_ADDR): Promise<void> {
    for (let addr = 1; addr <= maxAddr; addr++) {
      await this.send(buildDiscoverFrame(addr));
      await new Promise(r => setTimeout(r, 40));
    }
  }

  async armDevice(addr: number): Promise<void> { await this.send(buildArmFrame(addr)); }
  async disarmDevice(addr: number): Promise<void> { await this.send(buildDisarmFrame(addr)); }
  async armAll(): Promise<void> { await this.send(buildPBusFrame(BROADCAST_ADDR, PBusCmd.ARM)); }
  async disarmAll(): Promise<void> { await this.send(buildPBusFrame(BROADCAST_ADDR, PBusCmd.DISARM)); }
  async fireCue(addr: number, cue: number, durationMs = 500): Promise<void> { await this.send(buildFireFrame(addr, cue, durationMs)); }
  async emergencyStop(): Promise<void> { await this.send(buildEStopFrame()); }
  async requestCueStatus(addr: number): Promise<void> { await this.send(buildCueStatusQuery(addr)); }
  async requestStatus(addr: number): Promise<void> { await this.send(buildStatusQuery(addr)); }
  async requestWireless(addr: number): Promise<void> { await this.send(buildWirelessQuery(addr)); }
  async setBand(addr: number, band: PBusWirelessBand): Promise<void> { await this.send(buildSetBandFrame(addr, band)); }

  private async startReading(): Promise<void> {
    while (this.readLoop && this.reader) {
      try {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) this.processIncoming(value);
      } catch { break; }
    }
  }

  private processIncoming(chunk: Uint8Array): void {
    const combined = new Uint8Array(this.buffer.length + chunk.length);
    combined.set(this.buffer);
    combined.set(chunk, this.buffer.length);
    this.buffer = combined;

    // Find complete frames
    while (this.buffer.length >= 6) {
      const start = this.buffer.indexOf(PREAMBLE);
      if (start === -1) { this.buffer = new Uint8Array(0); break; }
      if (start > 0) this.buffer = this.buffer.slice(start);

      const termIdx = Array.from(this.buffer).indexOf(TERMINATOR, 5);
      if (termIdx === -1) break;

      const frame = this.buffer.slice(0, termIdx + 1);
      this.buffer = this.buffer.slice(termIdx + 1);
      this.handleFrame(frame);
    }
  }

  private handleFrame(raw: Uint8Array): void {
    const parsed = parsePBusResponse(raw);
    if (!parsed || !parsed.valid) return;

    const now = Date.now();

    switch (parsed.cmd) {
      case PBusCmd.DISCOVER:
      case PBusCmd.STATUS: {
        const partial = parseDeviceStatus(parsed.payload);
        const existing = this.discoveredDevices.get(parsed.addr);
        const device: PBusDevice = {
          address: parsed.addr,
          type: partial.type || existing?.type || 'unknown',
          channels: partial.channels || existing?.channels || 0,
          firmwareVersion: partial.firmwareVersion || existing?.firmwareVersion || '0.0.0',
          batteryV: partial.batteryV ?? existing?.batteryV ?? 0,
          rssi433: existing?.rssi433 ?? -100,
          rssi868: existing?.rssi868 ?? -100,
          activeBand: existing?.activeBand ?? 'dual',
          cueStates: existing?.cueStates ?? [],
          armed: partial.armed ?? existing?.armed ?? false,
          lastSeen: now,
        };
        this.discoveredDevices.set(parsed.addr, device);
        this.emit({ type: parsed.cmd === PBusCmd.DISCOVER ? 'device-discovered' : 'status-update', deviceAddress: parsed.addr, timestamp: now, data: device });
        break;
      }

      case PBusCmd.CUE_STATUS: {
        const existing = this.discoveredDevices.get(parsed.addr);
        if (existing) {
          existing.cueStates = parseCueStates(parsed.payload, existing.channels);
          existing.lastSeen = now;
          this.emit({ type: 'cue-update', deviceAddress: parsed.addr, timestamp: now, data: existing.cueStates });
        }
        break;
      }

      case PBusCmd.WIRELESS: {
        const ws = parseWirelessStatus(parsed.payload);
        const existing = this.discoveredDevices.get(parsed.addr);
        if (existing) {
          existing.rssi433 = ws.rssi433;
          existing.rssi868 = ws.rssi868;
          existing.activeBand = ws.activeBand;
          existing.lastSeen = now;
          this.emit({ type: 'wireless-update', deviceAddress: parsed.addr, timestamp: now, data: ws });
        }
        break;
      }

      case PBusCmd.ARM:
      case PBusCmd.DISARM: {
        const existing = this.discoveredDevices.get(parsed.addr);
        if (existing) { existing.armed = parsed.cmd === PBusCmd.ARM; existing.lastSeen = now; }
        this.emit({ type: 'arm-confirm', deviceAddress: parsed.addr, timestamp: now });
        break;
      }

      case PBusCmd.FIRE: {
        this.emit({ type: 'fire-confirm', deviceAddress: parsed.addr, timestamp: now, data: parsed.payload });
        break;
      }

      case PBusCmd.ESTOP: {
        this.discoveredDevices.forEach(d => { d.armed = false; });
        this.emit({ type: 'estop', deviceAddress: 0, timestamp: now });
        break;
      }
    }
  }
}

// Singleton
let pbusInstance: PBusController | null = null;
export function getPBusController(): PBusController {
  if (!pbusInstance) pbusInstance = new PBusController();
  return pbusInstance;
}
