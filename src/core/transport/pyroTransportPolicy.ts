/**
 * ─── Pyro Transport Policy ─────────────────────────────────────────
 *
 * Hard contract for *which* transports are allowed to carry a pyro
 * FIRE command, and in what priority order. Independent from the
 * runtime health/health-EMA logic in `MultiTransportLink` —
 * `MultiTransportLink` decides "which available link is healthiest";
 * this module decides "which links are even *contractually allowed* in
 * the current workMode".
 *
 * Why a separate module:
 *   • BLE has 30–150ms RTT jitter and no delivery guarantee on most
 *     stacks. It is fine for status/telemetry, NEVER for pyro firing
 *     in real_operation.
 *   • Tuya outlets have 200–800ms latency (memory: "Tuya Smart Outlets
 *     are LOW-PRECISION").
 *   • Without a contract, `MultiTransportLink` will happily promote a
 *     "healthy at this instant" BLE link to active when Serial blips,
 *     producing an off-spec firing.
 *
 * Pure data + pure functions. No singletons, no React.
 */

import type { DiscoveryTransport } from '@/core/discovery/types';
import type { WorkMode } from '@/core/safety/workMode';

/** Command class — gates which policy table to use. */
export type CommandClass = 'pyro-fire' | 'pyro-arm' | 'dmx' | 'telemetry';

/**
 * Canonical pyro priority. Lower index = higher priority. BLE is
 * intentionally absent — see `bannedFor()` for the explicit ban.
 */
export const PYRO_FIRE_PRIORITY: readonly DiscoveryTransport[] = Object.freeze([
  'webserial',
  'webusb',
  'mdns-artnet',
]);

/**
 * Transports that may NEVER carry a given command class in
 * `real_operation`. Returning a non-empty list for `pyro-fire` is the
 * contractual ban that callers must honour at dispatch time.
 */
export function bannedFor(
  cmd: CommandClass,
  mode: WorkMode,
): readonly DiscoveryTransport[] {
  if (mode !== 'real_operation') return [];
  switch (cmd) {
    case 'pyro-fire':
    case 'pyro-arm':
      // BLE: latency/jitter; Tuya/IP outlets are not in DiscoveryTransport
      // today but the same intent applies if/when added.
      return ['webble'];
    case 'dmx':
    case 'telemetry':
      return [];
  }
}

export interface TransportSelection {
  /** Allowed transports in priority order, banned ones removed. */
  allowed: DiscoveryTransport[];
  /** Transports that were filtered out by the contract. */
  banned: DiscoveryTransport[];
  /** True when at least one transport survived the policy. */
  ok: boolean;
}

/**
 * Apply the policy to a list of *available* transports. The caller
 * (`MultiTransportLink` consumer) gets back the contract-approved
 * subset, ordered by canonical priority. Empty `allowed` means the
 * dispatch MUST be refused — there is no acceptable path.
 */
export function selectPyroTransports(
  available: readonly DiscoveryTransport[],
  mode: WorkMode,
  cmd: CommandClass = 'pyro-fire',
): TransportSelection {
  const ban = new Set(bannedFor(cmd, mode));
  const banned = available.filter((t) => ban.has(t));
  const filtered = available.filter((t) => !ban.has(t));
  const ordered = [...PYRO_FIRE_PRIORITY].filter((t) => filtered.includes(t));
  // Preserve any available transport not in PRIORITY at the end so
  // future transports default to "allowed but lowest priority".
  for (const t of filtered) if (!ordered.includes(t)) ordered.push(t);
  return {
    allowed: ordered,
    banned,
    ok: ordered.length > 0,
  };
}

export type PyroDispatchRefusalReason =
  | 'no-allowed-transport'
  | 'ble-banned-for-pyro';

export interface PyroDispatchVerdict {
  ok: boolean;
  reason?: PyroDispatchRefusalReason;
  selection: TransportSelection;
}

/**
 * Convenience verdict — true when at least one allowed transport
 * remains. Maps the absence of an allowed transport to a structured
 * reason so call sites can render an exact operator-facing message.
 */
export function verdictForPyroFire(
  available: readonly DiscoveryTransport[],
  mode: WorkMode,
): PyroDispatchVerdict {
  const selection = selectPyroTransports(available, mode, 'pyro-fire');
  if (selection.ok) return { ok: true, selection };
  const reason: PyroDispatchRefusalReason =
    selection.banned.length > 0 ? 'ble-banned-for-pyro' : 'no-allowed-transport';
  return { ok: false, reason, selection };
}

export function explainPyroRefusal(reason: PyroDispatchRefusalReason): string {
  switch (reason) {
    case 'no-allowed-transport':
      return 'Nenhum transporte aprovado para FIRE de pyro está disponível.';
    case 'ble-banned-for-pyro':
      return 'BLE não pode carregar comandos de pyro em real_operation (jitter/latência). Conecte Serial/USB/Art-Net.';
  }
}
