

# Plano: Refinar Mundo 3D — Replicar Lógica ShowSim + Finale 3D

## Análise dos Manuais

### ShowSim 3D (manual_3d.pdf) — Funcionalidades-chave do mundo 3D:
1. **Sky-dome**: Imagem panorâmica mapeada numa cúpula envolvente com raio configurável (1000-3000), rotação ajustável, imagem de chão separada
2. **Environment Settings**: Vento (velocidade + direção afetam fumaça e drift), intensidade de fumaça, cor do chão, disable smoke/lighting/camera/models
3. **Camera Animation**: Transições suaves com 4 modos de interpolação (Linear, Acelerado, Desacelerado, Acc/Dec), script cronológico com posição X/Y/Z + rotation + pitch, ferramenta de rotação automática circular
4. **Viewpoints**: 4 viewpoints salvos + mouse para mudar viewpoint em tempo real durante simulação
5. **Firing Positions**: Coordenadas 3D livres + ângulo de desvio + direção rotacional, reference markers para medição relativa
6. **Model Library**: Modelos 3D + billboards 2D, escala/rotação/posição via mouse ou coordenadas diretas
7. **Light Editor**: 3 tipos (Point, Directional, Spot) com range, atenuação, cor, cone angles
8. **Rulers**: Réguas vertical e horizontal com unidades métricas/imperiais, máx 1000ft
9. **Low Quality Mode**: Toggle para reduzir processamento durante design, full quality para vídeo final

### Finale 3D (MANUAL_FINALE-13.pdf) — Funcionalidades-chave:
1. **Camera Shortcuts**: Botões de atalho de câmera customizáveis (dezenas) para vistas rápidas
2. **Position Groups**: Botões de grupo de posição para seleção rápida (frontal, shells, lado esquerdo, etc.)
3. **Trajectory Interaction**: Arrastar trajetórias para mover posição, arrastar "donut" no topo para inclinar
4. **Fan Creation**: Converter seleção em ventilador com ângulo configurável
5. **Sequence Creation**: Converter seleção em sequência cronológica (chase)
6. **VDL Language**: Descrição textual de efeitos que gera simulação automaticamente
7. **Lock/Unlock Positions**: Botão de cadeado para proteger posições de movimentação acidental

## O que já temos vs. o que falta

### Já implementado:
- Sky dome com shaders atmosféricos (18.000 raio) ✓
- Camera presets (11) + free look ✓
- OrbitControls com damping ✓
- Firing positions com drag ✓
- LOD system ✓
- Wind/weather store ✓
- Adaptive exposure ✓

### Refinamentos necessários baseados nos manuais:

## Mudanças Planejadas

### 1. Environment Settings Panel — ShowSim-style
Criar painel "Environment Settings" no editor com controles que ambos os softwares oferecem:
- **Wind Speed slider** (0-30 mph) + **Wind Direction** (compass) — já temos no store mas sem UI dedicada
- **Smoke Intensity slider** (como ShowSim: darker↔brighter)
- **Ground Color picker** (ShowSim tem cor sólida customizável)
- **Toggle switches**: Disable Smoke, Disable Lighting, Disable Sound Delay, Low Quality Mode
- **Skydome Rotation** (0-360°) para posicionar o horizonte mais bonito atrás da câmera principal

**Arquivo**: `src/components/editor/ShowSettingsPanel.tsx` — adicionar seção "Environment"

### 2. Camera System — ShowSim Camera Animation Logic
Melhorar o sistema de câmera replicando ShowSim:
- **4 modos de interpolação**: Linear, Accelerated, Decelerated, Accelerate/Decelerate (easeInOutCubic)
  - ShowSim usa estes 4 modos nas transições de câmera
  - Atualmente usamos apenas LERP fixo (0.06) — substituir por curvas adequadas
- **Rotation tool**: ShowSim tem rotação automática circular com Center, Duration, Arc, Steps
  - Adicionar preset "Orbit" nos camera presets que faz órbita 360° ao redor do centro da cena
- **Custom Camera Bookmarks**: Finale 3D permite criar dezenas de atalhos de câmera customizáveis
  - Adicionar botão "+" nos presets para salvar posição atual como bookmark

**Arquivo**: `src/components/editor/CameraAnimator.tsx`, `src/components/editor/SkyCanvas.tsx`

### 3. Sky Dome Refinement — ShowSim Skydome Logic
ShowSim usa:
- **Raio configurável** (1000-3000, clipa acima de 3000)
- **Rotação** da imagem de fundo
- **Imagem de chão separada** (texturas de grama, pedra, água)
- Nós já temos terreno procedural + satellite, que é superior

Refinar:
- Adicionar **rotação da skybox** no SceneStore + uniform no shader
- Manter os 4 presets de terreno mas expor **Ground Color override** para shows sem satélite

**Arquivo**: `src/components/editor/SkyCanvas.tsx` (SkyGradient), `src/store/useSceneStore.ts`

### 4. Firing Position — Reference Markers (ShowSim)
ShowSim permite:
- **Reference markers**: Pontos de referência (ex: árvore real no local) a partir dos quais posições são medidas
- **Ângulos L/R e F/B**: Tilt + Pan por posição (já temos pitch/heading)
- Nós já temos isso via LaunchAngleGizmo ✓

Adicionar:
- **Lock/Unlock toggle** (Finale 3D): Botão de cadeado global para impedir movimentação acidental de posições
- **Position Groups** (Finale 3D): Poder salvar grupos de posições nomeados para seleção rápida

**Arquivo**: `src/store/useProjectStore.ts`, `src/components/editor/PositionGroupsPanel.tsx`

### 5. Quality Mode Toggle — ShowSim Low Quality
ShowSim oferece toggles para desabilitar fumaça, iluminação, modelos durante design para melhor performance.

Adicionar ao Scene Settings:
- **Low Quality Mode**: Reduz partículas 50%, desabilita smoke trails, trails mais curtos
- **Disable Smoke**: Remove completamente SmokeTrail components
- **Disable Lighting**: Desabilita dynamic point lights dos explosions

**Arquivo**: `src/store/useSceneStore.ts`, `src/components/editor/SkyCanvas.tsx` (TimelineEffects)

### 6. Rulers — Vertical/Horizontal (ShowSim)
ShowSim tem réguas visuais vertical e horizontal com métricas.

Adicionar:
- **Vertical ruler overlay** no viewport mostrando alturas em metros (0m, 50m, 100m, 200m, 300m, 600m)
- **Horizontal ruler** mostrando distâncias
- Toggle via botão na toolbar

**Arquivo**: Novo `src/components/editor/ViewportRulers.tsx`

## Resumo de Arquivos a Editar

| Arquivo | Mudança |
|---------|---------|
| `src/store/useSceneStore.ts` | Adicionar: skyRotation, lockPositions, lowQualityMode, disableSmoke, disableLighting, positionGroups |
| `src/components/editor/SkyCanvas.tsx` | Rotação skydome, quality toggles no TimelineEffects, orbit camera preset |
| `src/components/editor/ShowSettingsPanel.tsx` | Seção Environment Settings com todos os controles |
| `src/components/editor/ViewportRulers.tsx` | Novo: réguas vertical/horizontal |
| `src/components/editor/CameraAnimator.tsx` | 4 modos interpolação, orbit rotation tool |
| `src/components/editor/PositionPins.tsx` | Respeitar lock positions toggle |

