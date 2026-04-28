/**
 * ─── Port Registry — Persisted authorization metadata ──────────────
 * Stores per-device flags that survive page reloads:
 *  - last known label / profile
 *  - generic-adapter operator confirmation (so the user only confirms once
 *    per VID/PID per browser profile)
 *
 * NEVER persists the SerialPort/USBDevice itself (browsers don't allow it).
 * Capped at 50 entries with LRU eviction to keep localStorage tidy.
 */

import { logger } from '@/lib/logger';
import { getReopenMatchPolicy } from './useReopenMatchPolicy';
import type { DiscoveryTransport, LinkMode } from './types';

const STORAGE_KEY = 'fxk:portRegistry:v1';
const MAX_ENTRIES = 50;

export type GenericConfirmMode = 'open' | 'pro';

/** Operator-pinned DMX adapter family — overrides label-based detection. */
export type DMXProfileOverrideKind =
  | 'enttec-pro'
  | 'enttec-open'
  | 'dmxking'
  | 'eurolite'
  | 'generic-dmx';

export interface DMXProfileOverride {
  kind: DMXProfileOverrideKind;
  /** Persist explicit operator choice timestamp for audit. */
  setAt: number;
}

export interface PortRegistryEntry {
  /** Stable key — `${vid}:${pid}` for serial/USB, `host:${ip}` for net. */
  key: string;
  vendorId?: number;
  productId?: number;
  host?: string;
  lastLabel: string;
  profileId?: string;
  dmxAdapterKind?: string;
  /** Operator explicitly confirmed transmitting on a generic adapter. */
  operatorConfirmedGeneric: boolean;
  /** Mode chosen during confirmation (open DMX vs ENTTEC Pro wrapper). */
  confirmedMode?: GenericConfirmMode;
  /** Per-adapter operator override for protocol/family — wins over label detection. */
  profileOverride?: DMXProfileOverride;
  /** Operator-pinned transport for multi-link devices. Survives reloads. */
  preferredTransport?: DiscoveryTransport;
  /** Operator-selected concurrency mode for parallel dispatch. */
  linkMode?: LinkMode;
  firstSeen: number;
  lastSeen: number;
}

function load(): PortRegistryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PortRegistryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    logger.warn('[portRegistry] load failed', e);
    return [];
  }
}

function save(entries: PortRegistryEntry[]): void {
  try {
    // LRU: keep the most recently seen MAX_ENTRIES.
    const trimmed = [...entries]
      .sort((a, b) => b.lastSeen - a.lastSeen)
      .slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    logger.warn('[portRegistry] save failed', e);
  }
}

/**
 * Build the canonical registry key for a device.
 *
 * When `serialNumber` is provided AND the active reopen-match policy is
 * `'vidpid+serial'`, the serial is appended so different physical units
 * of the same VID:PID family get distinct registry entries (and therefore
 * independent auto-reopen state). Otherwise the legacy VID:PID-only key
 * is returned for backwards compatibility.
 */
export function keyFor(opts: {
  vendorId?: number;
  productId?: number;
  host?: string;
  serialNumber?: string;
  /** Override the global policy (mainly for tests / explicit callers). */
  policy?: 'vidpid' | 'vidpid+serial';
}): string {
  if (opts.host) return `host:${opts.host}`;
  const vid = opts.vendorId?.toString(16).padStart(4, '0') ?? 'xxxx';
  const pid = opts.productId?.toString(16).padStart(4, '0') ?? 'xxxx';
  const base = `${vid}:${pid}`;
  const policy = opts.policy ?? getReopenMatchPolicy();
  if (policy === 'vidpid+serial' && opts.serialNumber) {
    return `${base}:${opts.serialNumber}`;
  }
  return base;
}

