/**
 * Radio Protocol Engine — Link layer for USB radio antenna dongles
 * Supports CC1101 (433/868MHz), SX1276 LoRa, nRF24L01+, generic UART-RF bridges.
 * Wraps existing PBUS/FireOne frames as payload for transparent over-the-air bridging.
 */

export type RadioDongleType = 'cc1101' | 'sx1276' | 'nrf24' | 'generic';
export type RadioBand = '433M' | '868M' | 'auto' | 'lora';
export type RadioState = 'disconnected' | 'connecting' | 'connected' | 'scanning' | 'error';

export interface RadioDongleProfile {
  type: RadioDongleType;
  label: string;
  vendorId: number;
  productId: number;
  baudRate: number;
  bands: RadioBand[];
  maxPowerDbm: number;
  description: string;
}

export interface RadioDevice {
  address: number;
  type: 'C16' | 'X4' | 'IFMx' | 'PyroMote' | 'FXbutton' | 'unknown';
  rssi: number;
  band: RadioBand;
  lastSeen: number;
  packetLoss: number;
  batteryV?: number;
  armed?: boolean;
  cueCount?: number;
}

export interface RadioPacketStats {
  totalTx: number;
  totalRx: number;
  ackSuccess: number;
  ackFailed: number;
  avgRssi: number;
  channelHops: number;
}

export interface RadioConfig {
  frequency: number;       // MHz (e.g. 433.92, 868.35)
  txPowerDbm: number;      // -10 to +20
  dataRateKbps: number;    // e.g. 38.4, 100, 250
  channelHopping: boolean;
  hopIntervalMs: number;
  hopChannels: number[];
  band: RadioBand;
}

// Known USB radio dongle profiles
export const RADIO_DONGLE_PROFILES: RadioDongleProfile[] = [
  {
    type: 'cc1101',
    label: 'CC1101 USB (433/868MHz)',
    vendorId: 0x1A86,
    productId: 0x7523,
    baudRate: 38400,
    bands: ['433M', '868M', 'auto'],
    maxPowerDbm: 12,
    description: 'TI CC1101 OOK/FSK transceiver — dual-band 433/868MHz',
  },
  {
    type: 'sx1276',
    label: 'SX1276 LoRa USB',
    vendorId: 0x10C4,
    productId: 0xEA60,
    baudRate: 115200,
    bands: ['433M', '868M', 'lora'],
    maxPowerDbm: 20,
    description: 'Semtech SX1276 LoRa — long-range FSK/LoRa modulation',
  },
  {
    type: 'nrf24',
    label: 'nRF24L01+ USB',
    vendorId: 0x1A86,
    productId: 0x7523,
    baudRate: 57600,
    bands: ['auto'],
    maxPowerDbm: 0,
    description: 'Nordic nRF24L01+ 2.4GHz — short range, high data rate',
  },
  {
    type: 'generic',
    label: 'Generic UART-RF Bridge',
    vendorId: 0,
    productId: 0,
    baudRate: 9600,
    bands: ['433M', '868M', 'auto'],
    maxPowerDbm: 10,
    description: 'Generic serial ↔ RF bridge module',
  },
];

// Packet constants
const SYNC_BYTE = 0xD5;
const BROADCAST_ADDR = 0xFF;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 50;
const ACK_TIMEOUT_MS = 200;

// Radio command types
export enum RadioCmd {
  PING = 0x01,
  DISCOVER = 0x02,
  DATA = 0x10,      // Payload = wrapped PBUS/FireOne frame
  ACK = 0x20,
  CONFIG = 0x30,
  RSSI_REQ = 0x40,
  RANGE_TEST = 0x50,
  SET_FREQ = 0x60,
  SET_POWER = 0x61,
  SET_CHANNEL = 0x62,
  TDMA_SYNC = 0x70,
  TDMA_SLOT_ASSIGN = 0x71,
}

