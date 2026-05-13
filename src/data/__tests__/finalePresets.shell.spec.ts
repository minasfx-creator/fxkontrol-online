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
  it('exposes 7 base + 3 rev5 + 9 rev6 shells (total 19)', () => {
    expect(listShellPresetIds().sort()).toEqual(
      [
        'bow-tie',
        'chrysanthemum',
        'cluster-diadem',
        'crown',
        'dahlia',
        'double-ring',
        'ghost-shell',
        'half-half',
        'heart',
        'hybrid-special',
        'jellyfish',
        'palm',
        'peony',
        'peony-pistil',
        'quarter-4-4',
        'ring',
        'saturn-ring',
        'smiley',
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
    expect(resolveShellPresetId('Ring shell')).toBe('ring');
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

// ────────────────────────────────────────────────────────────────────
// rev5 — quarter-sphere + ghost + hybrid shell guards
// ────────────────────────────────────────────────────────────────────

describe('FINALE_SHELL_PRESETS — rev5 (34/34a/35.fwe)', () => {
  it('quarter-4-4 — QuarterSphere, count 60, speed 0.9, sigma 0', () => {
    const p = FINALE_SHELL_PRESETS['quarter-4-4'];
    expect(p.geometry).toBe('quarter-sphere');
    expect(p.count).toBe(60);
    expect(p.speedMS).toBe(0.9);
    expect(p.sigmaRad).toBe(0);
    expect(p.fadeABCD).toEqual([0.06393862, 0.32352942, 0.7811245, 0.99598396]);
  });

  it('ghost-shell — Normal/1.0 dense 240 stars + Gold Sparks dual tail', () => {
    const p = FINALE_SHELL_PRESETS['ghost-shell'];
    expect(p.count).toBe(240);
    expect(p.starType).toBe('Normal');
    expect(p.mass).toBe(1.0);
    expect(p.tails).toHaveLength(2);
    expect(p.tails![0].densityHz).toBe(200);
    expect(p.tails![0].colorHex.toUpperCase()).toBe('#3C1E00');
    expect(p.tails![1].emitEnd).toBe(0.8);
  });

  it('hybrid-special — Sparks/0.5 orange, life 2.0–3.5', () => {
    const p = FINALE_SHELL_PRESETS['hybrid-special'];
    expect(p.starType).toBe('XSmall');
    expect(p.lifeMin).toBe(2.0);
    expect(p.lifeMax).toBe(3.5);
    expect(p.colorHex.toUpperCase()).toBe('#FF7A00');
    expect(p.fadeABCD).toEqual([0.25081432, 0.747557, 0.748557, 1]);
  });
});

// ────────────────────────────────────────────────────────────────────
// rev5 — Mine presets
// ────────────────────────────────────────────────────────────────────

describe('FINALE_MINE_PRESETS — canonical FWsim Pro values', () => {
  it('exposes 3 mine presets', () => {
    expect(listMinePresetIds().sort()).toEqual(
      [
        'single-comet-mine-gold',
        'single-comet-silver-glitter',
        'single-mine-gold-glitter',
      ].sort(),
    );
  });

  it('40 — Gold Glitter mine: count 25, speed 1.0, primary tail strobe 29.4 Hz', () => {
    const p = FINALE_MINE_PRESETS['single-mine-gold-glitter'];
    expect(p.count).toBe(25);
    expect(p.starType).toBe('XSmall');
    expect(p.speedMS).toBe(1.0);
    expect(p.sigmaRad).toBe(0.045);
    expect(p.lifeMin).toBe(1.3);
    expect(p.lifeMax).toBe(2.5);
    expect(p.tails[0].strobeHz).toBeCloseTo(29.405308, 6);
    expect(p.tails[0].colorHex.toUpperCase()).toBe('#FEE0B8');
  });

  it('41 — Silver Glitter comet head: count 1 Large, strobe 7.92 Hz', () => {
    const p = FINALE_MINE_PRESETS['single-comet-silver-glitter'];
    expect(p.count).toBe(1);
    expect(p.starType).toBe('Large');
    expect(p.speedMS).toBe(1.05);
    expect(p.tails[0].strobeHz).toBeCloseTo(7.916814, 6);
  });

  it('42 — Deep Gold tails (149,74,0)', () => {
    const p = FINALE_MINE_PRESETS['single-comet-mine-gold'];
    expect(p.count).toBe(1);
    expect(p.tails[0].colorHex.toUpperCase()).toBe('#954A00');
    expect(p.tails[0].densityHz).toBe(9);
    expect(p.tails[0].strobeHz).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────
// rev5 — Cake-shot presets
// ────────────────────────────────────────────────────────────────────

describe('FINALE_CAKE_SHOT_PRESETS — canonical FWsim Pro values', () => {
  it('exposes 3 cake-shot presets, all wrapping a shell', () => {
    expect(listCakeShotPresetIds().sort()).toEqual(
      [
        'cake-hybrid-coal-gold',
        'cake-mine-shell-gold',
        'cake-shell-silver-titanium',
      ].sort(),
    );
    for (const id of listCakeShotPresetIds()) {
      expect(FINALE_CAKE_SHOT_PRESETS[id].wrappedKind).toBe('shell');
    }
  });

  it('43 — Silver Titanium: inner 3 stars Small, tail Spark D250', () => {
    const p = FINALE_CAKE_SHOT_PRESETS['cake-shell-silver-titanium'];
    expect(p.inner.count).toBe(3);
    expect(p.inner.starType).toBe('Small');
    expect(p.inner.fadeABCD).toEqual([0.09, 0.22, 0.488, 0.756]);
    expect(p.tail!.densityHz).toBe(250);
    expect(p.tail!.colorHex.toUpperCase()).toBe('#C8C8D0');
  });

  it('44 — Mine→Shell Gold: inner 69 XSmall', () => {
    const p = FINALE_CAKE_SHOT_PRESETS['cake-mine-shell-gold'];
    expect(p.inner.count).toBe(69);
    expect(p.inner.starType).toBe('XSmall');
    expect(p.tail!.colorHex.toUpperCase()).toBe('#954A00');
  });

  it('45 — Hybrid Coal Gold: inner 40 XXSmall, tail (55,28,0)', () => {
    const p = FINALE_CAKE_SHOT_PRESETS['cake-hybrid-coal-gold'];
    expect(p.inner.count).toBe(40);
    expect(p.inner.starType).toBe('XXSmall');
    expect(p.tail!.colorHex.toUpperCase()).toBe('#371C00');
    expect(p.tail!.densityHz).toBe(300);
  });
});

// ────────────────────────────────────────────────────────────────────
// rev5 — resolvers + adapters
// ────────────────────────────────────────────────────────────────────

describe('rev5 resolvers — name → preset id', () => {
  it('shell resolvers cover ghost / hybrid / quarter', () => {
    expect(resolveShellPresetId('ghost shell')).toBe('ghost-shell');
    expect(resolveShellPresetId('Hybrids special')).toBe('hybrid-special');
    expect(resolveShellPresetId('quarter shell 4-4')).toBe('quarter-4-4');
  });

  it('mine resolvers', () => {
    expect(resolveMinePresetId('Gold Glitter mine')).toBe('single-mine-gold-glitter');
    expect(resolveMinePresetId('silver comet')).toBe('single-comet-silver-glitter');
    expect(resolveMinePresetId('Comet/Mine deep gold')).toBe('single-comet-mine-gold');
    expect(resolveMinePresetId('peony')).toBeUndefined();
  });

  it('cake-shot resolvers', () => {
    expect(resolveCakeShotPresetId('cake silver titanium'))
      .toBe('cake-shell-silver-titanium');
    expect(resolveCakeShotPresetId('cake mine-shell')).toBe('cake-mine-shell-gold');
    expect(resolveCakeShotPresetId('cake hybrid')).toBe('cake-hybrid-coal-gold');
    expect(resolveCakeShotPresetId('peony')).toBeUndefined();
  });
});

describe('rev5 adapters — props mapping', () => {
  it('mine props expose strobe + single-head flag', () => {
    const a = resolveMinePresetProps('single-mine-gold-glitter')!;
    expect(a.strobeHz).toBeCloseTo(29.405308, 6);
    expect(a.isSingleHead).toBe(false);

    const b = resolveMinePresetProps('single-comet-silver-glitter')!;
    expect(b.isSingleHead).toBe(true);
    expect(b.color).toBe('#FFFFFF');
  });

  it('cake-shot props expose wrappedKind + inner color', () => {
    const c = resolveCakeShotPresetProps('cake-shell-silver-titanium')!;
    expect(c.wrappedKind).toBe('shell');
    expect(c.innerCount).toBe(3);
    expect(c.trailDensityHz).toBe(250);
  });

  it('listAllPresetIds aggregates 19 + 3 + 3', () => {
    const all = listAllPresetIds();
    expect(all.shells).toHaveLength(19);
    expect(all.mines).toHaveLength(3);
    expect(all.cakes).toHaveLength(3);
  });
});

// ────────────────────────────────────────────────────────────────────
// rev6 — Pattern shells (Ring/Heart/Smiley/Bow Tie/Diadem/Jellyfish/Half-Half)
// ────────────────────────────────────────────────────────────────────

describe('FINALE_SHELL_PRESETS — rev6 (25..33.fwe)', () => {
  it('25 ring — RingDistribution count 20 Small/0.8 Red', () => {
    const p = FINALE_SHELL_PRESETS['ring'];
    expect(p.geometry).toBe('ring');
    expect(p.count).toBe(20);
    expect(p.speedMS).toBe(0.8);
    expect(p.sigmaRad).toBe(0);
    expect(p.starType).toBe('Small');
    expect(p.fadeABCD).toEqual([0.12703583, 0.46091205, 0.81433225, 0.999]);
  });

  it('26 double-ring — count 30, FadeRatio B=0.70481926', () => {
    const p = FINALE_SHELL_PRESETS['double-ring'];
    expect(p.count).toBe(30);
    expect(p.fadeABCD[1]).toBeCloseTo(0.70481926, 6);
  });

  it('27 saturn-ring — Gold Titanium tail strobe 36.5 Hz', () => {
    const p = FINALE_SHELL_PRESETS['saturn-ring'];
    expect(p.tails).toHaveLength(1);
    expect(p.tails![0].strobeHz).toBeCloseTo(36.505306, 6);
    expect(p.tails![0].colorHex.toUpperCase()).toBe('#FFE2AE');
    expect(p.tails![0].densityHz).toBe(89);
  });

  it('28 heart — HeartDistribution, count 34, speed 0.5, sigma 0.14', () => {
    const p = FINALE_SHELL_PRESETS['heart'];
    expect(p.geometry).toBe('heart');
    expect(p.count).toBe(34);
    expect(p.speedMS).toBe(0.5);
    expect(p.sigmaRad).toBe(0.14);
  });

  it('29 smiley — CustomShape, count 150 XSmall/0.7 Orange', () => {
    const p = FINALE_SHELL_PRESETS['smiley'];
    expect(p.geometry).toBe('custom-shape');
    expect(p.count).toBe(150);
    expect(p.starType).toBe('XSmall');
    expect(p.lifeMax).toBe(2.82);
  });

  it('30 bow-tie — Silver tail D250 W0.6 life 0.25', () => {
    const p = FINALE_SHELL_PRESETS['bow-tie'];
    expect(p.geometry).toBe('inverted-hemisphere');
    expect(p.count).toBe(40);
    expect(p.tails![0].densityHz).toBe(250);
    expect(p.tails![0].lifeS).toBe(0.25);
    expect(p.tails![0].colorHex.toUpperCase()).toBe('#C8C8D0');
  });

  it('31 cluster-diadem — Invisible body + AscentEffect (149,74,0) D5', () => {
    const p = FINALE_SHELL_PRESETS['cluster-diadem'];
    expect(p.colorHex).toBe('#000000');
    expect(p.ascent).toBeDefined();
    expect(p.ascent!.densityHz).toBe(5);
    expect(p.ascent!.colorHex.toUpperCase()).toBe('#954A00');
    expect(p.ascent!.lifeS).toBeCloseTo(0.21, 6);
  });

  it('32 jellyfish — inverted-hemisphere, count 6 White + Silver D500', () => {
    const p = FINALE_SHELL_PRESETS['jellyfish'];
    expect(p.geometry).toBe('inverted-hemisphere');
    expect(p.count).toBe(6);
    expect(p.colorHex).toBe('#FFFFFF');
    expect(p.tails![0].densityHz).toBe(500);
    expect(p.tails![0].lifeS).toBe(0.7);
  });

  it('33 half-half — hemisphere, XXSmall/0.5 Orange + Red secondary', () => {
    const p = FINALE_SHELL_PRESETS['half-half'];
    expect(p.geometry).toBe('hemisphere');
    expect(p.count).toBe(50);
    expect(p.starType).toBe('XXSmall');
    expect(p.mass).toBe(0.5);
    expect(p.colorHex.toUpperCase()).toBe('#FF7A00');
    expect(p.secondaryColorHex?.toUpperCase()).toBe('#FF2A2A');
    expect(p.fadeABCD).toEqual([0.1, 0.25047082, 0.7344633, 0.9679849]);
  });
});

describe('rev6 resolvers — name → preset id', () => {
  it('matches all rev6 pattern shells', () => {
    expect(resolveShellPresetId('ring')).toBe('ring');
    expect(resolveShellPresetId('Double Ring')).toBe('double-ring');
    expect(resolveShellPresetId('Saturn ring gold')).toBe('saturn-ring');
    expect(resolveShellPresetId('Heart red')).toBe('heart');
    expect(resolveShellPresetId('Smiley face')).toBe('smiley');
    expect(resolveShellPresetId('Bow Tie')).toBe('bow-tie');
    expect(resolveShellPresetId('cluster diadem')).toBe('cluster-diadem');
    expect(resolveShellPresetId('Diadem')).toBe('cluster-diadem');
    expect(resolveShellPresetId('Jellyfish')).toBe('jellyfish');
    expect(resolveShellPresetId('Mushroom shell')).toBe('jellyfish');
    expect(resolveShellPresetId('Half Half')).toBe('half-half');
  });

  it('rev6 props expose canonical color/trail hints', () => {
    const saturn = resolveShellPresetProps('saturn-ring')!;
    expect(saturn.trailType).toBe('glitter');
    const heart = resolveShellPresetProps('heart')!;
    expect(heart.color).toBe('#FF2A2A');
  });
});
