# Aprimorar palco e renderização do mapa no SkyCanvas 2.0 — referência UE5

## Referência visual (imagem enviada)

Arco frontal de truss curvo (≈9 colunas verticais + 2 lintéis arqueados), 3 painéis LED RGB pendurados no centro (vermelho/verde/azul), 2 feixes de laser saindo do palco (verde + azul) cruzando o céu, fundo Vantablack profundo, leve haze atmosférico realçando os feixes. É exatamente a estética que o `SkyCanvas2` precisa entregar nativamente.

## Diagnóstico

`SkyCanvas2` (`src/components/show3d/v2/`) hoje só renderiza `NightSky` + `GroundPlane` + `PyroPadsLayer` + `LightPointsLayer` + `ExplosionsLayer`. **Não há palco**. O legado `skycanvas/GroundSystem.tsx` (1232 linhas) tem `StageGround/SFXStage/InstancedTrussBars`, mas é o oposto da filosofia hardenada do v2 (FBM/voronoi/shaders pesados, sem dispose determinístico).

Bônus já no escopo: corrigir o erro transitório `Failed to fetch dynamically imported module: /src/components/editor/CinematicIntro.tsx` (chunk Vite invalidado) — vamos verificar e blindar a importação dinâmica com retry/fallback no mesmo passo, já que o Stage v2 vai ser carregado por `lazy()` também.

## Objetivo

Adicionar `StageLayer` ao v2 entregando a referência visual com a leveza do v2:
1. **Truss arco curvo** — 9 colunas verticais + 2 lintéis curvos (instanced cylinders, 1 draw call por subsistema)
2. **Painéis LED RGB centrais** — 3 quads emissivos (R/G/B configuráveis), pulse leve sincronizado a `useProjectStore.currentTime`
3. **Deck** — caixa central baixa
4. **Beams volumétricos** — 2 cones aditivos (verde/azul) saindo do topo do truss, levemente animados; opacidade ~0.18 com fake haze (sem post-processing)
5. **Haze de chão** — plano emissivo radial fraco para "ler" os beams
6. Tudo respeitando paleta canônica e regras v2 (Vantablack, sem `performance.now`, dispose determinístico, sem hardware/safety touch)

## Arquivos

**Novos**
- `src/components/show3d/v2/StageLayer.tsx` — orquestra Deck + TrussArch + LedPanels + Beams + Haze
- `src/components/show3d/v2/__tests__/stageLayer.smoke.spec.tsx` — render headless, dispose no unmount, flag off = não renderiza

**Editados**
- `src/components/show3d/v2/SkyCanvas2.tsx` — montar `<StageLayer />` entre `GroundPlane` e os layers de show
- `src/components/show3d/v2/types.ts` — `hideStage?: boolean`, `stageVariant?: 'arch' | 'minimal'`
- `src/components/show3d/v2/index.ts` — re-export
- `src/lib/featureFlags.ts` — `isSkycanvasV2StageEnabled()` (default ON, override `fxk.flag.skycanvas_v2_stage`)
- `src/pages/dev/SkyCanvas2Demo.tsx` — `?nostage=1` para QA visual
- `src/lib/installChunkErrorRecovery.ts` — endurecer captura do erro `Failed to fetch dynamically imported module` para `CinematicIntro` e similares (já existe a base, vamos garantir que pega `TypeError` além de `Error`)

## Detalhe técnico

```text
StageLayer (gated por flag + hideStage)
├─ Deck            BoxGeometry 14×0.8×6  · MeshStandard #0a0f1a
├─ DeckEdgeLED     plano fino cyan-dessat emissive (nosing)
├─ TrussArch
│   ├─ Columns     InstancedMesh cylinder 0.18×8m × 9 instances
│   └─ ArchBeams   2 TubeGeometry curvas (Catmull-Rom 12 pts)
├─ LedPanels       3 plane 1.6×1.2 com MeshBasicMaterial emissive
│                  cores: #ff2a2a / #28d76b / #2fb6ff
│                  pulse subtle: opacidade 0.85±0.1 via store time
├─ Beams           2 ConeGeometry invertidos (verde/azul)
│                  shaderMaterial aditivo, depthWrite=false
│                  alpha = pow(1-r, 2.2)*0.18, leve drift no apex
└─ Haze            RingGeometry no chão, additive, raio 18m

Disposal: cada geometria/material em useEffect cleanup pattern M5
Time source: useProjectStore.getState().currentTime (no useFrame, sem state)
Performance budget: +6 draw calls vs baseline atual
```

Dimensões calibradas para coexistir com `PyroPadsLayer` (pads externos ao arco).

## Plano de validação

1. `bunx vitest run src/components/show3d/v2/__tests__/stageLayer.smoke.spec.tsx`
2. Suíte completa `bunx vitest run src/components/show3d/v2`
3. QA visual em `/dev/skycanvas-2` (default ON) e `?nostage=1` (regressão)
4. `?perf=1`: confirmar +6 draw calls no máximo, FPS estável ≥55 em DPR alvo
5. Disparar 1 cue de teste e confirmar que pads/explosions seguem renderizando ao redor do palco (não há clipping/Z-fighting)

## Fora de escopo

- Importar `SM_LEDClock` / `M_ClockLED` glTF dos uploads UE5 (exigiria pipeline de asset)
- HDRIBackdrop / volumetric god-rays / bloom real (pesados, ficam no legacy)
- Migrar moving-heads procedurais legacy para v2 (próxima rodada se quiser)
