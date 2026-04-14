

# Viewport UI/UX Refinement Plan

## Problem Summary
1. Camera "pulls" after releasing gizmo drag (no `dragging-changed` on PositionTransformGizmo, damping residual)
2. View presets hidden behind dropdown, no fixed bar with standard views (Top/Front/Left/Right/Iso)
3. No central interaction state machine — camera, gizmo, box-select all fight for mouse
4. Intro sweep can override manual camera after user interacts
5. Mouse button mapping inconsistent between modes

## Architecture

### New File: `src/store/useViewportStore.ts` (~80 lines)
Central interaction state machine:
```
ViewportInteractionState = 'idle' | 'navigating' | 'transforming' | 'boxSelecting' | 'cameraAnimating'
ViewPreset = 'perspective' | 'top' | 'front' | 'back' | 'left' | 'right' | 'iso'
```
Actions: `setInteractionState`, `setViewPreset`, `frameSelection`, `frameAll`, `cancelCameraAnimation`, `setProjection` (perspective/ortho).

### New File: `src/components/editor/ViewportBar.tsx` (~200 lines)
Fixed horizontal bar at top of viewport (always visible on desktop). Contains:
- **View presets**: Perspective, Top, Front, Back, Left, Right, Iso — as compact buttons
- **Quick actions**: Frame Selection, Frame All, Reset Camera
- **Toggles**: Projection (Persp/Ortho), Grid, Axes, Helpers, Ground
- **Mode chip**: Shows current editor mode (Select, Add Pyro, etc.)
- Collapses to icon-menu on narrow widths (never disappears)

### Modified: `src/components/editor/PositionTransformGizmo.tsx`
- Add `dragging-changed` event listener on TransformControls
- When dragging starts: dispatch `setInteractionState('transforming')`, disable OrbitControls
- When dragging ends: zero damping velocity, reset OrbitControls target momentum, re-enable OrbitControls, set state back to `idle`

### Modified: `src/components/editor/SkyCanvas.tsx` (CameraController)
- **Remove `enableDamping`** (or set `dampingFactor` to 0) in edit mode — damping only during explicit camera animations
- After any camera lerp/animation finishes: zero all velocity/momentum on OrbitControls
- On first manual mouse interaction: set `introPhase = 'done'` immediately, cancel any active sweep
- Subscribe to `useViewportStore` interaction state: disable OrbitControls when state is `transforming` or `boxSelecting`
- Add view preset handlers: when `viewPreset` changes, set camera position/target for standard orthographic views (Top = look down Y, Front = look along Z, etc.)
- Add ortho/perspective projection toggle

### Modified: `src/components/editor/SkyCanvas.tsx` (main render)
- Replace `ViewportConfigMenu` positioning with new `ViewportBar` at top
- Keep `ViewportConfigMenu` as secondary advanced dropdown (nav modes, drone renderer, etc.)
- Add mode chip overlay showing current tool

### Modified: `src/components/editor/skycanvas/sharedState.tsx`
- Add standard view presets (Top/Front/Back/Left/Right/Iso) with proper camera math
- Separate from the existing cinematic presets

### Modified: `src/components/editor/ViewportNavControls.tsx`
- Wire zoom/reset actions through `useViewportStore` instead of raw window events
- Add Frame Selection action

## Mouse Mapping (enforced in CameraController)
All modes:
- Left click: select / box-select / place (mode-dependent)
- Left drag on gizmo: transform object (OrbitControls disabled)
- Middle drag: orbit camera
- Right drag: pan camera
- Wheel: zoom at cursor
- Double click: focus selection
- Esc: cancel active tool, return to select

## Files Summary

| Action | File |
|--------|------|
| Create | `src/store/useViewportStore.ts` |
| Create | `src/components/editor/ViewportBar.tsx` |
| Modify | `src/components/editor/PositionTransformGizmo.tsx` |
| Modify | `src/components/editor/SkyCanvas.tsx` |
| Modify | `src/components/editor/skycanvas/sharedState.tsx` |
| Modify | `src/components/editor/ViewportNavControls.tsx` |

## Key Behaviors After Implementation
- Dragging gizmo then releasing mouse: camera stays perfectly still
- Intro sweep cancels on first mouse interaction
- View presets always visible as a top bar
- Standard views (Top/Front/Left/Right) switch to orthographic automatically
- Esc always returns to select mode
- Mode chip always visible in viewport