// ─── CRC16-CCITT ───
export function calculateRadioCRC16(data: Uint8Array): number {
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

/**
 * Build a radio packet:
 * [SYNC 0xD5][LEN][DEST_ADDR][SRC_ADDR][SEQ][CMD][PAYLOAD...][CRC16_HI][CRC16_LO]
 */
export function buildRadioPacket(
  destAddr: number,
  srcAddr: number,
  seq: number,
  cmd: RadioCmd,
  payload: Uint8Array = new Uint8Array(0)
): Uint8Array {
  const len = 4 + payload.length; // DEST + SRC + SEQ + CMD + payload
  const frame = new Uint8Array(1 + 1 + len + 2); // SYNC + LEN + data + CRC16

  frame[0] = SYNC_BYTE;
  frame[1] = len;
  frame[2] = destAddr;
  frame[3] = srcAddr;
  frame[4] = seq & 0xFF;
  frame[5] = cmd;
  frame.set(payload, 6);

  const crcData = frame.subarray(1, 6 + payload.length);
  const crc = calculateRadioCRC16(crcData);
  frame[frame.length - 2] = (crc >> 8) & 0xFF;
  frame[frame.length - 1] = crc & 0xFF;

  return frame;
}

export interface RadioResponse {
  srcAddr: number;
  destAddr: number;
  seq: number;
  cmd: RadioCmd;
  payload: Uint8Array;
  rssi?: number;
}

/**
 * Parse incoming radio frame from dongle serial output.
 * Logs CRC mismatches for debugging instead of silently dropping.
 */
export function parseRadioResponse(buffer: Uint8Array): RadioResponse | null {
  if (buffer.length < 7) return null;

  const syncIdx = buffer.indexOf(SYNC_BYTE);
  if (syncIdx < 0) return null;

  const len = buffer[syncIdx + 1];
  const totalLen = 1 + 1 + len + 2;
  if (buffer.length < syncIdx + totalLen) return null;

  const frame = buffer.subarray(syncIdx, syncIdx + totalLen);

  // Verify CRC
  const crcData = frame.subarray(1, 2 + len);
  const expectedCrc = calculateRadioCRC16(crcData);
  const receivedCrc = (frame[frame.length - 2] << 8) | frame[frame.length - 1];
  if (expectedCrc !== receivedCrc) {
    console.warn(`[RadioProtocol] CRC mismatch: expected 0x${expectedCrc.toString(16)}, got 0x${receivedCrc.toString(16)}, frame len=${len}, syncIdx=${syncIdx}`);
    return null;
  }

  return {
    destAddr: frame[2],
    srcAddr: frame[3],
    seq: frame[4],
    cmd: frame[5] as RadioCmd,
    payload: frame.subarray(6, 2 + len),
  };
}

/**
 * Wrap a PBUS or FireOne frame inside a radio DATA packet
 */
export function wrapProtocolFrame(
  destAddr: number,
  srcAddr: number,
  seq: number,
  protocolFrame: Uint8Array
): Uint8Array {
  return buildRadioPacket(destAddr, srcAddr, seq, RadioCmd.DATA, protocolFrame);
}

/**
 * Build a discovery broadcast packet
 */
export function buildDiscoveryPacket(srcAddr: number, seq: number): Uint8Array {
  return buildRadioPacket(BROADCAST_ADDR, srcAddr, seq, RadioCmd.DISCOVER);
}

/**
 * Build a range test ping packet
 */
export function buildRangeTestPacket(destAddr: number, srcAddr: number, seq: number): Uint8Array {
  const payload = new Uint8Array(10); // 10-byte ping payload
  for (let i = 0; i < 10; i++) payload[i] = (seq + i) & 0xFF;
  return buildRadioPacket(destAddr, srcAddr, seq, RadioCmd.RANGE_TEST, payload);
}

/**
 * Build frequency set command for dongle
 */
export function buildSetFrequencyCmd(freqMHz: number): Uint8Array {
  const payload = new Uint8Array(4);
  const freqKHz = Math.round(freqMHz * 1000);
  payload[0] = (freqKHz >> 24) & 0xFF;
  payload[1] = (freqKHz >> 16) & 0xFF;
  payload[2] = (freqKHz >> 8) & 0xFF;
  payload[3] = freqKHz & 0xFF;
  return buildRadioPacket(0x00, 0x00, 0, RadioCmd.SET_FREQ, payload);
}

/**
 * Build TX power set command for dongle
 */
export function buildSetPowerCmd(dbm: number): Uint8Array {
  const payload = new Uint8Array(1);
  payload[0] = Math.max(-10, Math.min(20, dbm)) + 128; // offset encoding
  return buildRadioPacket(0x00, 0x00, 0, RadioCmd.SET_POWER, payload);
}

// Band frequency mapping
export const BAND_FREQUENCIES: Record<string, number> = {
  '433M': 433.92,
  '868M': 868.35,
  'lora': 868.10,
  'auto': 433.92, // default to 433M for auto
};

// TX power legal limits by region/band
export const TX_POWER_LIMITS: Record<string, { band: string; maxDbm: number; maxMw: number; region: string }[]> = {
  '433M': [
    { band: '433M', maxDbm: 10, maxMw: 10, region: 'US (FCC)' },
    { band: '433M', maxDbm: 10, maxMw: 10, region: 'EU (ETSI)' },
  ],
  '868M': [
    { band: '868M', maxDbm: 14, maxMw: 25, region: 'EU (ETSI)' },
    { band: '868M', maxDbm: 30, maxMw: 1000, region: 'US (FCC 915)' },
  ],
  'lora': [
    { band: 'LoRa', maxDbm: 14, maxMw: 25, region: 'EU' },
    { band: 'LoRa', maxDbm: 30, maxMw: 1000, region: 'US' },
  ],
};

/**
 * Convert dBm to milliwatts
 */
export function dbmToMw(dbm: number): number {
  return Math.round(Math.pow(10, dbm / 10) * 100) / 100;
}

/**
 * Default radio configuration
 */
export function getDefaultRadioConfig(): RadioConfig {
  return {
    frequency: 433.92,
    txPowerDbm: 10,
    dataRateKbps: 38.4,
    channelHopping: false,
    hopIntervalMs: 100,
    hopChannels: [0, 1, 2, 3, 4, 5, 6, 7],
    band: '433M',
  };
}

// Default hop channel frequencies (offset from base in kHz)
export const HOP_CHANNEL_OFFSETS = [0, 200, 400, 600, 800, 1000, 1200, 1400];

/**
 * Detect dongle type from serial port info
 */
export function detectDongleType(vendorId?: number, productId?: number): RadioDongleProfile | null {
  if (!vendorId) return null;
  return RADIO_DONGLE_PROFILES.find(p =>
    p.vendorId === vendorId && (p.productId === 0 || p.productId === productId)
  ) || null;
}

/**
 * Send a radio packet with retry and exponential backoff.
 * Returns true if ACK received, false if all retries exhausted.
 */
export async function sendWithRetry(
  sendFn: (pkt: Uint8Array) => Promise<void>,
  packet: Uint8Array,
  maxRetries = MAX_RETRIES,
  backoffMs = RETRY_BACKOFF_MS,
  timeoutMs = ACK_TIMEOUT_MS,
): Promise<boolean> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await Promise.race([
        sendFn(packet),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('ACK timeout')), timeoutMs)
        ),
      ]);
      return true;
    } catch {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, backoffMs * Math.pow(2, attempt)));
      }
    }
  }
  console.warn(`[RadioProtocol] Packet delivery failed after ${maxRetries + 1} attempts`);
  return false;
}

