/**
 * Spec: joiChoreographyHelpers — pure helpers para criação de coreografia Joi.
 */
import { describe, it, expect } from 'vitest';
import {
  resolvePalette,
  pickPaletteColor,
  materializeLayout,
  mirrorPositions,
  densityForArc,
  planArcSchedule,
  snapToBeat,
  beatGrid,
  effectWindowDuration,
} from '@/utils/joiChoreographyHelpers';

describe('resolvePalette', () => {
  it('returns custom if provided', () => {
    expect(resolvePalette('reveillon', ['#abcdef'])).toEqual(['#abcdef']);
  });
  it('returns preset by name', () => {
    expect(resolvePalette('patriotico')).toEqual(['#009C3B', '#FFDF00', '#002776', '#FFFFFF']);
  });
  it('falls back to classico when unknown / undefined', () => {
    expect(resolvePalette(undefined)).toEqual(resolvePalette('classico'));
    expect(resolvePalette('xx' as any)).toEqual(resolvePalette('classico'));
  });
});

describe('pickPaletteColor', () => {
  it('rotates through palette', () => {
    const p = ['#a', '#b', '#c'];
    expect(pickPaletteColor(p, 0)).toBe('#a');
    expect(pickPaletteColor(p, 4)).toBe('#b');
  });
  it('returns white on empty palette', () => {
    expect(pickPaletteColor([], 5)).toBe('#ffffff');
  });
});

describe('materializeLayout', () => {
  it('always emits pitch=90 (vertical)', () => {
    const all = materializeLayout('arc', 5).every(p => p.pitch === 90);
    expect(all).toBe(true);
  });
  it('line is symmetric around anchor', () => {
    const pts = materializeLayout('line', 5, { spacing: 4 });
    expect(pts[0].x).toBeCloseTo(-8);
    expect(pts[4].x).toBeCloseTo(8);
    expect(pts.every(p => p.z === 0)).toBe(true);
  });
  it('circle places N points on radius', () => {
    const pts = materializeLayout('circle', 8, { radius: 10 });
    pts.forEach(p => expect(Math.hypot(p.x, p.z)).toBeCloseTo(10, 5));
  });
  it('symmetric places center when odd count', () => {
    const pts = materializeLayout('symmetric', 5, { spacing: 3 });
    const center = pts[2];
    expect(center.x).toBe(0);
  });
  it('grid distributes count', () => {
    const pts = materializeLayout('grid', 9, { spacing: 5 });
    expect(pts).toHaveLength(9);
  });
  it('respects namePrefix and type', () => {
    const pts = materializeLayout('line', 2, { namePrefix: 'DRN', type: 'drone-pad' });
    expect(pts[0].name).toBe('DRN-1');
    expect(pts[0].type).toBe('drone-pad');
  });
});

describe('mirrorPositions', () => {
  it('negates x and heading', () => {
    const src = materializeLayout('line', 3, { spacing: 4 });
    const mir = mirrorPositions(src, 100);
    expect(mir[0].x).toBeCloseTo(-src[0].x);
    expect(mir[0].heading).toBeCloseTo(-src[0].heading);
    expect(mir[0].index).toBe(100);
    expect(mir[0].name.endsWith('-MIR')).toBe(true);
  });
});

describe('densityForArc + planArcSchedule', () => {
  it('finale has highest density', () => {
    expect(densityForArc('finale')).toBeGreaterThan(densityForArc('climax'));
    expect(densityForArc('climax')).toBeGreaterThan(densityForArc('build'));
    expect(densityForArc('build')).toBeGreaterThan(densityForArc('intro'));
  });
  it('plan schedule covers full duration with cueCounts > 0', () => {
    const plan = planArcSchedule(['intro', 'build', 'climax', 'finale'], 60);
    expect(plan[0].start).toBe(0);
    expect(plan.at(-1)!.end).toBeCloseTo(60, 5);
    plan.forEach(p => expect(p.cueCount).toBeGreaterThan(0));
  });
  it('empty arc returns single build segment', () => {
    const plan = planArcSchedule([], 10);
    expect(plan).toHaveLength(1);
    expect(plan[0].phase).toBe('build');
  });
});

describe('snapToBeat + beatGrid', () => {
  it('snapToBeat returns time when bpm invalid', () => {
    expect(snapToBeat(1.234, 0)).toBe(1.234);
  });
  it('snapToBeat snaps to subdivision', () => {
    // 120 bpm => beat=0.5s, division=2 => grid=0.25s
    expect(snapToBeat(0.34, 120, 2)).toBeCloseTo(0.25, 5);
  });
  it('beatGrid populates over duration', () => {
    const g = beatGrid(120, 2, 2); // step 0.25, 2s => 8 entries
    expect(g.length).toBe(8);
    expect(g[0]).toBe(0);
  });
  it('beatGrid empty when bpm invalid', () => {
    expect(beatGrid(0, 10)).toEqual([]);
  });
});

describe('effectWindowDuration', () => {
  it('declared duration wins', () => {
    expect(effectWindowDuration('cake', 9)).toBe(9);
  });
  it('cake/candle/gerb defaults', () => {
    expect(effectWindowDuration('cake')).toBe(15);
    expect(effectWindowDuration('candle')).toBe(8);
    expect(effectWindowDuration('gerb')).toBe(20);
    expect(effectWindowDuration('waterfall')).toBe(20);
    expect(effectWindowDuration('flame')).toBe(20);
  });
  it('shells/mines/comets default 4s', () => {
    expect(effectWindowDuration('shell')).toBe(4);
    expect(effectWindowDuration(undefined)).toBe(4);
  });
});
