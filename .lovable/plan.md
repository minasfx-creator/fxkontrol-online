## Auditoria de gaps detectada (Rodada Realismo + Libraries)

### Gap A — Memória mente sobre `Finale Libraries Import Canonical` (CRÍTICO)
A entrada `mem://funcionalidades/finale-libraries-import-canonical` afirma que 5 libs (527 parts) estão integradas em `src/data/effectsLibraries/` com `parseFinalePartsXlsx`, `buildImportedEffects`, etc.
**Realidade**: o diretório `src/data/effectsLibraries/` está **vazio**. Nenhum desses símbolos existe (`grep -r FinalePart src/` retorna nada). Os 5 .xlsx (Showven/Lidu/Magic/Winda/Amazon) que o usuário acabou de re-enviar **nunca foram importados de fato**.
**Fix**: implementar de verdade desta vez (ver §1 abaixo) e atualizar a memória para refletir o estado real.

### Gap B — Renderer dos mines não usa silhueta dos vetores FWsim
`MineEffect.tsx` (572 linhas) faz spray paramétrico mas ignora os SVGs `Mine_01/02/03.svg` enviados, que descrevem o **leque característico** (5 pétalas/jatos divergentes, ângulos 18°–72°, coroa frontal). Hoje rende cone genérico Gaussiano → não bate com referência visual real.
**Fix**: ver §2.

### Gap C — `Modules_1-2.pdf` adiciona specs físicas ausentes do catálogo FireOne
O Field Module Users Guide traz constantes que **não estão em lugar nenhum** do código:
- 32 cues por módulo, 24V current-limited @ 5A
- Tipicamente acende 5 e-matches em paralelo / 10 em série
- Max **20 módulos por output** do control panel (e não 99 — confunde com endereçamento!)
- LCD: 4 barras battery + 5 barras RSSI (≠ guide UltraFire que diz 5/6)
- LEMO 5-pin DMX (pinos 4–5 reservados firmware)
- TNC antenna conector (wireless)
- Min wire gauge 18 AWG / 1 mm²
**Fix**: incluir em `fireOneControlPanels.ts`/novo `fireOneFieldModule.ts` da rodada anterior (já planejada).

### Gap D — `Design_de_Shows_RA.pdf` (deep-research) reforça itens já no roadmap
O doc valida arquitetura existente (InstancedMesh, GPGPU, depthWrite=false, ray marching, VDL Euclidean) — **nada novo a implementar**, mas serve de citação/rastreabilidade. Vira `docs/reference/design-ra-deep-research-2026-05.md` (extrato).

---

## §1 — Importar de verdade as 5 livrarias Finale

### Pipeline real (substitui a entrada-fantasma na memória)
```
public/finale-libraries/
├── showven.xlsx          (Showven_✔️Finale_Verified-2.xlsx)
├── lidu.xlsx             (Lidu_USA-2.xlsx)
├── magic.xlsx            (Magic_Fireworks-2.xlsx)
├── winda.xlsx            (Winda_Fireworks-2.xlsx)
└── amazon.xlsx           (Amazon_Fireworks_V2.1-2.xlsx)
```

```
src/data/effectsLibraries/
├── types.ts                      # FinalePart 35-col canonical
├── parseFinalePartsXlsx.ts       # SheetJS + auto-detect Winda↔canonical
├── windaColumnMap.ts             # WINDA_DISPLAY_TO_CANONICAL
├── finalePartToEffect.ts         # adapter → Effect (usa quantizeRgbToVdl)
├── registry.ts                   # buildImportedEffects() lazy memo
├── search.ts                     # filtro por manufacturer/family/caliber
└── index.ts                      # re-export
```

- Adapter usa `vdlColorPipeline.quantizeRgbToVdl` → `renderHex` (LED-accurate, já existe).
- Lazy-load: arquivos só baixam quando `EffectLibrarySidebar` abre aba "Full Library".
- Bundle size projetado ~520KB JSON cru → gzip ~95KB lazy chunk.
- Merge no `EFFECT_LIBRARY` via `resolveEffect.ts` existente (já bridgeado).

### Inspector
Reutiliza rota `/dev/effects-libraries` (memory-listada) com drag-source para Timeline.

### Tests (~6)
- Parse Winda real (alias columns) → 85 parts
- Parse Showven canonical → 181 parts
- Parse Magic / Lidu / Amazon (40/112/109)
- adapter `finalePartToEffect` preserva caliber/duration/color
- LRU cache `buildImportedEffects()` não duplica entries entre chamadas

---

## §2 — Realismo: render baseado nos vetores FWsim

### 2.1 MineEffect — cone leque com **vector silhouette mask**
Cada SVG (`Mine_01/02/03.svg`) define **N pétalas radiais**. Extrair em build-time:
- `scripts/extractMineSilhouette.ts` parseia path d=, amostra N=64 pontos por pétala, gera `mineSilhouettes.json` com {peta lAngles[], coreCrown}.
- Em runtime, `MineEffect` usa esse perfil pra **distribuir partículas em ângulos fan-shaped** em vez de Gaussiana radial: `theta_i = silhouette.petals[i % petals.length] + jitter(σ=2°)`.
- Adiciona **coroa frontal** (cluster denso na base, lifetime 80ms) que o SVG mostra.

### 2.2 Particle chemistry hookup já presente
`particleChemistry.ts` (thermalColor + autoMatchFormulation) já existe mas Mine não chama. Patch:
- `MineEffect` lê `effect.formulationId` → `thermalColor(T_init=2800K, decay=Newton 0.65/s)` → cor por partícula.

