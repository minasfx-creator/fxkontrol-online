

# Ciclo #6 — Fase 4D: Extração de Actions em Slices do useProjectStore

## Análise

O `useProjectStore.ts` está em **613 LOC** após as fases 4A-4C. Os tipos e constantes já foram extraídos. O que resta é o **store Zustand monolítico** com ~460 LOC de actions misturadas em um único `create()`.

As actions se agrupam naturalmente em **5 domínios** independentes:

| Domínio | LOC | Linhas | Complexidade |
|---------|-----|--------|-------------|
| Drone Formations | ~115 | 434-550 | Alta (materialize, reorder, batch) |
| Trajectories/Waypoints | ~70 | 323-392 | Média (undo stack, VVIZ import) |
| Timeline Items | ~60 | 210-268 | Média (orphan cleanup) |
| Positions + Selection | ~50 | 270-321 | Média (linked events) |
| `effectWorldOrientation` (pura) | ~50 | 562-613 | Nenhuma (função pura, não é action) |

## O Que Será Feito (2 extrações seguras)

### 1. Extrair `effectWorldOrientation` para `src/lib/effectOrientation.ts`

Função pura de matemática quaternion — não é uma action do store, não usa `set()`, não depende de estado. Está no store por acidente histórico.

- Criar `src/lib/effectOrientation.ts`
- Re-exportar de `useProjectStore.ts` para backward compat
- Migrar consumidores diretos

**Risco:** Nenhum. Função pura sem side effects.

### 2. Extrair Drone Formation Slice para `src/store/slices/droneFormationSlice.ts`

O maior bloco de actions (~115 LOC) e o mais autocontido. Usa `materialize` do `formationMaterializer` e opera quase exclusivamente sobre `droneFormations`, `positions` e `trajectories`.

- Criar `src/store/slices/droneFormationSlice.ts` com factory function compatível com Zustand slice pattern
- Integrar no `useProjectStore` via spread no `create()`
- API pública idêntica — zero breaking change

**Risco:** Baixo. O slice pattern do Zustand é bem documentado. A integração é mecânica.

## Padrão do Slice (Zustand)

```typescript
// src/store/slices/droneFormationSlice.ts
export const createDroneFormationSlice = (set, get) => ({
  addDroneFormation: (formation) => set((s) => ({ ... })),
  // ... all drone formation actions
});

// useProjectStore.ts
export const useProjectStore = create<ProjectState>((...a) => ({
  // inline state + simple actions
  ...createDroneFormationSlice(...a),
}));
```

## Resultado Esperado

- Store reduzido de 613 para **~445 LOC** (-170 LOC)
- Drone logic isolada e testável independentemente
- `effectWorldOrientation` acessível sem importar store reativo
- Zero alteração de API ou comportamento

## Proteções

- Re-exports mantêm backward compat total
- Core engines intocados
- Build verificado com `tsc`
- Feature flag não necessária (mudança puramente estrutural)

## Próximo Passo (após validação)

Extrair Timeline Slice (~60 LOC) e Position Slice (~50 LOC), reduzindo o monolito para ~335 LOC.

