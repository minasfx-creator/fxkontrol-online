/**
 * ─── Aggregate Key — Cross-Transport Physical Identity ─────────────
 * The same physical controller can appear on multiple transports
 * (e.g. a CH340 cable shows up on Web Serial AND WebUSB; an FXcommander
 * advertises both BLE and a USB serial console). The discovery layer
 * emits one `DiscoveredDevice` per (transport, link) pair — this module
 * collapses those links into a single canonical identity.
 *
 * Key shape:
 *   • USB / Serial w/ serialNumber → `phys:vid:pid:serial`
 *   • USB / Serial w/o serialNumber → `phys:vid:pid`
 *   • BLE → `phys:ble:${address|name}`
 *   • Art-Net / IP → `phys:host:${ip}`
 *
 * IMPORTANT: Conservative by design. When in doubt we keep entries
 * separate (false negative > false positive). Operators can always
 * pin a preferred transport per aggregate — see DeviceAggregator.
 */

import type { DiscoveredDevice } from './types';

export interface AggregateKeyInput {
  transport?: DiscoveredDevice['transport'];
  vendorId?: number;
  productId?: number;
  host?: string;
  bleAddress?: string;
  serialNumber?: string;
  fallbackLabel?: string;
}

export function aggregateKey(input: AggregateKeyInput): string {
  // Network devices (Art-Net): host wins.
  if (input.host) return `phys:host:${input.host.toLowerCase()}`;

  // BLE: address or name fallback (BLE has no VID/PID at OS level via Web Bluetooth).
  if (input.transport === 'webble') {
    const id = input.bleAddress || input.fallbackLabel || 'unknown';
    return `phys:ble:${id.toLowerCase()}`;
  }

  // USB / Serial: VID:PID, plus serial when available for unique units.
  if (typeof input.vendorId === 'number' && typeof input.productId === 'number') {
    const vid = input.vendorId.toString(16).padStart(4, '0');
    const pid = input.productId.toString(16).padStart(4, '0');
    const base = `phys:${vid}:${pid}`;
    return input.serialNumber ? `${base}:${input.serialNumber}` : base;
  }

  // Last resort: per-transport unique fallback (no aggregation).
  return `phys:isolated:${input.transport ?? 'unknown'}:${input.fallbackLabel ?? Math.random().toString(36).slice(2)}`;
}

/** Extract the aggregate key from a discovered device. */
export function aggregateKeyFor(d: DiscoveredDevice): string {
  const meta = (d.metadata ?? {}) as Record<string, unknown>;
  const serialNumber = typeof meta.serialNumber === 'string' ? meta.serialNumber : undefined;
  const bleAddress =
    typeof meta.bleAddress === 'string'
      ? meta.bleAddress
      : typeof meta.address === 'string'
        ? (meta.address as string)
        : undefined;
  return aggregateKey({
    transport: d.transport,
    vendorId: d.vendorId,
    productId: d.productId,
    host: d.host,
    bleAddress,
    serialNumber,
    fallbackLabel: d.label || d.id,
  });
}
