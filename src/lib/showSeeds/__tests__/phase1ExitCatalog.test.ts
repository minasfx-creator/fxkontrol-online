/**
 * Phase 1 Exit Criterion · Whole Golden Show Catalog
 *
 * Generalizes the Libertadores-only exit proof to every entry of
 * `GOLDEN_SHOW_CATALOG`. As new seeds are added (Maracanã Hino,
 * future shows…), they must all clear the same bar:
 *
 *  - Non-empty pyroCues + hardwareConfig (no empty-show short-circuit).
 *  - VerificationEngine.run(plan) emits ZERO error-severity issues.
 *  - level ∈ {READY_FOR_EXPORT, READY_FOR_FIELD}.
 *  - canExport(plan) === true.
 *  - simulationDryRun(plan) is complete (every cue scheduled & fired).
 *  - Determinism: build() twice produces an identical canonical
 *    fingerprint (cue keys + start times + hardware module ids).
 *
 * If a single seed regresses, this suite pinpoints which one — giving
 * us the same level of confidence as the Libertadores-specific test
 * but for the entire pipeline.
 */
import { describe, it, expect } from 'vitest';
import { GOLDEN_SHOW_CATALOG } from '../catalog';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { simulationDryRun } from '../simulationDryRun';

interface CueLike {
  startTime: number;
  module?: string;
  channel?: number;
}

function fingerprint(plan: ReturnType<typeof GOLDEN_SHOW_CATALOG[number]['build']>): string {
  const cues = (plan.pyroCues as unknown as CueLike[])
    .slice()
    .sort((a, b) => a.startTime - b.startTime)
    .map((c) => `${c.startTime.toFixed(3)}|${c.module ?? '-'}|${c.channel ?? '-'}`)
    .join(';');
  const mods = plan.hardwareConfig.modules
    .map((m: { id: string }) => m.id)
    .sort()
    .join(',');
  return `cues=${cues}::modules=${mods}`;
}

describe('Phase 1 exit criterion · entire catalog', () => {
  for (const entry of GOLDEN_SHOW_CATALOG) {
    describe(`seed: ${entry.id} (${entry.name})`, () => {
      const sp = entry.build();
      const result = verificationEngine.run(sp);
      const dry = simulationDryRun(sp);

      it('declares canonical pyro content', () => {
        expect(sp.pyroCues.length).toBeGreaterThan(0);
        expect(sp.hardwareConfig.modules.length).toBe(entry.modules);
      });

      it('emits ZERO error-severity verification failures', () => {
        const errs = result.issues.filter((i) => !i.passed && i.severity === 'error');
        if (errs.length > 0) {
          // eslint-disable-next-line no-console
          console.error(
            `[${entry.id}] verification errors:`,
            errs.map((e) => `${e.id}: ${e.detail}`),
          );
        }
        expect(errs).toEqual([]);
      });

      it('reaches READY_FOR_EXPORT or READY_FOR_FIELD', () => {
        expect(['READY_FOR_EXPORT', 'READY_FOR_FIELD']).toContain(result.level);
      });

      it('canExport(plan) is true', () => {
        expect(verificationEngine.canExport(sp)).toBe(true);
      });

      it('simulation dry-run completes (every scheduled cue fires)', () => {
        expect(dry.totalCues).toBeGreaterThan(0);
        expect(dry.cuesFired).toBe(dry.totalCues);
      });

      it('build() is deterministic (identical fingerprint across calls)', () => {
        expect(fingerprint(entry.build())).toBe(fingerprint(entry.build()));
      });
    });
  }

  it('catalog is non-empty', () => {
    expect(GOLDEN_SHOW_CATALOG.length).toBeGreaterThan(0);
  });
});
