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

export function keyFor(opts: { vendorId?: number; productId?: number; host?: string }): string {
  if (opts.host) return `host:${opts.host}`;
  const vid = opts.vendorId?.toString(16).padStart(4, '0') ?? 'xxxx';
  const pid = opts.productId?.toString(16).padStart(4, '0') ?? 'xxxx';
  return `${vid}:${pid}`;
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

  forget(key: string): void {
    const all = load().filter(e => e.key !== key);
    save(all);
  },

  clear(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
  },
};
