---
name: Phase 1 Catalog Exit Coverage
description: Critério de saída da Fase 1 parametrizado sobre o catálogo inteiro de golden shows, garantindo que a pipeline (verificação + dry-run + export) é genérica, não acoplada ao seed Libertadores
type: feature
---
# Phase 1 Exit Coverage · Whole Catalog

`src/lib/showSeeds/__tests__/phase1ExitCatalog.test.ts` (13/13) generaliza
o critério de saída da Fase 1 — antes provado apenas para Libertadores —
para **todo `GOLDEN_SHOW_CATALOG`**.

## Para cada seed
1. `pyroCues.length > 0` e `hardwareConfig.modules.length === entry.modules`.
2. `verificationEngine.run(plan)` retorna **zero** issues `severity === 'error'`.
3. `result.level ∈ {READY_FOR_EXPORT, READY_FOR_FIELD}`.
4. `verificationEngine.canExport(plan) === true`.
5. `simulationDryRun(plan).cuesFired === totalCues` (dry-run completo).
6. `build()` é determinístico — fingerprint = cues `(time|module|channel)`
   sorted + módulos sorted, idêntico em chamadas sucessivas.

## Por que importa
- Comprova que a pipeline (Verification + DryRun + Export) **não está
  acoplada** ao Libertadores; qualquer novo golden seed só entra no
  catálogo se passar pelos mesmos 6 invariantes.
- Quando um seed regride (mudança em `vdlEffectMapper`, NFPA rules,
  schedule), o teste pinpointa exatamente qual.

## Como adicionar novo seed
1. Implementar `createXxxShowPlan()` puro/determinístico.
2. Registrar em `catalog.ts` com `durationS`/`modules` corretos.
3. Esta suite roda automaticamente — passa ou expõe a regressão.

## Cobertura atual
- `libertadores` (90s, 4×FXK16, 64ch): ✅
- `maracana-hino` (60s, 2×FXK16, 32ch): ✅
