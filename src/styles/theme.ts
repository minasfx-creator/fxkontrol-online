/**
 * FXKONTROL DS v1 — Theme tokens (TypeScript mirror)
 *
 * Single source of truth in **TypeScript** for code that needs design tokens
 * outside CSS — chart libs (Recharts/D3), Three.js materials, canvas painting,
 * E2E tests, edge functions that emit themed HTML.
 *
 * The CSS layer (`src/index.css` `:root`) remains the canonical runtime
 * source. This file mirrors it 1:1 for build-time access. If you change a
 * token here, change it in `src/index.css` and `tailwind.config.ts` too.
 *
 * Usage:
 *   import { dsTokens, hsl } from '@/styles/theme';
 *   <Bar fill={hsl(dsTokens.status.sync)} />
 */

/** HSL triplet (H S% L%) as stored in CSS variables, no `hsl()` wrapper. */
export type HslTriplet = string;

export const dsTokens = {
  // ── Backgrounds (Vantablack stack) ─────────────────────────────
  background: {
    app:      '220 60% 4%',   // #050810
    deep:     '220 40% 7%',   // #0B1220
    panel:    '220 30% 12%',  // #111827
    elevated: '220 30% 15%',  // #172033
  },

  // ── Borders ────────────────────────────────────────────────────
  border: {
    default: '220 20% 17%',   // #1F2937
    subtle:  '218 22% 21%',   // #273244
    active:  '189 94% 55%',   // #22D3EE — Cyan
  },

  // ── Text ───────────────────────────────────────────────────────
  text: {
    primary:   '220 14% 90%', // #E5E7EB
    secondary: '220 9% 64%',  // #9CA3AF
    muted:     '220 9% 46%',  // #6B7280
    disabled:  '220 9% 34%',  // #4B5563
  },

  // ── Operational segments (PYRO/SFX/DRONES/LIGHT/DMX) ───────────
  segment: {
    pyro:   '0 84% 60%',      // #EF4444
    sfx:    '38 92% 50%',     // #F59E0B
    drones: '189 94% 55%',    // #22D3EE
    light:  '48 96% 55%',     // #FACC15
    dmx:    '258 90% 72%',    // #A78BFA — WCAG AA on bg.elevated
  },

  // ── Functional status (immutable across themes) ────────────────
  status: {
    ok:       '142 71% 45%',  // #22C55E
    sync:     '189 94% 55%',  // #22D3EE
    warn:     '38 92% 50%',   // #F59E0B
    fail:     '0 84% 60%',    // #EF4444
    disabled: '220 9% 46%',   // #6B7280
  },

  // ── Typography scale ───────────────────────────────────────────
  typography: {
    h1:      { size: 48, weight: 700, lineHeight: 56 },
    h2:      { size: 32, weight: 600, lineHeight: 40 },
    h3:      { size: 24, weight: 500, lineHeight: 32 },
    body:    { size: 16, weight: 400, lineHeight: 24 },
    caption: { size: 12, weight: 400, lineHeight: 16 },
  },

  // ── Spacing 8pt ────────────────────────────────────────────────
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 },

  // ── Radius ─────────────────────────────────────────────────────
  radius: { sm: 6, md: 10, lg: 16 },

  // ── Editor layout grid (px, constraints not auto-layout) ───────
  layout: {
    topbar: 64, tabs: 48, left: 280, right: 320, timeline: 180,
    desktopWidth: 1440, columns: 12, margin: 80, gutter: 24,
  },

  // ── Focus ring (cyan, WCAG AA) ─────────────────────────────────
  focus: {
    ringWidthPx: 2,
    offsetPx: 2,
    colorVar: '--ds-border-active',
  },
} as const;

/** Wrap an HSL triplet in `hsl()` for use in `style={{}}`. */
export const hsl = (triplet: HslTriplet, alpha?: number): string =>
  alpha === undefined ? `hsl(${triplet})` : `hsl(${triplet} / ${alpha})`;

/** Resolve a CSS variable name to its current computed `hsl()` value. */
export const cssVar = (name: string, alpha?: number): string =>
  alpha === undefined
    ? `hsl(var(${name}))`
    : `hsl(var(${name}) / ${alpha})`;

/** Get the per-segment color for tracks, badges, viewport tags. */
export const segmentColor = (id: keyof typeof dsTokens.segment): string =>
  hsl(dsTokens.segment[id]);

/** Get the status color for any state-bearing UI. */
export const statusColor = (kind: keyof typeof dsTokens.status): string =>
  hsl(dsTokens.status[kind]);

export type DsTokens = typeof dsTokens;
