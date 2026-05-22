import { describe, it, expect } from 'vitest';
import { parseWithModifiers } from '../vdlWithModifiers';

describe('parseWithModifiers — VDL With/w/ clauses', () => {
  it('returns [] for empty / no-with strings', () => {
    expect(parseWithModifiers('')).toEqual([]);
    expect(parseWithModifiers('3" Red Peony')).toEqual([]);
  });

  it('classifies "With Mine" as kind=mine', () => {
    const r = parseWithModifiers('Gold Comet With Blue Mine');
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('mine');
    expect(r[0].colorName).toBe('blue');
    expect(r[0].color).toBe('#4c66ff');
  });

  it('classifies "With Bouquet" as kind=bouquet', () => {
    const r = parseWithModifiers('5" Red Peony With Bouquet');
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('bouquet');
  });

  it('classifies shape words as kind=petal with shape', () => {
    const r = parseWithModifiers('Gold Palm With Red Ring');
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('petal');
    expect(r[0].shape).toBe('ring');
    expect(r[0].colorName).toBe('red');
  });

  it('classifies tail-family words as kind=tail', () => {
    const r = parseWithModifiers('Gold Kamuro With Tail');
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('tail');
  });

  it('falls back to mixedStars when only a color/descriptor is present', () => {
    const r = parseWithModifiers('Gold Chrysanthemum With Blue');
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('mixedStars');
    expect(r[0].colorName).toBe('blue');
  });

  it('supports the w/ alias', () => {
    const r = parseWithModifiers('Gold Comet w/ Red Mine');
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('mine');
    expect(r[0].colorName).toBe('red');
  });

  it('skips pistil clauses (owned by parser pistil branch)', () => {
    const r = parseWithModifiers('Red Peony with Gold Pistil');
    expect(r).toEqual([]);
  });

  it('parses multiple With clauses split by + and ,', () => {
    const r = parseWithModifiers(
      'Gold Comet With Red Mine + Silver Palm With Blue Ring, With Tail',
    );
    expect(r).toHaveLength(3);
    expect(r[0].kind).toBe('mine');
    expect(r[0].colorName).toBe('red');
    expect(r[1].kind).toBe('petal');
    expect(r[1].shape).toBe('ring');
    expect(r[1].colorName).toBe('blue');
    expect(r[2].kind).toBe('tail');
  });

  it('mine wins over a co-occurring petal-shape word', () => {
    // ambiguous-ish: "Ring Mine" — Mine is more specific structurally.
    const r = parseWithModifiers('Gold Comet With Ring Mine');
    expect(r[0].kind).toBe('mine');
  });

  it('does not bleed across & boundary', () => {
    const r = parseWithModifiers('Red & Blue Peony With Tail');
    expect(r).toHaveLength(1);
    expect(r[0].kind).toBe('tail');
  });

  it('preserves the original phrase in raw', () => {
    const r = parseWithModifiers('Gold Comet With Red Mine');
    expect(r[0].raw).toBe('Red Mine');
  });
});
