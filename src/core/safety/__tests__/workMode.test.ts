/**
 * Guardian tests — WorkMode separation between Design / Simulation /
 * Real Operation. Ensures creation/edit/simulation/preview/render NEVER
 * gets blocked by physical safety layers, and that physical paths
 * remain protected in Real Operation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { workMode } from '../workMode';
import { safetyGate } from '../safetyGate';
import { operationalModeGuard } from '@/core/hardware/OperationalModeGuard';
import { isItemLocked } from '@/lib/uiLockHelper';

describe('WorkMode — three-mode separation', () => {
  beforeEach(() => {
    workMode.set('design');
    safetyGate.disableAll();
  });

  describe('design mode', () => {
    beforeEach(() => workMode.set('design'));

    it('safetyGate.isEnforced is false for every layer', () => {
      safetyGate.enableAll();
      expect(safetyGate.isEnforced('lockoutGroups')).toBe(false);
      expect(safetyGate.isEnforced('interlockChain')).toBe(false);
      expect(safetyGate.isEnforced('modeGuard')).toBe(false);
      expect(safetyGate.isEnforced('uiLocks')).toBe(false);
    });

    it('operationalModeGuard.check returns allowed for every operation', () => {
      for (const op of ['simulate', 'preview', 'validate', 'export', 'diagnostics', 'sync_read_only'] as const) {
        expect(operationalModeGuard.check(op).allowed).toBe(true);
      }
    });

    it('isItemLocked always returns false even when item.locked=true', () => {
      expect(isItemLocked({ locked: true })).toBe(false);
    });
  });

  describe('simulation mode', () => {
    beforeEach(() => workMode.set('simulation'));

    it('safetyGate.isEnforced is false for every layer', () => {
      safetyGate.enableAll();
      expect(safetyGate.isEnforced('lockoutGroups')).toBe(false);
      expect(safetyGate.isEnforced('uiLocks')).toBe(false);
    });

    it('isItemLocked false in simulation regardless of safetyGate', () => {
      safetyGate.enableAll();
      expect(isItemLocked({ locked: true })).toBe(false);
    });
  });

  describe('real_operation mode', () => {
    beforeEach(() => workMode.set('real_operation'));

    it('safetyGate.isEnforced respects user toggles when STRICT is off', () => {
      safetyGate.enableAll();
      expect(safetyGate.isEnforced('lockoutGroups')).toBe(true);
      expect(safetyGate.isEnforced('interlockChain')).toBe(true);
    });

    it('isItemLocked enforces .locked when uiLocks layer is on', () => {
      safetyGate.enableAll();
      expect(isItemLocked({ locked: true })).toBe(true);
      expect(isItemLocked({ locked: false })).toBe(false);
    });
  });

  it('subscribe fires on transition', () => {
    const seen: string[] = [];
    const unsub = workMode.subscribe((m) => seen.push(m));
    workMode.set('simulation');
    workMode.set('real_operation');
    workMode.set('design');
    unsub();
    expect(seen).toEqual(['simulation', 'real_operation', 'design']);
  });
});
