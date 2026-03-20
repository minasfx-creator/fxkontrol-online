

# Plan: Unreal Engine Niagara Firework Asset Integration

## Context
The uploaded files are binary `.uasset` (Unreal Engine Niagara particle systems) and `.umap` files. These cannot be parsed directly in a browser — UE4/5 binary formats are proprietary and undocumented. However, we can extract **known Niagara firework parameters** from the file names and UE conventions to create matching web effects.

## Approach
Since `.uasset` files are opaque binaries, we will:
1. Use the file names (Blue, Yellow, Pink) and standard Niagara firework module parameters to define accurate color palettes and burst profiles
2. Build a **UE Asset Importer panel** that accepts `.uasset` files, extracts metadata where possible, and maps to our effect system
3. Add the Niagara-inspired effects to the Effect Library
4. Create show templates based on these effects

---

## Step 1: Add Niagara-Inspired Effects to Effect Library

**File**: `src/store/useProjectStore.ts`

Add 3 new effects to `EFFECT_LIBRARY`:
- **Ns Firework Blue** — Blue peony shell 5", color `#0066FF`, with color-change to cyan
- **Ns Firework Yellow** — Gold/yellow chrysanthemum 6", color `#FFD700`, kamuro-style long hang
- **Ns Fireworks Pink** — Pink multi-break 4", color `#FF69B4`, crossette pattern

Each will include caliber, height, pattern, and safety distance matching Finale 3D standards.

## Step 2: Extract Color Palettes as Presets

**New file**: `src/lib/niagaraColorPresets.ts`

Define structured color presets extracted from the Niagara naming convention:
- `niagara-blue`: primary `#0066FF`, secondary `#00CCFF`, thermal gradient
- `niagara-yellow`: primary `#FFD700`, secondary `#FF8C00`, ember fade
- `niagara-pink`: primary `#FF69B4`, secondary `#FF1493`, magenta transition

These presets will be usable in the Effect Editor's color picker and in the ShellBurstRenderer's `uColor`/`uColor2` uniforms.

## Step 3: Build UE Asset Importer Panel

**New file**: `src/lib/uassetParser.ts`
- Attempt to read the UE4 asset magic header (`0xC1832A9E`) and extract string table entries (asset names, class references like `NiagaraSystem`, `NiagaraEmitter`)
- Extract color values from known byte patterns (FLinearColor: 4x float32)
- Extract particle counts, lifetime values from known Niagara module data offsets
- Return a structured `UAssetParseResult` with extracted metadata or fallback to filename-based heuristics

**New file**: `src/components/editor/UAssetImporter.tsx`
- Dialog with drag-and-drop for `.uasset` / `.umap` files
- Shows parsed metadata (colors, particle counts, system names)
- Maps extracted data to `Effect` entries and adds to the project
- Preview card showing the interpreted effect with color swatches

**Integration**: Add import button in ModelImportPanel or as a new toolbar option.

## Step 4: Create Show Templates

**File**: `src/lib/showTemplates.ts`

Add 2 built-in templates:
- **"Niagara Blue & Gold"** — Alternating blue and yellow shells with timed spacing
- **"Niagara RGB Finale"** — All three colors in a grand finale sequence with multi-break pink as closer

Templates will include timeline items with positions and timing pre-configured.

## Step 5: Wire into UI

- Add `.uasset` to accepted file types in existing import dialogs
- Add "Niagara Presets" subcategory in the Effect Library sidebar
- Register the UAssetImporter dialog in the toolbar/menu system

---

## Files to Create
| File | Purpose |
|------|---------|
| `src/lib/uassetParser.ts` | Binary parser for UE4 .uasset header/string table |
| `src/lib/niagaraColorPresets.ts` | Color palette presets from Niagara systems |
| `src/components/editor/UAssetImporter.tsx` | Import dialog UI |

## Files to Modify
| File | Change |
|------|--------|
| `src/store/useProjectStore.ts` | Add 3 Niagara effects to EFFECT_LIBRARY |
| `src/lib/showTemplates.ts` | Add 2 built-in Niagara show templates |
| `src/components/editor/effects/index.ts` | No change needed (uses existing renderers) |
| `src/components/editor/Toolbar.tsx` | Add UAsset import menu entry |

