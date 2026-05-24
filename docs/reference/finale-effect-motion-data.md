# Finale 3D — Effect Data & Motion Data fields

Source: Finale 3D documentation, "Effects Overview / Effect Data and Motion Data" (last updated 2022-08-28).

Status: **pinned** — `src/lib/finaleEffectData.ts` implements the canonical parser/serializer; tests in `src/lib/__tests__/finaleEffectData.spec.ts` enforce Table 1.

---

## Overall shape

Both fields share the same envelope:

```
{ [attr [v0 v1 v2 …]] [attr [v0 v1 v2 …]] … }
```

- Outer `{ … }` is the object.
- Each child `[name [values…]]` is an attribute. Whitespace separates tokens; no commas.
- Values are integers or floats.
- `Motion Data` (on positions) uses absolute show-time milliseconds. `Effect Data` (on script effects) uses milliseconds **relative to the start of the effect**.
- `rgb` is allowed only in **Effect Data**.

---

## Table 1 — attributes

| Attr | Tuple stride | Per-sample fields | Where | Notes |
|---|---|---|---|---|
| `pos`   | 4 | `t ms`, `x m`, `y m`, `z m` | both | Linear interp between samples. If first t > 0, implicit `(0,0,0)` at t=0. After last sample, value is held. |
| `pos2`  | 4 | `t ms`, `x m`, `y m`, `z m` | both | Same syntax as `pos`. Rotated by current `hpr` (if present), then added to `pos`. |
| `hpr`   | 4 | `t ms`, `h °`, `p °`, `r °` | both | Per-component scalar interp (NOT slerp). Angles unbounded → `3600` = ten full turns. Identity at t=0 implicit. |
| `hpr2`  | 4 | `t ms`, `h °`, `p °`, `r °` | both | Composed AFTER `hpr` in `hpr`'s local frame. Does NOT rotate `pos`/`pos2`. Arm analogy: `hpr` = elbow, `hpr2` = wrist. |
| `rgb`   | 2 | `t ms`, `int24` | Effect Data only | 0xRRGGBB packed; R=bits16-23, G=bits8-15, B=bits0-7. Implicit black at t=0 if first t > 0. Applies only when VDL color term is `ScriptRGB`. |
| `hash`  | 1 | `int32` | both | Optional optimization. Hash of payload excluding the hash itself. Manual data should omit. |

---

## Examples

Wheel: 0.5m radius spoke, 10 clockwise turns over 10 s.
```
{[pos2 [0 .5 0 0]] [hpr [10000 0 0 -3600]]}
```

ScriptRGB color animation in an Effect Data:
```
{[rgb [0 255 10000 65280]]}
```
At t=0 ms → blue (0x0000FF); at t=10000 ms → green (0x00FF00); linear RGB interp.

---

## Parsing rules pinned by tests

1. Tokens are split on whitespace; brackets `[ ]` and braces `{ }` are their own tokens.
2. Unknown attributes are preserved as-is (no schema error) — Finale 3D may add fields.
3. `pos`/`pos2`/`hpr`/`hpr2` sample lists MUST have length `4·N`; reject mid-tuple lengths.
4. `rgb` sample list MUST have length `2·N`.
5. `hash` MUST be a single integer.
6. Sample lists may be empty (`[pos []]`).
7. Times within a list MUST be monotonically non-decreasing; parser warns but does not throw.
8. Serialization round-trips (parse → serialize → parse) is byte-stable for canonical input.

## Interpolation rules

- `pos` / `pos2`: linear per axis.
- `hpr` / `hpr2`: linear per H, P, R component **independently**, then orientation reconstructed from those scalars. This is what enables multi-cycle "spin" (e.g., `r = 3600` over 10 s = 360 rpm).
- `rgb`: linear per channel.
- Before first sample: `pos`/`pos2` = `(0,0,0)`; `hpr`/`hpr2` = identity (`0,0,0`); `rgb` = `0x000000`.
- After last sample: held.

## Frame composition

Final world transform for an animated effect with all four motion attrs:

```
world = T(pos)           // position over time
      · R(hpr)            // orient and rotate the pos2 frame
      · T(pos2)           // spoke offset, rotated by hpr
      · R(hpr2)           // local "wrist" rotation, doesn't move pos2
```
