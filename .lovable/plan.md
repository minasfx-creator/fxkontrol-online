

# Plan: SuperVDL — Niagara + VDL Fusion, Interactive Preview Panel, Color Transition Rendering

## Summary
Three interconnected upgrades: (1) merge Niagara particle profiles into the VDL parser so a single description like `"Red Chrysanthemum niagara-blue"` automatically applies Niagara's physics/glow/fade profiles, (2) create an interactive VDL Preview Panel with live 3D simulation, (3) implement per-star color transitions in FireworkBurst ("Red To Blue" renders stars that change color mid-flight).

## Part 1 — SuperVDL: Niagara + VDL Fusion

### `src/lib/vdlParser.ts`
- Import `NIAGARA_COLOR_PRESETS` and `NiagaraColorPreset`
- Add to `VDLResult`:
  ```
  niagaraPreset?: string;           // matched Niagara preset ID
  niagaraProfile?: {                // merged particle physics from Niagara
    starCount: number;
    lifetime: number;
    velocity: number;
    drag: number;
    gravityScale: number;
    sparkleRate: number;
    glowIntensity: number;
    fadeProfile: 'linear' | 'exponential' | 'ember';
  };
  ```
- In `parseVDL()`: detect Niagara preset references (e.g., `niagara-blue`, `niagara-yellow`, `niagara-pink`) in the description and merge their `particleProfile` + `shaderUniforms` into the result. Also auto-match: if color is Blue and type is Peony, suggest/apply `niagara-blue` profile automatically
- In `vdlToEffect()`: propagate `niagaraProfile` fields into the Effect object

### `src/store/useProjectStore.ts`
- Add to `Effect` interface: `niagaraProfile?` with the same shape

### `src/components/editor/SkyCanvas.tsx` — FireworkBurst
- When `niagaraProfile` is present, override `STAR_COUNT`, `starLife`, `breakSpeed`, drag coefficient, and glow intensity with Niagara values instead of defaults
- Apply `fadeProfile` (`linear`/`exponential`/`ember`) to the thermal color pipeline fade curve

## Part 2 — Interactive VDL Preview Panel

### New file: `src/components/editor/VDLPreviewPanel.tsx`
A panel with:
- **Text input** (textarea) for typing VDL descriptions
- **Live 3D preview** using a mini `<Canvas>` that renders the parsed effect in a loop
- **Parameter badges** showing detected properties: caliber, colors (as swatches), type, trail, angle, timing, adjustments, Niagara profile
- **Quick presets** row: common VDL examples the user can click to load
- **"Add to Timeline"** button that calls `vdlToEffect()` and inserts into the project

Implementation:
- Uses `parseVDL()` on every keystroke (debounced 300ms)
- Renders a single `FireworkBurst` (or appropriate effect component based on `partType`) in the mini canvas, auto-replaying every 3s
- Shows VDL parse status (valid/invalid) with error hints
- Badge grid: `caliber`, `type`, `colors[]`, `trailType`, `angleOffset`, `firingPattern`, `shotCount`, `niagaraPreset`, `adjustments[]`

### `src/components/AppSidebar.tsx`
- Add VDL Preview panel to the sidebar panel registry

## Part 3 — Color Transition Rendering in FireworkBurst

### `src/components/editor/SkyCanvas.tsx` — FireworkBurst `useFrame`
Currently at line ~546, star colors are computed as:
```
const r = lerp(baseColor.r * userFade, chemR, 0.7);
```

When `colorTransition === 'to'` and `secondaryColor` is set:
- Parse `secondaryColor` into a `THREE.Color`
- Compute `transitionT = starAge` (0 at birth → 1 at death)
- Lerp between primary and secondary color based on `transitionT`
- Apply the same thermal pipeline (white-hot flash, ember fade) on top of the interpolated base color
- For `colorTransition === 'changing'`: use ping-pong interpolation (back and forth)
- For `colorTransition === 'alternating'`: use `multiColors` array, each star gets a color based on `i % multiColors.length`

This happens inside the existing `useFrame` loop, modifying the color computation for each star — no new geometry or materials needed.

### `src/lib/vdlParser.ts`
- Ensure "Red To Blue" correctly sets `colorTransition: 'to'`, `colors[0]` = Red hex, `colors[1]` = Blue hex, and `secondaryColor` = Blue hex in `vdlToEffect()`

## Files Summary

| File | Change |
|------|--------|
| `src/lib/vdlParser.ts` | Add Niagara preset detection + merge, ensure color transition parsing |
| `src/lib/niagaraColorPresets.ts` | Add more presets (red, green, white, gold) for broader coverage |
| `src/store/useProjectStore.ts` | Add `niagaraProfile` to Effect interface |
| `src/components/editor/SkyCanvas.tsx` | Color transition in FireworkBurst useFrame, Niagara profile overrides |
| `src/components/editor/VDLPreviewPanel.tsx` | New interactive VDL preview panel |
| `src/components/AppSidebar.tsx` | Register VDL Preview panel |

