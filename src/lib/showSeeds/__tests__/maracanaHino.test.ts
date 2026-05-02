/**
 * Maracanã · Hino Nacional · golden seed validation (Phase 1, seed #2).
 *
 * Mirrors `libertadores.test.ts` to prove the seed pipeline is generic:
 * structural targets, channel uniqueness inside the firing window,
 * monotone module/channel routing, and Phase 1 exit certification via
 * `verificationEngine` (zero errors, canExport=true).
 */
import { describe, it, expect } from 'vitest';
import {
  createMaracanaHinoShowPlan,
  summarizeMaracanaHino,
  MARACANA_HINO_TARGETS,
} from '../maracanaHino';
import { verificationEngine } from '@/core/verification/VerificationEngine';
import { canonicalToEnginePlan } from '../canonicalToEnginePlan';
import { simulationDryRun } from '../simulationDryRun';

const sp = createMaracanaHinoShowPlan();
const sum = summarizeMaracanaHino(sp);

describe('Maracanã Hino · golden show structure', () => {
  it('hits the structural targets (16 low + 16 high + 8 closing mines)', () => {
    expect(sum.lowCount).toBeGreaterThanOrEqual(MARACANA_HINO_TARGETS.POINTS_LOW);
    expect(sum.highCount).toBe(MARACANA_HINO_TARGETS.POINTS_HIGH);
    expect(sum.duration).toBe(MARACANA_HINO_TARGETS.DURATION_S);
  });

  it('uses 2 × FXK16 modules with 32 positions total', () => {
    expect(sum.modules).toBe(MARACANA_HINO_TARGETS.MODULES);
    expect(sum.positions).toBe(MARACANA_HINO_TARGETS.CHANNELS_TOTAL);
    for (const m of sp.hardwareConfig.modules) {
      expect(m.type).toBe('fxk16-esp32s3');
      expect(m.channelCount).toBe(16);
    }
  });

  it('cues route only to the declared modules (0 and 1)', () => {
    const moduleSet = new Set(sp.pyroCues.map((c) => c.module));
    expect([...moduleSet].sort()).toEqual([0, 1]);
  });

  it('cue times are within [0, duration]', () => {
    for (const c of sp.pyroCues) {
      expect(c.time).toBeGreaterThanOrEqual(0);
      expect(c.time).toBeLessThanOrEqual(MARACANA_HINO_TARGETS.DURATION_S);
    }
  });

  it('respects the ≥1.0s same-channel reuse window per module', () => {
    const lastFire = new Map<string, number>();
    for (const c of [...sp.pyroCues].sort((a, b) => a.time - b.time)) {
      const key = `${c.module}:${c.channel}`;
      const prev = lastFire.get(key);
      if (prev !== undefined) {
        expect(c.time - prev).toBeGreaterThanOrEqual(1.0);
      }
      lastFire.set(key, c.time);
    }
  });

  it('is deterministic (two builds produce identical cue lists)', () => {
    const a = createMaracanaHinoShowPlan();
    const b = createMaracanaHinoShowPlan();
    expect(a.pyroCues).toEqual(b.pyroCues);
    expect(a.positions).toEqual(b.positions);
  });
});

describe('Maracanã Hino · Phase 1 exit certification', () => {
  const result = verificationEngine.run(sp);

  it('produces ZERO error-severity verification failures', () => {
    const errs = result.issues.filter((i) => !i.passed && i.severity === 'error');
    if (errs.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Maracanã verification errors:', errs.map((e) => `${e.id}: ${e.detail}`));
    }
    expect(errs).toEqual([]);
  });

  it('reaches READY_FOR_EXPORT or READY_FOR_FIELD', () => {
    expect(['READY_FOR_EXPORT', 'READY_FOR_FIELD']).toContain(result.level);
  });

  it('canExport(plan) returns true', () => {
    expect(verificationEngine.canExport(sp)).toBe(true);
  });
});

describe('Maracanã Hino · pipeline genericity', () => {
  it('canonicalToEnginePlan converts every cue to a timeline item', () => {
    const engine = canonicalToEnginePlan(sp);
    expect(engine.timelineItems.length).toBe(sp.pyroCues.length);
    expect(engine.positions.length).toBe(sp.positions.length);
    expect(engine.duration).toBe(sp.metadata.duration);
  });

  it('simulationDryRun fires every cue and reports zero interlock breaches', () => {
    const dry = simulationDryRun(sp);
    expect(dry.cuesFired).toBe(sp.pyroCues.length);
    expect(dry.interlockBreaches).toBe(0);
    expect(dry.peakConcurrentBurns).toBeGreaterThan(0);
  });
});
