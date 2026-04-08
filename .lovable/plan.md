

# Ciclo #32 — Remaining Bugs: Coconut Trail Fix, Horsetail Trail Consistency, Saturn Ring Trail Gravity

## Diagnóstico

Cycle #31 fixed the **main physics** for horsetail, saturn, and coconut_tree, but left **residual bugs in the trail rendering** section of `FireworkRenderer.tsx`:

| # | Bug | Local | Impacto |
|---|-----|-------|---------|
| 1 | **Coconut tree trail uses wrong pattern name** — L752: `pattern === 'coconut'` should be `'coconut_tree'`. Trail section never matches → coconut trails render with default gravity instead of 3-phase | FireworkRenderer L752 | Trails don't droop correctly |
| 2 | **Horsetail trail gravity ramp mismatch** — Trail section (L748-751) uses `4.8` ramp factor, but main star physics (L577-579) uses `5.5`. Trail lags behind stars visually | FireworkRenderer L748-749 | Trail detaches from star path |
| 3 | **Horsetail trail drag mismatch** — Trail uses `dragCoeff * 0.7` (L750-751) but main physics uses `dragCoeff * 0.55` (L580). Trails diverge from star trajectories | FireworkRenderer L750-751 | Visual trail/star separation |
| 4 | **Saturn ring trail missing reduced gravity** — Main ring stars use flat `vy * 0.02` but trail section uses default `gravityMult` → ring trails sag while stars stay flat | FireworkRenderer L778 (missing case) | Ring shape deformation in trails |

## Plano de Implementação

### Arquivo: `src/components/editor/skycanvas/FireworkRenderer.tsx`

**Fix 1 — L752:** Change `'coconut'` → `'coconut_tree'`

**Fix 2 — L748-749:** Align horsetail trail gravity ramp to match main physics:
- Change `4.8` → `5.5` (matching L579)

**Fix 3 — L750-751:** Align horsetail trail drag:
- Change `dragCoeff * 0.7` → `dragCoeff * 0.55` (matching L580)

**Fix 4 — After L777:** Add saturn trail case:
```
} else if (pattern === 'saturn') {
  const isRingIdx = (i / STAR_COUNT) < 0.6;
  if (isRingIdx) {
    trailGrav0 = gravityMult * 0.3;
    trailGrav1 = gravityMult * 0.3;
  }
}
```

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Fix all 4 trail bugs in FireworkRenderer |
| 2 | Build verification |

