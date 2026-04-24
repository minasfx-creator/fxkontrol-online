# Limpeza Técnica em Fases — Plano

Trabalho dividido em **6 patches incrementais independentes**. Cada um é mergeable sozinho, com build/typecheck verde. Execução sequencial, parando se algo regredir.

## Estado atual do diagnóstico
- Build/typecheck **verdes** ✅
- **75 arquivos órfãos** (sem importadores internos), totalizando ~6k linhas
- Módulo `src/modules/vviz` **pronto mas não conectado** + 4 bugs do review anterior pendentes
- **6 componentes ≥1000 linhas**, top: `SkyCanvas.tsx` (1999L), `LiveFiringPanel.tsx` (1716L), `PyroFireOnePanel.tsx` (1642L)
- `useSceneStore.ts` com 858 linhas
- 59 `console.log`, 95 arquivos com `: any`, 3 TODO/FIXME

---

## ⚙️ Patch 0 — Hotfix do módulo `src/modules/vviz` (BLOCKER do review anterior)

Antes de qualquer outra limpeza. O módulo está pronto para ser plugado mas tem 2 bugs de **corrupção silenciosa** que destruiriam payloads reais.

**Arquivos:**
- `src/modules/vviz/reduceVvizPayload.ts`
  - **#2** Tornar `isVec3Like` estrito: exigir `Object.keys(v).length === 3` → impede que keyframes `{x,y,z,t}` sejam tratados como point cloud e percam o `t`.
  - **#3** Aplicar downsample-por-length **somente** em arrays de objetos (não primitivos) e via allowlist de chaves pais (`cues`, `events`, `keyframes`) → impede corrupção de `vertices/indices/colors` de meshes embutidas.
  - **#6** `isHeavyKey`: matching exato/sufixo (`endsWith('preview')`, `=== 'thumbnail'`, `includes('base64')`) em vez de substring solta → preserva flags `previewMode`/`livePreviewEnabled`.
- `src/modules/vviz/normalizeVvizProject.ts`
  - **#4** Ceder ao frame **somente** quando o batch demorou >5ms (medido via `performance.now()`); senão continuar síncrono. Reduz import de 50k cues de ~1.6s para <200ms.
  - **#5** `Math.min(total, 50_000)` defensivo no `new Array(...)`.
- `src/modules/vviz/index.ts`
  - **#7** Trocar `export *` por exports nomeados explícitos.

**Sem mudanças funcionais externas.** Build/typecheck deve continuar verde.

---

## 🧹 Patch 1 — Remoção segura de órfãos UI shadcn (baixo risco)

Componentes shadcn nunca importados. Confirmados via scan estático (imports + dynamic + `new URL`).

**Remover** (~19 arquivos, ~1.5k linhas):
- `src/components/ui/aspect-ratio.tsx`, `avatar.tsx`, `breadcrumb.tsx`, `carousel.tsx`, `chart.tsx`, `command.tsx`, `context-menu.tsx`, `drawer.tsx`, `form.tsx`, `hover-card.tsx`, `input-otp.tsx`, `menubar.tsx`, `navigation-menu.tsx`, `pagination.tsx`, `popover.tsx`, `radio-group.tsx`, `resizable.tsx`
- `src/components/ui/use-toast.ts` (4L re-export quebrado), `src/components/ui/FUISkeleton.tsx`

**Para cada arquivo:** segundo grep pelo nome do componente exportado antes de deletar (não só pelo path).

**Aceite:** build/typecheck verde, app idêntico.

---

## 🧹 Patch 2 — Remoção/arquivamento de legado em `src/lib` (médio risco)

Órfãos grandes. Para cada um, segundo grep de confirmação + decisão:

| Arquivo | Linhas | Ação proposta |
|---|---|---|
| `src/lib/ultraFirePreloadEngine.ts` | 786 | **Arquivar** em `src/_legacy/` se houver dúvida; remover se nenhuma menção fora dele |
| `src/lib/i18n.ts` | 480 | Remover (sem chamadas) |
| `src/lib/showOrchestrator.ts` | 476 | **Arquivar** (nome sugere papel central — alto risco de remoção cega) |
| `src/lib/effectTypeSystem.ts` | 360 | Remover se nenhum import |
| `src/lib/gpuParticlePhysics.ts` | 331 | Remover se substituído por `render_ultra/` |
| `src/lib/nrtAnalyzers.ts` | 259 | Remover |
| `src/lib/timelineECS.ts` | 237 | **Cuidado** — checar memory `area-4-timeline-ecs-dod` |
| `src/lib/smoothFramePacer.ts` | 179 | Remover |
| `src/lib/skybrushEnvironmentBridge.ts` | 151 | Remover |
| `src/lib/swarmgpt/gltfToMeshLike.ts` | 144 | Conferir uso externo do módulo SwarmGPT |
| `src/lib/soundDelay.ts` | 51 | Remover |
| `src/hooks/useStockValidation.ts` | 56 | Remover |
| `src/hooks/useTransportReadiness.ts` | 57 | Remover |
| `src/core/cluster/reporters/{Network,Performance,Safety}HealthReporter.ts` | ~155 | Remover ou ligar ao orchestrator (decidir caso a caso) |

