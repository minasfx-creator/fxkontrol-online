

# Plan: Wire VDL Properties Through Rendering Pipeline

## Problem
The VDL parser now outputs `angleOffset`, `trailType`, `noTrail`, `caliber`, `firingPattern`, `shotCount`, `hasPistil`, `pistilColor`, `colorTransition`, `impliesTrail`, `multiColors`, and adjustment factors — but **none of these reach the effect renderers**. The `SkyCanvas.tsx` `TimelineEffects` function (line 835) renders effects with minimal props:

```
// Current — ignores all VDL metadata
if (pt === 'mine') return <MineEffect position={pos} color={effect.color} progress={progress} />;
if (pt === 'cake') return <CakeEffect position={pos} color={effect.color} progress={progress} shotCount={25} />;
```

Additionally, `vdlToEffect()` (line 760) drops most VDL fields — it only returns `color`, `duration`, `pattern`, `caliber`, `heightMeters`, `prefire`, `safetyDistance`. The `Effect` interface lacks VDL rendering fields.

## Changes

### 1. `src/store/useProjectStore.ts` — Extend `Effect` interface
Add VDL rendering fields so they can flow through the pipeline:
- `angleOffset?: number`
- `trailType?: string`
- `noTrail?: boolean`
- `hasPistil?: boolean`
- `pistilColor?: string`
- `colorTransition?: string`
- `secondaryColor?: string`
- `firingPattern?: string`
- `impliesTrail?: boolean`

### 2. `src/lib/vdlParser.ts` — Expand `vdlToEffect` return
Add the new fields to the returned object so VDL-created effects carry their metadata into the store:
- `angleOffset`, `trailType`, `noTrail`, `hasPistil`, `pistilColor`, `colorTransition`, `secondaryColor` (from `colors[1]` or multiColors), `firingPattern`, `impliesTrail`, `shotCount`

### 3. `src/components/editor/SkyCanvas.tsx` — Wire VDL props to renderers
Update `TimelineEffects` (lines 835-866) to pass VDL properties from the `effect` object:

- **MineEffect**: pass `caliber`, `angleOffset`, `heightMeters`
- **CometEffect**: pass `caliber`, `angleOffset`
- **CakeEffect**: pass `caliber`, `firingPattern`, `shotCount`
- **GerbEffect**: pass `caliber` (scale height/count)
- **WaterfallEffect**: pass `caliber` (scale width/density)
- **RomanCandleEffect**: pass `caliber`, `angleOffset`
- **FanEffect**: pass `caliber`
- **MultiBurstEffect**: pass `caliber`
- **PrefireShell**: pass `angleOffset`
- **FireworkBurst**: pass `trailType`, `noTrail`, `hasPistil`, `pistilColor`, `colorTransition`, `secondaryColor`, `angleOffset`

### 4. Effect Components — Accept and apply new props

**`GerbEffect.tsx`** — Add `caliber` prop: scale `PARTICLE_COUNT` and `height` based on caliber.

**`WaterfallEffect.tsx`** — Add `caliber` prop: scale `PARTICLE_COUNT` and `width`.

**`RomanCandleEffect.tsx`** — Add `caliber` and `angleOffset` props: scale star height and apply trajectory tilt.

**`FanEffect.tsx`** — Add `caliber` prop: scale ray height and particle count.

**`MultiBurstEffect.tsx`** — Add `caliber` prop: scale burst size.

**`PrefireShell.tsx`** — Add `angleOffset` prop: tilt the rising comet trail to match VDL angle.

**`ShellExplosionManager.tsx`** — Add `angleOffset` and `noTrail` to `ShellConfig` interface, pass through to `ShellBurstRenderer` and `PrefireShell`.

**`FireworkBurst` (in SkyCanvas.tsx)** — Accept `angleOffset`, `trailType`, `noTrail`, `secondaryColor`, `colorTransition`. Apply `angleOffset` as group rotation. Pass trail/color data to star rendering logic.

### 5. `MineEffect.tsx` and `CometEffect.tsx` — Apply angleOffset rotation
Both already accept `angleOffset` as a prop but **don't use it**. Add `<group rotation={[0, 0, angleOffsetRad]}>` wrapper to tilt the particle group.

## Files Summary

| File | Change |
|------|--------|
| `useProjectStore.ts` | Add VDL rendering fields to `Effect` interface |
| `vdlParser.ts` | Expand `vdlToEffect` return with VDL metadata |
| `SkyCanvas.tsx` | Wire VDL props in `TimelineEffects` + `FireworkBurst` |
| `MineEffect.tsx` | Apply angleOffset rotation |
| `CometEffect.tsx` | Apply angleOffset rotation |
| `GerbEffect.tsx` | Add caliber scaling |
| `WaterfallEffect.tsx` | Add caliber scaling |
| `RomanCandleEffect.tsx` | Add caliber + angleOffset |
| `FanEffect.tsx` | Add caliber scaling |
| `MultiBurstEffect.tsx` | Add caliber scaling |
| `PrefireShell.tsx` | Add angleOffset tilt |
| `ShellExplosionManager.tsx` | Add angleOffset + noTrail to ShellConfig |

