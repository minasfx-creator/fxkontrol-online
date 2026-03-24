

# GeoCameraController + Client Presentation Mode

## Three Features in One Delivery

### 1. GeoCameraController — Cinematic FlyTo with Google Earth

The existing `geoCamera.ts` already has `flyTo()` with Bezier arcs. What's missing is a **R3F component** that connects it to the scene when Google 3D Tiles are active, with preset cinematic routes.

**New file: `src/core/geo/GeoCameraController.tsx`**
- R3F component using `useFrame` to call `updateFlyTo()`
- Exposes `flyToLocation(lat, lng, alt, opts)` via a Zustand action or ref
- Preset cinematic locations (Angra dos Reis, Copacabana, custom GPS from scene)
- `orbitAround(target, radius, speed)` — smooth circular orbit for presentation mode
- Auto-enables when `google3DTilesEnabled` is active

**Modify: `src/components/editor/SkyCanvas.tsx`**
- Mount `<GeoCameraController />` inside Canvas when Google 3D Tiles enabled
- Add "Fly To" dropdown in viewport toolbar with preset locations + current GPS anchor

### 2. Google Earth Toggle Verification

**Modify: `src/components/editor/SceneEditorPanel.tsx`**
- When toggling Google Earth ON, also auto-set `floatingOriginEnabled: true` (already done)
- Add visual feedback: loading spinner while tiles initialize, success indicator when first tiles render
- Show tile count from GeoHUD in the panel

### 3. Client Presentation Mode — Fullscreen Cinematic

**New file: `src/components/editor/ClientPresentationMode.tsx`**
- Full-screen overlay (portal to body) that hides ALL editor UI
- Shows only: 3D viewport + show name watermark + time counter
- Auto-starts a cinematic camera sequence:
  1. Wide establishing shot (high altitude orbit)
  2. Swoops down to show area
  3. Locks onto launch zone as timeline plays
  4. Returns to wide orbit during finale
- Uses existing `CameraAnimator` keyframe system internally, generating keyframes from GPS anchor
- ESC or click to exit
- Play/pause timeline automatically on enter/exit

**New file: `src/core/camera/cinematicSequencer.ts`**
- `generateCinematicKeyframes(lat, lng, duration)` — creates a 4-phase camera path
- Phase 1 (0-15%): High orbit establishing shot
- Phase 2 (15-25%): Swoop descent to venue
- Phase 3 (25-85%): Slow orbit at show altitude, following action
- Phase 4 (85-100%): Pull back to wide shot for finale

**Modify: `src/components/editor/SkyCanvas.tsx`**
- Add presentation mode state
- Button in viewport toolbar: 🎬 "Apresentação" — enters presentation mode
- When active, force Google Earth ON + fullscreen + auto-play

### Files Changed

| File | Action |
|---|---|
| `src/core/geo/GeoCameraController.tsx` | **New** — R3F flyTo controller |
| `src/core/camera/cinematicSequencer.ts` | **New** — auto-generate cinematic keyframes |
| `src/components/editor/ClientPresentationMode.tsx` | **New** — fullscreen presentation overlay |
| `src/components/editor/SkyCanvas.tsx` | Mount GeoCameraController + presentation mode trigger |
| `src/store/useSceneStore.ts` | Add `presentationMode: boolean` setting |

### What is NOT Changed

- Existing `geoCamera.ts` flyTo system — reused as-is
- `CameraAnimator.tsx` — reused for keyframe playback
- `GoogleTilesEngine.tsx` — no modifications
- Lockstep / ExecutionBridge / timeline engine — untouched