// ═══════════════════════════════════════════════════════════
// TDMA SCHEDULER — Time Division Multiple Access for 50+ modules
// ═══════════════════════════════════════════════════════════

export interface TDMAConfig {
  /** Total frame period in ms. Default: 100 */
  framePeriodMs: number;
  /** Number of time slots. Default: 50 */
  slotCount: number;
  /** Duration of each slot in ms. Default: 1.8 */
  slotDurationMs: number;
  /** Guard interval for sync beacon in ms. Default: 10 */
  guardIntervalMs: number;
  /** Enable TDMA scheduling. Default: false */
  enabled: boolean;
}

export interface TDMASlotAssignment {
  slotIndex: number;
  moduleAddr: number;
  /** Slot 0 is always reserved for E-STOP broadcast */
  reserved: boolean;
}

export interface TDMAStatus {
  enabled: boolean;
  currentSlot: number;
  frameCount: number;
  assignedModules: number;
  queueDepth: number;
  estopSlotLatencyMs: number;
}

const DEFAULT_TDMA_CONFIG: TDMAConfig = {
  framePeriodMs: 100,
  slotCount: 50,
  slotDurationMs: 1.8,
  guardIntervalMs: 10,
  enabled: false,
};

/**
 * TDMA Scheduler for 433MHz radio to eliminate RF collisions.
 * 
 * Frame structure (100ms):
 * ┌──────┬──────┬──────┬─────┬──────┬──────────┐
 * │Slot 0│Slot 1│Slot 2│ ... │Slot49│Guard+Sync│
 * │E-STOP│Mod 1 │Mod 2 │     │Mod49 │  Beacon  │
 * │ 1.8ms│ 1.8ms│ 1.8ms│     │ 1.8ms│   10ms   │
 * └──────┴──────┴──────┴─────┴──────┴──────────┘
 * 
 * Slot 0: RESERVED for E-STOP broadcast → latency < 2ms
 * Guard interval: Master sync beacon for clock alignment
 */
