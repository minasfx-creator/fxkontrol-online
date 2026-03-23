

## Plan: Crowd System + DMX I/O Panel + Pixel Mapping UI

Three new systems: procedural audience in the 3D viewport, DMX Send/Receive visualization in the Art-Net panel, and a Pixel Mapping Manager UI panel.

---

### 1. Procedural Crowd System (3D Viewport)

**New file: `src/components/editor/skycanvas/CrowdSystem.tsx`**

Instanced human silhouettes in the FOH (audience) area using `THREE.InstancedMesh`:

- **Geometry**: Simplified human shape — capsule body (cylinder + sphere head) baked into a single `BufferGeometry` via merging, or use a flat billboard plane with silhouette shape via alpha
- **Count**: ~200 audience figures, arranged in a semicircular/grid pattern in the FOH zone (`z > stageD/2 + 5`, spread across `x: -35 to 35`)
- **Variation**: Random height (1.6-1.9m), slight X/Z jitter, random subtle color tint (dark clothing tones)
- **Animation**: Subtle idle sway via `useFrame` — sinusoidal Y-axis rotation (±3°) at different phases per instance
- **Performance**: Single `InstancedMesh` call, ~200 instances, frustum culled
- **Integration**: Add `<CrowdSystem />` inside `SFXStageEnvironment` in `GroundSystem.tsx`, positioned in the audience floor area

### 2. DMX Send/Receive Visualization Panel

**New file: `src/components/editor/live-firing/DMXIOPanel.tsx`**

A new tab in `FXKNetPanel` showing DMX I/O status per universe:

- **Universe list**: Show all configured universes with mode badge (`SEND` / `RECV` / `DUPLEX`), protocol badge (`ART-NET` / `sACN`), priority number
- **Activity indicators**: Animated dot per universe — green pulse when data flowing, gray when idle. Simulated via `setInterval` toggling
- **Buffer visualization**: Mini 512-channel bar graph (like a spectrum analyzer) for the selected universe, showing send buffer (top, cyan) and receive buffer (bottom, amber)
- **Stats row**: Packets/sec, last activity timestamp, buffer utilization %
- **Add universe config**: Simple form to add/configure DMX I/O universes (universe ID, mode select, protocol select)

**Integration in `FXKNetPanel.tsx`**: Add a third tab `'dmx-io'` with label `DMX I/O` and icon `ArrowLeftRight`

### 3. Pixel Mapping Manager UI Panel

**New file: `src/components/editor/live-firing/PixelMappingPanel.tsx`**

Interactive UI for managing pixel mapping groups:

- **Group list**: Shows all pixel mapping groups with name, topology, dimensions, pixel count
- **Add group form**: Name input, topology select (`grid`/`snake`/`matrix`/`circle`/`custom`), columns/rows inputs, groupSize input, startCorner select
- **Grid preview**: SVG visualization of the pixel map — colored dots on a grid showing the mapping order (numbered). Snake topology shows zigzag arrows, matrix shows L→R scan
- **DMX output table**: For selected group, show the DMX patching (universe, start channel, pixel index) in a compact table
- **Delete group**: Remove button per group

**Integration in `FXKNetPanel.tsx`**: Add a fourth tab `'pixel-map'` with label `PIXEL MAP` and icon `Grid3x3`

---

### Files Modified/Created

| File | Action |
|------|--------|
| `src/components/editor/skycanvas/CrowdSystem.tsx` | **New** — InstancedMesh crowd |
| `src/components/editor/skycanvas/GroundSystem.tsx` | Add `<CrowdSystem />` to SFXStageEnvironment |
| `src/components/editor/live-firing/DMXIOPanel.tsx` | **New** — DMX I/O visualization |
| `src/components/editor/live-firing/PixelMappingPanel.tsx` | **New** — Pixel mapping UI |
| `src/components/editor/live-firing/FXKNetPanel.tsx` | Add 2 new tabs (DMX I/O, Pixel Map) |

### Technical Notes
- Crowd uses billboard planes (not 3D meshes) for minimal GPU cost — single draw call
- DMX I/O panel reads from the existing `DMXSendReceive` class in `dmxEngine.ts`
- Pixel mapping panel instantiates `PixelMappingManager` from `pixelMapper.ts` — all logic already exists
- All new panels follow BR2049 dark industrial theme consistent with existing FXKNetPanel styling

