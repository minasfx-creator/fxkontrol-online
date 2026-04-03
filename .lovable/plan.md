

## Plano: Integração SwarmPlaybackEngine + Revisão Mobile UX

### Contexto

O `SwarmPlaybackEngine` existe como componente standalone em `src/components/editor/SwarmPlaybackEngine.tsx` mas **não está integrado** no SkyCanvas nem acessível via UI. O VVIZ import flow atual (VVIZImporter → useProjectStore → DroneChoreography → InstancedDroneSwarm) não conecta ao SwarmPlaybackEngine.

Para mobile, o layout usa: MobileHUD (z-50, top), MobileQuickActions (z-40, left/right sides, bottom ~80px), MobileTabBar (z-50, bottom), e ViewportConfigMenu (z-30, top-left). O ViewportConfigMenu aparece no mobile **sem** `!isMobile` guard, potencialmente sobrepondo o MobileHUD.

---

### Implementação

**1. Adicionar toggle de renderer ao SceneStore**

Em `src/store/useSceneStore.ts`, adicionar ao `EnvironmentState`:
```
droneRendererMode: 'instanced' | 'swarm';  // default 'instanced'
```

**2. Integrar SwarmPlaybackEngine no SkyCanvas**

Na zona onde `DroneChoreography` é renderizado (linha 1538), adicionar lógica condicional:
- Se `droneRendererMode === 'instanced'` → renderiza `<DroneChoreography />` (atual)
- Se `droneRendererMode === 'swarm'` → converte as posições+trajectories do store em formato `SwarmAgent[]` e renderiza `<SwarmPlaybackEngine>`

Criar uma função bridge `trajectoriesToSwarmAgents()` que converte `Trajectory[]` + `Position[]` do projectStore para o formato `SwarmAgent[]` (path + colors).

**3. Adicionar opção no ViewportConfigMenu**

Na secção "Display" do dropdown (linha ~152), adicionar toggle "Drone Renderer" com opções Instanced (PBR/LOD) vs Swarm (Tactical). Chama `updateEnvironment({ droneRendererMode: ... })`.

**4. Corrigir sobreposição mobile — ViewportConfigMenu**

O `ViewportConfigMenu` renderiza na `top-3 left-3 z-30` e aparece no mobile, conflitando com MobileHUD (`z-50 top-0`). Soluções:
- Esconder ViewportConfigMenu no mobile (`{!isMobile && <ViewportConfigMenu ... />}` na linha 1613 de SkyCanvas)
- A navegação de câmara para mobile já está coberta pelo MobileQuickActions (zoom/reset) e pelo MobileHUD

**5. Verificar que SkyCanvas overlays não aparecem no mobile**

Confirmar que os seguintes estão guardados por `!isMobile` (já estão): TacticalDock, JoiStatusMonitor, Mini-Dock, SelectionStatusBar, AlignmentTools, CameraBookmarksBar, debug panels. O Fly/Ground HUD (bottom-28, z-40) pode sobrepor MobileTabBar — adicionar guard `!isMobile` a esses HUDs também.

---

### Ficheiros a modificar

1. **`src/store/useSceneStore.ts`** — adicionar `droneRendererMode` ao `EnvironmentState`
2. **`src/components/editor/SkyCanvas.tsx`** — importar SwarmPlaybackEngine, renderização condicional, esconder ViewportConfigMenu no mobile, guardar Fly/Ground HUD com `!isMobile`
3. **`src/components/editor/ViewportConfigMenu.tsx`** — adicionar toggle Drone Renderer na secção Display
4. **`src/components/editor/SwarmPlaybackEngine.tsx`** — nenhuma alteração (já funcional)

### Proteções
- DroneChoreography + InstancedDroneSwarm permanecem como renderer default
- Parser VVIZ Worker intacto
- Stores Zustand intactos
- Layout mobile (MobileHUD, MobileTabBar, MobileQuickActions, MobileFloatingPanel) intacto

