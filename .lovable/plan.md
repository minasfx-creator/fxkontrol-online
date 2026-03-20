

# Plan: Filtros, Preview 3D e Presets Customizados no Importador UE5

## 1. Filtros por Universo/Categoria

Add filter buttons above the fixture list in `UE5DMXPrevisImporter.tsx`:
- Row of category toggle chips (spot, wash, sfx, etc.) — click to show/hide
- Universe dropdown or chips for filtering by DMX universe
- "Select Filtered" / "Deselect Filtered" quick actions
- Filters only control visibility in the list; selection state is preserved

## 2. Preview 3D no Diálogo

Add a mini 3D viewport inside the import dialog using `@react-three/fiber` Canvas:
- Renders after file is parsed, above the fixture list
- Calls `computeFixtureLayout()` with current preset + overrides to get positions
- Renders colored spheres/dots at each fixture position, color-coded by category
- Updates live as user changes preset or adjusts sliders
- Simple orbit controls, ~180px height, dark background
- Lightweight: no full drone models, just instanced spheres + a ground plane grid

New component: `src/components/editor/FixtureLayoutPreview.tsx`
- Props: `fixtures`, `layoutPreset`, `categoryOverrides`
- Uses `useMemo` to recompute layout when inputs change
- Renders inside the Collapsible layout section

## 3. Salvar Presets Customizados

Create a new database table `layout_presets` to store user-defined configurations:
- Columns: `id`, `user_id`, `name`, `preset_base` (stage/arena/festival), `category_overrides` (jsonb), `created_at`
- RLS: users manage own presets

In the importer UI:
- "Save Layout" button next to preset selector — opens a name input, saves current preset + overrides
- "Load" dropdown showing saved presets — selecting one applies base preset + overrides
- "Delete" option per saved preset

## Files Modified

1. **`src/components/editor/UE5DMXPrevisImporter.tsx`** — Add filter chips, preview component slot, save/load preset UI
2. **`src/components/editor/FixtureLayoutPreview.tsx`** (new) — Mini R3F Canvas with instanced spheres
3. **Migration** — Create `layout_presets` table with RLS
4. **`src/hooks/useLayoutPresets.ts`** (new) — CRUD hook for layout presets via database

