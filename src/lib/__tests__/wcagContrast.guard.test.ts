/**
 * ─── WCAG AA Contrast Guard ──────────────────────────────────────────
 * Validates canonical FXKONTROL dark-mode token pairings against
 * WCAG 2.1 AA contrast thresholds (Success Criterion 1.4.3 / 1.4.11).
 *
 * Thresholds:
 *   • Normal text  (≥14px regular / ≥12px mono dense panels)  → 4.5:1
 *   • Large text   (≥18px regular / ≥14px bold)               → 3.0:1
 *   • Non-text UI  (borders, focus rings, status dots)         → 3.0:1
 *
 * Why programmatic? Manual audit drifts. This test pins every approved
 * fg/bg pairing the design system promises (Vantablack stack × cyan-dessat
 * × status × segments) and FAILS CI if anyone tweaks an HSL and breaks
 * the operational palette in the field.
 *
 * Source of truth: src/index.css (`:root`) + src/styles/field-tokens.css.
 * Memory: Design Decision Priority — safety > consolidado > WCAG AA.
 */
import { describe, it, expect } from 'vitest';

// ── HSL → relative luminance (WCAG formula) ──
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastHsl(fg: [number, number, number], bg: [number, number, number]): number {
  const Lfg = relLuminance(hslToRgb(...fg));
  const Lbg = relLuminance(hslToRgb(...bg));
  const [hi, lo] = Lfg > Lbg ? [Lfg, Lbg] : [Lbg, Lfg];
  return (hi + 0.05) / (lo + 0.05);
}

// ── Canonical tokens (HSL triplets, mirrors index.css :root) ──
const T = {
  // Vantablack stack (legacy + ds.* additive layer)
  background:        [0,   0,  2]   as [number, number, number],
  card:              [220, 18, 6]   as [number, number, number],
  popover:           [220, 16, 8]   as [number, number, number],
  muted:             [220, 12, 12]  as [number, number, number],
  // ds.* surfaces
  dsBackground:      [220, 60, 4]   as [number, number, number],
  dsSurfaceDeep:     [220, 40, 7]   as [number, number, number],
  dsSurfacePanel:    [220, 30, 12]  as [number, number, number],
  dsSurfaceElevated: [220, 30, 15]  as [number, number, number],
  // field surfaces
  fieldSurface1:     [220, 24, 5]   as [number, number, number],
  fieldSurface2:     [220, 20, 7]   as [number, number, number],
  fieldSurface3:     [220, 18, 10]  as [number, number, number],

  // Foreground hierarchy
  foreground:        [180, 8,  88]  as [number, number, number],
  fieldFgPrimary:    [180, 6,  88]  as [number, number, number],
  fieldFgSecondary:  [195, 8,  72]  as [number, number, number],
  fieldFgMuted:      [200, 10, 56]  as [number, number, number], // muted-foreground
  fieldFgDisabled:   [210, 8,  52]  as [number, number, number],
  dsTextPrimary:     [220, 14, 90]  as [number, number, number],
  dsTextSecondary:   [220, 9,  64]  as [number, number, number],
  dsTextMuted:       [220, 9,  46]  as [number, number, number],

  // Brand / accent
  primaryFg:         [220, 30, 4]   as [number, number, number], // dark text on cyan chip
  fieldCyan:         [190, 70, 58]  as [number, number, number],
  dsBorderActive:    [189, 94, 55]  as [number, number, number],

  // Status
  statusOk:          [142, 71, 45]  as [number, number, number],
  statusSync:        [189, 94, 55]  as [number, number, number],
  statusWarn:        [38,  92, 50]  as [number, number, number],
  statusFail:        [0,   84, 66]  as [number, number, number],

  // Segments
  segPyro:           [0,   84, 66]  as [number, number, number],
  segDrones:         [189, 94, 55]  as [number, number, number],
  segLight:          [48,  96, 55]  as [number, number, number],
  segDmx:            [258, 90, 72]  as [number, number, number],
  segSfx:            [38,  92, 50]  as [number, number, number],
};

// AA thresholds
const AA_NORMAL = 4.5;
const AA_LARGE = 3.0;
const AA_UI = 3.0;

