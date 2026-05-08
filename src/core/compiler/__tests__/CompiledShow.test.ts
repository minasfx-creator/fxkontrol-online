import { describe, it, expect, beforeEach } from 'vitest';
import { compileShow, verifyCompiledShow, _resetCompilerKeys } from '@/core/compiler/CompiledShow';
import type { ShowPlan } from '@/core/showplan/ShowPlan';

function makePlan(overrides: Partial<ShowPlan['metadata']> = {}): ShowPlan {
  return {
    metadata: {
      id: 'plan-x',
      name: 'Test Show',
      venue: 'Bench',
      gps: { lat: 0, lng: 0, alt: 0 },
      duration: 60,
      version: 1,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      author: 'tester',
      notes: '',
      ...overrides,
    },
    pyroCues: [{ id: 'c1', startTime: 1, channels: [1] } as any],
    dmxCues: [],
    dronePaths: [],
    safetyConstraints: [] as any,
    hardwareConfig: {} as any,
    positions: [],
  } as unknown as ShowPlan;
}

describe('CompiledShow (Sprint A — LiveOps Compiler)', () => {
  beforeEach(() => { _resetCompilerKeys(); localStorage.clear(); });

  it('compiles a plan and produces a verifiable signature', async () => {
    const plan = makePlan();
    const compiled = await compileShow(plan);
    expect(compiled.manifest.planHash.startsWith('sha256:')).toBe(true);
    expect(compiled.manifest.counts.pyroCues).toBe(1);
    expect(compiled.signature.algo).toBe('ECDSA-P256-SHA256');

    const verdict = await verifyCompiledShow(compiled, plan);
    expect(verdict.ok).toBe(true);
  });

  it('detects plan drift', async () => {
    const plan = makePlan();
    const compiled = await compileShow(plan);
    const drifted = makePlan();
    (drifted.pyroCues as any).push({ id: 'c2', startTime: 5, channels: [2] });

    const verdict = await verifyCompiledShow(compiled, drifted);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('plan-hash-mismatch');
  });

  it('rejects tampered manifest', async () => {
    const plan = makePlan();
    const compiled = await compileShow(plan);
    const tampered = { ...compiled, manifest: { ...compiled.manifest, planName: 'EVIL' } };
    const verdict = await verifyCompiledShow(tampered);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toBe('bad-signature');
  });

  it('non-operational metadata changes do NOT alter planHash', async () => {
    const plan = makePlan();
    const compiled = await compileShow(plan);
    const reSaved = makePlan({ updatedAt: 1800000000000, notes: 'edited later' });
    const verdict = await verifyCompiledShow(compiled, reSaved);
    expect(verdict.ok).toBe(true);
  });
});
