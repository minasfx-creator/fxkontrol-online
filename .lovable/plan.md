# Rodada 13 — Cockpit Mission Control: SafetyBar + Readiness Unificada

## Estado real (auditado agora)

Três itens do "Próxima ação certa" do relatório **já estão implementados** no repo:

- **ProvenanceBadge** canônico — `src/components/safety/ProvenanceBadge.tsx` (Rodada 12) com 4 labels honestos (SIMULATED/REPLAY/LIVE READ-ONLY/NOT INTEGRATED) sobre tokens `ds-status-*`.
- **ShowPlan SSoT** — `ShowPlanManager.fromProjectStore()` é invocado por `useShowPlanSync()` automaticamente, montado em `src/orchestration/EngineProvider.tsx`. Toda mutação do `useProjectStore` propaga ao ShowPlan canônico.
- **BlackBox forensic** — `/dev/blackbox-inspector` com chain verify + 100 entries + record note (Rodada 12).

O que **falta** para virar cockpit C2 de verdade:

1. Estado de prontidão derivado, **único e consumível por toda UI**.
2. **GlobalSafetyBar** sempre visível no topo do `MainLayout` agregando E-STOP, work mode, readiness, safety state, provenance dominante.
3. **"Ready" hardcoded** removido de surfaces que mentem (Index/dashboard/headers que mostram OK sem checar `readinessEvaluator`).

## O que será construído

### A. `useSystemReadiness()` — hook canônico
`src/hooks/useSystemReadiness.ts`. Pure read agregando, em poll de 1s + subscribe quando disponível:
- `readinessEvaluator.evaluate()` → status + canExport + blockingReasons.
- `safetyStateMachine.state` → IDLE/LOCKED/ARMED/FIRING/FAULT/E_STOPPED.
- `useWorkMode()` → design / simulation / real_operation.
- `verificationEngine.lastResult()` → erros bloqueantes.
- `deviceAggregator.getDevices()` → contagem online + provenance dominante (live_read_only > replay > simulated > not_integrated).

Retorna `SystemReadiness` com 6 estados visuais oficiais (`EMPTY/INVALID/BLOCKED/READY/ARMED/FIRING/FAULT/E_STOPPED`) + `dominantProvenance` + `blockingReasons[]`. **Nunca chama** `uiCommandGateway`/`fieldBus`. Cleanup garantido (clearInterval no unmount).

### B. `<GlobalSafetyBar>` — topo soberano
`src/components/safety/GlobalSafetyBar.tsx`. Faixa fixa 36px topo (acima do conteúdo, abaixo do `GlobalEStopButton` z-[9999]) com chips:

```text
[ MODE: SIM ] [ STATE: ARMED ] [ READINESS: READY ] [ DEV: 3/4 LIVE-RO ] [ HASH: a91…f02 ]
```

- Cores: tokens `ds-status-*` (sync/ok/warn/fail). Tipografia `ds-mono`.
- Click no chip de readiness abre tooltip com `blockingReasons[]`.
- Click no hash copia para clipboard (`showPlanHash` já existe).
- Esconde-se em `/command` e nas rotas `pairing/*` (replicar regra do `GlobalEStopButton`).

Montado em `src/layouts/MainLayout.tsx` logo abaixo do header.

### C. Expurgo "Ready" hardcoded
`rg -n "SYS::ONLINE|status.*=.*['\"]ready['\"]|>READY<"` para localizar; substituir por leitura do `useSystemReadiness().status`. Alvos prováveis (a confirmar na implementação):
- `src/pages/Index.tsx` (topo do SkyCanvas)
- `src/components/office/DashboardPanel.tsx` (já parcialmente honesto na Rodada 10)
- Qualquer chip "READY" estático em headers de página.

### D. Testes
- `useSystemReadiness.spec.ts`: empty plan → `EMPTY`; plan + verification fail → `INVALID`; SSM=ARMED → `ARMED`; E-STOP → `E_STOPPED`; merge de provenances dominantes.
- `GlobalSafetyBar.render.spec.tsx`: renderiza chips conforme hook mockado, esconde em `/command`.

## Restrições inegociáveis

- **Zero** chamadas a `uiCommandGateway`, `safetyStateMachine.transition`, `fieldBus.send`, `executor.fire` a partir do hook ou da bar. **Read-only puro**.
- IA / agentes nunca disparam mudanças de workMode via essa bar.
- Não introduzir novo store; consumir os existentes (`readinessEvaluator`, `safetyStateMachine`, `useWorkMode`, `deviceAggregator`).
- Tokens canônicos `--field-*` / `--status-*` apenas. Sem cores hardcoded.
- Esconder em `/command` (cockpit já tem própria barra) e em wizards de pairing (foco modal).

## Arquivos

- `src/hooks/useSystemReadiness.ts` (novo)
- `src/components/safety/GlobalSafetyBar.tsx` (novo)
- `src/layouts/MainLayout.tsx` (mount)
- `src/__tests__/useSystemReadiness.spec.ts` (novo)
- `src/__tests__/globalSafetyBar.render.spec.tsx` (novo)
- Edits cirúrgicos onde "Ready" estiver hardcoded (lista final no commit)

## Critérios de aceite

- `useSystemReadiness()` retorna estado válido em todas as 8 condições mapeadas.
- GlobalSafetyBar visível em `/office`, `/editor`, `/dev/*`; oculta em `/command` e `/pairing/*`.
- `rg "SYS::ONLINE"` retorna vazio.
- Suite verde (esperado 1242+/1242+).
- Zero novos imports de `safetyStateMachine.transition` ou `fieldBus`.

## Fora do escopo (próximas rodadas)

- Refatorar VVIZ/CSV importers (já passam pelo ShowPlan via `useShowPlanSync`; auditoria fina é Rodada 14).
- Continuity Matrix 4×8 e FieldDiagnostics dedicados (Rodada 15).
- Tipos `SafetyInterlockState`/`IgnitionChannel`/`ContinuitySample`/`PowerState`/`ArtNetUniverseEntry` expandidos (Rodada 16 — mexe em adapters reais).
- ECS / WASM / Web Workers (Fase 4 do roadmap mestre, multi-rodada).
