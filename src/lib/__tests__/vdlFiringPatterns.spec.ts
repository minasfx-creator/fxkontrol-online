import { describe, it, expect } from 'vitest';
import {
  computeRowFiring,
  normalizeFiringPattern,
  listFiringPatterns,
} from '../vdlFiringPatterns';

describe('vdlFiringPatterns — normalize & catalog', () => {
  it('returns 25 canonical keywords', () => {
    expect(listFiringPatterns().length).toBe(25);
  });
  it('normalizes aliases', () => {
    expect(normalizeFiringPattern('STW')).toBe('STR');
    expect(normalizeFiringPattern('AGW')).toBe('ALR');
    expect(normalizeFiringPattern('AGT')).toBe('ALT');
    expect(normalizeFiringPattern('FNW')).toBe('FNR');
    expect(normalizeFiringPattern('ATF')).toBe('FNT');
    expect(normalizeFiringPattern('BKW')).toBe('BLR');
    expect(normalizeFiringPattern('BKT')).toBe('BLT');
    expect(normalizeFiringPattern('CRN')).toBe('CTO');
  });
  it('accepts lowercase and trims', () => {
    expect(normalizeFiringPattern('  fnt  ')).toBe('FNT');
  });
  it('returns null for unknown', () => {
    expect(normalizeFiringPattern('XYZ')).toBeNull();
    expect(normalizeFiringPattern('')).toBeNull();
  });
});

describe('vdlFiringPatterns — STR/STL/STT', () => {
  it('STR: all straight, left→right delays', () => {
    const r = computeRowFiring({ tubeCount: 5, pattern: 'STR', spacingMs: 100 });
    expect(r.map(t => t.angleDeg)).toEqual([0, 0, 0, 0, 0]);
    expect(r.map(t => t.delayMs)).toEqual([0, 100, 200, 300, 400]);
  });
  it('STL: reversed delays', () => {
    const r = computeRowFiring({ tubeCount: 5, pattern: 'STL', spacingMs: 100 });
    expect(r.map(t => t.delayMs)).toEqual([400, 300, 200, 100, 0]);
  });
  it('STT: all zero delays', () => {
    const r = computeRowFiring({ tubeCount: 5, pattern: 'STT' });
    expect(r.every(t => t.delayMs === 0)).toBe(true);
  });
});

describe('vdlFiringPatterns — Fan (FNR/FNL/FNT)', () => {
  it('FNT: -fan..+fan all simultaneous', () => {
    const r = computeRowFiring({ tubeCount: 5, pattern: 'FNT', fanAngleDeg: 40 });
    expect(r[0].angleDeg).toBeCloseTo(-40);
    expect(r[2].angleDeg).toBeCloseTo(0);
    expect(r[4].angleDeg).toBeCloseTo(40);
    expect(r.every(t => t.delayMs === 0)).toBe(true);
  });
  it('FNR sequences left→right', () => {
    const r = computeRowFiring({ tubeCount: 3, pattern: 'FNR', spacingMs: 50 });
    expect(r.map(t => t.delayMs)).toEqual([0, 50, 100]);
  });
  it('FNL sequences right→left', () => {
    const r = computeRowFiring({ tubeCount: 3, pattern: 'FNL', spacingMs: 50 });
    expect(r.map(t => t.delayMs)).toEqual([100, 50, 0]);
  });
  it('alias FNW == FNR', () => {
    const a = computeRowFiring({ tubeCount: 3, pattern: 'FNW' });
    const b = computeRowFiring({ tubeCount: 3, pattern: 'FNR' });
    expect(a).toEqual(b);
  });
});

describe('vdlFiringPatterns — All-Leaning', () => {
  it('ALT: all -fan, simultaneous', () => {
    const r = computeRowFiring({ tubeCount: 4, pattern: 'ALT', fanAngleDeg: 30 });
    expect(r.every(t => t.angleDeg === -30)).toBe(true);
    expect(r.every(t => t.delayMs === 0)).toBe(true);
  });
  it('ART: all +fan, simultaneous', () => {
    const r = computeRowFiring({ tubeCount: 4, pattern: 'ART', fanAngleDeg: 30 });
    expect(r.every(t => t.angleDeg === 30)).toBe(true);
  });
});

