

# Refinamento Arquitetural — FX KONTROL Next-Gen Blueprint

## Estado Atual da Plataforma

A auditoria revela uma base sólida: SkyCanvas com 1926 linhas orquestrando 30+ efeitos VFX, Timeline com 1235 linhas e virtualização parcial, RadialMenu holográfico com 373 linhas, LiveCards AR com auto-dissolve, TacticalDock macOS-style, InstancedDroneSwarm zero-GC (corrigido na ronda anterior), burstSimulation com 20 padrões calibrados, e FXKEngine como orquestrador central a 60Hz. A infraestrutura core é robusta mas dispersa — o salto para "próxima geração" exige consolidação arquitetural, não reconstrução.

---

## A. Arquitetura de Interface — HUD/AR Contextual

### A1. Problema Concreto Identificado
O SkyCanvas.tsx importa 50+ componentes de overlay (ARCompassHUD, HUDCrosshairs, PlacingModeOverlay, TelemetryBar, LiveCard, etc.) todos renderizados condicionalmente. Isto gera uma árvore de renderização monolítica onde cada overlay avalia independentemente se deve aparecer.

### A2. Proposta: HUD Layer Manager
Criar `src/core/hud/HUDLayerManager.ts` — um sistema declarativo de camadas que centraliza a lógica de visibilidade:

```text
┌─────────────────────────────────────────────┐
│  HUD Layer Stack (z-order controlado)       │
├─────────────────────────────────────────────┤
│  L5: Alerts (panic, collision, armed)       │
│  L4: Modal Overlays (RadialMenu, Wizard)    │
│  L3: Contextual (LiveCard, AngleEditor)     │
│  L2: Persistent HUD (Crosshairs, Compass)  │
│  L1: Ambient (Telemetry, SMPTE, Perf)      │
│  L0: Canvas (SkyCanvas R3F viewport)        │
└─────────────────────────────────────────────┘
```

Cada camada tem regras de exclusão mútua (ex: RadialMenu aberto suprime LiveCard) e regras de "5-second glance" (informações L1 auto-fade após inatividade). Isto reduz o SkyCanvas.tsx de 1926 linhas eliminando ~200 linhas de imports e renderização condicional.

### A3. Cartões Contextuais Melhorados
O LiveCard atual projeta 2D via evento customizado `livecard-project`. Melhorar para:
- **Multi-card**: suportar seleção múltipla com cards empilhados com offset
- **Edit-in-card**: sliders inline para pan/tilt/caliber diretamente no card, sem abrir painel
- **Dissolve inteligente**: dissolve quando a câmera orbita >45° (não apenas por timeout)

### A4. Erros Não-Intrusivos
Substituir `toast.error()` (usado em 40+ locais) por auras cromáticas no viewport:
- Colisão de drones → halo vermelho pulsante no InstancedMesh afetado
- Timeline overlap → borda âmbar no bloco conflitante
- Geofence violation → flash no GeofenceVisual existente

---

## B. Arquitetura da Experiência — Gamificação Funcional

### B1. Feedback Tátil de Validação
Quando posições são alinhadas dentro da zona NFPA 1123:
- Vetores de segurança em PyroSafetyZones transitam de âmbar pulsante → ciano constante
- Micro-som de "lock" (Web Audio API, <50ms latency)
- O `haptics.ts` existente já tem primitivas — estender com `haptics.safetyLock()` e `haptics.collisionWarn()`

### B2. Repulsão Magnética na Timeline
No drag handler da Timeline (linha 216-233), adicionar interpolação de fricção:
- Quando `startTime` resultante sobrepõe outro item no mesmo track → aplicar `easeOutElastic` que "empurra" o bloco de volta
- Visual: opacity 50% + outline destructive durante a zona proibida
- O item "resiste" ao posicionamento impossível em vez de permitir e depois alertar

### B3. Barras de Progresso de Segurança
Adicionar ao HUD L1 uma barra radial que mostra % de posições com clearance NFPA válido. Quando atinge 100%, pulso ciano + flash sutil. Micro-vitória operacional.

---

## C. Sequenciador Temporal / Timeline

### C1. Problemas Concretos Identificados
1. **Timeline.tsx = 1235 linhas** — monólito com 7 track types inline (Pyro, Formation, DroneFX, Laser, Generative, SFX Audio)
2. **Drag handler sem dead zone** — qualquer mousedown inicia drag, causando deslocamentos acidentais ao clicar para selecionar
3. **Sem undo granular** — o useUndoStore existe mas não é integrado nos drags da timeline
4. **Track types duplicam lógica** — FormationTrackRow, DroneFXTrackRow, LaserTrackRow, GenerativeTrackRow repetem 80% da mesma estrutura

