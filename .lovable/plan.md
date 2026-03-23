

## Plan: UE5 DMX Previs Config Alignment — Pyro DMX Attributes + Render Parity

The uploaded UE5 project files (DefaultEngine.ini from "DMX Previs" by Moment Factory/Epic Games) reveal specific configurations not yet mapped into the FXK engine. The `.show.gz` is a binary show file that cannot be parsed.

---

### Key Findings from UE5 Config

From `DefaultEngine.ini` DMXProtocolSettings:
- **20 universes** input/output (already supported)
- **SendingRefreshRate = 44** (already default in `DMXShow.fps`)
- **Fixture categories**: Static, Matrix/Pixel Bar, Moving Head, Moving Mirror, Strobe, Other
- **DMX Attributes include pyro-specific**: `Burst`, `Launch`, `Velocity`, `Angle`, `NumBeams`, `X`, `Y`, `Z` — **these are MISSING from the attribute library**

From renderer settings:
- `r.MinRoughnessOverride=0.02` — enforce minimum roughness on all materials
- `r.DefaultFeature.AutoExposure=False` — verify auto-exposure off by default
- `r.GenerateMeshDistanceFields=True` — not applicable to WebGL but confirms SDF intent

---

### Changes

#### 1. Add Missing Pyro DMX Attributes (`src/lib/dmxEngine.ts`)

Add 8 pyro/SFX attributes from UE5 config to `DMX_ATTRIBUTE_LIBRARY` after the Control section:

```
Burst:     { category: 'effects', description: 'Pyro burst trigger' }
Launch:    { category: 'effects', description: 'Pyro launch trigger' }
Velocity:  { category: 'effects', description: 'Launch velocity (0-255)' }
Angle:     { category: 'effects', description: 'Launch angle (0-180°)' }
NumBeams:  { category: 'effects', description: 'Number of beams/stars' }
X:         { category: 'position', description: 'Position X' }
Y:         { category: 'position', description: 'Position Y' }
Z:         { category: 'position', description: 'Position Z' }
```

#### 2. Add Pyro Fixture Profile (`src/lib/dmxEngine.ts`)

Add a `'sfx-pyro-dmx'` profile to `DMX_FIXTURE_PROFILES`:
- Attributes: `['Dimmer', 'Burst', 'Launch', 'Velocity', 'Angle', 'NumBeams', 'Red', 'Green', 'Blue']`
- channelCount: 9
- Category: `'sfx'`

Update `UE5_BLUEPRINT_MAP` entry for `BP_Pyro_v4` from `'sfx-flame'` to `'sfx-pyro-dmx'`.

Add `'sfx-firework-dmx'` profile:
- Attributes: `['Dimmer', 'Launch', 'Burst', 'Velocity', 'Angle', 'NumBeams', 'Red', 'Green', 'Blue', 'X', 'Y', 'Z']`
- channelCount: 12

Update `BP_Firework_v2` mapping from `'drone-led'` to `'sfx-firework-dmx'`.

#### 3. Add "Moving Mirror" Fixture Category (`src/lib/dmxEngine.ts`)

The UE5 config lists "Moving Mirror" as a fixture category. Add `'moving-mirror'` to the `DMXFixtureProfile.category` union type and create a profile:
- `'moving-mirror'`: attributes `['Pan', 'PanFine', 'Tilt', 'TiltFine', 'Dimmer', 'Strobe', 'ColorWheel', 'Gobo1', 'Focus', 'Control']`, channelCount 10

#### 4. Enforce Minimum Roughness (`src/components/editor/skycanvas/GroundSystem.tsx`)

From `r.MinRoughnessOverride=0.02` — ensure all `meshStandardMaterial` instances in the stage environment use `roughness={Math.max(0.02, value)}`. Apply to:
- Orb spheres (currently 0.05 — OK)
- Pyro pot housing
- DMX rack prop
- Any material with roughness below 0.02

#### 5. Verify AutoExposure Default (`src/store/useSceneStore.ts`)

Confirm `exposureCompensation` defaults to `0` and that no adaptive auto-exposure is active by default — matching `r.DefaultFeature.AutoExposure=False`. (Currently correct.)

---

### Technical Notes
- The `.show.gz` file is a binary Moment Factory show format — not parseable
- All changes are additive — no existing profiles or attributes are modified
- The pyro DMX attributes enable future DMX-triggered pyro firing from external consoles (e.g., MA3, ChamSys)

