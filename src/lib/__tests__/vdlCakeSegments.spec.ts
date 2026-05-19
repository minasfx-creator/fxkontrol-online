import { describe, it, expect } from 'vitest';
import { parseCakeSegment, parseCakeSegments } from '../vdlCakeSegments';
import { parseVDL } from '../vdlParser';

describe('parseCakeSegment', () => {
  it('returns empty defaults for blank input', () => {
    expect(parseCakeSegment('')).toEqual({
      label: '', body: '',
      htmOverride: -1, durOverride: -1,
      lftOverride: -1, dlyOverride: -1,
    });
  });

  it('strips (label) prefix', () => {
    const s = parseCakeSegment('(a) Gold Tail');
    expect(s.label).toBe('a');
    expect(s.body).toBe('Gold Tail');
    expect(s.htmOverride).toBe(-1);
    expect(s.durOverride).toBe(-1);
  });

  it('parses DUR override and removes it from body', () => {
    const s = parseCakeSegment('(b) 2.3 DUR Red Mine');
    expect(s.label).toBe('b');
    expect(s.durOverride).toBeCloseTo(2.3);
    expect(s.body).toBe('Red Mine');
  });

  it('parses HTM override and removes it from body', () => {
    const s = parseCakeSegment('(b) 25 HTM Red Mine');
    expect(s.htmOverride).toBe(25);
    expect(s.body).toBe('Red Mine');
  });

  it('parses HTM + DUR combined', () => {
    const s = parseCakeSegment('(b) 25 HTM 2.3 DUR Red Mine');
    expect(s.htmOverride).toBe(25);
    expect(s.durOverride).toBeCloseTo(2.3);
    expect(s.body).toBe('Red Mine');
  });
});

describe('parseCakeSegments', () => {
  it('returns empty for non-cake input', () => {
    expect(parseCakeSegments('Red Peony')).toEqual({ fanAngleDeg: -1, segments: [] });
  });

  it('extracts Degrees from cake header', () => {
    const r = parseCakeSegments(
      '50mm 10s 100 Shot 100m 130 Degrees Fan Cake (a) Gold Tail + (b) Red Mine 10 Rows Row 1,2,3 (abab)'
    );
    expect(r.fanAngleDeg).toBe(130);
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0]).toMatchObject({ label: 'a', body: 'Gold Tail' });
    expect(r.segments[1]).toMatchObject({ label: 'b', body: 'Red Mine' });
  });

  it('splits ingredients and applies per-segment HTM + DUR', () => {
    const r = parseCakeSegments(
      '50mm 10s 100 Shot 100m Fan Cake (a) Gold Tail + (b) 25 HTM 2.3 DUR Red Mine 10 Rows Row 1 (a)'
    );
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0].htmOverride).toBe(-1);
    expect(r.segments[0].durOverride).toBe(-1);
    expect(r.segments[1].htmOverride).toBe(25);
    expect(r.segments[1].durOverride).toBeCloseTo(2.3);
  });

  it('drops the Rows block from the last segment body', () => {
    const r = parseCakeSegments(
      '100 Shot 100m Fan Cake (a) Red Peony + (b) Blue Peony 10 Rows Row 1,2 (ab)'
    );
    expect(r.segments.map((s) => s.body)).toEqual(['Red Peony', 'Blue Peony']);
  });

  it('handles `+` without labels', () => {
    const r = parseCakeSegments('50 Shot Fan Cake Red Peony + Blue Peony 5 Rows Row 1 (a)');
    expect(r.segments).toHaveLength(2);
    expect(r.segments[0].body).toBe('Red Peony');
    expect(r.segments[1].body).toBe('Blue Peony');
  });
});

describe('parseVDL — HTM/DUR/Degrees integration', () => {
  it('exposes htmOverride and fanAngleDeg at top level', () => {
    const r = parseVDL('50mm 10s 100 Shot 100m 130 Degrees Fan Cake (a) Gold Tail + (b) 25 HTM Red Mine 10 Rows Row 1 (a)');
    expect(r.fanAngleDeg).toBe(130);
    expect(r.cakeSegments).toHaveLength(2);
    expect(r.cakeSegments[1].htmOverride).toBe(25);
  });

  it('top-level HTM overrides the legacy <N>m height term', () => {
    const r = parseVDL('3" 25 HTM Red Mine');
    expect(r.htmOverride).toBe(25);
    expect(r.height).toBe(25);
  });

  it('keeps backwards-compatible durOverride for top-level DUR', () => {
    const r = parseVDL('3" 2.3 DUR Red Peony');
    expect(r.durOverride).toBeCloseTo(2.3);
    expect(r.duration).toBeCloseTo(2.3);
  });

  it('cakeSegments empty for non-cake VDL', () => {
    const r = parseVDL('3" Red Peony');
    expect(r.cakeSegments).toEqual([]);
    expect(r.fanAngleDeg).toBe(-1);
  });
});
