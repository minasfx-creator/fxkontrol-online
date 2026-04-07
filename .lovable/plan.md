

# Limpeza, Bugs e Realismo — Ciclo de Calibracao Industrial #2

## Problemas Identificados

| # | Bug / Ineficiencia | Impacto |
|---|---|---|
| 1 | `spatialCuller.isInFrustum()` extrai frustum matrix POR EFEITO (~50-900x/frame). Já existe `updateFrustum()` em `frustumCuller.ts` que faz 1x/frame | CPU desperdicado, stalls |
| 2 | `sharedState.runActiveBurstScan()` usa luminance 3.0 por burst (linha 42) — inconsistente com LightingSystem que já foi corrigido para 1.5 | Dados de scan incorretos |
| 3 | `exposure.ts` acumula `luminanceAccum` infinitamente — `resetLuminanceAccum()` nunca é chamado | Memory leak lento |
| 4 | Dois sistemas de frustum culling coexistem: `spatialCuller.ts` e `frustumCuller.ts` — redundância, confusão | Código duplicado |
| 5 | Film grain e chromatic aberration condicionados a `hasBursts` — cena vazia sem grain cinematográfico | Visual flat sem fogos |
| 6 | Flash sphere (break flash) com opacity 0.2 e 0.08 — muito fraco para ser percebido | Explosão sem impacto |
| 7 | Star vertex shader: `gl_PointSize = aSize * (8000.0 / -mvPos.z)` — divisor fixo causa stars gigantes perto da câmera | Visual quebrado em close-up |

## Solucoes

### 1. Unificar frustum culling — eliminar `spatialCuller.isInFrustum()`
**Arquivo**: `src/components/editor/skycanvas/FireworkRenderer.tsx`

Substituir `isInFrustum(camera, effectPos, cullRadius)` por `isSphereInFrustum(effectPos[0], effectPos[1], effectPos[2], cullRadius)` do `frustumCuller.ts`. Adicionar um único `updateFrustum(camera)` no INICIO do `TimelineEffects` render (fora do map), removendo a chamada redundante de dentro do `FireworkBurst.useFrame`.

### 2. Corrigir luminance em `runActiveBurstScan()`
**Arquivo**: `src/components/editor/skycanvas/sharedState.tsx`

Linha 42: mudar `luminance += elapsed < 0.5 ? 3.0 : 0.5` para `luminance += elapsed < 0.5 ? 1.5 : 0.3` — alinhado com LightingSystem.

### 3. Remover leak de `luminanceAccum`
**Arquivo**: `src/render_ultra/postprocessing/exposure.ts`

Chamar `resetLuminanceAccum()` ao final de `updateExposure()`, ou remover o accumulator inteiramente (não é usado por nenhum consumidor).

### 4. Film grain e chromatic aberration sempre ativos
**Arquivo**: `src/components/editor/PostProcessing.tsx`

- Film grain: remover condição `hasBursts` — sempre renderizar se `s.filmGrain > 0.01`
- Chromatic aberration: manter gated em bursts (correto — só em explosões)
- Reduzir film grain opacity de `s.filmGrain * 0.6` para `s.filmGrain * 0.4` para sutileza

### 5. Aumentar impacto do flash de explosão
**Arquivo**: `src/components/editor/skycanvas/FireworkRenderer.tsx`

- Flash interno (progress < 0.06): opacity de 0.2 para 0.5, cor `#FFFFEE`
- Flash externo (progress < 0.12): opacity de 0.08 para 0.2
- Adicionar scale pulse: `flashSize * (1 + progress * 12)` em vez de `* 6`

### 6. Corrigir star point size para close-up
**Arquivo**: `src/components/editor/skycanvas/FireworkRenderer.tsx`

Star vertex shader: adicionar clamp inferior mais agressivo e ajustar divisor:
```glsl
gl_PointSize = aSize * (6000.0 / -mvPos.z);
gl_PointSize = clamp(gl_PointSize, 0.5, 96.0);
```
Reduz max de 140 para 96 — evita stars que cobrem metade da tela em close-up.

### 7. Limpar import morto de `spatialCuller` no FireworkRenderer
**Arquivo**: `src/components/editor/skycanvas/FireworkRenderer.tsx`

Remover `import { isInFrustum } from '@/lib/spatialCuller'` após migrar para `frustumCuller`.

## Arquivos Modificados

| Arquivo | Acao |
|---|---|
| `src/components/editor/skycanvas/FireworkRenderer.tsx` | Unificar frustum, flash mais forte, star size fix |
| `src/components/editor/skycanvas/sharedState.tsx` | Fix luminance 3.0→1.5 |
| `src/render_ultra/postprocessing/exposure.ts` | Remover leak luminanceAccum |
| `src/components/editor/PostProcessing.tsx` | Film grain sempre ativo |

## Ordem de Execucao

| Passo | Tarefa |
|---|---|
| 1 | Fix sharedState luminance + exposure leak |
| 2 | Unificar frustum culling no FireworkRenderer |
| 3 | Flash mais forte + star size fix |
| 4 | Film grain sempre ativo no PostProcessing |
| 5 | Build verification |

