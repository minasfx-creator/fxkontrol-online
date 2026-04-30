# Configurador de Efeitos PYRO + DRONES

Adiciona uma UI dedicada para o operador ajustar parâmetros de cada efeito **antes** de aplicar ao ShowPlan / Timeline, integrada aos plugins PYRO e DRONES do Viewport Segment Plugin System.

## Princípio

- ShowPlan continua sendo a verdade canônica.
- `EFFECT_LIBRARY` permanece **imutável** (catálogo industrial).
- Overrides ficam no `TimelineItem` (já suporta `colorOverride`, `pan/tilt/spin`, `cueHeading`, `cuePitch`, `durationOverride`, `flightCount`, `notes`, `hazard`).
- Variantes vão para um store leve persistido em localStorage e são resolvidas via `resolveEffect(id)` (variant > library).
- Mutações sempre via `executeViewportCommand` → `operationLog` (undo).

## Fluxo

```text
[Painel PYRO]                 [Painel DRONES]
    |                              |
"Configure Effect"            "Configure Drone"
    ↓                              ↓
EffectConfigDialog            DroneConfigDialog
  Tab: Esta cue                 Tab: Posição (drone-pad)
  Tab: Salvar variante          Tab: Formação associada
    ↓                              ↓
  CommandHandler               CommandHandler
    ↓                              ↓
  TimelineItem override        Position / DroneFormation update
  ou effectVariants.upsert
    ↓                              ↓
  operationLog (undo)          operationLog (undo)
```

## Arquivos a criar

```text
src/features/viewport-tools/
├─ effectVariants.ts                       (store + localStorage + resolveEffect)
└─ components/
   ├─ EffectConfigDialog.tsx               (PYRO — tabs Override / Variant)
   └─ DroneConfigDialog.tsx                (DRONES — tabs Position / Formation)
```

## Arquivos a editar

- `src/features/viewport-tools/segments/pyro.plugin.ts` — adicionar tool `PYRO_CONFIGURE_EFFECT` (scope `edit`).
- `src/features/viewport-tools/segments/drones.plugin.ts` — adicionar tool `DRONES_CONFIGURE` (scope `edit`).
- `src/features/viewport-tools/components/ViewportSegmentToolbar.tsx` — montar os dois dialogs (controlados via estado local + event bus simples) e tratar undo dos novos commands.

## Detalhes técnicos

### `effectVariants.ts`
- Map<string, Effect> + persistência em `localStorage` (`fxk.effect-variants.v1`).
- `upsert(variant)`, `remove(id)`, `subscribe(fn)`.
- `resolveEffect(id)`: variant primeiro, fallback `getEffectById` da library.
- `deriveVariantId(baseId)`: gera `mort-01-v1`, `-v2`, evita colisão com library e variantes.

### `EffectConfigDialog.tsx`
- Props: `open`, `onClose`, `effectId`, `targetTimelineItemId?`.
- Carrega via `resolveEffect(effectId)` (sempre tem fallback no catálogo).
- Tabs Radix:
  - **Esta cue** (requer `targetTimelineItemId`): edita `colorOverride`, `cueHeading`, `cuePitch`, `pan`, `tilt`, `spin`, `durationOverride`, `flightCount`, `notes`, `hazard`. Apply → `useProjectStore.setState` no item.
  - **Salvar variante**: nome, color, caliber, heightMeters, prefire, fuseDelay, safetyDistance, vdl, duration, cost, shotCount, partType. Apply → `effectVariantStore.upsert({...base, id: deriveVariantId(base.id), name})`.
- Inputs com `type=number` clampados (caliber 1–12, heightMeters 1–500, prefire 0–10s, etc.).
- Read-only: id base, type, category.
- Footer: Cancel / Apply (Apply emite ViewportOperation via dispatcher).

### `DroneConfigDialog.tsx`
- Carrega `Position` (drone-pad) e tenta achar `DroneFormation` cuja `points` cubra o pad (heurística: formação mais recente OU primeira da lista).
- Tabs:
  - **Posição**: x, y, z, heading, pitch, roll, name, color. Apply → `updatePosition(id, …)`.
  - **Formação**: formationType (select), droneCount, height, radius, spacing, rotation, color, transitionDuration, holdDuration. Apply → `updateDroneFormation(id, …)` ou `addDroneFormation(...)` se ainda não existir.
- Inputs clampados (droneCount 1–500, height 1–200 m, radius 1–500 m).

### Tools adicionados aos plugins
- `PYRO_CONFIGURE_EFFECT` — `requiresSelection: true`. Handler resolve último `selectedTimelineItemId` (ou primeiro item de uma posição selecionada) e dispara evento global `viewport-tools:open-effect-config`.
- `DRONES_CONFIGURE` — `requiresSelection: true`. Handler dispara `viewport-tools:open-drone-config` com primeiro `drone-pad` da seleção.
- Ambos retornam ViewportOperation com `before/after` mínimos para auditoria; mutação real ocorre dentro do dialog (que também usa o dispatcher).

### Undo
- `PYRO_OVERRIDE_CUE` (gerado pelo Apply do dialog) salva `before: TimelineItem snapshot` / `after: { id, fields }` → toolbar `undo` restaura snapshot.
- `PYRO_VARIANT_SAVE` salva `after: variantId` → undo remove via `effectVariantStore.remove(variantId)`.
- `DRONES_UPDATE_POSITION` / `DRONES_UPDATE_FORMATION` snapshots completos da entity.

## Constraints respeitadas
- Sem `<button>` dentro de `CollapsibleTrigger` (uso `Dialog`/`Tabs`).
- Palette Vantablack/Cyan, sem cores hex hardcoded fora de tokens.
- ShowPlan = canonical (variantes ≠ library).
- WorkMode: nenhum desses commands é safety-critical (apenas edição em design/simulation).
- Dispatcher continua sendo o único caminho.

## Tarefas

1. Criar `effectVariants.ts` + `resolveEffect`.
2. Criar `EffectConfigDialog.tsx` (Override + Variant).
3. Criar `DroneConfigDialog.tsx` (Position + Formation).
4. Estender `pyro.plugin.ts` e `drones.plugin.ts` com novos tools.
5. Montar dialogs em `ViewportSegmentToolbar.tsx` + handlers de undo.
6. Verificar tipos (`tsc --noEmit`).

Pronto para implementar.