

# Limpeza de Código Legado + Inventário de Funcionalidades + Otimização de Renderização

---

## PARTE 1 — Limpeza de Código Morto

### Arquivos a Remover (sem importações ativas)

| Arquivo | Motivo |
|---|---|
| `src/animation_engine.cjs` | CJS legado, lógica já replicada inline em `useFXKUltraRefinement.ts` |
| `src/fxk_ultra_refinement.cjs` | CJS legado, orquestrador dos 4 CJS — nenhum import no projeto |
| `src/performance_system.cjs` | CJS legado, constantes já copiadas no hook React |
| `src/render_stability.cjs` | CJS legado, 218 LOC sem nenhum consumidor |
| `src/theme_engine.cjs` | CJS legado, cores desatualizadas (não usa Vantablack) |
| `src/components/editor/MissionSetupOverlay.tsx` | 109 LOC, removido do SkyCanvas (comentários confirmam) |
| `src/components/editor/ShowControlPanel.tsx` | Wrapper deprecated → re-exporta ShowCommanderPanel |
| `src/components/editor/SafetyCheckPanel.tsx` | Wrapper deprecated → re-exporta FlightCheckTab |
| `src/components/editor/DMXMonitorGrid.tsx` (raiz) | Shim deprecated → `dmx/DMXMonitorGrid.tsx` |
| `src/components/editor/DMXPanel.tsx` (raiz) | Shim deprecated → `dmx/DMXPanel.tsx` |
| `src/components/editor/DMXOutputPanel.tsx` (raiz) | Shim deprecated → `dmx/DMXOutputPanel.tsx` |
| `src/components/editor/DMXMonitorPanel.tsx` (raiz) | Shim deprecated → `dmx/DMXMonitorPanel.tsx` |
| `src/components/editor/DMXBezierEditor.tsx` (raiz) | Shim deprecated → `dmx/DMXBezierEditor.tsx` |
| `src/core/drones/droneLOD.ts` | 160 LOC, zero importações — LOD não integrado |
| `platform/frontend/src/swarmViewer/swarmViewer.js` | Vanilla JS antigo, não importado pelo app React |

**Antes de remover os shims DMX**, atualizar os 2 consumidores (`LiveFiringPanel.tsx`, `live-firing/FXKNetPanel.tsx`) para importar de `./dmx/` diretamente. E atualizar `LiveFiringPanel.tsx` para importar `ShowCommanderPanel` em vez de `ShowControlPanel`.

**Total**: ~15 arquivos, ~900+ LOC de código morto eliminado.

---

## PARTE 2 — Inventário de Funcionalidades Atuais do Editor

### Categorias e Componentes Ativos

| Categoria | Funcionalidades |
|---|---|
| **Viewport 3D (SkyCanvas)** | Orbit/Fly/Ground camera, PostProcessing (Bloom/SMAA/SSAO), Google 3D Tiles, terrain, grid, rulers, box select, position pins, transform gizmo, AR compass, HUD crosshairs, destruction overlay |
| **Drone Swarm** | InstancedDroneSwarm (6 layers PBR), DroneChoreography (formações animadas), SwarmGPT (IA coreografia), SwarmPlaybackEngine, Boids, collision avoidance, formation builder, trajectory paths/optimizer, takeoff grid, fleet management, drone command |
| **Pirotecnia** | 20+ efeitos (shells, comets, mines, gerbs, waterfalls, roman candles, etc.), VDL parser/quantizer, safety zones, launch angles, pre-fire/smoke/embers |
| **SFX/Iluminação** | DMX panel/monitor/output, sACN/Art-Net, laser control, light programs, fixture layout, stage fixtures, pixel mapping, generative effects, Niagara VFX |
| **Timeline** | Multi-track, SMPTE timecode, audio waveform, pyro timeline track, snap-to-beat, ECS engine (novo) |
| **Exportação** | VVIZ import/export, CSV import, MVR/ILDA, Skybrush SKYC, KMZ, MAVLink flight plan, Finale 3D, Twinmotion/UE5 |
| **Segurança** | Safety panel (flight check + geofence), collision detection, weather, trajectory validation, NFPA compliance |
| **Conectividade** | grandMA3, Bluetooth/BLE, NFC, USB, radio, WiFi Direct, FireOne protocol, TUS upload |
| **IA/Automação** | AICoPilot, SwarmGPT, SmartScriptAssistant, AI optimizer, video-to-formation, model-to-formation |
| **Apresentação** | Reports (PDF/CSV), client approval, client presentation mode, storyboard, show templates, setlist |
| **Hardware** | FXK-M1 (ESP32-S3), OTA firmware, battery model, PID controller, virtual controllers, manufacturer calibration |
| **Novo (recém-adicionado)** | RadialMenu, LiveCard AR/HUD, Timeline ECS |

