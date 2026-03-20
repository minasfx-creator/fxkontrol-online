

# Plan: Interactive Transform Gizmos for Site Models

## Overview
Add `TransformControls` from `@react-three/drei` to allow users to translate, rotate, and scale imported 3D models directly in the viewport. Clicking a model selects it and shows the gizmo; a toolbar lets the user switch between translate/rotate/scale modes.

## Steps

### Step 1: Add selection state to scene store
**Modify**: `src/store/useSceneStore.ts`
- Add `selectedSiteModelId: string | null` and `siteModelTransformMode: 'translate' | 'rotate' | 'scale'`
- Add actions: `selectSiteModel(id | null)`, `setSiteModelTransformMode(mode)`

### Step 2: Update SiteModelRenderer with TransformControls
**Modify**: `src/components/editor/SiteModelRenderer.tsx`
- Import `TransformControls` from `@react-three/drei`
- When a model is selected, wrap it in `<TransformControls>` with the current mode
- On `mouseDown` / click on the `<primitive>`, call `selectSiteModel(id)`
- On `TransformControls` `objectChange` event, sync position/rotation/scale back to the store via `updateSiteModel`
- Disable `OrbitControls` while dragging the gizmo (use `onMouseDown`/`onMouseUp` events to toggle a flag)

### Step 3: Add gizmo mode toolbar in SkyCanvas
**Modify**: `src/components/editor/SkyCanvas.tsx`
- When `selectedSiteModelId` is set, show a small floating toolbar with Move/Rotate/Scale buttons
- Add an Escape key handler to deselect (`selectSiteModel(null)`)

## Files to Modify
| File | Change |
|------|--------|
| `src/store/useSceneStore.ts` | Add selection state + transform mode |
| `src/components/editor/SiteModelRenderer.tsx` | Add TransformControls + click-to-select |
| `src/components/editor/SkyCanvas.tsx` | Add gizmo mode toolbar overlay |

