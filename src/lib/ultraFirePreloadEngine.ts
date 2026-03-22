/**
 * UltraFire Pre-load Engine
 * 
 * Distributes cue lists to field modules BEFORE the show starts.
 * During the show, the controller only sends lightweight sync triggers
 * (GO / SYNC / PAUSE / E-STOP) — modules execute their local scripts
 * autonomously, eliminating dependency on continuous network link.
 *
 * Architecture:
 *   PRE-SHOW:
 *     1. Partition timeline cues by module address
 *     2. Serialize each module's cue list into chunks (≤ MTU)
 *     3. Upload chunks via Starlink/Wi-Fi (bulk bandwidth)
 *     4. Verify integrity (SHA-256 hash per module)
 *     5. Report readiness matrix
 *
 *   DURING SHOW:
 *     Controller sends only:
 *       - GO(timecodeMs)     → modules start local playback at offset
 *       - SYNC(timecodeMs)   → modules correct drift (±Δ)
 *       - PAUSE              → modules freeze
 *       - E-STOP             → modules halt (multi-path broadcast)
 *
 *   Sync triggers are ~12 bytes vs ~200+ bytes for full fire commands.
 *   Even at 1.2% packet loss (Radio 433MHz), modules stay synced
 *   because they run their own timecode clock and self-correct on
 *   the next SYNC pulse (sent every 500ms).
 */

import type { ScriptEvent } from '@/lib/fireoneModuleEmulator';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface PreloadCue {
  /** Cue sequential ID within this module */
  localId: number;
  /** Absolute time offset from show start (ms) */
  timeMs: number;
  /** Igniter pins to fire */
  pins: number[];
  /** Fire duration in ms (20–1000, clamped) */
  duration: number;
  /** Human-readable label */
  label?: string;
  /** Priority group (1–16) for selective disable */
  priority?: number;
}

export interface ModuleCuePackage {
  /** Module field address (1–50) */
  moduleAddr: number;
  /** Show identifier for integrity check */
  showId: string;
  /** Ordered cue list for this module */
  cues: PreloadCue[];
  /** SHA-256 hash of serialized cue data */
  checksum: string;
  /** Total chunks for upload */
  totalChunks: number;
  /** Chunk size in bytes */
  chunkSize: number;
  /** Serialized binary payload */
  payload: Uint8Array;
}

export interface ChunkPacket {
  moduleAddr: number;
  showId: string;
  chunkIndex: number;
  totalChunks: number;
  data: Uint8Array;
  /** CRC-16 of this chunk */
  crc16: number;
}

export type ModuleReadyState = 'pending' | 'uploading' | 'verifying' | 'ready' | 'failed' | 'mismatch';

export interface ModulePreloadStatus {
  moduleAddr: number;
  state: ModuleReadyState;
  cueCount: number;
  chunksUploaded: number;
  totalChunks: number;
  verified: boolean;
  checksum: string;
  uploadStartedAt?: number;
  uploadCompletedAt?: number;
  errorMessage?: string;
  /** Round-trip verification latency (ms) */
  verifyLatencyMs?: number;
}

export interface PreloadSession {
  showId: string;
  totalModules: number;
  totalCues: number;
  modules: Map<number, ModulePreloadStatus>;
  startedAt: number;
  completedAt?: number;
  allReady: boolean;
}

/** Sync trigger — tiny packet sent during show (~12 bytes) */
export interface SyncTrigger {
  type: 'go' | 'sync' | 'pause' | 'resume' | 'estop' | 'reset';
  /** Current show timecode in ms */
  timecodeMs: number;
  /** Sequence number for ordering */
  seq: number;
  /** Timestamp of trigger creation */
  ts: number;
}

export type PreloadEventType =
  | 'upload-start'
  | 'chunk-sent'
  | 'chunk-ack'
  | 'chunk-nack'
  | 'upload-complete'
  | 'verify-ok'
  | 'verify-fail'
  | 'all-ready'
  | 'sync-sent';

export interface PreloadEvent {
  type: PreloadEventType;
  moduleAddr: number;
  data?: Record<string, unknown>;
  ts: number;
}

export type PreloadListener = (event: PreloadEvent) => void;

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

