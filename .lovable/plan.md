## Escopo

Promover **integração completa** do pacote `Standard_Effects-2.zip`:

- **605 efeitos** `.fwe` (XML FireworkEffect) em 6 coleções:
  - `Presets-2026/` — 69 (catálogo numerado canônico 01–44: Peony, Crown, Willow, Saturn Ring, Heart, Cake I/Z/V-Shape, Rocket, Fountain, Bengal, Roman Candle, Lancework…)
  - `Demo Show 2026 Effects/` — 25 (efeitos calibrados pro show de demo)
  - `Marcus Athmer/` (180) + `Marcus Athmer 2021-04/` (117) + `Marcus Athmer 2023-11/` (210) — coleção massiva (Bengal Lights cromáticos + comets + mines)
  - `2024/` — 4 (Flamejet, Spark Machine, Waveflamer)
- **159 componentes** `.fwc` (StarTails, Crackling, CustomTailsLink) — paleta reusável de "tails" pra enriquecer renderer existente

Tipos cobertos (já mapeados pelo xsi:type inventory):
`Shell` 400 · `Mine` 184 · `Cake` 56 · `Bengal` 35 · `Crackling` 27 · `Eruption` 25 · `Crossette` 19 · `HeartDistribution` 15 · `Farfalle` 4 · `Whistle` 2 · `Rocket` 2 · `Tourbillon` 1 + distribuições especiais (Ring/Heart/QuarterSphere/AtomicPattern/Hemisphere)

## Arquitetura (zero impacto safety/workMode/CommandBus)

```text
public/finale-presets/standard-effects/{collection}/*.fwe   (assets, build-time only)
scripts/parse-standard-effects.py                            (extrator XML batelado)
src/data/effectsLibraries/generated/standardEffects.json    (~600KB, gerado)
src/lib/fweUniversalExtractor.ts                             (parser TS puro)
src/data/standardEffectsCatalog.ts                           (Effect[] memo)
src/data/effectsLibraries/registry.ts                        (+source 'standard-effects')
src/render/silhouettes/*                                     (+1 variant Bengal, +1 Crossette)
src/lib/__tests__/*                                          (8 spec novos)
```

## Implementação

### 1. Ingestão de assets
- Copiar 605 `.fwe` + 159 `.fwc` pra `public/finale-presets/standard-effects/<collection>/`.
- Slugify nomes (remover espaços, acentos) — preservar coleção como subpasta.

### 2. Extrator universal (`scripts/parse-standard-effects.py`)
- Refatora `parse-fwe-presets.py` em função `extract_fwe(path) -> dict` reutilizável.
- Novos campos extraídos:
  - `rootType` (Shell/Mine/Cake/Bengal/Rocket/Crossette/Farfalle/Whistle/Eruption/Tourbillon)
  - `distribution` (Spherical/Ring/Heart/QuarterSphere/AtomicPattern/Hemisphere/Mine)
  - `palette[]` (até 8 cores, dedup, hex)
  - `colorPhases[]` (Color/Color2 + Count por phase — pra color-shift e multi-break)
  - `hasPistil`, `hasTailsLink`, `hasCracklingLink`
  - `cakeShotCount`, `cakeRows`, `subShellCount` (multi-break)
  - `bengalDurationS` (do nome: `(30s)`, `(05s)`, etc.)
  - `caliberIn` (do `<Diameter>` max ÷ 0.0254)
  - `prefire`, `lift`, `fanAngleDeg` quando presentes
- Output: `src/data/effectsLibraries/generated/standardEffects.json` com shape `{ version, generatedAt, collections: {...}, parts: StandardEffectPart[] }`.

### 3. Parser TS espelhado (`src/lib/fweUniversalExtractor.ts`)
- `extractFweUniversal(xml, fileName) -> FweUniversalSpec` — puro, sem DOMParser (regex balanceado, mesma técnica de `fweMineExtractor`).
- Test fixtures: 1 por rootType (10 fixtures inline em `__tests__/fweUniversalExtractor.spec.ts`) garantem que o build script + runtime extractor concordam (parity test).

