/**
 * ─── FXK16 ASCII protocol emulator (TS mirror of firmware) ────────
 *
 * Bit-for-bit faithful reimplementation of the line protocol implemented
 * by `firmware/fxk16-esp32s3/src/fxk16_protocol.cpp`. Lets us validate
 * host-side recognition (deviceModel='FXK16', channelCount=16, FIRE per
 * channel) WITHOUT plugging real hardware in — same parser, same replies,
 * same OK/ERR codes.
 *
 * Honesty: this is a **dev/test fixture only** — never imported by the
 * operational firing path. Lives under `src/dev/` so the honest hardware
 * layer (`mem://funcionalidades/honest-hardware-layer`) treats it as a
 * synthetic source of truth, never confused with a real link.
 */

export interface FXK16EmuOptions {
  /** Override firmware MODEL token. Default 'FXK16'. */
  model?: string;
  /** Override firmware version. Default '1.0.0'. */
  fwVersion?: string;
  /** Override channel count. Default 16. */
  channelCount?: number;
}

/** Mirrors the `MAX_FIRE_DURATION_MS` hardcoded in the firmware. */
export const FXK16_FIRE_MAX_DURATION_MS = 5000;

/** Canonical channel→GPIO→terminal table (mirrors `CHANNEL_MAP[16]`). */
export const FXK16_CHANNEL_MAP: ReadonlyArray<{
  channel: number;
  gpio: number;
  terminal: string;
}> = Object.freeze([
  { channel: 1,  gpio: 4,  terminal: 'IN1'  },
  { channel: 2,  gpio: 5,  terminal: 'IN2'  },
  { channel: 3,  gpio: 6,  terminal: 'IN3'  },
  { channel: 4,  gpio: 7,  terminal: 'IN4'  },
  { channel: 5,  gpio: 15, terminal: 'IN5'  },
  { channel: 6,  gpio: 16, terminal: 'IN6'  },
  { channel: 7,  gpio: 35, terminal: 'IN7'  },
  { channel: 8,  gpio: 36, terminal: 'IN8'  },
  { channel: 9,  gpio: 17, terminal: 'IN9'  },
  { channel: 10, gpio: 18, terminal: 'IN10' },
  { channel: 11, gpio: 8,  terminal: 'IN11' },
  { channel: 12, gpio: 9,  terminal: 'IN12' },
  { channel: 13, gpio: 10, terminal: 'IN13' },
  { channel: 14, gpio: 11, terminal: 'IN14' },
  { channel: 15, gpio: 12, terminal: 'IN15' },
  { channel: 16, gpio: 13, terminal: 'IN16' },
]);

export class FXK16AsciiEmulator {
  private readonly model: string;
  private readonly fwVersion: string;
  private readonly channelCount: number;

  /** 1-based set of currently latched channels (mirrors firmware `s_pinClosed`). */
  private readonly closed: Set<number> = new Set();
  /** 1-based → epoch-ms when pulse auto-opens (mirrors firmware `s_pulseEndMs`). */
  private readonly pulseEnd: Map<number, number> = new Map();
  private estopLatched = false;

  /** Line-buffered input — mirrors `protocolFeedByte` + `s_buf`. */
  private inBuf = '';
  /** Captured replies (one entry per `sink(line)` call from the firmware). */
  private readonly outLines: string[] = [];

  constructor(opts: FXK16EmuOptions = {}) {
    this.model = opts.model ?? 'FXK16';
    this.fwVersion = opts.fwVersion ?? '1.0.0';
    this.channelCount = opts.channelCount ?? 16;
  }

  // ─── Test harness API ─────────────────────────────────────────

  /** Feed a raw byte (host → device). Mirrors `protocolFeedByte`. */
  feedByte(b: number): void {
    const ch = String.fromCharCode(b & 0xff);
    if (ch === '\n') {
      const line = this.inBuf;
      this.inBuf = '';
      this.handleLine(line);
      return;
    }
    if (this.inBuf.length >= 127) {
      this.inBuf = ''; // overflow drop, mirrors firmware
      return;
    }
    this.inBuf += ch;
  }

  /** Convenience: feed an entire string (each '\n' commits a line). */
  feed(s: string): void {
    for (let i = 0; i < s.length; i++) this.feedByte(s.charCodeAt(i));
  }

  /** Drain captured reply lines and clear the buffer. */
  drainLines(): string[] {
    const out = this.outLines.slice();
    this.outLines.length = 0;
    return out;
  }

  /** Send one command and return all reply lines emitted in response. */
  exchange(cmd: string): string[] {
    this.drainLines();
    this.feed(cmd.endsWith('\n') ? cmd : cmd + '\n');
    return this.drainLines();
  }

  /** Auto-open expired pulses — mirrors `serviceTimers()`. Pass `now` for determinism. */
  serviceTimers(now: number = Date.now()): void {
    for (const [ch, end] of this.pulseEnd) {
      if (now - end >= 0) {
        this.closed.delete(ch);
        this.pulseEnd.delete(ch);
      }
    }
  }

