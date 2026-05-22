import { describe, it, expect } from 'vitest';
import { resolveEffectThumbKey, EFFECT_THUMBS } from '@/data/effectThumbnails';
import type { Effect } from '@/data/effectLibrary';

const base: Effect = {
  id: 'x', name: 'X', category: 'morteiros', type: 'firework',
  color: '#FFF', duration: 2, cost: 1, icon: '*',
};

describe('resolveEffectThumbKey', () => {
  const cases: Array<[Partial<Effect>, keyof typeof EFFECT_THUMBS | null]> = [
    [{ partType: 'cake' }, 'cake'],
    [{ partType: 'mine', category: 'mines' }, 'mine'],
    [{ partType: 'candle', category: 'roman_candles' }, 'roman_candle'],
    [{ partType: 'shell', pattern: 'peony' }, 'peony'],
    [{ partType: 'shell', pattern: 'palm' }, 'palm'],
    [{ partType: 'shell', pattern: 'kamuro' }, 'palm'],
    [{ partType: 'shell', pattern: 'crossette' }, 'shell_of_shells'],
    [{ partType: 'shell', numDevices: 3 }, 'shell_of_shells'],
    [{ partType: 'shell' }, 'salut_shell'],
    [{ partType: 'comet' }, 'single_comet'],
    [{ partType: 'waterfall', category: 'waterfalls' }, 'fountain'],
    [{ partType: 'gerb' }, 'fountain'],
    [{ partType: 'flame' }, 'bengal'],
    [{ type: 'drone', partType: 'drone' }, null],
    [{ type: 'laser', partType: 'laser' }, null],
  ];

  it.each(cases)('%j → %s', (patch, expected) => {
    expect(resolveEffectThumbKey({ ...base, ...patch })).toBe(expected);
  });

  it('exposes all 10 thumbnail assets', () => {
    expect(Object.keys(EFFECT_THUMBS).sort()).toEqual([
      'bengal', 'cake', 'fountain', 'mine', 'palm', 'peony',
      'roman_candle', 'salut_shell', 'shell_of_shells', 'single_comet',
    ]);
  });
});
