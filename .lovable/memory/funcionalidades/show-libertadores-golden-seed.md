---
name: Golden Show Catalog · Multi-Seed Phase 1 + Generic Export
description: catalog.ts (Libertadores 90s/4×FXK16 + Maracanã Hino 60s/2×FXK16) + /dev/golden-shows matriz live com Export ZIP por seed via goldenShowExport.ts (.fir+CSV+BoM+disclaimer, claim policy validated/marketing_hypothesis); 63/63 tests
type: feature
---

# Golden Show Catalog · Phase 1 (multi-seed)

Catálogo central de seeds canônicos para certificar que a pipeline
**simulação → verification → canonicalToEnginePlan → export** é genérica,
não acoplada a um show específico.

## Catálogo

| ID | Show | Duração | Módulos | Cues | Status |
|----|------|---------|---------|------|--------|
| `libertadores` | Libertadores · Final | 90s | 4 × FXK16 (64ch) | 32lo+32hi+8cometas | READY_FOR_EXPORT |
| `maracana-hino` | Maracanã · Hino Nacional | 60s | 2 × FXK16 (32ch) | 16lo+16hi+8 closing mines | READY_FOR_EXPORT |

Registrado em `src/lib/showSeeds/catalog.ts` (lazy `build()` — nada
instanciado no import).

## Arquivos

- `src/lib/showSeeds/libertadores.ts` — seed #1 (estádio).
- `src/lib/showSeeds/maracanaHino.ts` — seed #2 (solenidade hino).
- `src/lib/showSeeds/catalog.ts` — registry central.
- `src/pages/dev/GoldenShows.tsx` — `/dev/golden-shows` matriz live.
- `src/pages/dev/Libertadores.tsx` — `/dev/libertadores` deep-dive seed #1.

## Invariantes garantidos por seed

1. Determinístico (zero `Math.random()`, mesma input ⇒ mesma output).
2. `verificationEngine.run(sp).summary.errors === 0`.
3. `verificationEngine.canExport(sp) === true`.
4. `level ∈ {READY_FOR_EXPORT, READY_FOR_FIELD}`.
5. Channel-reuse ≥ 1.0s por (módulo, canal).
6. `simulationDryRun(sp).cuesFired === sp.pyroCues.length`.
7. `simulationDryRun(sp).interlockBreaches === []`.
8. `canonicalToEnginePlan(sp).timelineItems.length === sp.pyroCues.length`.

## Test suite

`src/lib/showSeeds/__tests__/` — **51/51 passing**:
- `libertadores.test.ts` (8) · `maracanaHino.test.ts` (11)
- `inspectShowPlan.test.ts` (7) · `canonicalToEnginePlan.test.ts` (8)
- `simulationDryRun.test.ts` (6) · `phase1ExitCriterion.test.ts` (5)
- `libertadoresExport.test.ts` (6)

## Como adicionar um novo seed

1. Implementar `createXxxShowPlan(): ShowPlan` puro em `src/lib/showSeeds/xxx.ts`.
2. Registrar entry em `GOLDEN_SHOW_CATALOG` (`src/lib/showSeeds/catalog.ts`).
3. Espelhar testes de `maracanaHino.test.ts` (estrutura + Phase 1 exit + pipeline genericity).

## Honesty layer

- Páginas `/dev/golden-shows` e `/dev/libertadores` são **read-only**:
  zero CommandBus, zero hardware, zero `setWorkMode`, zero `safetyStateMachine.transition`.
- Exports carregam claim policy explícito (Skybrush ZIP com
  `_FXK_DISCLAIMER.txt`, marcado `marketing_hypothesis`).
