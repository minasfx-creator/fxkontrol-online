

## Plan: Clean Viewport + Synthetic Grass Ground + 3D World Refinements

### Problems Identified

1. **Dark edges still visible** — The CSS vignette was disabled, but the **PostProcessing Vignette** (react-three/postprocessing) is still active with `vignetteEnabled: true` and `darkness = vignetteIntensity * 2.8`. Additionally, the `PyroFireOnePanel` has its own radial-gradient vignette overlay.

2. **Ground is buggy** — Default `groundStyle` is `'finale-dark'`, which renders an extremely dark shader (brightness multiplied by 0.4). The dark scene settings make the ground nearly invisible.

3. **No synthetic grass texture** — The existing `GrassGround` component renders a procedural Google Earth-style terrain with dark greens/browns. Need a brighter, vivid synthetic grass look.

---

### Implementation Steps

**Step 1: Disable Post-Processing Vignette by Default**
- In `src/store/useSceneStore.ts`, change `DEFAULT_SETTINGS.vignetteEnabled` to `false` and set `vignetteIntensity` to `0`.
- Also update all scene presets that have `vignetteEnabled: true` to `false`.

**Step 2: Create Synthetic Grass Ground Style**
- In `src/store/useSceneStore.ts`, add `'synthetic-grass'` to the `GroundStyle` type.
- In `src/components/editor/skycanvas/GroundSystem.tsx`, create a new `SyntheticGrassGround` component with:
  - Bright green procedural shader simulating synthetic turf (vivid green with subtle fiber-like striping).
  - Higher brightness multipliers so the ground is clearly visible.
  - Fine-grained noise for turf texture with visible grass-blade pattern lines.
- Update `StageGround` switch to include the new `'synthetic-grass'` case.
- Set `'synthetic-grass'` as the new default `groundStyle`.

**Step 3: Brighten the 3D World**
- Increase `DEFAULT_SETTINGS.ambientIntensity` from `0.04` to `0.12`.
- Increase `DEFAULT_SETTINGS.moonIntensity` from `0.45` to `0.7`.
- Increase `DEFAULT_SETTINGS.groundBrightness` from `1.0` to `1.5`.
- Reduce `DEFAULT_SETTINGS.fogDensity` from `0.4` to `0.15` and lighten `fogColor`.
- Reduce `DEFAULT_SETTINGS.groundFogIntensity` from `0.7` to `0.2`.

**Step 4: Remove Scanline/Overlay Darkening from Editor**
- In `PyroFireOnePanel.tsx`, remove or neutralize the amber scanline overlay and radial-gradient vignette that darken the panel.

### Files to Modify
- `src/store/useSceneStore.ts` — Ground style type, defaults, brightness values
- `src/components/editor/skycanvas/GroundSystem.tsx` — New SyntheticGrassGround + StageGround switch
- `src/components/editor/PostProcessing.tsx` — No changes needed (reads from store)

