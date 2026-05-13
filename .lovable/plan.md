## Objetivo

Plugar os 4 ativos enviados no editor existente sem criar rota nova:
1. **`presets.zip`** (44 .fwe FWsim com PNG) → catálogo built-in de presets de fogos arrastáveis na timeline.
2. **`vector.zip`** (12 SVGs por categoria + ícones de cue + UI) → ícones nativos no `EffectLibrarySidebar` e na lista de cues.
3. **`2021-04_Old_Effects_Index.txt`** (229 nomes "Old Effects") → catálogo de busca textual (sem dados de partícula, marca como `claim: marketing_hypothesis`).
4. **`shaders.zip`** (HLSL FWsim) → tradução **dirigida** de 4 técnicas-chave para o `FireworkRenderer`/`SkyCanvas3D` em GLSL (tonemapping, bloom, particle motion, smoke).
5. **`manual-2.pdf`** (FWsim v3 Handbook) → 8 melhorias concretas mapeadas no editor existente.

Tudo em modo **simulação/design**. Zero impacto em `uiCommandGateway`, `safetyStateMachine`, `commandBus`, `workMode`, RLS ou backend.

## Entrega 1 — Catálogo built-in de 44 presets FWsim

- Rodar `scripts/parse-fwe-presets.py` (já existente) sobre os 44 `.fwe` em build-time → `src/data/fwsimBuiltinPresets.json` versionado no repo (~600KB JSON estimado).
- Copiar os 44 thumbs `01.png..44.png` para `src/assets/fwsim-presets/preset-XX.jpg` (recompactar p/ JPG ~30KB cada).
- Estender `useImportedFweStore` com slice `builtinPresets[]` read-only (não persiste no Supabase, vem do bundle). API: `getBuiltinPresets()`, `mergeWithImported()`.
- `EffectLibrarySidebar` ganha aba **"FWsim Built-in"** (44 cards com preview PNG + nome + tipo). Drag-drop usa o mesmo `buildImportedEffects()` (mem `Finale Libraries Import Canonical`). Cada preset `claim: 'pilot'` (já temos cores/contagem reais do .fwe).
- `EffectPreview3D` (já existente) renderiza pattern correto via `finalePresetEnrichment.ts`.

## Entrega 2 — Ícones SVG por categoria

- Copiar 12 SVGs de `vector/effects/` (`Cake_01..03`, `Comet_01..03`, `Mine_01..03`, `Other_01..03`, `Rocket_01..03`, `RomanCandle_01..03`, `FeuerProjektor_01..03`) → `src/assets/effect-icons/`.
- Novo `src/components/icons/EffectCategoryIcon.tsx` resolve `category → SVG` (3 níveis de detalhe: small/medium/large baseado em `_01/_02/_03`).
- Adotar em:
  - `EffectLibrarySidebar` cards (substitui emojis 🔦💡💫 do `UE5DMXPrevisImporter`).
  - `Timeline` cue blocks (atualmente usa `Zap` lucide genérico).
  - `EffectPreview3D` overlay quando 3D ainda não pintou.
- Ícones de cue (`vector/cue-*.svg`) → `src/components/icons/CueTypeIcon.tsx` para Camera/DMX/Scene/Single/Stepper.
- **Não** mexer em `FxkLogo` ou paleta operacional.

## Entrega 3 — Old Effects Index searchable

- `scripts/parse-old-effects-index.ts` lê o `.txt`, parse `LT|<name>` → `{ id, name, category (inferida do nome), tags[] }`.
- Output: `src/data/fwsimOldEffectsIndex.json` (229 entries, ~25KB).
- `EffectLibrarySidebar` ganha tab **"Old Effects (legacy)"** **read-only**: lista pesquisável (Cmd+K compatible), badge `claim: marketing_hypothesis` ds-status-warn, tooltip "Apenas nome — sem dados de partícula. Crie um preset .fwe ou use Finale Library para versão executável".
- Drag-drop **desabilitado** (cursor not-allowed + tooltip explicativo) — é catálogo de inspiração, não executável.

## Entrega 4 — 4 técnicas dos shaders FWsim portadas pra GLSL

Os HLSL não rodam direto no Three.js. Vou portar **só** as funções-chave que melhoram o que já temos:

| FWsim HLSL | Porta para | O quê |
|---|---|---|
| `tonemapping.hlsl` (9.7KB) | `src/components/editor/skycanvas/postFx/tonemapACES.glsl` | ACES Hue-Preserving (já temos doc, falta shader); aplica em `SkyCanvas3D` post-process |
| `new_bloom.hlsl` + `bloom_include.hlsl` | `src/components/editor/skycanvas/postFx/bloomFwsim.glsl` | 5-tap dual-Kawase mais barato que UnrealBloomPass do drei (ganho ~2ms/frame em mobile) |
| `particle_movement.inc.hlsl` (736B) | `src/components/editor/skycanvas/FireworkRenderer.tsx` | Drag exponencial framerate-independent + wind log law (já consolidado em mem `Studio Layer 3`, faltava no FireworkRenderer) |
| `smoke.ps.hlsl` (416B) | `src/components/editor/skycanvas/SkyEnvironment.tsx` smoke shader | Beer-Lambert simples para puff de smoke pós-explosão |