describe('vdlFiringPatterns — Bookend', () => {
  it('BLT: left half angled, right half straight', () => {
    const r = computeRowFiring({ tubeCount: 6, pattern: 'BLT', fanAngleDeg: 45 });
    expect(r.slice(0, 3).map(t => t.angleDeg)).toEqual([-45, -45, -45]);
    expect(r.slice(3).map(t => t.angleDeg)).toEqual([0, 0, 0]);
  });
  it('BRT: left half straight, right half angled', () => {
    const r = computeRowFiring({ tubeCount: 6, pattern: 'BRT', fanAngleDeg: 45 });
    expect(r.slice(0, 3).map(t => t.angleDeg)).toEqual([0, 0, 0]);
    expect(r.slice(3).map(t => t.angleDeg)).toEqual([45, 45, 45]);
  });
});

describe('vdlFiringPatterns — Center-Out / Outside-In', () => {
  it('CTO: center fires first', () => {
    const r = computeRowFiring({ tubeCount: 5, pattern: 'CTO', spacingMs: 100 });
    expect(r[2].delayMs).toBe(0);
    expect(r[1].delayMs).toBe(100);
    expect(r[3].delayMs).toBe(100);
    expect(r[0].delayMs).toBe(200);
    expect(r[4].delayMs).toBe(200);
  });
  it('OTC: outer tubes fire first', () => {
    const r = computeRowFiring({ tubeCount: 5, pattern: 'OTC', spacingMs: 100 });
    expect(r[0].delayMs).toBe(0);
    expect(r[4].delayMs).toBe(0);
    expect(r[1].delayMs).toBe(100);
    expect(r[3].delayMs).toBe(100);
    expect(r[2].delayMs).toBe(200);
  });
});

describe('vdlFiringPatterns — W-Shape', () => {
  it('TRI 11 tubes → 3-5-3 split', () => {
    const r = computeRowFiring({ tubeCount: 11, pattern: 'TRI', fanAngleDeg: 30 });
    const angles = r.map(t => t.angleDeg);
    expect(angles.slice(0, 3)).toEqual([-30, -30, -30]);
    expect(angles.slice(3, 8)).toEqual([0, 0, 0, 0, 0]);
    expect(angles.slice(8)).toEqual([30, 30, 30]);
  });
  it('TRX 11 tubes → 4-3-4 split', () => {
    const r = computeRowFiring({ tubeCount: 11, pattern: 'TRX', fanAngleDeg: 30 });
    const angles = r.map(t => t.angleDeg);
    expect(angles.slice(0, 4)).toEqual([-30, -30, -30, -30]);
    expect(angles.slice(4, 7)).toEqual([0, 0, 0]);
    expect(angles.slice(7)).toEqual([30, 30, 30, 30]);
  });
});

describe('vdlFiringPatterns — V-Shape', () => {
  it('VST 6: 3 left-lean + 3 right-lean, no straight', () => {
    const r = computeRowFiring({ tubeCount: 6, pattern: 'VST', fanAngleDeg: 40 });
    expect(r.map(t => t.angleDeg)).toEqual([-40, -40, -40, 40, 40, 40]);
    expect(r.every(t => t.delayMs === 0)).toBe(true);
  });
  it('VSS: paired sequence from center', () => {
    const r = computeRowFiring({ tubeCount: 6, pattern: 'VSS', spacingMs: 100 });
    // center pair (indices 2,3) fires at 0, next pair (1,4) at 100, outermost (0,5) at 200
    expect(r[2].delayMs).toBe(0);
    expect(r[3].delayMs).toBe(0);
    expect(r[1].delayMs).toBe(100);
    expect(r[4].delayMs).toBe(100);
    expect(r[0].delayMs).toBe(200);
    expect(r[5].delayMs).toBe(200);
  });
});

describe('vdlFiringPatterns — edge cases', () => {
  it('tubeCount 0 returns []', () => {
    expect(computeRowFiring({ tubeCount: 0, pattern: 'FNT' })).toEqual([]);
  });
  it('tubeCount 1 returns single straight', () => {
    const r = computeRowFiring({ tubeCount: 1, pattern: 'FNT' });
    expect(r).toEqual([{ tubeIndex: 0, angleDeg: 0, delayMs: 0 }]);
  });
  it('unknown pattern falls back to STR', () => {
    const r = computeRowFiring({ tubeCount: 3, pattern: 'BOGUS', spacingMs: 50 });
    expect(r.map(t => t.angleDeg)).toEqual([0, 0, 0]);
    expect(r.map(t => t.delayMs)).toEqual([0, 50, 100]);
  });
});
