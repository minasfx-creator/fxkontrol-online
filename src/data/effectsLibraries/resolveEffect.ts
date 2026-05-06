/**
 * ─── resolveEffect — Unified effect lookup + VDL render-accurate color ──
 *
 * Single source of truth for the 3D viewport (SkyCanvas, useShowSelectors,
 * ExplosionsLayer, LightPointsLayer) when it needs to translate a
 * `timelineItem.effectId` into a runtime `Effect` ready to be rendered.
 *
 * Two things are unified here:
 *
 *  1) Lookup ─ checks the legacy EFFECT_LIBRARY first, then falls back to
 *     the 527 Finale 3D parts imported via `buildImportedEffects()`. This
 *     means timeline items that reference imported library parts
 *     (`{librarySlug}:{partNumber}`) finally render in the viewport.
 *
 *  2) Color ─ pipes every `effect.color` (legacy + imported) through
 *     `hexToRenderHex` so the on-screen color matches what the LED/pyro
 *     fixture would actually emit (see `vdlColorPipeline`).
 *
 * Memoized: the indexed Map and the per-id LED-accurate effect cache are
 * built once on first call. Color quantization itself is LRU-cached
 * inside `vdlColorPipeline` (cap 256), so re-quantizing the same effect
 * across frames is free.
 *
 * Pure read-only — never touches stores, CommandBus, or Safety.
 */

import { EFFECT_LIBRARY, type Effect } from '@/data/effectLibrary';
import { buildImportedEffects } from '@/data/effectsLibraries/registry';
import { hexToRenderHex } from '@/lib/vdlColorPipeline';

let _index: Map<string, Effect> | null = null;
const _renderCache = new Map<string, Effect>();

function buildIndex(): Map<string, Effect> {
  if (_index) return _index;
  const m = new Map<string, Effect>();
  // Legacy first (lower id collision risk; 527 imports use slug:part keys).
  for (const e of EFFECT_LIBRARY) m.set(e.id, e);
  for (const e of buildImportedEffects()) {
    if (!m.has(e.id)) m.set(e.id, e);
  }
  _index = m;
  return m;
}

/** O(1) lookup across legacy + imported libraries. */
export function resolveEffectRaw(id: string): Effect | undefined {
  return buildIndex().get(id);
}

/**
 * Same as `resolveEffectRaw` but with `color` quantized through the VDL
 * pipeline (LED-accurate). Returns an immutable, memoized clone.
 */
export function resolveEffectLedAccurate(id: string): Effect | undefined {
  const cached = _renderCache.get(id);
  if (cached) return cached;
  const base = resolveEffectRaw(id);
  if (!base) return undefined;
  // Already-VDL-quantized imported effects pass through `hexToRenderHex`
  // idempotently; legacy palette values get normalized to LED output.
  const led: Effect = { ...base, color: hexToRenderHex(base.color) };
  _renderCache.set(id, led);
  return led;
}

/**
 * Quantize a free-form hex (e.g. `timelineItem.colorOverride`) to its
 * LED-accurate render hex. Safe to call every frame.
 */
export function ledAccurateColor(hex: string | undefined, fallback = '#FFD700'): string {
  if (!hex) return hexToRenderHex(fallback);
  return hexToRenderHex(hex);
}

/** Test hook — clears index + render cache. */
export function _resetResolveEffectCache(): void {
  _index = null;
  _renderCache.clear();
}
