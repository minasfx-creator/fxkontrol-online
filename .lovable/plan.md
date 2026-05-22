
## Escopo (3 frentes em uma rodada)

1. **Joi com liberdade total no editor** + remoção de UI/UX de "desenvolvimento" do produto
2. **Joi: revisão de gaps na skill de criação de coreografias** (executor + presets + prompt)
3. **Fix render: mine sempre vertical (90°)** — hoje sai sempre angulado por causa do `launchPitch = 85` default

> Safety físico (uiCommandGateway / SafetyStateMachine / FieldBus / GlobalEStopButton) **NÃO é tocado**. Editor opera em design/simulation onde por contrato canônico não há bloqueios.

---

## 1. Joi livre + stripping de UX dev

### 1.1 Modos da Joi reduzidos a 3
**`src/core/joi/joiModes.ts`** — deixar apenas:
- **`show`** — Show Design (criação livre, executa imediatamente sem confirmar)
- **`docs`** — Documentação técnica do show (relatórios, planta NFPA, KMZ aéreo, matrizes)
- **`executive`** — **NOVO** Secretaria Executiva: orçamentos, contratos, propostas, licitações, NOTAM/DECEA, licenças, prazos, acreditação, ofícios, declarações (absorve presets que já existem em `docs` mas são secretariais)

Remover modos `architect`, `analyst`, `verify`, `hardware_truth`, `planner`, `blueprint` e todos os seus presets.

### 1.2 Joi executa sem confirmação
**`src/utils/joiCommandExecutor.ts`**:
- `add_position`, `add_effect`, `update_position`, `update_effect`, `add_formation`, `add_cue_marker`, `set_wind`, `set_duration`, `set_project_name`, `play/pause/seek`, `clear_project`, `create_choreography`, `duplicate_position`, `learn_style/list_styles/apply_style` → **executa direto**, zero gate de readiness/operationalMode/simulationGuard
- Remover do executor as actions de inspeção (`inspect_showplan`, `inspect_hardware`, `inspect_exports`, `run_verification`, `check_readiness`, `get_system_state`, `get_audit_log`, `generate_mermaid`) — eram UX dev
- Toasts de erro viram apenas info silenciosa no feedback (nunca bloquear/abrir modal)

**`src/components/FXKAssistant.tsx`** — system prompt da Joi (em `joiContextBuilder`) reforça em todos os modos: **"execute imediatamente, sem pedir confirmação, sem perguntar — como comando de voz"**.

### 1.3 Painéis de inspeção da Joi (dev) — REMOVER + DELETAR
Imports e uso em `FXKAssistant.tsx` removidos, e arquivos deletados:
- `src/components/joi/JOIContextRibbon.tsx`
- `src/components/joi/JOIInsightPanel.tsx`
- `src/components/joi/JOITruthInspector.tsx`
- `src/components/joi/JOIExecutionTracePanel.tsx`
- `src/components/joi/JOIStylePanel.tsx`

**Manter**: `JOIArtifactCanvas.tsx` (preview de docs gerados) + `MermaidRenderer.tsx` (diagramas em docs).

### 1.4 Editor: chrome dev removido
- **`src/layouts/MainLayout.tsx`**: remover etiqueta "FX KONTROL" + dot pulse + `MinasFX` logo do header em `/editor` (chrome de desenvolvimento). Remover `RenderCounterOverlay` (dev-only).
- **`src/pages/Index.tsx`**: auditar e remover do editor as abas/painéis de hardware/diagnóstico que pertencem ao Kontrol operacional: `DiagnosticPanel`, `CurrentStateMatrix`, `CueValidationConsole`, `DetectedModulesPanel`, `ConsoleLogos`, `ArtNetDMXMonitor`, `ConnectionManagerPanel`, `ExecutiveReportConsole`, `AddressingPanel`, `FiringExportPanel`. Esses ficam no `/command` (CommandCenter).
- Editor passa a ter só: Viewport 3D, Timeline, Properties, EffectLibrary, Position tools, Audio, Cake/Chain/Formation builders, Export, **Joi como copiloto**.

### 1.5 Confirmação de delete físico (usuário aprovou)
**Arquivos deletados** (não só desplugados):
- 5 painéis Joi de dev acima
- `src/components/dev/RenderCounterOverlay.tsx`
- Tabs/imports correspondentes em `Index.tsx`

**Mantidos** (continuam vivos para `/command`):
- DiagnosticPanel, CurrentStateMatrix, CueValidationConsole, etc. — só saem das tabs do editor

---

## 2. Joi: gaps + melhorias na skill de coreografias

Revisar `create_choreography` + presets de `show` mode:

