

# Plan: Integrar Importadores à Content Library + Expandir Parser UAsset + DMX Profiles

## Resumo

Todos os importadores atualmente salvam apenas na timeline/viewport local. Apenas 2 de 8 importadores salvam na biblioteca do usuário (`useMyLibrary`). Este plano:
1. Conecta **todos os importadores** ao `useMyLibrary` para auto-salvar assets importados
2. Expande o parser UAsset com classificação por tipo (fixture, pyro, material, texture, curve table)
3. Adiciona 12 novos DMX fixture profiles dos 26 .uasset acumulados
4. Cria nova aba "Content Library" no AssetMarketplaceBrowser com filtros por tipo de conteúdo

## Mudanças

### 1. `src/lib/uassetParser.ts` — Classificação por Tipo de Asset

Adicionar campos ao `UAssetParseResult`:
- `assetType`: 11 tipos (`blueprint_fixture`, `blueprint_pyro`, `material`, `material_instance`, `texture`, `curve_table`, `material_param_collection`, `dmx_library`, `niagara_system`, `niagara_emitter`, `unknown`)
- `suggestedFixtureProfile?: string` — mapeia para profile DMX

Expandir `applyFileNameHeuristics` para detectar prefixos:
- `BP_Spot/Wash/Static/Toner/Audience/Stadium/Matrix/Strobe` → `blueprint_fixture`
- `BP_Pyro/Firework/Laser` → `blueprint_pyro`/`blueprint_sfx`
- `M_` → `material`, `MI_` → `material_instance`, `MPC_` → `material_param_collection`
- `T_` → `texture`, `*_Table` → `curve_table`, `DMXLib` → `dmx_library`

### 2. `src/lib/dmxEngine.ts` — 12 Novos Fixture Profiles + Registros

Expandir `category` para incluir `'matrix' | 'toner' | 'audience'`.

Adicionar 12 profiles: `spot-mh-standard` (20ch), `spot-mh-hq` (32ch com shapers), `audience-toner` (8ch), `stadium-light` (9ch), `static-scene-light` (7ch), `static-toner` (6ch), `toner-beam` (9ch), `led-matrix-5x1` (7ch), `led-matrix-panel` (8ch), `strobe-high-power` (8ch), `wash-led-par` (9ch), `wash-spotlight` (10ch).

Adicionar `UE5_BLUEPRINT_MAP` (26 entradas), `STROBE_CURVES` (5 entries), `GOBO_TEXTURES` (2 entries).

### 3. `src/lib/effectTypeSystem.ts` — Novo Tipo `orb_drone`

Adicionar `orb_drone`: esfera luminosa (category: `sfx`, duration: 60s, colorChannels: 3).

### 4. `src/lib/niagaraColorPresets.ts` — 4 Novos Presets

Presets para: `bp-firework-v2`, `bp-pyro-v4`, `bp-laser-extended`, `bp-sphere-orb`.

### 5. `src/components/editor/UAssetImporter.tsx` — Import Inteligente + Salvar na Library

- Ícones por `assetType` (Lightbulb, Flame, Palette, Image, BarChart3)
- Badge com profile DMX sugerido para fixtures
- **Auto-salvar** arquivo .uasset na biblioteca via `useMyLibrary.saveToLibrary()` com tags baseadas no `assetType`
- Import diferenciado: fixtures → toast com profile DMX; pyro/niagara → criar Effect na timeline

### 6. Importadores que passam a salvar na Content Library

Cada importador ganha `useMyLibrary()` e chama `saveToLibrary()` ao importar:

| Importador | source tag | file_format | tags |
|---|---|---|---|
| `UAssetImporter` | `ue5-uasset` | `uasset` | `[assetType, suggestedCategory]` |
| `MVRImporter` | `mvr` | `mvr` | `['mvr', 'fixtures']` |
| `CSVImporter` | `csv-import` | `csv` | `['positions', 'formation']` |
| `VVIZImporter` | `vviz` | `vviz` | `['show', 'vviz']` |
| `SceneObjectImporter` | `local-3d` | ext (glb/fbx/obj) | `['3d-model', 'scene']` |
| `CatalogImportDialog` | `catalog` | ext (csv/fdb) | `['catalog', 'effects']` |
| `GMA2PatchImporter` | `gma2` | `csv` | `['patch', 'dmx']` |
| `UE5DMXPrevisImporter` | `ue5-dmx` | `json` | `['dmx', 'ue5']` |
| `UE5MapImporter` | `ue5-map` | ext | `['map', 'terrain']` |

### 7. `src/components/editor/AssetMarketplaceBrowser.tsx` — Filtros na Content Library

Na aba "My Library", adicionar filtros por tag:
- Chips: `All`, `3D Models`, `UE5 Assets`, `DMX/Patch`, `Shows`, `Catalogs`, `Formations`
- Filtrar `libraryAssets` por tags correspondentes

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/lib/uassetParser.ts` | assetType (11 tipos), suggestedFixtureProfile, heurísticas expandidas |
| `src/lib/dmxEngine.ts` | 12 profiles, category types, UE5_BLUEPRINT_MAP, STROBE_CURVES, GOBO_TEXTURES |
| `src/lib/effectTypeSystem.ts` | Novo tipo orb_drone |
| `src/lib/niagaraColorPresets.ts` | 4 novos presets BP_ |
| `src/components/editor/UAssetImporter.tsx` | Classificação visual, import diferenciado, auto-save library |
| `src/components/editor/MVRImporter.tsx` | Auto-save to library |
| `src/components/editor/CSVImporter.tsx` | Auto-save to library |
| `src/components/editor/VVIZImporter.tsx` | Auto-save to library |
| `src/components/editor/SceneObjectImporter.tsx` | Auto-save to library |
| `src/components/editor/CatalogImportDialog.tsx` | Auto-save to library |
| `src/components/editor/GMA2PatchImporter.tsx` | Auto-save to library |
| `src/components/editor/UE5DMXPrevisImporter.tsx` | Auto-save to library |
| `src/components/editor/UE5MapImporter.tsx` | Auto-save to library |
| `src/components/editor/AssetMarketplaceBrowser.tsx` | Filtros por tag na aba My Library |

