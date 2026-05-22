## Rodada Longa — 4 frentes em sequência

Execução estritamente nesta ordem; cada etapa só inicia após a anterior verde (build + suite passando) e sem regressões nos consoles de runtime.

---

### Etapa 1 — Performance `/editor` 3D

**Sintoma medido agora**: LCP 19.18s [poor], FPS 15–22 sustentado, AdaptiveLOD HIGH→MEDIUM→LOW em <5s no boot, Watchdog `none → severe`. Regressão alinha com a rodada de imported-effects fallback (MineEffect 360° + resolveEffect unificado servindo Amazon/Winda/Magic/Lidu/FWsim).

**Diagnóstico**:
1. `browser--performance_profile` + `start_profiling` → carregar `/editor` com seed Libertadores e capturar 10s de RAF.
2. Cruzar `[AdaptiveLOD]` drops com `[Metrics] Draw/Tris` para isolar overdraw vs JS.
3. Inspecionar candidatos suspeitos:
   - `src/render/MineEffect` — nova distribuição 360° pode ter multiplicado spawn por N jets sem cap.
   - `src/data/effectsLibraries/resolveEffect.ts` — `findEffectById` chamado por cue? Verificar memoização.
   - `Show3DEngine.renderFrame` — caminho de `spawn-pyro/finale-burst` (Points 48–154 vértices por cue) sob auto-fire.
   - `InstancedParticleRenderer` / `ParticleGPGPU` — verificar se RTs estão sendo recriados.

**Correções (escopo conservador — sem alterar safety/ShowPlan)**:
- Cap de partículas por cue ativo via `MAX_LIVE_PARTICLES` no ECS kernel (já existe `frameBudget`); se p95 frame ≥40ms, AdaptiveLOD reduz cap antes de baixar tier.
- Memo de `resolveEffectLedAccurate` por `effectId` (LRU 256, similar ao VDL pipeline).
- MineEffect: ramp inicial dos 360° (5/7/9 jets só na primeira metade da vida, depois decai) — preserva silhueta canônica FWsim.
- Defer `EngineProvider` boot (DeterministicClock/LockstepEngine/HealthPersistence) para `requestIdleCallback` no boot do `/editor` — hoje rodam no mount inicial e contribuem para LCP 19s.

**Critério de saída**: FPS p95 ≥ 45 em `/editor` com Libertadores seed (4×FXK16, 90s) em LOD HIGH; LCP < 6s; AdaptiveLOD não desce para LOW no boot.

---

### Etapa 2 — DELETE de 10 rotas (Rodada 2)

Memória `Roadmap Master v1` lista candidatas: `AIChoreography`, `AccreditationDashboard`, `SwarmGPT`, `Admin`, `Agenda`, `Training`, `Dashboard`, `DevicePairing`, `FieldTest`, `FXK16Validate/Calibrate`.

**Cruzamento com `App.tsx` atual** (12 rotas ativas):
- Ativas hoje na lista de DELETE: `/` → `Dashboard`, `/agenda`, `/training`, `/pairing` → `DevicePairing`, `/field-test`.
- Não-roteadas (já órfãs no `src/pages/`): `AccreditationDashboard.tsx`, `Admin.tsx`. `AIChoreography`/`SwarmGPT`/`FXK16Validate`/`Calibrate` precisam de `find` para confirmar localização.

**Plano**:
1. Redefinir entrada `/`:
   - Opção A — **redirecionar `/` → `/editor`** (canônico, single-source ShowPlan). _Sugerido._
   - Opção B — landing operacional minimalista (apenas brand + 3 CTAs: Editor, Command, Pairing).
2. Remover do `App.tsx`: `/`, `/agenda`, `/training`, `/pairing`, `/field-test`.
3. Manter `/pairing/usb`, `/pairing/ble`, `/pairing/two-wire` (wizards canônicos, ver memórias).
4. Deletar arquivos `src/pages/{Dashboard,Agenda,Training,DevicePairing,FieldTest,AccreditationDashboard,Admin}.tsx` + `AIChoreography`/`SwarmGPT`/`FXK16Validate`/`Calibrate` se existirem.
5. Limpar imports órfãos em `App.tsx`, `AppSidebar.tsx`, `MainLayout.tsx`, sitemap, e qualquer link interno.
6. Atualizar `commercialThemeScope.guard.spec.ts` se referenciar rotas removidas.

**Critério de saída**: build verde, `App.tsx` enxuto (≤ 8 rotas protegidas), nenhum link quebrado no AppSidebar; smoke navega `/editor`, `/command`, `/show-test`, `/pcb-viewer`, `/settings`, `/festival-stage-demo`, `/pairing/{usb,ble,two-wire}`.

---

### Etapa 3 — Fix 3 specs preexistentes `fireOneModulesInline`

**Sintoma**: 3 falhas em `src/__tests__/fireOneModulesInline.spec.tsx` (DOM snapshot/assertion desatualizada vs componente atual). Não tocadas em rodadas recentes.

**Plano**:
1. Rodar isolado: `bunx vitest run src/__tests__/fireOneModulesInline.spec.tsx --reporter=verbose` para capturar assertions exatas.
2. Comparar com `FireOneModulesInline.tsx` atual e ajustar:
   - Se mudança foi semântica (texto/label) → atualizar spec.
   - Se componente regrediu funcionalidade → restaurar comportamento.
3. Garantir uso de tokens DS atuais nos seletores (evitar selectors frágeis tipo `.bg-orange-500`).

**Critério de saída**: 1003/1003 tests verde (após também rodar suite completa para confirmar zero regressão da Etapa 1+2).

---

### Etapa 4 — Code-split `three-core` + `vendor-export`

**Sintoma**: 3 chunks > 600KB no build (warning Vite): `three-core`, `vendor-export`, `resolveEffect`.

**Plano**:
1. Auditar `vite.config.ts` `manualChunks` atual.
2. `three-core`: separar em `three-core` (Three.js base) + `three-addons` (loaders/postprocessing) + `three-r3f` (`@react-three/fiber`+`drei`). Lazy-load `/festival-stage-demo` e `/pcb-viewer` se ainda mantidos.
3. `vendor-export`: separar `pdf-lib` (Strategy reports + Golden Show PDF), `xlsx` (Finale libs) e `jszip` (Skybrush + Golden ZIP) em chunks dedicados — todos já são lazy via `import()` em handlers, mas precisam de `manualChunks` para não colapsar.
4. `resolveEffect`: avaliar splitting do `generated/finaleLibrariesParts.json` (~280KB) + `standardEffects.json` (~221KB) com `import()` por demanda na primeira chamada (memo já existe).
5. Reduzir budget warning para 500KB no `bundle-budget` plugin.

**Critério de saída**: nenhum chunk > 500KB; LCP boot < 4s em cold load; build verde.

---

### Trilho de qualidade ao final de cada etapa

- `bun run build` verde.
- `bunx vitest run --reporter=dot` sem novas falhas (baseline 1003/1003 após Etapa 3).
- Console runtime sem novos warnings/errors em `/editor`.
- Guards canônicos preservados (typography DS, commercial theme scope, mocks erradicated, safety gate).
- Zero mudança em: `uiCommandGateway`, `GlobalEStopButton`, `SafetyStateMachine`, `commandBus`, `fieldBus`, `workMode`, ShowPlan schema, BlackBox chain.

### Out of scope

- Hardware bench (Fase 3 do Roadmap Master).
- Migração física F5.B de `components/editor/` → `features/`.
- Mudanças visuais no design system (Vantablack + cyan-dessat preservados).
- Qualquer mexida em rotas `/pairing/*` (canônicas).
