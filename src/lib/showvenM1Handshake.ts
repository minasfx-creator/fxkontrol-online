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
