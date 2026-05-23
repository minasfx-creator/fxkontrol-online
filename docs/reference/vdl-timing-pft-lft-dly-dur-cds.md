# VDL Timing Adjustment Terms — PFT, LFT, DLY, DUR, CDS

Reference: Visual Descriptive Language (VDL) Documentation, "VDL timing
adjustment terms (PFT, LFT, DLY, DUR, CDS)", last updated 2023-09-12.

This doc is the canonical FXKONTROL summary of the five VDL timing terms
and their **scope** (how much of the VDL phrase each term applies to).

---

## Table 1 — terms

| Term | Meaning | Rule | Example | Scope |
|------|---------|------|---------|-------|
| `PFT` | Prefire | `< 0.5` → delay before simulation; `≥ 0.5` → aerial shell lift time | `50mm 1.5 PFT Red Peony` | Effect |
| `LFT` | Lift delay | Aerial shell lift time (overrides PFT) | `50mm 1.5 PFT 1.75 LFT Red Peony` | Shot |
| `DLY` | Delay before simulation | Latency from ignition to start of simulation | `50mm 10 Shot 10s Cake 2.0 DLY Red Comet` | Effect |
| `DUR` | Duration | Aerial shells in cakes → star duration; mines/comets → rising effect duration | `50mm 10 Shot 10s Cake .75 DUR Red Peony` | Shot part (cakes/candles only) |
| `CDS` | Chain delay seconds | Delay between previous shell and this shell in a chain | `3″ 7s Chain of 3 Red Peony + 3.0 CDS White Peony + 4.0 CDS Blue Peony` | Shot (chains only) |

---

## PFT — Prefire

“Prefire” = time from firing system ignition to the music-synchronized
effect time. For aerial shells this is usually the lift time. VDL collapses
the two with the rule:

- `PFT < 0.5` → delay before simulation (latency).
- `PFT >= 0.5` → aerial shell lift time.

Works for combo effects (`RED PEONY w/ BLUE MINE`, etc.): small PFT syncs
the launch of the mine; larger PFT syncs the shell break.

## LFT and DLY — explicit overrides

When the heuristic above is insufficient, `LFT` and `DLY` set lift time and
delay before simulation explicitly, taking precedence.

Example — bombette roman candle (1.0s fuse, 2.0s between shots, 3.0s lift):

```
50mm 21.0s 4.0 PFT 10 Shot RC 1.0 DLY Pink Peony w/ Green Mine 3.0 LFT
```

- `3.0 LFT` → shell lift time.
- `1.0 DLY` → fuse delay before first launch.
- `4.0 PFT` → aligns prefire with first break (1.0 + 3.0 = 4.0).

To sync the music to the mine launch instead of the shell break, change
`4.0 PFT` → `1.0 PFT`.

## DUR

In cakes / multi-shot candles, the top-level duration (`21.0s` above) is
**shot timing** (first launch → last break), not star duration. `DUR`
specifies the star duration of the shot part:

```
50mm 21.0s 4.0 PFT 10 Shot RC 1.0 DLY Red Peony 1.25 DUR 3.0 LFT
```

## CDS

Chain duration = first → last shot. With `CDS` you set the individual gap
before each shell after the first:

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

## Scope rules

| Term | Scope | Notes |
|------|-------|-------|
| `PFT` | **Effect** | One prefire per effect; placement in the VDL phrase is irrelevant. |
| `DLY` | **Effect** | One delay-before-simulation per effect; placement irrelevant. |
| `CDS` | **Single chain shot** | Applies to the shot between the `+` separators it sits inside. |
| `DUR` | **Shot part** (cakes/candles only) | Combo like `RED PEONY w/ BLUE MINE 1.5 DUR` → 1.5s applies only to the mine stars. |
| `LFT` | **Whole shot** | Applies to the aerial shell of the shot (only one shell per shot), so position inside the shot is irrelevant. |

## Using LFT to override the prefire on the first shell of a cake

The prefire of a cake, when `≥ 0.5s`, becomes the **default lift time of
the first effect** if that effect is a shell, but does not affect default
lift times of subsequent effects (which may differ). For 11-shot dahlia
cakes with a sub-second prefire intended only as latency, this can cause
the first shell to break on the way up.

Fix by inserting an explicit `LFT` on the first ingredient:

```
30mm 0.6 PFT 11 Shot Cake
  (a) 1.6 LFT Red Dahlia w/ Red Tail
  + (b) Green Dahlia w/ Green Tail
  + (c) Blue Dahlia w/ Blue Tail
  ...
  + (k) Fuchsia Dahlia w/ Fuchsia Tail,
  1 Row (abcdefghijk/FNT)
```

`(a) 1.6 LFT` overrides the inherited 0.6 PFT default for the first
ingredient only.

---

## FXKONTROL parser coverage

Top-level `PFT / LFT / DLY / DUR / CDS` are already parsed by
`src/lib/vdlParser.ts` (effect-scope terms).

Per-segment overrides inside cake ingredient lists
(`(a) 1.6 LFT Red Dahlia`, `(b) 25 HTM 2.3 DUR Red Mine`,
`(c) 0.4 DLY Blue Comet`) are extracted by
`src/lib/vdlCakeSegments.ts` into:

```ts
interface CakeSegment {
  label: string;
  body: string;
  htmOverride: number;   // -1 if absent
  durOverride: number;   // -1 if absent
  lftOverride: number;   // -1 if absent (NEW)
  dlyOverride: number;   // -1 if absent (NEW)
}
```

Renderer wiring (using `lftOverride` / `dlyOverride` to shift per-segment
firing time inside `FireworkRenderer.tsx`) is intentionally deferred — the
parser exposes the data; no real timing is changed by this round.
