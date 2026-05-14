/**
 * twoWireScanHistory — persistent ring buffer of 2-Wire bus sweeps so the
 * operator can compare sessions (which modules dropped, timing drift, etc.).
 *
 * Honest layer: nothing here ever fires/arms. Pure observability.
 * Storage: localStorage key `fxk.twowire.scanHistory.v1`, ring length 10.
 * Failures (quota/serialise) degrade silently — history is non-critical.
 */

import type { TwoWireDiscoveredModule } from './twoWireBusDiscovery';

export interface ScanHistoryEntry {
  id: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  hubLabel: string | null;
  modules: TwoWireDiscoveredModule[];
}

export interface ScanDiff {
  added: number[];
  removed: number[];
  unchanged: number[];
  durationDeltaMs: number;
}

const KEY = 'fxk.twowire.scanHistory.v1';
const RING = 10;

function safeParse(raw: string | null): ScanHistoryEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter(
      (e) =>
        e && typeof e === 'object' && Array.isArray(e.modules) &&
        typeof e.startedAt === 'number' && typeof e.durationMs === 'number',
    );
  } catch {
    return [];
  }
}

export function loadScanHistory(): ScanHistoryEntry[] {
  if (typeof localStorage === 'undefined') return [];
  return safeParse(localStorage.getItem(KEY));
}

export function appendScanHistory(entry: Omit<ScanHistoryEntry, 'id'>): ScanHistoryEntry {
  const full: ScanHistoryEntry = { ...entry, id: `sweep-${entry.startedAt}` };
  if (typeof localStorage === 'undefined') return full;
  const next = [full, ...loadScanHistory()].slice(0, RING);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota exceeded — best-effort */
  }
  return full;
}

export function clearScanHistory(): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function diffScans(prev: ScanHistoryEntry, curr: ScanHistoryEntry): ScanDiff {
  const prevLive = new Set(prev.modules.filter(m => m.status === 'live').map(m => m.addr));
  const currLive = new Set(curr.modules.filter(m => m.status === 'live').map(m => m.addr));
  const added: number[] = [];
  const removed: number[] = [];
  const unchanged: number[] = [];
  for (const a of currLive) (prevLive.has(a) ? unchanged : added).push(a);
  for (const a of prevLive) if (!currLive.has(a)) removed.push(a);
  return {
    added: added.sort((a, b) => a - b),
    removed: removed.sort((a, b) => a - b),
    unchanged: unchanged.sort((a, b) => a - b),
    durationDeltaMs: curr.durationMs - prev.durationMs,
  };
}
