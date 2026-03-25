

## Fix: Remove old 3D world blocking and ensure Google Earth visibility

### Problem
`google3DTilesEnabled` is `true` by default, which suppresses all synthetic sky, ground, fog, stars, and atmosphere. When Google Earth 3D Tiles fail to load (API key fetch failure, network issue, or library error), the viewport is completely black with no fallback.

### Solution

**1. Add fallback sky/lighting when Google Earth is active** (`SkyCanvas.tsx`)
- The `GoogleEarthLighting` component already exists and renders a `<Sky />` backdrop + hemisphere/ambient lights, but ONLY when `google3DTilesEnabled` is true. This is correct.
- The issue is likely that the `MissionSetupOverlay` blocks the viewport before the scene even renders, AND the camera starts at a position that can't see the tiles.

**2. Remove MissionSetupOverlay gate** (`SkyCanvas.tsx`)
- The `MissionSetupOverlay` blocks ALL viewport interaction until confirmed. Remove it so the scene loads immediately.

**3. Ensure camera far plane reaches Google Earth scale** (`SkyCanvas.tsx`)
- Current `far={50000}` — increase to `500000` (500km) for Google Earth tile visibility at orbital distances.

**4. Add visible fallback ground when tiles haven't loaded** (`SkyCanvas.tsx`)
- Show a simple ground plane or grid as fallback even when `google3DTilesEnabled` is true, so the user always sees something.

**5. Clean up old synthetic world remnants**
- Remove the duplicate `SkyAtmosphereV2Layer`, `VolumetricCloudLayer`, `WaterLayer`, `GroundDecalManager` definitions inside SkyCanvas.tsx (lines 324-476) — they duplicate the ones in `skycanvas/SkyEnvironment.tsx`.
- Remove the duplicate `SkyGradient` shader (lines 503-736) that creates the old dark-sky world.

### Files to modify
- **`src/components/editor/SkyCanvas.tsx`**: Remove MissionSetupOverlay, increase camera far, add fallback ground, clean duplicate components
- **`src/core/geo/GoogleTilesEngine.tsx`**: Add error state + fallback notification when tiles fail

### Technical details
- Camera `far` increased from 50000 to 500000
- Remove `missionConfirmed` state and `MissionSetupOverlay` render
- Add a simple `<Grid>` or flat plane visible when `google3DTilesEnabled && !tilesReady`
- Keep `GoogleEarthLighting` as-is (it already provides sky backdrop)

