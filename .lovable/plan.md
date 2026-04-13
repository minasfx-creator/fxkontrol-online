

# SkyCanvas Premium Opening — Cleanup and Visual Refinement

## Problem Analysis

After auditing the codebase, I identified these issues:

1. **PyroSafetyZones always renders default volumes** — A translucent purple cylinder (drone-airspace, `hsl(270, 60%, 55%)`) and a translucent blue box (audience-zone, `hsl(200, 70%, 50%)`) render at startup with 0.08 opacity. These are the "blue cylinder" and "rectangle" the user sees. They render unconditionally in `PyroSafetyZones.tsx`.

2. **Ground default is `synthetic-grass`** — A military camo pattern, not the premium dark green grass the user wants. The `GrassGround` (google-earth style) has better colors but is only used when `groundStyle === 'google-earth'`.

3. **Camera intro starts at Y=2500** looking down, then sweeps to `[0, 15, 150]` — the high altitude start shows empty terrain from above, which looks "pelado" (naked/barren).

4. **FloorLogo** renders "MINAS FX" branding on the ground — visible during opening, may feel like a placeholder.

5. **TreelineSilhouette** uses very dark, barely visible instanced planes — not contributing to premium feel.

6. **Scale poles and origin markers** render by default if their settings are true.

7. **FinaleAxesHelper** renders axis arrows visible in non-Google-Tiles mode.

## Plan

### 1. Hide PyroSafetyZones on startup (no show loaded)
**File: `src/components/editor/skycanvas/PyroSafetyZones.tsx`**
- Add early return: if no timeline items have heading/pitch AND no user-defined safety zones exist, render nothing (no default volumes)
- Move `DEFAULT_VOLUMES` to only render when user explicitly enables safety zones or when there are angled cues

### 2. Refine default ground to premium dark green grass
**File: `src/components/editor/skycanvas/GroundSystem.tsx`**
- Update `GrassGround` shader colors: shift from current Google Earth-style greens to deeper, more premium dark green tones (`vec3(0.02, 0.06, 0.02)` base range)
- Reduce near-field stripe intensity
- Make the default `groundStyle` more premium

**File: `src/store/useSceneStore.ts`**
- Change default `groundStyle` from `'synthetic-grass'` to `'google-earth'` (which uses the refined GrassGround shader)

### 3. Cinematic camera intro refinement
**File: `src/components/editor/SkyCanvas.tsx`**
- Change intro start position from `(0, 2500, 3)` → `(0, 80, 250)` — lower, closer, more cinematic
- Reduce hold phase duration from 2.5s → 1.0s (less time staring at empty sky)
- Reduce sweep duration from 4.0s → 2.5s (snappier transition)
- Adjust sweep start position to be closer to final position for smoother animation

### 4. Remove debug/helper geometry from default mode
**File: `src/components/editor/SkyCanvas.tsx`**
- Gate `FinaleAxesHelper` behind `showDebugOverlay` flag (currently always visible)
- Ensure scale poles and origin markers default to false

**File: `src/store/useSceneStore.ts`**
- Verify `showScalePoles` and `showOriginMarker` default to `false`

### 5. Improve atmosphere and lighting for opening
**File: `src/components/editor/skycanvas/GroundSystem.tsx`**
- Increase `GroundFog` default subtle presence for depth
- Refine `FloorLogo` opacity down further (0.15 → 0.08) so it's barely a ghost imprint

**File: `src/components/editor/SkyCanvas.tsx`**
- Ensure `DelayedMount` prevents heavy subsystems from flickering during first frames
- Add a brief fade-in on the Canvas container (CSS opacity transition from 0→1 over 300ms after `onCreated`)

### 6. Tonemapping and exposure tuning
**File: `src/components/editor/SkyCanvas.tsx`**
- Adjust `toneMappingExposure` from 1.5 → 1.2 for more cinematic, less blown-out opening
- Verify bloom/post-processing doesn't flare on empty scene

## Technical Details

- **Zero new dependencies** — all changes are refinements to existing shaders and component logic
- **No breaking changes** — safety zones still render when explicitly needed (angled cues exist)
- **Performance neutral** — removing default safety volumes and axes helper slightly reduces draw calls
- Files modified: ~5 files, primarily `PyroSafetyZones.tsx`, `GroundSystem.tsx`, `SkyCanvas.tsx`, `useSceneStore.ts`

