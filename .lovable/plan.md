

## Plan: Military Moss Camouflage Ground + Grid Fix

### Changes

**1. Restyle Synthetic Grass Shader → Military Camouflage Moss Theme**
- File: `src/components/editor/skycanvas/GroundSystem.tsx` (lines 524-589)
- Replace the `SYNTHETIC_GRASS_FRAGMENT` shader with a military camouflage pattern:
  - Base palette: dark olive `#2d3a1e`, moss green `#3b4a2a`, earth brown `#4a3c28`, dark khaki `#5a5434`
  - Use layered noise at different scales to create organic camo blotches (not stripes)
  - Irregular patches blending between moss, olive, earth, and dark tones
  - Remove the "mowing stripe" pattern — replace with organic irregular shapes
  - Keep fiber micro-noise for texture realism
  - Slightly muted specular (military matte finish, not shiny turf)

**2. Fix Grid Rendering**
- File: `src/components/editor/skycanvas/GroundSystem.tsx` (lines 1150-1182)
- Update grid colors to complement the camo ground:
  - `cellColor`: muted olive-green `#1a2a12` instead of dark blue `#15152a`
  - `sectionColor`: slightly brighter olive `#2a3a1e` instead of `#1a1a2e`
  - Increase `cellThickness` slightly for visibility on the textured ground
  - Reduce `fadeDistance` on second grid layer to avoid visual noise at distance

### Files to Modify
- `src/components/editor/skycanvas/GroundSystem.tsx` — shader fragment + grid colors

