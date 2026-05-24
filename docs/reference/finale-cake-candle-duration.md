# Finale 3D — Cake and Candle Duration (and Prefire)

Source: Finale 3D docs, "Effects Overview — Cake and candle duration (and prefire)" (last updated 2020-03-02).

## Plain-language rule

> Duration of a cake or candle = **first launch to last break** if the last effect is a shell.
> For non-shells (comets, mines, fountains) break time is zero, so this reduces to **first to last launch**.

Exceptions are obvious once you think about them: a single-shot shell candle is the same as the shell itself; an all-at-once fan is the same as a single effect.

## Canonical 7-case matrix

Notation:
- `PFT` = prefire-from-VDL (e.g. `0.0 PFT`)
- `PFCol` = value in the Prefire script column
- `Lift(shell)` = default lift time for that shell caliber
- `Expire(stars)` = expiration time of the stars / emission
- `BreakTime` = `LaunchTime + Lift` for a shell; `LaunchTime` for everything else
- `Blip` = the timeline blip marker

### Prefire resolution (all rows)
```
prefire = PFCol ?? PFT ?? (first shot is shell ? Lift(firstShell) : 0)
```

| # | Cake/candle pattern | Duration | Timeline-right-of-blip |
|---|---|---|---|
| 1 | **Single-shot, shell** | `Expire(stars) − prefire` if `prefire ≥ 0.5`; else `Expire(stars) − (prefire + Lift(shell))` | `Expire(stars) − Blip` |
| 2 | **Multi-shot, sequential, first=shell, last≠first** | `BreakTime(last) − LaunchTime(first)`; lift of last is **unaffected** by prefire; launches delayed by `prefire` if `< 0.5` | `Expire(stars of last) − Blip` |
| 3 | **Multi-shot, sequential, first=shell, last=first** | Same as #2, but lift of last **is** adjusted to prefire if `≥ 0.5` (same effect) | `Expire(stars of last) − Blip` |
| 4 | **Multi-shot, all-at-once, first=shell, last≠first** | **0** | `Expire(stars of last) − Blip` |
| 5 | **Multi-shot, all-at-once, first=shell, last=first** | **0** | `Expire(stars of last) − Blip` |
| 6 | **Single-shot, non-shell** (comet/mine/fountain) | `Expire(stars or emission) − LaunchTime`; launch delayed by `prefire` if `< 0.5`; blip aligns to prefire if `≥ 0.5` | `Expire(...) − Blip` (clamped ≥ 0) |
| 7 | **Multi-shot, sequential, first≠shell** | `EffectTime(last) − LaunchTime(first)`; launches delayed by `prefire` if `< 0.5`; blip aligns to prefire if `≥ 0.5` | `Expire(... of last) − Blip` (clamped ≥ 0) |
| 8 | **Multi-shot, all-at-once, first≠shell** | **0** | `Expire(... of last) − Blip` (clamped ≥ 0) |

### Prefire rule (shells only)

If the **first** shot is a shell and `prefire ≥ 0.5`, the shell's lift time is **adjusted to equal the prefire**. If any other shot in the cake uses **the same effect** as the first, it is also adjusted. Otherwise it keeps its default lift.

### Shot separation (basic sequential shooting cakes)

```
ShotSeparation = (CakeDuration − LastShotLiftTimeIfShell) / (NumberOfShots − 1)
```

Subtract the last shot's lift only when the last shot is a shell.

## FX-Kontrol helper

Pure helper: `src/lib/finaleCakeDuration.ts`
- `resolvePrefire({ pftFromVdl, pfCol, firstShellLift, firstIsShell })`
- `classifyCakeShape({ shotCount, allAtOnce, firstIsShell, lastSameAsFirst })` → one of 8 case keys above
- `computeCakeDuration(input)` → `{ duration, prefireUsed, caseKey, liftAdjusted }`
- `shotSeparation({ cakeDuration, lastShotLiftIfShell, numberOfShots })`

Pure data-in/data-out; no parser coupling. Renderer wiring is a separate round.

Tests: `src/lib/__tests__/finaleCakeDuration.spec.ts`.
