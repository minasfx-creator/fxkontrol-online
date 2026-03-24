

# Apply Camera/Terrain Stabilization Fixes

## Issues Found in Current Code

1. **Log spam**: `[Camera] altitude clamped to safe floor` fires every frame when camera Y < 6 — floods console, degrades performance
2. **FlyControls inconsistency**: Line 909 clamps camera Y at `0.5` instead of `5` — bypasses the CAMERA_MIN_Y safety
3. **Depth buffer**: `logarithmicDepthBuffer: true` with `far=500000` creates precision issues causing z-fighting on ground surfaces. Should use standard depth with reduced far plane
4. **WORLD_HALF_EXTENT**: Currently 80,000 but should be 250,000 to match the geo-scale system

## Changes

### 1. Fix log spam — `SkyCanvas.tsx` clampToWorldBounds (~line 956)
- Only log altitude clamp warning once per transition (not every frame)
- Add a ref `_wasClampedLastFrame` to track state, log only on rising edge

### 2. Fix FlyControls Y clamp — `SkyCanvas.tsx` (~line 909)
- Change `Math.max(0.5, camera.position.y)` to `Math.max(5, camera.position.y)`

### 3. Depth buffer optimization — `SkyCanvas.tsx` (~line 1676-1684)
- Set `logarithmicDepthBuffer: false`
- Change `far` from `500000` to `30000`
- Keep `near` at `1.0`

### 4. Expand world bounds — `SkyCanvas.tsx` (~line 927)
- Change `WORLD_HALF_EXTENT` from `80000` to `250000`
- Change `CAMERA_MAX_Y` from `75000` to `40000` (more reasonable ceiling)

## Files Modified

| File | Change |
|------|--------|
| `src/components/editor/SkyCanvas.tsx` | Fix log spam, FlyControls Y clamp, depth buffer config, world bounds |

