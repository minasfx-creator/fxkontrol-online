import { describe, it, expect } from 'vitest';
import { inspectHardware, inspectHardwareToMarkdown } from '../inspectHardware';
import { unifiedHardwareRegistry } from '../UnifiedHardwareRegistry';
import { ADAPTER_TRIAGE } from '../adapterTriage';

describe('inspectHardware', () => {
  it('returns a deterministic technical report covering every registered adapter', () => {
    const r = inspectHardware(unifiedHardwareRegistry);
    expect(r.adapters.length).toBe(unifiedHardwareRegistry.getAllAdapters().length);
    // Every registered adapter that lives in the triage table must be classified (no UNKNOWN).
    const triagedIds = new Set(ADAPTER_TRIAGE.map((t) => t.id));
    for (const a of r.adapters) {
      if (triagedIds.has(a.id)) {
        expect(a.triage).not.toBe('UNKNOWN');
      }
    }
    // Triage counts add up to triaged adapter rows.
    const triagedRows = r.adapters.filter((a) => a.triage !== 'UNKNOWN').length;
    const sum =
      r.triageCounts.NOT_INTEGRATED_EXPECTED +
      r.triageCounts.AWAITING_HANDSHAKE +
      r.triageCounts.ADAPTER_ISSUE;
    expect(sum).toBe(triagedRows);
    // Phase 0 readiness aligns with pending list.
    expect(r.phase0HardwareReady).toBe(r.pending.length === 0);
  });

  it('produces a non-empty markdown report mentioning summary + adapter ids', () => {
    const r = inspectHardware(unifiedHardwareRegistry);
    const md = inspectHardwareToMarkdown(r);
    expect(md).toContain('# FX KONTROL · Hardware Inspection Report');
    expect(md).toContain('## Summary');
    expect(md).toContain('## Adapters');
    for (const a of r.adapters) {
      expect(md).toContain(a.id);
    }
  });

  it('is pure: two consecutive calls yield identical structural data', () => {
    const a = inspectHardware(unifiedHardwareRegistry);
    const b = inspectHardware(unifiedHardwareRegistry);
    // Ignore capturedAt (timestamp).
    const stripA = { ...a, capturedAt: 'X' };
    const stripB = { ...b, capturedAt: 'X' };
    expect(stripA.adapters.map((x) => x.id)).toEqual(stripB.adapters.map((x) => x.id));
    expect(stripA.triageCounts).toEqual(stripB.triageCounts);
    expect(stripA.phase0HardwareReady).toBe(stripB.phase0HardwareReady);
  });
});