### 4. Adapter pra `Effect[]` (`src/data/standardEffectsCatalog.ts`)
- `standardEffectPartToEffect(part) -> Effect` aproveitando `finalePartToEffect.ts` (PART_TYPE_MAP, CATEGORY_BY_PART, ICON_BY_PART) com extensões:
  - `Bengal` → `partType: 'light'`, categoria `iluminacao`, `duration = bengalDurationS`
  - `Crossette` → `partType: 'shell'` + flag `pattern: 'crossette'` (renderer já trata)
  - `Cake` (Z/V/Fan-Shape) → preserva `firingPattern` em `effect.metadata.cakeFiring`
- Stable id: `se-<collection>-<slug>` (sobrevive a renomeações).

### 5. Registry merge (`src/data/effectsLibraries/registry.ts`)
- Adiciona source `'standard-effects'` ao array `sources` em `getMergedEffectsCatalog`.
- Manufacturer detection: `se-` prefix → `'FWsim'` (mesma claim `pilot`).
- Dedup automático via `effectFingerprint` existente (colapsa duplicatas entre coleções).

### 6. Refinements de renderer (mínimos, opt-in via flag)
- **Bengal**: nova silhouette `bengalGroundFlame` em `src/render/silhouettes/bengalSilhouettes.ts` (chama existing flame system com `duration` real do nome, 1 jato vertical baixo, cor sólida).
- **Crossette**: split-particle behavior já existe no `EFFECT_LIBRARY` — só wire da flag `pattern: 'crossette'` em `resolveEffect.ts`.
- **Color-shift universal**: `colorPhases[]` propagado pra `SkyCanvas3D` via `effect.colorPhases` (uniform já existe pro caso Mine).
- Flag `r_standard_effects_pack` default ON, override `fxk.flag.standard_effects_pack`.

### 7. UI
- `EffectLibrary.tsx`: badge "+605 Standard Effects" (mesmo padrão do badge atual "+527 Finale Libraries").
- Filtro por coleção (Presets-2026 / Demo 2026 / Athmer / 2024) — dropdown novo, não substitui filtros existentes.

### 8. Testes (8 spec novos)
- `fweUniversalExtractor.spec.ts` — 10 fixtures, 1 por rootType.
- `standardEffectsCatalog.spec.ts` — count por coleção, dedup vs FWsim builtin, color-phases preservados.
- `bengalSilhouettes.spec.ts` — duration extraída do nome.
- `registryStandardEffectsMerge.spec.ts` — fingerprint collision com Curated wins.

### 9. Memória
- Criar `mem://funcionalidades/standard-effects-pack-integration` (605 efeitos, 6 coleções, claim pilot, flag, badge UI).
- Atualizar `mem://index.md` (1 linha).

## Fora de escopo

- Nenhuma mudança em `safety`, `workMode`, `uiCommandGateway`, `CommandBus`, `FieldBus`, `SafetyStateMachine`.
- Sem geração de thumbnails PNG (script standalone separado se demandado).
- Sem field-test/validação física (claim permanece `pilot`).
- Sem novos shaders — só uniforms já existentes.

## Entregáveis

1. 605 + 159 assets copiados.
2. 1 script Python (extrator batelado).
3. 1 JSON gerado (~600KB, chunk separado via Vite).
4. 3 arquivos TS novos (`fweUniversalExtractor.ts`, `standardEffectsCatalog.ts`, `bengalSilhouettes.ts`).
5. 2 arquivos TS editados (`registry.ts`, `EffectLibrary.tsx`, `resolveEffect.ts`).
6. 8 spec files novos.
7. 2 entradas de memória.

**Tempo estimado**: 1 turno de implementação (heavy: copy + script run + write files em paralelo).
