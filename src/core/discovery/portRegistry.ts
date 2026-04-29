/**
 * ─── Port Registry — Persisted authorization metadata ──────────────
 * Stores per-device flags that survive page reloads:
 *  - last known label / profile
 *  - generic-adapter operator confirmation (so the user only confirms once
 *    per VID/PID per browser profile)
 *  - operator preferences: preferredTransport, linkMode, profileOverride
 *
 * IDENTITY UNIFICATION
 * --------------------
 * The same physical device can be discovered via several transports
 * (Web Serial, WebUSB, BLE, Art-Net) — each historically generating its
 * own legacy key (`vid:pid`, `vid:pid:serial`, `host:ip`, `ble:addr`).
 * To prevent duplicate entries, every `PortRegistryEntry` now carries an
 * `aliases: string[]` field, and a separate alias index maps every
 * known alias → canonical key. `get()`, `upsert()`, `recordSuccess()`
 * automatically follow the alias index, so a second discoverer hitting
 * the same physical device merges into the existing entry instead of
 * creating a duplicate.
 *
 * NEVER persists the SerialPort/USBDevice itself (browsers don't allow it).
 * Capped at 50 entries with LRU eviction to keep localStorage tidy.
 */

import { logger } from '@/lib/logger';
import { getReopenMatchPolicy } from './useReopenMatchPolicy';
import type { DiscoveryTransport, LinkMode } from './types';

const STORAGE_KEY = 'fxk:portRegistry:v1';
const ALIAS_INDEX_KEY = 'fxk:portRegistry:aliasIndex:v1';
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
  /** Canonical key — `${vid}:${pid}` for serial/USB, `host:${ip}` for net. */
  key: string;
  /**
   * All known equivalent keys for this physical device (cross-transport).
   * Includes the canonical key itself for uniform lookup. Set semantics —
   * always sorted+deduped on save.
   */
  aliases: string[];
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

// ── Persistence ────────────────────────────────────────────────────

function load(): PortRegistryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PortRegistryEntry[];
    if (!Array.isArray(parsed)) return [];
    // Backfill `aliases` for entries persisted by older versions.
    return parsed.map((e) => ({
      ...e,
      aliases: Array.isArray(e.aliases) && e.aliases.length > 0
        ? Array.from(new Set([e.key, ...e.aliases]))
        : [e.key],
    }));
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
      .slice(0, MAX_ENTRIES)
      .map((e) => ({
        ...e,
        aliases: Array.from(new Set([e.key, ...(e.aliases ?? [])])).sort(),
      }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    // Rebuild alias index from authoritative entries.
    rebuildAliasIndex(trimmed);
  } catch (e) {
    logger.warn('[portRegistry] save failed', e);
  }
}

