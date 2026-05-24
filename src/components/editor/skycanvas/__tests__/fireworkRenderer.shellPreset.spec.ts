/**
 * Verify the rev6 ShellPreset wiring in FireworkRenderer:
 *   1. resolveShellPresetId picks the canonical id from the
 *      `finale-shell-<presetId>` Effect id used by the sidebar.
 *   2. FINALE_SHELL_PRESETS has the AscentEffect on cluster-diadem,
 *      which the renderer mounts as <AscentFlash>.
 *   3. Every rev6 preset has a defined geometry the renderer handles.
 */
import { describe, it, expect } from 'vitest';
import { FINALE_SHELL_PRESETS, resolveShellPresetId } from '@/data/finalePresets';
import { FINALE_REV6_SHELL_PRESET_IDS, FINALE_REV6_SHELL_EFFECTS } from '@/data/finaleShellPresetEffects';

const HANDLED_GEOMETRIES = new Set([
  'sphere',
  'ring',
  'heart',
  'custom-shape',
  'hemisphere',
  'inverted-hemisphere',
]);

describe('FireworkRenderer ShellPreset wiring (rev6)', () => {
  it('every rev6 effect id strips back to a canonical preset id', () => {
    for (const e of FINALE_REV6_SHELL_EFFECTS) {
      expect(e.id.startsWith('finale-shell-')).toBe(true);
      const tail = e.id.slice('finale-shell-'.length);
      expect(FINALE_SHELL_PRESETS[tail]).toBeDefined();
    }
  });

  it('every rev6 effect.name resolves via resolveShellPresetId', () => {
    for (const e of FINALE_REV6_SHELL_EFFECTS) {
      expect(resolveShellPresetId(e.name)).toBeTruthy();
    }
  });

  it('every rev6 preset uses a geometry the renderer knows how to draw', () => {
    for (const id of FINALE_REV6_SHELL_PRESET_IDS) {
      const p = FINALE_SHELL_PRESETS[id];
      expect(p, `missing preset ${id}`).toBeDefined();
      expect(HANDLED_GEOMETRIES.has(p.geometry)).toBe(true);
    }
  });

  it('cluster-diadem carries an AscentEffect descriptor', () => {
    const p = FINALE_SHELL_PRESETS['cluster-diadem'];
    expect(p?.ascent).toBeDefined();
    expect(p!.ascent!.colorHex).toMatch(/^#/);
    expect(p!.ascent!.lifeS).toBeGreaterThan(0);
    expect(p!.ascent!.width).toBeGreaterThan(0);
  });

  it('half-half exposes a secondary color so the renderer can paint both halves', () => {
    const p = FINALE_SHELL_PRESETS['half-half'];
    expect(p?.secondaryColorHex).toBeTruthy();
  });
});
