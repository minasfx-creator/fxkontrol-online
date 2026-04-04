

# Ciclo de Refatoração — Fase 4B: Migração dos Consumidores de EFFECT_LIBRARY

## Estado Atual

Fases completas: 1 (Dedup), 2 (Facade Hooks), 3 (DMX Hierarchy), 5 (Edge Shared Utils), 4A (Extração EFFECT_LIBRARY + Feature Flags).

`EFFECT_LIBRARY` já vive em `src/data/effectLibrary.ts` e é re-exportada de `useProjectStore` para backward compat. Porém **42 arquivos** ainda importam `EFFECT_LIBRARY` do store — isso mantém a dependência artificial e inflaciona o bundle do store em cada consumidor.

## O Que Será Feito

Migrar todos os 42 consumidores para importar `EFFECT_LIBRARY` (e o tipo `Effect`) diretamente de `src/data/effectLibrary` em vez de `@/store/useProjectStore`. Os que também importam o hook `useProjectStore` ou tipos como `TimelineItem` continuam importando esses do store — apenas `EFFECT_LIBRARY` e `Effect` mudam de origem.

## Regra de Migração (por arquivo)

```text
ANTES:
import { useProjectStore, EFFECT_LIBRARY, type Effect } from '@/store/useProjectStore';

DEPOIS:
import { useProjectStore } from '@/store/useProjectStore';
import { EFFECT_LIBRARY, type Effect } from '@/data/effectLibrary';
```

Se o arquivo importa APENAS `EFFECT_LIBRARY` / `Effect` do store (sem o hook), a linha do store é removida inteiramente.

## Arquivos Afetados (42 ficheiros, 3 lotes)

**Lote 1 — Componentes Editor (UI):** ~18 arquivos
`EffectLibrary.tsx`, `AddPositionWizard.tsx`, `CakeBuilder.tsx`, `ChainEditorPanel.tsx`, `ExportModal.tsx`, `PositionPins.tsx`, `PyroLaunchAngle.tsx`, `PyroTimelineTrack.tsx`, `ScriptWindow.tsx`, `ScriptingDialogs.tsx`, `ScriptingToolsPanel.tsx`, `SoundLevelPanel.tsx`, `SynesthesiaPanel.tsx`, `RiderPanel.tsx`, `SkyCanvas.tsx`, `FireworkRenderer.tsx`, `safety/DeconflictionTab.tsx`, `safety/FlightCheckTab.tsx`

**Lote 2 — Libs/Engines:** ~12 arquivos
`exportEngine.ts`, `labelGenerator.ts`, `safetyEngine.ts`, `hcaSafetyLayer.ts`, `reportEngine.ts`, `firingSystemExports.ts`, `chainEngine.ts` (se importa), `skybrushSafetyCheck.ts`, etc.

**Lote 3 — Stores/Hooks:** ~4 arquivos
`useInventoryStore.ts`, `useStockValidation.ts`, etc.

## Proteções

- `useProjectStore` mantém o re-export — zero breaking change para qualquer arquivo não migrado
- Nenhuma lógica alterada — apenas origem do import
- Core engines (fxkEngine, timelineEngine, fireworkEngine) não são tocados
- Build verificado com `tsc` após cada lote

## Risco

**Nenhum.** Trata-se exclusivamente de mover a origem de um import estático. O re-export no store permanece como safety net.

## Resultado Esperado

- 42 ficheiros deixam de depender artificialmente do módulo de 719 LOC para acessar uma constante estática
- Tree-shaking mais eficiente (consumidores que só precisam de efeitos não puxam o store)
- Preparação para Phase 4C (extração de tipos)

## Ficheiros

| Ação | Ficheiro |
|------|---------|
| Modificar | ~42 arquivos (split de import lines) |
| Preservar | `src/store/useProjectStore.ts` (re-export mantido) |
| Preservar | `src/data/effectLibrary.ts` (sem alterações) |