export const portRegistry = {
  list(): PortRegistryEntry[] {
    return load();
  },

  get(key: string): PortRegistryEntry | undefined {
    return load().find(e => e.key === key);
  },

  upsert(partial: Omit<PortRegistryEntry, 'firstSeen' | 'lastSeen'> & {
    firstSeen?: number;
    lastSeen?: number;
  }): PortRegistryEntry {
    const all = load();
    const now = Date.now();
    const idx = all.findIndex(e => e.key === partial.key);
    const merged: PortRegistryEntry = idx >= 0
      ? { ...all[idx], ...partial, lastSeen: now }
      : { firstSeen: now, lastSeen: now, ...partial };
    if (idx >= 0) all[idx] = merged;
    else all.push(merged);
    save(all);
    return merged;
  },

  /** Mark a generic adapter as operator-confirmed; persisted across sessions. */
  confirmGeneric(
    key: string,
    mode: GenericConfirmMode,
    label: string,
    extras: { vendorId?: number; productId?: number; host?: string } = {},
  ): PortRegistryEntry {
    return this.upsert({
      key,
      lastLabel: label,
      operatorConfirmedGeneric: true,
      confirmedMode: mode,
      ...extras,
    });
  },

  isConfirmedGeneric(key: string): boolean {
    return this.get(key)?.operatorConfirmedGeneric === true;
  },

  /**
   * Record a successful authorization/open event for a port. Persists
   * the metadata used to silently re-open the device on the next session.
   * Preserves any existing operator confirmations / profile overrides.
   */
  recordSuccess(opts: {
    vendorId?: number;
    productId?: number;
    host?: string;
    /** USB serial number — honored only when policy is `vidpid+serial`. */
    serialNumber?: string;
    label: string;
    profileId?: string;
    dmxAdapterKind?: string;
  }): PortRegistryEntry {
    const key = keyFor({
      vendorId: opts.vendorId,
      productId: opts.productId,
      host: opts.host,
      serialNumber: opts.serialNumber,
    });
    const cur = this.get(key);
    return this.upsert({
      key,
      vendorId: opts.vendorId ?? cur?.vendorId,
      productId: opts.productId ?? cur?.productId,
      host: opts.host ?? cur?.host,
      lastLabel: opts.label,
      profileId: opts.profileId ?? cur?.profileId,
      dmxAdapterKind: opts.dmxAdapterKind ?? cur?.dmxAdapterKind,
      operatorConfirmedGeneric: cur?.operatorConfirmedGeneric ?? false,
      confirmedMode: cur?.confirmedMode,
      profileOverride: cur?.profileOverride,
    });
  },

  /** Sorted by lastSeen desc — useful for "recently authorized" inventories. */
  listRecent(): PortRegistryEntry[] {
    return load().sort((a, b) => b.lastSeen - a.lastSeen);
  },

  /** Pin a DMX adapter family/protocol for this VID:PID. Survives reloads. */
  setProfileOverride(
    key: string,
    kind: DMXProfileOverrideKind,
    label: string,
    extras: { vendorId?: number; productId?: number; host?: string } = {},
  ): PortRegistryEntry {
    return this.upsert({
      key,
      lastLabel: label,
      operatorConfirmedGeneric: this.get(key)?.operatorConfirmedGeneric ?? false,
      profileOverride: { kind, setAt: Date.now() },
      ...extras,
    });
  },

  clearProfileOverride(key: string): void {
    const cur = this.get(key);
    if (!cur) return;
    this.upsert({ ...cur, profileOverride: undefined });
  },

  getProfileOverride(key: string): DMXProfileOverride | undefined {
    return this.get(key)?.profileOverride;
  },

  /** Pin operator's preferred transport for a multi-link physical device. */
  setPreferredTransport(key: string, transport: DiscoveryTransport, label?: string): PortRegistryEntry {
    const cur = this.get(key);
    return this.upsert({
      key,
      vendorId: cur?.vendorId,
      productId: cur?.productId,
      host: cur?.host,
      lastLabel: label ?? cur?.lastLabel ?? key,
      operatorConfirmedGeneric: cur?.operatorConfirmedGeneric ?? false,
      confirmedMode: cur?.confirmedMode,
      profileOverride: cur?.profileOverride,
      preferredTransport: transport,
    });
  },

  getPreferredTransport(key: string): DiscoveryTransport | undefined {
    return this.get(key)?.preferredTransport;
  },

  clearPreferredTransport(key: string): void {
    const cur = this.get(key);
    if (!cur) return;
    this.upsert({ ...cur, preferredTransport: undefined });
  },

  /** Pin operator's concurrency mode (single/dual/broadcast). */
  setLinkMode(key: string, mode: LinkMode, label?: string): PortRegistryEntry {
    const cur = this.get(key);
    return this.upsert({
      key,
      vendorId: cur?.vendorId,
      productId: cur?.productId,
      host: cur?.host,
      lastLabel: label ?? cur?.lastLabel ?? key,
      operatorConfirmedGeneric: cur?.operatorConfirmedGeneric ?? false,
      confirmedMode: cur?.confirmedMode,
      profileOverride: cur?.profileOverride,
      preferredTransport: cur?.preferredTransport,
      linkMode: mode,
    });
  },

  getLinkMode(key: string): LinkMode | undefined {
    return this.get(key)?.linkMode;
  },

  clearLinkMode(key: string): void {
    const cur = this.get(key);
    if (!cur) return;
    this.upsert({ ...cur, linkMode: undefined });
  },

  forget(key: string): void {
    const all = load().filter(e => e.key !== key);
    save(all);
  },

  clear(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  },
};
