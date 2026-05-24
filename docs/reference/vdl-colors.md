# VDL Colors — Canonical Reference

Source: Finale 3D VDL Documentation, "VDL colors" (last updated 2023-09-12).

Status: **pinned** — `src/lib/vdlParser.ts` (`VDL_COLORS_TABLE`) and `src/lib/vdlQuantizer.ts` (`VDL_PALETTE`) are the canonical implementations. Both lookup tables MUST match Table 1 below byte-for-byte.

---

## Table 1 — VDL color terms

| # | Color | R | G | B | Hex | Implies trail | Tip variant |
|---|---|---|---|---|---|---|---|
| 1 | Ruby | 0.95 | 0.10 | 0.30 | `#f2194c` | no | — |
| 2 | Red | 0.95 | 0.10 | 0.10 | `#f21919` | no | — |
| 3 | Orange | 0.90 | 0.40 | 0.10 | `#e56619` | no | — |
| 4 | Peach | 0.80 | 0.50 | 0.10 | `#cc7f19` | no | — |
| 5 | Fresh Yellow | 0.70 | 0.60 | 0.35 | `#b29959` | no | — |
| 6 | Yellow | 0.80 | 0.70 | 0.05 | `#ccb20c` | no | — |
| 7 | Lemon | 0.75 | 0.60 | 0.05 | `#bf990c` | no | — |
| 8 | Green | 0.15 | 0.70 | 0.11 | `#26b21c` | no | — |
| 9 | Grass Green | 0.25 | 0.70 | 0.05 | `#3fb20c` | no | — |
| 10 | Lime | 0.35 | 0.70 | 0.11 | `#59b21c` | no | — |
| 11 | Blue | 0.30 | 0.40 | 1.15 | `#4c66ff` | no | — |
| 12 | Sea Blue | 0.25 | 0.50 | 1.15 | `#3f7fff` | no | — |
| 13 | Sky Blue | 0.20 | 0.50 | 0.80 | `#337fcc` | no | — |
| 14 | Aqua | 0.20 | 0.50 | 0.80 | `#337fcc` | no | — |
| 15 | Turquoise | 0.16 | 0.64 | 0.80 | `#28a3cc` | no | — |
| 16 | Cyan | 0.32 | 0.64 | 0.80 | `#51a3cc` | no | — |
| 17 | Indigo | 0.50 | 0.25 | 1.15 | `#7f3fff` | no | — |
| 18 | Lavender | 0.63 | 0.25 | 1.15 | `#a03fff` | no | — |
| 19 | Pink | 0.85 | 0.35 | 0.75 | `#d859bf` | no | — |
| 20 | Fuchsia | 0.85 | 0.35 | 0.90 | `#d859e5` | no | — |
| 21 | Purple | 0.75 | 0.25 | 1.15 | `#bf3fff` | no | — |
| 22 | Magenta | 0.80 | 0.10 | 1.00 | `#cc19ff` | no | — |
| 23 | Plum | 0.70 | 0.10 | 0.50 | `#b2197f` | no | — |
| 24 | Violet | 0.80 | 0.40 | 1.00 | `#cc66ff` | no | — |
| 25 | White | 0.75 | 0.75 | 0.85 | `#bfbfd8` | no | — |
| — | Dark | 0.00 | 0.00 | 0.00 | `#000000` | no | — |
| — | Charcoal | N/A | N/A | N/A | — | **yes** | Charcoal Tip → `#5a280a` (0.90, 0.40, 0.10) |
| — | Gamboge | N/A | N/A | N/A | — | **yes** | Gamboge Tip → `#ff9959` (1.00, 0.35, 0.05) |
| — | Gold | N/A | N/A | N/A | — | **yes** | Gold Tip → `#504605` (0.80, 0.70, 0.05) |
| — | Silver | N/A | N/A | N/A | — | **yes** | Silver Tip → `#4b4b55` (0.75, 0.75, 0.85) |

> "Tip" variants are the colors used to render the STAR (no trail implied). The bare
> term (Gold, Silver, Charcoal, Gamboge) declares the TRAIL color; the star colour is
> dominated by the burning fuel, so RGB is left N/A in the source table.

---

## Trail-from-color rule

A color term sets `impliesTrail = true` when bare. The four bare terms are:

- **Charcoal** — slow organic carbon trail
- **Gamboge** — warm orange-yellow ember trail
- **Gold** — golden glitter trail
- **Silver** — bright silver trail

All other color terms set `impliesTrail = false`.

## Trail-from-shape rule

Some flower types inherently carry a trail of sparks regardless of color
(`forcesTrail: true` in `EFFECT_TYPES`):

- Chrysanthemum (`comet` trail)
- Willow (`charcoal` trail)
- Palm, Coconut Palm (`comet`)
- Brocade Crown (`brocade`)
- Kamuro (`glitter`)
- Horsetail (`charcoal`)
- Crossette (`comet`)
- Rocket (`comet`)

Other shapes (Peony, Dahlia, Ring, Crown, etc.) default to `trailType: 'none'`
unless a trail-implying color term is present.

## "No Trail" override

Adding `No Trail` to the VDL forces `noTrail = true`, which:

- sets `trailType = 'none'`
- sets `impliesTrail = false`
- overrides BOTH the color-implied trail AND the shape `forcesTrail` flag

Example: `Red Chrysanthemum No Trail` → trailless red break with chrysanthemum star
count + spread.

---

## Canonical implementations

| Concern | File | Symbol |
|---|---|---|
| VDL → RGB+trail lookup | `src/lib/vdlParser.ts` | `VDL_COLORS_TABLE` |
| RGB → VDL nearest neighbor | `src/lib/vdlQuantizer.ts` | `VDL_PALETTE` |
| LED-accurate render pipeline | `src/lib/vdlColorPipeline.ts` | `quantizeRgbToVdl` |

Any divergence between these tables and Table 1 above is a bug. Tests in
`src/lib/__tests__/vdlColors.spec.ts` pin the rule.
