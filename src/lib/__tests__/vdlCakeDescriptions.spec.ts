import { describe, it, expect } from 'vitest';
import {
  parseCakeDescription,
  parseFiringDescription,
  isCakeDescription,
} from '../vdlCakeDescriptions';

describe('vdlCakeDescriptions — parseFiringDescription', () => {
  it('parses delay + labels + pattern', () => {
    const r = parseFiringDescription('0.5/abababa/FNT');
    expect(r.delayMs).toBe(500);
    expect(r.durationMs).toBe(-1);
    expect(r.tubeLabels).toEqual(['a', 'b', 'a', 'b', 'a', 'b', 'a']);
    expect(r.pattern).toBe('FNT');
    expect(r.parallel).toBe(false);
  });

  it('parses labels-only', () => {
    const r = parseFiringDescription('ababababa');
    expect(r.delayMs).toBe(-1);
    expect(r.durationMs).toBe(-1);
    expect(r.tubeLabels).toHaveLength(9);
    expect(r.pattern).toBe('');
  });

  it('parses delay + labels + pattern + duration', () => {
    const r = parseFiringDescription('0.2/ababababa/FNR/0.75');
    expect(r.delayMs).toBe(200);
    expect(r.durationMs).toBe(750);
    expect(r.pattern).toBe('FNR');
  });

  it('handles parallel asterisk', () => {
    const r = parseFiringDescription('aaaaaaaaaa*');
    expect(r.parallel).toBe(true);
    expect(r.tubeLabels).toHaveLength(10);
  });

  it('handles delay + labels + pattern + duration + asterisk', () => {
    const r = parseFiringDescription('0.2/ababababa/FNR/0.75*');
    expect(r.parallel).toBe(true);
    expect(r.delayMs).toBe(200);
    expect(r.durationMs).toBe(750);
    expect(r.pattern).toBe('FNR');
  });
});

describe('vdlCakeDescriptions — parseCakeDescription', () => {
  it('returns null for non-cake input', () => {
    expect(parseCakeDescription('5" Red Peony')).toBeNull();
  });

  it('detects simple cake', () => {
    const d = parseCakeDescription('49 Shot 5s Cake');
    expect(d).not.toBeNull();
    expect(isCakeDescription('49 Shot 5s Cake')).toBe(true);
    expect(d!.rowSpecs).toHaveLength(0);
    expect(d!.declaredRowCount).toBe(0);
  });

  it('parses canonical zipper example', () => {
    const input =
      '30mm 49 Shot 5s (a) Red Pearl + (b) Blue Pearl Cake Z-Shape, 7 Rows, Row 1,3,5 (aaaaaaa), Row 2,4,6 (bbbbbbb), Row 7 (1.2/abababa/FNT)';
    const d = parseCakeDescription(input);
    expect(d).not.toBeNull();
    expect(d!.declaredRowCount).toBe(7);
    expect(d!.bodyFiringPattern).toBe('Z-Shape');
    expect(d!.ingredients.map((i) => i.label)).toEqual(['a', 'b']);
    expect(d!.ingredients[0].body).toMatch(/Red Pearl/);
    expect(d!.ingredients[1].body).toMatch(/Blue Pearl/);
    expect(d!.rowSpecs).toHaveLength(3);
    expect(d!.rowSpecs[0].rows).toEqual([1, 3, 5]);
    expect(d!.rowSpecs[0].firing!.tubeLabels.join('')).toBe('aaaaaaa');
    expect(d!.rowSpecs[1].rows).toEqual([2, 4, 6]);
    expect(d!.rowSpecs[2].rows).toEqual([7]);
    expect(d!.rowSpecs[2].firing!.delayMs).toBe(1200);
    expect(d!.rowSpecs[2].firing!.pattern).toBe('FNT');
    expect(d!.rowSpecs[2].firing!.tubeLabels.join('')).toBe('abababa');
  });

  it('expands row range notation', () => {
    const d = parseCakeDescription('20 Shot Cake 4 Rows, Row 1-3 (aaaaa), Row 4 (bbbbb)');
    expect(d!.rowSpecs[0].rows).toEqual([1, 2, 3]);
    expect(d!.rowSpecs[1].rows).toEqual([4]);
  });

  it('parses parallel asterisk row spec', () => {
    const d = parseCakeDescription(
      '40 Shot 20s (a) Red Pearl + (b) Blue Pearl Cake 4 Rows, Row 1,3 (aaaaaaaaaa/ARL), Row 2,4 (bbbbbbbbbb/ALL*)',
    );
    expect(d!.rowSpecs).toHaveLength(2);
    expect(d!.rowSpecs[1].firing!.parallel).toBe(true);
    expect(d!.rowSpecs[1].firing!.pattern).toBe('ALL');
  });

  it('parses no-delay-on-first-row example raw value', () => {
    const d = parseCakeDescription(
      '2" 8.57s 30 Shot (a) Red Comet Cake, 6 Rows, Rows 1,2,3,4,5 (0.3/aaaaa/STR/1.2), Row 6 (1.37/aaaaa/STT)',
    );
    expect(d!.declaredRowCount).toBe(6);
    expect(d!.rowSpecs[0].rows).toEqual([1, 2, 3, 4, 5]);
    expect(d!.rowSpecs[0].firing!.delayMs).toBe(300);
    expect(d!.rowSpecs[0].firing!.durationMs).toBe(1200);
    expect(d!.rowSpecs[0].firing!.pattern).toBe('STR');
    expect(d!.rowSpecs[1].rows).toEqual([6]);
    expect(d!.rowSpecs[1].firing!.delayMs).toBe(1370);
    expect(d!.rowSpecs[1].firing!.pattern).toBe('STT');
  });

  it('handles row spec without parens', () => {
    const d = parseCakeDescription('10 Shot Peony Cake 3 Rows, Row 1 (aaa), Row 2 (aaaa), Row 3 (aaa)');
    expect(d!.declaredRowCount).toBe(3);
    expect(d!.rowSpecs.map((r) => r.firing!.tubeLabels.length)).toEqual([3, 4, 3]);
  });
});
