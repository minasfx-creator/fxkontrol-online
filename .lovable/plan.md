

# Plan: Show Duration Control + 3D Object Importer + FDB Name Fix

## 3 Tasks

### 1. Show Duration Editor in Show Settings
**File: `src/components/editor/ShowSettingsPanel.tsx`**

Currently, duration is shown as read-only `InfoRow`. Change it to an editable field with minutes:seconds input. Add a slider (0-600s range) and a manual input. Call `useProjectStore.getState().setDuration(newValue)` on change.

- Replace `<InfoRow label="Duration" ...>` with an editable duration field (minutes + seconds inputs or a single mm:ss field)
- Add a Slider for quick adjustment (0 to 600 seconds)
- Wire to `setDuration` from the project store
- Also persist to `show_settings` table via `useShowSettings.saveSettings` if connected

### 2. 3D Object Importer for Scene (standalone panel)
**File: `src/components/editor/SceneObjectImporter.tsx` (create)**
**File: `src/components/editor/SiteModelsPanel.tsx` (edit)**

Add an "Import 3D Model" button to SiteModelsPanel that opens a dialog for uploading GLB/FBX/OBJ files directly into the scene (without going through Twinmotion importer). This is a simplified flow:

- File upload accepting `.glb`, `.gltf`, `.fbx`, `.obj`
- Uses the existing `Model3DPreview` component for preview with scale/rotation controls
- On confirm, calls `addSiteModel` and optionally `saveToLibrary`
- Register in FullscreenCommandMenu / PanelTabBar if needed

### 3. Fix FDB Import — Effect Names Not Loading
**File: `src/lib/catalogImporter.ts`**

The bug is in `autoMapHeader`: the `name` field has `'effect'` as an alias, and uses `h.includes(a)` for matching. FDB headers like `"Effect Type"` or `"Effect Color"` contain `"effect"` and get incorrectly mapped to `name` instead of their correct fields (`type`, `color`). This steals the name mapping from the actual description column.

Fix:
- Prioritize **exact matches** over partial (substring) matches in `autoMapHeader`
- First pass: check `h === a` (exact match)
- Second pass only if no exact match: check `h.includes(a)` but with longer aliases prioritized (sort by length descending)
- Add more FDB-specific aliases: `'effect_name'`, `'label'`, `'title'`, `'bezeichnung'` for name; `'fdb_type'` for type
- Add common Finale 3D FDB headers: `'display_description'`, `'product_description'`, `'article_description'`
- Handle edge case where no column maps to `name`: fall back to first text column

## Files Summary

| File | Action |
|------|--------|
| `src/components/editor/ShowSettingsPanel.tsx` | Edit — editable duration with slider |
| `src/components/editor/SceneObjectImporter.tsx` | Create — standalone 3D import dialog |
| `src/components/editor/SiteModelsPanel.tsx` | Edit — add import button |
| `src/lib/catalogImporter.ts` | Edit — fix autoMapHeader priority logic + add FDB aliases |

