

# Ciclo #9 — Calibração Final: Gerb/Flame Physics + Smoke Wind Response + RealisticFirework Drag Alignment

## Analise

Fases completas: Balística (NFPA tables), drag quadrático, flicker estocástico, detonation envelope, wind field turbulento, per-particle drag por material.

### Gaps Restantes (vs. especificação)

| Gap | Severidade | Ficheiro |
|-----|-----------|---------|
| 1. `createGerbStream` usa velocidade linear sem drag/flicker | Alta | `pyroPhysics.ts:634` |
| 2. `RealisticFirework` usa drag exponencial (shader), mas NÃO quadrático — inconsistente com `ShellBurstRenderer` | Média | `RealisticFirework.tsx:44-48` |
| 3. `RealisticFirework` não usa `windField` — vento é sempre `(0,0,0)` | Alta | `RealisticFirework.tsx:367-368` |
| 4. Smoke wind response é fraco — `sp.vy *= 0.994` mas sem `windField.sample()` por posição | Média | `ShellBurstRenderer.tsx:712` |
| 5. `createGerbStream` lifetime fixo 0.8-1.3s — deveria variar com altura (5-20 m/s, 2-8m) | Média | `pyroPhysics.ts:641` |
| 6. Glitter trail gravity hardcoded `-9.81 * 0.5` — deveria usar `GRAVITY` constant | Baixa | `ShellBurstRenderer.tsx:589` |

## Plano (4 intervenções)

### 1. Calibrar `createGerbStream` com física realista (pyroPhysics.ts)

- Velocidade de emissão: 5-20 m/s (proporcional à altura)
- Lifetime: proporcional à altura/velocidade com variância ±15%
- Spread angular: aumentar de 0.15 para 0.2-0.35 (cone realista)
- Drag alto (sparks leves: k=0.08-0.15)

**Risco:** Nenhum. Função utilitária pura.

### 2. Alinhar `RealisticFirework` shader com drag quadrático (RealisticFirework.tsx)

O shader atual usa `(1 - e^(-k*t)) / k` (drag exponencial linear). Converter para modelo que aproxime drag quadrático no GPU:
- Substituir `dragFactor` por `t / (1.0 + k * speed * t)` — aproximação analítica do drag quadrático
- Adicionar uniform `uWindField` sampado do `windField.getGlobalWind('ember')` no `useFrame`
- Usar `DRAG_TABLE` para definir `uDrag` por caliber em vez de constantes ad-hoc

**Risco:** Baixo. Mudança isolada no shader, valores de fallback mantidos.

### 3. Integrar `windField` no smoke do ShellBurstRenderer (ShellBurstRenderer.tsx)

- Substituir drift fixo (`sp.vy *= 0.994`) por `windField.sample(worldPos, 'smoke')`
- Fumaça responde a 100% do vento (conforme spec)
- Usar posição mundial real para turbulência espacial

**Risco:** Baixo. Smoke é cosmético, não afeta core.

### 4. Corrigir constantes hardcoded (ShellBurstRenderer.tsx)

- Glitter gravity: `GRAVITY` em vez de `-9.81 * 0.5`
- Garantir consistência com constante global

**Risco:** Nenhum.

## Ficheiros Afetados

| Ação | Ficheiro |
|------|---------|
| Modificar | `src/lib/pyroPhysics.ts` — `createGerbStream` calibrado |
| Modificar | `src/components/editor/effects/RealisticFirework.tsx` — drag quadrático + wind |
| Modificar | `src/components/editor/effects/ShellBurstRenderer.tsx` — smoke wind + glitter fix |
| Preservar | Core engines, stores, todos os outros |

## Resultado

- Gerbs com física plausível (velocidade, spread, lifetime calibrados)
- RealisticFirework com mesmo modelo de drag do ShellBurstRenderer (consistência)
- Fumaça responde ao campo de vento turbulento (realismo critico)
- Zero constantes hardcoded desalinhadas

## Proteções

- Nenhuma API pública alterada
- Valores default produzem comportamento visualmente idêntico ao atual
- Core engines intocados
- Build verificado com `tsc`

