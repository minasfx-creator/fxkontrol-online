# Finale 3D — Prefire, LFT, DLY, Delay Default, Export Offset

Last updated: April 29, 2026 (canonical doc date).

## Prefire — the canonical rule

`Prefire` = time from **firing system ignition** to the **effect time synced to
music**. VDL splits behaviour by magnitude:

| Prefire value | Interpretation |
|---|---|
| `prefire < 0.5` s | **Delay before simulation** (firing-system latency / startup) |
| `prefire >= 0.5` s | **Aerial shell lift time** |

This rule applies to combination effects too:
- `RED PEONY w/ BLUE MINE` with `prefire < 0.5` → mine launch synced to music.
- `BLUE MINE w/ RED BOMBETTES` with `prefire >= 0.5` → shell break synced
  (the larger value is the bombette lift time).

### Prefire source priority

```
PrefireColumn (per-row in effects table)  ?? VDL PFT term  ?? default lift time
```

The column value in the effects window **always wins** over the `PFT` VDL term.

## LFT and DLY — explicit overrides

When the implicit prefire rule is insufficient, VDL terms `LFT` (lift time) and
`DLY` (delay before simulation) **override** what the prefire would imply.

Canonical worked example:
```
50mm 21.0s 4.0 PFT 10 Shot RC 1.0 DLY Pink Peony w/ Green Mine 3.0 LFT
```

Decomposition:
- `3.0 LFT` — lift time of each bombette = 3 s.
- `1.0 DLY` — visco-fuse delay before the **first** launch = 1 s.
- `4.0 PFT` — prefire aligns to first break = `1.0 DLY + 3.0 LFT = 4.0`.
- `21.0s` overall = first launch → last break.
  - 18 s between first launch and last launch (subtract last 3 s lift).
  - 10 shots → 9 gaps → `18 / 9 = 2 s` between shots.

## Editable fuse delay (Delay Default → Delay)

For long external fuses (Pyro-Clock, visco), use **Delay Default** instead of
prefire:

- Stored on the effect as `Delay Default` (hidden column in effects window).
- **Copied by value** into the script row's `Delay` field on insert.
- The script-row `Delay` is **editable per row** — different occurrences of
  the same effect can have different `Delay`s (e.g. trimmed fuses in the
  field).

This is purely an **external delay** between firing-system ignition and effect
ignition. It is NOT the same as prefire or lift.

## Measured vs supplier prefires

| Source | What it includes |
|---|---|
| **Measured** (ignition → break by stopwatch/photo) | `delay_before_launch + lift_delay` (includes firing-system latency) |
| **Supplier-provided** | `lift_delay` only (no firing-system latency) |

Finale 3D accepts measured prefires directly: it interprets them as lift for
shells (per the `>= 0.5` rule), so launches leave slightly early and breaks
linger compensatingly to hit the music exactly. Inaccuracy is imperceptible;
use explicit `LFT`/`DLY` to fix if it matters.

## Firing-system Export Offset

`Show > Show settings… > Firing system export offset` compensates for the
firing system's latency across the whole show without modifying any prefire
value.

- **Positive firing-system latency ⇒ negative export offset.**
- Example: firing system adds `+0.1 s` latency → set offset `-0.1`.
- Effect prefires stay firing-system-independent; the same show file can be
  re-targeted to a different firing system by changing only the offset.

## Helper API (`src/lib/finalePrefireRules.ts`)

Pure data-in/data-out. No side effects, no mutation of script rows.

- `interpretPrefire(seconds) → 'delay-before-simulation' | 'lift-time'`
  — applies the `0.5` boundary (inclusive at `0.5`).
- `resolvePrefireWithOverrides({ prefireColumn?, pftFromVdl?, defaultLift?, lftFromVdl?, dlyFromVdl? })`
  → `{ effectivePrefire, liftTime, delayBeforeSimulation, source }`
  — applies column > PFT > defaultLift, and LFT/DLY overrides.
- `applyExportOffset(prefire, exportOffsetSeconds)` — adds offset (compensates
  firing-system latency). Sign convention: `+0.1 s` latency = `-0.1` offset.
- `derivePrefireFromMeasured({ delayBeforeLaunch, liftDelay })` — sums the two
  to produce a measured prefire (per the doc's formula).
