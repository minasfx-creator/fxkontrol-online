

## Plan: Ultra Hardening — Geo-Spatial Precision Integration

Most of the foundational engines already exist (`floatingOriginEngine.ts`, `terrainCollisionEngine.ts`, `mavlinkFlightPlanExporter.ts`). This plan wires them into the live scene and adds the missing systems: explosion glow lighting, occlusion culling, geo-search panel, and interactive terrain coordinate picking.

---

### 1. Geo-Search & Place Dropper Panel

**New file: `src/components/editor/GeoSearchPanel.tsx`**
- Search bar with Google Places Autocomplete (text input with preset locations: Angra dos Reis, Copacabana, etc.)
- On selection, updates `geoAnchorLat/Lon/Alt` in `useSceneStore`
- "Drop on Terrain" mode: click on 3D ground to set barge/drone home GPS coords
- Shows current anchor position in DMS format
- Compact panel design matching SceneEditorPanel style

**Modified: `src/components/editor/SceneEditorPanel.tsx`**
- Add GeoSearchPanel inline within the Ground section, below the Floating Origin controls

### 2. Wire Floating Origin to Scene Rendering

**Modified: `src/components/editor/skycanvas/GroundSystem.tsx`**
- When `floatingOriginEnabled`, create a `FloatingOrigin` instance from the store anchor
- Offset the ground plane and grid by the camera-relative delta each frame
- Pass offset to terrain mesh position

**Modified: `src/components/editor/skycanvas/SkyEnvironment.tsx`**
- Apply floating origin offset to water plane position

### 3. Terrain Collision → Show Commander Integration

**Modified: `src/components/editor/ShowCommanderPanel.tsx`**
- Wire `TerrainCollisionAlert` with real collision data from `checkTrajectoryCollision()` using timeline cue positions against loaded terrain heightmap
- Add scan button "Run Safety Check" that evaluates all drone/pyro trajectories
- Display collision count badge on Safety tab

### 4. Explosion Glow Dynamic Lighting

**New file: `src/components/editor/skycanvas/ExplosionGlowSystem.tsx`**
- Pool of reusable `PointLight` instances (max 8 concurrent)
- On burst detection (from `ActiveBurstScanner`), spawn a short-lived point light at burst position
- Light color matches burst compound color, intensity decays over ~0.5s
- Lights illuminate terrain mesh and water surface naturally via Three.js
- Zero-GC: pre-allocated light pool, no creation/destruction per frame

**Modified: `src/components/editor/skycanvas/index.ts`**
- Export `ExplosionGlowSystem`

### 5. Depth-Based Occlusion Culling

**Modified: `src/components/editor/skycanvas/GroundSystem.tsx`**
- Set `renderOrder` on terrain mesh to ensure depth buffer is written before particle rendering
- Enable `depthWrite: true` on terrain material so Three.js naturally occludes objects behind hills
- This leverages the GPU depth buffer — no custom raycasting needed for visual occlusion

### 6. Tide-Sync Water Stencil

**Already partially implemented in `SkyEnvironment.tsx`** — verify stencil mask is active:
- Water plane writes stencil ref=1
- Terrain below water level reads stencil to clip (prevents sea inside islands)
- `tideOffset` slider already in SceneEditorPanel; confirm it drives `waterLevel + tideOffset`

---

### Files Summary

| Action | File |
|--------|------|
| Create | `src/components/editor/GeoSearchPanel.tsx` |
| Create | `src/components/editor/skycanvas/ExplosionGlowSystem.tsx` |
| Modify | `src/components/editor/SceneEditorPanel.tsx` |
| Modify | `src/components/editor/ShowCommanderPanel.tsx` |
| Modify | `src/components/editor/skycanvas/GroundSystem.tsx` |
| Modify | `src/components/editor/skycanvas/index.ts` |

### Technical Notes

- **Explosion Glow**: Uses a pre-allocated pool of 8 `THREE.PointLight` objects recycled via LRU. Reads from `getActiveBurstScan()` (already in sharedState) so no new per-frame allocations.
- **Occlusion**: Pure GPU depth-buffer approach — no CPU raycasting. Terrain renders first (`renderOrder: -1`), particles render after, GPU discards fragments behind terrain automatically.
- **Geo-Search**: Uses preset location database (no Google API key required). Locations include Angra dos Reis, Copacabana, Marina da Glória, and custom lat/lon input.
- **Floating Origin wiring**: The engine is stateless per-call (`getLocalOffset`), so it integrates cleanly into `useFrame` loops without state management overhead.

