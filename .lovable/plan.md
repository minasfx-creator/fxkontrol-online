

## Plano: Refino Tático Final — Ground Operator + Limpeza Residual

### Diagnóstico

O codebase do FX Kontrol **já possui** a maioria dos sistemas solicitados no prompt tático:

| Funcionalidade | Estado | Ficheiro |
|---|---|---|
| VVIZ Parser (Web Worker, ArrayBuffer, streaming) | **Superior ao proposto** | `src/lib/vvizWorker.ts` (280 linhas) |
| Drone Renderer (6x InstancedMesh, PBR, LOD) | **Superior ao proposto** | `src/components/editor/InstancedDroneSwarm.tsx` |
| Choreography + Transitions | Completo | `DroneChoreography.tsx` |
| TacticalDock (macOS dock) | Criado | `TacticalDock.tsx` |
| ViewportConfigMenu | Criado | `ViewportConfigMenu.tsx` |
| JoiStatusMonitor HUD | Criado | `JoiStatusMonitor.tsx` |
| FlyControls (WASD + PointerLock) | Completo | `SkyCanvas.tsx` linhas 506-580 |
| Damping 0.05 | Aplicado | `SkyCanvas.tsx` |
| VVIZ Importer (drag-drop + dialog) | Completo | `VVIZImporter.tsx` |

**O parser e renderer propostos no prompt são versões simplificadas do que já existe.** Substituí-los seria um downgrade. O que falta implementar é apenas o **Ground Operator mode**.

---

### O que será feito

**1. GroundControls — Componente R3F em `SkyCanvas.tsx`**

Baseado no `FlyControls` existente (linhas 506-580) com restrições:
- Movimento WASD projetado apenas no plano XZ (componente Y da direção ignorado)
- Sem teclas E/Q/Space (sem controlo vertical manual)
- Velocidade base reduzida: 5 m/s (vs 15 m/s do FlyControls)
- Pitch limitado a ±80° (simula visão humana andando)
- A cada frame, raycast vertical para baixo detecta o chão e trava `camera.position.y = terrainY + 1.7`
- Lerp suave (fator 0.15) para evitar saltos bruscos ao caminhar em terreno irregular
- Fallback: se raycast falha, mantém última altitude conhecida

**2. `raycastTerrainLocal` — Utilitário em `src/core/geo/terrainQuery.ts`**

Nova função que aceita coordenadas locais (x, z) e a scene Three.js:
- Cria raio de `(x, 2000, z)` para baixo `(0, -1, 0)`
- Intersecta todos os filhos da scene (Google Tiles, StageGround, terreno)
- Retorna `hit.point.y` ou `null`
- Sem conversão lat/lng necessária — opera em espaço local

**3. Integração em `SkyCanvas.tsx`**

- Renderização condicional: `FlyControls` quando `flyMode && !groundMode`, `GroundControls` quando `groundMode`
- O estado `groundMode` já existe (adicionado na iteração anterior do ViewportConfigMenu)
- CameraController recebe `freeLook={freeLook || flyMode || groundMode}`

**4. HUD de Ground Mode**

Reutiliza o padrão do Fly Mode HUD (linhas 1656-1667) com indicadores:
- "GROUND OP" em vez de "Fly Mode"
- Mostra altitude relativa ao terreno
- Remove indicações de Q/E Up/Down

---

### Ficheiros modificados: 2

1. **`src/core/geo/terrainQuery.ts`** — adicionar `raycastTerrainLocal()`
2. **`src/components/editor/SkyCanvas.tsx`** — adicionar `GroundControls`, integrar renderização condicional, HUD de ground mode

### Proteções

- Parser VVIZ existente (Worker) — intacto
- InstancedDroneSwarm (PBR renderer) — intacto
- Stores Zustand — intactos
- APIs Google — intactas
- TacticalDock / ViewportConfigMenu / JoiStatusMonitor — intactos