### Gaps identificados
1. **Sem timing musical** — Joi não usa BPM/audio markers ao criar coreografia. Adicionar param `bpm?: number` e `syncToBeat?: boolean` → quando ligado, alinha `startTime` de cada cue ao grid de batida (1/2, 1/4 beat).
2. **Sem progressão dramática estruturada** — hoje cria N cues aleatórios. Adicionar campo `dramaticArc: 'intro' | 'build' | 'climax' | 'finale'` por seção; gerador interno distribui densidade (intro 1 cue/3s, build 1/2s, climax 1/0.8s, finale 1/0.4s + multi-position).
3. **Sem coerência de paleta** — Joi escolhe cores random. Adicionar `palette?: string[]` (hexes) ou `paletteName?: 'reveillon'|'corporativo'|'casamento'|'patriotico'|'neon'` e restringir efeitos à paleta.
4. **Sem layout espacial inteligente** — `params.positions` é lista crua. Adicionar `layoutPreset?: 'line'|'arc'|'V'|'grid'|'circle'|'stage_front'|'symmetric'` que materializa N posições automaticamente com spacing.
5. **Sem mirror/symmetry** — adicionar `mirrorX?: boolean` que para cada cue criado, duplica em posição espelhada (essencial para shows simétricos).
6. **Sem groove de cake/candle** — cakes/candles têm duração própria mas Joi trata como evento pontual. `create_choreography` deve detectar `partType === 'cake'|'candle'` e reservar janela = `cakeDuration` em vez de empilhar próximo cue em cima.
7. **Sem dedup de match** — `resolveEffect` pode achar o MESMO efeito 50× quando Joi pede "Chrysanthemum"; adicionar rotação por `lastUsed` para variar (anti-monotonia).
8. **Sem feedback estruturado pós-execução** — retornar `summary` com counts por partType + duração total + densidade média (cue/s) para Joi narrar.

### Implementação
- Estender `joiCommandExecutor.executeCommand('create_choreography')` com os params novos (todos opcionais — backward compatible)
- Adicionar helper `src/utils/joiChoreographyHelpers.ts` puro com: `materializeLayout(preset, count, anchor)`, `pickPaletteColor(palette, idx)`, `mirrorPosition(p)`, `densityForArc(arc)`, `beatGrid(bpm, duration, division)`
- Atualizar presets em `joiModes.ts` para usar os novos params (preset "RÉVEILLON" passa a usar `layoutPreset:'arc'`, `dramaticArc` arrays, `paletteName:'reveillon'`, `mirrorX:true`, `bpm:120`)
- Adicionar spec `src/utils/__tests__/joiChoreography.spec.ts` cobrindo cada novo param

---

## 3. Fix: Mine renderiza sempre vertical (90°)

**Causa**: `src/components/editor/skycanvas/FireworkRenderer.tsx` linha 1567 default `launchPitch = 85` aplicado a todos os efeitos. Mines são dispositivos de chão de spray vertical — devem ser 90° sempre, independente de `position.pitch` ou `cuePitch`.

**Fix**:
- Em `FireworkRenderer.tsx`, quando `pt === 'mine'`, forçar `launchPitch = 90` antes de passar para `<MineEffect>` (override explícito ignora `linkedPos.pitch`)
- Garantir que `MineEffect` internamente também trata `launchPitch >= 89` como vertical puro (sem rotação adicional)
- Spec curto em `src/render/silhouettes/__tests__/mineSilhouettes.spec.ts` (ou novo) garantindo que `launchPitch=90` produz Y dominante nas velocidades

---

## 4. Arquivos tocados (resumo)

```
DELETE
  src/components/joi/JOIContextRibbon.tsx
  src/components/joi/JOIInsightPanel.tsx
  src/components/joi/JOITruthInspector.tsx
  src/components/joi/JOIExecutionTracePanel.tsx
  src/components/joi/JOIStylePanel.tsx
  src/components/dev/RenderCounterOverlay.tsx

EDIT
  src/core/joi/joiModes.ts                     (3 modos, presets atualizados)
  src/core/joi/JoiContextBuilder.ts            (system prompt "execute como voz")
  src/utils/joiCommandExecutor.ts              (zero gates, novos params choreography, remover inspect_*)
  src/components/FXKAssistant.tsx              (drop painéis dev, ribbon, etc.)
  src/components/JoiCommandPresets.tsx         (presets só show/docs/exec)
  src/components/JoiCommandFeedback.tsx        (erro = info silenciosa)
  src/layouts/MainLayout.tsx                   (header editor limpo, sem RenderCounter)
  src/pages/Index.tsx                          (remover tabs hardware/diagnóstico)
  src/components/editor/skycanvas/FireworkRenderer.tsx  (mine launchPitch=90)
  src/components/editor/effects/MineEffect.tsx (tratamento launchPitch≥89 vertical puro)

CREATE
  src/utils/joiChoreographyHelpers.ts          (layouts, paletas, mirror, beat grid)
  src/utils/__tests__/joiChoreography.spec.ts
```

## 5. Garantias

- Safety físico: zero mudança em `uiCommandGateway`, `SafetyStateMachine`, `commandBus`, `fieldBus`, `workMode`, `aiGuardrail` (Joi continua sem poder armar/disparar — só design)
- ShowPlan: schema intacto; apenas mais campos opcionais no payload de `create_choreography`
- Testes existentes: `effectLookupGuard`, `resolveEffect`, `mineSilhouettes`, simulationGuard suite (17) continuam verdes
- Sem mudanças em `/command`, `/field-test`, `/pairing/*` — só editor + Joi

Pronto para construir.
