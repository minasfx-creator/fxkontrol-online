/**
 * Garante que NENHUM sistema de bloqueio dispare em design ou
 * simulation. Defesa em profundidade contra regressões.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { workMode } from '@/core/safety/workMode';
import { safetyGate } from '@/core/safety/safetyGate';
import { isSimulating, withSimBypass, shouldEnforce } from '@/core/safety/simulationGuard';
import { isItemLocked } from '@/lib/uiLockHelper';
import { operationalModeGuard } from '@/core/hardware/OperationalModeGuard';

describe('Simulation Guard — zero blocking in design/simulation', () => {
  beforeEach(() => {
    // Force gate ON to prove sim-bypass overrides everything.
    safetyGate.enableAll();
  });

  for (const mode of ['design', 'simulation'] as const) {
    describe(`workMode=${mode}`, () => {
      beforeEach(() => workMode.set(mode));

      it('isSimulating() === true', () => {
        expect(isSimulating()).toBe(true);
      });

      it('safetyGate.isEnforced() returns false for every layer', () => {
        for (const layer of ['lockoutGroups', 'interlockChain', 'modeGuard', 'uiLocks'] as const) {
          expect(safetyGate.isEnforced(layer)).toBe(false);
        }
      });

      it('safetyGate.anyEnforced is false', () => {
        expect(safetyGate.anyEnforced).toBe(false);
      });

      it('isItemLocked() always false even when item.locked=true', () => {
        expect(isItemLocked({ locked: true })).toBe(false);
      });

      it('operationalModeGuard.check() allows everything', () => {
        for (const op of ['simulate', 'preview', 'export', 'validate', 'diagnostics'] as const) {
          expect(operationalModeGuard.check(op).allowed).toBe(true);
        }
      });

      it('withSimBypass forces allowed=true', () => {
        const r = withSimBypass(() => ({ allowed: false, reason: 'real-block' }), 'test-layer');
        expect(r.allowed).toBe(true);
        expect(r.reason).toContain('bypassed');
      });

      it('shouldEnforce always returns false', () => {
        expect(shouldEnforce(() => true)).toBe(false);
      });
    });
  }

  describe('workMode=real_operation — gates re-engage', () => {
    beforeEach(() => workMode.set('real_operation'));

    it('isSimulating() === false', () => {
      expect(isSimulating()).toBe(false);
    });

    it('safetyGate.isEnforced reflects config when in real_operation', () => {
      // enableAll() was called in outer beforeEach
      expect(safetyGate.isEnforced('interlockChain')).toBe(true);
    });

    it('shouldEnforce respects real check', () => {
      expect(shouldEnforce(() => true)).toBe(true);
      expect(shouldEnforce(() => false)).toBe(false);
    });
  });
});
