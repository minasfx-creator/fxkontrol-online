/**
 * Pyro Transport Policy — single-source-of-truth for which transports are
 * allowed to fire pyro families and in which priority order.
 *
 * 2-Wire CDS gets priority `0` (highest) because it preserves the FireOne
 * field installation contract end-to-end (bias + watchdog + galvanic isolation).
 *
 * EXCLUSIVE_FAMILIES: when a device exposes any of these family names, the
 * dispatcher MUST select a single best link rather than fan out to every
 * available transport. This prevents the "double fire" failure mode where
 * the same channel is energised twice from two transports racing.
 *
 * BLE is BANNED for real_operation pyro fire (latency variance + Apple/Android
 * 7-byte MTU split). It remains allowed for live_read_only telemetry.
 */

import type { TransportType } from './fireoneTransport';

export type ExtendedTransportType = TransportType | 'two_wire' | 'usb' | 'ble';

export const PYRO_FIRE_PRIORITY: ReadonlyArray<ExtendedTransportType> = [
  'two_wire',
  'serial',
  'usb',
  'artnet',
  'radio',
];

/** Families where parallel multi-transport dispatch is forbidden. */
export const EXCLUSIVE_FAMILIES: ReadonlySet<string> = new Set([
  'fireone-ifmx',
  'fireone-ifmx-i32q',
  'fxk16',
  'fxk32q',
]);

/** Transports that may NEVER be used to dispatch pyro fire in real_operation. */
export const BANNED_FOR_REAL_FIRE: ReadonlySet<ExtendedTransportType> = new Set(['ble']);

/**
 * Return the best transport for a given family from the candidate set.
 * Returns null when nothing is acceptable (caller must surface a clear error,
 * never fall back to a banned transport).
 */
export function selectBestPyroTransport(
  family: string,
  available: ReadonlyArray<ExtendedTransportType>,
  workMode: 'design' | 'simulation' | 'real_operation',
): ExtendedTransportType | null {
  const banned = workMode === 'real_operation' ? BANNED_FOR_REAL_FIRE : new Set<ExtendedTransportType>();
  for (const candidate of PYRO_FIRE_PRIORITY) {
    if (banned.has(candidate)) continue;
    if (available.includes(candidate)) return candidate;
  }
  return null;
}

/**
 * True when the given family must use a single transport (no fan-out).
 */
export function isExclusiveFamily(family: string): boolean {
  return EXCLUSIVE_FAMILIES.has(family);
}

/**
 * Determines if a transport is allowed for a specific operation mode.
 */
export function isTransportAllowed(
  transport: ExtendedTransportType,
  workMode: 'design' | 'simulation' | 'real_operation',
): boolean {
  if (workMode === 'real_operation' && BANNED_FOR_REAL_FIRE.has(transport)) {
    return false;
  }
  return true;
}
