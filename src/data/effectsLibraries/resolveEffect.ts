/**
 * resolveEffect — canonical unified Effect lookup across all 5 sources.
 *
 * Precedence (first-wins): curated EFFECT_LIBRARY > FWsim builtin > FWE Mine
 * catalog > Standard Effects > Finale parts. Memoised singleton Map.
 *
 * Also exposes `resolveEffectLedAccurate(id)` which quantizes color/secondaryColor
 * to the VDL palette so renderer matches LED behavior.
 */

import type { Effect } from '@/data/effectLibrary';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { FWSIM_BUILTIN_EFFECTS } from '@/data/fwsimBuiltinPresets';
import { FWE_MINE_EFFECTS } from '@/data/fweMineCatalog';
import { getStandardEffects } from '@/data/standardEffectsCatalog';
import { getFinaleEffects } from './registry';
import { rgbToNearestVdl } from '@/lib/vdlQuantizer';

let _byId: Map<string, Effect> | null = null;
let _ledCache: Map<string, Effect> | null = null;

function buildIndex(): Map<string, Effect> {
  const map = new Map<string, Effect>();
  const sources: Effect[][] = [
    EFFECT_LIBRARY,
    FWSIM_BUILTIN_EFFECTS,
    FWE_MINE_EFFECTS,
    getStandardEffects(),
    getFinaleEffects(),
  ];
  for (const list of sources) {
    for (const e of list) {
      if (!e || !e.id) continue;
      if (!map.has(e.id)) map.set(e.id, e);
    }
  }
  return map;
}

function index(): Map<string, Effect> {
  if (!_byId) _byId = buildIndex();
  return _byId;
}

export function findEffectById(id: string | undefined | null): Effect | undefined {
  if (!id) return undefined;
  return index().get(id);
}

export function getAllEffects(): Effect[] {
  return Array.from(index().values());
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const h = hex.trim().replace(/^#/, '');
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

export function ledAccurateColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const m = rgbToNearestVdl(rgb.r, rgb.g, rgb.b);
  return m?.hex ?? hex;
}

export function resolveEffectLedAccurate(id: string | undefined | null): Effect | undefined {
  const base = findEffectById(id);
  if (!base) return undefined;
  if (!_ledCache) _ledCache = new Map();
  const cached = _ledCache.get(base.id);
  if (cached) return cached;
  const next: Effect = { ...base };
  if (base.color) next.color = ledAccurateColor(base.color);
  const sec = (base as any).secondaryColor as string | undefined;
  if (sec) (next as any).secondaryColor = ledAccurateColor(sec);
  _ledCache.set(base.id, next);
  return next;
}

/** Test-only: drops memoised caches. */
export function __resetResolveEffectCache(): void {
  _byId = null;
  _ledCache = null;
}
