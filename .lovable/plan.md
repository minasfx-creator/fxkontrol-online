

## Plan: Remove Black Frame + Rebrand + Maximum Realism Refinement

Based on the uploaded UE5 DMX reference image (dark venue, purple volumetric beams, dome structure, atmospheric haze) and project files, here are the targeted changes to push the 3D engine closer to UE5.7 fidelity.

---

### 1. Remove Viewport Black Frame

**File: `src/components/editor/SkyCanvas.tsx`**
- Line 1428: Change `bg-[#030308]` → `bg-black` to eliminate the off-black tint that reads as a visible frame border

### 2. Rebrand XL4+ 2.0 → FXK-PYRO 2.0

**File: `src/components/editor/VirtualControllerHub.tsx`**
- Line 33: `platformLabel: 'XL4+ 2.0'` → `'FXK-PYRO 2.0'`
- Line 42: `platformLabel: 'XL4+ 2.0'` → `'FXK-PYRO 2.0'`

### 3. Push Render Defaults to Maximum Realism

**File: `src/components/editor/SkyCanvas.tsx`**
- `toneMappingExposure`: 1.3 → 1.5 (richer HDR, closer to UE5 ACES response)
- Desktop DPR: `[1, 2]` → `[1.5, 2]` (sharper at all zoom levels)
- Camera `far`: 250000 → 500000 (full pyro visibility at extreme range)

### 4. Enhance SFX Stage Environment (match UE5 reference)

**File: `src/components/editor/skycanvas/GroundSystem.tsx`** — `SFXStageEnvironment` component

The UE5 reference shows dramatically more volumetric atmosphere and brighter beam cones. Changes:

- **Moving head beam cones**: Increase cone opacity from 0.03 → 0.06, add a second inner cone (narrower, brighter) for realistic beam core/falloff separation
- **Beam lens glow**: Add emissive sphere at each moving head source (like the StageEnvironment3D component already does) for visible light source dots
- **Atmospheric haze volume**: Add a large semi-transparent box with additive blending (like `AtmosphereHaze` in StageEnvironment3D) centered at stage height — this is what makes beams visible in the UE5 reference
- **Purple/magenta ambient**: Increase the existing `#1a0028` ambient and `#220044` directional intensities to create the rich purple wash visible in the reference
- **LED wall emissive boost**: Change LED wall panel from `meshBasicMaterial color="#110022"` to use `emissive="#110022" emissiveIntensity={0.4}` for visible glow bleed
- **Ceiling rigging**: Add subtle downward-facing fill lights from the rigging grid to simulate the UE5 reference's overhead wash

### 5. Boost Post-Processing for Cinematic Glow

**File: `src/components/editor/PostProcessing.tsx`**
- Core bloom Layer 1: Increase intensity multiplier from 0.048 → 0.065 (more visible glow on light sources)
- Lower `luminanceThreshold` from 3.5 → 2.8 (catch more of the purple/magenta light spill)
- Star halos Layer 2: Increase from 0.024 → 0.035 for heavier halos around moving head beams

---

### Technical Notes
- The .uasset files (Niagara particles, terrain, venue maps) are UE5 binary and cannot be imported into WebGL — they serve as visual reference only
- All changes maintain Zero-GC principles (no new allocations per frame)
- The atmospheric haze volume uses additive blending with depthWrite=false for GPU efficiency
- Heavy effects (SSAO, SSR, DOF) remain disabled by default per existing stability strategy

