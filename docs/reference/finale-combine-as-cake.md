# Finale 3D — Create Cake by Combining Effects

Last updated: April 29, 2026 (canonical doc date).

The function **`Effects > Combine as cake effect…`** takes N shots laid out on
the timeline at chosen angles/delays and produces a **single VDL cake
description** that captures all of their effects, angles, and timing.

## Two output syntaxes

The function emits one of two VDL syntaxes:

1. **Standard syntax** — rows + standard firing patterns (see
   `vdl-cake-descriptions.md` and the placeholder firing patterns in
   `vdl-placeholder-cakes.md`). Delays between tubes within a row are
   **uniform**, and angles must match a known pattern (STR/STL/STT/FN*/AL*/
   AR*/BL*/BR*/TRI/TRX/VST/VSS/etc — see `vdl-firing-patterns.md`).
2. **Exact simulation syntax** — every tube specified individually with its
   own angle + delay (see `vdl-exact-simulation-syntax.md`). Used as a
   fallback when no standard pattern fits, or when the user ticks
   *"Use exact simulation syntax"* on the confirmation dialog.

The function **always prefers standard syntax** when possible.

## Tolerances

- Angle error tolerance for standard-syntax matching: **±5°**
- Time error tolerance for standard-syntax matching: **±10 ms**
- Exact-simulation syntax rounds to **integral degrees and milliseconds**
  using the actual effect angles/times.

## Optimization

When multiple standard representations fit, the function picks the layout
that is **most square-ish** (most realistic-looking rows × tubes-per-row).

## Limitations

1. All tubes in the cake **must be the same size**.
2. Shot angles are **side-to-side only** (no front/back tilt).
3. **No peanut or multi-break effects** (anything that uses `+` in its VDL).

If the selection violates a hard limitation, the function cannot produce a
cake at all. Otherwise it is guaranteed to produce one of the two syntaxes.

## Implications for `vdlCombineAsCake` helper

The pure helper `src/lib/vdlCombineAsCake.ts` exposes:

- `checkCombineAsCakeLimitations(shots)` → `{ ok, violations[] }` enforcing
  the three hard limits above.
- `decideCakeSyntax(shots, opts?)` → `'standard' | 'exact'` running the
  tolerance check (5°/10 ms) for whether a uniform-row, standard-pattern
  representation fits. `opts.forceExact` short-circuits to `'exact'`.
- `scoreSquareness({ rows, tubesPerRow })` → numeric score; lower = more
  square-ish. Used to pick among multiple feasible standard layouts.

The helper is **data-in/data-out** and pins the decision logic only — actual
VDL string emission lives downstream and is not part of this rodada.
