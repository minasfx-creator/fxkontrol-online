

## Plan: Refine 3D World Using UE5 Blueprint References

The uploaded UE5 assets provide architectural reference for 5 systems: **Firework** (BP_Firework_v2), **Laser** (BP_Laser_Extended), **Pyro** (BP_Pyro_v4), **Orb/Sphere** (BP_Sphere + M_Orb materials), **DMX control** (DMXSetter), and **Render Settings** (WBP_RenderSettings). These are binary UE5 Blueprints — not importable — but they indicate the user wants these systems refined toward UE5-grade fidelity.

---

### 1. Enhanced Laser Effect — Extended Beams + Volumetric Haze

**File: `src/components/editor/effects/LaserEffect.tsx`**

Matching `BP_Laser_Extended` intent — wider, more dramatic beams:
- Increase default `beamLength` from 90 → 140 for all patterns (not just single)
- Add **volumetric cone** at source: large transparent cone with additive blending behind each beam fan to simulate atmospheric scatter
- Increase beam core opacity (inner plane) from current values by ~30%
- Add a **source orb glow**: emissive sphere at position origin (0.15 radius, beam color, opacity 0.9) for visible projector lens

### 2. Add Orb/Sphere Stage Prop — New Effect Type

**File: `src/components/editor/skycanvas/GroundSystem.tsx`** (SFXStageEnvironment)

Based on `BP_Sphere` + `M_Orb`/`MI_Orb` — a glowing kinetic orb prop on stage:
- Add 3 floating orb meshes at center-stage, spaced along X axis
- Each orb: `sphereGeometry` (radius 0.8), `meshStandardMaterial` with emissive purple/blue (`#4400ff`), `emissiveIntensity: 1.5`, metalness 0.95, roughness 0.05
- Subtle vertical bobbing animation via `useFrame` (sin wave, ±0.5m)
- `pointLight` per orb for ambient bleed (distance 8, intensity 0.8)

### 3. Pyro v4 Refinement — Brighter Flame Base

**File: `src/components/editor/skycanvas/GroundSystem.tsx`** (SFXStageEnvironment)

Based on `BP_Pyro_v4` — add pyro pot fixtures along stage front:
- 5 pyro pots along stage edge (evenly spaced along X, at `stageHeight + 0.1`)
- Each: small cylinder housing (dark metal), tiny red LED status dot
- These serve as visual anchor points for the existing `FlameEffect` instances from the timeline

### 4. DMX Setter Visual Indicator

**File: `src/components/editor/skycanvas/GroundSystem.tsx`** (SFXStageEnvironment)

Based on `DMXSetter` — add a small DMX control rack prop backstage:
- Position behind LED wall (`z = -stageD/2 - 2`)
- Small box geometry rack with green LED status indicators
- Subtle blue wireframe overlay to indicate "DMX active"

### 5. Render Settings Push

**File: `src/components/editor/SkyCanvas.tsx`**

Based on `WBP_RenderSettings` — ensure max quality defaults are active:
- Confirm `toneMappingExposure: 1.5` and DPR `[1.5, 2]` are applied (done in previous iteration)
- Add `flat: false` to Canvas if not present for proper shading interpolation

---

### Technical Notes
- All `.uasset` files are UE5 binary — used as design reference only
- Orb animation uses shared `useFrame` with no per-frame allocations (reuses Vector3)
- New stage props are static meshes — negligible GPU cost
- Laser changes are parameter adjustments, no new geometry types

