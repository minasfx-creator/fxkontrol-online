# Ciclo de Refatoração — Fase 4C: Extração de Tipos do Store

## Estado Atual

Fases completas: 1 (Dedup), 2 (Facade Hooks), 3 (DMX Hierarchy), 5 (Edge Shared Utils), 4A (Extração EFFECT_LIBRARY), 4B (Migração 40 consumidores).

`useProjectStore.ts` tem **719 LOC**. As primeiras ~103 linhas são interfaces/tipos puros (sem relação com Zustand):
- `DepthLayer`, `TimelineItem`, `PositionType`, `Position`, `BezierHandle`, `Waypoint`, `Trajectory`, `EditorMode`, `SelectionMode`, `DroneFormation`, `CueMarker`, `CameraKeyframe`, `WindSettings`

**27 arquivos** importam estes tipos do store. Mover para módulo próprio reduz ~100 LOC do monolito e desacopla tipos de estado reativo.

## O Que Será Feito

### 1. Criar `src/types/projectTypes.ts`
Mover todas as interfaces/types listadas acima (linhas 5-125 do store).

### 2. Re-exportar de `useProjectStore.ts`
```typescript
export type { TimelineItem, Position, PositionType, ... } from '@/types/projectTypes';
```
Zero breaking change — todos os consumidores existentes continuam funcionando.

### 3. Migrar os 27 consumidores
Mesma regra da Fase 4B: arquivos que importam apenas tipos perdem a dependência do store inteiramente.

## Proteções
- Re-export mantém backward compat total
- Nenhuma lógica alterada — apenas tipos movidos
- Core engines intocados
- Build verificado com `tsc`

## Risco
**Nenhum.** Tipos são construções em tempo de compilação — zero impacto runtime.

## Resultado Esperado
- Store reduzido de 719 para ~620 LOC
- Tipos acessíveis sem carregar o store Zustand
- Tree-shaking mais eficiente para libs que só precisam de tipos