### 2.3 Realismo cross-cutting (todos os efeitos)
- **Soft particle blend** (depth-aware fade quando partícula encosta em geometry) — flag `r_soft_particles` (default ON) — adiciona uma sub no fragment shader existente lendo `tDepth`.
- **HDR ember tail decay** com `pow(life, 2.4)` em vez de linear (curva mais natural).
- **Volumetric god ray** já implementado (mem GodRays); patch `MineEffect` pra pulsar god ray local 80ms no centro de massa do leque.
- **Sub-frame jitter** anti-aliasing temporal: `attribute float aJitterPhase` → vertex shader desloca size em ±3% senoidal (60Hz) → quebra padrão visível em 4K.
- **Smoke trail** já honest (mem R3 Pass 2); Mine ganha trilha curta (200ms) por pétala em vez do único trail central.
- **Spectral bloom**: bloom pass usa luminance-aware threshold (0.85 → 1.2) + chromatic offset 0.4px nos canais R/B (halation).

### 2.4 Comet/Shell/Cake — atualizações alinhadas
Mesmos hooks:
- Comet usa `Comet_01/02/03.svg` → curva trail bezier extraída
- Shell usa `Shell_01/02/03` pra pattern de pétala (peony vs chrysanthemum vs dahlia)
- Cake usa `Cake_01/02/03` pra fan-out de barragem
- RomanCandle usa `RomanCandle_01/02/03` pra cadência stagger
- Rocket usa `Rocket_01/02/03` pra cone propulsão
- ShellOfShells usa cluster split

Todos via `silhouetteSampler.ts` reutilizável.

### 2.5 LightProbe ambient para fogos
Adiciona `THREE.LightProbe` atualizada por frame com SH coeffs derivados das partículas ativas (top-N por luminância). Faz o palco/terreno **receber luz** dos fogos sem perf hit (1 light, não N).

---

## §3 — Atualizar listas de efeitos

### 3.1 EffectLibrary merge sources (atual → novo)
| Fonte | Status atual | Pós-Rodada |
|---|---|---|
| `EFFECT_LIBRARY` (legacy) | 96 entries | mantido |
| `FWSIM_BUILTIN_EFFECTS` | 45 entries | mantido |
| `parametricEffects` | 12 entries | mantido |
| **`buildImportedEffects()` (Finale 5 libs)** | **0 (mente)** | **+527 entries reais** |
| Total | ~153 | **~680** |

### 3.2 EffectLibrarySidebar
- Nova aba "Full Library (527)" agrupada por manufacturer com counter
- Search global (nome + tags + family)
- Drag-source pra Timeline já funciona via `resolveEffect`

### 3.3 finalePresetEnrichment hook
`enrichEffectFromFwe` ganha fallback: se id não bate FWE, tenta `buildImportedEffects().find(id)` → unifica enrich path.

---

## Arquivos novos (~18)
```
src/data/effectsLibraries/{types,parseFinalePartsXlsx,windaColumnMap,finalePartToEffect,registry,search,index}.ts
src/data/effectsLibraries/__tests__/{parse,adapter,registry}.spec.ts
public/finale-libraries/{showven,lidu,magic,winda,amazon}.xlsx
src/render/silhouettes/{silhouetteSampler,mineSilhouettes.json,extractMineSilhouette}.ts
scripts/extractEffectSilhouettes.ts
src/lib/render/lightProbeFromBursts.ts
src/__tests__/{mineSilhouette,silhouetteSampler}.spec.ts
docs/reference/design-ra-deep-research-2026-05.md
docs/reference/fireone-field-module-1-2.md
```

## Arquivos editados (~10)
- `src/components/editor/effects/MineEffect.tsx` (silhouette + chemistry hookup)
- `src/components/editor/effects/{CometEffect,CakeEffect,RocketEffect,RomanCandleEffect}.tsx` (silhouette mode opt-in)
- `src/components/editor/skycanvas/FireworkRenderer.tsx` (soft particles, HDR ember, god-ray pulse, jitter)
- `src/components/editor/EffectLibrarySidebar.tsx` (Full Library tab, 527 counter)
- `src/data/finalePresetEnrichment.ts` (fallback resolver)
- `src/data/effectLibrary.ts` (merge canal `IMPORTED_FINALE_PARTS`)
- `src/lib/featureFlags.ts` (`r_soft_particles`, `r_silhouette_mines`, `r_silhouette_all`, `r_hdr_ember_tail`, `r_lightprobe_from_bursts` — todas default ON exceto silhouette_all)
- `mem://index.md` + nova entry `mem://funcionalidades/finale-libraries-real-import-rodada-N` (corrige a entry-fantasma)
- `mem://funcionalidades/render-realism-silhouette-driven` (novo)

## Fora de escopo
- `uiCommandGateway`, `safetyStateMachine`, `commandBus`, `workMode`, RLS — zero alteração
- WebGPU rewrite — fica nos hooks GLSL/Three.js existentes (R3F)
- AR HUD do PDF de RA — só rastreabilidade documental por enquanto
- FireOne XL4/XL2 catalog — fica na rodada anterior (já planejada e aprovada)

## Risco / mitigação
- **Bundle bloat**: 527 parts lazy-loaded (não custa nada no boot do editor)
- **Render perf**: silhouette mode é opt-in flag por efeito; defaults preservam FPS atual
- **Memória mente**: explicitamente reescrita pra refletir o que existe de fato pós-implementação
- **PDFs grandes**: só extrato em docs/, não embedados

Pronto pra implementar.