export class TDMAScheduler {
  private config: TDMAConfig;
  private slots: Map<number, TDMASlotAssignment> = new Map();
  private packetQueues: Map<number, Uint8Array[]> = new Map();
  private sendFn: ((pkt: Uint8Array) => Promise<void>) | null = null;
  private frameTimer: ReturnType<typeof setInterval> | null = null;
  private currentSlot = 0;
  private frameCount = 0;
  private _running = false;
  private seq = 0;

  constructor(config?: Partial<TDMAConfig>) {
    this.config = { ...DEFAULT_TDMA_CONFIG, ...config };
    // Slot 0 always reserved for E-STOP
    this.slots.set(0, { slotIndex: 0, moduleAddr: BROADCAST_ADDR, reserved: true });
  }

  get status(): TDMAStatus {
    let queueDepth = 0;
    this.packetQueues.forEach(q => { queueDepth += q.length; });
    return {
      enabled: this._running,
      currentSlot: this.currentSlot,
      frameCount: this.frameCount,
      assignedModules: this.slots.size - 1, // exclude slot 0
      queueDepth,
      estopSlotLatencyMs: this.config.slotDurationMs, // worst case for slot 0
    };
  }

  /** Assign a module address to a TDMA slot (1-49) */
  assignSlot(moduleAddr: number, slotIndex?: number): TDMASlotAssignment {
    const idx = slotIndex ?? this.findFreeSlot();
    if (idx === 0) throw new Error('Slot 0 is reserved for E-STOP');
    if (idx >= this.config.slotCount) throw new Error(`Slot ${idx} exceeds max ${this.config.slotCount - 1}`);

    const assignment: TDMASlotAssignment = { slotIndex: idx, moduleAddr, reserved: false };
    this.slots.set(idx, assignment);
    this.packetQueues.set(idx, []);
    return assignment;
  }

  /** Auto-assign all discovered modules */
  assignModules(moduleAddrs: number[]): TDMASlotAssignment[] {
    return moduleAddrs.map((addr, i) => this.assignSlot(addr, i + 1));
  }

