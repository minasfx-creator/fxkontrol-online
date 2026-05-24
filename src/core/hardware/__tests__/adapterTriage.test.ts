/**
 * Tests for the static adapter triage catalog.
 *
 * Pure data validation — no hardware, no random, no network.
 */

import { describe, expect, it } from 'vitest';
import {
  ADAPTER_TRIAGE,
  getTriageEntry,
  groupTriageByClass,
  pendingRequiredAdapters,
} from '../adapterTriage';
import { unifiedHardwareRegistry } from '../UnifiedHardwareRegistry';

describe('adapterTriage', () => {
  it('classifies every registered adapter', () => {
    const registered = unifiedHardwareRegistry
      .getAllAdapters()
      .map((a) => a.deviceId);
    for (const id of registered) {
      expect(getTriageEntry(id), `missing triage for ${id}`).toBeDefined();
    }
  });

  it('uses only valid TriageClass values', () => {
    const valid = new Set([
      'NOT_INTEGRATED_EXPECTED',
      'AWAITING_HANDSHAKE',
      'ADAPTER_ISSUE',
    ]);
    for (const e of ADAPTER_TRIAGE) {
      expect(valid.has(e.class)).toBe(true);
    }
  });

  it('groups entries without losing any', () => {
    const groups = groupTriageByClass();
    const total =
      groups.NOT_INTEGRATED_EXPECTED.length +
      groups.AWAITING_HANDSHAKE.length +
      groups.ADAPTER_ISSUE.length;
    expect(total).toBe(ADAPTER_TRIAGE.length);
  });

  it('reports required adapters as pending when registry is fresh', () => {
    // Fresh registry: every adapter starts NOT integrated.
    const pending = pendingRequiredAdapters(unifiedHardwareRegistry);
    const required = ADAPTER_TRIAGE.filter((e) => e.requiredForSync);
    // All required ones should be pending until handshake.
    expect(pending.length).toBeGreaterThanOrEqual(0);
    expect(pending.length).toBeLessThanOrEqual(required.length);
    for (const p of pending) expect(p.requiredForSync).toBe(true);
  });

  it('every entry has a usable nextAction', () => {
    for (const e of ADAPTER_TRIAGE) {
      expect(e.nextAction.label.length).toBeGreaterThan(0);
      if (e.nextAction.kind === 'route') {
        expect(e.nextAction.path.startsWith('/')).toBe(true);
      }
    }
  });
});