function loadAliasIndex(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ALIAS_INDEX_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAliasIndex(index: Record<string, string>): void {
  try {
    localStorage.setItem(ALIAS_INDEX_KEY, JSON.stringify(index));
  } catch (e) {
    logger.warn('[portRegistry] alias-index save failed', e);
  }
}

function rebuildAliasIndex(entries: PortRegistryEntry[]): void {
  const idx: Record<string, string> = {};
  for (const e of entries) {
    for (const alias of e.aliases ?? [e.key]) idx[alias] = e.key;
  }
  saveAliasIndex(idx);
}

// ── Key generation ─────────────────────────────────────────────────

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

/**
 * Generate every alias key a physical device might be touched by — covers
 * VID:PID, VID:PID:serial, host, and BLE/aggregate forms. Used by the
 * unification helper to seed equivalences in a single shot.
 */
export function aliasCandidatesFor(opts: {
  vendorId?: number;
  productId?: number;
  serialNumber?: string;
  host?: string;
  bleAddress?: string;
  aggregateId?: string;
}): string[] {
  const out = new Set<string>();
  if (opts.host) {
    out.add(`host:${opts.host}`);
    out.add(`host:${opts.host.toLowerCase()}`);
  }
  if (typeof opts.vendorId === 'number' && typeof opts.productId === 'number') {
    const vid = opts.vendorId.toString(16).padStart(4, '0');
    const pid = opts.productId.toString(16).padStart(4, '0');
    out.add(`${vid}:${pid}`);
    if (opts.serialNumber) out.add(`${vid}:${pid}:${opts.serialNumber}`);
  }
  if (opts.bleAddress) out.add(`ble:${opts.bleAddress.toLowerCase()}`);
  if (opts.aggregateId) out.add(opts.aggregateId);
  return [...out];
}

export const portRegistry = {
  list(): PortRegistryEntry[] {
    return load();
  },

  /**
   * Resolve any (canonical or alias) key to the canonical key currently
   * holding the entry. Returns the input unchanged when no mapping exists.
   */
  resolveCanonicalKey(key: string): string {
    const idx = loadAliasIndex();
    return idx[key] ?? key;
  },

  /** Get an entry by canonical key OR by any of its aliases. */
  get(key: string): PortRegistryEntry | undefined {
    const canonical = this.resolveCanonicalKey(key);
    return load().find((e) => e.key === canonical);
  },

  /** Find an entry by any alias key (returns undefined if unknown). */
  findByAlias(alias: string): PortRegistryEntry | undefined {
    const canonical = loadAliasIndex()[alias];
    if (!canonical) return undefined;
    return load().find((e) => e.key === canonical);
  },

  upsert(partial: Omit<PortRegistryEntry, 'firstSeen' | 'lastSeen' | 'aliases'> & {
    firstSeen?: number;
    lastSeen?: number;
    aliases?: string[];
  }): PortRegistryEntry {
    const all = load();
    const now = Date.now();
    // Honor existing alias mapping so a duplicate-sounding key collapses
    // into the existing canonical entry instead of forking a new one.
    const canonical = this.resolveCanonicalKey(partial.key);
    const idx = all.findIndex((e) => e.key === canonical);
    const incomingAliases = Array.from(
      new Set([canonical, partial.key, ...(partial.aliases ?? [])]),
    );
    const merged: PortRegistryEntry = idx >= 0
      ? {
          ...all[idx],
          ...partial,
          key: canonical,
          aliases: Array.from(new Set([...(all[idx].aliases ?? []), ...incomingAliases])),
          lastSeen: now,
        }
      : {
          firstSeen: now,
          lastSeen: now,
          ...partial,
          key: canonical,
          aliases: incomingAliases,
        };
    if (idx >= 0) all[idx] = merged;
    else all.push(merged);
    save(all);
    return merged;
  },

  /**
   * Declare equivalences: ensure all `aliases` resolve to the same
   * canonical entry. If multiple entries currently hold subsets of the
   * alias set, they are merged into the oldest one (preserving operator
   * confirmations / overrides). Returns the resulting canonical entry.
   *
   * This is the entry point used by the DeviceAggregator after it
   * identifies a PhysicalDevice spanning multiple transports.
   */
  unifyAliases(aliases: string[], opts: { label?: string } = {}): PortRegistryEntry | null {
    const unique = Array.from(new Set(aliases.filter(Boolean)));
    if (unique.length === 0) return null;

    const all = load();
    // Collect every existing entry whose key matches any alias OR whose
    // own aliases overlap with the input set.
    const matchingIdx: number[] = [];
    for (let i = 0; i < all.length; i++) {
      const e = all[i];
      if (unique.includes(e.key)) { matchingIdx.push(i); continue; }
      if ((e.aliases ?? []).some((a) => unique.includes(a))) matchingIdx.push(i);
    }

    if (matchingIdx.length === 0) {
      // Nothing persisted yet — create a stub entry on the first alias.
      const seedKey = unique[0];
      const now = Date.now();
      const fresh: PortRegistryEntry = {
        key: seedKey,
        aliases: unique,
        lastLabel: opts.label ?? seedKey,
        operatorConfirmedGeneric: false,
        firstSeen: now,
        lastSeen: now,
      };
      all.push(fresh);
      save(all);
      return fresh;
    }

    // Merge into the oldest matching entry — preserves history.
    const matching = matchingIdx.map((i) => all[i]);
    matching.sort((a, b) => a.firstSeen - b.firstSeen);
    const survivor = matching[0];
    const losers = matching.slice(1);

    const mergedAliases = new Set<string>([
      survivor.key,
      ...(survivor.aliases ?? []),
      ...unique,
    ]);
    let mergedSurvivor: PortRegistryEntry = {
      ...survivor,
      aliases: [...mergedAliases],
      lastSeen: Date.now(),
      lastLabel: opts.label ?? survivor.lastLabel,
    };
    for (const loser of losers) {
      mergedSurvivor = mergeEntryInto(mergedSurvivor, loser);
      for (const a of loser.aliases ?? [loser.key]) mergedAliases.add(a);
    }
    mergedSurvivor.aliases = [...mergedAliases];

    // Rewrite store: drop losers, replace survivor.
    const next = all.filter((e) => !losers.includes(e) && e !== survivor);
    next.push(mergedSurvivor);
    save(next);
    return mergedSurvivor;
  },

  /** Add a single alias to an existing entry without merging. */
  addAlias(canonicalKey: string, alias: string): PortRegistryEntry | undefined {
    const all = load();
    const canonical = this.resolveCanonicalKey(canonicalKey);
    const entry = all.find((e) => e.key === canonical);
    if (!entry) return undefined;
    const aliases = new Set([...(entry.aliases ?? []), alias]);
    entry.aliases = [...aliases];
    entry.lastSeen = Date.now();
    save(all);
    return entry;
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
   * Automatically seeds aliases (vid:pid, vid:pid:serial) so cross-transport
   * lookups collapse into the same entry.
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
    // Seed every plausible alias (legacy keys, with/without serial, host).
    const aliases = aliasCandidatesFor({
      vendorId: opts.vendorId,
      productId: opts.productId,
      serialNumber: opts.serialNumber,
      host: opts.host,
    });
    const cur = this.get(key);
    return this.upsert({
      key,
      aliases,
      vendorId: opts.vendorId ?? cur?.vendorId,
      productId: opts.productId ?? cur?.productId,
      host: opts.host ?? cur?.host,
      lastLabel: opts.label,
      profileId: opts.profileId ?? cur?.profileId,
      dmxAdapterKind: opts.dmxAdapterKind ?? cur?.dmxAdapterKind,
      operatorConfirmedGeneric: cur?.operatorConfirmedGeneric ?? false,
      confirmedMode: cur?.confirmedMode,
      profileOverride: cur?.profileOverride,
      preferredTransport: cur?.preferredTransport,
      linkMode: cur?.linkMode,
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
    const canonical = this.resolveCanonicalKey(key);
    const all = load().filter((e) => e.key !== canonical);
    save(all);
  },

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ALIAS_INDEX_KEY);
    } catch { /* noop */ }
  },
};

// ── Internal: merge two entries, preferring non-empty / explicit values ──

function mergeEntryInto(survivor: PortRegistryEntry, loser: PortRegistryEntry): PortRegistryEntry {
  return {
    ...survivor,
    vendorId: survivor.vendorId ?? loser.vendorId,
    productId: survivor.productId ?? loser.productId,
    host: survivor.host ?? loser.host,
    lastLabel: survivor.lastLabel || loser.lastLabel,
    profileId: survivor.profileId ?? loser.profileId,
    dmxAdapterKind: survivor.dmxAdapterKind ?? loser.dmxAdapterKind,
    // Operator confirmations are sticky — OR them.
    operatorConfirmedGeneric:
      survivor.operatorConfirmedGeneric || loser.operatorConfirmedGeneric,
    confirmedMode: survivor.confirmedMode ?? loser.confirmedMode,
    profileOverride: survivor.profileOverride ?? loser.profileOverride,
    preferredTransport: survivor.preferredTransport ?? loser.preferredTransport,
    linkMode: survivor.linkMode ?? loser.linkMode,
    firstSeen: Math.min(survivor.firstSeen, loser.firstSeen),
    lastSeen: Math.max(survivor.lastSeen, loser.lastSeen),
  };
}
