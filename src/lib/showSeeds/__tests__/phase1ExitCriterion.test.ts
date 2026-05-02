/**
 * Phase 1 Exit Criterion · Libertadores Golden Seed
 *
 * Verifies that the canonical Libertadores ShowPlan, when fed directly
 * to the VerificationEngine (bypassing the global ShowPlanManager),
 * reaches `READY_FOR_EXPORT` (or stricter `READY_FOR_FIELD`).
 *
 * Why direct-feed: VerificationEngine.run() accepts `plan?: ShowPlan`
 * specifically so deterministic seeds can be validated without mutating
 * global state. ReadinessEvaluator uses the manager singleton, so it is
 * not part of this proof — see comments in `.lovable/plan.md` Fase 1.
 *
 * If this test breaks, the golden seed has regressed away from
 * export-ready and the show pipeline cannot certify Phase 1.
 */
import { describe, it, expect } from 'vitest';
import { createLibertadoresShowPlan } from '../libertadores';
import { verificationEngine } from '@/core/verification/VerificationEngine';

describe('Phase 1 exit · Libertadores VerificationEngine', () => {
  const sp = createLibertadoresShowPlan();
  const result = verificationEngine.run(sp);

  it('contains canonical pyro content (no empty-show BLOCK)', () => {
    expect(sp.pyroCues.length).toBeGreaterThan(0);
    expect(sp.hardwareConfig.modules.length).toBeGreaterThan(0);
  });

  it('produces ZERO error-severity verification failures', () => {
    const errs = result.issues.filter(i => !i.passed && i.severity === 'error');
    if (errs.length > 0) {
      // Surface failures so a regression is debuggable from CI.
      // eslint-disable-next-line no-console
      console.error('Verification errors:', errs.map(e => `${e.id}: ${e.detail}`));
    }
    expect(errs).toEqual([]);
  });

  it('reaches READY_FOR_EXPORT or READY_FOR_FIELD', () => {
    expect(['READY_FOR_EXPORT', 'READY_FOR_FIELD']).toContain(result.level);
  });

  it('canExport(plan) returns true', () => {
    expect(verificationEngine.canExport(sp)).toBe(true);
  });

  it('summary numbers are internally consistent', () => {
    expect(result.summary.errors).toBe(0);
    expect(result.summary.passed + result.summary.errors + result.summary.warnings)
      .toBeLessThanOrEqual(result.summary.total);
  });
});
