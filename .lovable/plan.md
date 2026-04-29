## Phase 4 — Cleanup (Concluída)

Remoções confirmadas (zero importadores externos verificados via rg + busca global):

### Pastas dead-barrel
- `src/_legacy/` (timelineECS.ts, ultraFirePreloadEngine.ts) — só auto-referenciava-se internamente.
- `src/store/domains/` (hardware/simulation/workspace/ai/index) — barrel de redireção sem consumidores; `src/stores/` é a superfície oficial.
- `src/hardware/index.ts` — barrel órfão; consumidores importam direto dos sub-paths.

### Arquivos órfãos (UI + libs isoladas)
- `src/components/common/VirtualizedList.tsx`
- `src/components/editor/SplashScreen.tsx`
- `src/components/settings/HardwareSimulatorSettings.tsx`
- `src/components/swarmgpt/GpuSamplingDiagnosticsPanel.tsx`
- `src/components/editor/skycanvas/{cameraControllers,droneRendererSwitch,sceneLighting,viewportToolbars,watchdogs}.tsx`
- `src/lib/transportReadiness.ts`
- `src/lib/aiShowBuilder/remoteShowPlanProvider.ts`
- `src/hooks/useBoidsWorker.ts` (nota: `BoidsWorkerClient` é usado direto)
- `src/hooks/useCommandJournal.ts`
- `src/hooks/useExecutiveReport.ts`
- `src/workers/dmxTimingWorker.ts`
- `src/modules/swarmgpt/utils/safeJson.ts`

### Postura conservadora — mantidos para revisão futura
Estes apareceram como órfãos pelo grep, mas podem ser:
- registrados em runtime (registries / lazy maps),
- entrypoints de subsistemas em adoção (`core/hardware/{HardwareRegistry,IngestionLayer,ManualModeState}`, `core/joi/JOIArtifactGenerator`, `core/sync/MultiSiteCoordinator`, `core/verification/VerificationPass`, `core/performance/memoryManager`, `core/project/projectManager`, `core/hud/HUDLayerManager`, `core/environment/sunSystem`, `core/interaction/terrainRaycaster`, `core/types/domainTypes`),
- ou parte do pipeline SwarmGPT em estabilização (`modules/swarmgpt/{adapters/applyToTimeline,advanced/sampling/reducePointCloud,pipeline/generateSwarmGPTShow}`, `data/parametricEffects`).

Decisão: **NÃO remover** sem inspeção dirigida em fase própria; o risco/benefício não compensa nesta fase.

## Próxima fase sugerida — Phase 5 (Otimizações)

- H1 — Unificar dual-store (`src/store/*` ↔ `src/stores/*`) com `migrateLegacyStores`.
- H4 — Auditar listeners em discoverers/transport (vazamento on unmount).
- M5 — Auditoria de dispose de texturas/materiais nos subsystems restantes (não-Show3DEngine).
- M3 — Rollout do logger estruturado (`logger.ts`) substituindo `console.*` em paths quentes.