### C2. Proposta de Refatoração
1. **Extrair `TimelineTrackRenderer.tsx`** — componente genérico que recebe `trackConfig` e renderiza qualquer tipo de track. Elimina ~400 linhas de duplicação.

2. **Dead zone de 4px no drag** — só inicia drag após `Math.abs(dx) > 4`, prevenindo deslocamentos acidentais ao clicar

3. **Snap magnético multi-nível**:
   - Beat snap (existente, funcional)
   - Adicionar: snap a outros items no mesmo track (borda-a-borda)
   - Adicionar: snap a markers/cue points
   - Visual: linha vertical ciano quando snap ativa

4. **Lock mode por track** — flag `locked` no track header que impede qualquer edição acidental. Ícone de cadeado no header.

5. **Integração com timelineECS** — o `timelineECS.ts` (já implementado com TypedArrays) não é usado na Timeline.tsx real. Conectar o `translateSystem()` e `collisionSystem()` do ECS ao drag handler para detecção de colisão O(n log n) em vez de O(n²).

### C3. Timeline ↔ 3D Sync
Quando o playhead avança na timeline:
- Posições afetadas no SkyCanvas pulsam suavemente (outline glow)
- Items selecionados na timeline highlight as posições correspondentes no 3D (já parcialmente implementado via `selectedPositionId`)
- Adicionar: ao clicar num item da timeline, câmera faz `flyTo` suave para a posição 3D correspondente

---

## D. Renderização e Simulação Visual

### D1. Estado Atual
- `burstSimulation.ts`: 20 padrões com configs (starCount, velocity, spread, etc.)
- `instancedParticleRenderer.ts`: vertex/fragment shaders com velocity stretching
- `smokeSimulation.ts`, `niagaraEmitterSystem.ts`, `sparkTrailsGPU.ts`: subsistemas modulares
- PostProcessing com Bloom e efeitos de pós-processamento

### D2. Melhorias Propostas

**GPGPU via DataTextures (FBOs)**:
- Criar `src/render_ultra/gpgpu/ParticleGPGPU.ts` que armazena posições e velocidades em `THREE.DataTexture` (RGBA Float)
- Compute pass via render-to-texture: um quad fullscreen com fragment shader que lê posição anterior, aplica gravidade/arrasto/vento, escreve nova posição
- Resultado: física de 1M+ partículas sem tocar a CPU

**6-Way Lighting para Fumaça**:
- O `smokeSimulation.ts` atual usa sprites básicos
- Adicionar 6 lightmaps direcionais pré-computados (±X, ±Y, ±Z)
- Fragment shader interpola entre os 6 mapas baseado na direção da luz dinâmica (explosões próximas)
- Resultado: fumaça que reage à iluminação das explosões em tempo real

**God Rays / Light Scattering**:
- Adicionar pass de volumetric light scattering no PostProcessing existente
- Técnica: radial blur centrado nas fontes de luz mais intensas (explosões HDR)
- Custo: 1 pass adicional, ~0.5ms em GPU moderna

### D3. Pipeline de Renderização Proposto

```text
Frame Pipeline (16.6ms budget):
  1. GPGPU Pass (DataTexture update)     ~0.3ms
  2. InstancedMesh update (drones)        ~0.2ms
  3. Scene render (terrain, fixtures)     ~2.0ms
  4. Particle render (instanced)          ~1.5ms
  5. Smoke volumetrics (6-way lit)        ~1.0ms
  6. Bloom + God Rays post-process        ~1.5ms
  7. HUD overlay composite                ~0.3ms
  Total: ~6.8ms → 60fps com margem
```

---

## E. Biblioteca Paramétrica de Efeitos

### E1. Estado Atual
`burstSimulation.ts` tem 20 padrões com configs estáticas. `EFFECT_LIBRARY` em `effectLibrary.ts` lista efeitos com duração e cor fixas.

### E2. Proposta: Parametric Effect System

Criar `src/data/parametricEffects.ts`:

```text
ParametricEffect {
  basePattern: BurstPattern          // peony, willow, etc.
  caliber: [min, max, default]       // 50-300mm
  starCount: [min, max, default]     // 20-500
  velocity: [min, max, default]      // 10-50 m/s
  spread: [min, max, default]        // 0.1-1.5
  gravityScale: [min, max, default]  // 0.3-3.0
  lifetime: [min, max, default]      // 0.5-8.0s
  trailFactor: [min, max, default]   // 0.0-3.0
  colorVDL: string                   // VDL color name
  branches: number                   // crossette subdivisions
  decayRate: number                  // brightness decay k
}
```

Cada slider no LiveCard ou Properties panel modifica estes parâmetros em tempo real. O `burstSimulation.ts` já aceita `caliber` como escalar — estender para aceitar o objeto paramétrico completo.

