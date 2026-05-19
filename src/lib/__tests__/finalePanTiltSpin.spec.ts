import { describe, it, expect } from 'vitest';
import {
  normalizePan,
  normalizeSpin,
  normalizeTilt,
  normalizePTS,
  ptsToMatrix,
  ptsBeamDirection,
  audienceFacingSpinForTilted,
} from '../finalePanTiltSpin';

const approx = (a: number, b: number, eps = 1e-6) =>
  expect(Math.abs(a - b)).toBeLessThan(eps);

describe('normalize ranges (Table 2)', () => {
  it('pan wraps to (-180, +180]', () => {
    expect(normalizePan(0)).toBe(0);
    expect(normalizePan(180)).toBe(180);
    expect(normalizePan(-180)).toBe(180); // half-open: -180 → +180
    expect(normalizePan(270)).toBe(-90);
    expect(normalizePan(540)).toBe(180);
    expect(normalizePan(-540)).toBe(180);
  });

  it('spin wraps to (-180, +180] same as pan', () => {
    expect(normalizeSpin(-90)).toBe(-90);
    expect(normalizeSpin(361)).toBe(1);
  });

  it('tilt folds into [0, 180]', () => {
    expect(normalizeTilt(0)).toBe(0);
    expect(normalizeTilt(45)).toBe(45);
    expect(normalizeTilt(180)).toBe(180);
    expect(normalizeTilt(-45)).toBe(45); // reflection
    expect(normalizeTilt(270)).toBe(90); // 270 → 90
  });
});

describe('normalizePTS — gimbal-lock collapse to spin=0', () => {
  it('tilt=0 folds spin into pan', () => {
    const r = normalizePTS({ pan: 30, tilt: 0, spin: 60 });
    expect(r).toEqual({ pan: 90, tilt: 0, spin: 0 });
  });

  it('tilt=180 folds (pan - spin) into pan', () => {
    const r = normalizePTS({ pan: 30, tilt: 180, spin: 60 });
    expect(r).toEqual({ pan: -30, tilt: 180, spin: 0 });
  });

  it('non-locked tilt preserves spin', () => {
    const r = normalizePTS({ pan: 90, tilt: 45, spin: -90 });
    expect(r).toEqual({ pan: 90, tilt: 45, spin: -90 });
  });
});

describe('ptsBeamDirection — Figure 1 mechanical model', () => {
  it('all-zero → straight up (+Y)', () => {
    const [x, y, z] = ptsBeamDirection({ pan: 0, tilt: 0, spin: 0 });
    approx(x, 0);
    approx(y, 1);
    approx(z, 0);
  });

  it('pan=90, tilt=45 (Figure 2 comet) → beam tilted to the right (+X), no Z', () => {
    const [x, y, z] = ptsBeamDirection({ pan: 90, tilt: 45, spin: 0 });
    // tilt=45 with pan=90 should aim at 45° between +X and +Y (audience right).
    approx(x, Math.SQRT1_2, 1e-6);
    approx(y, Math.SQRT1_2, 1e-6);
    approx(z, 0, 1e-6);
  });

  it('pan=0, tilt=45 (naive intuition) → leans toward audience (+Z OR -Z), not right', () => {
    const [x, y, z] = ptsBeamDirection({ pan: 0, tilt: 45, spin: 0 });
    // With our convention rx() this leans along Z (audience axis), not X.
    approx(x, 0, 1e-6);
    expect(Math.abs(z)).toBeGreaterThan(0.5);
  });

  it('comet is spin-invariant (Figure 2)', () => {
    const a = ptsBeamDirection({ pan: 90, tilt: 45, spin: 0 });
    const b = ptsBeamDirection({ pan: 90, tilt: 45, spin: 123 });
    approx(a[0], b[0]);
    approx(a[1], b[1]);
    approx(a[2], b[2]);
  });
});

describe('audienceFacingSpinForTilted — Figure 3 fan cake', () => {
  it('spin = -pan for canonical example pan=90 → spin=-90', () => {
    expect(audienceFacingSpinForTilted(90)).toBe(-90);
  });

  it('roundtrip normalization stays in canonical range', () => {
    expect(audienceFacingSpinForTilted(180)).toBe(180);
    expect(audienceFacingSpinForTilted(-90)).toBe(90);
  });

  it('Figure 3 PTS triple stays untouched by normalizePTS', () => {
    const r = normalizePTS({
      pan: 90,
      tilt: 45,
      spin: audienceFacingSpinForTilted(90),
    });
    expect(r).toEqual({ pan: 90, tilt: 45, spin: -90 });
  });
});

describe('ptsToMatrix — identity & shape', () => {
  it('identity PTS produces identity matrix', () => {
    const m = ptsToMatrix({ pan: 0, tilt: 0, spin: 0 });
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        approx(m[i + j * 4], i === j ? 1 : 0);
      }
    }
  });

  it('returns 16-element column-major array', () => {
    const m = ptsToMatrix({ pan: 30, tilt: 45, spin: -10 });
    expect(m.length).toBe(16);
    // Last column = (0,0,0,1).
    approx(m[12], 0);
    approx(m[13], 0);
    approx(m[14], 0);
    approx(m[15], 1);
  });
});
