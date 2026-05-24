/**
 * ─── FireOne XL4+ Pairing Handshake ─────────────────────────────────
 *
 * Validates a FireOne XLII+ / XL4-3 / XL4+ master controller over
 * WebSerial **before** allowing it into the operational pool.
 *
 * Pipeline (read-only, NEVER fires):
 *   1. Open SerialPort at requested baud (default 9600 8N1, FireOne spec).
 *   2. Send `buildIdentify(0)` (broadcast identify).
 *   3. Wait for first valid `IDENTIFY` reply within `timeoutMs`.
 *   4. Parse status payload → derive `firmwareVersion`, `moduleAddress`,
 *      `signalStrength`, `igniterCount`.
 *   5. Compare against `MIN_FIRMWARE`. Reject older firmware.
 *
 * Honesty contract: if no reply, throws `HandshakeError('timeout')` — we
 * NEVER synthesize a fake module. Caller decides whether to retry.
 *
 * Safety contract: this lib only OPENS / READS / sends IDENTIFY. It does
 * not arm, fire, or change state on the controller. All operational
 * commands must still go through `uiCommandGateway`.
 */
import {
  buildIdentify,
  parseFrame,
  parseStatusPayload,
  FireOneCmd,
  type FireOneModuleStatus,
} from '@/lib/fireoneProtocol';
import { logger } from '@/lib/logger';

export type XL4HandshakeFailureCode =
  | 'unsupported'        // WebSerial not available
  | 'cancelled'          // user cancelled requestPort()
  | 'open-failed'        // port.open() rejected (busy, wrong baud, hw missing)
  | 'write-failed'       // writer error during IDENTIFY
  | 'timeout'            // no IDENTIFY reply in time
  | 'bad-frame'          // bytes received but never parsed a valid frame
  | 'firmware-too-old'   // handshake OK but FW < MIN_FIRMWARE
  | 'unknown';

export class XL4HandshakeError extends Error {
  constructor(
    public readonly code: XL4HandshakeFailureCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'XL4HandshakeError';
  }
}

/**
 * Minimum supported XL4 firmware. Anything older lacks the duration
 * range fix (firmware v5.00.08+).
 */
export const MIN_XL4_FIRMWARE = { major: 5, minor: 0 } as const;

/** Bauds the wizard exposes; FireOne spec is 9600 (cable) / 38400 (radio). */
export const SUPPORTED_BAUDS = [9600, 19200, 38400] as const;
export type XL4Baud = (typeof SUPPORTED_BAUDS)[number];
export const DEFAULT_XL4_BAUD: XL4Baud = 9600;

export interface XL4Handshake {
  baudRate: XL4Baud;
  firmware: string;             // 'major.minor'
  firmwareMajor: number;
  firmwareMinor: number;
  moduleAddress: number;
  igniterCount: number;
  signalStrength: number;
  latencyMs: number;
  status: FireOneModuleStatus;
  raw: string;                  // hex preview of received bytes
}

export interface XL4HandshakeOptions {
  baudRate?: XL4Baud;
  timeoutMs?: number;           // default 3000
  /** Inject a port for tests (Web Serial-like API). */
  port?: any;
  /** When true skips firmware-too-old rejection (returns OK with flag). */
  allowOldFirmware?: boolean;
}

const DEFAULT_TIMEOUT = 3000;

/** Runtime check: WebSerial available. */
export function isWebSerialAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in (navigator as any);
}

/** True if `fw` (parsed) ≥ MIN_XL4_FIRMWARE. */
export function isFirmwareSupported(major: number, minor: number): boolean {
  if (major > MIN_XL4_FIRMWARE.major) return true;
  if (major < MIN_XL4_FIRMWARE.major) return false;
  return minor >= MIN_XL4_FIRMWARE.minor;
}