**Regra:** antes de cada remoção, `grep` por nome do símbolo exportado. Match em qualquer lugar = manter.

**Aceite:** build verde após cada batch de 3-4 remoções.

---

## 🧹 Patch 3 — Limpeza de `console.log` em produção (baixo risco)

**59 ocorrências.** Estratégia:
- Manter `console.warn` e `console.error` (úteis para debugging em campo).
- Substituir `console.log` por:
  - Remover se for debug residual.
  - Trocar por `if (import.meta.env.DEV) console.log(...)` se útil para desenvolvimento.

Não remover automaticamente em massa — passar arquivo por arquivo.

**Aceite:** zero `console.log` puro fora de `*.dev.*`/`*.spec.*`.

---

## 🔌 Patch 4 — Conectar `src/modules/vviz` no caller real (atrás de feature flag)

Por último: é a mudança mais sensível (toca o fluxo de import real). Fazer depois das limpezas reduz superfície de regressão.

**Arquivos:**
- `src/lib/featureFlags.ts` → adicionar `vviz_phased_import: false` (default off, opt-in seguro).
- `src/components/editor/VVIZImporter.tsx`
  - Quando flag ON: usar `importVvizFile()` do novo módulo + progress callback no UI existente; quando OFF: manter `vvizWorker.ts` atual.
  - Sem mudança visual; apenas wire alternativo.
- Manter `src/lib/vvizWorker.ts` intacto (rollback instantâneo).

**Aceite:** flag OFF = comportamento idêntico de hoje; flag ON em arquivos pequenos = importa; em arquivos grandes = não congela UI.

---

## 📋 Patch 5 — Mapa de refactor para gigantes (apenas relatório/TODO)

**Não refatorar nesta sessão** — apenas mapear. Componentes ≥1000 linhas:

| Componente | Linhas | Direção sugerida |
|---|---|---|
| `SkyCanvas.tsx` | 1999 | Extrair sistemas (sky/ground/lighting) para `src/modules/scene/sky/*` — alto risco, requer patch dedicado |
| `LiveFiringPanel.tsx` | 1716 | Quebrar em sub-componentes por modo de operação |
| `PyroFireOnePanel.tsx` | 1642 | Extrair lógica de cue selection/sequencing para hook |
| `FireworkRenderer.tsx` | 1470 | Renderer puro — talvez OK manter |
| `ScriptWindow.tsx` | 1408 | Extrair editor + parser |
| `FXKAssistant.tsx` | 1339 | Extrair conversation/intent handlers |
| `Timeline.tsx` | 1309 | Memo de regiões + extrair drag handlers |
| `useSceneStore.ts` | 858 | Dividir em slices por domínio (já existe `slices/`) |

---

## 📊 Relatórios Entregues no Final

1. **Bugs corrigidos** — VVIZ #2/#3/#4/#6 + qualquer regressão pega no caminho.
2. **Arquivos removidos** — lista com linhas economizadas.
3. **Arquivos arquivados** — lista com motivo (ambiguidade).
4. **Performance** — antes/depois de #4 (yield só em batch lento).
5. **Riscos restantes** — componentes ≥1000L, stores ≥800L, 95 arquivos com `any`, specs órfãos sem runner.

---

## ❌ Fora deste plano (intencional)

- Refatorar componentes gigantes (Patch 5 só mapeia).
- Mexer em hardware/safety (`fireoneModuleHardwareBridge.ts`, `pyroExecutor`, etc.).
- Tocar em `swarmgpt/` (já isolado e build-safe).
- Trocar Three.js/WebGL/render_ultra.
- Mexer em integrations Supabase ou edge functions.
- Mudar UX/visual.

---

**Ordem de execução:** 0 → 1 → 2 → 3 → 4 → 5 (relatório).