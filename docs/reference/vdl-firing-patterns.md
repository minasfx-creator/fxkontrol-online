# VDL Firing Patterns — Cake & Slice Row Reference

> Canonical reference for the 25 Visual Descriptive Language (VDL) row-firing-pattern keywords used by Finale 3D / FWsim cake descriptions. Mirrors the FWsim Manual v3 spec (last updated 2024-05-29 upstream) and is the source of truth for `src/lib/vdlFiringPatterns.ts`.

## Background

A VDL cake description can be generic or row-specific. Generic example:

```
49 Shot Red Pearl Z-Shape Cake
```

Row-specific example:

```
49 Shot 5s (a) Red Pearl + (b) Blue Pearl Cake Z-Shape, 7 Rows,
Row 1,3,5 (aaaaaaa), Row 2,4,6 (bbbbbbb), Row 7 (1.2/abababa/FNT)
```

The 3-letter token (`FNT`, `STR`, …) at the end of a per-row spec is the **Firing Pattern Keyword**. It encodes three things per row:

1. **Geometry** — angle of each tube (straight, fanned, all-leaning, V, W, bookend…).
2. **Timing** — whether tubes fire sequentially or all-at-once.
3. **Ignition end** — which physical end of the row ignites first (left, right, center, both ends, or undefined for all-at-once).

If no pattern is specified anywhere, the default is `STR` (Up-Sequence, straight, left→right). A pattern in the cake body (e.g. `Z-Shape`) sets the default for every row that does not override it.

## Table 1 — Firing Pattern Keywords

| Keyword | Symbol | Timing | Description | Ignited from | Aliases |
|---|---|---|---|---|---|
| `STR` | \|\|\| | Sequential | Up-Sequence | Left | `STW` |
| `STL` | \|\|\| | Sequential | Up-Reverse | Right | — |
| `STT` | \|\|\| | All-At-Once | Up-Together | Undefined | — |
| `ALR` | \\\\\\ | Sequential | Left-Sequence | Left | `AGW` |
| `ALL` | \\\\\\ | Sequential | Left-Reverse | Right | — |
| `ALT` | \\\\\\ | All-At-Once | Left-Together | Undefined | `AGT` |
| `ARR` | /// | Sequential | Right-Reverse | Left | — |
| `ARL` | /// | Sequential | Right-Sequence | Right | — |
| `ART` | /// | All-At-Once | Right-Together | Undefined | — |
| `FNR` | \\\|/ | Sequential | Fan-Right | Left | `FNW` |
| `FNL` | \\\|/ | Sequential | Fan-Left | Right | — |
| `FNT` | \\\|/ | All-At-Once | Fan (together) | Undefined | `ATF` |
| `BLR` | \\\| | Sequential | Stand-Right | Left | `BKW` |
| `BLL` | \\\| | Sequential | Fall-Left | Right | — |
| `BLT` | \\\| | All-At-Once | Left-Bookend | Undefined | `BKT` |
| `BRR` | \|/ | Sequential | Fall-Right | Left | — |
| `BRL` | \|/ | Sequential | Stand-Left | Right | — |
| `BRT` | \|/ | All-At-Once | Right-Bookend | Undefined | — |
| `CTO` | \\\|/ | Sequential | Center-Out | Center | `CRN` |
| `OTC` | \\\|/ | Sequential | Outside-In | Both Ends | — |
| `TRI` | \\\|/ | All-At-Once | W-Shape (remainder straight) | Undefined | — |
| `TRX` | \\\|/ | All-At-Once | W-Shape (remainder angled) | Undefined | — |
| `TRS` | \\\|/ | Sequence-Of-Ws | W-Shape sequenced | Per-W (see below) | — |
| `VST` | \\/ | All-At-Once | V-Shape | Undefined | — |
| `VSS` | \\/ | Sequence-Of-Pairs | V-Shape paired | Center | — |

## Semantic Notes

### Straight (`ST*`)
All tubes vertical (0°). `STR` fires left→right, `STL` fires right→left, `STT` fires all together. Direction matters only when the row mixes effects (`a`/`b`) asymmetrically.

### All-Leaning (`AL*` / `AR*`)
Every tube tilts the **same** direction. `AL*` leans left (`\\\`), `AR*` leans right (`///`). The third letter is the firing order (R = left-first, L = right-first, T = together).

### Fan (`FN*`)
Tubes form a continuous fan from left-lean through straight to right-lean (`\|/`). Equivalent to angles linearly interpolated from `-fanAngle` to `+fanAngle`. `FNR` lights left→right, `FNL` right→left, `FNT` all together.

### Bookend (`BL*` / `BR*`)
Half the row angled, half straight.
- `BL*` — left half leans left, right half straight (`\\|`).
- `BR*` — left half straight, right half leans right (`|/`).
Third letter selects ignition order as above.

### Center-Out / Outside-In (`CTO`, `OTC`)
Fan geometry (`\|/`).
- `CTO` ignites the **center** tube first and expands outward symmetrically.
- `OTC` ignites the **two outermost** tubes first and converges to the center.

### W-Shape (`TRI`, `TRX`, `TRS`)
Row split into thirds: left third leans left, middle third straight, right third leans right. With **N** tubes:
- `TRI` — remainder of `N % 3` is added to the **straight** middle group (e.g. 11 tubes → 3-5-3).
- `TRX` — remainder is added to the **angled** outer groups (e.g. 11 → 4-3-4).
- `TRS` — defines `floor(N/3)` sequential W's. Remainder logic:
  - `N % 3 == 1` → first W has 4 tubes (extra is leftmost-of-center, fires with right-of-left and left-of-right).
  - `N % 3 == 2` → first W has 5 tubes (the two extras are right-of-left and left-of-right, fire with leftmost-center).

### V-Shape (`VST`, `VSS`)
Left half leans left, right half leans right, **no straight center**. `VST` fires all together; `VSS` fires in symmetric pairs starting from the center pair outward.

## Defaults & Resolution Order

1. If a row spec contains a 3-letter keyword (e.g. `FNT`), use it.
2. Otherwise, use the cake body default (e.g. `Z-Shape` → `FNR` semantics applied to alternating rows).
3. Otherwise, use `STR` (Up-Sequence).

## Reference Implementation

`src/lib/vdlFiringPatterns.ts` exports:

```ts
computeRowFiring({ tubeCount, pattern, spacingMs?, fanAngleDeg? })
  : Array<{ tubeIndex: number; angleDeg: number; delayMs: number }>;
```

- `angleDeg` — signed degrees (`+` = leaning right of vertical, `0` = straight up).
- `delayMs` — offset from row-trigger time (always `0` for all-at-once patterns).
- `tubeIndex` — physical position 0..N-1, left to right, always present in output regardless of firing order.

Defaults: `spacingMs = 80`, `fanAngleDeg = 45`.

Aliases (`STW`, `AGW`, `AGT`, `FNW`, `ATF`, `BKW`, `BKT`, `CRN`) are normalized to their canonical keyword on input.

## Sources

- FWsim Manual v3 — VDL Documentation, §"Firing patterns for cake and slice rows".
- Finale 3D VDL specification, Table 1.