- Flag de feature `fwsim_shader_pack` (default OFF, ON-ramp em /dev).
- 1 spec em `src/__tests__/fwsimShaderPack.spec.ts` valida que toggling o flag não quebra o render (smoke test).

## Entrega 5 — 8 melhorias do manual FWsim v3

Mapeadas para o editor existente, ordem de impacto:

1. **Snap Cues to other Cues** (§10.2.4) — opção em `EditorPreferences` (já existe?), magnet com tolerance 50ms ao soltar cue na timeline.
2. **Smart Clone** (§3.4.4) — Ctrl+drag clona cue mantendo offset rítmico do anterior (FWsim usa para multi-break).
3. **Stepper** (§3.4.2) — modo de inserção rápida que avança automaticamente o cursor por intervalo configurável (já temos timelineClock; falta UI).
4. **Multi Selection Rectangle** (§3.4.3) — drag-rectangle na timeline já existe? validar; se não, adicionar.
5. **Custom Components / Color Variations** (§5.4.1-2) — botão "Generate variations" no card de preset gera N variações com hue rotacionado (FWsim Pro feature, popular).
6. **Cost / NEC display** (§5.8-9) — campos opcionais `priceCents` e `necGrams` em `Effect`; somatório aparece no rodapé do timeline (já temos `BoM` export).
7. **Auto-assign channels before export** (§10.2.7) — preferência em `ExportCoordinator` (já default?). Validar e expor toggle.
8. **Snap Cues + Vertical zoom show editor** (§10.1.3) — atalho Ctrl+Wheel já mapeado? validar e documentar.

Cada melhoria como toggle independente em `EditorPreferences` (Tools→Preferences pattern do FWsim). **Stepper, Smart Clone e Snap Cues** são os 3 com maior impacto operacional — implementar primeiro; restante fica como toggles documentados.

## Detalhes técnicos

- **Provenance trail**: presets built-in `claim: 'pilot'`, Old Effects `claim: 'marketing_hypothesis'`, ícones e shaders sem claim (puramente visual).
- **Backend**: zero migração. `imported_fwe_effects` continua para uploads do usuário; built-in vive no bundle.
- **Bundle size**: +~700KB total (44 thumbs + 44 .fwe parsed JSON + 60 SVG + 4 GLSL). Lazy-load tab "FWsim Built-in" via `React.lazy`.
- **Memória nova**: 1 entry `funcionalidades/fwsim-asset-pack-integration` no `mem://index.md`.
- **Testes (5)**: `fwsimBuiltinPresets.spec.ts` (44 carregam), `fwsimOldEffectsIndex.spec.ts` (229 parse), `effectCategoryIcon.spec.tsx`, `fwsimShaderPack.spec.ts` (toggle), `editorSnapCues.spec.ts` (50ms tolerance).

## Arquivos criados/editados

```text
NEW  scripts/parse-old-effects-index.ts
NEW  src/data/fwsimBuiltinPresets.json                 (gerado em build)
NEW  src/data/fwsimOldEffectsIndex.json
NEW  src/assets/fwsim-presets/preset-01..44.jpg
NEW  src/assets/effect-icons/{Cake,Comet,Mine,Other,Rocket,RomanCandle,FeuerProjektor}_{01..03}.svg
NEW  src/assets/cue-icons/cue-{camera,dmx,scene,single,stepper,chains}.svg
NEW  src/components/icons/EffectCategoryIcon.tsx
NEW  src/components/icons/CueTypeIcon.tsx
NEW  src/components/editor/skycanvas/postFx/{tonemapACES,bloomFwsim}.glsl
NEW  5 specs em src/__tests__/
EDIT src/store/useImportedFweStore.ts                  (+builtinPresets slice)
EDIT src/components/editor/EffectLibrary.tsx           (+2 abas: Built-in, Old Effects)
EDIT src/components/editor/skycanvas/FireworkRenderer.tsx  (drag exp + wind)
EDIT src/components/editor/skycanvas/SkyEnvironment.tsx    (smoke Beer-Lambert)
EDIT src/components/editor/EditorPreferences.tsx       (5 toggles)
EDIT src/components/editor/Timeline*.tsx               (Stepper, Smart Clone, Snap)
EDIT mem://index.md                                    (+1 entry)
```

## Fora do escopo

- Importar HLSL bruto e rodar via DirectX (impossível no browser).
- Executar `.fwe` via FWsim binary.
- Mudanças em safety, workMode, command path ou backend RLS.
- Replicar 100% das features do FWsim Handbook — só as 8 com maior impacto operacional.
- Drone+Drotek workflow completo (§9) — fora deste lote, já temos Skybrush export.
