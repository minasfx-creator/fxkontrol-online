

# Ciclo de Realismo #3 — Drag por Pattern, Willow Trails Aprimorados, Bugs Restantes

## Problemas Identificados

| # | Problema | Impacto |
|---|---|---|
| 1 | `dragCoeff` no `useFrame` e uniforme para todos os patterns — willow/kamuro/brocade usam o MESMO drag que peony. Na realidade, estrelas de willow sao mais pesadas (charcoal-based) e tem MENOS drag | Willow nao "escorre" como deveria |
| 2 | `burstSimulation.ts` — willow, kamuro e brocade caem no `else` generico sem velocidade inicial especifica. Willow precisa de velocidade mais baixa + spread mais uniforme | Simulacao generica |
| 3 | Willow no `FireworkRenderer` usa `breakSpeed * 0.42` — muito lento para calibres grandes. Deveria escalar com o drag reduzido para criar o efeito de "cortina caindo" | Willow curta demais |
| 4 | Trail `trailDt = 0.035` e fixo para todos patterns — willow/kamuro precisam de `trailDt` menor (mais denso) para trilhas mais suaves | Trilhas segmentadas |
| 5 | `cullRadius` na linha 629 usa `caliber * 25` — willow expande mais que peony no mesmo calibre (menor velocidade + maior vida = drift gravitacional maior). Deveria ser `caliber * 35` para trailing patterns | Willow cortada pelo frustum |

## Solucoes

### 1. Drag diferenciado por pattern no `FireworkRenderer.tsx`
Apos calcular `dragCoeff` base por calibre (ja implementado), aplicar multiplicador por pattern:
- Willow: `dragCoeff * 0.55` (estrelas pesadas, menos resistencia ao ar)
- Kamuro: `dragCoeff * 0.45` (charcoal stars, ainda mais pesadas)
- Brocade: `dragCoeff * 0.60`
- Palm: `dragCoeff * 0.75`
- Peony/chrysanthemum/crossette: `dragCoeff * 1.0` (sem alteracao)

### 2. Willow velocidade inicial ajustada no `FireworkRenderer.tsx`
Linha 204: mudar de `breakSpeed * 0.42` para `breakSpeed * 0.55` — willow precisa de velocidade inicial maior para compensar a vida longa e criar o arco gravitacional correto. A combinacao de velocidade maior + drag menor = trajetoria mais longa e natural.

### 3. `burstSimulation.ts` — cases especificos para willow, kamuro e brocade
Adicionar logica dedicada:
- **Willow**: velocidade uniforme (spread 0.85-1.0), leve downward bias (`- velocity * 0.05`) para simular peso
- **Kamuro**: velocidade baixa + spread maximo, bias gravitacional pronunciado
- **Brocade**: similar a chrysanthemum mas com velocidade reduzida e spread mais uniforme

### 4. Trail density variavel por pattern no `FireworkRenderer.tsx`
Mudar `trailDt` de constante `0.035` para:
- Willow/kamuro/brocade: `0.020` (trilhas mais densas e suaves)
- Palm: `0.025`
- Demais: `0.035` (mantido)

### 5. Frustum culling radius por pattern
Linha 629: para trailing patterns, usar `caliber * 40` em vez de `caliber * 25`.

## Arquivos Modificados

| Arquivo | Acao |
|---|---|
| `src/components/editor/skycanvas/FireworkRenderer.tsx` | Drag por pattern, willow velocity, trailDt variavel, cullRadius por pattern |
| `src/render_ultra/fireworks/burstSimulation.ts` | Cases willow, kamuro, brocade com fisica dedicada |

## Ordem de Execucao

| Passo | Tarefa |
|---|---|
| 1 | burstSimulation.ts — adicionar cases willow, kamuro, brocade |
| 2 | FireworkRenderer.tsx — drag por pattern + willow velocity + trailDt + cullRadius |
| 3 | Build verification |

