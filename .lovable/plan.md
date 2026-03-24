

# Google Earth 3D Tiles Integration — FXK Digital Twin

## Overview

Transform the FXK viewport from a flat satellite overlay into a full **Google Photorealistic 3D Tiles** digital twin, where clients see their fireworks show in the real-world venue with buildings, terrain, and water.

## What Already Exists

| Component | Status |
|---|---|
| GeoEngine Worker (WGS84→ECEF→ENU→Local) | Done |
| FloatingOrigin engine | Done |
| GeoCamera flyTo system | Done |
| Sun position engine | Done |
| GeoHUD telemetry | Done |
| GeoSearchPanel (presets) | Done |
| Satellite 2D overlay (Static Maps) | Done |
| `get-maps-key` edge function | Done |
| `GOOGLE_MAPS_API_KEY` secret | Configured |

## What Needs to Be Built

### Step 1: Install `3d-tiles-renderer` (v0.4.x)

Add `3d-tiles-renderer` to package.json. This NASA JPL library has native Three.js and R3F support, handles Google Photorealistic Tiles out of the box, and manages tile LOD, loading, and disposal internally.

### Step 2: Create `src/core/geo/GoogleTilesEngine.tsx`

R3F component that:
- Fetches the Google Maps API key from the `get-maps-key` edge function on mount
- Creates a `TilesRenderer` with `GoogleCloudAuthPlugin` using that key
- Adds `TileCompressionPlugin` (KTX2/Draco), `TilesFadePlugin` (smooth pop-in), `UpdateOnChangePlugin`, and `UnloadTilesPlugin` (VRAM management)
- Positions the tileset using the existing `geoToLocalSync` to convert the scene's geo anchor to the tileset's coordinate system
- Applies an ENU rotation matrix so tiles align with the FXK local coordinate system (X=East, Y=Up, Z=-North)
- Updates the `GeoHUD` data (tilesLoaded, vramPressure) each frame via `updateGeoHUD()`

```text
Architecture:
┌─────────────────────────┐
│  SkyCanvas              │
│  ├─ <GoogleTilesLayer/> │  ← new R3F component
│  │   ├─ TilesRenderer   │
│  │   ├─ Auth Plugin      │
│  │   └─ VRAM Manager    │
│  ├─ <StageGround/>      │  ← hidden when tiles active
│  ├─ <FireworkBurst/>    │
│  └─ ... existing scene  │
└─────────────────────────┘
```

### Step 3: Coordinate Alignment (Critical)

Google 3D Tiles use a WGS84 ellipsoidal coordinate system. The tileset root has a `transform` matrix in ECEF. To align with FXK's local ENU frame:

1. Compute ECEF position of the geo anchor using existing `geoToECEF()`
2. Build a 4x4 matrix that translates ECEF origin to anchor, then rotates from ECEF to ENU
3. Apply as `tilesRenderer.group.matrixWorld`
4. When floating origin recenters, update this matrix — no jitter

This reuses the existing `floatingOriginEngine.ts` and `geoEngine.worker.ts` math without modification.

### Step 4: Toggle in Scene Settings & StageGround

- Add `google3DTilesEnabled: boolean` to `SceneSettings` in `useSceneStore.ts`
- When enabled, hide the flat `StageGround` (concrete/grass) and show `<GoogleTilesLayer/>`
- Add a toggle in `SceneEditorPanel.tsx` next to the existing Floating Origin toggle

### Step 5: Terrain Height Query (Snap to Terrain)

Create `getTerrainHeight(lat, lng)` using raycasting against the tiles mesh group:
- Cast a ray downward from (lat,lng, +1000m) onto the tiles geometry
- Return intersection Y as ground height
- Used by barges, launch points, and drones for ground-lock

### Step 6: VRAM & Performance Management

- Set `tilesRenderer.errorTarget` (screen-space error) based on the existing Adaptive Quality Controller tier:
  - Ultra: SSE 4 → maximum detail
  - High: SSE 8
  - Medium: SSE 16
  - Low: SSE 32 → fast on weak GPUs
- Set `maxCacheBytes` and `maxVisibleBytes` to cap VRAM (default 512MB visible, 1GB cache)
- Feed tile stats into GeoHUD via `updateGeoHUD({ tilesLoaded, vramPressure })`

### Step 7: UI — Toggle Button

Add a "Google Earth" toggle button in the viewport toolbar (next to existing "Cenário Real" satellite button). When clicked:
- Enables `google3DTilesEnabled` + `floatingOriginEnabled`
- Triggers `flyTo` to the current geo anchor at 500m altitude
- Shows toast: "Digital Twin carregado"

## Files Changed

| File | Action |
|---|---|
| `package.json` | Add `3d-tiles-renderer` dependency |
| `src/core/geo/GoogleTilesEngine.tsx` | **New** — R3F component for 3D Tiles |
| `src/core/geo/terrainQuery.ts` | **New** — raycast terrain height |
| `src/store/useSceneStore.ts` | Add `google3DTilesEnabled` setting |
| `src/components/editor/SkyCanvas.tsx` | Mount `<GoogleTilesLayer/>`, hide ground when active |
| `src/components/editor/SceneEditorPanel.tsx` | Add toggle for Google 3D Tiles |

## What is NOT Changed

- Lockstep / ExecutionBridge / DeterministicClock — untouched
- Existing coordinate system — reused as-is
- FloatingOrigin engine — reused, not modified
- GeoCamera — already handles flyTo, no changes needed
- Sun position system — already works, tiles receive scene lighting

## Constraints

- `3d-tiles-renderer` v0.4.x supports `@react-three/fiber` ^8 (our version)
- Google Maps API key is already provisioned via `get-maps-key` edge function
- The **Map Tiles API** must be enabled in the Google Cloud project (separate from Static Maps API). If not enabled, tiles will return 403 — the user will need to enable it in their Google Cloud Console.

