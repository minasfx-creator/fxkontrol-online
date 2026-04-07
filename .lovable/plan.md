

# Ciclo de Realismo #6 — Smoke Pós-Burst, Ember Physics, Star Flicker Orgânico

## Problemas Identificados

| # | Problema | Localização |
|---|---|---|
| 1 | **SmokeTrail e EmberParticles são importados mas NUNCA usados** no FireworkBurst ou TimelineEffects — dead imports. Após o burst, não há fumaça residual nem embers caindo, quebrando completamente o realismo pós-explosão | `FireworkRenderer.tsx:44-45` |
| 2 | **Ember physics sem gravidade quadrática** — usa `4.9 * age² * 0.08` (constante fixa) em vez de integração real com `GRAVITY`. Não responde ao vento proporcionalmente ao peso das partículas | `EmberParticles.tsx:74` |
| 3 | **Star flicker idêntico para todos os patterns** — trailing patterns usam `sin()` simples (linha 350), non-trailing usam `temporalFlicker` com parâmetros fixos. Não há variação por composição química (strontium flicka diferente de barium) | `FireworkRenderer.tsx:348-353` |
| 4 | **SmokeTrail usa 80-120 meshes individuais** com `sphereGeometry` — extremamente pesado. Cada puff = 1 draw call. Para smoke pós-burst precisamos de abordagem mais leve | `SmokeTrail.tsx:168-178` |
| 5 | **Ember reignition** usa `Math.sin()` — previsível e periódico. Deveria usar hash noise para picos estocásticos | `EmberParticles.tsx:89` |

## Soluções

### 1. Integrar Smoke + Embers no FireworkBurst (pós-burst)
**Arquivo**: `FireworkRenderer.tsx`

Adicionar ao JSX do FireworkBurst, após o shockwave ring:
- **Smoke pós-burst**: renderizar `SmokeTrail` quando `progress > 0.6` (fase final do burst), herdando posição e cor do burst. Usar `caliber` para escalar densidade.
- **Ember particles**: renderizar `EmberParticles` quando `progress > 0.3`, com `spreadRadius = caliber * 3` e `startHeight` baseado na posição Y do burst.

### 2. Ember physics com gravidade real e vento
**Arquivo**: `EmberParticles.tsx`

- Substituir `4.9 * age² * 0.08` por `0.5 * 9.81 * age²` (gravidade real)
- Adicionar arrasto quadrático: `velocity *= (1 - drag * speed * dt)` onde drag varia por tamanho da partícula
- Aumentar influência do vento de `0.05` para `0.15` (embers são leves)
- Substituir reignition `Math.sin()` por `hash01(seed + time * 3)` para picos estocásticos

### 3. Star flicker orgânico por composição química
**Arquivo**: `FireworkRenderer.tsx`

Diferenciar flicker parameters por cor/composição:
- **Strontium (red)**: base 0.55, amplitude 0.40, popStrength 0.45 — combustão irregular
- **Barium (green)**: base 0.70, amplitude 0.25, popStrength 0.20 — queima mais estável
- **Copper (blue)**: base 0.60, amplitude 0.35, popStrength 0.38 — moderadamente instável
- **Titanium/Mg (white/silver)**: base 0.50, amplitude 0.45, popStrength 0.50 — muito irregular
- Trailing patterns: substituir `sin()` simples por `temporalFlicker` com amplitude reduzida (0.15) para brilho mais constante com micro-variações

### 4. Smoke pós-burst leve (InstancedMesh em vez de meshes individuais)
**Arquivo**: `SmokeTrail.tsx`

Converter de N meshes individuais para `InstancedMesh` com `sphereGeometry` compartilhado:
- 1 draw call em vez de 80-120
- Usar `instanceMatrix` e `instanceColor` para posição/cor por partícula
- Opacity via uniform global (aproximação aceitável para smoke difuso)

### 5. pyroNoise — flicker params lookup por compound
**Arquivo**: `pyroNoise.ts`

Adicionar função `getFlickerParams(compound: string)` que retorna `{base, amplitude, popStrength}` calibrados por composição química.

## Arquivos Modificados

| Arquivo | Ação |
|---|---|
| `src/components/editor/skycanvas/FireworkRenderer.tsx` | Integrar smoke + embers no burst, flicker por composição |
| `src/components/editor/effects/EmberParticles.tsx` | Gravidade real, arrasto quadrático, vento, reignition estocástico |
| `src/components/editor/effects/SmokeTrail.tsx` | Converter para InstancedMesh (1 draw call) |
| `src/lib/pyroNoise.ts` | Adicionar `getFlickerParams()` por compound |

## Ordem de Execução

| Passo | Tarefa |
|---|---|
| 1 | pyroNoise.ts — adicionar getFlickerParams por compound |
| 2 | EmberParticles.tsx — gravidade real, arrasto, vento, reignition |
| 3 | SmokeTrail.tsx — converter para InstancedMesh |
| 4 | FireworkRenderer.tsx — integrar smoke/embers + flicker orgânico |
| 5 | Build verification |

