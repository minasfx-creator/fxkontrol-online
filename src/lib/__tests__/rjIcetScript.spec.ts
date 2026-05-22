import { describe, it, expect } from 'vitest';
import {
  buildIcetScript,
  sanitizeIcetTitle,
  secondsToIcetTimecode,
  icetTimecodeToSeconds,
  quantizeAbertura,
  isValidIcetCanal,
  compareIcetCues,
  ICET_MAX_CUES,
  type IcetCue,
} from '@/lib/rjIcetScript';
import type { TimelineItem, Position } from '@/types/projectTypes';

// findEffectById é importado pela lib; mocka via vitest se necessário
import { vi } from 'vitest';
vi.mock('@/data/effectsLibraries/resolveEffect', () => ({
  findEffectById: (id: string) => ({
    id,
    name: `Effect ${id}`,
    type: 'firework',
    duration: 0.45,
  }),
}));

const mkItem = (id: string, t: number): TimelineItem =>
  ({ id, effectId: `fx-${id}`, startTime: t, position: { x: 0, y: 0, z: 0 } } as unknown as TimelineItem);
const mkPos = (name: string): Position =>
  ({ id: name, name, type: 'pyro', x: 0, y: 0, z: 0, heading: 0, pitch: 90 } as unknown as Position);

describe('rjIcetScript — title sanitization', () => {
  it('strips accents and clamps to 20 chars', () => {
    expect(sanitizeIcetTitle('Réveillon Maracanã 2026 Show')).toBe('Reveillon Maracana 2');
  });
  it('falls back to SHOW for empty/invalid input', () => {
    expect(sanitizeIcetTitle('')).toBe('SHOW');
    expect(sanitizeIcetTitle(undefined)).toBe('SHOW');
    expect(sanitizeIcetTitle('   ✨   ')).toBe('SHOW');
  });
});

describe('rjIcetScript — SMPTE non-drop', () => {
  it('formats seconds to HH:MM:SS:FF (30fps)', () => {
    expect(secondsToIcetTimecode(0).tc).toBe('00:00:00:00');
    expect(secondsToIcetTimecode(1.5).tc).toBe('00:00:01:15');
    expect(secondsToIcetTimecode(3661.5).tc).toBe('01:01:01:15');
  });
  it('clamps to 23:59:59:29 with warning', () => {
    const r = secondsToIcetTimecode(24 * 3600);
    expect(r.tc).toBe('23:59:59:29');
    expect(r.warning).toBeDefined();
  });
  it('round-trips through icetTimecodeToSeconds', () => {
    const t = 1234.4;
    const tc = secondsToIcetTimecode(t).tc;
    expect(icetTimecodeToSeconds(tc)).toBeCloseTo(Math.floor(t * 30) / 30, 5);
  });
  it('rejects invalid timecode strings', () => {
    expect(() => icetTimecodeToSeconds('99:99:99:99')).toThrow(/Formato de timecode/);
    expect(() => icetTimecodeToSeconds('00:00:00:30')).toThrow(/Formato de timecode/);
  });
});

describe('rjIcetScript — abertura quantization', () => {
  it('snaps to multiples of 100ms within range', () => {
    expect(quantizeAbertura(247, 100, 9900)).toEqual({ value: 200, snapped: true });
    expect(quantizeAbertura(450, 100, 9900)).toEqual({ value: 500, snapped: true });
    expect(quantizeAbertura(500, 100, 9900)).toEqual({ value: 500, snapped: false });
  });
  it('clamps to min/max bounds', () => {
    expect(quantizeAbertura(50, 100, 9900).value).toBe(100);
    expect(quantizeAbertura(20000, 100, 9900).value).toBe(9900);
  });
});

describe('rjIcetScript — canal validation', () => {
  it('accepts 1..32 and C/F/S', () => {
    expect(isValidIcetCanal(1)).toBe(true);
    expect(isValidIcetCanal(32)).toBe(true);
    expect(isValidIcetCanal('C')).toBe(true);
    expect(isValidIcetCanal('F')).toBe(true);
    expect(isValidIcetCanal('S')).toBe(true);
  });
  it('rejects 0, 33, non-special letters', () => {
    expect(isValidIcetCanal(0)).toBe(false);
    expect(isValidIcetCanal(33)).toBe(false);
    expect(isValidIcetCanal('X' as 'C')).toBe(false);
  });
});

describe('rjIcetScript — canonical ordering', () => {
  it('sorts timecode ASC, modulo ASC, canal ASC (numbers before C/F/S)', () => {
    const cues: IcetCue[] = [
      { timecode: '00:00:01:00', modulo: 2, canal: 1, abertura: 200, seq: 0 },
      { timecode: '00:00:00:00', modulo: 1, canal: 'C', abertura: 200, seq: 0 },
      { timecode: '00:00:00:00', modulo: 1, canal: 5, abertura: 200, seq: 0 },
      { timecode: '00:00:00:00', modulo: 1, canal: 1, abertura: 200, seq: 0 },
    ];
    cues.sort(compareIcetCues);
    expect(cues.map(c => `${c.timecode}/${c.modulo}/${c.canal}`)).toEqual([
      '00:00:00:00/1/1',
      '00:00:00:00/1/5',
      '00:00:00:00/1/C',
      '00:00:01:00/2/1',
    ]);
  });
});

describe('rjIcetScript — buildIcetScript end-to-end', () => {
  it('emits 4-column header, correct ordering, snaps abertura to 500ms', () => {
    const items = [mkItem('a', 1.2), mkItem('b', 0.5), mkItem('c', 0.0)];
    const r = buildIcetScript(items, [mkPos('P1')], { title: 'Test Show' });

    const lines = r.csv.split('\n');
    expect(lines[0]).toBe('timecode,modulo,canal,abertura');
    expect(lines.length).toBe(4);
    // ordered by timecode
    expect(lines[1]).toMatch(/^00:00:00:00,1,1,500$/);
    expect(lines[2]).toMatch(/^00:00:00:15,1,2,500$/);
    expect(lines[3]).toMatch(/^00:00:01:06,1,3,500$/);
    expect(r.errors).toHaveLength(0);
    // duration 0.45s → 450ms snaps to 500ms (1 snap warning per cue)
    expect(r.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('caps at 9999 cues and reports truncation', () => {
    const many = Array.from({ length: ICET_MAX_CUES + 5 }, (_, i) => mkItem(`x${i}`, i * 0.01));
    const r = buildIcetScript(many, [], { title: 'BIG' });
    expect(r.truncated).toBe(true);
    expect(r.cues.length).toBe(ICET_MAX_CUES);
    expect(r.warnings.some(w => /9999/.test(w))).toBe(true);
  });

  it('emits modulo overflow error past channel 99*32', () => {
    // canalsPerModulo=2, 200 cues → modulo would reach 100 → error
    const items = Array.from({ length: 200 }, (_, i) => mkItem(`x${i}`, i * 0.01));
    const r = buildIcetScript(items, [], { canalsPerModulo: 2 });
    expect(r.errors.some(e => /modulo/.test(e))).toBe(true);
  });

  it('supports semicolon separator', () => {
    const r = buildIcetScript([mkItem('a', 0)], [], { separator: ';' });
    expect(r.csv.split('\n')[0]).toBe('timecode;modulo;canal;abertura');
  });
});
