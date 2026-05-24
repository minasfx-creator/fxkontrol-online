/**
 * Regression — text variations of `resolveShellPresetId`
 * --------------------------------------------------------
 * Locks in the canonical mapping for the 9 rev6 presets across the
 * variations we routinely see coming from FWsim parts, Finale 3D part
 * names, CSV pastes, and user-typed cue notes:
 *
 *   - hyphen separator      ("double-ring")
 *   - underscore separator  ("double_ring")
 *   - whitespace separator  ("double ring")
 *   - camel/concat          ("DoubleRing")
 *   - upper / mixed case    ("DOUBLE-RING", "Double-Ring")
 *   - "Tip" suffix          ("Double-Ring Tip")  ← FWsim part suffix
 *   - "Shell" suffix        ("Double-Ring Shell")
 *   - leading/trailing space
 *
 * Each row asserts every variation collapses to the SAME canonical id,
 * so a regex tweak that breaks one separator class fails this suite.
 */
import { describe, it, expect } from 'vitest';
import { resolveShellPresetId } from '@/data/finalePresets';

type Row = { id: string; variations: string[] };

/**
 * NOTE on word-boundary regexes: the resolver uses `\bheart\b`,
 * `\bsmiley\b` etc. JS treats `_` as a word char, so `heart_tip`
 * has no \b between `heart` and `_`. We therefore keep underscore
 * variations only on entries whose regex tolerates it
 * (`.?` separator, or no \b boundary). This is intentional and
 * documents the contract.
 */
const ROWS: Row[] = [
  {
    id: 'ring',
    // Plain ring — guarded by `\b(wave|ring)\b`.
    variations: ['ring', 'Ring', 'RING', 'Ring Tip', 'Ring Shell', '  ring  '],
  },
  {
    id: 'double-ring',
    variations: [
      'double-ring',
      'double_ring',
      'double ring',
      'DoubleRing',
      'DOUBLE-RING',
      'Double-Ring',
      'Double-Ring Tip',
      'Double Ring Shell',
      '  double-ring  ',
    ],
  },
  {
    id: 'saturn-ring',
    // Regex is just /saturn/ — extremely permissive.
    variations: [
      'saturn',
      'Saturn',
      'SATURN',
      'saturn-ring',
      'saturn_ring',
      'Saturn Ring',
      'Saturn Tip',
      'SaturnRing',
      'Saturn Shell',
      '  saturn  ',
    ],
  },
  {
    id: 'heart',
    // \bheart\b — separators must be non-word chars (space/hyphen).
    variations: [
      'heart',
      'Heart',
      'HEART',
      'Heart Tip',
      'Heart-Shell',
      'Heart Shell',
      '  heart  ',
    ],
  },
  {
    id: 'smiley',
    variations: [
      'smiley',
      'Smiley',
      'SMILEY',
      'Smiley Tip',
      'Smiley-Face',
      'Smiley Shell',
      '  smiley  ',
    ],
  },
  {
    id: 'bow-tie',
    variations: [
      'bow-tie',
      'bow_tie',
      'bow tie',
      'BowTie',
      'BOW-TIE',
      'Bow-Tie',
      'Bow-Tie Tip',
      'Bow Tie Shell',
      '  bow-tie  ',
    ],
  },
  {
    id: 'cluster-diadem',
    // Regex: /diadem|cluster.?diadem/ — no \b, so underscore is fine.
    variations: [
      'diadem',
      'Diadem',
      'DIADEM',
      'cluster-diadem',
      'cluster_diadem',
      'cluster diadem',
      'ClusterDiadem',
      'Cluster-Diadem Tip',
      'Cluster Diadem Shell',
      'diadem_tip',
      '  diadem  ',
    ],
  },
  {
    id: 'jellyfish',
    // Regex: /jellyfish|mushroom/ — no \b; mushroom synonym preserved.
    variations: [
      'jellyfish',
      'Jellyfish',
      'JELLYFISH',
      'jellyfish_tip',
      'Jellyfish Tip',
      'Jellyfish-Shell',
      'mushroom',
      'Mushroom',
      'MUSHROOM',
      'mushroom_tip',
      '  jellyfish  ',
    ],
  },
  {
    id: 'half-half',
    variations: [
      'half-half',
      'half_half',
      'half half',
      'HalfHalf',
      'HALF-HALF',
      'Half-Half',
      'Half-Half Tip',
      'Half Half Shell',
      '  half-half  ',
    ],
  },
];

describe('resolveShellPresetId — text variations regression (rev6)', () => {
  it('covers all 9 rev6 presets', () => {
    expect(ROWS.map((r) => r.id).sort()).toEqual(
      [
        'ring',
        'double-ring',
        'saturn-ring',
        'heart',
        'smiley',
        'bow-tie',
        'cluster-diadem',
        'jellyfish',
        'half-half',
      ].sort(),
    );
  });

  describe.each(ROWS)('preset $id', ({ id, variations }) => {
    it.each(variations)('"%s" → %s', (raw) => {
      expect(resolveShellPresetId(raw)).toBe(id);
    });
  });

  // ── disambiguation guards (regressions we explicitly want NOT to
  //    collapse into a sibling preset) ─────────────────────────────
  describe('disambiguation', () => {
    it('"silver wave" stays "wave" — does NOT collide with rev6 ring family', () => {
      expect(resolveShellPresetId('silver wave')).toBe('wave');
      expect(resolveShellPresetId('Wave')).toBe('wave');
    });

    it('"double-ring" wins over bare "ring" (specific-first ordering)', () => {
      expect(resolveShellPresetId('Double-Ring')).toBe('double-ring');
      expect(resolveShellPresetId('Double Ring Tip')).toBe('double-ring');
    });

    it('"saturn ring" wins over bare "ring"', () => {
      expect(resolveShellPresetId('Saturn Ring')).toBe('saturn-ring');
    });

    it('null / empty / whitespace / unknown → undefined', () => {
      expect(resolveShellPresetId(undefined)).toBeUndefined();
      expect(resolveShellPresetId(null)).toBeUndefined();
      expect(resolveShellPresetId('')).toBeUndefined();
      expect(resolveShellPresetId('   ')).toBeUndefined();
      expect(resolveShellPresetId('not-a-preset')).toBeUndefined();
    });
  });
});