/** Maximum chunk payload (fits in Radio 433MHz MTU of 61 bytes with headers) */
const CHUNK_MTU_RADIO = 48;
/** Larger chunk for Wi-Fi/Starlink upload */
const CHUNK_MTU_WIFI = 1024;
/** Default sync interval during show (ms) */
const SYNC_INTERVAL_MS = 500;
/** Max drift tolerance before forced re-sync (ms) */
const MAX_DRIFT_MS = 5;
/** Retry limit per chunk */
const CHUNK_RETRY_LIMIT = 5;
/** Timeout for chunk ACK (ms) */
const CHUNK_ACK_TIMEOUT_MS = 2000;

// Sync trigger command bytes
const SYNC_CMD_GO     = 0x70;
const SYNC_CMD_SYNC   = 0x71;
const SYNC_CMD_PAUSE  = 0x72;
const SYNC_CMD_RESUME = 0x73;
const SYNC_CMD_ESTOP  = 0x74;
const SYNC_CMD_RESET  = 0x75;

// ═══════════════════════════════════════════════════════════
// CUE SERIALIZATION
// ═══════════════════════════════════════════════════════════

/**
 * Serialize a single cue into binary format:
 * [LOCAL_ID:2][TIME_MS:4][DURATION:2][PIN_COUNT:1][PINS:N][PRIORITY:1]
 */
function serializeCue(cue: PreloadCue): Uint8Array {
  const pinCount = cue.pins.length;
  const buf = new Uint8Array(2 + 4 + 2 + 1 + pinCount + 1);
  const view = new DataView(buf.buffer);

  view.setUint16(0, cue.localId);
  view.setUint32(2, cue.timeMs);
  view.setUint16(6, Math.max(20, Math.min(1000, cue.duration)));
  buf[8] = pinCount;
  for (let i = 0; i < pinCount; i++) {
    buf[9 + i] = cue.pins[i] & 0xFF;
  }
  buf[9 + pinCount] = (cue.priority ?? 1) & 0x0F;

  return buf;
}

/**
 * Serialize all cues for a module into a single binary payload
 */
function serializeCueList(cues: PreloadCue[]): Uint8Array {
  const parts = cues.map(serializeCue);
  const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
  const payload = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    payload.set(part, offset);
    offset += part.length;
  }
  return payload;
}

/**
 * CRC-16 CCITT for chunk integrity
 */
