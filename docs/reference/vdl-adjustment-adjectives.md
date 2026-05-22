# VDL Adjustment Adjectives + Angles

Source: Finale 3D VDL Documentation — "VDL effect adjustment terms (Big,
Bright, R45, L45, etc.)" (Last updated May 23, 2024).

## Intensity scale

Every adjustment adjective comes in three magnitudes:

| Intensity        | Prefix           |
|------------------|------------------|
| Small            | `Slightly <adj>` |
| Medium           | `<adj>`          |
| Large            | `Very <adj>`     |

Repeating an adjective compounds multiplicatively. Doc example:
`"Very Big Very Big"` further amplifies the spread already produced by a
single `"Very Big"`.

## Adjective matrix

| What it affects                                        | Small                  | Medium         | Large               |
|--------------------------------------------------------|------------------------|----------------|---------------------|
| Expand shell break / mine spread                       | Slightly big           | Big            | Very big            |
| Reduce shell break / mine spread                       | Slightly small         | Small          | Very small          |
| Brighten stars + their trails                          | Slightly bright        | Bright         | Very bright         |
| Darken stars + their trails                            | Slightly dim           | Dim            | Very dim            |
| Brighten only the trails                               | Slightly bright trail  | Bright trail   | Very bright trail   |
| Darken only the trails                                 | Slightly dim trail     | Dim trail      | Very dim trail      |
| Brighten only the stars (tips)                         | Slightly bright tip    | Bright tip     | Very bright tip     |
| Darken only the stars (tips)                           | Slightly dim tip       | Dim tip        | Very dim tip        |
| Increase star count                                    | Slightly dense         | Dense          | Very dense          |
| Reduce star count                                      | Slightly sparse        | Sparse         | Very sparse         |
| Thicken trail of sparks                                | Slightly thick         | Thick          | Very thick          |
| Thin out trail of sparks                               | Slightly thin          | Thin           | Very thin           |
| Lengthen trail-spark duration                          | Slightly long trail    | Long trail     | Very long trail     |
| Shorten trail-spark duration                           | Slightly short trail   | Short trail    | Very short trail    |
| Lengthen star duration                                 | Slightly long          | Long           | Very long           |
| Shorten star duration                                  | Slightly short         | Short          | Very short          |
| Make gerb/fountain sparks last longer                  | Slightly droopy        | Droopy         | Very droopy         |
| Make shell break pattern more ragged                   | Slightly ragged        | Ragged         | Very ragged         |
| Make shell break pattern more uniform                  | Slightly uniform       | Uniform        | Very uniform        |

> Note the spelling **trail** (not "tail") in the trail-length row.

## Position & scope

Adjectives apply to the part of the effect description they live in.
Prepositions like `To` and `With` (`w/`) split the description into parts.

```
Red Peony w/ Big Blue Pistil     # Big modifies the Blue Pistil
Big Red Peony w/ Blue Pistil     # Big modifies the Red Peony

Bright Red To Green Chrysanthemum  # Bright modifies Red
Red To Bright Green Chrysanthemum  # Bright modifies Green
```

Within a single part, position does not matter — VDL accepts both
pre-nominal and post-nominal placement so the grammar is friendly to
non-English authors:

```
Red Peony w/ Big Blue Pistil   ≡   Red Peony w/ Blue Pistil Big
```

## Angles

Angle adjectives tilt the trajectory left or right by a specified angle:

```
R15, R30, R45, R60, R75, R90, R105, R120, R135, R150, R165, R180
L15, L30, L45, L60, L75, L90, L105, L120, L135, L150, L165, L180
```

Example — Explo X2 Wave Flamer pre-programmed Macro #16:

```
Flame Projector L105
```

fires a column of flames tilted 105° to the left.

## Parser mapping

| Doc concept           | Parser field                              | Typed helper                              |
|-----------------------|-------------------------------------------|-------------------------------------------|
| Adjective term        | `adjustments: string[]` (lowercased)      | `toTypedAdjustments()` → `TypedAdjustment[]` |
| Repetition stacking   | Multiple entries with the same `term`     | `summarizeAdjustments()` multiplies them  |
| Numeric effect        | Pre-applied to `spread`/`starCount`/...   | Per-kind factor table in `vdlAdjustments` |
| `R<deg>` / `L<deg>`   | `angleOffset: number` (R positive)        | `parseAngleOffset(raw)`                   |
| Allowed angle steps   | —                                         | `VDL_ANGLE_STEPS` (15..180 step 15)       |

The parser file `src/lib/vdlParser.ts` already extracts adjectives via the
`VDL_ADJUSTMENTS` matrix and applies compound stacking to `spread`,
`starCount`, `duration`, `speed`, and `height`. The typed view in
`src/lib/vdlAdjustments.ts` is a non-mutating projection: it does not
change the parser output, it only exposes a structured representation
keyed by `AdjustmentKind` + `AdjustmentIntensity` for consumers (UI
inspectors, renderer hints, future LED-color modulators).
