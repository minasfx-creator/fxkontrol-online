

# Plan: Add Missing AAA Post-Processing Technologies

## What's Missing
The project uses `@react-three/postprocessing` but only employs Bloom, Vignette, ChromaticAberration, Noise, SMAA, and ToneMapping. The library supports many more cinematic effects that professional tools like UE5/Depence use. Here's what to add:

## New Effects

| Effect | Purpose | UE5 Equivalent |
|--------|---------|----------------|
| **SSAO** | Ambient occlusion in crevices/contacts | Screen Space Ambient Occlusion |
| **Depth of Field** | Bokeh blur on distant/near objects | DOF / Cinematic Camera |
| **God Rays** | Volumetric light shafts from explosions | Light Shafts |
| **Brightness/Contrast** | Color grading base layer | Post Process Volume |
| **Hue/Saturation** | Color grading creative control | Color Grading LUT |
| **Color Average** | Auto white-balance reference | Auto Exposure |

## Steps

### Step 1: Extend SceneSettings in store
**File**: `src/store/useSceneStore.ts`
- Add new settings: `ssaoEnabled`, `ssaoIntensity`, `dofEnabled`, `dofFocusDistance`, `dofBokehScale`, `godRaysEnabled`, `colorBrightness`, `colorContrast`, `colorSaturation`
- Add defaults (all disabled by default except in "realistic" quality preset)

### Step 2: Add effects to PostProcessing pipeline
**File**: `src/components/editor/PostProcessing.tsx`
- Import `SSAO`, `DepthOfField`, `GodRays`, `BrightnessContrast`, `HueSaturation` from `@react-three/postprocessing`
- Add each conditionally based on store settings
- SSAO: only in realistic/show presets (expensive)
- DOF: optional, focal point linked to camera target
- God Rays: triggered during burst flashes (reuse burst count logic)
- BrightnessContrast + HueSaturation: always active (cheap)

### Step 3: Add UI controls in SceneEditorPanel
**File**: `src/components/editor/SceneEditorPanel.tsx`
- Add a new "Advanced Post-Processing" subsection inside the existing "post" section
- Sliders for: SSAO intensity, DOF focus/bokeh, brightness, contrast, saturation
- Toggles for: SSAO, DOF, God Rays

### Step 4: Update quality presets
**File**: `src/store/useSceneStore.ts`
- `realistic`: SSAO on, DOF on, God Rays on
- `show`: SSAO on (low), DOF off, God Rays on
- `performance`: all off

## Files to Modify
| File | Change |
|------|--------|
| `src/store/useSceneStore.ts` | New settings + defaults + preset updates |
| `src/components/editor/PostProcessing.tsx` | Add 5 new effect passes |
| `src/components/editor/SceneEditorPanel.tsx` | Add UI controls for new effects |

