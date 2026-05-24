/**
 * ─── Serial DMX Adapter — USB-C → DMX via Web Serial ────────────────
 * Suporta dois modos:
 *
 *   1) "open"  — FTDI/Enttec Open DMX / DMXKing / chips FT232.
 *                Frame raw DMX a 250 000 baud, 8N2, BREAK por
 *                setSignals({ break: true }) ~ 100 µs (clamp 1 ms).
 *
 *   2) "pro"   — Enttec DMX USB Pro (label 0xFFFFFFFF).
 *                Wrapper: 0x7E | label(6) | len LSB | len MSB | payload | 0xE7
 *
 * Auto-detecta o modo pelo VID/PID da porta. Se desconhecido, usa "open".
 * 30 Hz refresh máx (DMX permite até ~44 Hz, ficamos abaixo por segurança).
 *
 * IMPORTANTE: Web Serial só funciona em Chromium (Chrome/Edge) sobre
 * HTTPS, e exige clique do usuário para `requestPort()`.
 */

import { logger } from "@/lib/logger";

// Minimal Web Serial typings (TS lib não inclui por padrão)
interface SerialPortInfo { usbVendorId?: number; usbProductId?: number }
interface SerialOptions {
  baudRate: number; dataBits?: number; stopBits?: number;
  parity?: "none" | "even" | "odd"; flowControl?: "none" | "hardware";
}
interface SerialPortLike {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(opts: SerialOptions): Promise<void>;
  close(): Promise<void>;
  getInfo(): SerialPortInfo;
  setSignals(signals: { break?: boolean; dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
}
interface SerialNavigator {
  serial: {
    requestPort(opts?: { filters?: Array<{ usbVendorId?: number; usbProductId?: number }> }): Promise<SerialPortLike>;
    getPorts(): Promise<SerialPortLike[]>;
  };
}

export type SerialDmxMode = "open" | "pro";
export type SerialDmxState = "disconnected" | "opening" | "connected" | "error";

export interface SerialDmxStats {
  state: SerialDmxState;
  mode: SerialDmxMode | null;
  vendorId: number | null;
  productId: number | null;
  framesSent: number;
  lastFrameAt: number;
  lastError: string | null;
  refreshHz: number;
}

const KNOWN_PRO_PIDS = new Set<number>([0x6001 /* shared FT232; precisa string desc, default open */]);
const KNOWN_FTDI_VIDS = new Set<number>([0x0403]);
const ENTTEC_PRO_HINT_PID = new Set<number>([]); // mantenha "open" como default seguro

class SerialDmxAdapter {
  private _port: SerialPortLike | null = null;
  private _writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private _state: SerialDmxState = "disconnected";
  private _mode: SerialDmxMode = "open";
  private _vid: number | null = null;
  private _pid: number | null = null;

  private _buffer = new Uint8Array(513); // [0]=start code, [1..512]=channels
  private _proFrame = new Uint8Array(518); // pro wrapper buffer
  private _txTimer: ReturnType<typeof setInterval> | null = null;
  private _frames = 0;
  private _framesAtLastTick = 0;
  private _refreshHz = 0;
  private _lastFrameAt = 0;
  private _lastError: string | null = null;
  private _hzTimer: ReturnType<typeof setInterval> | null = null;
  private _listeners = new Set<() => void>();

  isSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  async listPorts(): Promise<SerialPortInfo[]> {
    if (!this.isSupported()) return [];
    const nav = navigator as unknown as SerialNavigator;
    const ports = await nav.serial.getPorts();
    return ports.map((p) => p.getInfo());
  }

  /** Cópia somente-leitura do buffer DMX (513 bytes: start code + 512 ch). */
  snapshotBuffer(): Uint8Array {
    return new Uint8Array(this._buffer);
  }

  /** Solicita ao usuário escolher uma porta (precisa ser chamado em handler de clique). */
  async requestAndConnect(forcedMode?: SerialDmxMode): Promise<void> {
    if (!this.isSupported()) {
      this._lastError = "Web Serial não suportado neste navegador (use Chrome/Edge sobre HTTPS).";
      this._state = "error";
      this._notify();
      throw new Error(this._lastError);
    }

    try {
      this._state = "opening";
      this._notify();

      const nav = navigator as unknown as SerialNavigator;
      const port = await nav.serial.requestPort();
      const info = port.getInfo();
      this._vid = info.usbVendorId ?? null;
      this._pid = info.usbProductId ?? null;

      // Auto-detect mode
      const auto: SerialDmxMode =
        forcedMode ??
        (this._pid && ENTTEC_PRO_HINT_PID.has(this._pid)
          ? "pro"
          : "open");
      this._mode = auto;

      // Open with mode-appropriate settings
      const opts: SerialOptions =
        this._mode === "pro"
          ? { baudRate: 57600, dataBits: 8, stopBits: 1, parity: "none", flowControl: "none" }
          : { baudRate: 250000, dataBits: 8, stopBits: 2, parity: "none", flowControl: "none" };

      await port.open(opts);
      this._port = port;
      this._writer = port.writable!.getWriter();
      this._state = "connected";
      this._lastError = null;
      this._buffer[0] = 0; // DMX null start code

      this._startTxLoop();
      this._startHzMeter();
      this._notify();
      logger.info(`[SerialDMX] connected (mode=${this._mode}, vid=${this._vid?.toString(16)}, pid=${this._pid?.toString(16)})`);
    } catch (err) {
      this._lastError = err instanceof Error ? err.message : String(err);
      this._state = "error";
      this._notify();
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this._stopTxLoop();
    this._stopHzMeter();
    try { await this._writer?.close(); } catch { /* ignore */ }
    this._writer = null;
    try { await this._port?.close(); } catch { /* ignore */ }
    this._port = null;
    this._state = "disconnected";
    this._notify();
  }

  /** Define um canal (1..512). */
  setChannel(ch: number, value: number): void {
    if (ch < 1 || ch > 512) return;
    this._buffer[ch] = Math.max(0, Math.min(255, value | 0));
  }

  /** Define vários canais começando em startCh (1..512). */
  setChannels(startCh: number, values: ArrayLike<number>): void {
    for (let i = 0; i < values.length; i++) {
      const ch = startCh + i;
      if (ch >= 1 && ch <= 512) this._buffer[ch] = Math.max(0, Math.min(255, values[i] | 0));
    }
  }

  /** Apaga todos os canais (blackout). */
  blackout(): void {
    for (let i = 1; i <= 512; i++) this._buffer[i] = 0;
  }

  setMode(mode: SerialDmxMode): void {
    this._mode = mode;
    this._notify();
  }

  getStats(): SerialDmxStats {
    return {
      state: this._state,
      mode: this._state === "connected" ? this._mode : null,
      vendorId: this._vid,
      productId: this._pid,
      framesSent: this._frames,
      lastFrameAt: this._lastFrameAt,
      lastError: this._lastError,
      refreshHz: this._refreshHz,
    };
  }

  onChange(fn: () => void): () => void {
    this._listeners.add(fn);
    return () => { this._listeners.delete(fn); };
  }

  // ── private ──────────────────────────────────────────────────────

  private _startTxLoop(): void {
    this._stopTxLoop();
    // 30 Hz
    this._txTimer = setInterval(() => { void this._sendFrame(); }, 33);
  }
  private _stopTxLoop(): void {
    if (this._txTimer) clearInterval(this._txTimer);
    this._txTimer = null;
  }
  private _startHzMeter(): void {
    this._stopHzMeter();
    this._framesAtLastTick = this._frames;
    this._hzTimer = setInterval(() => {
      const delta = this._frames - this._framesAtLastTick;
      this._refreshHz = delta;
      this._framesAtLastTick = this._frames;
      this._notify();
    }, 1000);
  }
  private _stopHzMeter(): void {
    if (this._hzTimer) clearInterval(this._hzTimer);
    this._hzTimer = null;
  }

  private async _sendFrame(): Promise<void> {
    if (!this._writer || !this._port) return;
    try {
      if (this._mode === "open") {
        // BREAK + Mark After Break, depois 513 bytes (start code + 512 channels)
        await this._port.setSignals({ break: true });
        // pequeno delay para BREAK > 88us
        await new Promise((r) => setTimeout(r, 1));
        await this._port.setSignals({ break: false });
        await this._writer.write(this._buffer);
      } else {
        // Enttec Pro: 0x7E | label=6 | len LSB | len MSB | start code + 512 ch | 0xE7
        const payloadLen = 513;
        this._proFrame[0] = 0x7E;
        this._proFrame[1] = 6;
        this._proFrame[2] = payloadLen & 0xFF;
        this._proFrame[3] = (payloadLen >> 8) & 0xFF;
        this._proFrame.set(this._buffer, 4);
        this._proFrame[4 + payloadLen] = 0xE7;
        await this._writer.write(this._proFrame);
      }
      this._frames++;
      this._lastFrameAt = Date.now();
    } catch (err) {
      this._lastError = err instanceof Error ? err.message : String(err);
      this._state = "error";
      this._stopTxLoop();
      this._notify();
    }
  }

  private _notify(): void { for (const fn of this._listeners) fn(); }
}

export const serialDmxAdapter = new SerialDmxAdapter();
