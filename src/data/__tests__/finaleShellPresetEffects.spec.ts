import { describe, it, expect } from 'vitest';
import {
  FINALE_SHELL_PRESET_EFFECTS,
  FINALE_REV6_SHELL_EFFECTS,
  FINALE_REV6_SHELL_PRESET_IDS,
  finaleShellPresetToEffect,
} from '@/data/finaleShellPresetEffects';
import { FINALE_SHELL_PRESETS } from '@/data/finalePresets';
import { resolveShellPresetId } from '@/data/finalePresets';

describe('FINALE_SHELL_PRESET_EFFECTS — sidebar wiring', () => {
  it('exposes every preset in FINALE_SHELL_PRESETS as a firework Effect', () => {
    expect(FINALE_SHELL_PRESET_EFFECTS.length).toBe(
      Object.keys(FINALE_SHELL_PRESETS).length,
    );
    for (const e of FINALE_SHELL_PRESET_EFFECTS) {
      expect(e.type).toBe('firework');
      expect(e.category).toBe('morteiros');
      expect(e.partType).toBe('shell');
      expect(e.id.startsWith('finale-shell-')).toBe(true);
      expect(e.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('uses preset.label as the Effect name (so search hits canonical wording)', () => {
    for (const id of Object.keys(FINALE_SHELL_PRESETS)) {
      const preset = FINALE_SHELL_PRESETS[id];
      const fx = FINALE_SHELL_PRESET_EFFECTS.find((e) => e.id === `finale-shell-${id}`);
      expect(fx, `missing effect for preset ${id}`).toBeDefined();
      expect(fx!.name).toBe(preset.label);
    }
  });

  it('cluster-diadem (Invisible body) gets a visible swatch color, not #000000', () => {
    const fx = FINALE_SHELL_PRESET_EFFECTS.find((e) => e.id === 'finale-shell-cluster-diadem')!;
    expect(fx.color.toLowerCase()).not.toBe('#000000');
  });
});

describe('rev6 pattern shells — searchable + selectable', () => {
  const REV6_IDS = [...FINALE_REV6_SHELL_PRESET_IDS];

  it('exposes all 9 rev6 presets', () => {
    expect(REV6_IDS).toHaveLength(9);
    expect(FINALE_REV6_SHELL_EFFECTS.map((e) => e.id)).toEqual(
      REV6_IDS.map((id) => `finale-shell-${id}`),
    );
  });

  it.each([
    ['ring',           ['ring']],
    ['double',         ['double-ring']],
    ['saturn',         ['saturn-ring']],
    ['heart',          ['heart']],
    ['smiley',         ['smiley']],
    ['bow',            ['bow-tie']],
    ['cluster',        ['cluster-diadem']],
    ['diadem',         ['cluster-diadem']],
    ['jellyfish',      ['jellyfish']],
    ['mushroom',       ['jellyfish']],
    ['half',           ['half-half']],
  ])('search %p returns the expected rev6 preset(s)', (query, expectedIds) => {
    const matches = FINALE_SHELL_PRESET_EFFECTS.filter((e) =>
      e.name.toLowerCase().includes(query.toLowerCase()),
    );
    for (const id of expectedIds) {
      expect(
        matches.find((m) => m.id === `finale-shell-${id}`),
        `query "${query}" did not match preset "${id}" — got ${matches.map(m => m.id).join(', ')}`,
      ).toBeDefined();
    }
  });

  it('every rev6 Effect resolves back to its canonical presetId via the renderer adapter', () => {
    // This guarantees that when the user picks the entry in the sidebar
    // and drops it on the timeline, FireworkRenderer will resolve the
    // exact same canonical ShellPreset (LED-accurate).
    for (const id of REV6_IDS) {
      const fx = FINALE_SHELL_PRESET_EFFECTS.find((e) => e.id === `finale-shell-${id}`)!;
      expect(resolveShellPresetId(fx.name)).toBe(id);
    }
  });

  it('finaleShellPresetToEffect is pure and stable', () => {
    const ring = FINALE_SHELL_PRESETS['ring'];
    const a = finaleShellPresetToEffect(ring);
    const b = finaleShellPresetToEffect(ring);
    expect(a).toEqual(b);
  });
});
