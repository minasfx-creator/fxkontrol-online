

## Plano: Refino Tático — Unificação, Estética e Navegação

### Diagnóstico

Após varredura completa do codebase, muitas das funcionalidades solicitadas **já existem**:
- **TransformControls (Gizmo)**: `PositionTransformGizmo.tsx` e `SiteModelRenderer.tsx` ✅
- **Box/Lasso Selection**: `BoxSelectOverlay.tsx` + `SelectionModeBar.tsx` ✅
- **Fly Mode (WASD + PointerLock)**: `FlyControls` em `SkyCanvas.tsx` ✅
- **OrbitControls com Damping**: `dampingFactor: 0.06` já configurado ✅
- **Joi Hologram**: `JoiHologramAvatar.tsx` + `FXKAssistant.tsx` ✅
- **Camera Presets dropdown**: Menu existente no SkyCanvas ✅
- **MissionSetupOverlay**: Já existe (atualmente desativado) ✅

O que precisa de trabalho real é **unificação visual** e **adições incrementais**.

---

### Etapa 1: VIEWPORT CONFIG — Menu unificado de visualização (SkyCanvas.tsx)

Agrupar os controles dispersos no topo do viewport (Free Look, Fly Mode, Camera Presets) num único dropdown **"VIEWPORT"**:
- Um botão compacto "VIEWPORT" que abre um menu com 3 seções: Camera Presets, Navigation Mode (Orbit/Free Look/Fly), Display Options (rulers, grid, debug)
- Elimina 3 botões separados, substitui por 1

### Etapa 2: TACTICAL DOCK — Dock lateral de ferramentas de edição

Criar um componente `TacticalDock.tsx` — dock vertical minimalista no lado esquerdo do viewport:
- Ícones: Select (cursor), Move (gizmo translate), Rotate (gizmo rotate), Scale (gizmo scale), Lasso, Add Position
- Estilo macOS dock vertical com glassmorphism (`bg-background/80 backdrop-blur-xl`)
- Atalhos de teclado existentes (W/E/R/L) mantidos
- Substitui os controles de modo dispersos no `SelectionModeBar` e `FinaleViewportTools`

### Etapa 3: Joi como Status Monitor — HUD tático fixo

Adicionar um mini-widget fixo no canto superior direito do editor 3D:
- Reutiliza `JoiHologramAvatar` (size="sm") já existente
- Mostra status compacto: FPS, drone count, armed state, connection status
- Scanline + pulse animation já implementados no componente
- Click expande o `FXKAssistant` completo (já existe)

### Etapa 4: Damping e Camera polish

Ajustar `SkyCanvas.tsx` OrbitControls:
- `dampingFactor`: 0.06 → 0.05 (mais cirúrgico)
- Adicionar `enableRotate: !flyMode` para evitar conflito
- Garantir que `makeDefault` está ativo para TransformControls não interferir

### Etapa 5: GROUND OPERATOR mode (Walk Mode)

Estender o `FlyControls` existente com altitude lock:
- Novo toggle "Ground" no VIEWPORT menu
- Reutiliza PointerLock existente
- Trava `camera.position.y` a um valor fixo (1.7m acima do terreno)
- Usa Elevation API já integrada para obter altura do terreno na posição atual

---

### Proteções (não toca)
- APIs Google (Geocoding, Tiles, Elevation) — intactas
- Stores Zustand — intactos
- Sincronização áudio/DMX/SMPTE — intacta
- Assets e configurações — intactos

### Arquivos a criar/modificar
1. **Criar** `src/components/editor/TacticalDock.tsx` — dock lateral de ferramentas
2. **Criar** `src/components/editor/ViewportConfigMenu.tsx` — menu unificado VIEWPORT
3. **Criar** `src/components/editor/JoiStatusMonitor.tsx` — mini HUD com Joi
4. **Modificar** `src/components/editor/SkyCanvas.tsx` — integrar novos componentes, ajustar damping, adicionar Ground mode
5. **Modificar** `src/components/editor/Toolbar.tsx` — remover controles migrados para o VIEWPORT menu

