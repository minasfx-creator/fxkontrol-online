/**
 * effectsLibraryE2E.spec — total coverage E2E (pipeline + spawn).
 *
 * Parametrises over the entire merged catalog (Curated + FWsim + Finale
 * libraries ≈ 800+ effects) and asserts each entry:
 *   1. has a non-empty id and name
 *   2. has a color string that the VDL resolver can quantize to a valid hex
 *   3. routes to a real renderer (mirrors TimelineEffects routing)
 *   4. expected spawn count is > 0
 *
 * Reports a structured manifest at the end so regressions are easy to diff.
 * No JSX / no GPU — runs in jsdom in CI.
 */
import { describe, it, expect } from 'vitest';
import { getMergedEffectsCatalog } from '@/data/effectsLibraries/registry';
import { resolveEffectColorHex } from '@/data/effectsLibraries/colorResolver';
import { routeEffect } from '@/lib/effectRouter';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

describe('effects library — full E2E pipeline+spawn coverage', () => {
  const catalog = getMergedEffectsCatalog();

  it('catalog is non-empty', () => {
    expect(catalog.entries.length).toBeGreaterThan(100);
  });

  it('every effect has id, name, color, and resolves to valid renderHex', () => {
    const bad: Array<{ id: string; reason: string }> = [];
    for (const { effect } of catalog.entries) {
      if (!effect.id) bad.push({ id: '(empty)', reason: 'missing id' });
      else if (!effect.name) bad.push({ id: effect.id, reason: 'missing name' });
      else if (!effect.color) bad.push({ id: effect.id, reason: 'missing color' });
      else {
        const hex = resolveEffectColorHex(effect.color);
        if (!HEX_RE.test(hex)) bad.push({ id: effect.id, reason: `bad hex from "${effect.color}" → "${hex}"` });
      }
    }
    if (bad.length) {
      // eslint-disable-next-line no-console
      console.error('[E2E] color/identity failures:', bad.slice(0, 30));
    }
    expect(bad).toEqual([]);
  });

  it('every effect routes to a real renderer (spawn > 0)', () => {
    const fallbacks: Array<{ id: string; reason: string }> = [];
    const lowSpawn: Array<{ id: string; spawn: number }> = [];
    for (const { effect } of catalog.entries) {
      const r = routeEffect(effect);
      if (r.isFallback) fallbacks.push({ id: effect.id, reason: r.reason });
      else if (r.expectedSpawn <= 0) lowSpawn.push({ id: effect.id, spawn: r.expectedSpawn });
    }
    if (fallbacks.length) {
      // eslint-disable-next-line no-console
      console.error('[E2E] routing fallbacks (would render LightPoint stub):', fallbacks.slice(0, 30));
    }
    if (lowSpawn.length) {
      // eslint-disable-next-line no-console
      console.error('[E2E] low/zero spawn:', lowSpawn.slice(0, 30));
    }
    expect(fallbacks).toEqual([]);
    expect(lowSpawn).toEqual([]);
  });

  it('produces a per-kind histogram (visible in test output)', () => {
    const hist: Record<string, number> = {};
    for (const { effect } of catalog.entries) {
      const k = routeEffect(effect).kind;
      hist[k] = (hist[k] || 0) + 1;
    }
    // eslint-disable-next-line no-console
    console.log('[E2E] renderer histogram:', hist, '(total', catalog.entries.length, ')');
    expect(Object.keys(hist).length).toBeGreaterThan(3);
  });
});
