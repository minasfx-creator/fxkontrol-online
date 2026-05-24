import { describe, it, expect, beforeEach } from 'vitest';
import {
  appendScanHistory,
  clearScanHistory,
  diffScans,
  loadScanHistory,
  type ScanHistoryEntry,
} from '../twoWireScanHistory';
import type { TwoWireDiscoveredModule } from '../twoWireBusDiscovery';

function mods(addrs: number[]): TwoWireDiscoveredModule[] {
  return addrs.map((addr) => ({ addr, status: 'live' as const, lastSeenTs: Date.now() }));
}

describe('twoWireScanHistory', () => {
  beforeEach(() => clearScanHistory());

  it('persists and reloads entries (LIFO)', () => {
    appendScanHistory({ startedAt: 1, finishedAt: 100, durationMs: 99, hubLabel: 'XL4#A', modules: mods([1, 2]) });
    appendScanHistory({ startedAt: 2, finishedAt: 200, durationMs: 198, hubLabel: 'XL4#A', modules: mods([1, 3]) });
    const h = loadScanHistory();
    expect(h.length).toBe(2);
    expect(h[0].startedAt).toBe(2);
  });

  it('rings at 10', () => {
    for (let i = 0; i < 12; i++) {
      appendScanHistory({ startedAt: i, finishedAt: i + 1, durationMs: 1, hubLabel: null, modules: [] });
    }
    expect(loadScanHistory().length).toBe(10);
  });

  it('diffs added / removed / unchanged + duration delta', () => {
    const prev: ScanHistoryEntry = { id: 'a', startedAt: 0, finishedAt: 100, durationMs: 100, hubLabel: null, modules: mods([1, 2, 5]) };
    const curr: ScanHistoryEntry = { id: 'b', startedAt: 1, finishedAt: 150, durationMs: 150, hubLabel: null, modules: mods([2, 5, 7]) };
    const d = diffScans(prev, curr);
    expect(d.added).toEqual([7]);
    expect(d.removed).toEqual([1]);
    expect(d.unchanged).toEqual([2, 5]);
    expect(d.durationDeltaMs).toBe(50);
  });

  it('survives corrupt storage', () => {
    localStorage.setItem('fxk.twowire.scanHistory.v1', '{not json');
    expect(loadScanHistory()).toEqual([]);
  });
});
