/**
 * ─── RJ Equipamentos / ICET — Web Serial Bridge (Direct-Send) ───────
 *
 * Envia scripts ICET diretamente ao equipamento de disparo via Web Serial.
 * Filtra pelas mesmas USB VID/PIDs usadas pelo `Timecode.exe V1.5`:
 *   - VID 1A86 / PID 7523  (CH340)
 *   - VID 0403 / PID 6001  (FTDI FT232)
 *   - VID 067B / PID 2303  (Prolific PL2303)
 *
 * SAFETY:
 *  - Esta bridge SÓ TRANSFERE bytes do script para o equipamento.
 *  - O equipamento físico é quem arma e dispara — o app não toca CommandBus,
 *    FieldBus, uiCommandGateway, nem muda workMode.
 *  - Falhas viram resultado tipado, NUNCA simulam sucesso.
 *
 * Frame ASCII (default):
 *  Cada linha do CSV ICET termina em CRLF; handshake usa "VER?\n" /
 *  resposta "VER <x>" + ACK "OK"/NACK "ERR ...". O firmware exato pode
 *  diferir — `IcetSerialFraming` é injetável para acomodar binário futuro
 *  sem mexer no fluxo nem na UI.
 */

import type { IcetCue } from './rjIcetScript';

// ─── VID/PIDs canônicos extraídos do Timecode.exe ───────────────────

export interface UsbFilter {
  usbVendorId: number;
  usbProductId: number;
  label: string;
}

export const ICET_USB_FILTERS: ReadonlyArray<UsbFilter> = [
  { usbVendorId: 0x1a86, usbProductId: 0x7523, label: 'CH340' },
  { usbVendorId: 0x0403, usbProductId: 0x6001, label: 'FTDI FT232' },
  { usbVendorId: 0x067b, usbProductId: 0x2303, label: 'Prolific PL2303' },
];

// ─── resultados tipados ─────────────────────────────────────────────

export type IcetSendErrorCode =
  | 'web-serial-unavailable'
  | 'port-open-failed'
  | 'version-incompatible'
  | 'response-timeout'
  | 'transfer-error'
  | 'aborted';

export type IcetSendResult =
  | { ok: true; cuesSent: number; firmwareVersion?: string }
  | { ok: false; code: IcetSendErrorCode; message: string; cuesSent: number };

export interface IcetSendOptions {
  baudRate?: number;          // default 115200 (ESP32 ICET típico)
  ackTimeoutMs?: number;      // por cue, default 1500
  versionTimeoutMs?: number;  // handshake, default 3000
  framing?: IcetSerialFraming;
  signal?: AbortSignal;
  onProgress?: (sent: number, total: number) => void;
}

// ─── Framing injetável (placeholder ASCII; trocável p/ binário) ─────

export interface IcetSerialFraming {
  encodeVersionProbe(): Uint8Array;
  /** Aceita resposta crua, retorna versão ou null se ainda incompleta. */
  parseVersionResponse(buf: Uint8Array): { version?: string; consumed: number } | null;
  encodeTitle(title: string): Uint8Array;
  encodeCue(cue: IcetCue): Uint8Array;
  /** Aceita resposta crua, retorna 'ok'|'err'|null (incompleta). */
  parseAck(buf: Uint8Array): { kind: 'ok' | 'err'; consumed: number; detail?: string } | null;
}

const TEXT_ENC = new TextEncoder();
const TEXT_DEC = new TextDecoder();

/** Framing ASCII default — espelha o que o `Timecode.exe` exibe no log. */
export const DEFAULT_ASCII_FRAMING: IcetSerialFraming = {
  encodeVersionProbe: () => TEXT_ENC.encode('VER?\r\n'),
  parseVersionResponse: (buf) => {
    const str = TEXT_DEC.decode(buf);
    const nl = str.indexOf('\n');
    if (nl < 0) return null;
    const line = str.slice(0, nl).trim();
    const consumed = nl + 1;
    const m = /^VER\s+(.+)$/i.exec(line);
    return { version: m ? m[1] : line, consumed };
  },
  encodeTitle: (title) => TEXT_ENC.encode(`TITULO ${title}\r\n`),
  encodeCue: (c) => {
    const canal = typeof c.canal === 'string' ? c.canal : String(c.canal);
    return TEXT_ENC.encode(
      `CUE ${c.timecode},${c.modulo},${canal},${c.abertura}\r\n`,
    );
  },
  parseAck: (buf) => {
    const str = TEXT_DEC.decode(buf);
    const nl = str.indexOf('\n');
    if (nl < 0) return null;
    const line = str.slice(0, nl).trim();
    const consumed = nl + 1;
    if (/^OK\b/i.test(line)) return { kind: 'ok', consumed };
    if (/^ERR\b/i.test(line)) return { kind: 'err', consumed, detail: line };
    // linha desconhecida — descarta e segue
    return { kind: 'ok', consumed };
  },
};

// ─── port abstraction (testável) ────────────────────────────────────

