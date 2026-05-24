# VDL — HTM, DUR, Degrees (per-effect height, duration, fan angle)

> **Source:** Finale 3D VDL Documentation — "Specifying the height, duration,
> and fan angle of effects in the cake" (last updated Sep 12, 2023).
>
> **Canonical implementation:**
> - `src/lib/vdlCakeSegments.ts` (`parseCakeSegments`, `parseCakeSegment`)
> - `src/lib/vdlParser.ts` (fields `htmOverride`, `fanAngleDeg`, `cakeSegments`)
> - Tests: `src/lib/__tests__/vdlCakeSegments.spec.ts`

A cake description carries a single overall `<N>m` height and `<N>s`
duration that apply to the **cake itself** (first ignition → last break,
not per-shot lifetime). To control **per-ingredient** values inside a
cake we use three additional VDL terms:

| Term       | Unit    | Scope                                | Example       |
|------------|---------|--------------------------------------|---------------|
| `DUR`      | seconds | duration of an individual effect     | `2.3 DUR`     |
| `HTM`      | meters  | height ("height in meters") of effect | `25 HTM`     |
| `Degrees`  | degrees | cake-level fan angle                 | `130 Degrees` |

## Grammar

```text
CakeVDL    := <CakeHeader> <Ingredients> <RowsBlock>
CakeHeader := [Caliber] [<N>s] <N> Shot [<N>m] [<N> Degrees] [Fan] Cake
Ingredients:= Segment ( '+' Segment )*
Segment    := [ '(' label ')' ] [<N> HTM] [<N> DUR] <EffectVDL>
```

* `DUR` / `HTM` appear **inside** a segment, between the optional `(label)`
  and the effect body. Order is conventional but the parser accepts both.
* `Degrees` appears in the **cake header**, before `Fan Cake` /
  `Cake`. It only applies to rows that have angles (Fan/Angle patterns).

## Examples (from spec)

### Cake duration vs. per-effect DUR

Cake length 10s; **per-effect** Red Mine lasts 2.3s:

```text
50mm 10s 100 Shot 100m Fan Cake
  (a) Gold Tail + (b) 2.3 DUR Red Mine
  10 Rows Row 1,2,3,4,5,6,7,8,9,10 (ababababab)
```

### Per-effect height (HTM) for mixed mines + comets

Cake height 100m, but the Red Mine is overridden to 25m:

```text
50mm 10s 100 Shot 100m Fan Cake
  (a) Gold Tail + (b) 25 HTM Red Mine
  10 Rows Row 1,2,3,4,5,6,7,8,9,10 (ababababab)
```

### Cake-level fan angle (Degrees)

```text
50mm 10s 100 Shot 100m 130 Degrees Fan Cake
  (a) Gold Tail + (b) Red Mine
  10 Rows Row 1,2,3,4,5,6,7,8,9,10 (ababababab)
```

`130 Degrees` overrides any default fan spread for rows whose firing
pattern produces angled tubes (see `docs/reference/vdl-firing-patterns.md`).

## Parsed shape

`parseCakeSegments(raw)` returns:

```ts
{
  fanAngleDeg: number,   // -1 if no `<N> Degrees` term
  segments: Array<{
    label: string,       // 'a' | 'b' | '' (no `(x)` prefix)
    body: string,        // residual VDL after stripping (label)+HTM+DUR
    htmOverride: number, // meters, -1 if absent
    durOverride: number, // seconds, -1 if absent
  }>,
}
```

`vdlParser.parseVDL(raw)` additionally exposes:

* `result.htmOverride` — top-level `<N> HTM` (rare; used when a single
  ingredient cake or a stand-alone effect specifies height in HTM).
  When present it **overrides** the legacy `<N>m` height parse.
* `result.fanAngleDeg` — cake-level `<N> Degrees`.
* `result.cakeSegments` — per-ingredient array (empty when the VDL
  isn't a multi-ingredient cake list).

## Compatibility

* The top-level `DUR` parsing in `vdlParser.parseVDL` is **unchanged**;
  it still sets `result.durOverride` and applies it to `result.duration`.
* HTM at the top level now **takes precedence** over the legacy `<N>m`
  height term, matching the spec ("HTM specifies the height in meters of
  an individual effect").
* Per-segment HTM/DUR are **parsed and exposed** on `result.cakeSegments`
  but are **not yet wired** into the renderer (`SkyCanvas3D` /
  `FireworkRenderer`). Wiring per-ingredient height/duration into spawn
  payloads is tracked as a follow-up round and must preserve the
  Reliability Engineering contract: simulation = execution = reality.

## Non-goals (intentional)

* This parser does NOT mutate `caliberMM`, modifier flags, or trail
  inference based on HTM/DUR — those remain governed by the canonical
  per-effect lookup (`vdlParser`).
* `Degrees` is **not** rotated into per-tube angles here; that is the
  responsibility of `vdlFiringPatterns.computeRowFiring({ fanAngleDeg })`.
