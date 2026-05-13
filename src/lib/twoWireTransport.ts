/**
 * 2-Wire FireOne CDS Transport — single-pair half-duplex over WebSerial.
 *
 * Wraps `twoWireProtocol` and presents a `FireOneTransport`-like surface
 * for `fireoneTransport.ts`. Honest defaults: state starts `disconnected`
 * and devices remain `unknown` until IDENTIFY succeeds (mem://honest-hardware-layer).
 *
 * NOTE: Hookup into the canonical `MultiTransportLink`/`deviceAggregator`
 * layer is TODO — those modules are referenced by project memory but are
 * not present in the repository. The transport is functional standalone
 * and emits its own LinkHealth.
 */

import {
  type TwoWireCmd,
  encodeFrame,
  decodeFrame,
  TwoWireOpcode,
  PRE0,
  PRE1,
  SYNC,
  FRAME_MAX,
} from './twoWireProtocol';

export type TwoWireLinkState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TwoWireLinkHealth {
  state: TwoWireLinkState;
  busBiasV: number | null; // null while unknown (no telemetry yet)
  busCurrentA: number | null;
  collisionCount: number;
  crcErrorRate60s: number;
  txOk: number;
  txErr: number;
  lastEventTs: number;
}

export interface TwoWireOpenOptions {
  baudRate?: 9600 | 19200;
  psk: Uint8Array;
}