export interface SerialPortLike {
  open(opts: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  getInfo?(): { usbVendorId?: number; usbProductId?: number };
}

export function isWebSerialAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export async function requestIcetPort(): Promise<SerialPortLike | null> {
  if (!isWebSerialAvailable()) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  try {
    const port: SerialPortLike = await nav.serial.requestPort({
      filters: ICET_USB_FILTERS.map(f => ({
        usbVendorId: f.usbVendorId,
        usbProductId: f.usbProductId,
      })),
    });
    return port;
  } catch {
    return null;
  }
}

// ─── envio principal ────────────────────────────────────────────────

export async function sendIcetScript(
  port: SerialPortLike,
  title: string,
  cues: IcetCue[],
  options: IcetSendOptions = {},
): Promise<IcetSendResult> {
  const baudRate = options.baudRate ?? 115200;
  const ackTimeout = options.ackTimeoutMs ?? 1500;
  const verTimeout = options.versionTimeoutMs ?? 3000;
  const framing = options.framing ?? DEFAULT_ASCII_FRAMING;
  const signal = options.signal;

  let sentCount = 0;

  // 1. abrir porta
  try {
    await port.open({ baudRate });
  } catch (e) {
    return {
      ok: false,
      code: 'port-open-failed',
      message: `Erro na abertura da porta serial: ${(e as Error)?.message ?? e}`,
      cuesSent: 0,
    };
  }

  const writer = port.writable?.getWriter();
  const reader = port.readable?.getReader();
  if (!writer || !reader) {
    await safeClose(port);
    return {
      ok: false,
      code: 'port-open-failed',
      message: 'Porta serial sem reader/writer disponível.',
      cuesSent: 0,
    };
  }

  const rx = new RxBuffer(reader);
  let firmwareVersion: string | undefined;

  try {
    // 2. handshake de versão
    if (signal?.aborted) return abortedResult(sentCount);
    await writer.write(framing.encodeVersionProbe());
    const verResp = await rx.readUntil(
      buf => framing.parseVersionResponse(buf),
      verTimeout,
      signal,
    );
    if (!verResp) {
      return finish('response-timeout', 'Tempo de resposta do equipamento excedido (handshake de versão).');
    }
    firmwareVersion = verResp.version;

    // 3. envia título
    if (signal?.aborted) return abortedResult(sentCount);
    await writer.write(framing.encodeTitle(title));
    const titleAck = await rx.readUntil(buf => framing.parseAck(buf), ackTimeout, signal);
    if (!titleAck) {
      return finish('response-timeout', 'Equipamento não confirmou recepção do título.');
    }
    if (titleAck.kind === 'err') {
      return finish(
        'version-incompatible',
        `Título não exportado. Versão do equipamento incompatível. ${titleAck.detail ?? ''}`.trim(),
      );
    }

    // 4. envia cues
    const total = cues.length;
    for (const cue of cues) {
      if (signal?.aborted) return abortedResult(sentCount);
      await writer.write(framing.encodeCue(cue));
      const ack = await rx.readUntil(buf => framing.parseAck(buf), ackTimeout, signal);
      if (!ack) {
        return finish('response-timeout', `Tempo de resposta excedido no cue ${cue.seq}.`);
      }
      if (ack.kind === 'err') {
        return finish('transfer-error', `Equipamento rejeitou cue ${cue.seq}: ${ack.detail ?? 'ERR'}`);
      }
      sentCount++;
      options.onProgress?.(sentCount, total);
    }

    return { ok: true, cuesSent: sentCount, firmwareVersion };
  } catch (e) {
    return finish('transfer-error', `Erro na comunicação com o equipamento: ${(e as Error)?.message ?? e}`);
  } finally {
    try { reader.releaseLock(); } catch { /* */ }
    try { writer.releaseLock(); } catch { /* */ }
    await safeClose(port);
  }

  function finish(code: IcetSendErrorCode, message: string): IcetSendResult {
    return { ok: false, code, message, cuesSent: sentCount };
  }
  function abortedResult(sent: number): IcetSendResult {
    return { ok: false, code: 'aborted', message: 'Envio cancelado pelo operador.', cuesSent: sent };
  }
}

async function safeClose(port: SerialPortLike): Promise<void> {
  try { await port.close(); } catch { /* */ }
}

// ─── RX buffer com timeout ──────────────────────────────────────────

class RxBuffer {
  private buf: Uint8Array = new Uint8Array(0);

  constructor(private reader: ReadableStreamDefaultReader<Uint8Array>) {}

  async readUntil<T extends { consumed: number }>(
    parser: (buf: Uint8Array) => T | null,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<T | null> {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      // tenta parsear o que já tem
      const parsed = parser(this.buf);
      if (parsed) {
        this.buf = this.buf.slice(parsed.consumed);
        return parsed;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) return null;
      if (signal?.aborted) return null;

      const chunk = await raceTimeout(this.reader.read(), remaining);
      if (!chunk || chunk.done) return null;
      // normalize buffer type (chunk.value may be backed by SharedArrayBuffer)
      const copy = new Uint8Array(chunk.value.byteLength);
      copy.set(chunk.value);
      this.buf = concat(this.buf, copy);
    }
  }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out as Uint8Array;
}

async function raceTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>(resolve => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    const result = await Promise.race([p, timeout]);
    return result as T | null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
