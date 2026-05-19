# Finale 3D — Effects Coordinate System: Pan, Tilt, Spin

Last updated: April 29, 2026 (canonical doc date).

Effects (cakes, candles, shells, comets, fans, mines) use the **PTS** triple
**(Pan, Tilt, Spin)** — modeled on a moving-head light fixture's three degrees
of freedom. Positions (launch pads, DMX fixtures) use a different
representation: **HPR (Heading, Pitch, Roll)** — see
`coordenadas-rotacao-finale-3d-hpr-pts`.

## Mechanical model

With all angles zero, the head aims **straight up**, yoke facing the viewer.

| Angle | Axis (mechanical) | Description |
|---|---|---|
| **Pan**  | Rotation on the base                | Yoke rotates around vertical (face different compass directions) |
| **Tilt** | Rotation in the yoke                | Head pivots forward toward viewer |
| **Spin** | Rotation around the beam axis       | Gobo/cake-face rotates around the beam |

All three rotations obey the **Right Hand Rule**: thumb along the axis of
rotation, fingers curl in the positive-angle direction.

- Positive **pan** rotates the yoke to the right (CCW as seen from above).
- Positive **tilt** rotates the head toward the viewer.
- Positive **spin** rotates the gobo to the right (CCW looking along beam).

## Euler order (canonical)

```
v' = v · R1 · R2 · R3
R1 = Ry(spin)   // global Y-axis
R2 = Rx(tilt)   // global X-axis
R3 = Ry(pan)    // global Y-axis
```

Pan and spin share the **global Y-axis** — what distinguishes them is *when*
they happen. Spin is applied first (intrinsic to the head), pan is applied
last (positions the yoke). Reversing this order would break the moving-head
mechanical constraints: panning first would mean the yoke is no longer
facing forward when the global-X tilt is applied.

## Normalization ranges (Table 2)

| Angle | Canonical range |
|---|---|
| Pan   | `(-180°, +180°]` |
| Tilt  | `[0°, +180°]`    |
| Spin  | `(-180°, +180°]` |

**Gimbal lock at `tilt = 0°` or `tilt = 180°`:** pan and spin do the same
thing — rotation sequences where `pan + spin` (or `pan − spin`) sum to a
constant are equivalent. Finale 3D resolves the ambiguity by **choosing
`spin = 0°`** on conversion, giving a 1-to-1 mapping in the canonical ranges.

These ranges are **not enforced** in script columns — any value can be typed
in. Normalization is applied only on orientation-to-PTS conversion.

## Canonical worked examples

### Example 1 — Comet tilted 45° to the right (Figure 2)

```
Pan  =  90°    // rotate yoke to face right (so subsequent tilt is sideways)
Tilt =  45°    // pivot the head 45° to the right
Spin =  any    // comet is rotationally symmetric around beam
```

Naive intuition says `tilt=45, pan=0`, but with `pan=0` the yoke still faces
the audience, so the tilt would lean *toward* the audience, not to the right.

### Example 2 — Fan cake tilted 45° to the right (Figure 3)

```
Pan  =  90°
Tilt =  45°
Spin = -90°    // spin = -pan, so the fan still faces the audience
```

The fan has angular structure (a cake's row arrangement), so spin matters.
With `spin = 0`, the fan would face right (matching the panned yoke) instead
of the audience. **`spin = -pan` rolls the fan back to audience-facing while
tilted.**

## Helper API (`src/lib/finalePanTiltSpin.ts`)

Pure data-in/data-out. No mutation, no globals.

- `normalizePan(deg)`, `normalizeTilt(deg)`, `normalizeSpin(deg)` — map
  arbitrary input into the canonical ranges of Table 2 (pan/spin
  `(-180, +180]`, tilt `[0, 180]` via reflection).
- `normalizePTS({ pan, tilt, spin }) → PTS` — applies all three; collapses
  gimbal-lock cases to `spin = 0` while preserving the resulting beam
  orientation by folding spin into pan.
- `ptsToMatrix({ pan, tilt, spin }) → number[16]` — column-major 4×4 in the
  canonical order `Ry(pan) · Rx(tilt) · Ry(spin)` applied to a column vector
  (equivalent to the doc's `v · R1·R2·R3` for row vectors).
- `ptsBeamDirection({ pan, tilt, spin }) → [x, y, z]` — the unit beam vector
  after rotation. Comet/shell aim direction. With all zeros: `[0, 1, 0]`.
- `audienceFacingSpinForTilted(pan)` returns `−pan` — the canonical roll-back
  for fan cakes / cakes with angular structure.
