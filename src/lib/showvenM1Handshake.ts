/**
 * ─── Showven M1 — Handshake parser + firmware guard ────────────────
 *
 * Pure module (zero IO). Espelha a estratégia do `fireoneXL4Handshake.ts`:
 * o caller (wizard ou bridge externo) abre a porta WebSerial e fala PBus,
 * aqui apenas validamos a *resposta* STATUS, derivamos firmware/slaves e
 * aplicamos o guard de firmware mínimo (V1.5 = FXcommander baseline).
 *
 * Honesty contract:
 *   • Zero síntese — se faltar bytes, devolve `null`/erro.
 *   • Nunca arma/dispara — só lê.
 *   • Independente de transporte (cabo PBus 19200 ou TNC dual-band).
 */

import {
  parsePBusResponse,
  parseDeviceStatus,
  buildStatusQuery,
  PBusCmd,
  PBUS_BAUD_RATE,
} from '@/lib/pbusProtocol';
import { logger } from '@/lib/logger';

export type ShowvenM1HandshakeFailureCode =
  | 'unsupported'
  | 'cancelled'
  | 'open-failed'
  | 'write-failed'
  | 'timeout'
  | 'bad-frame'
  | 'firmware-too-old'
  | 'wrong-model'
  | 'unknown';

export class ShowvenM1HandshakeError extends Error {
  constructor(
    public readonly code: ShowvenM1HandshakeFailureCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ShowvenM1HandshakeError';
  }
}

/** Firmware mínimo aceito — FXcommander/M1 V1.5. */
export const MIN_M1_FIRMWARE = { major: 1, minor: 5 } as const;

/** Modelos que respondem STATUS no protocolo PBus M1/FXcommander. */
export const ACCEPTED_M1_MODELS = ['M1', 'FXCOMMANDER'] as const;
export type ShowvenM1Model = (typeof ACCEPTED_M1_MODELS)[number];

/** Baud canônico — PBus dual-band. Mantemos 19200 fixo (spec Showven). */
export const M1_BAUD = PBUS_BAUD_RATE; // 19200

export interface ShowvenM1Handshake {
  baudRate: number;
  model: ShowvenM1Model;
  firmware: string; // 'major.minor.patch'
  firmwareMajor: number;
  firmwareMinor: number;
  /** PBus master address (1..16). Default = 1. */
  masterAddress: number;
  /** Slaves vivos no barramento, derivados das respostas DISCOVER subsequentes. */
  slavesOnline: number;
}

/** True se `(major, minor) >= MIN_M1_FIRMWARE`. */
export function isM1FirmwareSupported(major: number, minor: number): boolean {
  if (major > MIN_M1_FIRMWARE.major) return true;
  if (major < MIN_M1_FIRMWARE.major) return false;
  return minor >= MIN_M1_FIRMWARE.minor;
}

export interface ParseStatusReplyArgs {
  /** Bytes brutos recebidos do barramento (frame completo PBus). */
  raw: Uint8Array;
  /** Endereço do master que pediu STATUS — usado p/ validar destinatário. */
  expectedAddress?: number;
  /** Permite firmware < V1.5 (apenas para diagnóstico, NÃO operação). */
  allowOldFirmware?: boolean;
  /** Slaves descobertos no barramento (passado pelo caller). */
  slavesOnline?: number;
}

/**
 * Tenta interpretar um frame PBus como resposta STATUS válida do M1.
 * Lança `ShowvenM1HandshakeError` em qualquer falha — caller decide retry.
 */
export function parseM1StatusReply(args: ParseStatusReplyArgs): ShowvenM1Handshake {
  const parsed = parsePBusResponse(args.raw);
  if (!parsed || !parsed.valid) {
    throw new ShowvenM1HandshakeError('bad-frame', 'Frame PBus inválido (CRC ou framing).');
  }
  if (parsed.cmd !== PBusCmd.STATUS && parsed.cmd !== PBusCmd.DISCOVER) {
    throw new ShowvenM1HandshakeError('bad-frame', `Comando inesperado 0x${parsed.cmd.toString(16)}.`);
  }
  if (args.expectedAddress !== undefined && parsed.addr !== args.expectedAddress) {
    throw new ShowvenM1HandshakeError(
      'bad-frame',
      `Endereço inesperado ${parsed.addr} (aguardado ${args.expectedAddress}).`,
      { addr: parsed.addr, expected: args.expectedAddress },
    );
  }

  const partial = parseDeviceStatus(parsed.payload);
  // O M1/FXcommander reporta um type token específico; aqui aceitamos o
  // FW field como contrato canônico e classificamos pelo channel-count.
  // 128 cues = FXcommander/M1; 16 = C16 slave; 4 = X4. Filtramos só master.
  const channels = partial.channels ?? 0;
  if (channels !== 128 && channels !== 0) {
    throw new ShowvenM1HandshakeError(
      'wrong-model',
      `Resposta veio de slave (ch=${channels}), não do master M1/FXcommander.`,
      { channels },
    );
  }

  const fw = partial.firmwareVersion ?? '0.0.0';
  const [maj, min] = fw.split('.').map((s) => Number(s) || 0);

  if (!args.allowOldFirmware && !isM1FirmwareSupported(maj, min)) {
    throw new ShowvenM1HandshakeError(
      'firmware-too-old',
      `Firmware ${fw} é anterior a V${MIN_M1_FIRMWARE.major}.${MIN_M1_FIRMWARE.minor}.`,
      { firmware: fw, minimum: MIN_M1_FIRMWARE },
    );
  }

  return {
    baudRate: M1_BAUD,
    model: 'M1',
    firmware: fw,
    firmwareMajor: maj,
    firmwareMinor: min,
    masterAddress: parsed.addr,
    slavesOnline: Math.max(0, args.slavesOnline ?? 0),
  };
}

