

# Fix Camera Altitude, Terrain Fallback, and Ground Flickering

## Root Causes Identified

1. **Camera sinks to ground**: `CAMERA_MIN_Y = 1` (1 meter) is far too low. OrbitControls `maxPolarAngle = 0.85π` allows near-horizontal views that orbit below terrain surface. No terrain-aware altitude clamping exists.

2. **Brown terrain flickering**: The `GrassGround` shader blends `brownEarth`, `dryField`, and parcel colors at close range. When Google 3D Tiles are loading, both `StageGround` (line 1686) and `GoogleTilesLayer` (line 1687) can render simultaneously during transition, causing z-fighting between the flat ground plane at Y=-0.02 and incoming 3D tiles.

3. **Z-fighting/depth issues**: `near=0.5` with `far=500000` creates massive depth range. Even with `logarithmicDepthBuffer`, ground surfaces at similar Y values fight for depth priority.

---

## Changes

### 1. Camera Altitude Lock — `SkyCanvas.tsx` CameraController

**In `clampToWorldBounds` (line 928-949):**
- Raise `CAMERA_MIN_Y` from `1` to `5`
- Add dynamic terrain-aware minimum: if Google 3D Tiles enabled, enforce minimum altitude of 5m above anchor altitude
- Add damping when camera approaches minimum altitude (soft floor instead of hard clamp)
- Log `[Camera] altitude clamped` when correction occurs

**In OrbitControls (line 1124-1138):**
- Change `maxPolarAngle` from `Math.PI * 0.85` to `Math.PI * 0.75` — prevents camera from orbiting too close to horizontal/below ground
- Change `minDistance` from `0.5` to `2` — prevents zooming into ground

### 2. Remove Ground Suction — `GeoCameraController.tsx`

- In orbit mode (line 103-113), clamp `camera.position.y` to minimum 5m after computing orbit position
- During flyTo animation, clamp intermediate positions to never go below minimum altitude

### 3. Terrain Fallback Control — `SkyCanvas.tsx` + `GroundSystem.tsx`

**In `SkyCanvas.tsx` (line 1686):**
- When Google 3D Tiles are enabled AND tiles are initializing, hide the `StageGround` component entirely rather than showing it alongside tiles
- Currently both render: `{!google3DTilesEnabled && <StageGround />}` + `{google3DTilesEnabled && <GoogleTilesLayer />}`. This is correct but the issue is during tile loading there's nothing visible — add a simple dark ground plane as ultra-minimal fallback only when tiles haven't loaded yet

**In `GoogleTilesEngine.tsx`:**
- Track tile load state (has any root tile loaded)
- Expose a `tilesReady` signal
- Until tiles are ready, keep a minimal non-flickering dark plane visible

### 4. Depth Fix — `SkyCanvas.tsx` Canvas config

**Line 1662:**
- Change `near` from `0.5` to `1.0`
- Keep `logarithmicDepthBuffer: true` (essential for this scale)

**In `GroundSystem.tsx` GrassGround (line 261):**
- Add `polygonOffset`, `polygonOffsetFactor={1}`, `polygonOffsetUnits={1}` to the ground shader material to push it behind 3D tiles in depth buffer
- Change ground Y position from `-0.02` to `-0.05` for more separation

### 5. Camera Speed Control — `SkyCanvas.tsx` CameraController

- In `clampToWorldBounds`, add altitude-dependent damping: when camera Y < 20m, multiply movement speed by `Math.max(0.3, camera.position.y / 20)`
- Prevent sudden altitude drops by clamping maximum Y-change per frame to 50m

### 6. Safe Mode Failsafe — `GoogleTilesEngine.tsx`

- If TilesRenderer throws during update, catch error, freeze last valid camera position, log `[Terrain] fallback blocked`
- Never show brown fallback plane — prefer black/transparent over incorrect terrain

---

## Files Modified

| File | Change |
|------|--------|
| `src/components/editor/SkyCanvas.tsx` | Raise CAMERA_MIN_Y to 5, maxPolarAngle to 0.75π, minDistance to 2, near to 1.0, add altitude damping and per-frame Y-delta clamp, add tilesReady-aware ground visibility |
| `src/core/geo/GeoCameraController.tsx` | Clamp Y in orbit mode, clamp flyTo intermediates |
| `src/core/geo/GoogleTilesEngine.tsx` | Add tilesReady state, wrap update() in try/catch, expose loading signal |
| `src/components/editor/skycanvas/GroundSystem.tsx` | Add polygonOffset to GrassGround material, lower Y position to -0.05 |