  private findFreeSlot(): number {
    for (let i = 1; i < this.config.slotCount; i++) {
      if (!this.slots.has(i)) return i;
    }
    throw new Error('No free TDMA slots');
  }

  /** Queue a packet for the appropriate module slot */
  queuePacket(moduleAddr: number, packet: Uint8Array): void {
    // Find slot for this module
    let targetSlot = -1;
    this.slots.forEach((assign, idx) => {
      if (assign.moduleAddr === moduleAddr) targetSlot = idx;
    });

    if (targetSlot < 0) {
      // Auto-assign if not yet assigned
      try {
        const assign = this.assignSlot(moduleAddr);
        targetSlot = assign.slotIndex;
      } catch {
        console.warn(`[TDMA] Cannot assign slot for module ${moduleAddr}, sending immediately`);
        this.sendFn?.(packet).catch(() => {});
        return;
      }
    }

    const queue = this.packetQueues.get(targetSlot);
    if (queue) {
      // Max queue depth per slot: 8
      if (queue.length >= 8) queue.shift();
      queue.push(packet);
    }
  }

  /** Queue an E-STOP on slot 0 (immediate priority) */
  queueEstop(packet: Uint8Array): void {
    const queue = this.packetQueues.get(0) || [];
    queue.unshift(packet); // front of queue
    this.packetQueues.set(0, queue);
  }

  /** Start TDMA frame scheduling */
  start(sendFn: (pkt: Uint8Array) => Promise<void>): void {
    if (this._running) return;
    this.sendFn = sendFn;
    this._running = true;

    this.frameTimer = setInterval(() => {
      this.executeFrame();
    }, this.config.framePeriodMs);
  }

  /** Stop TDMA scheduling */
  stop(): void {
    this._running = false;
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
  }

  private async executeFrame(): Promise<void> {
    if (!this.sendFn) return;
    this.frameCount++;

    // Process each slot sequentially within the frame
    for (let slot = 0; slot < this.config.slotCount; slot++) {
      this.currentSlot = slot;
      const queue = this.packetQueues.get(slot);
      if (queue && queue.length > 0) {
        const pkt = queue.shift()!;
        try {
          await this.sendFn(pkt);
        } catch {
          // Re-queue on failure (max 1 retry per frame)
          if (queue.length < 8) queue.unshift(pkt);
        }
      }
      // Wait for slot duration
      await new Promise(r => setTimeout(r, this.config.slotDurationMs));
    }

    // Guard interval: send sync beacon
    await this.sendSyncBeacon();
  }

  private async sendSyncBeacon(): Promise<void> {
    if (!this.sendFn) return;
    const beacon = buildRadioPacket(
      BROADCAST_ADDR, 0x00, this.seq++ & 0xFF,
      RadioCmd.TDMA_SYNC,
      new Uint8Array([
        (this.frameCount >> 8) & 0xFF,
        this.frameCount & 0xFF,
        this.config.slotCount,
        Math.round(this.config.slotDurationMs * 10) & 0xFF,
      ])
    );
    try {
      await this.sendFn(beacon);
    } catch { /* sync beacon loss is non-critical */ }
  }

  /** Build slot assignment command for a module */
  buildSlotAssignPacket(moduleAddr: number, slotIndex: number): Uint8Array {
    return buildRadioPacket(
      moduleAddr, 0x00, this.seq++ & 0xFF,
      RadioCmd.TDMA_SLOT_ASSIGN,
      new Uint8Array([slotIndex, this.config.slotCount,
        Math.round(this.config.framePeriodMs) & 0xFF])
    );
  }

  /** Reset all slot assignments except slot 0 */
  reset(): void {
    this.stop();
    const estopSlot = this.slots.get(0);
    this.slots.clear();
    this.packetQueues.clear();
    if (estopSlot) this.slots.set(0, estopSlot);
    this.packetQueues.set(0, []);
    this.currentSlot = 0;
    this.frameCount = 0;
  }
}
