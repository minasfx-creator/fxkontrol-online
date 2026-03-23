

## Plan: Replicate UE5 Blueprint Systems — DMX Send/Receive, Point Lights, Scene Capture, Fountain Lights, Pixel Mapping Manager

The 5 uploaded UE5 blueprints map to concrete systems missing or incomplete in the FXK codebase. All are binary — used as architectural reference.

---

### 1. DMX Send/Receive Bridge (`src/lib/dmxEngine.ts`)

**From `BP_DMX_Send_Receive`** — bidirectional DMX I/O controller.

Currently the engine only has universe buffers and fixture patching. Add a `DMXSendReceive` controller class:

- `sendUniverse(universeId, channels: Uint8Array)`: serializes 512-byte buffer to Art-Net packet format (header + universe + data), queues for network output
- `receiveUniverse(universeId): Uint8Array`: returns the latest received buffer for a universe (for external console input)
- `mode: 'send' | 'receive' | 'duplex'` per universe — matches UE5's bidirectional config
- Add `DMXIOConfig` interface: `{ universeId, mode, protocol: 'artnet' | 'sacn', priority: number }`
- Add `configureDMXIO(configs: DMXIOConfig[])` to set up all universes at once
- Update `UE5_BLUEPRINT_MAP`: `'BP_DMX_Send_Receive': 'generic-rgbw'`

### 2. DMX Point Light Fixture (`src/lib/dmxEngine.ts` + `src/components/editor/skycanvas/GroundSystem.tsx`)

**From `BP_DMXPointLight`** — a DMX-controlled point light (not moving head, not spot — omnidirectional).

**DMX Engine:**
- Add `'dmx-point-light'` fixture profile: attributes `['Dimmer', 'Red', 'Green', 'Blue', 'White', 'CTO']`, channelCount 6, category `'wash'`
- Update `UE5_BLUEPRINT_MAP`: `'BP_DMXPointLight': 'dmx-point-light'`

**3D Stage (GroundSystem.tsx — SFXStageEnvironment):**
- Add 4 DMX point light props at truss corners (small emissive sphere + `pointLight` with distance 20, intensity 1.2)
- Color driven by a slow hue rotation via `useFrame` to demonstrate DMX-controlled ambient wash

### 3. Downsample Scene Capture (`src/components/editor/PostProcessing.tsx`)

**From `BP_DownSampleSceneCapture`** — a render-to-texture system that captures the scene at reduced resolution for bloom/blur feedback.

Add a `DownSampleBlurEffect` to the post-processing pipeline:
- Custom postprocessing `Effect` subclass with a 4-tap box blur fragment shader
- Two sequential passes at half and quarter resolution
- Uniforms: `intensity` (default 0.15), `radius` (default 2.0 pixels)
- Gated by bloom strength > 0.5 to avoid cost when bloom is minimal
- Insert after the existing Bloom layers in `EffectComposer`

### 4. Fountain Light System (`src/render_ultra/environment/waterRendering.ts`)

**From `BP_FountainLight`** — underwater/surface lights synchronized to water fountain jets.

Add to the water system:
- `pool` preset in `WATER_PRESETS`: `waveAmplitude: 0.03`, `waveFrequency: 0.6`, `opacity: 0.75`, `causticIntensity: 1.0`, `sssIntensity: 0.15`, teal tint, `size: 80`
- New methods on the water system return object:
  - `setFountainPhase(phase: number)`: modulates `uCausticIntensity` sinusoidally (0.3-1.0) and `uSSS` (0.1-0.5) for synchronized pulsing
  - `setWaterTint(color: THREE.Color)`: updates `uWaterColor` for DMX-driven color changes
  - `setFountainActive(active: boolean)`: toggles wave amplitude between calm pool (0.03) and active fountain (0.8)

### 5. Pixel Mapping Manager (`src/lib/pixelMapper.ts`)

**From `BP_PixelMappingManager`** — advanced pixel mapping with matrix/snake topologies and DMX output routing.

Extend the pixel mapper:
- Add `'matrix'` and `'snake'` to `Topology` union type
- Add to `PixelMapConfig`: `groupSize?: number` (LED bar pixel grouping), `startCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'`
- Implement `matrix` topology: standard left-to-right, top-to-bottom scan
- Implement `snake` topology: serpentine/zigzag (odd rows reverse direction)
- Add `mapFixturesToDMXOutput()` function: returns `{ universe: number, startChannel: number, pixelIndex: number }[]` for direct Art-Net/sACN patching
- Add `PixelMappingManager` class with `addGroup(name, fixtures, config)`, `getMapping(groupName)`, `getAllMappings()` for managing multiple pixel map groups (e.g., separate maps for LED wall, floor, truss bars)

---

### Files Modified
| File | Changes |
|------|---------|
| `src/lib/dmxEngine.ts` | DMXSendReceive class, DMXIOConfig, point-light profile, blueprint map entries |
| `src/lib/pixelMapper.ts` | matrix/snake topologies, groupSize, startCorner, DMX output mapping, PixelMappingManager class |
| `src/render_ultra/environment/waterRendering.ts` | pool preset, fountain light methods |
| `src/components/editor/PostProcessing.tsx` | DownSampleBlurEffect |
| `src/components/editor/skycanvas/GroundSystem.tsx` | DMX point light props at truss corners |

### Technical Notes
- DMXSendReceive is a virtual controller — actual network I/O goes through existing Art-Net/sACN bridges
- Snake topology uses `row % 2 === 1` to reverse column order — standard in MA3/Resolume
- Pool preset is additive to existing `WATER_PRESETS`
- Downsample blur reuses postprocessing lib pipeline — no new render targets
- All changes are additive — no existing functionality modified

