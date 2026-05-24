/**
 * VDL Timing Adjustment Terms — per-segment LFT / DLY in cake ingredients.
 *
 * Top-level PFT/LFT/DLY/DUR/CDS are already covered by vdlParser tests.
 * This spec locks the per-segment override extraction added in
 * `vdlCakeSegments.parseCakeSegment` (round following the timing doc).
 *
 * Reference: docs/reference/vdl-timing-pft-lft-dly-dur-cds.md
 */
import { describe, it, expect } from 'vitest';
import { parseCakeSegment, parseCakeSegments } from '../vdlCakeSegments';
import { parseVDL } from '../vdlParser';

describe('parseCakeSegment — per-segment LFT/DLY', () => {
  it('defaults LFT/DLY overrides to -1 when absent', () => {
    const s = parseCakeSegment('(a) Gold Tail');
    expect(s.lftOverride).toBe(-1);
    expect(s.dlyOverride).toBe(-1);
  });

  it('parses LFT override and removes it from body', () => {
    const s = parseCakeSegment('(a) 1.6 LFT Red Dahlia w/ Red Tail');
    expect(s.label).toBe('a');
    expect(s.lftOverride).toBeCloseTo(1.6);
    expect(s.body).toBe('Red Dahlia w/ Red Tail');
  });

  it('parses DLY override and removes it from body', () => {
    const s = parseCakeSegment('(c) 0.4 DLY Blue Comet');
    expect(s.dlyOverride).toBeCloseTo(0.4);
    expect(s.body).toBe('Blue Comet');
  });

  it('parses HTM + DUR + LFT + DLY combined', () => {
    const s = parseCakeSegment('(b) 25 HTM 2.3 DUR 1.8 LFT 0.2 DLY Red Mine');
    expect(s.htmOverride).toBe(25);
    expect(s.durOverride).toBeCloseTo(2.3);
    expect(s.lftOverride).toBeCloseTo(1.8);
    expect(s.dlyOverride).toBeCloseTo(0.2);
    expect(s.body).toBe('Red Mine');
  });
});

describe('parseCakeSegments — LFT-on-first-shell override fixture', () => {
  // Doc Figure 3: insert `(a) 1.6 LFT` to override the inherited 0.6 PFT
  // default lift time of the first ingredient only.
  const VDL_FIG3 =
    '30mm 0.6 PFT 11 Shot Cake ' +
    '(a) 1.6 LFT Red Dahlia w/ Red Tail + ' +
    '(b) Green Dahlia w/ Green Tail + ' +
    '(c) Blue Dahlia w/ Blue Tail, 1 Row (abc/FNT)';

  it('only the first ingredient carries the LFT override', () => {
    const r = parseCakeSegments(VDL_FIG3);
    expect(r.segments).toHaveLength(3);
    expect(r.segments[0].label).toBe('a');
    expect(r.segments[0].lftOverride).toBeCloseTo(1.6);
    expect(r.segments[0].body).toBe('Red Dahlia w/ Red Tail');
    expect(r.segments[1].lftOverride).toBe(-1);
    expect(r.segments[2].lftOverride).toBe(-1);
  });

  it('preserves top-level PFT in the parent VDL result', () => {
    const r = parseVDL(VDL_FIG3);
    // Per the doc, 0.6 PFT is below 0.5 threshold... actually 0.6 >= 0.5 so
    // it represents a lift time at the effect level; we only assert that
    // the parser captured it as the prefire value.
    expect(r.prefire).toBeCloseTo(0.6);
    expect(r.cakeSegments).toHaveLength(3);
    expect(r.cakeSegments[0].lftOverride).toBeCloseTo(1.6);
  });
});
