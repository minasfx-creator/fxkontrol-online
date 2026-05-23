# VDL Chains — Creating a chain with one or more effects

Reference: Visual Descriptive Language (VDL) Documentation, "Creating a
chain with one or more effects", last updated 2023-09-12.

This doc is the canonical FXKONTROL summary for chain VDL parsing.

---

## TL;DR

- The keyword **`Chain`** is mandatory. "Finale" / "String" are NOT chain
  keywords for the parser. Translation of "Chain" in other languages is
  accepted by the upstream Finale parser; FXKONTROL matches `/\bchain\b/i`
  only — non-English keywords are NOT auto-recognized.
- Shell count: number after `Chain` or `Chain Of`. If absent and the
  description has `+` separators, count = `plusSigns + 1`. Otherwise
  default = **10**.
- Duration in a chain = time from **first ignition to last ignition** =
  sum of gap delays (an N-shell chain has N-1 gaps).
- `+` separates per-shell sub-effects. Plus-sign count must equal
  `shells - 1` when present.
- `CDS` (chain delay seconds) sits between `+` separators, defining the
  individual delay before its shell (one CDS per shell except the first).
- **VDL cannot represent chains with multiple shell sizes** — caliber is
  effect-wide.

---

## Examples

Simplest chain:

```
3" Salute Chain Of 10
```

Multi-effect chain (5 shells, 8s duration, 2s gaps):

```
3" 8s Red Peony + Blue Peony + Gold Willow + Blue Peony + Red Peony Chain Of 5
```

`Chain` alone (without `Of N`) — count inferred from plus signs:

```
3" 8s Red Peony + Blue Peony + Gold Willow + Blue Peony + Red Peony Chain
```

Per-gap delays via `CDS`:

```
100m 27s Chain of 10 Gold Willow
  + 4 CDS Green To Blue Ghost Shell
  + 4 CDS Red Chrysanthemum w/ Green Pistil
  + 2 CDS Purple Dhalia w/ Crackle Core
  + 2 CDS Silver Kamuro
  + 3 CDS Green To Blue Chrysanthemum
  + 3 CDS Red & Green Atomic Rings
  + 2 CDS Pink Crossette
  + 3 CDS Variegated Shell-Of-Shells
  + 4 CDS Pink Yellow Half-And-Half Shell
```

---

## Table 1 — Basic chain metrics

| Term | Format | Example |
|------|--------|---------|
| Size | caliber + `mm` / `"` / `inches` | `3"` or `75mm` |
| Number of shells | must be inside VDL (NOT importable as CSV column). Number after `Chain` or `Chain Of` | `Chain Of 5` or `Chain 5` |
| Duration | first → last ignition, seconds. Number + `s` / `seconds` | `10s` or `2.5s` |
| Height | lift in meters | `90m` |
| Prefire | for chains starting with aerial shells: lift time of the first shell + delay from ignition to effect-time-in-script (coincident with first break). Number + `s PFT` (space before `PFT`) | `2.3s PFT` |
| CDS | per-gap delay between shells, one per shell except the first | `+ 1.0 CDS Blue Peony` |

---

## CSV column split

When importing from CSV, **size, duration, height, prefire** can live in
their own columns. The number of chain shells **cannot** be split out —
it must remain in the VDL/Description column. With separate metric
columns, descriptions simplify to:

```
Salute Chain Of 10
```

---

## FXKONTROL parser coverage

`src/lib/vdlParser.ts` already covers chains end-to-end:

- `isChain: boolean` — true when `/\bchain\b/i` matches.
- `chainCount: number` — from `Chain (Of)? N`, else `plusParts.length`,
  else default `10`.
- `chainEffects: string[]` — per-shell VDL fragments split on `+`,
  trailing `Chain ...` tail stripped from the last fragment.
- `chainDelays: number[]` — every `<N> CDS` extracted in order. Length
  = number of CDS terms (usually `shells - 1` if every gap is specified).

The compiled effect duration honors the chain semantics (first → last
ignition), and the rendered effect time alignment continues to come from
`prefire` (PFT) for aerial first shells.

Multi-size chains are intentionally rejected at the schema level (one
`caliber` per VDL phrase), matching the source spec.
