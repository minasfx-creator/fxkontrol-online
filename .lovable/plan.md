# Livrarias de Efeitos — Padrão Finale 3D (527 parts)

## Inspeção dos uploads

| Arquivo | Manufacturer | Parts | Schema |
|---|---|---:|---|
| Showven_✔️Finale_Verified | Showven | 181 | 35 cols canônicas |
| Lidu_USA | Lidu | 112 | 35 cols canônicas |
| Magic_Fireworks | Magic Fireworks | 40 | 35 cols canônicas |
| Winda_Fireworks | Winda | 85 | 31 cols **Display Names** (precisa map) |
| Amazon_Fireworks_V2.1 | Amazon Fireworks | 109 | 35 cols canônicas |
| **Total** | | **527** | |

Schema canônico Finale 3D Part Library:
`partNumber, qoh, available, description, size, internalDelay, duration, height, numDevices, color, subtype, vdl, manufacturerPartNumber, manufacturer, partType, stdPrice, stdLocation, lockoutDefault, numTubes, category, customPartField, rackType, partNotes, dmxPatch, exNumber, ceNumber, unNumber, stdCost, safetyDistance, fuseDelay, weight, neq, physicalSpecifications, dmxFixtureDefinition, ematches`

Winda usa cabeçalhos por extenso ("Product ID", "Effect height", …) — mapa de tradução já validado.

## O que será criado

### 1. Schema canônico — `src/data/effectsLibraries/finalePart.ts`
- `interface FinalePart` (35 campos opcionais, `partNumber` obrigatório)
- `interface FinaleLibrary { manufacturer, slug, count, parts }`
- `FINALE_PART_COLUMNS` (ordem oficial p/ export XLSX 1:1 com Finale 3D)
- `WINDA_DISPLAY_TO_CANONICAL` (mapa de import)

### 2. Seeds JSON — `src/data/effectsLibraries/{showven,lidu,magic,winda,amazon}.json`
Conversão XLSX→JSON já executada (NaN strip, ints onde aplicável, Winda renomeado). 527 parts validadas. Manifest em `index.json`.

### 3. Adapter VDL render-accurate — `src/data/effectsLibraries/adapter.ts`
- `finalePartToEffect(part, { librarySlug })`:
  1. Sniff de cor a partir de `color + vdl + description` (PT/EN: red/vermelho, gold/dourado, …)
  2. RGB hint → **`quantizeRgbToVdl()`** (pipeline LED-accurate já canônico — `mem://funcionalidades/vdl-color-pipeline-render-led-accurate`)
  3. `effect.color = vdl.renderHex` (palette × luminância de input — dim fica dim)
  4. `parseCaliberInches("3"" | "30mm" | "1.2"")` → polegadas
  5. Pattern sniff via VDL (chrysanthemum/willow/strobe/crackle/comet/mine/…)
  6. `partType` mapeia `flame/sfx/laser/light/drone/formation` → `Effect.type`
- `ledAccurateHex(hex)` — re-tinta hex existente

### 4. Registry runtime — `src/data/effectsLibraries/registry.ts`
- 5 imports estáticos (tree-shake friendly)
- `listFinaleLibraries()`, `getFinaleLibrary(slug)`, `getFinalePart(id)`
- `searchFinaleParts({ query, manufacturers, partTypes, minCaliberIn, maxCaliberIn, limit })`
- `buildImportedEffects()` → `Effect[]` para o `EffectLibrarySidebar`
- `getRegistrySummary()` — contagem por fabricante

### 5. Importador unificado XLSX/JSON — `src/data/effectsLibraries/import.ts`
- `parseFinalePartsXlsx(file: File): Promise<FinaleLibrary>` (usando `xlsx` já no projeto)
  - Detecta header canônico vs Winda Display Names automaticamente
  - Coage tipos numéricos, drop NaN, valida `partNumber` único
  - Retorna `{ manufacturer, slug, count, parts, warnings[] }`
- `parseFinalePartsJson(text): FinaleLibrary` — mesmo contrato
- **Estabelece como padrão único de import**: qualquer novo XLSX/JSON entra por essa porta

### 6. UI: `EffectLibrarySidebar` consome registry
- Patch mínimo: combinar `EFFECT_LIBRARY` (legacy) + `buildImportedEffects()`
- Filtros já existentes (categoria/tipo) ganham 5 manufacturers
- Cores no sidebar passam pelo VDL pipeline → preview = LED real

### 7. Inspeção: `/dev/effects-libraries`
- Painel read-only:
  - Resumo (5 libs × 527 parts)
  - Tabela: partNumber · description · partType · caliber · color (chip renderHex) · VDL · prefire · duration
  - Search box (query/manufacturer/type)
  - Botão "Import XLSX" valida e mostra `FinaleLibrary` parseado (não persiste — modo dev)

### 8. Render: VDL → engine
Os efeitos importados já carregam `Effect.color = renderHex` + `impliesTrail` + `pattern`. O `Show3DEngine` consome essa cor diretamente em `Particle Explosion` (mem `show3d-engine-playback-auto-fire`), garantindo paridade simulação ↔ realidade LED.

### 9. Memory + testes
- Atualizar `mem://index.md` + nova entrada `mem://funcionalidades/finale-libraries-import-canonical`
- Tests:
  - `finalePartAdapter.spec.ts` — color quantize, caliber parser PT/EN/inch/mm, pattern sniff
  - `effectsLibrariesRegistry.spec.ts` — totais (527), search filters, lookup por id
  - `windaDisplayMap.spec.ts` — todos os 30 cabeçalhos Winda mapeiam

## Fora de escopo (proposto)
- Persistência das livrarias em backend (hoje vivem em JSON estático bundled)
- Editor de parts (criar/alterar) — só leitura por enquanto
- Export XLSX 1:1 Finale 3D (separável; viável depois com `xlsx` writer + `FINALE_PART_COLUMNS`)

## Critério de aceite
- 527 parts disponíveis no `EffectLibrarySidebar`
- Cores no preview = `renderHex` (VDL pipeline)
- `/dev/effects-libraries` lista as 5 livrarias com totais corretos
- XLSX dropado no painel é parseado em FinaleLibrary sem perda de campos
- Suite verde (3 specs novos)