### E3. Presets Derivados
Os 20 padrões existentes tornam-se presets pré-configurados do sistema paramétrico. O utilizador pode:
1. Selecionar preset (Peony 3")
2. Ajustar via sliders (mais estrelas, mais gravidade)
3. Salvar como variante personalizada
4. Arrastar para a timeline

---

## F. Arquitetura Técnica — Mapa de Componentes

```text
src/
├── core/
│   ├── engine/          ← FXKEngine (orquestrador 60Hz)
│   ├── hud/             ← [NOVO] HUDLayerManager
│   ├── timeline/        ← [NOVO] TimelineTrackRenderer genérico
│   ├── reliability/     ← LockstepEngine, AutoHeal, Watchdog
│   └── state/           ← SnapshotManager, CommandBus
├── render_ultra/
│   ├── gpgpu/           ← [NOVO] ParticleGPGPU (DataTexture compute)
│   ├── fireworks/       ← burstSimulation, instancedParticle, smoke
│   ├── lighting/        ← [NOVO] 6-way lighting system
│   └── postprocessing/  ← Bloom, GodRays, ToneMapping
├── data/
│   ├── effectLibrary.ts
│   └── parametricEffects.ts  ← [NOVO]
├── components/editor/
│   ├── SkyCanvas.tsx    ← Viewport (simplificado via HUDLayerManager)
│   ├── Timeline.tsx     ← Sequenciador (refatorado)
│   ├── LiveCard.tsx     ← Cartões AR (expandido)
│   ├── RadialMenu.tsx   ← Menu holográfico (existente)
│   └── TacticalDock.tsx ← Dock de ferramentas (existente)
└── lib/
    ├── timelineECS.ts   ← DOD engine (a integrar na Timeline)
    └── haptics.ts       ← Feedback tátil (a expandir)
```

---

## G. Prioridades de Implementação

### Fase 1 — Estabilidade e Timeline (Impacto imediato)
1. Dead zone de 4px no drag da Timeline (previne deslocamentos)
2. Extrair TimelineTrackRenderer genérico (elimina ~400 linhas duplicadas)
3. Integrar timelineECS no drag handler (colisão O(n log n))
4. Track lock mode
5. Snap magnético item-a-item

### Fase 2 — HUD e Experiência (Diferenciação visual)
6. HUDLayerManager com exclusão mútua de overlays
7. LiveCard com edit-in-card (sliders inline)
8. Repulsão magnética visual na Timeline
9. Haptics expandidos (safetyLock, collisionWarn)
10. Erros como auras cromáticas no viewport

### Fase 3 — Renderização Avançada (Superioridade visual)
11. ParticleGPGPU via DataTextures
12. 6-Way Lighting para fumaça
13. God Rays no PostProcessing
14. Parametric Effect System com sliders
15. Timeline ↔ 3D flyTo sync

### Fase 4 — Polish e Escala
16. Simplificar SkyCanvas.tsx (mover overlays para HUDLayerManager)
17. Performance profiling end-to-end
18. Documentação dos sistemas paramétricos

---

## Ficheiros Afetados

| Ficheiro | Ação |
|---|---|
| `src/components/editor/Timeline.tsx` | Refatorar: dead zone, track lock, extrair renderer genérico |
| `src/components/editor/SkyCanvas.tsx` | Simplificar: mover overlays para HUDLayerManager |
| `src/components/editor/LiveCard.tsx` | Expandir: multi-card, edit-in-card, dissolve inteligente |
| `src/core/hud/HUDLayerManager.ts` | **NOVO**: sistema de camadas HUD |
| `src/render_ultra/gpgpu/ParticleGPGPU.ts` | **NOVO**: physics compute via DataTextures |
| `src/data/parametricEffects.ts` | **NOVO**: sistema paramétrico de efeitos |
| `src/lib/timelineECS.ts` | Integrar com Timeline.tsx real |
| `src/lib/haptics.ts` | Expandir com novos feedbacks |
| `src/render_ultra/fireworks/smokeSimulation.ts` | 6-way lighting |
| `src/components/editor/PostProcessing.tsx` | God Rays pass |

---

## Superioridade sobre Finale 3D — Resumo

| Vetor | Finale 3D | FX KONTROL (Proposto) |
|---|---|---|
| Timeline edição | Deslocamentos acidentais reportados | Dead zone + snap magnético + repulsão elástica + ECS |
| Interface | Menus aninhados, painéis fixos | HUD/AR com LiveCards, RadialMenu, disclosure progressivo |
| Feedback de erro | Caixas modais bloqueantes | Auras cromáticas no viewport, fricção elástica |
| Partículas | CPU-bound, <5K | GPGPU via DataTextures, >1M |
| Fumaça | Sprites flat sem iluminação | 6-way lighting volumétrico |
| Biblioteca | Presets estáticos fixos | Sistema paramétrico com sliders em tempo real |
| Experiência | Utilitária, mecânica | Gamificada, flow-inducing, tátil |

