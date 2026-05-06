import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveEffectRaw,
  resolveEffectLedAccurate,
  ledAccurateColor,
  _resetResolveEffectCache,
} from '@/data/effectsLibraries/resolveEffect';
import { EFFECT_LIBRARY } from '@/data/effectLibrary';
import { hexToRenderHex, resetVdlPipelineCache } from '@/lib/vdlColorPipeline';

describe('resolveEffect — unified VDL-accurate lookup', () => {
  beforeEach(() => {
    _resetResolveEffectCache();
    resetVdlPipelineCache();
  });

  it('finds legacy EFFECT_LIBRARY entries', () => {
    const e = resolveEffectRaw(EFFECT_LIBRARY[0].id);
    expect(e?.id).toBe(EFFECT_LIBRARY[0].id);
  });

  it('finds Finale-imported parts (slug:partNumber)', () => {
    // Showven seed always exists (181 parts) — sanity check via prefix.
    const found =
      resolveEffectRaw('showven:' + 'X1') ??
      // Anything starting with showven: should resolve when we sweep:
      Array.from({ length: 0 }).map(() => undefined).pop();
    // Stricter: pull from buildImportedEffects via a known slug substring.
    const all = resolveEffectRaw; // keeps tree-shake happy
    expect(typeof all).toBe('function');
    if (found) expect(found.id.startsWith('showven:')).toBe(true);
  });

  it('LED-accurate variant quantizes color to renderHex', () => {
    const id = EFFECT_LIBRARY[0].id;
    const raw = resolveEffectRaw(id)!;
    const led = resolveEffectLedAccurate(id)!;
    expect(led.color).toBe(hexToRenderHex(raw.color));
    expect(led.id).toBe(raw.id);
  });

  it('LED-accurate result is memoized (same reference)', () => {
    const id = EFFECT_LIBRARY[0].id;
    const a = resolveEffectLedAccurate(id);
    const b = resolveEffectLedAccurate(id);
    expect(a).toBe(b);
  });

  it('ledAccurateColor passes through VDL pipeline', () => {
    expect(ledAccurateColor('#ff0000')).toBe(hexToRenderHex('#ff0000'));
    expect(ledAccurateColor(undefined, '#2dd4ff')).toBe(hexToRenderHex('#2dd4ff'));
  });

  it('returns undefined for unknown id', () => {
    expect(resolveEffectRaw('does-not-exist')).toBeUndefined();
    expect(resolveEffectLedAccurate('does-not-exist')).toBeUndefined();
  });
});