  /** Snapshot for assertions. */
  snapshot(): { closed: number[]; estopLatched: boolean } {
    return {
      closed: Array.from(this.closed).sort((a, b) => a - b),
      estopLatched: this.estopLatched,
    };
  }

  // ─── Internals (mirror handleLine in fxk16_protocol.cpp) ──────

  private emit(line: string): void {
    this.outLines.push(line);
  }

  private pinsMask(): number {
    let mask = 0;
    for (const ch of this.closed) mask |= 1 << (ch - 1);
    return mask >>> 0;
  }

  private handleLine(rawIn: string): void {
    // Strip trailing \r and spaces (mirrors firmware).
    let line = rawIn;
    while (line.length > 0 && (line.endsWith('\r') || line.endsWith(' '))) {
      line = line.slice(0, -1);
    }
    if (line.length === 0) return;

    // ── Lifecycle ────────────────────────────────────────────
    if (line === 'HEARTBEAT') { this.emit('PONG'); return; }

    if (line === 'VERSION') {
      this.emit(`VER:${this.model}-${this.fwVersion}`);
      this.emit(`MODEL:${this.model};CH:${this.channelCount};FW:${this.fwVersion}`);
      return;
    }

    if (line === 'STATUS') {
      this.emit(
        `BAT:0.0;PINS:${this.pinsMask()};RSSI:-30;MODEL:${this.model};CH:${this.channelCount}`,
      );
      return;
    }

    if (line === 'IDENTIFY') {
      this.emit(
        `MODEL:${this.model};CH:${this.channelCount};FW:${this.fwVersion};ID:${this.model}`,
      );
      return;
    }

    if (line === 'PINMAP') {
      for (const row of FXK16_CHANNEL_MAP) {
        this.emit(`MAP:${row.channel}:GPIO${row.gpio}:${row.terminal}`);
      }
      this.emit('OK:PINMAP');
      return;
    }

    // ── ESTOP / RESET ────────────────────────────────────────
    if (line === 'ESTOP') {
      this.estopLatched = true;
      this.closed.clear();
      this.pulseEnd.clear();
      this.emit('OK:ESTOP');
      return;
    }
    if (line === 'RESET') {
      this.estopLatched = false;
      this.emit('OK:RESET');
      return;
    }

    // ── FIRE:<pin>:<ms> ──────────────────────────────────────
    if (line.startsWith('FIRE:')) {
      const parts = line.slice(5).split(':');
      const pin = Number.parseInt(parts[0] ?? '', 10);
      const ms  = Number.parseInt(parts[1] ?? '', 10);
      if (!Number.isFinite(pin) || !Number.isFinite(ms)) {
        this.emit('ERR:FIRE:0:PARSE');
        return;
      }
      const err = this.firePin(pin, ms);
      if (err) this.emit(`ERR:FIRE:${pin}:${err}`);
      else      this.emit(`OK:FIRE:${pin}`);
      return;
    }

    // ── BATCH:<mask>:<ms> ────────────────────────────────────
    if (line.startsWith('BATCH:')) {
      const sepIdx = line.indexOf(':', 6);
      if (sepIdx < 0) { this.emit('ERR:BATCH:PARSE'); return; }
      const maskStr = line.slice(6, sepIdx);
      const msStr   = line.slice(sepIdx + 1);
      const mask = maskStr.startsWith('0x') || maskStr.startsWith('0X')
        ? Number.parseInt(maskStr, 16)
        : Number.parseInt(maskStr, 10);
      const ms = Number.parseInt(msStr, 10);
      if (!Number.isFinite(mask) || !Number.isFinite(ms)) {
        this.emit('ERR:BATCH:PARSE');
        return;
      }
      if (this.estopLatched || ms <= 0 || ms > FXK16_FIRE_MAX_DURATION_MS) {
        this.emit(`ERR:BATCH:${mask >>> 0}:REJECTED`);
        return;
      }
      const endAt = Date.now() + ms;
      for (let i = 0; i < this.channelCount; i++) {
        if ((mask >>> 0) & (1 << i)) {
          const ch = i + 1;
          this.closed.add(ch);
          this.pulseEnd.set(ch, endAt);
        }
      }
      this.emit(`OK:BATCH:${mask >>> 0}`);
      return;
    }

    // Unknown — stay silent (mirrors firmware behavior).
  }

  /** Returns null on success, error code string otherwise (mirrors `firePin`). */
  private firePin(pin1Based: number, durationMs: number): string | null {
    if (this.estopLatched) return 'ESTOP_LATCHED';
    if (pin1Based < 1 || pin1Based > this.channelCount) return 'OUT_OF_RANGE';
    if (durationMs <= 0 || durationMs > FXK16_FIRE_MAX_DURATION_MS) return 'BAD_DURATION';
    this.closed.add(pin1Based);
    this.pulseEnd.set(pin1Based, Date.now() + durationMs);
    return null;
  }
}
