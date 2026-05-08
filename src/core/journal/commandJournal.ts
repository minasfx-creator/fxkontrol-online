/**
 * ─── Command Journal (correlated UI→ack/nack) ──────────────────────
 *
 * Sprint B do roadmap LiveOps: cada comando que sai do
 * `uiCommandGateway` recebe um `commandId` UUID e gera entradas
 * correlacionadas no `safetyBlackBox` (chain SHA-256):
 *
 *   1. command.requested     — quem pediu, source, detail
 *   2. command.decision      — aceito/bloqueado (futuro: SafetyKernel)
 *   3. command.dispatched    — ack/nack + latência (quando o adapter
 *                              confirmar — wiring opcional via
 *                              ackCommand())
 *
 * Isto NÃO altera o caminho de comando; apenas observa. Chamado pelo
 * gateway sem mudar a API pública.
 */

import { safetyBlackBox } from '@/core/safety/safetyBlackBox';

export interface CommandRequestInfo {
  type: string;
  source: string;
  detail?: string;
  payload?: unknown;
}

const inFlight = new Map<string, { startedAt: number; type: string }>();

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as Crypto).randomUUID === 'function') {
    return (crypto as Crypto).randomUUID();
  }
  return `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Mark a UI-originated command as requested. Returns the assigned
 * commandId so the caller can correlate ack/nack later.
 */
export async function recordCommandRequested(info: CommandRequestInfo): Promise<string> {
  const commandId = uuid();
  inFlight.set(commandId, { startedAt: performance.now(), type: info.type });
  try {
    await safetyBlackBox.record(
      'note',
      true,
      {
        kind: 'command.requested',
        commandId,
        type: info.type,
        source: info.source,
        detail: info.detail,
        // payload kept shallow: only a flag if present, never the contents
        hasPayload: info.payload !== undefined,
      },
    );
  } catch { /* never block command path on audit */ }
  return commandId;
}

export async function recordCommandDispatched(
  commandId: string,
  result: 'ack' | 'nack' | 'timeout',
  reason?: string,
): Promise<void> {
  const meta = inFlight.get(commandId);
  inFlight.delete(commandId);
  const latencyMs = meta ? performance.now() - meta.startedAt : undefined;
  try {
    await safetyBlackBox.record(
      'note',
      result === 'ack',
      {
        kind: 'command.dispatched',
        commandId,
        type: meta?.type,
        result,
        latencyMs,
      },
      result === 'ack' ? undefined : (reason ?? result),
    );
  } catch { /* never block on audit */ }
}

/** Dev helper for tests / inspector. */
export function _commandJournalInFlight(): ReadonlyMap<string, { startedAt: number; type: string }> {
  return inFlight;
}
