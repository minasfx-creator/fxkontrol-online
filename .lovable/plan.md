

## Diagnóstico: O que já existe vs. o que é pedido

O prompt tático pede 4 fases. Aqui está o estado real:

| Fase | Pedido | Estado Atual |
|------|--------|-------------|
| 1. Limpeza UI / Tactical Dock | Dock lateral, paleta escura | **Já feito** — `TacticalDock.tsx`, `ViewportConfigMenu.tsx`, `JoiStatusMonitor.tsx` criados; tokens semânticos aplicados em 15+ componentes |
| 2. VvizParser (JS simples) | Parser síncrono JSON → path | **Existente é SUPERIOR** — `vvizWorker.ts` (Web Worker, ArrayBuffer streaming, zero-copy) + `VVIZImporter.tsx` com drag-drop e diagnósticos |
| 3. SwarmPlaybackEngine (JSX) | InstancedMesh com TypedArrays | **Existente é SUPERIOR** — `InstancedDroneSwarm.tsx` (6x InstancedMesh, PBR, tri-tier LOD, glow points > 400m) |
| 4. Integração + Import button | File input + Canvas integration | **Já feito** — `VVIZImporter` com drag-drop, dialog, chunk commits; `OrbitControls` damping 0.05 |

**Conclusão**: Todas as 4 fases já estão implementadas com qualidade igual ou superior ao código proposto. Criar os ficheiros `VvizTacticalParser.js` e `SwarmPlaybackEngine.jsx` seria um **downgrade** — código duplicado e inferior ao motor existente.

---

## O que resta fazer (refinamento residual)

Há 4 componentes com `border-white/5` ou `border-white/10` hardcoded que ainda não foram migrados para tokens semânticos:

1. **`AICoPilotPanel.tsx`** — 2 instâncias de `border-white/5`
2. **`DMXMonitorGrid.tsx`** — `border-white/5` e `ring-white/10`
3. **`CinematicIntro.tsx`** — `border-white/10` (aceitável — é um overlay cinematográfico com estética própria)
4. **`VideoChoreoPanel.tsx`** — `border-white/50` (é um indicador de cor, contextual)

### Plano de ação

**Ficheiros a modificar: 2** (os 2 relevantes; CinematicIntro e VideoChoreoPanel são contextuais e não precisam de alteração)

1. **`src/components/editor/AICoPilotPanel.tsx`**
   - `border-white/5` → `border-border/20`
   - `bg-white/[0.02]` → `bg-muted/10`
   - `hover:bg-white/[0.04]` → `hover:bg-muted/20`

2. **`src/components/editor/DMXMonitorGrid.tsx`**
   - `border-white/5` → `border-border/20`
   - `ring-white/10` → `ring-border/30`

### Proteções
- VVIZ Worker parser — intacto
- InstancedDroneSwarm renderer — intacto
- Zustand stores — intactos
- Google APIs — intactas
- GroundControls / FlyControls — intactos