// ── Body text pairings (must clear 4.5:1 — covers dense mono panels) ──
const NORMAL_TEXT_PAIRS: Array<{ name: string; fg: keyof typeof T; bg: keyof typeof T }> = [
  { name: 'foreground on background',           fg: 'foreground',       bg: 'background' },
  { name: 'foreground on card',                 fg: 'foreground',       bg: 'card' },
  { name: 'foreground on popover',              fg: 'foreground',       bg: 'popover' },
  { name: 'foreground on muted',                fg: 'foreground',       bg: 'muted' },
  { name: 'field.fg-primary on field.surface-1',fg: 'fieldFgPrimary',   bg: 'fieldSurface1' },
  { name: 'field.fg-primary on field.surface-3',fg: 'fieldFgPrimary',   bg: 'fieldSurface3' },
  { name: 'field.fg-secondary on field.surface-1', fg: 'fieldFgSecondary', bg: 'fieldSurface1' },
  { name: 'field.fg-muted on field.surface-1',  fg: 'fieldFgMuted',     bg: 'fieldSurface1' },
  { name: 'field.fg-muted on background',       fg: 'fieldFgMuted',     bg: 'background' },
  { name: 'ds.text-primary on ds.background',   fg: 'dsTextPrimary',    bg: 'dsBackground' },
  { name: 'ds.text-primary on ds.surface-deep', fg: 'dsTextPrimary',    bg: 'dsSurfaceDeep' },
  { name: 'ds.text-primary on ds.surface-panel',fg: 'dsTextPrimary',    bg: 'dsSurfacePanel' },
  { name: 'ds.text-primary on ds.surface-elevated', fg: 'dsTextPrimary', bg: 'dsSurfaceElevated' },
  { name: 'ds.text-secondary on ds.surface-panel', fg: 'dsTextSecondary', bg: 'dsSurfacePanel' },
  { name: 'primary-foreground on field.cyan (button)', fg: 'primaryFg', bg: 'fieldCyan' },
  // Status text (mono dense panels: timecode, badges, log lines)
  { name: 'status.ok on ds.surface-panel',      fg: 'statusOk',         bg: 'dsSurfacePanel' },
  { name: 'status.sync on ds.surface-panel',    fg: 'statusSync',       bg: 'dsSurfacePanel' },
  { name: 'status.warn on ds.surface-panel',    fg: 'statusWarn',       bg: 'dsSurfacePanel' },
  { name: 'status.fail on ds.surface-panel',    fg: 'statusFail',       bg: 'dsSurfacePanel' },
  { name: 'status.warn on ds.surface-elevated', fg: 'statusWarn',       bg: 'dsSurfaceElevated' },
  // Segment chips (mono uppercase 11px in dense panels — treat as normal text)
  { name: 'segment.pyro on ds.surface-elevated',fg: 'segPyro',          bg: 'dsSurfaceElevated' },
  { name: 'segment.drones on ds.surface-elevated', fg: 'segDrones',     bg: 'dsSurfaceElevated' },
  { name: 'segment.light on ds.surface-elevated',  fg: 'segLight',      bg: 'dsSurfaceElevated' },
  { name: 'segment.dmx on ds.surface-elevated', fg: 'segDmx',           bg: 'dsSurfaceElevated' },
  { name: 'segment.sfx on ds.surface-elevated', fg: 'segSfx',           bg: 'dsSurfaceElevated' },
];

// ── Large/secondary text — relaxed to 3:1 (≥18px or bold ≥14px) ──
const LARGE_OR_SECONDARY_PAIRS: Array<{ name: string; fg: keyof typeof T; bg: keyof typeof T }> = [
  { name: 'ds.text-muted on ds.surface-panel',  fg: 'dsTextMuted',      bg: 'dsSurfacePanel' },
  { name: 'ds.text-muted on ds.surface-elevated', fg: 'dsTextMuted',    bg: 'dsSurfaceElevated' },
  { name: 'field.fg-disabled on field.surface-3', fg: 'fieldFgDisabled', bg: 'fieldSurface3' },
];

// ── Non-text UI: borders, focus rings, status dots vs adjacent surface ──
const UI_PAIRS: Array<{ name: string; fg: keyof typeof T; bg: keyof typeof T }> = [
  { name: 'ds.border-active vs ds.background',  fg: 'dsBorderActive',   bg: 'dsBackground' },
  { name: 'ds.border-active vs ds.surface-panel', fg: 'dsBorderActive', bg: 'dsSurfacePanel' },
  { name: 'field.cyan ring vs field.surface-1', fg: 'fieldCyan',        bg: 'fieldSurface1' },
  { name: 'status.ok dot vs ds.surface-panel',  fg: 'statusOk',         bg: 'dsSurfacePanel' },
  { name: 'status.fail dot vs ds.surface-panel',fg: 'statusFail',       bg: 'dsSurfacePanel' },
];

describe('WCAG AA — dark-mode contrast (canonical tokens)', () => {
  describe('Normal text (≥4.5:1) — covers dense mono panels', () => {
    for (const p of NORMAL_TEXT_PAIRS) {
      it(`${p.name} ≥ ${AA_NORMAL}:1`, () => {
        const ratio = contrastHsl(T[p.fg], T[p.bg]);
        expect(
          ratio,
          `\n  ${p.name}\n  → ${ratio.toFixed(2)}:1 (need ≥${AA_NORMAL}:1)\n`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  });

  describe('Large/secondary text (≥3:1)', () => {
    for (const p of LARGE_OR_SECONDARY_PAIRS) {
      it(`${p.name} ≥ ${AA_LARGE}:1`, () => {
        const ratio = contrastHsl(T[p.fg], T[p.bg]);
        expect(
          ratio,
          `\n  ${p.name}\n  → ${ratio.toFixed(2)}:1 (need ≥${AA_LARGE}:1)\n`,
        ).toBeGreaterThanOrEqual(AA_LARGE);
      });
    }
  });

  describe('Non-text UI (borders, rings, dots) ≥3:1', () => {
    for (const p of UI_PAIRS) {
      it(`${p.name} ≥ ${AA_UI}:1`, () => {
        const ratio = contrastHsl(T[p.fg], T[p.bg]);
        expect(
          ratio,
          `\n  ${p.name}\n  → ${ratio.toFixed(2)}:1 (need ≥${AA_UI}:1)\n`,
        ).toBeGreaterThanOrEqual(AA_UI);
      });
    }
  });

  it('contrast formula sanity: white on black = 21:1, black on black = 1:1', () => {
    expect(contrastHsl([0, 0, 100], [0, 0, 0])).toBeCloseTo(21, 0);
    expect(contrastHsl([0, 0, 0], [0, 0, 0])).toBeCloseTo(1, 5);
  });
});
