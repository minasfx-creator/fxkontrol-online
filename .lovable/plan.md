## Objetivo
Usar os 9 arquivos `.fwe` anexos (todos `xsi:type="Mine"`) como base canônica para refinar os mines no SkyCanvas — paleta, densidade, lifetimes e silhuetas reais do FWsim, sem inventar números.

## Arquivos anexos (todos Mine)
1. `Mine_Purple_Comet_White_w_Silver_Tail.fwe` (529 linhas — multi-fase, comet branco c/ cauda prata)
2. `Mine_Purple_to_Orange.fwe` (263 linhas — color shift)
3. `Mine_Red_to_Green.fwe` (263 — color shift)
4. `Mine_Red_w_Silver_Tail_bright_thinned.fwe` (447 — denso c/ cauda)
5. `Mine_Red-2.fwe` (254 — solid)
6. `Mine_Silver.fwe` (447 — silver denso)
7. `Mine_White_w_Silver_Tail.fwe` (447)
8. `Mine_Yellow_to_Purple.fwe` (263 — color shift)
9. `Mine_Yellow.fwe` (254 — solid)

## Plano

### 1. Ingestão dos .fwe como assets reais
- `code--copy` os 9 arquivos para `public/finale-presets/mines/` (mantém naming).
- Adicionar à pipeline existente `scripts/parse-fwe-presets.py` (já reconhece `Mine` rootKind) gerando entradas em `src/data/fwsimBuiltinPresets.json`.
- Gerar thumbs opcional (placeholder, sem PNG já que upload não trouxe).

### 2. Extrair parâmetros canônicos (parser puro, sem mutar runtime)
Novo helper `src/lib/fweMineExtractor.ts`:
- Parse `<StarTails>` (Density, Width, Life, LifeSigma, FadeRatios, StarSizeFactor) e `<Color>` (Custom RGB ou Named).
- Detectar **color-shift** (≥2 fases de Stars com cores distintas) → emite `colorPhases: [{rgb, lifeRatio}]`.
- Detectar **comet head** (presença de `CustomTailsLink` "Mortar Sparks" + Stars central denso) → flag `hasCometHead`.
- Detectar **silver tail** (StarTails branco/silver com Density alta) → flag `silverTail`.

### 3. Catalog: `src/data/effectsLibraries/generated/fweMinesParts.json`
Entradas tipadas adicionadas via `finalePartToEffect` (já existe), expostas em `getMergedEffectsCatalog()`. Cada uma vira `Effect` com:
- `partType:'mine'`, `category:'mines'`
- `color` primário + `secondaryColor`
- `pattern:'mine_colorShift'|'mine_comet'|'mine_solid'` (novo discriminador)
- `prefire`, `duration`, `caliber` derivados do XML (não chutados).

### 4. Renderer refinement (presentation only)
Atualizar `src/render/silhouettes/mineSilhouettes.ts` + consumidor `MineEffect`:
- Adicionar variante `mine_comet_with_silver_tail` (1 jato denso central, jitter 1.5°, vida longa) — derivada de `Mine_Purple_Comet_White_w_Silver_Tail`.
- Suportar `colorPhases[]` no renderer: lerp RGB ao longo de `lifeRatio` (já há `_copyMaterial`, só nova uniform).
- `FadeRatios` do .fwe (A/B/C/D) → curva de opacidade (já temos `pow(lifeRatio,1.6)` — substituir por interpolação cúbica dos 4 pontos quando disponível).

### 5. Testes
- `src/lib/__tests__/fweMineExtractor.spec.ts` (9 fixtures): pinar cor primária, fases detectadas, comet head, silver tail.
- `src/data/__tests__/fweMinesParts.spec.ts`: 9 effects registrados, ids estáveis, `partType==='mine'`.
- `src/render/silhouettes/__tests__/mineSilhouettes.spec.ts`: novo variante `mine_comet_with_silver_tail` presente, jitter ≤2°.

### 6. Memória
- Atualizar `mem://funcionalidades/fwsim-asset-pack-integration` (+9 mines).
- Nova memória `mem://render/mine-color-shift-and-comet-head` documentando `colorPhases` + `hasCometHead` + `FadeRatios` cubic.

## Fora de escopo
- Sem mudança em safety/workMode/CommandBus.
- Sem novo upload de PNG thumbs (placeholders SVG já existentes).
- Sem reescrita de shaders existentes — só uniforms adicionais opt-in via flag `r_fwe_mine_color_phases` (default ON).

## Entregáveis (arquivos)
- `public/finale-presets/mines/*.fwe` (9, copiados)
- `src/lib/fweMineExtractor.ts` (novo)
- `src/data/effectsLibraries/generated/fweMinesParts.json` (gerado)
- `src/render/silhouettes/mineSilhouettes.ts` (edit: +1 variante)
- Renderer `MineEffect` (edit cirúrgico: colorPhases uniform)
- 3 specs novas
- Atualização de 2 memórias

Tempo estimado: 1 turno de implementação.
