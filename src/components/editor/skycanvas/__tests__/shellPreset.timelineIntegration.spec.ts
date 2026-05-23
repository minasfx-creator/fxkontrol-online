/**
 * Integration test — rev6 ShellPreset pipeline
 * ---------------------------------------------
 * Verifies that for EVERY rev6 preset the full chain works end-to-end:
 *
 *   sidebar Effect  ──►  resolveShellPresetId  ──►  resolveShellPresetProps
 *                                                          │
 *                                                          ▼
 *                                          FireworkRenderer-renderable spec
 *                                          (color, pattern, geometry, ascent…)
 *
 * The timeline-side resolution mirrors the exact expression used in
 * `TimelineEffects` (FireworkRenderer.tsx), so any drift between the
 * sidebar id (`finale-shell-<id>`), the canonical preset table, and the
 * renderer will fail this suite.
 */
import { describe, it, expect } from 'vitest';
import {
  FINALE_SHELL_PRESETS,
  resolveShellPresetId,
  resolveShellPresetProps,
  type ShellPreset,
} from '@/data/finalePresets';
import {
  FINALE_REV6_SHELL_PRESET_IDS,
  FINALE_REV6_SHELL_EFFECTS,
  finaleShellPresetToEffect,
} from '@/data/finaleShellPresetEffects';

/** Mirrors the resolver chain used inside `TimelineEffects` (FireworkRenderer). */
function timelineResolveShellPresetId(effect: {
  id: string;
  name?: string;
  presetId?: string;
}): string | undefined {
  return (
    effect.presetId ??
    resolveShellPresetId(effect.name ?? '') ??
    (effect.id.startsWith('finale-shell-')
      ? effect.id.slice('finale-shell-'.length)
      : undefined)
  );
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const HANDLED_GEOMETRIES = new Set<ShellPreset['geometry']>([
  'sphere',
  'ring',
  'heart',
  'custom-shape',
  'hemisphere',
  'inverted-hemisphere',
]);

describe('rev6 ShellPreset — timeline + particle integration', () => {
  it('exports exactly the 9 canonical rev6 ids', () => {
    expect(FINALE_REV6_SHELL_PRESET_IDS).toEqual([
      'ring',
      'double-ring',
      'saturn-ring',
      'heart',
      'smiley',
      'bow-tie',
      'cluster-diadem',
      'jellyfish',
      'half-half',
    ]);
    expect(FINALE_REV6_SHELL_EFFECTS).toHaveLength(9);
  });

  describe.each(FINALE_REV6_SHELL_PRESET_IDS)('preset %s', (presetId) => {
    const preset = FINALE_SHELL_PRESETS[presetId]!;
    const effect = finaleShellPresetToEffect(preset);

    it('canonical preset row is well-formed', () => {
      expect(preset).toBeDefined();
      expect(preset.id).toBe(presetId);
      expect(preset.colorHex).toMatch(HEX_RE);
      expect(preset.count).toBeGreaterThan(0);
      expect(preset.lifeMax).toBeGreaterThanOrEqual(preset.lifeMin);
      expect(preset.lifeMin).toBeGreaterThan(0);
      expect(HANDLED_GEOMETRIES.has(preset.geometry)).toBe(true);
    });

    it('sidebar Effect.id strips back to canonical id (timeline path)', () => {
      expect(effect.id).toBe(`finale-shell-${presetId}`);
      expect(timelineResolveShellPresetId(effect)).toBe(presetId);
    });

    it('Effect.name resolves through resolveShellPresetId (drag-from-sidebar path)', () => {
      expect(resolveShellPresetId(effect.name)).toBe(presetId);
      // Same path the renderer takes when only the name survived a paste.
      expect(timelineResolveShellPresetId({ id: 'cue-xyz', name: effect.name })).toBe(
        presetId,
      );
    });

    it('explicit presetId hint wins over name/id (override path)', () => {
      const overridden = timelineResolveShellPresetId({
        id: 'finale-shell-peony',
        name: 'Peony (Red)',
        presetId,
      });
      expect(overridden).toBe(presetId);
    });

    it('label-cased and lowercased names both resolve', () => {
      expect(resolveShellPresetId(preset.label)).toBe(presetId);
      expect(resolveShellPresetId(preset.label.toLowerCase())).toBe(presetId);
    });

    it('resolveShellPresetProps returns a renderable spec', () => {
      const props = resolveShellPresetProps(presetId);
      expect(props, `no props for ${presetId}`).toBeDefined();
      expect(props!.color).toMatch(HEX_RE);
      expect(props!.pattern).toBe(preset.pattern);
      expect(props!.caliberHint).toBeGreaterThan(0);
      // hasPistil <==> preset.pistil defined
      expect(props!.hasPistil).toBe(Boolean(preset.pistil));
      if (preset.pistil) {
        expect(props!.pistilColor).toMatch(HEX_RE);
      }
      // secondaryColor is forwarded for half-half (drives the bi-color loop)
      if (preset.secondaryColorHex) {
        expect(props!.secondaryColor).toBe(preset.secondaryColorHex);
      }
    });
  });

  // ── geometry-specific invariants the renderer relies on ─────────────
  it('half-half exposes a secondary color (paints both hemispheres)', () => {
    const p = FINALE_SHELL_PRESETS['half-half'];
    expect(p.secondaryColorHex).toBeTruthy();
    expect(resolveShellPresetProps('half-half')!.secondaryColor).toBe(
      p.secondaryColorHex,
    );
  });

  it('cluster-diadem carries an AscentEffect (drives <AscentFlash/>)', () => {
    const p = FINALE_SHELL_PRESETS['cluster-diadem'];
    expect(p.ascent).toBeDefined();
    expect(p.ascent!.colorHex).toMatch(HEX_RE);
    expect(p.ascent!.lifeS).toBeGreaterThan(0);
    expect(p.ascent!.width).toBeGreaterThan(0);
    expect(p.ascent!.densityHz).toBeGreaterThan(0);
  });

  it('ring family maps to geometry "ring"; bow-tie/jellyfish to inverted-hemisphere', () => {
    expect(FINALE_SHELL_PRESETS['ring'].geometry).toBe('ring');
    expect(FINALE_SHELL_PRESETS['double-ring'].geometry).toBe('ring');
    expect(FINALE_SHELL_PRESETS['saturn-ring'].geometry).toBe('ring');
    expect(FINALE_SHELL_PRESETS['bow-tie'].geometry).toBe('inverted-hemisphere');
    expect(FINALE_SHELL_PRESETS['jellyfish'].geometry).toBe('inverted-hemisphere');
    expect(FINALE_SHELL_PRESETS['heart'].geometry).toBe('heart');
    expect(FINALE_SHELL_PRESETS['smiley'].geometry).toBe('custom-shape');
    expect(FINALE_SHELL_PRESETS['half-half'].geometry).toBe('hemisphere');
  });

  it('every preset.count survives the renderer star-count clamp (>=1)', () => {
    // Renderer takes max(min, min(cap, count*…)); the only way it would
    // collapse to 0 is if count itself were 0. Guard against that.
    for (const id of FINALE_REV6_SHELL_PRESET_IDS) {
      expect(FINALE_SHELL_PRESETS[id].count).toBeGreaterThan(0);
    }
  });
});
