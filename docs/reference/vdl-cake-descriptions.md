# VDL Cake Descriptions

Source: Finale 3D VDL documentation, "Cake descriptions" (last updated 2023-09-12).
Renderer wiring is a separate round — this module only parses.

## Grammar

```
<cake-description> ::= <auxiliary> <body> <row-specifications>?
```

- **auxiliary** — caliber / shot count / overall duration header
  (e.g. `30mm 49 Shot 5s`).
- **body** — effect ingredients separated by `+`, each optionally labelled
  with a parenthesised single letter (e.g. `(a) Red Pearl + (b) Blue Pearl`).
  Must contain the word `Cake`. May contain a body-level firing pattern word
  (`Z-Shape`, `W-Shape`, `Fan`, `Zipper`, …).
- **row-specifications** — everything after the first `Row` / `Rows` keyword.
  Optionally preceded by a row count (`7 Rows,`). Each row spec is
  `Row <indices> (<firing-description>)`, with the firing description in
  parentheses.

## Firing description (per row)

```
[delay /] tubeLabels [/ pattern] [/ duration] [*]
```

| Field          | Example  | Meaning                                                 |
| -------------- | -------- | ------------------------------------------------------- |
| Delay          | `0.5/`   | Seconds before this row (ignored on the first row).     |
| Tube labels    | `abababa`| Effect labels per tube, left → right.                   |
| Pattern        | `/FNT`   | Three-letter firing pattern (STR, STL, FNR, …).         |
| Duration       | `/1.2`   | Seconds for the whole row (when not at the front).      |
| Parallel `*`   | `…*`     | Row fires in parallel with the previous row.            |

Numbers at the very beginning of the parenthesised body are delays; numbers
that are not at the beginning are durations.

## Body-level firing patterns

`Z-Shape`, `X-Shape`, `C-Shape`, `V-Shape`, `W-Shape`, `R-Shape`, `Zipper`,
`Bookend`, `Wipe`, `Peacock`, `Angle`, `Fan` — apply to all rows unless a
row's firing description overrides the pattern via the three-letter code.

## Module shape

`src/lib/vdlCakeDescriptions.ts` exports `parseCakeDescription(input)` which
returns:

```ts
{
  auxiliary: string;
  body: string;
  ingredients: { label: string; body: string }[];
  declaredRowCount: number;          // 0 if not declared
  bodyFiringPattern: string;         // '' if none
  rowSpecs: {
    rows: number[];                  // 1-based, expanded from "1,3,5" or "2-4"
    firing: {
      delayMs: number;               // -1 if not specified
      durationMs: number;            // -1 if not specified
      tubeLabels: string[];
      pattern: string;               // '' if not specified
      parallel: boolean;
      raw: string;
    } | null;                        // null when row spec has no parens
  }[];
}
```

`parseVDL` exposes the result as `result.cakeDescription` whenever the input
contains the word `Cake`.

## Notes / known limitations

- The "first row's delay is always zero" rule is **not** applied here — we keep
  the raw `delayMs` value so the timing engine (or `computeRowFiring`) can
  decide whether to drop it. This makes the parser deterministic and round-
  trip-friendly.
- Row index ranges (`Row 2-4`) are expanded inclusively.
- `splitTopLevelPlus` ignores `+` inside parentheses so labels with embedded
  `+` (rare) survive.
- The `auxiliary` slice is best-effort (caliber / `N Shot` / `Ts`). The body
  is whatever follows.