function crc16(data: Uint8Array): number {
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
 * SHA-256 hash of payload for verification (Web Crypto API)
 */
async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ═══════════════════════════════════════════════════════════
// CUE LIST PARTITIONER
// ═══════════════════════════════════════════════════════════

export interface TimelineCue {
  id: string;
  startTime: number;      // seconds
  moduleAddr: number;
  channel: number;         // igniter pin
  duration?: number;       // ms, default 500
  label?: string;
  priority?: number;
}

/**
 * Partition a full timeline into per-module cue packages.
 * Converts timeline seconds → milliseconds, assigns local IDs,
 * sorts by time, and serializes + hashes.
 */
export async function partitionCueList(
  timelineCues: TimelineCue[],
  showId: string,
  chunkMtu: number = CHUNK_MTU_WIFI
): Promise<Map<number, ModuleCuePackage>> {
  // Group by module address
  const byModule = new Map<number, TimelineCue[]>();
  for (const cue of timelineCues) {
    const list = byModule.get(cue.moduleAddr) ?? [];
    list.push(cue);
    byModule.set(cue.moduleAddr, list);
  }

  const packages = new Map<number, ModuleCuePackage>();

  for (const [addr, moduleCues] of byModule) {
    // Sort by time
    moduleCues.sort((a, b) => a.startTime - b.startTime);

    // Convert to PreloadCue
    const preloadCues: PreloadCue[] = moduleCues.map((c, idx) => ({
      localId: idx + 1,
      timeMs: Math.round(c.startTime * 1000),
      pins: [c.channel],
      duration: c.duration ?? 500,
      label: c.label,
      priority: c.priority ?? 1,
    }));

    // Serialize
    const payload = serializeCueList(preloadCues);
    const checksum = await sha256Hex(payload);
    const totalChunks = Math.ceil(payload.length / chunkMtu);

    packages.set(addr, {
      moduleAddr: addr,
      showId,
      cues: preloadCues,
      checksum,
      totalChunks,
      chunkSize: chunkMtu,
      payload,
    });
  }

  return packages;
}

// ═══════════════════════════════════════════════════════════
// CHUNK BUILDER
// ═══════════════════════════════════════════════════════════

/**
 * Split a module's payload into transmission chunks with CRC
 */
export function buildChunks(pkg: ModuleCuePackage): ChunkPacket[] {
  const chunks: ChunkPacket[] = [];
  for (let i = 0; i < pkg.totalChunks; i++) {
    const start = i * pkg.chunkSize;
    const end = Math.min(start + pkg.chunkSize, pkg.payload.length);
    const data = pkg.payload.slice(start, end);
    chunks.push({
      moduleAddr: pkg.moduleAddr,
      showId: pkg.showId,
      chunkIndex: i,
      totalChunks: pkg.totalChunks,
      data,
      crc16: crc16(data),
    });
  }
  return chunks;
}

/**
 * Serialize a chunk into a wire-format packet:
 * [0x55 CMD][MODULE_ADDR][SHOW_ID_HASH:2][CHUNK_IDX:2][TOTAL:2][DATA_LEN:2][DATA...][CRC16:2]
 */
export function serializeChunkPacket(chunk: ChunkPacket): Uint8Array {
  const showIdHash = crc16(new TextEncoder().encode(chunk.showId));
  const headerLen = 1 + 1 + 2 + 2 + 2 + 2; // cmd + addr + showId + idx + total + dataLen
  const buf = new Uint8Array(headerLen + chunk.data.length + 2);
  const view = new DataView(buf.buffer);

  buf[0] = 0x55; // UltraFire upload command
  buf[1] = chunk.moduleAddr & 0xFF;
  view.setUint16(2, showIdHash);
  view.setUint16(4, chunk.chunkIndex);
  view.setUint16(6, chunk.totalChunks);
  view.setUint16(8, chunk.data.length);
  buf.set(chunk.data, headerLen);
  view.setUint16(headerLen + chunk.data.length, chunk.crc16);

  return buf;
}

// ═══════════════════════════════════════════════════════════
// SYNC TRIGGER BUILDER
// ═══════════════════════════════════════════════════════════

let syncSeq = 0;

/**
 * Build a minimal sync trigger packet (~12 bytes).
 * This is ALL the controller needs to send during the show.
 *
 * Format: [SYNC_CMD:1][SEQ:2][TIMECODE_MS:4][CHECKSUM:1]  = 8 bytes
 * Compare: full FIRE command = 12+ bytes per cue, per module
 */
export function buildSyncTriggerPacket(trigger: SyncTrigger): Uint8Array {
  const cmdByte = {
    go: SYNC_CMD_GO,
    sync: SYNC_CMD_SYNC,
    pause: SYNC_CMD_PAUSE,
    resume: SYNC_CMD_RESUME,
    estop: SYNC_CMD_ESTOP,
    reset: SYNC_CMD_RESET,
  }[trigger.type];

  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  buf[0] = cmdByte;
  view.setUint16(1, trigger.seq & 0xFFFF);
  view.setUint32(3, trigger.timecodeMs);
  // Simple checksum (XOR of bytes 0–6)
  let chk = 0;
  for (let i = 0; i < 7; i++) chk ^= buf[i];
  buf[7] = chk;

  return buf;
}

/**
 * Create a typed sync trigger
 */
export function createSyncTrigger(
  type: SyncTrigger['type'],
  timecodeMs: number
): SyncTrigger {
  return {
    type,
    timecodeMs,
    seq: ++syncSeq,
    ts: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════
// PRELOAD SESSION MANAGER
// ═══════════════════════════════════════════════════════════

/**
 * Manages the pre-show upload process for all modules.
 *
 * Usage:
 *   const session = new PreloadSessionManager('show-001');
 *   const packages = await partitionCueList(timeline, 'show-001');
 *   await session.uploadAll(packages, sendFn);
 *   if (session.isAllReady()) startShow();
 */
export class PreloadSessionManager {
  private session: PreloadSession;
  private listeners: PreloadListener[] = [];

  constructor(showId: string) {
    this.session = {
      showId,
      totalModules: 0,
      totalCues: 0,
      modules: new Map(),
      startedAt: Date.now(),
      allReady: false,
    };
  }

  /** Register event listener */
  on(listener: PreloadListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(type: PreloadEventType, moduleAddr: number, data?: Record<string, unknown>): void {
    const event: PreloadEvent = { type, moduleAddr, data, ts: Date.now() };
    this.listeners.forEach(l => l(event));
  }

  /** Get current session state */
  getSession(): PreloadSession {
    return { ...this.session };
  }

  /** Get readiness matrix: array of module statuses */
  getReadinessMatrix(): ModulePreloadStatus[] {
    return Array.from(this.session.modules.values());
  }

  /** Check if all modules are ready */
  isAllReady(): boolean {
    if (this.session.modules.size === 0) return false;
    return Array.from(this.session.modules.values()).every(m => m.state === 'ready');
  }

  /** Get upload progress (0–100) */
  getProgress(): number {
    const modules = Array.from(this.session.modules.values());
    if (modules.length === 0) return 0;
    const totalChunks = modules.reduce((sum, m) => sum + m.totalChunks, 0);
    const uploaded = modules.reduce((sum, m) => sum + m.chunksUploaded, 0);
    return totalChunks > 0 ? Math.round((uploaded / totalChunks) * 100) : 0;
  }

  /**
   * Upload cue packages to all modules.
   * `sendFn` is the transport-layer send function that handles the actual
   * packet delivery (via Starlink, Wi-Fi Direct, or Radio).
   * Returns when all modules are uploaded + verified or failed.
   */
  async uploadAll(
    packages: Map<number, ModuleCuePackage>,
    sendFn: (packet: Uint8Array, moduleAddr: number) => Promise<boolean>,
    options: { parallelUploads?: number; chunkDelayMs?: number } = {}
  ): Promise<void> {
    const { parallelUploads = 5, chunkDelayMs = 10 } = options;

    this.session.totalModules = packages.size;
    this.session.totalCues = Array.from(packages.values()).reduce((sum, p) => sum + p.cues.length, 0);
    this.session.startedAt = Date.now();

    // Initialize module statuses
    for (const [addr, pkg] of packages) {
      this.session.modules.set(addr, {
        moduleAddr: addr,
        state: 'pending',
        cueCount: pkg.cues.length,
        chunksUploaded: 0,
        totalChunks: pkg.totalChunks,
        verified: false,
        checksum: pkg.checksum,
      });
    }

    // Upload in parallel batches
    const moduleAddrs = Array.from(packages.keys());
    for (let batch = 0; batch < moduleAddrs.length; batch += parallelUploads) {
      const batchAddrs = moduleAddrs.slice(batch, batch + parallelUploads);
      await Promise.all(batchAddrs.map(addr => this.uploadModule(packages.get(addr)!, sendFn, chunkDelayMs)));
    }

    // Check all ready
    this.session.allReady = this.isAllReady();
    if (this.session.allReady) {
      this.session.completedAt = Date.now();
      this.emit('all-ready', 0, {
        totalModules: this.session.totalModules,
        totalCues: this.session.totalCues,
        elapsedMs: this.session.completedAt - this.session.startedAt,
      });
    }
  }

  /** Upload a single module's cue list in chunks */
  private async uploadModule(
    pkg: ModuleCuePackage,
    sendFn: (packet: Uint8Array, moduleAddr: number) => Promise<boolean>,
    chunkDelayMs: number
  ): Promise<void> {
    const status = this.session.modules.get(pkg.moduleAddr)!;
    status.state = 'uploading';
    status.uploadStartedAt = Date.now();
    this.emit('upload-start', pkg.moduleAddr, { cueCount: pkg.cues.length, totalChunks: pkg.totalChunks });

    const chunks = buildChunks(pkg);

    for (const chunk of chunks) {
      const packet = serializeChunkPacket(chunk);
      let success = false;

      for (let retry = 0; retry < CHUNK_RETRY_LIMIT; retry++) {
        success = await sendFn(packet, pkg.moduleAddr);
        if (success) {
          status.chunksUploaded++;
          this.emit('chunk-ack', pkg.moduleAddr, { chunkIndex: chunk.chunkIndex, attempt: retry + 1 });
          break;
        }
        this.emit('chunk-nack', pkg.moduleAddr, { chunkIndex: chunk.chunkIndex, attempt: retry + 1 });
        await delay(CHUNK_ACK_TIMEOUT_MS * (retry + 1) * 0.5);
      }

      if (!success) {
        status.state = 'failed';
        status.errorMessage = `Chunk ${chunk.chunkIndex} failed after ${CHUNK_RETRY_LIMIT} retries`;
        return;
      }

      if (chunkDelayMs > 0) await delay(chunkDelayMs);
    }

    // Verify
    status.state = 'verifying';
    const verifyStart = Date.now();
    // Send verify command with expected checksum
    const verifyPacket = buildVerifyPacket(pkg.moduleAddr, pkg.checksum);
    const verified = await sendFn(verifyPacket, pkg.moduleAddr);
    status.verifyLatencyMs = Date.now() - verifyStart;

    if (verified) {
      status.state = 'ready';
      status.verified = true;
      status.uploadCompletedAt = Date.now();
      this.emit('verify-ok', pkg.moduleAddr, {
        checksum: pkg.checksum,
        latencyMs: status.verifyLatencyMs,
        uploadTimeMs: status.uploadCompletedAt - (status.uploadStartedAt ?? 0),
      });
    } else {
      status.state = 'mismatch';
      status.errorMessage = 'Checksum verification failed';
      this.emit('verify-fail', pkg.moduleAddr, { checksum: pkg.checksum });
    }
  }

  /** Reset session for re-upload */
  reset(): void {
    this.session.modules.clear();
    this.session.allReady = false;
    this.session.completedAt = undefined;
    this.session.startedAt = Date.now();
    syncSeq = 0;
  }
}

// ═══════════════════════════════════════════════════════════
// SYNC CONTROLLER (during show)
// ═══════════════════════════════════════════════════════════

/**
 * Lightweight sync controller for the DURING-SHOW phase.
 * Sends periodic SYNC pulses so modules can correct clock drift.
 * Only ~12 bytes per pulse across all modules (broadcast).
 */
export class SyncController {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private startTimecodeMs = 0;
  private showStartedAt = 0;
  private paused = false;
  private pausedAtMs = 0;
  private sendFn: ((packet: Uint8Array) => void) | null = null;
  private listeners: PreloadListener[] = [];

  on(listener: PreloadListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit(type: PreloadEventType, data?: Record<string, unknown>): void {
    this.listeners.forEach(l => l({ type, moduleAddr: 0, data, ts: Date.now() }));
  }

  /** Get current show timecode in ms */
  getCurrentTimecodeMs(): number {
    if (!this.running) return 0;
    if (this.paused) return this.pausedAtMs;
    return Date.now() - this.showStartedAt + this.startTimecodeMs;
  }

  /** Start the show — sends GO trigger and begins sync pulses */
  start(
    sendFn: (packet: Uint8Array) => void,
    syncIntervalMs: number = SYNC_INTERVAL_MS,
    startFromMs: number = 0
  ): void {
    this.sendFn = sendFn;
    this.startTimecodeMs = startFromMs;
    this.showStartedAt = Date.now();
    this.running = true;
    this.paused = false;

    // Send GO trigger
    const goTrigger = createSyncTrigger('go', startFromMs);
    sendFn(buildSyncTriggerPacket(goTrigger));
    this.emit('sync-sent', { trigger: 'go', timecodeMs: startFromMs });

    // Start periodic SYNC pulses
    this.intervalId = setInterval(() => {
      if (this.paused || !this.running) return;
      const tc = this.getCurrentTimecodeMs();
      const syncTrigger = createSyncTrigger('sync', tc);
      sendFn(buildSyncTriggerPacket(syncTrigger));
      this.emit('sync-sent', { trigger: 'sync', timecodeMs: tc });
    }, syncIntervalMs);
  }

  /** Pause playback */
  pause(): void {
    if (!this.running || this.paused) return;
    this.paused = true;
    this.pausedAtMs = this.getCurrentTimecodeMs();
    const trigger = createSyncTrigger('pause', this.pausedAtMs);
    this.sendFn?.(buildSyncTriggerPacket(trigger));
    this.emit('sync-sent', { trigger: 'pause', timecodeMs: this.pausedAtMs });
  }

  /** Resume playback from paused position */
  resume(): void {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this.showStartedAt = Date.now() - this.pausedAtMs + this.startTimecodeMs;
    const trigger = createSyncTrigger('resume', this.pausedAtMs);
    this.sendFn?.(buildSyncTriggerPacket(trigger));
    this.emit('sync-sent', { trigger: 'resume', timecodeMs: this.pausedAtMs });
  }

  /** Emergency stop — immediate broadcast */
  estop(): void {
    const tc = this.getCurrentTimecodeMs();
    const trigger = createSyncTrigger('estop', tc);
    this.sendFn?.(buildSyncTriggerPacket(trigger));
    this.stop();
    this.emit('sync-sent', { trigger: 'estop', timecodeMs: tc });
  }

  /** Stop sync controller */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
    this.paused = false;
  }

  /** Is the show currently running? */
  isRunning(): boolean { return this.running; }
  isPaused(): boolean { return this.paused; }
}

// ═══════════════════════════════════════════════════════════
// VERIFY PACKET BUILDER
// ═══════════════════════════════════════════════════════════

/**
 * Build verification request packet:
 * [0x56 VERIFY_CMD][MODULE_ADDR][CHECKSUM_HEX_32bytes]
 */
function buildVerifyPacket(moduleAddr: number, checksum: string): Uint8Array {
  const checksumBytes = new TextEncoder().encode(checksum.slice(0, 64));
  const buf = new Uint8Array(2 + checksumBytes.length);
  buf[0] = 0x56; // Verify command
  buf[1] = moduleAddr & 0xFF;
  buf.set(checksumBytes, 2);
  return buf;
}

// ═══════════════════════════════════════════════════════════
// BANDWIDTH CALCULATOR
// ═══════════════════════════════════════════════════════════

export interface BandwidthEstimate {
  /** Total payload bytes across all modules */
  totalPayloadBytes: number;
  /** Estimated upload time at given throughput (seconds) */
  estimatedUploadTimeSec: number;
  /** During-show bandwidth: sync pulses only (bytes/sec) */
  showBandwidthBps: number;
  /** Comparison: traditional fire-per-cue bandwidth (bytes/sec) */
  traditionalBandwidthBps: number;
  /** Bandwidth reduction factor */
  reductionFactor: number;
}

/**
 * Estimate bandwidth savings from pre-load vs traditional fire commands
 */
export function estimateBandwidth(
  packages: Map<number, ModuleCuePackage>,
  totalCues: number,
  showDurationSec: number,
  uploadThroughputKbps: number = 100,
  syncIntervalMs: number = SYNC_INTERVAL_MS
): BandwidthEstimate {
  const totalPayloadBytes = Array.from(packages.values())
    .reduce((sum, p) => sum + p.payload.length, 0);

  const estimatedUploadTimeSec = totalPayloadBytes / (uploadThroughputKbps * 1000 / 8);

  // During show: only sync triggers (8 bytes each, every syncIntervalMs)
  const syncPulsesPerSec = 1000 / syncIntervalMs;
  const showBandwidthBps = syncPulsesPerSec * 8; // 8 bytes per pulse

  // Traditional: ~12 bytes per fire command × cues/sec average
  const cuesPerSec = totalCues / showDurationSec;
  const traditionalBandwidthBps = cuesPerSec * 12;

  return {
    totalPayloadBytes,
    estimatedUploadTimeSec: Math.round(estimatedUploadTimeSec * 10) / 10,
    showBandwidthBps: Math.round(showBandwidthBps),
    traditionalBandwidthBps: Math.round(traditionalBandwidthBps),
    reductionFactor: Math.round(traditionalBandwidthBps / showBandwidthBps * 10) / 10,
  };
}

// ═══════════════════════════════════════════════════════════
// CONVERSION: ScriptEvent ↔ PreloadCue
// ═══════════════════════════════════════════════════════════

/**
 * Convert module emulator ScriptEvents to PreloadCues
 */
export function scriptEventsToPreloadCues(events: ScriptEvent[]): PreloadCue[] {
  return events.map((e, idx) => ({
    localId: idx + 1,
    timeMs: e.timeMs,
    pins: e.pins,
    duration: e.duration,
    label: e.label,
    priority: 1,
  }));
}

/**
 * Convert PreloadCues back to ScriptEvents for module emulator
 */
export function preloadCuesToScriptEvents(cues: PreloadCue[]): ScriptEvent[] {
  return cues.map(c => ({
    id: `preload-${c.localId}`,
    pins: c.pins,
    duration: c.duration,
    timeMs: c.timeMs,
    label: c.label,
  }));
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
