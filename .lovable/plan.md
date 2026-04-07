

# Ciclo de Realismo #5 — Heart Paramétrico, Peony Fade Exponencial, Flash Cinematográfico

## Problemas Identificados

| # | Problema | Localização |
|---|---|---|
| 1 | Heart no FireworkRenderer usa distribuição esférica genérica (case `default` na linha 236) — não tem case dedicado. No `burstSimulation.ts` a curva paramétrica existe mas com jitter excessivo (`±3` absoluto) que destrói a forma | `FireworkRenderer.tsx:236`, `burstSimulation.ts:62-70` |
| 2 | Peony fade usa `fadeCubed` (cúbico) — desaparece muito rápido no meio da vida. Finale 3D usa fade exponencial `e^(-kt)` que mantém brilho mais tempo e depois decai suavemente | `FireworkRenderer.tsx:318-320` |
| 3 | Flash inicial (progress < 0.06) dura apenas 60ms — muito curto para ser percebido como cinematográfico. Finale 3D mostra flash de ~150ms com 3 camadas (core branco, halo colorido, shockwave ring) | `FireworkRenderer.tsx:447-458` |
| 4 | Heart no `burstSimulation.ts` usa `speed * 5` para z-spread — excessivo, espalha estrelas para frente/trás demais, perdendo a silhueta 2D que define o heart | `burstSimulation.ts:70` |

## Soluções

### 1. Heart — case dedicado no FireworkRenderer
Adicionar case `'heart'` no switch (linha 202) com curva paramétrica:
```typescript
case 'heart': {
  const t_