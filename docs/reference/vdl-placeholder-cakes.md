# VDL Placeholder Cakes

Source: Finale 3D VDL Documentation — "Creating or importing a simple
'placeholder' cake simulation" (Last updated May 29, 2024).

Placeholder cakes let a designer simulate a consumer cake (e.g. *Galactic
Gladiator*) using only the metrics they have on hand. The full VDL grammar
for cakes (see `vdl-cake-descriptions.md`) is **not** required.

## Canonical template

```
<size> <count> Shot <duration>s [<prefire>s PFT] [<height>m] <effect> Cake [<firing pattern>] [<N> Rows]
```

Examples:

```
30mm 49 Shot 10s Time Rain Comet Cake Z-Shape
30mm 49 Shot 10s 2.1s PFT 90m Multi-Color Peony Cake Z-Shape
50mm 10 Shot Aerial Time Rain Cake
49 Shot Multi-Color Peony Cake Z-Shape       # CSV: size/duration/PFT/height in columns
```

## Table 1 — Basic cake metrics

| Term            | Format                                                                                                                              | Example         |
|-----------------|-------------------------------------------------------------------------------------------------------------------------------------|-----------------|
| Size            | Caliber + `mm`, `"`, or `inches`                                                                                                    | `3"` / `75mm`   |
| Number of shots | `<N> Shot`. ≤10 shots ⇒ single-row slice cake. Optional `<N> Rows` after `Cake` overrides.                                          | `10 Shot`       |
| Duration        | First shot → last break, in seconds: `<n>s` or `<n> seconds`                                                                        | `10s` / `2.5s`  |
| Height          | Lift in meters: `<n>m`                                                                                                              | `90m`           |
| Prefire         | `<n>s PFT`. `<0.5` ⇒ delay-before-simulation; `≥0.5` ⇒ aerial shell lift time.                                                      | `2.3s PFT`      |
| Firing pattern  | Blank (straight up), `Z-Shape`, `X-Shape`, `Fan`, or `FNR` (= fan-to-right-in-sequence, vs. `Fan` which is simultaneous per row).   | `Fan`           |

## Aerial vs rising

Ambiguous body effects (`Time Rain`, `Crossette`, ...) inside a cake parse as
**rising effects** (comets) by default. Add `Shell` or `Aerial` to force the
shell interpretation:

```
50mm 10 Shot Aerial Time Rain Cake   # 10 shells of time-rain stars
50mm 10 Shot Time Rain Cake          # 10 time-rain comets
```

## CSV column split

If `size`, `duration`, `height`, and `prefire` live in their own CSV columns,
the description shrinks to the effect + cake keyword + firing pattern. The
**shot count cannot** be column-split — `<N> Shot` must remain in the
description.

## Parser mapping (`src/lib/vdlParser.ts`)

| Doc concept              | Parser field           | Notes                                                                  |
|--------------------------|------------------------|------------------------------------------------------------------------|
| `<N> Shot`               | `shotCount`            | `SHOT_COUNT_REGEX`                                                     |
| `<N> Rows`               | `cakeRows`             | `ROW_COUNT_REGEX`; placeholder cake override                           |
| `<n>s` (cake duration)   | `cakeDuration`         | First shot → last break                                                |
| `<n>m`                   | `height` (typed)       | `HEIGHT_REGEX` + `getTypedHeight`                                      |
| `<n>s PFT`               | `prefire` (typed)      | `getTypedPrefire`                                                      |
| Firing pattern           | `firingPattern`        | `BODY_FIRING_PATTERNS`: `z-shape`, `x-shape`, `fan`, `fnr`, ... blank if straight-up |
| `Aerial` / `Shell` + Cake| `isAerial = true`      | Forces shell interpretation of rising-default body effects             |
| Bare cake (no pattern)   | `firingPattern = ''`   | Empty string = straight up                                             |

VDL handles complex multi-row / multi-effect cakes too (see
`vdl-cake-descriptions.md`); Table 1 is the *placeholder* subset that is
usually enough for scripting.
