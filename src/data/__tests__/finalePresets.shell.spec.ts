import { describe, it, expect } from 'vitest';
import {
  FINALE_SHELL_PRESETS,
  FINALE_MINE_PRESETS,
  FINALE_CAKE_SHOT_PRESETS,
  listShellPresetIds,
  listMinePresetIds,
  listCakeShotPresetIds,
  listAllPresetIds,
  resolveShellPresetId,
  resolveMinePresetId,
  resolveCakeShotPresetId,
  resolveShellPresetProps,
  resolveMinePresetProps,
  resolveCakeShotPresetProps,
} from '@/data/finalePresets';

/**
 * Guard that the FWE-derived numbers stay 1:1 with the source XML payloads.
 * Any drift here means somebody "improved" canonical FWsim values — which is
 * exactly what we forbid.
 */
describe('FINALE_SHELL_PRESETS — canonical FWsim Pro values', () => {
  it('exposes 7 base + 3 rev5 shells (total 10)', () => {
    expect(listShellPresetIds().sort()).toEqual(
      [
        'chrysanthemum',
        'crown',
        'dahlia',
        'ghost-shell',
        'hybrid-special',
        'palm',
        'peony',
        'peony-pistil',
        'quarter-4-4',
        'wave',
      ].sort(),
    );
  });

  it('peony 01_Peony.fwe — count 110, speed 0.8, sigma 0.017', () => {
    const p = FINALE_SHELL_PRESETS['peony'];
    expect(p.count).toBe(110);
    expect(p.speedMS).toBe(0.8);
    expect(p.sigmaRad).toBe(0.017);
    expect(p.lifeMin).toBe(1.2);
    expect(p.lifeMax).toBe(1.6);
    expect(p.fadeABCD).toEqual([0.07736944, 0.41967872, 0.8914432, 0.99598396]);
  });

  it('peony-pistil — same body as peony + pistil sub-burst', () => {
    const p = FINALE_SHELL_PRESETS['peony-pistil'];
    expect(p.count).toBe(110);
    expect(p.pistil).toBeDefined();
    expect(p.pistil!.speedMS).toBe(0.3);
  });

  it('wave 03_Wave.fwe — ring + silver tail D250 W0.6 Life0.05 strobe 2.7Hz', () => {
    const p = FINALE_SHELL_PRESETS['wave'];
    expect(p.geometry).toBe('ring');
    expect(p.tails).toHaveLength(1);
    const tail = p.tails![0];
    expect(tail.densityHz).toBe(250);
    expect(tail.width).toBe(0.6);
    expect(tail.lifeS).toBe(0.05);
    expect(tail.strobeHz).toBeCloseTo(2.7017698, 6);
    expect(tail.fadeABCD).toEqual([0, 0.12403101, 0.63, 1]);
  });

  it('chrysanthemum 04 — Brocade #2 dual-tail (D250 + D40 amber)', () => {
    const p = FINALE_SHELL_PRESETS['chrysanthemum'];
    expect(p.tails).toHaveLength(2);
    expect(p.tails![0].densityHz).toBe(250);
    expect(p.tails![0].lifeS).toBe(2.6);
    expect(p.tails![1].densityHz).toBe(40);
    expect(p.tails![1].colorHex.toUpperCase()).toBe('#FEB000');
  });

  it('dahlia 05 — sparse 20 stars Normal/0.8, lifetime 2.0–2.5', () => {
    const p = FINALE_SHELL_PRESETS['dahlia'];
    expect(p.count).toBe(20);
    expect(p.starType).toBe('Normal');
    expect(p.mass).toBe(0.8);
    expect(p.lifeMin).toBe(2.0);
    expect(p.lifeMax).toBe(2.5);
  });

  it('palm 06 — semi geometry, Gold #2 tail D400 W0.6 Life0.8', () => {
    const p = FINALE_SHELL_PRESETS['palm'];
    expect(p.geometry).toBe('palm-semi');
    expect(p.tails![0].densityHz).toBe(400);
    expect(p.tails![0].lifeS).toBe(0.8);
    expect(p.tails![0].colorHex.toUpperCase()).toBe('#FFE2AE');
  });

  it('crown 07 — asym geometry, Gold Ferrotitanium tail EmitEnd 0.9', () => {
    const p = FINALE_SHELL_PRESETS['crown'];
    expect(p.geometry).toBe('crown-asym');
    expect(p.tails![0].emitEnd).toBe(0.9);
    expect(p.tails![0].densityHz).toBe(400);
    expect(p.tails![1].densityHz).toBe(200);
    expect(p.tails![1].width).toBe(0.1);
  });
});

describe('resolveShellPresetId — VDL/effect-name mapping', () => {
  it('matches direct names', () => {
    expect(resolveShellPresetId('Peony')).toBe('peony');
    expect(resolveShellPresetId('peony with pistil')).toBe('peony-pistil');
    expect(resolveShellPresetId('Wave')).toBe('wave');
    expect(resolveShellPresetId('Ring shell')).toBe('wave');
    expect(resolveShellPresetId('Chrysanthemum gold')).toBe('chrysanthemum');
    expect(resolveShellPresetId('Brocade kamuro')).toBe('chrysanthemum');
    expect(resolveShellPresetId('Dahlia pink')).toBe('dahlia');
    expect(resolveShellPresetId('Palm')).toBe('palm');
    expect(resolveShellPresetId('Crown ferrotitanium')).toBe('crown');
  });

  it('returns undefined for unknown effects (no false positives)', () => {
    expect(resolveShellPresetId('comet pastel red')).toBeUndefined();
    expect(resolveShellPresetId('mine silver tail')).toBeUndefined();
    expect(resolveShellPresetId('')).toBeUndefined();
    expect(resolveShellPresetId(undefined)).toBeUndefined();
  });
});

describe('resolveShellPresetProps — adapter to ShellBurstRenderer', () => {
  it('produces ready-to-spread props per preset', () => {
    const peony = resolveShellPresetProps('peony')!;
    expect(peony.pattern).toBe('peony');
    expect(peony.hasPistil).toBe(false);
    expect(peony.trailType).toBe('none');

    const palm = resolveShellPresetProps('palm')!;
    expect(palm.pattern).toBe('palm');
    expect(palm.trailType).toBe('charcoal');
    expect(palm.caliberHint).toBe(8);

    const peonyPistil = resolveShellPresetProps('peony-pistil')!;
    expect(peonyPistil.hasPistil).toBe(true);
    expect(peonyPistil.pistilColor).toBe('#FFFFFF');
  });

  it('returns undefined for unknown id', () => {
    expect(resolveShellPresetProps('not-a-preset')).toBeUndefined();
  });
});
