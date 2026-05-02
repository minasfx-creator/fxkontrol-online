---
name: Fase 1 · Show Libertadores Golden Seed + Inspector + PDF + Export
description: src/lib/showSeeds/libertadores.ts (createLibertadoresShowPlan determinístico 90s 32lo+32hi+8cometas 4xFXK16 dual-key+NFPA70+cap75mm) + inspectShowPlan.ts (BoM/sequencing/pinout + min-gap canal interlock) + showPlanPdf.ts (pdf-lib A4) + libertadoresExport.ts (ZIP honest .fir+.csv+.json+disclaimer, claim policy explícito, ShowPlan por parâmetro)
type: feature
---

# Show Libertadores · Golden Show (Phase 1)

Reference ShowPlan canônico para validar pipeline simulação→export end-to-end. **Imutável e determinístico** — qualquer mudança quebra os 8 testes invariantes.

## Forma do show
- Duração: **90s** em 3 movimentos
  - **m1 Build-up** (0..30s): alterna gerb 25mm SOUTH + fountain 25mm NORTH cada 1.5s, 16 cada lado; 8 cometas 40mm cross em 75°.
  - **m2 Anthem** (30..60s): 16 pares S/N de shells 75mm chrysanthemum (azul SOUTH, gold NORTH), spacing 1.75s.
  - **m3 Finale** (60..90s): 16 waves 1.875s spacing × (lo S + lo N + hi S + hi N) = 64 cues finais.
- Total: ~144 cues, 64 posições, 4 módulos.

## Hardware
- 4 × FXK16 (ESP32-S3, `firmwareModel='FXK16'`, `compatibleWith='pyroslave_c16'`), 16ch cada, 12V battery.
- Mapping fixo: m0 low SOUTH · m1 low NORTH · m2 high SOUTH · m3 high NORTH.
- Posições em arco frontal: stage half-width 45m, lows em z=±30m, highs em z=±25m.

## Safety
- `requireDualKey: true` (estádio).
- `requireContinuityCheck: true`.
- `nfpaMinDistance: 70m` (NFPA 1123 baseline para 75mm).
- `maxCaliper: 75mm`.
- `maxWindSpeed: 12 m/s`.

## Invariantes garantidos por teste
1. Targets estruturais (≥32 lows, ≥32 highs, =8 cometas, =90s).
2. 4 módulos FXK16 com 16ch cada.
3. Toda cue referencia posição existente.
4. `module ∈ [0,4)`, `channel ∈ [0,16)`.
5. Monotonia temporal `[0..duration]`.
6. **Nenhum channel-reuse em janela <1s** — interlock contra cross-fire acidental.
7. Safety stadium-grade.
8. **Determinismo absoluto** — duas chamadas produzem o mesmo array de tempos / IDs.

## Convenção de coordenadas
- YZX (Pitch/Roll/Heading) para posições.
- Origem stage no chão (y=0); audiência em z negativo.
- Pyro line ao longo de x ∈ [-45m, +45m].

## Inspector + PDF (entregue)
- `src/lib/showSeeds/inspectShowPlan.ts` — pure: `buildBillOfMaterials` (group SKU×caliber, peso `marketing_hypothesis`), `buildSequencing` + `sequencingToCsv`, `buildPinout` (module/channel + `minGapS` por canal), `inspectShowPlan` agrega + flagga `tightReuseChannels` (<1s).
- `src/lib/showSeeds/showPlanPdf.ts` — pdf-lib A4: cover + safety + BoM + pinout + sequencing preview (40 linhas) + disclaimers; `downloadShowPlanPdf()` p/ UI.
- Suite `inspectShowPlan.test.ts` (7/7): grupos sem duplicata, monotonia, FXK16 in-range, **min-gap ≥ 1.0s**, determinismo.