function bytesToHex(bytes: Uint8Array, max = 32): string {
  const slice = bytes.subarray(0, max);
  return Array.from(slice).map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

/**
 * Request a port from the user (must be invoked inside a user gesture).
 * Filters narrow to common USB-serial bridge VIDs used by FireOne docks
 * (FTDI / Prolific / SiLabs / WCH).
 */
export async function requestXL4Port(): Promise<any> {
  if (!isWebSerialAvailable()) {
    throw new XL4HandshakeError('unsupported', 'WebSerial não suportado neste navegador.');
  }
  try {
    const nav = navigator as any;
    return await nav.serial.requestPort({
      filters: [
        { usbVendorId: 0x0403 }, // FTDI
        { usbVendorId: 0x067B }, // Prolific
        { usbVendorId: 0x10C4 }, // Silicon Labs
        { usbVendorId: 0x1A86 }, // WCH (CH340/CH9102)
      ],
    });
  } catch (err: any) {
    const msg = err?.message ?? 'Cancelado';
    if (/cancel|user/i.test(msg)) {
      throw new XL4HandshakeError('cancelled', 'Pareamento cancelado pelo operador.');
    }
    throw new XL4HandshakeError('unknown', msg);
  }
}

/**
 * Run the full handshake on an already-acquired port.
 *
 * The caller owns the port lifecycle: we open + read + write but never
 * close the port if the handshake succeeds (caller may want to keep it).
 * On failure we always release any reader/writer locks we acquired and
 * close the port to leave a clean slate for the next attempt.
 */
export async function performXL4Handshake(
  opts: XL4HandshakeOptions = {},
): Promise<XL4Handshake> {
  const baudRate: XL4Baud = opts.baudRate ?? DEFAULT_XL4_BAUD;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const port = opts.port ?? (await requestXL4Port());

  // ── 1. Open at requested baud ─────────────────────────────
  try {
    await port.open({
      baudRate,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      bufferSize: 4096,
    });
  } catch (err: any) {
    throw new XL4HandshakeError('open-failed', err?.message ?? 'Falha ao abrir a porta.', { baudRate });
  }

  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  let cleanupDone = false;

  const cleanup = async (closePort: boolean) => {
    if (cleanupDone) return;
    cleanupDone = true;
    try {
      if (reader) {
        try { await reader.cancel(); } catch { /* noop */ }
        try { reader.releaseLock(); } catch { /* noop */ }
      }
      if (writer) {
        try { writer.releaseLock(); } catch { /* noop */ }
      }
      if (closePort) {
        try { await port.close?.(); } catch { /* noop */ }
      }
    } catch (err) {
      logger.warn('[xl4Handshake] cleanup failed', err);
    }
  };

  try {
    reader = port.readable?.getReader() ?? null;
    writer = port.writable?.getWriter() ?? null;
    if (!reader || !writer) {
      throw new XL4HandshakeError('open-failed', 'Streams da porta indisponíveis.');
    }

    // ── 2. Send IDENTIFY (broadcast addr 0) ────────────────
    try {
      await writer.write(buildIdentify(0));
    } catch (err: any) {
      throw new XL4HandshakeError('write-failed', err?.message ?? 'Falha ao enviar IDENTIFY.');
    }

    // ── 3. Read until first valid IDENTIFY frame or timeout ─
    const buf: number[] = [];
    let firstFrame: { addr: number; payload: Uint8Array; raw: Uint8Array } | null = null;

    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const remaining = deadline - Date.now();
      const readPromise = reader.read();
      const timer = new Promise<{ value?: Uint8Array; done: true }>((resolve) =>
        setTimeout(() => resolve({ done: true }), remaining),
      );
      const result = await Promise.race([readPromise, timer]);
      if ((result as any).done) break;
      const value = (result as any).value as Uint8Array | undefined;
      if (!value || value.length === 0) continue;
      for (let i = 0; i < value.length; i++) buf.push(value[i]);

      // Try to parse from any STX boundary onwards.
      for (let start = 0; start < buf.length; start++) {
        if (buf[start] !== 0x02) continue; // STX
        for (let end = start + 4; end < buf.length; end++) {
          if (buf[end] !== 0x03) continue; // ETX
          const slice = Uint8Array.from(buf.slice(start, end + 1));
          const parsed = parseFrame(slice);
          if (parsed && parsed.command === FireOneCmd.IDENTIFY) {
            firstFrame = { addr: parsed.moduleAddr, payload: parsed.payload, raw: slice };
            break;
          }
        }
        if (firstFrame) break;
      }
      if (firstFrame) break;
    }

    if (!firstFrame) {
      if (buf.length === 0) {
        throw new XL4HandshakeError('timeout', `Sem resposta em ${timeoutMs}ms a IDENTIFY (baud ${baudRate}).`, { baudRate, timeoutMs });
      }
      throw new XL4HandshakeError('bad-frame', 'Bytes recebidos mas nenhum frame IDENTIFY válido.', { received: bytesToHex(Uint8Array.from(buf)) });
    }

    // ── 4. Parse status / firmware ─────────────────────────
    const status = parseStatusPayload(firstFrame.addr, firstFrame.payload);
    const [majorStr, minorStr] = status.firmwareVersion.split('.');
    const firmwareMajor = Number(majorStr) || 0;
    const firmwareMinor = Number(minorStr) || 0;
    const igniterCount = status.igniters.filter((i) => i.connected).length;

    // ── 5. Firmware gate ───────────────────────────────────
    if (!opts.allowOldFirmware && !isFirmwareSupported(firmwareMajor, firmwareMinor)) {
      throw new XL4HandshakeError(
        'firmware-too-old',
        `Firmware ${status.firmwareVersion} é anterior a ${MIN_XL4_FIRMWARE.major}.${MIN_XL4_FIRMWARE.minor.toString().padStart(2, '0')}. Atualize antes de operar.`,
        { firmware: status.firmwareVersion, minimum: MIN_XL4_FIRMWARE },
      );
    }

    const latencyMs = Math.max(
      1,
      Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
    );

    // SUCCESS — leave port open for caller (do not close).
    await cleanup(false);
    return {
      baudRate,
      firmware: status.firmwareVersion,
      firmwareMajor,
      firmwareMinor,
      moduleAddress: firstFrame.addr,
      igniterCount,
      signalStrength: status.signalStrength,
      latencyMs,
      status,
      raw: bytesToHex(firstFrame.raw),
    };
  } catch (err) {
    await cleanup(true);
    if (err instanceof XL4HandshakeError) throw err;
    const msg = (err as Error)?.message ?? 'Erro desconhecido.';
    throw new XL4HandshakeError('unknown', msg);
  }
}
