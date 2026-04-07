

# Calibracao Chrysanthemum + Crossette + Bug Fixes

## Bugs Identificados

| # | Bug | Localizacao |
|---|---|---|
| 1 | `updateFrustum(camera)` chamado DUAS vezes por frame — linha 270 (dentro do `useFrame` de cada `FireworkBurst`) E linha 625 (no `TimelineEffects` render). A chamada dentro do `useFrame` e redundante e roda N vezes por frame | `FireworkRenderer.tsx:270` |
| 2 | Chrysanthemum sem upward bias — usa burst esferico simetrico (`sy * breakSpeed * 0.93`), produz esfera perfeita em vez de forma levemente achatada/elevada como no Finale 3D | `FireworkRenderer.tsx:210` |
| 3 | Crossette sem upward bias — `armPhi = Math.PI * 0.45` e simetrico, sem compensacao gravitacional. No Finale 3D, crossettes tem leve elevacao porque os sub-bursts secundarios perdem energia rapidamente | `FireworkRenderer.tsx:223-228` |
| 4 | `burstSimulation.ts` — chrysanthemum e crossette no `generateBurst()` tambem sem upward bias no else generico (linha 84: `+ cfg.velocity * 0.15` e fixo para todos, nao especifico) | `burstSimulation.ts:79-86` |
| 5 | `exposure.ts` — `luminanceAccum` e `luminanceSamples` nunca sao resetados apos leitura. `resetLuminanceAccum()` existe mas nenhum consumidor chama | `exposure.ts:14-15` |
| 6 | Duplicate frustum update no `FireworkBurst.useFrame` (ja corrigido no TimelineEffects mas nao removido do burst) causa CPU waste proporcional ao numero de bursts ativos | `FireworkRenderer.tsx:269-270` |

## Solucoes

### 1. Remover `updateFrustum` duplicado do FireworkBurst
**Arquivo**: `FireworkRenderer.tsx`

Remover linhas 269-270 (`updateFrustum(camera)` dentro do `useFrame` do `FireworkBurst`). O `TimelineEffects` ja chama `updateFrustum(camera)` uma vez por frame na linha 625 — isso e suficiente.

### 2. Chrysanthemum — upward bias realista
**Arquivo**: `FireworkRenderer.tsx`

Linha 210: mudar de:
```
vy = sy * breakSpeed * 0.93 * speedVar;
```
para:
```
vy = sy * breakSpeed * 0.93 * speedVar + breakSpeed * 0.08;
```
Adiciona +8% do breakSpeed como bias vertical — chrysanthemum no Finale 3D tem leve elevacao porque as estrelas sao mais leves e o momentum inicial da shell contribui para cima.

### 3. Crossette — upward bias + jitter mais natural
**Arquivo**: `FireworkRenderer.tsx`

Linhas 223-228: mudar `armPhi` de `Math.PI * 0.45` para `Math.PI * 0.40` (ligeiramente mais elevado) e adicionar `+ breakSpeed * 0.06` ao `vy`:
```
const armPhi = Math.PI * 0.40;
vy = Math.cos(armPhi + jitter) * breakSpeed * 0.82 + breakSpeed * 0.06;
```

### 4. burstSimulation.ts — bias especifico por pattern
**Arquivo**: `burstSimulation.ts`

No else generico (linha 79-86), adicionar cases especificos para chrysanthemum e crossette:
```typescript
} else if (pattern === 'chrysanthemum') {
  // Slightly elevated sphere — Finale 3D reference
  const speed = cfg.velocity * scale * (0.5 + Math.random() * 0.5);
  vx = Math.sin(phi) * Math.cos(theta) * speed;
  vy = Math.sin(phi) * Math.sin(theta) * speed + cfg.velocity * 0.25;
  vz = Math.cos(phi) * speed;
} else if (pattern === 'crossette') {
  // 4-6 arms with slight upward bias
  const armCount = cfg.symmetry || 4;
  const arm = i % armCount;
  const armAngle = (arm / armCount) * Math.PI * 2;
  const jitter = (Math.random() - 0.5) * 0.15;
  const speed = cfg.velocity * scale * (0.8 + Math.random() * 0.2);
  vx = Math.sin(Math.PI * 0.42) * Math.cos(armAngle + jitter) * speed;
  vy = Math.cos(Math.PI * 0.42) * speed + cfg.velocity * 0.1;
  vz = Math.sin(Math.PI * 0.42) * Math.sin(armAngle + jitter) * speed;
}
```

### 5. Exposure leak fix — chamar resetLuminanceAccum
**Arquivo**: `exposure.ts`

Adicionar `resetLuminanceAccum` ao final de `updateExposure()`:
```typescript
// Reset accumulator after each frame update
state.luminanceAccum = 0;
state.luminanceSamples = 0;
```

## Arquivos Modificados

| Arquivo | Acao |
|---|---|
| `src/components/editor/skycanvas/FireworkRenderer.tsx` | Remover updateFrustum duplicado, chrysanthemum/crossette upward bias |
| `src/render_ultra/fireworks/burstSimulation.ts` | Chrysanthemum e crossette patterns especificos |
| `src/render_ultra/postprocessing/exposure.ts` | Fix luminance leak |

## Ordem de Execucao

| Passo | Tarefa |
|---|---|
| 1 | Fix exposure leak |
| 2 | Remover updateFrustum duplicado do FireworkBurst |
| 3 | Chrysanthemum upward bias (FireworkRenderer + burstSimulation) |
| 4 | Crossette upward bias (FireworkRenderer + burstSimulation) |
| 5 | Build verification |