// ═══════════════════════════════════════════════════════════
// WebSerial runner — opens port, sends STATUS, validates reply
// ═══════════════════════════════════════════════════════════

export const M1_DEFAULT_MASTER_ADDR = 1;
export const SHOWVEN_USB_FILTERS = [
  { usbVendorId: 0x0403 }, // FTDI
  { usbVendorId: 0x067B }, // Prolific
  { usbVendorId: 0x10C4 }, // Silicon Labs
  { usbVendorId: 0x1A86 }, // WCH (CH340)
];

export function isWebSerialAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in (navigator as any);
}

export async function requestM1Port(): Promise<any> {
  if (!isWebSerialAvailable()) {
    throw new ShowvenM1HandshakeError('unsupported', 'WebSerial não suportado neste navegador.');
  }
  try {
    const nav = navigator as any;
    return await nav.serial.requestPort({ filters: SHOWVEN_USB_FILTERS });
  } catch (err: any) {
    const msg = err?.message ?? 'Cancelado';
    if (/cancel|user/i.test(msg)) {
      throw new ShowvenM1HandshakeError('cancelled', 'Pareamento cancelado pelo operador.');
    }
    throw new ShowvenM1HandshakeError('unknown', msg);
  }
}

export interface ShowvenM1HandshakeOptions {
  port?: any;
  masterAddress?: number;
  timeoutMs?: number;
  allowOldFirmware?: boolean;
}

export interface ShowvenM1HandshakeResult extends ShowvenM1Handshake {
  latencyMs: number;
  rawHex: string;
}

function bytesToHex(bytes: Uint8Array, max = 32): string {
  return Array.from(bytes.subarray(0, max)).map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

/**
 * Run the full PBus STATUS handshake on a Showven M1 master.
 * Read-only: only sends STATUS, never ARM/FIRE.
 */
export async function performM1Handshake(
  opts: ShowvenM1HandshakeOptions = {},
): Promise<ShowvenM1HandshakeResult> {
  const masterAddress = opts.masterAddress ?? M1_DEFAULT_MASTER_ADDR;
  const timeoutMs = opts.timeoutMs ?? 3000;
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const port = opts.port ?? (await requestM1Port());

  try {
    await port.open({
      baudRate: M1_BAUD,
      dataBits: 8,
      stopBits: 1,
      parity: 'none',
      bufferSize: 4096,
    });
  } catch (err: any) {
    throw new ShowvenM1HandshakeError('open-failed', err?.message ?? 'Falha ao abrir a porta.', { baudRate: M1_BAUD });
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
      logger.warn('[showvenM1Handshake] cleanup failed', err);
    }
  };

  try {
    reader = port.readable?.getReader() ?? null;
    writer = port.writable?.getWriter() ?? null;
    if (!reader || !writer) {
      throw new ShowvenM1HandshakeError('open-failed', 'Streams da porta indisponíveis.');
    }

    try {
      await writer.write(buildStatusQuery(masterAddress));
    } catch (err: any) {
      throw new ShowvenM1HandshakeError('write-failed', err?.message ?? 'Falha ao enviar STATUS.');
    }

    const buf: number[] = [];
    let frame: Uint8Array | null = null;
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

      // Look for PBus frame: PREAMBLE 0xAA … TERMINATOR 0x55
      for (let start = 0; start < buf.length; start++) {
        if (buf[start] !== 0xAA) continue;
        if (buf.length - start < 7) break;
        const len = buf[start + 3];
        const end = start + 7 + len - 1;
        if (end >= buf.length) break;
        if (buf[end] !== 0x55) continue;
        const slice = Uint8Array.from(buf.slice(start, end + 1));
        const parsed = parsePBusResponse(slice);
        if (parsed && parsed.valid &&
            (parsed.cmd === PBusCmd.STATUS || parsed.cmd === PBusCmd.DISCOVER)) {
          frame = slice;
          break;
        }
      }
      if (frame) break;
    }

    if (!frame) {
      if (buf.length === 0) {
        throw new ShowvenM1HandshakeError('timeout', `Sem resposta em ${timeoutMs}ms a STATUS (addr ${masterAddress}).`, { masterAddress, timeoutMs });
      }
      throw new ShowvenM1HandshakeError('bad-frame', 'Bytes recebidos mas nenhum frame STATUS válido.', { received: bytesToHex(Uint8Array.from(buf)) });
    }

    const hs = parseM1StatusReply({
      raw: frame,
      expectedAddress: masterAddress,
      allowOldFirmware: opts.allowOldFirmware,
    });

    const latencyMs = Math.max(
      1,
      Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
    );

    await cleanup(false); // keep port open for caller
    return { ...hs, latencyMs, rawHex: bytesToHex(frame) };
  } catch (err) {
    await cleanup(true);
    if (err instanceof ShowvenM1HandshakeError) throw err;
    const msg = (err as Error)?.message ?? 'Erro desconhecido.';
    throw new ShowvenM1HandshakeError('unknown', msg);
  }
}
