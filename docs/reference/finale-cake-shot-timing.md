# Finale 3D — Timing of Shots Within a Cake

Source: Finale 3D docs, "Effects Overview — Timing of shots within a cake" (last updated 2019-09-27). Companion to [`finale-cake-candle-duration.md`](./finale-cake-candle-duration.md).

## Step 1 — Time from first to last shot

```
TimeFirstToLastShot = CakeDuration − LastShotLiftTimeIfShell
```

(Subtract the last shot's lift only when the last shot is a shell. For non-shell last shots, pass 0.)

## Step 2 — Uniform shooting cake (simple case)

When all interior gaps are identical:

```
ShotSeparation = TimeFirstToLastShot / (NumberOfShots − 1)
              = (CakeDuration − LastShotLiftIfShell) / (NumberOfShots − 1)
```

**Worked example.** `10 Shot 25s Red Peony Cake 2.5s PFT`:

```
ShotSeparation = (25 − 2.5) / (10 − 1) = 22.5 / 9 = 2.5 s
```

## Step 3 — Mixed rows with some unknown delays

Cakes may have:
- **Per-row durations** specified in the body (e.g. `STR/2.0` = 2.0 s from first to last shot of the row).
- **Per-row explicit delays before the row** (e.g. `(0.5/bbbbb/FNT)` = 0.5 s before row).
- **All-at-once rows** (`FNT`) with row duration 0.
- **Unknown delays**, which are treated as **all identical** — both inter-row and inter-tube unknown gaps share the same value.

Sum-of-interior-delays equation:

```
TimeFirstToLastShot
  = sum(known rowDuration_i)
  + sum(known interRowDelay_i)
  + unknownCount × unknownDelay
```

Solve for `unknownDelay`:

```
unknownDelay = (TimeFirstToLastShot − knownSum) / unknownCount
```

If `unknownCount == 0`, the configuration is fully specified — `unknownDelay` is irrelevant and `slack = TimeFirstToLastShot − knownSum` indicates over-/under-fit.

### Worked example (canonical)

```
20 Shot 15.0s
  (a) Red Comet + (b) Aerial Popcorn Crackle
  Cake, 4 Rows,
  Rows 1,2,3 (aaaaa/STR/2.0),
  Row 4 (0.5/bbbbb/FNT)
```

Last shot = popcorn crackle shell, default lift `2.5 s`.

```
TimeFirstToLastShot = 15 − 2.5 = 12.5

Knowns:
  rowDur1 = 2.0
  rowDur2 = 2.0
  rowDur3 = 2.0
  rowDur4 = 0    (FNT all-at-once)
  delayBeforeRow4 = 0.5
  knownSum = 6.5

Unknowns (treated equal):
  delayBeforeRow2
  delayBeforeRow3
  → unknownCount = 2

unknownDelay = (12.5 − 6.5) / 2 = 3.0 s
```

So each unknown inter-row gap is **3 s**, the explicit gap before row 4 is **0.5 s**, and rows 1–3 each take **2 s**. The 0.5 s before row 4 is intentionally short — popcorn crackle has a post-break bloom delay that visually fills the gap.

## FX-Kontrol helper

Pure helper: `src/lib/finaleCakeShotTiming.ts`
- `uniformShotSeparation({ cakeDuration, lastShotLiftIfShell, numberOfShots })` → number
- `solveCakeRowTiming({ cakeDuration, lastShotLiftIfShell, rows[] })` → `{ timeFirstToLast, knownSum, unknownDelay, unknownCount, slack, resolvedRows[] }`

`rows[]` is the ordered list of rows in shooting order. Each row carries:
- `duration?: number` — known row duration (omit to treat as unknown).
- `delayBefore?: number` — known explicit gap before this row (omit to treat as unknown; ignored for the first row).
- `allAtOnce?: boolean` — sugar for `duration: 0`.

Both `duration` and `delayBefore` slots that are missing/`undefined` count as unknown and share the same solved `unknownDelay`. The first row's `delayBefore` is always ignored.

Pure data-in/data-out. No parser coupling. Renderer wiring is a separate round.

Tests: `src/lib/__tests__/finaleCakeShotTiming.spec.ts`.
