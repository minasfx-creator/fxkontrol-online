# Plano rev6 — Pattern shells (Ring/Heart/Smiley/Bow Tie/Diadem/Jellyfish/Half-Half)

Estende `src/data/finalePresets.ts` com **9 shells de padrão geométrico** extraídos dos novos FWE. Esta rev introduz dois novos `ShellGeometry` (`heart`, `custom-shape`, `hemisphere`) e expande o catálogo para 19 shells totais.

## Parâmetros canônicos extraídos (FWsim Pro, 1:1)

| ID | Source | Distribution | Count | Speed | Sigma | Star/Mass | Life | FadeABCD | Cor base |
|---|---|---|---|---|---|---|---|---|---|
| `ring` | 25_Ring | Ring | 20 | 0.8 | 0 | Small/0.8 | 1.2–1.6 | 0.127, 0.461, 0.814, 0.999 | Red |
| `double-ring` | 26_Double_Ring | Ring + 2nd Ring rotated | 30 | 0.8 | 0 | Small/0.8 | 1.2–1.6 | 0.127, 0.705, 0.814, 0.999 | Red |
| `saturn-ring` | 27_Saturn_Ring | Ring + spherical core | 16 | 0.8 | 0 | XSmall/0.5 | 2.3–2.5 | 0.506, 0.698, 0.870, 1 | Orange + Gold Titanium glitter strobe 36.5Hz |
| `heart` | 28_Heart | **HeartDistribution** | 34 | 0.5 | 0.14 | Small/0.8 | 1.2–1.6 | 0.127, 0.461, 0.814, 0.999 | Red |
| `smiley` | 29_Smiley | **CustomShapeDistribution** | 150 | 1.0 | 0.02 | XSmall/0.7 | 1.5–2.82 | 0.1, 0.302, 0.796, 1 | Orange |
| `bow-tie` | 30_Bow_Tie | Mine + Silver #4 tail | 40 | 0.8 | 0.018 | XSmall/0.7 | 1–2 | 0.176, 0.547, 0.897, 0.999 | PastelGreen + Silver tails D250 W0.6 |
| `cluster-diadem` | 31_Cluster_Diadem | Mine + AscentEffect cluster | 20 | 0.6 | 0.14 | Small/0.8 | 1.5–2.3 | 0.1, 0.302, 0.796, 1 | Invisible body + ascent gold sparks |
| `jellyfish` | 32_Jellyfish_Mushroom | Mine inverted (X-rot π) | 6 | 0.8 | 0 | Small/0.8 | 1.5–2.3 | 0.1, 0.302, 0.796, 1 | White + Silver tail D500 W0.6 |
| `half-half` | 33_Half_Half | **HemisphereDistribution** | 50 | 0.8 | 0.02 | XXSmall/0.5 | 1.2–1.5 | 0.1, 0.250, 0.734, 0.968 | Orange (with Red phase) |

## Mudanças

### 1. `src/data/finalePresets.ts`

- Estender `ShellGeometry`:
  ```ts
  | 'sphere' | 'ring' | 'palm-semi' | 'crown-asym'
  | 'quarter-sphere'
  | 'heart' | 'custom-shape' | 'hemisphere' | 'inverted-hemisphere'
  ```
- Adicionar **9 entradas** em `FINALE_SHELL_PRESETS` (`ring`, `double-ring`, `saturn-ring`, `heart`, `smiley`, `bow-tie`, `cluster-diadem`, `jellyfish`, `half-half`).
- Em `saturn-ring`/`bow-tie`/`jellyfish`: incluir `tails[]` canônicos da `CustomTailsLink` (Gold Titanium 89Hz strobe / Silver #4 / Silver D500).
- Em `cluster-diadem`: adicionar campo opcional `ascent?: { densityHz, lifeS, colorHex }` para registrar o `AscentEffect` (renderer rev futura consumirá; struct descritiva só).
- Estender `resolveShellPresetId()` com os novos nomes (`/\bring\b/` → `'ring'`, `/double.?ring/` → `'double-ring'`, `/saturn/` → `'saturn-ring'`, `/heart/` → `'heart'`, `/smiley/` → `'smiley'`, `/bow.?tie/` → `'bow-tie'`, `/diadem|cluster.?diadem/` → `'cluster-diadem'`, `/jellyfish|mushroom/` → `'jellyfish'`, `/half.?half/` → `'half-half'`). Ordem importa: `double-ring` antes de `ring`, `saturn-ring` antes de `ring`.
- Em `TRAIL_HINT`/`CALIBER_HINT`: hints sensatos por preset.

### 2. `src/data/__tests__/finalePresets.shell.spec.ts`

- Atualizar a lista canônica para 19 shells.
- Bloco "rev6 — pattern shells" com 9 testes:
  - `ring` count 20 RingDistribution
  - `double-ring` count 30, FadeABCD especial (0.705 no B)
  - `saturn-ring` tail strobe 36.5 Hz
  - `heart` geometry='heart', count 34, speed 0.5, sigma 0.14
  - `smiley` geometry='custom-shape', count 150
  - `bow-tie` Silver tail D250 + life 0.25
  - `cluster-diadem` ascent definido
  - `jellyfish` inverted-hemisphere + Silver D500
  - `half-half` hemisphere + Orange + XXSmall/0.5
- 1 bloco "rev6 resolvers" garantindo `resolveShellPresetId` casa cada nome.

### 3. Sem mudança em renderer

`ShellBurstRenderer`/`MineEffect`/`CometEffect` não consomem novos campos nesta rev — apenas o catálogo cresce. Wiring fica para rev7 (junto com `MineEffect`/`CakeEffect` que ainda não consomem `presetId`).

## Não muda

- Safety / workMode / uiCommandGateway / CommandBus / FieldBus
- WebGPU / GPGPU / hardware (FXK16 / FireOne / DMX)
- Renderers (`ShellBurstRenderer`, `MineEffect`, `CakeEffect`, `CometEffect`)
- `pyroPhysics.BurstPattern` (mapeio `heart`→`'peony'` ou `'chrysanthemum'` se BurstPattern não tiver `'heart'`; caso tenha, uso o canônico — vou verificar na implementação)
- `FINALE_MINE_PRESETS` / `FINALE_CAKE_SHOT_PRESETS` (rev5 intactos)

## Verificação

- `bunx vitest run src/data/__tests__/finalePresets.shell.spec.ts` — passa todos os blocos (rev1–rev6).
- `listAllPresetIds().shells.length === 19`.
- Type-check verde.
- Zero alteração visual no preview (renderer não tocado).

Aprovar para implementar?