### Sugestões de Melhoria UX

1. **Onboarding guiado** — Tour interativo para novos usuários (highlight das 5 áreas principais do viewport)
2. **Busca global de comandos** — O `FullscreenCommandMenu` existe mas poderia ter fuzzy search e atalhos contextuais
3. **Presets de workspace** — Salvar/restaurar layouts de painéis (pirotecnia, drones, DMX, apresentação)
4. **Undo/Redo visual** — Histórico visual de alterações com preview de cada estado
5. **Dashboard de status unificado** — Consolidar battery, weather, telemetry, connectivity num único HUD compacto
6. **Drag-and-drop de efeitos** — Arrastar efeitos da biblioteca diretamente para posições no viewport 3D

---

## PARTE 3 — Otimização de Renderização para 2000+ Drones

### Problemas Identificados no `InstancedDroneSwarm.tsx`

1. **6 InstancedMesh × 2000 drones = 12.000 setMatrixAt + 10.000 setColorAt por frame** — para 2000 drones, são 5 `updateMatrix()` por drone × 2000 = 10.000 matrix computations por frame, mais 4 rotores × 2000 = 8.000 extras
2. **`_color.set(ledColor)` com string hex** — parsing de string hex 2000× por frame no hot path
3. **Halo mesh** com opacity 0.0016 — invisível, mas still processed (setMatrixAt + setColorAt para 2000 instâncias)
4. **"Hide unused" loop** — itera do count atual até maxCount para esconder instâncias não usadas, potencialmente milhares de chamadas extras
5. **`droneLOD.ts` não integrado** — LOD system existe mas não é usado, todos os 2000 drones renderizam em full detail

### Otimizações Propostas

| Otimização | Impacto | Implementação |
|---|---|---|
| **Remover halo mesh** | -2000 setMatrixAt/setColorAt por frame | Opacity 0.0016 é invisível — deletar completamente |
| **Pre-parse cores para Float32Array** | -2000 string parses por frame | Converter hex→RGB float uma vez no `computeDronePositions`, passar Float32Array ao swarm |
| **Integrar LOD** | -60% draw calls em zoom-out | `droneLOD.ts` já existe — usar `batchClassifyLOD` para dividir em 3 tiers: full mesh (<150m), simplified (<400m), point sprites (>400m) |
| **Eliminar hide-unused loop** | -N mil setMatrixAt por frame | Usar `mesh.count = activeCount` em vez de zero-scale unused (Three.js já respeita `.count`) |
| **Batch matrix via Float32Array** | -50% overhead | Preencher `instanceMatrix.array` diretamente em vez de Object3D→updateMatrix→setMatrixAt |
| **Skip rotors em LOD distante** | -8000 setMatrixAt para tier instanced/point | Rotores invisíveis a >150m — não processar |

### Plano de Implementação

| Passo | Tarefa | Arquivo |
|---|---|---|
| 1 | Remover 15 arquivos mortos, atualizar imports DMX/ShowControl | Múltiplos |
| 2 | Remover halo mesh do InstancedDroneSwarm | `InstancedDroneSwarm.tsx` |
| 3 | Eliminar hide-unused loop (usar `.count`) | `InstancedDroneSwarm.tsx` |
| 4 | Pre-parse cores em `computeDronePositions` → Float32Array | `DroneChoreography.tsx` |
| 5 | Batch matrix fill direto no `instanceMatrix.array` | `InstancedDroneSwarm.tsx` |
| 6 | Integrar `droneLOD.ts` → 3-tier rendering | `InstancedDroneSwarm.tsx` + novo wrapper |

### Detalhes Técnicos

```text
Current per-frame cost (2000 drones):
  body:  2000 × (position + scale + rotation + updateMatrix + setMatrixAt)
  led:   2000 × (position + scale + updateMatrix + setMatrixAt + setColorAt)
  halo:  2000 × (position + scale + updateMatrix + setMatrixAt + setColorAt)  ← WASTE
  rotor: 8000 × (position + scale + rotation + updateMatrix + setMatrixAt + setColorAt)
  nav:   8000 × (position + scale + updateMatrix + setMatrixAt + setColorAt)
  glow:  1 (selected only)
  hide:  (maxCount - count) × 5 meshes  ← WASTE
  Total: ~22,000 matrix ops + ~20,000 color ops per frame

After optimization:
  body:  2000 × direct float32 write (no Object3D)
  led:   2000 × direct float32 write + pre-parsed color
  rotor: LOD-filtered (only <150m drones) → ~200-500 × 4
  nav:   LOD-filtered → ~200-500 × 4
  halo:  REMOVED
  hide:  REMOVED (use .count)
  Total: ~5,000-8,000 ops per frame (60-75% reduction)
```

