
# Ciclo de Polish #21 — Falling Leaves Tumble, Glitter Delay Scatter, Willow Droop

## Melhorias Identificadas

| # | Melhoria | Arquivo | Descrição |
|---|----------|---------|-----------|
| 1 | **Falling leaves sem tumble rotation** — stars do pattern `falling_leaves` caem em linha reta sem a rotação oscilante característica de folhas ao vento | `FireworkRenderer.tsx` | Adicionar tumble sinusoidal (oscilação X/Z com fase aleatória por star) durante a queda |
| 2 | **Glitter sem delay scatter estocástico** — todas as stars do pattern `glitter` piscam no mesmo ritmo, sem o delay aleatório que cria o efeito cascata de brilho | `FireworkRenderer.tsx` | Aplicar delay offset aleatório por star no flicker/strobe, criando cascade effect |
| 3 | **Willow droop insuficiente** — stars do willow perdem velocidade horizontal mas não curvam o suficiente para baixo no final da vida, parecendo mais peony lento que willow real | `FireworkRenderer.tsx` | Aumentar gravityMult progressivo nas últimas 40% de vida, reduzir drag horizontal |

## Ordem

1. Falling leaves tumble physics
2. Glitter delay scatter
3. Willow enhanced droop
4. Build verification
