

# Plan: 3D Warehouse glTF Download & Viewport Integration

## Overview
Add real glTF model downloading from 3D Warehouse and render imported models as site layout objects in the 3D viewport (SkyCanvas). Since 3D Warehouse's direct API is CORS-restricted from browsers, we'll build an edge function proxy and add a scene store for imported site models.

## Architecture

```text
AssetMarketplaceBrowser
  └─ "Import" button on 3D Warehouse assets
       └─ calls edge function: warehouse-download
            └─ proxies 3D Warehouse glTF download URL
                 └─ returns binary glTF/GLB to client
                      └─ stored as blob URL in useSceneStore.siteModels[]
                           └─ <SiteModelRenderer> in SkyCanvas
                                └─ useGLTF() renders each model
```

## Steps

### Step 1: Create edge function `warehouse-download`
**New file**: `supabase/functions/warehouse-download/index.ts`
- Accepts `{ modelId, format }` in POST body
- Constructs the 3D Warehouse download URL (COLLADA/glTF endpoint)
- Fetches the model server-side (bypasses CORS)
- Returns the binary GLB data with proper content-type headers
- Includes CORS headers for browser access

### Step 2: Add site models to scene store
**Modify**: `src/store/useSceneStore.ts`
- Add `SiteModel` interface: `{ id, name, url (blob), position, rotation, scale, visible }`
- Add `siteModels: SiteModel[]` to state
- Add CRUD actions: `addSiteModel`, `updateSiteModel`, `removeSiteModel`

### Step 3: Create SiteModelRenderer component
**New file**: `src/components/editor/SiteModelRenderer.tsx`
- R3F component that reads `useSceneStore.siteModels`
- For each model, uses `useGLTF` (from drei) to load from blob URL
- Renders with position/rotation/scale transforms
- Adds transform gizmo handles for moving/rotating/scaling models interactively
- Supports visibility toggle

### Step 4: Update AssetMarketplaceBrowser import flow
**Modify**: `src/components/editor/AssetMarketplaceBrowser.tsx`
- For 3D Warehouse assets, the "Import" button triggers the download flow:
  1. Show loading toast
  2. Call `warehouse-download` edge function with model ID
  3. Convert response to blob URL
  4. Add to `useSceneStore.siteModels` with default position at origin
  5. Show success toast with model name
- Also support direct GLB/glTF file upload as alternative

### Step 5: Wire SiteModelRenderer into SkyCanvas
**Modify**: `src/components/editor/SkyCanvas.tsx`
- Import and add `<SiteModelRenderer />` inside the Canvas, after `<StageGround>` and before effects
- Models render as part of the 3D scene

### Step 6: Add Site Models management panel
**Modify**: `src/components/editor/AssetMarketplaceBrowser.tsx`
- Add a "Imported Models" section showing loaded models with controls:
  - Position X/Y/Z sliders
  - Rotation Y slider
  - Scale uniform slider
  - Visibility toggle
  - Delete button

## Files to Create
| File | Purpose |
|------|---------|
| `supabase/functions/warehouse-download/index.ts` | Proxy for 3D Warehouse glTF downloads |
| `src/components/editor/SiteModelRenderer.tsx` | R3F component rendering imported 3D models |

## Files to Modify
| File | Change |
|------|--------|
| `src/store/useSceneStore.ts` | Add `siteModels` state + CRUD actions |
| `src/components/editor/AssetMarketplaceBrowser.tsx` | Real download flow + model management UI |
| `src/components/editor/SkyCanvas.tsx` | Add `<SiteModelRenderer />` to scene |
| `supabase/config.toml` | Register warehouse-download function with `verify_jwt = false` |

