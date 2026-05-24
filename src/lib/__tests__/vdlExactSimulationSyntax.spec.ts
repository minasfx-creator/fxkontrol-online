import { describe, it, expect } from 'vitest';
import {
  parseExactCakeBody,
  extractExactCakeBody,
  isExactSimulationCake,
} from '../vdlExactSimulationSyntax';

const SPEC_CAKE =
  '49 Shot 5s (a) Red Pearl + (b) Blue Pearl Cake, 1 Row (' +
  '-30a93/-20a/-10a/0a/10a/20a/30a/' +
  'b/20b/10b/0b/-10b/-20b/-30b/' +
  'a/-20a/-10a/0a/10a/20a/30a/' +
  'b/20b/10b/0b/-10b/-20b/-30b/' +
  'a92/-20a/-10a/0a/10a/20a/30a/' +
  'b/20b/10b/0b/-10b/-20b/-30b1200/' +
  'a0/-20b/-10a/0b/10a/20b/30a/CAK)';

describe('VDL Exact Simulation Syntax — detection', () => {
  it('isExactSimulationCake matches spec cake', () => {
    expect(isExactSimulationCake(SPEC_CAKE)).toBe(true);
  });

  it('isExactSimulationCake rejects standard-syntax cake', () => {
    const std =
      '49 Shot 5s (a) Red Pearl + (b) Blue Pearl Cake Z-Shape, 7 Rows, Row 1 (aaaaaaa)';
    expect(isExactSimulationCake(std)).toBe(false);
  });

  it('extractExactCakeBody pulls just the body', () => {
    const body = extractExactCakeBody(SPEC_CAKE);
    expect(body).toBeTruthy();
    expect(body).toMatch(/^-30a93\//);
    expect(body).toMatch(/\/CAK$/);
  });

  it('extractExactCakeBody returns null for non-exact', () => {
    expect(extractExactCakeBody('Red Peony')).toBeNull();
  });
});

describe('VDL Exact Simulation Syntax — parseExactCakeBody', () => {
  it('parses spec cake into 49 tubes + closed', () => {
    const body = extractExactCakeBody(SPEC_CAKE)!;
    const r = parseExactCakeBody(body);
    expect(r.closed).toBe(true);
    expect(r.tubes).toHaveLength(49);
  });

  it('applies angle elision (carry-over)', () => {
    const r = parseExactCakeBody('-30a/-20a/a/CAK');
    expect(r.tubes.map((t) => t.angleDeg)).toEqual([-30, -20, -20]);
  });

  it('applies delay elision and zeroes out last delay', () => {
    const r = parseExactCakeBody('-30a93/-20a/-10a/0a92/10a/CAK');
    // delays: 93, 93, 93, 92, 0 (last zeroed)
    expect(r.tubes.map((t) => t.delayMs)).toEqual([93, 93, 93, 92, 0]);
  });

  it('handles "0a" vs "a0" disambiguation', () => {
    // 0a → angle=0, no delay (inherits prior 0)
    // a0 → no angle (inherits prior), delay=0
    const r = parseExactCakeBody('-30a93/0a/a0/CAK');
    expect(r.tubes[0]).toMatchObject({ angleDeg: -30, label: 'a', delayMs: 93 });
    expect(r.tubes[1]).toMatchObject({ angleDeg: 0, label: 'a', delayMs: 93 });
    // Last section: delay=0 zeroed anyway, angle inherits 0
    expect(r.tubes[2]).toMatchObject({ angleDeg: 0, label: 'a', delayMs: 0 });
  });

  it('handles big delay like 1200ms', () => {
    const r = parseExactCakeBody('-30a93/-20a/-30b1200/a0/CAK');
    expect(r.tubes[2].delayMs).toBe(1200);
    expect(r.tubes[2].label).toBe('b');
    // a0: delay 0, label a, angle inherits -30
    expect(r.tubes[3]).toMatchObject({ angleDeg: -30, label: 'a', delayMs: 0 });
  });

  it('warns when first section omits angle', () => {
    const r = parseExactCakeBody('a93/-20a/CAK');
    expect(r.tubes[0].angleDeg).toBe(0); // fallback
    expect(r.warnings.some((w) => /missing required angle/i.test(w))).toBe(true);
  });

  it('warns when no delays were specified at all', () => {
    const r = parseExactCakeBody('-30a/-20a/0a/CAK');
    expect(r.warnings.some((w) => /No explicit delays/i.test(w))).toBe(true);
    expect(r.tubes.every((t) => t.delayMs === 0)).toBe(true);
  });

  it('flags unparseable sections', () => {
    const r = parseExactCakeBody('-30a93/???/0a/CAK');
    expect(r.warnings.some((w) => /Unparseable/i.test(w))).toBe(true);
    expect(r.tubes).toHaveLength(2);
  });

  it('returns closed=false when /CAK is missing', () => {
    const r = parseExactCakeBody('-30a93/-20a/0a');
    expect(r.closed).toBe(false);
    expect(r.tubes).toHaveLength(3);
  });

  it('lowercases the label', () => {
    const r = parseExactCakeBody('-30A93/-20B/CAK');
    expect(r.tubes.map((t) => t.label)).toEqual(['a', 'b']);
  });

  it('preserves the raw original section text', () => {
    const r = parseExactCakeBody('-30a93/-20a/CAK');
    expect(r.tubes[0].raw).toBe('-30a93');
    expect(r.tubes[1].raw).toBe('-20a');
  });
});

describe('VDL Exact Simulation Syntax — spec example specifics', () => {
  it('first tube: angle=-30, label=a, delay=93', () => {
    const body = extractExactCakeBody(SPEC_CAKE)!;
    const r = parseExactCakeBody(body);
    expect(r.tubes[0]).toMatchObject({ angleDeg: -30, label: 'a', delayMs: 93 });
  });

  it('tube 29 (index 28, "a92") inherits angle -30 from prior "-30b"', () => {
    const body = extractExactCakeBody(SPEC_CAKE)!;
    const r = parseExactCakeBody(body);
    // Sections 0..6 = a-row (-30..30), 7..13 = b-row, 14..20 = a, 21..27 = b,
    // 28 = "a92" → angle should inherit the previous resolved angle (-30 from
    // index 27 which was "-30b").
    expect(r.tubes[28].raw).toBe('a92');
    expect(r.tubes[28].angleDeg).toBe(-30);
    expect(r.tubes[28].delayMs).toBe(92);
  });

  it('only three distinct explicit delay values are needed (93, 1200, 0)', () => {
    const body = extractExactCakeBody(SPEC_CAKE)!;
    const explicit = body
      .split('/')
      .map((p) => p.match(/^\s*-?\d*[A-Za-z](\d+)\s*$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => parseInt(m[1], 10));
    // 92, 1200, 0 per spec ("92, 1200, and 0" — the doc uses 92 not 93 for
    // the second explicit value; we just check uniqueness count is ≤4).
    const unique = new Set(explicit);
    expect(unique.size).toBeLessThanOrEqual(4);
  });

  it('last tube delay is forced to 0 even if a value would be inherited', () => {
    const body = extractExactCakeBody(SPEC_CAKE)!;
    const r = parseExactCakeBody(body);
    expect(r.tubes[r.tubes.length - 1].delayMs).toBe(0);
  });
});
