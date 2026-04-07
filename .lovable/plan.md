

# Calibração Industrial — Superar Finale 3D em Realismo e Performance

## Diagnóstico Técnico

A análise do codebase revela 7 problemas críticos que degradam a qualidade:

| Problema | Causa Raiz | Impacto |
|---|---|---|
| Cena acende/apaga | `AdaptiveExposureController` oscila entre 0.35-1.8 sem damping adequado; `darkenSpeed: 4.0` vs `brightenSpeed: 1.0` cria assimetria extrema | Lighting instável |
| FPS 14-21 constante | `FireworkBurst.useFrame` aloca `new THREE.Frustum()`, `new THREE.Matrix4()`, `new THREE.Sphere()` e `new THREE.Vector3()` POR FRAME POR BURST — GC pressure massivo | Watchdog `critical` permanente |
| Fogos invisíveis | Frustum culling com `cullRadius = caliber * 5` (ex: 20m para calibre 4) é pequeno demais — bursts de 6" expandem para 100m+; `isInFrustum` rejeita efeitos visíveis | Efeitos cortados |
| Posições erradas | `VenueShowOverlay` injeta posições relativas ao GPS origin mas o `resolvedPos` no `TimelineEffects` usa coordenadas absolutas sem considerar heading da praça | Balsas fora d'água |
| Bloom excessivo | Bloom Layer 1 threshold 2.8 com star shader emitindo cores `> 1.0` via HDR = bloom em tudo, não apenas nos flashes | Visual lavado |
| Exposure ping-pong | `luminance += elapsed < 0.5 ? 3.0 : 0.5` por burst — 10 bursts simultâneos = luminance 30, exposure cai para 0.35; no frame seguinte sem bursts = sobe para 1.8 | Pisca-pisca |
| PostProcessing pesado | EffectComposer com SMAA + SSR + SSAO + DOF + 3x Bloom + GodRays + Heat + MotionBlur + Sharpen + BrightnessContrast + HueSaturation + ColorGrading + ToneMapping = 14 passes | GPU saturada |

## Soluções

### 1. Estabilizar Exposure — Eliminar Pisca-Pisca
**Arquivo**: `src/render_ultra/postprocessing/exposure.ts` + `src/components/editor/skycanvas/LightingSystem.tsx`

- Aumentar `brightenSpeed` de 1.0 para 2.0 (menos assimetria)
- Reduzir `darkenSpeed` de 4.0 para 2.5
- Clampar `luminance` por burst a 1.5 (não 3.0)
- Limitar luminance total a 6.0 (não 15.0)
- Estreitar range de exposure de [0.35, 1.8] para [0.7, 1.4] — variação máxima de 2x, não 5x
- Adicionar temporal smoothing: média ponderada dos últimos 5 frames de luminance

### 2. Zero-GC no FireworkBurst — Eliminar Alocações Per-Frame
**Arquivo**: `src/components/editor/skycanvas/FireworkRenderer.tsx`

- Mover `new THREE.Frustum()`, `new THREE.Matrix4()`, `new THREE.Sphere()`, `new THREE.Vector3()` para module-level singletons (como já feito em LightingSystem)
- São 4 alocações × N bursts × 60fps = centenas de objetos/segundo para GC
- Substituir por `_frustum`, `_projMatrix`, `_burstSphere`, `_burstCenter` reutilizáveis

### 3. Corrigir Frustum Culling — Raio Realista
**Arquivo**: `src/components/editor/skycanvas/FireworkRenderer.tsx`

- Aumentar `cullRadius` de `caliber * 5` para `caliber * 30` no `TimelineEffects` (linha 628)
- Fireworks de calibre 6 expandem para ~150m — o raio de culling deve ser pelo menos `caliber * 25`
- Isso elimina o corte prematuro de efeitos que estão visíveis mas são descartados

### 4. Calibrar Bloom — Threshold Cinematográfico
**Arquivo**: `src/components/editor/PostProcessing.tsx`

- Bloom Layer 1: subir `luminanceThreshold` de 2.8 para 3.5 — só flash real
- Bloom Layer 2: subir de 3.5 para 5.0 — apenas explosões intensas
- Reduzir `intensity` base de `str * 0.065` para `str * 0.04` — menos lavado
- Desabilitar Bloom Layer 3 (atmospheric) quando não há bursts pesados — economia de GPU

### 5. Reduzir PostProcessing — Cortar Passes Desnecessários
**Arquivo**: `src/components/editor/PostProcessing.tsx`

- Remover `DownSampleBlur` (duplica o que bloom já faz)
- Desabilitar `SSR` por padrão (custo absurdo para cena noturna com pouca reflexão)
- Reduzir SSAO samples de 16 para 8
- `MotionBlur` screen-space é fake e caro — desabilitar por padrão
- Resultado: de ~14 passes para ~7-8 passes

### 6. Calibrar Física dos Fogos — Realismo Finale 3D
**Arquivo**: `src/components/editor/skycanvas/FireworkRenderer.tsx`

- Peony: reduzir `speedVar` exponent de 0.7 para 0.5 — distribuição mais uniforme (Finale usa esfera regular)
- Willow: aumentar `starLife` multiplier de 2.2 para 3.0 — pendão mais longo
- Chrysanthemum: adicionar slight upward bias (+2 m/s em Y) — não perfeitamente esférica
- Star size: aumentar `baseSize` por calibre (atualmente 6" = 0.9, deveria ser 1.4)
- Drag coefficient: calibres maiores devem ter MENOS drag (ar stars mais pesadas) — ajustar curva
- Trail opacity: aumentar de 0.8 para 0.95 com tail warmth mais pronunciado

### 7. Performance — Playback Rate Guard
**Arquivo**: `src/components/editor/SkyCanvas.tsx`

- Quando `getDegradationLevel() === 'critical'`, automaticamente reduzir `particleDensity` para 0.5
- Restaurar quando FPS > 40 por 3 segundos consecutivos
- Isso evita o ciclo `severe → critical → severe` que aparece nos logs

## Ordem de Execução

| Passo | Tarefa | Impacto |
|---|---|---|
| 1 | Estabilizar exposure — eliminar pisca-pisca | Visual estável |
| 2 | Zero-GC FireworkBurst — singletons per-frame | +15-20 FPS |
| 3 | Corrigir frustum culling radius | Fogos visíveis |
| 4 | Calibrar bloom thresholds | Visual cinematográfico |
| 5 | Reduzir passes PostProcessing | +10 FPS |
| 6 | Calibrar física dos fogos | Realismo Finale |
| 7 | Build verification | Estabilidade |

## Resultado Esperado

- FPS estável 40-60 (hoje: 14-21)
- Lighting sem pisca — variação máxima 2x (hoje: 5x)
- Fogos sempre visíveis com raio de culling realista
- Bloom cinematográfico sem lavar a imagem
- Física calibrada para cada padrão (peony, willow, chrysanthemum, etc.)
- PostProcessing otimizado: 7 passes em vez de 14

