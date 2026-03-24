

## Plan: Ultra Hardening — Geo-Engine, Ground Safety, Water Reflections, Field UI & MAVLink Export

This plan implements the 5 requested systems, scoped to what's achievable in a React/Three.js browser application.

---

### 1. Floating Origin & High-Precision Geo Engine

**New file: `src/lib/floatingOriginEngine.ts`**
- ECEF (Earth-Centered, Earth-Fixed) conversion functions using WGS84 ellipsoid constants (already in `skybrushCoordinates.ts`)
- `FloatingOrigin` class that stores the anchor point in Float64 (`number` in JS is already Float64) and computes camera-relative offsets before sending to GPU as Float32
- Functions: `ecefFromGeo()`, `localFromEcef()`, `updateOrigin()` — rebase origin when camera moves >1km to prevent jitter
- Extends existing `GeoOrigin` interface from `skybrushCoordinates.ts`

**Modified: `src/store/useSceneStore.ts`**
- Add `geoAnchor: GeoOrigin` field to store state (default: Angra dos Reis coords `-23.007, -44.318, alt 0`)
- Add `floatingOriginEnabled: boolean` toggle
- Add `setGeoAnchor(anchor)` action

**Modified: `src/components/editor/skycanvas/GroundSystem.tsx`**
- When `floatingOriginEnabled`, offset ground/grid positions by the camera-relative delta from the floating origin engine

### 2. Ground-Lock & Tile Collision Safety

**New file: `src/lib/terrainCollisionEngine.ts`**
- `AnchorRay`: downward raycast from launch positions to snap Y to terrain height (using existing `TerrainRenderer` mesh or heightmap data from `useSceneStore.terrain`)
- `TrajectoryCollisionCheck`: given a parabolic trajectory (array of 3D points), test intersection against terrain heightmap. Returns collision point + distance if found
- `checkDroneTrajectory()`: iterate waypoints against heightmap, flag any point where altitude < terrain height + safety margin (15m default)

**Modified: `src/components/editor/ShowCommanderPanel.tsx`**
- Add `TERRAIN COLLISION` alert badge when collision engine detects intersection
- Alert renders as red pulsing overlay near E-Stop area — always visible

### 3. Dynamic Tide & Water Reflections (Angra Edition)

**Modified: `src/store/useSceneStore.ts`**
- `waterLevel` already exists (-5 to 5m). Add `tideOffset: number` (default 0) for dynamic adjustment
- Add `ssrEnabled` toggle is already present — ensure it's wired to water surface

**Modified: `src/components/editor/skycanvas/SkyEnvironment.tsx` (WaterLayer)**
- Connect `waterLevel + tideOffset` to the water plane Y position
- Add stencil write to the water plane so terrain below waterLevel is masked (prevents "sea inside islands")
- Enable SSR pass parameters from `useSceneStore` for pyro reflections on water

**New component in SkyEnvironment: `TideControl`**
- Slider UI in scene settings panel to adjust tide level in real-time

### 4. Field View Mode (High Contrast UI)

**New file: `src/components/editor/FieldViewMode.tsx`**
- High-contrast overlay mode for Show Commander: white background, black text, neon indicators
- Toggle via button in ShowCommanderPanel header
- When active: overrides panel CSS with `bg-white text-black` theme
- Battery/Signal indicators use neon green (#00FF66) / neon red (#FF3366) / neon amber (#FFAA00)
- Large-format telemetry numbers (48px+) for outdoor readability

**Modified: `src/components/editor/ShowCommanderPanel.tsx`**
- Add "Field Mode" toggle button in header bar
- When active, wrap panel content with FieldViewMode provider that applies high-contrast styles

### 5. MAVLink Flight Plan Exporter

**New file: `src/lib/mavlinkFlightPlanExporter.ts`**
- `exportFlightPlan(droneWaypoints, geoOrigin)` → JSON structure compatible with ArduPilot/DJI
- Converts local XYZ waypoints to Lat/Lon/Alt_Relative using existing `localToGeo()` from `skybrushCoordinates.ts`
- Output format: array of `{ seq, command: MAV_CMD_NAV_WAYPOINT, lat, lng, alt_relative, hold_time, acceptance_radius }`
- Includes mission header with home position, takeoff command, RTL
- `downloadFlightPlan()` utility to trigger `.waypoints` file download

**Modified: `src/components/editor/ShowCommanderPanel.tsx`**
- Add "Export MAVLink" button in the drone subsystem tab
- Opens modal showing flight plan preview (waypoint table) + download button

---

### Files Summary

| Action | File |
|--------|------|
| Create | `src/lib/floatingOriginEngine.ts` |
| Create | `src/lib/terrainCollisionEngine.ts` |
| Create | `src/lib/mavlinkFlightPlanExporter.ts` |
| Create | `src/components/editor/FieldViewMode.tsx` |
| Modify | `src/store/useSceneStore.ts` |
| Modify | `src/components/editor/skycanvas/GroundSystem.tsx` |
| Modify | `src/components/editor/skycanvas/SkyEnvironment.tsx` |
| Modify | `src/components/editor/ShowCommanderPanel.tsx` |