## Honest Export Bundle (entregue)
- `src/lib/showSeeds/libertadoresExport.ts` — pure ShowPlan→bundle:
  - `generateFireOneScriptFromPlan(sp)` — `.fir` ASCII tempo-ordenado, valida canal por `module.channelCount` (FXK16=16, legacy=32). Cabeçalho carrega claim policy (ShowPlan content = validated · FireOne 2.0 acceptance = marketing_hypothesis).
  - `buildLibertadoresExportBundle(sp)` — agrega `.fir` + sequencing CSV + BoM JSON (com claim breakdown por seção) + disclaimer.
  - `buildLibertadoresExportZip(sp)` (async, JSZip) + `downloadLibertadoresExportZip(sp, filename?)`.
  - 4 entradas: `fxk_show.fir`, `fxk_sequencing.csv`, `fxk_bom.json`, `_FXK_DISCLAIMER.txt`.
- Suite `libertadoresExport.test.ts` (6/6): zero erro de canal no golden seed; header com claim policy; cues time-sorted; ZIP 4 entradas + round-trip; disclaimer com "DOES NOT authorize firing"; determinismo strippando timestamp.

## Simulation Dry-Run + Phase 1 Exit (entregue)
- `src/lib/showSeeds/simulationDryRun.ts` — pure, determinístico, ZERO side-effect (sem CommandBus / fieldBus / Three.js). Walk 60Hz do `play` loop em workMode=`simulation`. Schedule por `pyroCues` com chave `M{module}:C{channel}`. Reporta: `cuesFired`, `peakConcurrentBurns`, `avgLoadCuesPerSec`, `framesSampled`, `interlockBreaches[{channel,gapS}]`, `trace[]` (cap 240 frames).
- `/dev/libertadores`: painel **Simulation play loop · dry-run** (workMode badge, 4 stats, badge interlock NONE/breach + sparkline SVG de active burns) + card **Verification · Phase 1 exit** (`VerificationEngine.run(sp).level`, summary errors/warnings/passed, falhas error inline). Header carrega badge `Phase 1 · {level}`. Pure read.
- Suite `simulationDryRun.test.ts` (6/6): determinismo, paridade `cuesFired === pyroCues.length`, **interlockBreaches=0** no golden seed, duração finita ≤120s, trace cap ≤240, peak ≤ totalCues.
- **Critério de saída Fase 1 PROVADO**: `phase1ExitCriterion.test.ts` (5/5) — `verificationEngine.run(libertadoresShowPlan)` atinge `READY_FOR_EXPORT`/`READY_FOR_FIELD`, 0 errors, `canExport(sp)===true`. Bypass intencional do `ShowPlanManager` singleton via parameter direct-feed.
- **Suite showSeeds total: 40/40 verdes** (inclui canonicalToEnginePlan adapter 8/8).
- `src/lib/showSeeds/canonicalToEnginePlan.ts` — adapter pure ShowPlan canônico → engine ShowPlan (Show3DEngine.loadPlan). Burn proxy 1.2s alinhado ao simulationDryRun. `/dev/libertadores` Mount/Unmount do `ShowEngineHost` lazy.

## Próximos passos
- Acoplar dry-run ao `Show3DEngine` real para validação visual ParticleGPGPU + Smoke + Bloom.
- Iniciar Fase 2 (hardware físico em mesa) ou expandir biblioteca de golden seeds.

## Componentes
- `src/lib/showSeeds/libertadores.ts` — `createLibertadoresShowPlan()`, `summarizeLibertadores()`, `LIBERTADORES_TARGETS`.
- `src/lib/showSeeds/inspectShowPlan.ts` — `inspectShowPlan()`, `buildBillOfMaterials()`, `buildSequencing()`, `buildPinout()`, `sequencingToCsv()`.
- `src/lib/showSeeds/showPlanPdf.ts` — `renderShowPlanPdf()`, `downloadShowPlanPdf()`.
- `src/lib/showSeeds/libertadoresExport.ts` — `generateFireOneScriptFromPlan()`, `buildLibertadoresExportBundle()`, `buildLibertadoresExportZip()`, `downloadLibertadoresExportZip()`, `LIBERTADORES_EXPORT_FILES`.
- `src/lib/showSeeds/simulationDryRun.ts` — `simulationDryRun()`, types `DryRunOptions`/`DryRunResult`/`DryRunFrame`.
- Tests: `libertadores.test.ts` (8) + `inspectShowPlan.test.ts` (7) + `libertadoresExport.test.ts` (6) + `simulationDryRun.test.ts` (6) + `phase1ExitCriterion.test.ts` (5) = **32 verdes**.