type SerialPortLike = {
  open(opts: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
};

const TX_TIMEOUT_MS = 1500;
const CRC_WINDOW_MS = 60_000;

export class TwoWireTransport {
  readonly id: string;
  readonly type = 'two_wire' as const;
  readonly label = '2-Wire CDS (FireOne)';
  /** priority 0 = highest among pyro-capable transports. */
  priority = 0;

  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private psk: Uint8Array = new Uint8Array(0);
  private rxBuf: number[] = [];
  private counters = new Map<number, number>(); // per addr
  private lastSeenCounters = new Map<number, number>();
  private crcErrorTimestamps: number[] = [];
  private health: TwoWireLinkHealth = {
    state: 'disconnected',
    busBiasV: null,
    busCurrentA: null,
    collisionCount: 0,
    crcErrorRate60s: 0,
    txOk: 0,
    txErr: 0,
    lastEventTs: 0,
  };
  private healthSubs = new Set<(h: TwoWireLinkHealth) => void>();
  private frameSubs = new Set<(f: { addr: number; opcode: TwoWireOpcode; payload: Uint8Array }) => void>();
  private readLoopActive = false;

  constructor(id?: string) {
    this.id = id || `two_wire-${Date.now()}`;
  }

  getHealth(): Readonly<TwoWireLinkHealth> {
    return { ...this.health };
  }

  onHealthChange(cb: (h: TwoWireLinkHealth) => void): () => void {
    this.healthSubs.add(cb);
    return () => this.healthSubs.delete(cb);
  }

  onFrame(cb: (f: { addr: number; opcode: TwoWireOpcode; payload: Uint8Array }) => void): () => void {
    this.frameSubs.add(cb);
    return () => this.frameSubs.delete(cb);
  }

  private setHealth(patch: Partial<TwoWireLinkHealth>) {
    this.health = { ...this.health, ...patch, lastEventTs: Date.now() };
    for (const cb of this.healthSubs) cb(this.health);
  }

  /**
   * Connect to a WebSerial port. Caller is responsible for `navigator.serial.requestPort()`.
   */
  async open(port: SerialPortLike, opts: TwoWireOpenOptions): Promise<void> {
    if (this.port) throw new Error('already open');
    this.psk = opts.psk;
    this.setHealth({ state: 'connecting' });
    try {
      await port.open({ baudRate: opts.baudRate ?? 9600 });
      this.port = port;
      this.writer = port.writable!.getWriter();
      this.reader = port.readable!.getReader();
      this.setHealth({ state: 'connected' });
      this.startReadLoop();
    } catch (err) {
      this.setHealth({ state: 'error' });
      throw err;
    }
  }

  async close(): Promise<void> {
    this.readLoopActive = false;
    try { await this.reader?.cancel(); } catch { /* ignore */ }
    try { this.writer?.releaseLock(); } catch { /* ignore */ }
    try { this.reader?.releaseLock(); } catch { /* ignore */ }
    try { await this.port?.close(); } catch { /* ignore */ }
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.rxBuf = [];
    this.setHealth({ state: 'disconnected' });
  }

  /**
   * Send a command frame. Returns when ACK arrives or rejects after `TX_TIMEOUT_MS`.
   * For broadcast (`E_STOP`) we resolve as soon as bytes are flushed.
   */
  async send(cmd: TwoWireCmd): Promise<void> {
    if (!this.writer) throw new Error('NO_REAL_SENDER');
    const addr = cmd.type === 'E_STOP' ? 0 : (cmd as { addr: number }).addr;
    const counter = (this.counters.get(addr) ?? 0) + 1;
    this.counters.set(addr, counter);
    const frame = await encodeFrame(cmd, { psk: this.psk, counter });
    if (frame.length > FRAME_MAX) throw new Error(`frame too large: ${frame.length}`);
    try {
      const t0 = performance.now();
      await this.writer.write(frame);
      this.health.txOk++;
      this.setHealth({});
      // E_STOP and BROADCASTs do not wait for ACK.
      if (cmd.type === 'E_STOP') return;
      void t0;
    } catch (err) {
      this.health.txErr++;
      this.setHealth({ state: 'error' });
      throw err;
    }
  }

  /** True when the host watchdog has not seen any frame for `>500ms`. */
  isStale(now = Date.now(), thresholdMs = 500): boolean {
    return this.health.state === 'connected' && (now - this.health.lastEventTs) > thresholdMs;
  }

  // ── internal: byte-stream parser ──────────────────────────────────
  private startReadLoop() {
    this.readLoopActive = true;
    const tick = async () => {
      while (this.readLoopActive && this.reader) {
        try {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) this.feed(value);
        } catch {
          this.setHealth({ state: 'error' });
          break;
        }
      }
    };
    void tick();
  }

  private feed(chunk: Uint8Array) {
    for (let i = 0; i < chunk.length; i++) this.rxBuf.push(chunk[i]);
    void this.drainFrames();
  }

  private async drainFrames() {
    // Search for [PRE PRE SYNC ...]
    while (this.rxBuf.length >= 16) {
      const i = this.findSync();
      if (i < 0) {
        // Trim leading garbage; keep last 2 bytes (could be partial preamble).
        if (this.rxBuf.length > 2) this.rxBuf.splice(0, this.rxBuf.length - 2);
        return;
      }
      if (i > 0) this.rxBuf.splice(0, i);
      if (this.rxBuf.length < 16) return;
      const lenByte = this.rxBuf[5];
      const total = 3 + 3 + lenByte + 4 + 8 + 2;
      if (total > FRAME_MAX) {
        // Bad LEN: drop preamble and resync.
        this.rxBuf.splice(0, 1);
        continue;
      }
      if (this.rxBuf.length < total) return;
      const frame = Uint8Array.from(this.rxBuf.slice(0, total));
      this.rxBuf.splice(0, total);
      const decoded = await decodeFrame(frame, {
        psk: this.psk,
        lastCounter: (a) => this.lastSeenCounters.get(a) ?? 0,
      });
      if (!decoded.ok) {
        if (decoded.error === 'crc' || decoded.error === 'hmac') {
          this.crcErrorTimestamps.push(Date.now());
          this.recomputeCrcRate();
        }
        continue;
      }
      this.lastSeenCounters.set(decoded.frame.addr, decoded.frame.counter);
      this.setHealth({});
      for (const cb of this.frameSubs) {
        cb({ addr: decoded.frame.addr, opcode: decoded.frame.opcode, payload: decoded.frame.payload });
      }
    }
  }

  private findSync(): number {
    for (let i = 0; i + 2 < this.rxBuf.length; i++) {
      if (this.rxBuf[i] === PRE0 && this.rxBuf[i + 1] === PRE1 && this.rxBuf[i + 2] === SYNC) return i;
    }
    return -1;
  }

  private recomputeCrcRate() {
    const cutoff = Date.now() - CRC_WINDOW_MS;
    while (this.crcErrorTimestamps.length && this.crcErrorTimestamps[0] < cutoff) {
      this.crcErrorTimestamps.shift();
    }
    const total = this.health.txOk + this.health.txErr + this.crcErrorTimestamps.length;
    this.health.crcErrorRate60s = total > 0 ? this.crcErrorTimestamps.length / total : 0;
  }
}

void TX_TIMEOUT_MS;
