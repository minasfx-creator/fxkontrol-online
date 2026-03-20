

# Plan: Import Missing UE5 Rendering Technologies from DMX Previs Config

## Analysis

The uploaded `DefaultEngine-3.ini` from Epic's **DMX Previs** sample reveals several rendering technologies we don't yet implement:

| UE5 Setting | What It Does | Our Status |
|---|---|---|
| `r.Tonemapper.Sharpen=0.1` | Post-process sharpening | **Missing** |
| `r.TemporalAA.Upsampling=True` | Temporal anti-aliasing with upscaling | **Missing** (only SMAA) |
| `r.SSR.Temporal=1` | Screen-Space Reflections | **Missing** |
| `r.GenerateMeshDistanceFields=True` | Contact shadows via distance fields | **Missing** |
| `r.ReflectionCaptureResolution=2048` | High-res environment reflections | **Missing** |
| `r.SupportSkyAtmosphereAffectsHeightFog=True` | Atmosphere-fog interaction | **Missing** |
| `r.MinRoughnessOverride=0.02` | Material roughness floor | **Missing** |
| DMX fixture attributes (30+ types) | Extended DMX attribute library | **Partial** |

## What We Can Implement (via `@react-three/postprocessing` + THREE.js)

### Feasible Effects
1. **Sharpening** — Custom shader pass via `postprocessing` library's `Effect` class or the `ShaderPass` approach
2. **Screen Space Reflections (SSR)** — Available as `SSR` in `@react-three/postprocessing`  
3. **Contact Shadows** — Available via `@react-three/drei`'s `<ContactShadows />` (already in deps)
4. **Tonemapper Sharpen** — Implement as a simple convolution kernel post-effect

### Not Feasible in WebGL
- Temporal AA Upsampling (requires frame history buffers not available in R3F)
- Mesh Distance Fields (GPU compute, UE5-specific)
- True atmosphere-fog coupling (approximated via existing fog settings)

## Implementation Steps

### Step 1: Add SSR + Sharpening to Post-Processing Pipeline
**File**: `src/components/editor/PostProcessing.tsx`
- Import `SSR` from `@react-three/postprocessing`  
- Add conditional SSR pass (expensive — only in Realistic preset)
- Add a custom sharpening effect using the `postprocessing` `Effect` class with a simple unsharp mask GLSL fragment

### Step 2: Extend SceneSettings Store
**File**: `src/store/useSceneStore.ts`
- Add: `ssrEnabled`, `ssrIntensity`, `ssrThickness`, `sharpenEnabled`, `sharpenStrength`, `contactShadowsEnabled`, `contactShadowsOpacity`, `contactShadowsBlur`
- Update quality presets:
  - **Realistic**: SSR on, sharpen on (0.1), contact shadows on
  - **Show**: SSR off, sharpen on (0.05), contact shadows on
  - **Performance**: all off

### Step 3: Add Contact Shadows to 3D Scene
**File**: `src/components/editor/SkyCanvas.tsx` (or wherever the main R3F scene is)
- Add `<ContactShadows>` from drei, controlled by store settings
- Position beneath drone/effect layer for ground contact darkening

### Step 4: Add UI Controls
**File**: `src/components/editor/SceneEditorPanel.tsx`
- Add SSR toggle + intensity slider in the "Advanced (AAA)" section
- Add Sharpening toggle + strength slider
- Add Contact Shadows toggle + opacity/blur sliders

### Step 5: Sync DMX Fixture Attributes
**File**: `src/lib/dmxEngine.ts`
- Import the 30+ DMX attribute definitions from the UE5 config (Pan, Tilt, Gobo, Frost, Shaper Rotation, etc.)
- Ensure our DMX attribute system supports all fixture categories from the config

## Files to Modify

| File | Change |
|---|---|
| `src/store/useSceneStore.ts` | Add SSR, sharpen, contact shadows settings + preset updates |
| `src/components/editor/PostProcessing.tsx` | Add SSR pass + custom sharpening effect |
| `src/components/editor/SceneEditorPanel.tsx` | UI controls for new effects |
| `src/components/editor/SkyCanvas.tsx` | Add `<ContactShadows>` component |
| `src/lib/dmxEngine.ts` | Sync DMX attribute definitions from UE5 config |

