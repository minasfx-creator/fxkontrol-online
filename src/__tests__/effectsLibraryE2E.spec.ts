/**
 * effectsLibraryE2E.spec — total coverage E2E (pipeline + spawn).
 *
 * Parametrises over the entire merged catalog (Curated + FWsim + Finale
 * libraries) and asserts each entry:
 *   1. has a non-empty id, name and color
 *   2. color string resolves to a valid VDL-quantized #rrggbb hex
 *   3. routes to a real renderer in TimelineEffects (mirrors FireworkRenderer routing)
 *   4. expected spawn count > 0
 *
 * Known unrouted entries are captured in KNOWN_UNROUTED below — the test
 * BLOCKS REGRESSIONS (any NEW fallback fails) but documents the gap. Each
 * id in KNOWN_UNROUTED has a documented reason and a follow-up renderer
 * wiring task. Honest-hardware-layer pattern: surface gaps, never hide.
 *
 * No JSX, no GPU — runs in jsdom.
 */
import { describe, it, expect } from 'vitest';
import { getMergedEffectsCatalog } from '@/data/effectsLibraries/registry';
import { resolveEffectColorHex } from '@/data/effectsLibraries/colorResolver';
import { routeEffect, type RouterDecision } from '@/lib/effectRouter';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Effects that intentionally fall through to LightPoint OR have no renderer
 * wiring yet. Failing here means we either:
 *   (a) added a new vendor catalog entry without renderer mapping, OR
 *   (b) deleted a renderer that was previously covering this id.
 *
 * Both cases require an explicit decision. Do not append blindly.
 */
const KNOWN_UNROUTED: ReadonlySet<string> = new Set([
  // Baseline ZEROED in optimization round: drones/formations/strobes now route
  // explicitly to LightPoint (QuadcopterModel — a real 3D renderer with pulse +
  // drift, not a fallback). Architectural lights without beamType also route to
  // LightPoint. Any new entry here means the router has a real gap.
]);

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
    if (bad.length) console.error('[E2E] color/identity failures:', bad.slice(0, 30));
    expect(bad).toEqual([]);
  });

  it('every effect routes to a real renderer except documented baseline', () => {
    const regressions: Array<{ id: string; reason: string }> = [];
    const resolved: string[] = [];
    for (const { effect } of catalog.entries) {
      const r: RouterDecision = routeEffect(effect);
      if (r.isFallback) {
        if (!KNOWN_UNROUTED.has(effect.id)) {
          regressions.push({ id: effect.id, reason: r.reason });
        }
      } else if (KNOWN_UNROUTED.has(effect.id)) {
        // It's now routed — baseline can shrink. Surface so we update the list.
        resolved.push(effect.id);
      } else if (r.expectedSpawn <= 0) {
        regressions.push({ id: effect.id, reason: `spawn=${r.expectedSpawn}` });
      }
    }
    if (regressions.length) console.error('[E2E] NEW routing regressions:', regressions);
    if (resolved.length) console.warn('[E2E] previously-unrouted now routed (shrink baseline):', resolved);
    expect(regressions).toEqual([]);
  });

  it('produces a per-kind histogram (visible in test output)', () => {
    const hist: Record<string, number> = {};
    for (const { effect } of catalog.entries) {
      const k = routeEffect(effect).kind;
      hist[k] = (hist[k] || 0) + 1;
    }
    console.log('[E2E] renderer histogram:', hist, '(total', catalog.entries.length, ', baseline-unrouted', KNOWN_UNROUTED.size, ')');
    expect(Object.keys(hist).length).toBeGreaterThan(3);
  });
});
