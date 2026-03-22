

# Finale 3D — Camera-Aware Angle Gizmo + UI/UX Refinements

## Problem

The current angle gizmo (`PyroLaunchAngle.tsx`) always computes heading AND pitch simultaneously from mouse ray intersection, regardless of camera perspective. This makes precise adjustments frustrating:

- **Front view**: dragging left/right changes both heading AND pitch (should only change heading)
- **Side view**: dragging should primarily affect pitch
- **Top view**: dragging should only affect heading
- No visual feedback showing which axis is dominant from the current perspective

Finale 3D solves this by projecting the drag movement onto the most relevant axis plane based on camera direction.

## Architecture

```text
Camera Direction → Compute dominant axes → Constrain drag

Front (Z+) → H = mouse X, P = mouse Y   (heading + pitch)
Side  (X±) → P = mouse Y, H locked       (pitch only)
Top   (Y+) → H = mouse X/Z, P locked     (heading only)
45°        → Weighted blend of H/P sensitivity
```

## Changes

### 1. `PyroLaunchAngle.tsx` — Camera-Aware Drag Logic

**Core fix** in the `handleMove` effect (lines 445-523):

- Get camera forward direction via `camera.getWorldDirection()`
- Compute `viewDot` = how much camera looks down Y axis (top view), along Z (front), along X (side)
- **Front view** (|camDir.z| dominant): mouse X → heading, mouse Y → pitch. Sensitivity scales with `|camDir.z|`
- **Side view** (|camDir.x| dominant): mouse Y → pitch only, heading sensitivity near zero
- **Top view** (|camDir.y| dominant): mouse X/Y map to heading via atan2 on XZ plane, pitch locked
- **Intermediate angles**: weighted blend — axis sensitivity proportional to camera alignment with that plane
- Add visual indicator showing active constraint axes (colored ring around handle: blue=H, orange=P, both=white)

**Drag plane improvement**:
- Instead of sphere intersection, use a camera-facing plane at the position height for more predictable 2D drag behavior
- Project mouse delta onto heading and pitch axes independently based on camera angle weights

**Visual feedback**:
- During drag, show axis dominance indicator: `H ●●●○○ P` based on camera angle
- Handle color shifts: blue-tinted when mostly heading, orange-tinted when mostly pitch

### 2. `PyroLaunchAngle.tsx` — Gizmo Visibility Refinements

- Hide compass ring + arcs when camera is very close to top-down (they overlap and clutter)
- Scale gizmo elements based on camera distance for consistent visual size
- Auto-orient the H/P/R label billboard to always face camera without overlapping trajectory

### 3. `PyroLaunchAngle.tsx` — Trajectory Render Improvements

- Add gradient opacity along trajectory (bright at base, fading toward burst)
- Burst indicator: add expanding ring animation + particle sparks at apex
- Color trajectory line based on effect's actual VDL color (not fixed yellow)

### 4. `EffectEditor.tsx` — Configuration Refinements

Minor UX polish matching Finale 3D defaults:
- Auto-set pitch to 85° (near vertical) for shells, 45° for comets, 90° for mines
- Show break height preview value next to caliber slider
- Add quick-preset buttons for common angles (45°, 60°, 75°, 85°, 90°)

## Technical Detail

**Camera weight calculation (pseudocode):**
```typescript
const camDir = camera.getWorldDirection(new THREE.Vector3());
const frontWeight = Math.abs(camDir.z);  // looking along Z = front
const sideWeight = Math.abs(camDir.x);   // looking along X = side
const topWeight = Math.abs(camDir.y);    // looking down Y = top

// Heading sensitivity: strong from front/top, weak from side
const hSensitivity = Math.max(frontWeight, topWeight);
// Pitch sensitivity: strong from front/side, weak from top
const pSensitivity = 1 - topWeight * 0.8;

// Apply to delta:
newHeading = startHeading + deltaX * hSensitivity * scale;
newPitch = startPitch + deltaY * pSensitivity * scale;
```

## Files

| File | Change |
|------|--------|
| `src/components/editor/PyroLaunchAngle.tsx` | Camera-aware drag, visual feedback, trajectory color, gizmo scaling |
| `src/components/editor/EffectEditor.tsx` | Auto-pitch presets, break height preview |

