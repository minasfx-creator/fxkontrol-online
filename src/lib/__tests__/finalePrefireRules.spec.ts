import { describe, it, expect } from 'vitest';
import {
  interpretPrefire,
  resolvePrefireWithOverrides,
  applyExportOffset,
  derivePrefireFromMeasured,
  PREFIRE_LIFT_BOUNDARY_S,
} from '../finalePrefireRules';

describe('PREFIRE_LIFT_BOUNDARY_S is canonical', () => {
  it('is 0.5', () => expect(PREFIRE_LIFT_BOUNDARY_S).toBe(0.5));
});

describe('interpretPrefire — 0.5s boundary', () => {
  it('<0.5 → delay-before-simulation', () => {
    expect(interpretPrefire(0)).toBe('delay-before-simulation');
    expect(interpretPrefire(0.3)).toBe('delay-before-simulation');
    expect(interpretPrefire(0.499)).toBe('delay-before-simulation');
  });
  it('>=0.5 → lift-time (inclusive at 0.5)', () => {
    expect(interpretPrefire(0.5)).toBe('lift-time');
    expect(interpretPrefire(2.0)).toBe('lift-time');
    expect(interpretPrefire(4.0)).toBe('lift-time');
  });
});

describe('resolvePrefireWithOverrides — source priority', () => {
  it('column wins over PFT, default, lift', () => {
    const r = resolvePrefireWithOverrides({
      prefireColumn: 4,
      pftFromVdl: 2,
      defaultLift: 1,
    });
    expect(r.effectivePrefire).toBe(4);
    expect(r.source).toBe('column');
  });

  it('PFT wins over default when no column', () => {
    const r = resolvePrefireWithOverrides({
      pftFromVdl: 2,
      defaultLift: 1,
    });
    expect(r.source).toBe('pft');
    expect(r.effectivePrefire).toBe(2);
  });

  it('default fallback', () => {
    const r = resolvePrefireWithOverrides({ defaultLift: 1.5 });
    expect(r.source).toBe('default');
    expect(r.effectivePrefire).toBe(1.5);
  });

  it('no source → 0 / none', () => {
    const r = resolvePrefireWithOverrides({});
    expect(r.effectivePrefire).toBe(0);
    expect(r.source).toBe('none');
    expect(r.liftTime).toBe(0);
    expect(r.delayBeforeSimulation).toBe(0);
  });
});

describe('resolvePrefireWithOverrides — implicit lift/delay split', () => {
  it('prefire 0.3 → all into delay-before-sim', () => {
    const r = resolvePrefireWithOverrides({ prefireColumn: 0.3 });
    expect(r.liftTime).toBe(0);
    expect(r.delayBeforeSimulation).toBe(0.3);
  });

  it('prefire 2.0 → all into lift', () => {
    const r = resolvePrefireWithOverrides({ prefireColumn: 2.0 });
    expect(r.liftTime).toBe(2.0);
    expect(r.delayBeforeSimulation).toBe(0);
  });
});

describe('resolvePrefireWithOverrides — LFT/DLY explicit override', () => {
  it('LFT overrides implicit lift even when prefire would imply lift', () => {
    const r = resolvePrefireWithOverrides({
      prefireColumn: 2.0,
      lftFromVdl: 3.0,
    });
    expect(r.liftTime).toBe(3.0);
  });

  it('DLY overrides implicit delay-before-sim', () => {
    const r = resolvePrefireWithOverrides({
      prefireColumn: 0.3,
      dlyFromVdl: 1.0,
    });
    expect(r.delayBeforeSimulation).toBe(1.0);
  });

  it('canonical doc example: 4.0 PFT + 1.0 DLY + 3.0 LFT', () => {
    const r = resolvePrefireWithOverrides({
      pftFromVdl: 4.0,
      dlyFromVdl: 1.0,
      lftFromVdl: 3.0,
    });
    expect(r.effectivePrefire).toBe(4.0);
    expect(r.source).toBe('pft');
    expect(r.liftTime).toBe(3.0);
    expect(r.delayBeforeSimulation).toBe(1.0);
    // Sanity: PFT 4.0 ≈ DLY 1.0 + LFT 3.0 (canonical alignment).
    expect(r.liftTime + r.delayBeforeSimulation).toBeCloseTo(r.effectivePrefire);
  });
});

describe('applyExportOffset — firing-system latency compensation', () => {
  it('negative offset compensates positive latency', () => {
    // Firing system adds +0.1s latency → set offset -0.1 → prefire shifts -0.1
    expect(applyExportOffset(2.0, -0.1)).toBeCloseTo(1.9);
  });

  it('zero offset is identity', () => {
    expect(applyExportOffset(2.0, 0)).toBe(2.0);
  });
});

describe('derivePrefireFromMeasured', () => {
  it('measured prefire = delay_before_launch + lift_delay', () => {
    expect(
      derivePrefireFromMeasured({ delayBeforeLaunch: 0.05, liftDelay: 2.0 }),
    ).toBeCloseTo(2.05);
  });
});
